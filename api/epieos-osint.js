// api/epieos-osint.js — Vercel serverless (Node 18+)
//
// Official Epieos API integration (osinter pack) — email + phone reverse lookup.
// Docs: https://epieos.com/docs/api  (OpenAPI 0.1.0)
//
// POST /api/epieos-osint
//   body: { "type": "email", "query": "user@example.com", "modules": [...] }   // modules optional
//   body: { "type": "phone", "query": "+33612345678",     "modules": [...] }   // modules optional
//
// Returns: { type, query, result, creditsRemaining, rateLimit, scannedAt, error? }
//
// Auth: requires EPIEOS_KEY env var (server-side only — never expose to the client).
// Upstream calls may take up to 120s (per Epieos docs) — maxDuration is set accordingly.
//
// Also serves the legacy free-tier email lookup (Google account / HIBP / service
// probes — previously its own api/email-osint.js function, merged here to stay
// under Vercel Hobby's 12-function limit):
//   POST /api/epieos-osint?legacy=1   body: { "email": "user@example.com" }

import { createHash } from "crypto";

export const config = { maxDuration: 120 };

const EPIEOS_BASE = "https://api.epieos.com/v1/search";

const EMAIL_MODULES = new Set([
  "flickr","notion","gravatar","trello","hibp","foursquare","etsy","chess",
  "substack","mapstr","dropbox","google","holehe","skype","plex","linkedin",
  "nikerunclub","fitbit","github","duolingo","adobe","runkeeper","runtastic",
  "samsung","strava","vivino","facebook","protonmail",
]);

const PHONE_MODULES = new Set([
  "skype","phonechecker","hibp","foursquare","substack","mapstr","duolingo","facebook",
]);

function ok(res, status, data) {
  res.setHeader("Content-Type", "application/json");
  res.status(status).json(data);
}

function err(res, status, message, extra = {}) {
  res.setHeader("Content-Type", "application/json");
  res.status(status).json({ error: message, ...extra });
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// E.164-ish: optional + then 8–15 digits
const PHONE_RE = /^\+?[1-9]\d{7,14}$/;

function normalizePhone(raw) {
  return String(raw || "").trim().replace(/[\s().-]/g, "");
}

// ── Legacy free-tier email OSINT (merged from old api/email-osint.js) ───────

async function lookupGoogleAccount(email) {
  try {
    const picasaRes = await fetch(
      `https://picasaweb.google.com/data/entry/api/user/${encodeURIComponent(email)}?alt=json`,
      {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          Accept: "application/json",
        },
        redirect: "follow",
      }
    );

    let gaiaId = null;
    let displayName = null;
    let profilePhoto = null;
    let lastUpdated = null;

    if (picasaRes.ok) {
      try {
        const pData = await picasaRes.json();
        const entry = pData?.entry;
        gaiaId = entry?.["gphoto$user"]?.["$t"] || entry?.["gphoto$id"]?.["$t"] || null;
        displayName = entry?.["gphoto$nickname"]?.["$t"] || entry?.title?.["$t"] || null;
        profilePhoto = entry?.["gphoto$thumbnail"]?.["$t"] || null;
        lastUpdated = entry?.updated?.["$t"] || null;
      } catch (_) {}
    }

    if (!gaiaId) {
      const contactRes = await fetch(
        `https://contacts.google.com/api/profiles/lookup?query=${encodeURIComponent(email)}&lookup_id=lookup-id&response_semantics=json`,
        {
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            Accept: "application/json",
          },
        }
      );
      if (contactRes.ok) {
        try {
          const cData = await contactRes.json();
          gaiaId = cData?.gaia_id || cData?.userId || null;
          displayName = cData?.displayName || displayName;
          profilePhoto = cData?.profilePhoto || profilePhoto;
        } catch (_) {}
      }
    }

    if (!gaiaId) {
      return { found: false, reason: "No public Google account found for this email." };
    }

    const services = {
      googleMaps: `https://www.google.com/maps/contrib/${gaiaId}/reviews`,
      googleCalendar: `https://calendar.google.com/calendar/u/0/r?cid=contacts%40${email}`,
      googlePlusArchive: `https://web.archive.org/web/*/${encodeURIComponent(`plus.google.com/u/0/${gaiaId}`)}`,
      googlePhotos: `https://picasaweb.google.com/${gaiaId}`,
    };

    return { found: true, gaiaId, displayName, profilePhoto, lastUpdated, services };
  } catch (e) {
    return { found: false, reason: e.message };
  }
}

