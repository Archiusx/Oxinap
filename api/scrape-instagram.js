// api/scrape-instagram.js — Vercel Serverless Function
// Calls Apify Instagram Followers actor server-side (API token never exposed to client)

export default async function handler(req, res) {
  // Only allow POST
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const APIFY_TOKEN = process.env.VITE_APIFY_API_TOKEN || process.env.APIFY_API_TOKEN;
  if (!APIFY_TOKEN) {
    return res.status(500).json({ error: "Apify API token not configured on server." });
  }

  const { username, dataToScrape = "Followers", limit = 100 } = req.body || {};
  if (!username) {
    return res.status(400).json({ error: "username is required" });
  }

  try {
    // 1. Start the Apify actor run
    const runRes = await fetch(
      `https://api.apify.com/v2/acts/jWD4G57HhqYY0mFhd/runs?token=${APIFY_TOKEN}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          Account: [username],
          resultsLimit: Math.min(limit, 500),
          dataToScrape,
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

    // 2. Poll for completion (max ~60s with 5s intervals)
    const MAX_POLLS = 12;
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

    // 4. Normalize fields so dashboard cards render correctly
    const normalized = (Array.isArray(items) ? items : []).map((item) => ({
      id: item.id ?? item.pk ?? Math.random().toString(36).slice(2),
      username: item.username ?? item.username_scrape ?? "",
      full_name: item.full_name ?? item.fullName ?? "",
      is_private: item.is_private ?? item.isPrivate ?? false,
      is_verified: item.is_verified ?? item.isVerified ?? false,
      profile_pic_url: item.profile_pic_url ?? item.profilePicUrl ?? null,
      follower_count: item.follower_count ?? item.followersCount ?? null,
      type: item.type ?? dataToScrape,
    }));

    return res.status(200).json(normalized);
  } catch (err) {
    console.error("scrape-instagram error:", err);
    return res.status(500).json({ error: err.message || "Internal server error" });
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
