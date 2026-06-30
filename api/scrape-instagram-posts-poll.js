// api/scrape-instagram-posts-poll.js — Vercel Serverless Function
// Called by the client when the initial request returns { pending: true, runId, datasetId }
// Client polls this every 8 seconds until done or 3-minute wall.

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const APIFY_TOKEN = process.env.VITE_APIFY_API_TOKEN || process.env.APIFY_API_TOKEN;
  if (!APIFY_TOKEN) {
    return res.status(500).json({ error: "Apify API token not configured on server." });
  }

  const { runId, datasetId: hintDatasetId } = req.body || {};
  if (!runId) {
    return res.status(400).json({ error: "runId is required" });
  }

  try {
    const pollRes = await fetch(
      `https://api.apify.com/v2/actor-runs/${runId}?token=${APIFY_TOKEN}`
    );
    if (!pollRes.ok) {
      return res.status(502).json({ error: "Failed to poll Apify run status" });
    }
    const pollData = await pollRes.json();
    const status = pollData?.data?.status;
    const datasetId = pollData?.data?.defaultDatasetId ?? hintDatasetId ?? null;

    // Still running
    if (status === "RUNNING" || status === "READY" || !status) {
      return res.status(202).json({ pending: true, runId, datasetId, status });
    }

    // Terminal non-success states
    if (status !== "SUCCEEDED") {
      return res.status(502).json({ error: `Actor ended with status: ${status}` });
    }

    // Guard: datasetId must be available before fetching
    if (!datasetId) {
      return res.status(502).json({ error: "No dataset ID available for completed run" });
    }

    // Fetch final dataset
    const dataRes = await fetch(
      `https://api.apify.com/v2/datasets/${datasetId}/items?token=${APIFY_TOKEN}&limit=100`
    );
    if (!dataRes.ok) {
      return res.status(502).json({ error: "Failed to fetch dataset from Apify" });
    }
    const items = await dataRes.json();
    return res.status(200).json({ posts: normalizeItems(items), runId });
  } catch (err) {
    console.error("scrape-instagram-posts-poll error:", err);
    return res.status(500).json({ error: err.message || "Internal server error" });
  }
}

function flattenItems(items) {
  const arr = Array.isArray(items) ? items : [];
  const out = [];
  for (const item of arr) {
    const nested = item?.posts ?? item?.latestPosts ?? item?.items;
    if (Array.isArray(nested) && nested.length) {
      for (const p of nested) out.push({ ...p, ownerUsername: p.ownerUsername ?? item.username ?? item.ownerUsername });
    } else {
      out.push(item);
    }
  }
  return out;
}

function normalizeItems(items) {
  return flattenItems(items).map((item) => ({
    id:             item.id ?? item.shortCode ?? Math.random().toString(36).slice(2),
    shortCode:      item.shortCode ?? item.id ?? null,
    type:           item.type ?? "Image",
    url:            item.url ?? (item.shortCode ? `https://www.instagram.com/p/${item.shortCode}/` : null),
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
