// api/scrape-twitter.js — Vercel Serverless Function
// Calls Apify Twitter/X Followers actor server-side (API token never exposed to client)
// Actor: AaT0BcKU5GQh97wdt (Twitter Followers Scraper)
//
// Response shape: { target: {...profile}, followers: [...] }
// - target: the scraped account's own profile metadata
// - followers: list of follower accounts

export default async function handler(req, res) {
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
      `https://api.apify.com/v2/datasets/${datasetId}/items?token=${APIFY_TOKEN}&limit=501`
    );
    if (!dataRes.ok) {
      return res.status(502).json({ error: "Failed to fetch dataset from Apify" });
    }

    const items = await dataRes.json();
    const rawItems = Array.isArray(items) ? items : [];

    // 4. Separate target metadata from follower items.
    //
    // When includeTargetMetadata=true the actor injects one item per target
    // that describes the searched account itself. It is identified by:
    //   - item.type === "target"  (most reliable)
    //   - OR item.targetUser / item.isTarget being present
    //   - OR item.userName matching the searched handle (case-insensitive)
    //     AND the item has no `relation` field (followers have relation:"followers")
    //
    // Everything else is a follower record.

    let targetRaw = rawItems.find(
      (it) =>
        it.type === "target" ||
        it.isTarget === true ||
        it.targetUser != null ||
        (
          (it.userName ?? it.username ?? "").toLowerCase() === cleanUsername.toLowerCase() &&
          it.relation == null
        )
    );

    // Fallback: if still not found, try the item whose username matches regardless
    if (!targetRaw) {
      targetRaw = rawItems.find(
        (it) =>
          (it.userName ?? it.username ?? "").toLowerCase() === cleanUsername.toLowerCase()
      );
    }

    // Helper: parse follower/following counts that may come as "63.7M", "1,234", or numbers
    function parseCount(val) {
      if (val == null) return null;
      if (typeof val === "number") return val;
      const s = String(val).replace(/,/g, "").trim();
      if (/^\d+$/.test(s)) return parseInt(s, 10);
      const m = s.match(/^([\d.]+)\s*([KMBkmb]?)$/);
      if (!m) return null;
      const n = parseFloat(m[1]);
      const suffix = m[2].toUpperCase();
      if (suffix === "K") return Math.round(n * 1_000);
      if (suffix === "M") return Math.round(n * 1_000_000);
      if (suffix === "B") return Math.round(n * 1_000_000_000);
      return Math.round(n);
    }

    // Normalize a raw Apify user item into a consistent shape
    function normalizeUser(item) {
      return {
        id:               item.id            ?? item.userId       ?? item.rest_id    ?? Math.random().toString(36).slice(2),
        username:         item.userName      ?? item.username     ?? item.screen_name ?? "",
        display_name:     item.displayName   ?? item.name         ?? item.full_name   ?? "",
        is_verified:      item.isVerified    ?? item.verified     ?? false,
        is_blue_verified: item.isBlueVerified ?? false,
        profile_pic_url:  item.profilePicUrl ?? item.profileImageUrl ?? item.profile_image_url ?? null,
        follower_count:   parseCount(item.followersCount ?? item.followers_count ?? item.followersNum ?? null),
        following_count:  parseCount(item.friendsCount   ?? item.friends_count   ?? item.followingNum ?? null),
        tweet_count:      parseCount(item.statusesCount  ?? item.statuses_count  ?? item.tweetsCount  ?? null),
        description:      item.description  ?? item.bio    ?? item.rawDescription ?? "",
        location:         item.location     ?? "",
        created_at:       item.createdAt    ?? item.created_at   ?? null,
        url:              item.url          ?? item.externalUrl  ?? null,
      };
    }

    const target = targetRaw ? normalizeUser(targetRaw) : null;

    // Followers = everything that isn't the target item
    const followerItems = targetRaw
      ? rawItems.filter((it) => it !== targetRaw)
      : rawItems;

    const followers = followerItems.map(normalizeUser);

    return res.status(200).json({ target, followers });
  } catch (err) {
    console.error("scrape-twitter error:", err);
    return res.status(500).json({ error: err.message || "Internal server error" });
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
