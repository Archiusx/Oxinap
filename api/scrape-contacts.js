// api/scrape-contacts.js — Vercel Serverless Function
// Runs the Apify "Contact Details Scraper" actor (vdrmota/contact-info-scraper,
// actor id 9Sk4JJhEma9vBKqrg) server-side to extract public emails, phone
// numbers, and social-media profile links from a target website.
//
// SECURITY NOTES
// - The Apify API token is read from process.env on the server ONLY. It is
//   never sent to, or readable by, the browser — do not move this logic into
//   src/osintTools.js (client bundle).
// - Only POST is accepted. The only thing the client controls is a single
//   target URL (validated as a public http(s) URL — no localhost/private IPs,
//   so this can't be turned into an internal-network SSRF probe) and an
//   optional page-count cap. Actor id, crawl depth, and the paid enrichment
//   add-ons are fixed/clamped on the server so this endpoint can't be used as
//   an open proxy to scrape arbitrary sites at arbitrary depth/cost.
// - Errors returned to the client are generic; full details are only ever
//   logged server-side via console.error.

const CONTACT_SCRAPER_ACTOR_ID = "9Sk4JJhEma9vBKqrg"; // vdrmota/contact-info-scraper
const MAX_POLLS = 50;          // 50 * 5s = ~250s max wait (function maxDuration is 300s)
const POLL_INTERVAL_MS = 5000;
const DATASET_ITEM_LIMIT = 200;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Same public-URL guard used on the client (src/osintTools.js isPublicHttpUrl)
// duplicated here because server-side validation must never depend on
// anything the client sends being trustworthy.
function isPublicHttpUrl(rawUrl) {
  try {
    const url = new URL(rawUrl);
    const host = url.hostname.toLowerCase();
    if (!["http:", "https:"].includes(url.protocol)) return false;
    if (["localhost", "127.0.0.1", "0.0.0.0", "::1"].includes(host)) return false;
    if (/^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[0-1])\.|169\.254\.)/.test(host)) return false;
    return true;
  } catch {
    return false;
  }
}

// The actor's social-profile array keys have grown over the actor's lifetime
// (older runs only emit facebooks/twitters/linkedIns/instagrams; newer ones
// add telegram/snapchat/threads/tiktok/youtube/pinterest/discord). We collect
// every variant we know about rather than assuming one fixed schema.
const SOCIAL_FIELD_MAP = {
  facebook:  ["facebooks", "facebook"],
  twitter:   ["twitters", "twitter", "xs", "x"],
  linkedin:  ["linkedIns", "linkedins", "linkedin"],
  instagram: ["instagrams", "instagram"],
  telegram:  ["telegrams", "telegram"],
  snapchat:  ["snapchats", "snapchat"],
  threads:   ["threads"],
  tiktok:    ["tiktoks", "tiktok"],
  youtube:   ["youtubes", "youtube"],
  pinterest: ["pinterests", "pinterest"],
  discord:   ["discords", "discord"],
};

