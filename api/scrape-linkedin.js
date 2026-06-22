// api/scrape-linkedin.js — Vercel Serverless Function
// Calls the Apify LinkedIn Profile Scraper actor server-side.
//
// SECURITY NOTES
// - The Apify API token is read from process.env on the server ONLY. It is
//   never sent to, or readable by, the browser. Do not move this logic into
//   src/osintTools.js (client bundle) — anything in a Vite "import.meta.env"
//   var is baked into the public JS bundle and would leak the token.
// - Only POST is accepted, and the input is restricted to a LinkedIn
//   "/in/<username>" URL the server itself builds from a validated username
//   (or a pre-validated linkedin.com/in/ URL). The client can never pass an
//   arbitrary "queries" array, actor id, or scraper mode — that would turn
//   this endpoint into an open proxy for scraping any site at your expense.
// - Errors returned to the client are intentionally generic; full details
//   (including anything Apify sends back) are only ever written to the
//   server log via console.error, never to the response body.

const LINKEDIN_ACTOR_ID = "LpVuK3Zozwuipa5bp"; // LinkedIn Profile Scraper (harvestapi)
const PROFILE_SCRAPER_MODE = "Profile details no email ($4 per 1k)";
const MAX_POLLS = 12; // 12 * 5s = ~60s max wait for the actor run
const POLL_INTERVAL_MS = 5000;

// A LinkedIn public identifier is letters/digits/hyphens/underscores/percent-
// encoding only. Anything outside this is rejected rather than forwarded.
const VALID_USERNAME = /^[a-zA-Z0-9\-_%.]{1,100}$/;
const VALID_PROFILE_URL = /^https:\/\/(www\.)?linkedin\.com\/in\/[a-zA-Z0-9\-_%.]{1,100}\/?$/i;

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const APIFY_TOKEN = process.env.APIFY_API_TOKEN || process.env.VITE_APIFY_API_TOKEN;
  if (!APIFY_TOKEN) {
    return res.status(500).json({ error: "Apify API token not configured on server." });
  }

  const { username = "", profileUrl = "" } = req.body || {};
  const cleanedUsername = String(username).trim().replace(/^@+/, "");

  let targetUrl = "";
  if (profileUrl && VALID_PROFILE_URL.test(profileUrl)) {
    targetUrl = profileUrl;
  } else if (cleanedUsername && VALID_USERNAME.test(cleanedUsername)) {
    targetUrl = `https://www.linkedin.com/in/${cleanedUsername}`;
  } else {
    return res.status(400).json({ error: "A valid LinkedIn username or profile URL is required." });
  }

  try {
    // 1. Start the Apify actor run
    const runRes = await fetch(
      `https://api.apify.com/v2/acts/${LINKEDIN_ACTOR_ID}/runs?token=${APIFY_TOKEN}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          profileScraperMode: PROFILE_SCRAPER_MODE,
          queries: [targetUrl],
        }),
      }
    );

    if (!runRes.ok) {
      console.error("Apify run start error:", await runRes.text().catch(() => ""));
      return res.status(502).json({ error: "Failed to start the LinkedIn scraper." });
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
      const pollRes = await fetch(
        `https://api.apify.com/v2/actor-runs/${runId}?token=${APIFY_TOKEN}`
      );
      if (!pollRes.ok) break;
      const pollData = await pollRes.json();
      status = pollData?.data?.status;
      datasetId = pollData?.data?.defaultDatasetId || datasetId;
      if (["SUCCEEDED", "FAILED", "ABORTED", "TIMED-OUT"].includes(status)) break;
    }

    if (status !== "SUCCEEDED") {
      console.error("Apify run ended with status:", status);
      return res.status(502).json({ error: "LinkedIn scraper run did not complete successfully." });
    }
    if (!datasetId) {
      return res.status(502).json({ error: "No dataset returned from Apify." });
    }

    // 3. Fetch dataset items
    const dataRes = await fetch(
      `https://api.apify.com/v2/datasets/${datasetId}/items?token=${APIFY_TOKEN}&limit=5`
    );
    if (!dataRes.ok) {
      return res.status(502).json({ error: "Failed to fetch results from Apify." });
    }
    const items = await dataRes.json();
    const profile = Array.isArray(items) ? items.find((it) => it && !it.error) : null;

    if (!profile) {
      // Actor ran fine but found no public profile at that URL.
      return res.status(200).json({ status: "not_found" });
    }

    // 4. Normalize so the dashboard renders this the same way as every
    //    other platform card (only public profile fields, nothing inferred).
    const location =
      (typeof profile.location === "string" && profile.location) ||
      profile.location?.linkedinText ||
      profile.location?.parsed?.text ||
      null;

    const currentPosition =
      profile.currentPosition?.[0]?.companyName ||
      profile.experience?.[0]?.companyName ||
      profile.currentCompany?.name ||
      null;

    const normalized = {
      status: "found",
      publicIdentifier: profile.publicIdentifier || cleanedUsername || null,
      linkedinUrl: profile.linkedinUrl || targetUrl,
      fullName: [profile.firstName, profile.lastName].filter(Boolean).join(" ") || profile.fullName || null,
      headline: profile.headline || null,
      about: profile.about || profile.summary || null,
      location,
      currentPosition,
      followersCount: profile.followerCount ?? profile.followersCount ?? null,
      connectionsCount: profile.connectionsCount ?? profile.connectionCount ?? null,
      profilePicture: profile.photo || profile.profilePicture || profile.profilePictureUrl || null,
      skills: Array.isArray(profile.skills) ? profile.skills.slice(0, 10) : [],
      topExperience: Array.isArray(profile.experience)
        ? profile.experience.slice(0, 3).map((e) => ({
            title: e.position || e.title || null,
            company: e.companyName || e.company || null,
            duration: e.duration || e.startDate?.text || null,
          }))
        : [],
      topEducation: Array.isArray(profile.education)
        ? profile.education.slice(0, 2).map((e) => ({
            school: e.schoolName || e.school || null,
            degree: e.degree || null,
          }))
        : [],
    };

    return res.status(200).json(normalized);
  } catch (err) {
    console.error("scrape-linkedin error:", err);
    return res.status(500).json({ error: "Internal server error." });
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
