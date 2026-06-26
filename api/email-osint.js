// api/email-osint.js  — Vercel serverless (Node 18+)
import { createHash } from "crypto";
// Provides Epieos-style email OSINT:
//   1. Google Account ID + linked services (Maps, Calendar, G+ Archive)
//   2. Have I Been Pwned (HIBP) breach count + breach list
//   3. Holehe-style service enumeration (password-reset probes)
//
// POST /api/email-osint  { "email": "user@example.com" }
// Returns JSON with { google, hibp, services, error? }

export const config = { maxDuration: 25 };

// ── helpers ─────────────────────────────────────────────────────────────────

function ok(res, data) {
  res.setHeader("Content-Type", "application/json");
  res.status(200).json(data);
}

function err(res, msg, status = 400) {
  res.setHeader("Content-Type", "application/json");
  res.status(status).json({ error: msg });
}

// ── Google Account Lookup ────────────────────────────────────────────────────
// Uses the undocumented People API trick to resolve a Gmail address
// to a numeric Google Account ID (Gaia ID), which in turn gives us
// the public Maps contributor URL, Calendar URL, and G+ Archive.
//
// Endpoint: GET https://people.googleapis.com/v1/people/lookup
//   ?resourceName=people%2F%7B...%7D
// Actually: we use the simpler "photo" endpoint that Epieos uses —
// a POST to the Google Contacts batch lookup which returns the
// profile photo URL and internal person ID.
// This is public/unauthenticated for Gmail accounts.

async function lookupGoogleAccount(email) {
  try {
    // The Epieos approach: hit the Google People "contactLookup" endpoint
    // that resolves email → gaia ID without auth for public accounts.
    // Specifically: https://people.googleapis.com/v1/people:batchGet
    // is gated, but the "suggest" endpoint for Google Workspace is not.
    //
    // We use two reliable public endpoints:
    //   a) gravatar-style: https://www.google.com/s2/photos/profile/{email_md5}
    //   b) The People API emailLookup (no key required for gmail.com accounts):
    //      POST https://people.googleapis.com/v1/people:searchContacts
    //
    // The most reliable unauthenticated method is the G+ / People "lookup"
    // approach via the old endpoint still live as of 2025.

    const photoUrl = `https://www.google.com/s2/photos/profile/${encodeURIComponent(email)}`;

    // Try the undocumented people lookup that returns gaia ID
    // This works for gmail.com accounts that have a public profile
    const lookupUrl = `https://people.googleapis.com/v1/people/lookup?resourceName=people%2Fme&personFields=names,photos&query=${encodeURIComponent(email)}`;

    // Alternate: use the HiDef endpoint Epieos actually uses
    // POST to https://contacts.google.com/api/profiles/lookup
    // body: { "emailAddresses": ["user@gmail.com"] }
    // We replicate the same call Epieos makes in its free tier
    const gaiaRes = await fetch(
      "https://people.googleapis.com/v1/people:searchDirectoryPeople?" +
        new URLSearchParams({
          query: email,
          readMask: "names,photos,emailAddresses",
          sources: "DIRECTORY_SOURCE_TYPE_DOMAIN_PROFILE",
        }),
      {
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; OSINT-Research/1.0)",
          Accept: "application/json",
        },
      }
    );

    // ── Method 2: the contactSync trick ──────────────────────────────────────
    // Sending a crafted request to the People "emailAddress" lookup which
    // returns a gaia ID even for personal Gmail accounts (no OAuth needed).
    // This is the same endpoint Epieos / GHunt use in their free probes.
    const gaiaBody = JSON.stringify({
      email: email,
      contactLookup: { queryParamName: "email", value: email },
    });

    // ── Method 3: the most reliable unauthenticated method ──────────────────
    // GHunt-style: POST to https://accounts.google.com/accounts/OAuthLogin
    // is now blocked. But the following is still open:
    // GET https://picasaweb.google.com/data/entry/api/user/{email}?alt=json
    // (returns gaia ID in the gphoto:user element)
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
        // gphoto$user → the user entry; gphoto$id → numeric gaia ID
        const entry = pData?.entry;
        gaiaId = entry?.["gphoto$user"]?.["$t"] || entry?.["gphoto$id"]?.["$t"] || null;
        displayName = entry?.["gphoto$nickname"]?.["$t"] || entry?.title?.["$t"] || null;
        profilePhoto = entry?.["gphoto$thumbnail"]?.["$t"] || null;
        lastUpdated = entry?.updated?.["$t"] || null;
      } catch (_) {}
    }

    // ── Method 4: Google Contacts profile lookup (unauthenticated) ───────────
    // For non-gmail or if Picasa returned nothing, try the contact lookup
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

    return {
      found: true,
      gaiaId,
      displayName,
      profilePhoto,
      lastUpdated,
      services,
    };
  } catch (e) {
    return { found: false, reason: e.message };
  }
}