async function checkHIBP(email) {
  const results = { found: 0, breaches: [], pasteCount: 0, source: "HIBP" };
  const HIBP_KEY = process.env.HIBP_API_KEY || "";

  if (HIBP_KEY) {
    try {
      const res = await fetch(
        `https://haveibeenpwned.com/api/v3/breachedaccount/${encodeURIComponent(email)}?truncateResponse=false`,
        {
          headers: {
            "hibp-api-key": HIBP_KEY,
            "User-Agent": "Oxinap-OSINT/1.0",
            Accept: "application/json",
          },
        }
      );
      if (res.status === 200) {
        const data = await res.json();
        results.found = data.length;
        results.breaches = data.map((b) => ({
          name: b.Name, domain: b.Domain, date: b.BreachDate, pwnCount: b.PwnCount,
          dataClasses: b.DataClasses?.slice(0, 5) || [],
          description: (b.Description || "").replace(/<[^>]+>/g, "").slice(0, 150),
          isVerified: b.IsVerified, isSensitive: b.IsSensitive,
        }));
      } else if (res.status === 404) {
        results.found = 0;
        results.breaches = [];
      }
    } catch (_) {}
  } else {
    try {
      const domain = email.split("@")[1];
      const breachListRes = await fetch("https://haveibeenpwned.com/api/v3/breaches", {
        headers: { "User-Agent": "Oxinap-OSINT/1.0", Accept: "application/json" },
      });
      if (breachListRes.ok) {
        const allBreaches = await breachListRes.json();
        const domainMatches = allBreaches.filter(
          (b) => b.Domain && b.Domain.toLowerCase().includes(domain?.toLowerCase())
        ).slice(0, 3);
        if (domainMatches.length) {
          results.found = domainMatches.length;
          results.breaches = domainMatches.map((b) => ({
            name: b.Name, domain: b.Domain, date: b.BreachDate, pwnCount: b.PwnCount,
            dataClasses: b.DataClasses?.slice(0, 5) || [],
            isVerified: b.IsVerified, isSensitive: b.IsSensitive,
            note: "Domain-matched from public breach list (add HIBP_API_KEY for per-email results)",
          }));
        }
      }
    } catch (_) {}
    results.source = "HIBP Public List (no API key)";
  }
  return results;
}

const SERVICE_PROBES = [
  { name: "Twitter/X", url: (e) => `https://api.twitter.com/i/users/email_available.json?email=${encodeURIComponent(e)}`,
    check: async (res) => { if (!res.ok) return null; const d = await res.json().catch(() => null); return d?.taken === true ? "registered" : d?.taken === false ? "not_found" : null; }, icon: "𝕏" },
  { name: "GitHub", url: (e) => `https://github.com/users/check_signup_email?email=${encodeURIComponent(e)}`,
    check: async (res) => { if (res.status === 422) return "registered"; if (res.ok) return "not_found"; return null; }, icon: "⚙" },
  { name: "Spotify", url: (e) => `https://spclient.wg.spotify.com/signup/public/v1/account?validate=1&email=${encodeURIComponent(e)}&displayname=test`,
    check: async (res) => { if (!res.ok) return null; const d = await res.json().catch(() => null); if (d?.status === 20) return "not_found"; if (d?.errors?.email) return "registered"; return null; }, icon: "🎵" },
  { name: "Duolingo", url: (e) => `https://www.duolingo.com/api/1/user_info?email=${encodeURIComponent(e)}`,
    check: async (res) => { if (!res.ok) return null; const d = await res.json().catch(() => null); return d?.user_info?.username ? "registered" : "not_found"; }, icon: "🦉" },
  { name: "Adobe", url: (e) => `https://accounts.adobe.com/api/account/v2/users/${encodeURIComponent(e)}/email/exist`,
    check: async (res) => { if (res.status === 200) return "registered"; if (res.status === 404) return "not_found"; return null; }, icon: "🅰" },
  { name: "Imgur", url: (e) => `https://api.imgur.com/3/emailcheck/${encodeURIComponent(e)}`,
    check: async (res) => { if (!res.ok) return null; const d = await res.json().catch(() => null); return d?.data?.exists === true ? "registered" : "not_found"; }, icon: "🖼" },
  { name: "Gravatar", url: (e) => `https://www.gravatar.com/${createHash("md5").update(e.toLowerCase().trim()).digest("hex")}.json`,
    check: async (res) => { if (res.status === 200) return "registered"; if (res.status === 404) return "not_found"; return null; }, icon: "🌐" },
];

async function probeServices(email) {
  const results = [];
  await Promise.allSettled(
    SERVICE_PROBES.map(async (probe) => {
      try {
        const url = probe.url(email);
        const res = await fetch(url, {
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
            Accept: "application/json",
          },
          redirect: "follow",
        });
        const status = await probe.check(res);
        if (status !== null) results.push({ name: probe.name, status, icon: probe.icon });
      } catch (_) {}
    })
  );
  return results;
}

