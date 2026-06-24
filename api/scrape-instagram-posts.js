// api/scrape-instagram-posts.js — Vercel Serverless Function
// Uses apify/instagram-post-scraper (apify~instagram-post-scraper)
// Input: plain username array — no URL construction needed.

export const config = {
  maxDuration: 300,
};

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const APIFY_TOKEN = process.env.VITE_APIFY_API_TOKEN || process.env.APIFY_API_TOKEN;
  if (!APIFY_TOKEN) return res.status(500).json({ error: "Apify token not configured" });

  const { username, limit = 30 } = req.body || {};
  if (!username) return res.status(400).json({ error: "username is required" });

  const cleanUsername = username.replace(/^@/, "").trim();

  // apify/instagram-post-scraper accepts plain usernames directly — no URL needed
  const actorInput = {
    username: [cleanUsername],
    resultsLimit: Math.min(limit, 100),
    dataDetailLevel: "basicData",
  };
  console.log("[ig-posts] actor=apify~instagram-post-scraper input:", JSON.stringify(actorInput));

  try {
    // 1. Start the actor
    const runRes = await fetch(
      `https://api.apify.com/v2/acts/apify~instagram-post-scraper/runs?token=${APIFY_TOKEN}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(actorInput),
      }
    );
    if (!runRes.ok) {
      const errText = await runRes.text();
      console.error("[ig-posts] actor start error:", errText);
      return res.status(502).json({ error: "Failed to start Apify actor", detail: errText });
    }

    const runData = await runRes.json();
    const runId = runData?.data?.id;
    if (!runId) return res.status(502).json({ error: "No run ID from Apify" });
    console.log("[ig-posts] runId:", runId);

    // 2. Poll until done or Vercel's 55s safety window
    const POLL_MS = 5000;
    const HARD_STOP = 55000;
    const start = Date.now();
    let status = "RUNNING";
    let datasetId = null;

    while (Date.now() - start < HARD_STOP) {
      await sleep(POLL_MS);
      const pollRes = await fetch(`https://api.apify.com/v2/actor-runs/${runId}?token=${APIFY_TOKEN}`);
      if (!pollRes.ok) break;
      const pollData = await pollRes.json();
      status = pollData?.data?.status;
      datasetId = pollData?.data?.defaultDatasetId;
      console.log("[ig-posts] poll status:", status);
      if (status === "SUCCEEDED" || status === "FAILED" || status === "ABORTED") break;
    }

    // Still running — return pending so client can poll itself
    if (status === "RUNNING" || status === "READY") {
      return res.status(202).json({
        pending: true, runId, datasetId,
        message: "Actor still running — poll /api/scrape-instagram-posts-poll",
      });
    }
    if (status !== "SUCCEEDED") {
      return res.status(502).json({ error: `Actor ended with status: ${status}` });
    }
    if (!datasetId) return res.status(502).json({ error: "No dataset ID for completed run" });

    // 3. Fetch dataset
    const items = await fetchDataset(datasetId, APIFY_TOKEN);
    console.log(`[ig-posts] ${Array.isArray(items) ? items.length : "?"} items`);
    if (Array.isArray(items) && items.length > 0) {
      console.log("[ig-posts] sample keys:", Object.keys(items[0]).join(", "));
    }
    return res.status(200).json({ posts: normalizeItems(items), runId });
  } catch (err) {
    console.error("[ig-posts] error:", err);
    return res.status(500).json({ error: err.message || "Internal server error" });
  }
}

export async function fetchDataset(datasetId, token) {
  const r = await fetch(`https://api.apify.com/v2/datasets/${datasetId}/items?token=${token}&limit=100`);
  if (!r.ok) throw new Error("Failed to fetch Apify dataset");
  return r.json();
}

// Normalize fields from apify/instagram-post-scraper output shape
function normalizeItems(items) {
  return (Array.isArray(items) ? items : []).map((item) => ({
    id:             item.id ?? item.shortCode ?? Math.random().toString(36).slice(2),
    shortCode:      item.shortCode ?? item.id ?? null,
    type:           item.type ?? "Image",
    url:            item.url ?? (item.shortCode ? `https://www.instagram.com/p/${item.shortCode}/` : null),
    // instagram-post-scraper uses `images[0]` or `displayUrl` for the thumbnail
    displayUrl:     item.displayUrl
                 ?? item.thumbnailSrc
                 ?? item.thumbnailUrl
                 ?? item.imageUrl
                 ?? (Array.isArray(item.images) && item.images[0]?.url)
                 ?? (Array.isArray(item.images) && item.images[0])
                 ?? null,
    caption:        item.caption ?? item.alt ?? null,
    likesCount:     item.likesCount ?? item.likes ?? null,
    commentsCount:  item.commentsCount ?? item.commentsNumber ?? item.comments ?? null,
    timestamp:      item.timestamp ?? item.taken_at_timestamp ?? null,
    ownerUsername:  item.ownerUsername ?? item.author?.username ?? item.owner?.username ?? null,
    ownerFullName:  item.ownerFullName ?? item.author?.name ?? item.owner?.full_name ?? null,
    locationName:   item.locationName ?? item.location?.name ?? null,
    hashtags:       item.hashtags ?? [],
    mentions:       item.mentions ?? item.taggedUsers ?? [],
    videoUrl:       item.videoUrl ?? null,
    isVideo:        item.isVideo ?? item.type === "Video" ?? false,
    videoViewCount: item.videoViewCount ?? item.videoViews ?? null,
    images:         item.images ?? [],
  }));
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
