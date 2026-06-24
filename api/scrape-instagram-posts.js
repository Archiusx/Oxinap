// api/scrape-instagram-posts.js — Vercel Serverless Function
// Scrapes Instagram posts for a username using Apify actor shu8hvrXbJbY3Eb9W
// Timeout is set generously; client-side also has its own 3-minute soft timeout

export const config = {
  maxDuration: 300, // 5 min Vercel limit for Pro; stays graceful on Hobby (60s)
};

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const APIFY_TOKEN = process.env.VITE_APIFY_API_TOKEN || process.env.APIFY_API_TOKEN;
  if (!APIFY_TOKEN) {
    return res.status(500).json({ error: "Apify API token not configured on server." });
  }

  const { username, limit = 30 } = req.body || {};
  if (!username) {
    return res.status(400).json({ error: "username is required" });
  }

  const cleanUsername = username.replace(/^@/, "").trim();
  const profileUrl = `https://www.instagram.com/${cleanUsername}/`;

  try {
    // 1. Start the actor
    const runRes = await fetch(
      `https://api.apify.com/v2/acts/shu8hvrXbJbY3Eb9W/runs?token=${APIFY_TOKEN}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resultsType: "posts",
          directUrls: [profileUrl],
          resultsLimit: Math.min(limit, 100),
          searchType: "hashtag",
          searchLimit: 10,
          addParentData: false,
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

    // 2. Poll for completion
    // Vercel Hobby functions time out at 60s — we poll up to 50s then return
    // a "still running" payload the client can handle gracefully.
    const POLL_INTERVAL = 5000;
    const HARD_STOP_MS = 55000; // safety margin before Hobby 60s wall
    const start = Date.now();
    let status = "RUNNING";
    let datasetId = null;

    while (Date.now() - start < HARD_STOP_MS) {
      await sleep(POLL_INTERVAL);
      const pollRes = await fetch(
        `https://api.apify.com/v2/actor-runs/${runId}?token=${APIFY_TOKEN}`
      );
      if (!pollRes.ok) break;
      const pollData = await pollRes.json();
      status = pollData?.data?.status;
      datasetId = pollData?.data?.defaultDatasetId;
      if (status === "SUCCEEDED" || status === "FAILED" || status === "ABORTED") break;
    }

    // Still running after our poll window — return runId so client can poll itself
    if (status === "RUNNING" || status === "READY") {
      return res.status(202).json({
        pending: true,
        runId,
        datasetId,
        message: "Actor still running — use /api/scrape-instagram-posts-poll to fetch results",
      });
    }

    if (status !== "SUCCEEDED") {
      return res.status(502).json({ error: `Apify actor ended with status: ${status}` });
    }

    // Guard: datasetId must be present before fetching
    if (!datasetId) {
      return res.status(502).json({ error: "No dataset ID available for completed run" });
    }

    // 3. Fetch items
    const items = await fetchDataset(datasetId, APIFY_TOKEN);
    return res.status(200).json({ posts: normalizeItems(items), runId });
  } catch (err) {
    console.error("scrape-instagram-posts error:", err);
    return res.status(500).json({ error: err.message || "Internal server error" });
  }
}

// ── helper: poll a completed dataset ──────────────────────────────────────
export async function fetchDataset(datasetId, token) {
  const dataRes = await fetch(
    `https://api.apify.com/v2/datasets/${datasetId}/items?token=${token}&limit=100`
  );
  if (!dataRes.ok) throw new Error("Failed to fetch dataset from Apify");
  return dataRes.json();
}

function normalizeItems(items) {
  return (Array.isArray(items) ? items : []).map((item) => ({
    id: item.id ?? item.shortCode ?? Math.random().toString(36).slice(2),
    shortCode: item.shortCode ?? item.id ?? null,
    type: item.type ?? "Image",
    url: item.url ?? (item.shortCode ? `https://www.instagram.com/p/${item.shortCode}/` : null),
    displayUrl: item.displayUrl ?? item.thumbnailSrc ?? null,
    caption: item.caption ?? item.alt ?? null,
    likesCount: item.likesCount ?? item.likes ?? null,
    commentsCount: item.commentsCount ?? item.comments ?? null,
    timestamp: item.timestamp ?? item.taken_at_timestamp ?? null,
    ownerUsername: item.ownerUsername ?? item.owner?.username ?? null,
    ownerFullName: item.ownerFullName ?? item.owner?.full_name ?? null,
    locationName: item.locationName ?? item.location?.name ?? null,
    hashtags: item.hashtags ?? [],
    mentions: item.mentions ?? [],
    videoUrl: item.videoUrl ?? null,
    isVideo: item.isVideo ?? false,
    videoViewCount: item.videoViewCount ?? null,
    images: item.images ?? [],
  }));
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