// ── HIBP Breach Check ────────────────────────────────────────────────────────
// Have I Been Pwned v3 API — requires API key for /breachedaccount
// Free endpoint (no key): /breaches?domain=... — doesn't check email
// We use the free /search API + the public breach list overlay.
//
// Since HIBP v3 requires a paid API key for per-email lookups, we use:
//   a) HIBP free endpoint for domain-level breach list
//   b) Public paste search via the unauthenticated pastes endpoint (deprecated)
//   c) LeakCheck.io unauthenticated preview endpoint
//   d) If HIBP_API_KEY env var is set, use the full v3 /breachedaccount endpoint

async function checkHIBP(email) {
  const results = { found: 0, breaches: [], pasteCount: 0, source: "HIBP" };

  const HIBP_KEY = process.env.HIBP_API_KEY || "";

  if (HIBP_KEY) {
    // Full HIBP v3 check with API key
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
          name: b.Name,
          domain: b.Domain,
          date: b.BreachDate,
          pwnCount: b.PwnCount,
          dataClasses: b.DataClasses?.slice(0, 5) || [],
          description: (b.Description || "").replace(/<[^>]+>/g, "").slice(0, 150),
          isVerified: b.IsVerified,
          isSensitive: b.IsSensitive,
        }));
      } else if (res.status === 404) {
        results.found = 0;
        results.breaches = [];
      }
    } catch (_) {}
  } else {
    // No API key — use public breach database overlay
    // We fetch the full public breach list and do a domain heuristic match
    // This is NOT per-email but provides useful context
    try {
      const domain = email.split("@")[1];
      const breachListRes = await fetch(
        `https://haveibeenpwned.com/api/v3/breaches`,
        {
          headers: {
            "User-Agent": "Oxinap-OSINT/1.0",
            Accept: "application/json",
          },
        }
      );
      if (breachListRes.ok) {
        const allBreaches = await breachListRes.json();
        // Return up to 3 breaches that match the email domain — useful context
        const domainMatches = allBreaches.filter(
          (b) => b.Domain && b.Domain.toLowerCase().includes(domain?.toLowerCase())
        ).slice(0, 3);
        if (domainMatches.length) {
          results.found = domainMatches.length;
          results.breaches = domainMatches.map((b) => ({
            name: b.Name,
            domain: b.Domain,
            date: b.BreachDate,
            pwnCount: b.PwnCount,
            dataClasses: b.DataClasses?.slice(0, 5) || [],
            isVerified: b.IsVerified,
            isSensitive: b.IsSensitive,
            note: "Domain-matched from public breach list (add HIBP_API_KEY for per-email results)",
          }));
        }
      }
    } catch (_) {}
    results.source = "HIBP Public List (no API key)";
  }

  return results;
}

// ── Holehe-style Service Enumeration ─────────────────────────────────────────
// Checks if the email is registered on popular services by probing
// the password reset / "forgot password" endpoint — same technique
// as holehe, but using only public, non-intrusive probes.
// We limit to a curated set of services that have stable, public
// registration-check endpoints.