async function handleLegacyEmailOsint(req, res) {
  if (req.method !== "POST") return err(res, 405, "POST only");
  const { email } = req.body || {};
  if (!email || !EMAIL_RE.test(email)) return err(res, 400, "Valid email required");

  const [googleResult, hibpResult, serviceResults] = await Promise.allSettled([
    lookupGoogleAccount(email),
    checkHIBP(email),
    probeServices(email),
  ]);

  return ok(res, 200, {
    email,
    google: googleResult.status === "fulfilled" ? googleResult.value : { found: false, reason: googleResult.reason?.message || "Lookup failed" },
    hibp: hibpResult.status === "fulfilled" ? hibpResult.value : { found: 0, breaches: [], error: hibpResult.reason?.message },
    services: serviceResults.status === "fulfilled" ? serviceResults.value : [],
    scannedAt: new Date().toISOString(),
  });
}

// ── Main entry point ─────────────────────────────────────────────────────────

export default async function handler(req, res) {
  try {
    const isLegacy = req.query?.legacy === "1" || req.query?.legacy === "true";
    if (isLegacy) return await handleLegacyEmailOsint(req, res);
    return await handleEpieosRequest(req, res);
  } catch (e) {
    return err(res, 500, `Unexpected server error: ${e?.message || "unknown"}`);
  }
}

async function handleEpieosRequest(req, res) {
  if (req.method !== "POST") return err(res, 405, "POST only");

  const EPIEOS_KEY = process.env.EPIEOS_KEY || "";
  if (!EPIEOS_KEY) {
    return err(res, 500, "EPIEOS_KEY is not configured on the server. Add it in Vercel → Project → Settings → Environment Variables.");
  }

  const { type, query, modules } = req.body || {};

  if (type !== "email" && type !== "phone") {
    return err(res, 400, 'type must be "email" or "phone"');
  }
  if (!query || typeof query !== "string" || !query.trim()) {
    return err(res, 400, "query is required");
  }

  const cleanQuery = type === "email" ? query.trim().toLowerCase() : normalizePhone(query);

  if (type === "email" && !EMAIL_RE.test(cleanQuery)) {
    return err(res, 400, "Valid email address required");
  }
  if (type === "phone" && !PHONE_RE.test(cleanQuery)) {
    return err(res, 400, "Valid phone number required (E.164 format, e.g. +33612345678)");
  }

  // Validate/clean requested modules against the allowed set for this search type
  const allowedSet = type === "email" ? EMAIL_MODULES : PHONE_MODULES;
  let cleanModules;
  if (Array.isArray(modules) && modules.length > 0) {
    cleanModules = modules.filter((m) => allowedSet.has(m));
    if (cleanModules.length === 0) cleanModules = undefined; // fall back to "all modules"
  }

  const endpoint = `${EPIEOS_BASE}/${type}/osinter`;
  const body = { query: cleanQuery };
  if (cleanModules) body.modules = cleanModules;

  // Epieos docs: a single request may take up to 120s — give it room, but
  // still guard with an AbortController so a hung upstream can't hang us forever.
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 115_000);

  let upstreamRes;
  try {
    upstreamRes = await fetch(endpoint, {
      method: "POST",
      headers: {
        "api-key": EPIEOS_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (e) {
    clearTimeout(timeout);
    if (e.name === "AbortError") {
      return err(res, 504, "Epieos request timed out after 115s");
    }
    return err(res, 502, `Failed to reach Epieos API: ${e.message}`);
  }
  clearTimeout(timeout);

  // Surface Epieos's own rate-limit / credit headers so the dashboard can show them
  const rateLimit = {
    limit: upstreamRes.headers.get("ratelimit-limit"),
    remaining: upstreamRes.headers.get("ratelimit-remaining"),
    reset: upstreamRes.headers.get("ratelimit-reset"),
  };
  const creditsRemaining = upstreamRes.headers.get("x-remaining-credits");

  let payload;
  try {
    payload = await upstreamRes.json();
  } catch (_) {
    payload = null;
  }

  if (!upstreamRes.ok) {
    // Map Epieos's documented error shapes 1:1 so the frontend can branch on status
    const message =
      payload?.message ||
      {
        400: "Invalid query format or module filter.",
        401: "Invalid or expired Epieos API key.",
        402: "Insufficient Epieos credit balance.",
        403: "This API key does not have access to the osinter pack.",
        429: "Epieos rate limit reached — slow down requests.",
        500: "Epieos API search failed.",
      }[upstreamRes.status] ||
      "Epieos API request failed.";

    return err(res, upstreamRes.status, message, {
      type,
      query: cleanQuery,
      creditsRemaining: creditsRemaining != null ? Number(creditsRemaining) : null,
      rateLimit,
    });
  }

  return ok(res, 200, {
    type,
    query: cleanQuery,
    result: payload?.result || {},
    creditsRemaining: creditsRemaining != null ? Number(creditsRemaining) : null,
    rateLimit,
    scannedAt: new Date().toISOString(),
  });
}
