// api/scrape-twitter.js — Vercel Serverless Function
// Calls Apify Twitter/X Followers actor server-side (API token never exposed to client)
// Actor: AaT0BcKU5GQh97wdt (Twitter Followers Scraper)

export default async function handler(req, res) {
  // Only allow POST
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const APIFY_TOKEN = process.env.VITE_APIFY_API_TOKEN || process.env.APIFY_API_TOKEN;
  if (!APIFY_TOKEN) {
    return res.status(500).json({ error: "Apify API token not configured on server." });
  }

  const { username, limit = 100 } = req.body || {};
  if (!username) {
    return res.status(400).json({ error: "username is required" });
  }

  // Sanitize: strip leading @ if present
  const cleanUsername = username.replace(/^@/, "").trim();
  if (!/^[a-zA-Z0-9_]{1,50}$/.test(cleanUsername)) {
    return res.status(400).json({ error: "Invalid Twitter username format." });
  }

  try {
    // 1. Start the Apify actor run
    const runRes = await fetch(
      `https://api.apify.com/v2/acts/AaT0BcKU5GQh97wdt/runs?token=${APIFY_TOKEN}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          twitterHandles: [cleanUsername],
          relation: "followers",
          maxItems: Math.min(Number(limit) || 100, 500),
          outputMode: "compact",
          includeTargetMetadata: true,
          getFollowers: false,   // actor uses `relation` field instead
          scrapeAllResults: false,
        }),
      }
    );

    if (!runRes.ok) {
      const errText = await runRes.text();
      console.error("Apify run start error:", errText);
      return res.status(502).json({ error: "Failed to start Apify actor", detail: errText });
    }

    const runData = await runRes.json();
    const runId = runData?.data?.id;
    if (!runId) {
      return res.status(502).json({ error: "No run ID returned from Apify" });
    }

    // 2. Poll for completion (max ~90s with 5s intervals)
    const MAX_POLLS = 18;
    let status = "RUNNING";
    let datasetId = null;

    for (let i = 0; i < MAX_POLLS; i++) {
      await sleep(5000);
      const pollRes = await fetch(
        `https://api.apify.com/v2/actor-runs/${runId}?token=${APIFY_TOKEN}`
      );
      if (!pollRes.ok) break;
      const pollData = await pollRes.json();
      status = pollData?.data?.status;
      datasetId = pollData?.data?.defaultDatasetId;
      if (status === "SUCCEEDED" || status === "FAILED" || status === "ABORTED") break;
    }

    if (status !== "SUCCEEDED") {
      return res.status(502).json({ error: `Apify actor ended with status: ${status}` });
    }

    // 3. Fetch dataset items
    const dataRes = await fetch(
      `https://api.apify.com/v2/datasets/${datasetId}/items?token=${APIFY_TOKEN}&limit=500`
    );
    if (!dataRes.ok) {
      return res.status(502).json({ error: "Failed to fetch dataset from Apify" });
    }

    const items = await dataRes.json();

    // 4. Normalize fields so the dashboard card renders correctly
    const normalized = (Array.isArray(items) ? items : []).map((item) => ({
      id:               item.id            ?? item.userId       ?? Math.random().toString(36).slice(2),
      username:         item.userName      ?? item.username     ?? item.screen_name ?? "",
      display_name:     item.displayName   ?? item.name         ?? item.full_name   ?? "",
      is_verified:      item.isVerified    ?? item.verified     ?? false,
      is_blue_verified: item.isBlueVerified ?? false,
      profile_pic_url:  item.profilePicUrl ?? item.profile_image_url ?? null,
      follower_count:   item.followersCount ?? item.followers_count  ?? null,
      following_count:  item.friendsCount  ?? item.friends_count     ?? null,
      description:      item.description   ?? item.bio               ?? "",
      location:         item.location      ?? "",
      created_at:       item.createdAt     ?? item.created_at        ?? null,
    }));

    return res.status(200).json(normalized);
  } catch (err) {
    console.error("scrape-twitter error:", err);
    return res.status(500).json({ error: err.message || "Internal server error" });
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