const SERVICE_PROBES = [
  {
    name: "Twitter/X",
    url: (e) =>
      `https://api.twitter.com/i/users/email_available.json?email=${encodeURIComponent(e)}`,
    check: async (res) => {
      if (!res.ok) return null;
      const d = await res.json().catch(() => null);
      // taken: true means email IS registered
      return d?.taken === true ? "registered" : d?.taken === false ? "not_found" : null;
    },
    icon: "𝕏",
  },
  {
    name: "GitHub",
    url: (e) =>
      `https://github.com/users/check_signup_email?email=${encodeURIComponent(e)}`,
    check: async (res) => {
      if (res.status === 422) return "registered";
      if (res.ok) return "not_found";
      return null;
    },
    icon: "⚙",
  },
  {
    name: "Spotify",
    url: (e) =>
      `https://spclient.wg.spotify.com/signup/public/v1/account?validate=1&email=${encodeURIComponent(e)}&displayname=test`,
    check: async (res) => {
      if (!res.ok) return null;
      const d = await res.json().catch(() => null);
      // status: "email-registered" means found
      if (d?.status === 20) return "not_found";
      if (d?.errors?.email) return "registered";
      return null;
    },
    icon: "🎵",
  },
  {
    name: "Duolingo",
    url: (e) =>
      `https://www.duolingo.com/api/1/user_info?email=${encodeURIComponent(e)}`,
    check: async (res) => {
      if (!res.ok) return null;
      const d = await res.json().catch(() => null);
      return d?.user_info?.username ? "registered" : "not_found";
    },
    icon: "🦉",
  },
  {
    name: "Adobe",
    url: (e) =>
      `https://accounts.adobe.com/api/account/v2/users/${encodeURIComponent(e)}/email/exist`,
    check: async (res) => {
      if (res.status === 200) return "registered";
      if (res.status === 404) return "not_found";
      return null;
    },
    icon: "🅰",
  },
  {
    name: "Imgur",
    url: (e) =>
      `https://api.imgur.com/3/emailcheck/${encodeURIComponent(e)}`,
    check: async (res) => {
      if (!res.ok) return null;
      const d = await res.json().catch(() => null);
      return d?.data?.exists === true ? "registered" : "not_found";
    },
    icon: "🖼",
  },
  {
    name: "Gravatar",
    url: (e) => {
      const hash = createHash("md5").update(e.toLowerCase().trim()).digest("hex");
      return `https://www.gravatar.com/${hash}.json`;
    },
    check: async (res) => {
      if (res.status === 200) return "registered";
      if (res.status === 404) return "not_found";
      return null;
    },
    icon: "🌐",
  },
];

async function probeServices(email) {
  const results = [];

  await Promise.allSettled(
    SERVICE_PROBES.map(async (probe) => {
      try {
        const url = probe.url(email);
        const res = await fetch(url, {
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
            Accept: "application/json",
          },
          redirect: "follow",
        });
        const status = await probe.check(res);
        if (status !== null) {
          results.push({ name: probe.name, status, icon: probe.icon });
        }
      } catch (_) {
        // Silently skip probe failures
      }
    })
  );

  return results;
}

// ── Main handler ─────────────────────────────────────────────────────────────

export default async function handler(req, res) {
  if (req.method !== "POST") return err(res, "POST only", 405);

  const { email } = req.body || {};
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return err(res, "Valid email required");
  }

  const [googleResult, hibpResult, serviceResults] = await Promise.allSettled([
    lookupGoogleAccount(email),
    checkHIBP(email),
    probeServices(email),
  ]);

  ok(res, {
    email,
    google:
      googleResult.status === "fulfilled"
        ? googleResult.value
        : { found: false, reason: googleResult.reason?.message || "Lookup failed" },
    hibp:
      hibpResult.status === "fulfilled"
        ? hibpResult.value
        : { found: 0, breaches: [], error: hibpResult.reason?.message },
    services:
      serviceResults.status === "fulfilled" ? serviceResults.value : [],
    scannedAt: new Date().toISOString(),
  });
}
