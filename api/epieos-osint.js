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

export default async function handler(req, res) {
  try {
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