function normalizeDatasetItems(items) {
  const emails = new Set();
  const phones = new Set();
  const social = {};
  for (const key of Object.keys(SOCIAL_FIELD_MAP)) social[key] = new Set();

  for (const item of items) {
    if (!item || typeof item !== "object") continue;
    (item.emails || []).forEach((e) => e && emails.add(String(e).trim()));
    (item.phones || []).forEach((p) => p && phones.add(String(p).trim()));
    // Only fall back to "uncertain" phone matches when no confirmed phone was found at all.
    if (!item.phones?.length) {
      (item.phonesUncertain || []).forEach((p) => p && phones.add(String(p).trim()));
    }
    for (const [platform, fieldNames] of Object.entries(SOCIAL_FIELD_MAP)) {
      for (const fieldName of fieldNames) {
        (item[fieldName] || []).forEach((link) => link && social[platform].add(String(link).trim()));
      }
    }
  }

  return {
    emails: [...emails],
    phones: [...phones],
    socialProfiles: Object.fromEntries(
      Object.entries(social).map(([platform, set]) => [platform, [...set]])
    ),
  };
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const APIFY_TOKEN = process.env.APIFY_API_TOKEN || process.env.VITE_APIFY_API_TOKEN;
  if (!APIFY_TOKEN) {
    return res.status(500).json({ error: "Apify API token not configured on server." });
  }

  const { url = "", maxPages = 20, enrichSocialMedia = false } = req.body || {};

  if (!url || !isPublicHttpUrl(url)) {
    return res.status(400).json({ error: "A valid public http(s) URL is required." });
  }

  // Clamp so a single request can't run away with crawl time/cost.
  const cappedMaxPages = Math.min(Math.max(1, Number(maxPages) || 20), 50);

  const input = {
    startUrls: [{ url }],
    maxRequestsPerStartUrl: cappedMaxPages,
    mergeContacts: true,
    maxDepth: 2,
    maxRequests: Math.min(cappedMaxPages * 3, 150),
    sameDomain: true,
    considerChildFrames: true,
    // Business Leads Enrichment add-on (paid, per-employee-record) — off by default.
    maximumLeadsEnrichmentRecords: 0,
    leadsEnrichmentDepartments: ["sales", "marketing"],
    verifyLeadsEnrichmentEmails: false,
    // Social Media Profile Enrichment add-on (paid, per-profile) — off unless explicitly requested.
    scrapeSocialMediaProfiles: {
      facebooks: !!enrichSocialMedia,
      instagrams: !!enrichSocialMedia,
      youtubes: !!enrichSocialMedia,
      tiktoks: !!enrichSocialMedia,
      twitters: !!enrichSocialMedia,
    },
    useBrowser: false,
    waitUntil: "domcontentloaded",
    proxyConfig: { useApifyProxy: true },
  };

  try {
    // 1. Start the Apify actor run
    const runRes = await fetch(
      `https://api.apify.com/v2/acts/${CONTACT_SCRAPER_ACTOR_ID}/runs?token=${APIFY_TOKEN}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      }
    );
    if (!runRes.ok) {
      console.error("scrape-contacts: Apify run start error:", await runRes.text().catch(() => ""));
      return res.status(502).json({ error: "Failed to start the Contact Details Scraper." });
    }
    const runData = await runRes.json();
    const runId = runData?.data?.id;
    if (!runId) {
      return res.status(502).json({ error: "No run ID returned from Apify." });
    }

    // 2. Poll for completion
    let status = "RUNNING";
    let datasetId = runData?.data?.defaultDatasetId || null;
    for (let i = 0; i < MAX_POLLS; i++) {
      await sleep(POLL_INTERVAL_MS);
      const pollRes = await fetch(`https://api.apify.com/v2/actor-runs/${runId}?token=${APIFY_TOKEN}`);
      if (!pollRes.ok) break;
      const pollData = await pollRes.json();
      status = pollData?.data?.status;
      datasetId = pollData?.data?.defaultDatasetId || datasetId;
      if (["SUCCEEDED", "FAILED", "ABORTED", "TIMED-OUT"].includes(status)) break;
    }

    if (status !== "SUCCEEDED") {
      console.error("scrape-contacts: Apify run ended with status:", status);
      return res.status(502).json({ error: "Contact scraper run did not complete successfully." });
    }
    if (!datasetId) {
      return res.status(502).json({ error: "No dataset returned from Apify." });
    }

    // 3. Fetch dataset items
    const dataRes = await fetch(
      `https://api.apify.com/v2/datasets/${datasetId}/items?token=${APIFY_TOKEN}&limit=${DATASET_ITEM_LIMIT}`
    );
    if (!dataRes.ok) {
      return res.status(502).json({ error: "Failed to fetch results from Apify." });
    }
    const items = await dataRes.json();
    const list = Array.isArray(items) ? items : [];

    const { emails, phones, socialProfiles } = normalizeDatasetItems(list);
    const hasAnySocial = Object.values(socialProfiles).some((arr) => arr.length > 0);

    if (!emails.length && !phones.length && !hasAnySocial) {
      return res.status(200).json({ status: "not_found", pagesCrawled: list.length });
    }

    return res.status(200).json({
      status: "found",
      pagesCrawled: list.length,
      emails,
      phones,
      socialProfiles,
    });
  } catch (err) {
    console.error("scrape-contacts error:", err);
    return res.status(500).json({ error: "Internal server error." });
  }
}
