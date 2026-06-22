// api/scrape-twitter.js — Vercel Serverless Function
// Runs two Apify actors in PARALLEL:
//   1. Twitter User Scraper (61RPP7dywgiy0JPD0) — gets the target profile
//   2. Twitter Followers Scraper (AaT0BcKU5GQh97wdt) — gets followers list
// Response: { target: {...profile}, followers: [...] }

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const APIFY_TOKEN = process.env.VITE_APIFY_API_TOKEN || process.env.APIFY_API_TOKEN;
  if (!APIFY_TOKEN) {
    return res.status(500).json({ error: "Apify API token not configured on server." });
  }

  const { username, limit = 100 } = req.body || {};
  if (!username) return res.status(400).json({ error: "username is required" });

  const cleanUsername = username.replace(/^@/, "").trim();
  if (!/^[a-zA-Z0-9_]{1,50}$/.test(cleanUsername)) {
    return res.status(400).json({ error: "Invalid Twitter username format." });
  }

  // ── helpers ────────────────────────────────────────────────────────────────

  function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

  function parseCount(val) {
    if (val == null) return null;
    if (typeof val === "number") return val;
    const s = String(val).replace(/,/g, "").trim();
    if (/^\d+$/.test(s)) return parseInt(s, 10);
    const m = s.match(/^([\d.]+)\s*([KMBkmb]?)$/);
    if (!m) return null;
    const n = parseFloat(m[1]);
    const sfx = m[2].toUpperCase();
    if (sfx === "K") return Math.round(n * 1_000);
    if (sfx === "M") return Math.round(n * 1_000_000);
    if (sfx === "B") return Math.round(n * 1_000_000_000);
    return Math.round(n);
  }

  function normalizeUser(item) {
    return {
      id:               item.id              ?? item.userId         ?? item.rest_id          ?? Math.random().toString(36).slice(2),
      username:         item.userName        ?? item.username       ?? item.screen_name      ?? "",
      display_name:     item.displayName     ?? item.name           ?? item.full_name        ?? "",
      is_verified:      item.isVerified      ?? item.verified       ?? false,
      is_blue_verified: item.isBlueVerified  ?? item.isBlueVerified ?? false,
      profile_pic_url:  item.profilePicUrl   ?? item.profileImageUrl ?? item.profile_image_url ?? null,
      follower_count:   parseCount(item.followersCount ?? item.followers_count ?? item.followersNum ?? null),
      following_count:  parseCount(item.friendsCount   ?? item.friends_count   ?? item.followingNum ?? null),
      tweet_count:      parseCount(item.statusesCount  ?? item.statuses_count  ?? item.tweetsCount  ?? null),
      description:      item.description    ?? item.bio             ?? item.rawDescription   ?? "",
      location:         item.location       ?? "",
      created_at:       item.createdAt      ?? item.created_at      ?? null,
      website:          item.url            ?? item.externalUrl     ?? null,
    };
  }

  // ── run an Apify actor and return its dataset items ────────────────────────
  async function runActor(actorId, input, maxPolls = 18) {
    const startRes = await fetch(
      `https://api.apify.com/v2/acts/${actorId}/runs?token=${APIFY_TOKEN}`,
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) }
    );
    if (!startRes.ok) throw new Error(`Actor ${actorId} start failed: ${startRes.status}`);
    const startData = await startRes.json();
    const runId = startData?.data?.id;
    if (!runId) throw new Error(`No run ID from actor ${actorId}`);

    let status = "RUNNING", datasetId = null;
    for (let i = 0; i < maxPolls; i++) {
      await sleep(5000);
      const pollRes = await fetch(`https://api.apify.com/v2/actor-runs/${runId}?token=${APIFY_TOKEN}`);
      if (!pollRes.ok) break;
      const p = await pollRes.json();
      status = p?.data?.status;
      datasetId = p?.data?.defaultDatasetId;
      if (["SUCCEEDED","FAILED","ABORTED"].includes(status)) break;
    }
    if (status !== "SUCCEEDED") throw new Error(`Actor ${actorId} ended with: ${status}`);

    const dataRes = await fetch(
      `https://api.apify.com/v2/datasets/${datasetId}/items?token=${APIFY_TOKEN}&limit=501`
    );
    if (!dataRes.ok) throw new Error(`Dataset fetch failed for actor ${actorId}`);
    const items = await dataRes.json();
    return Array.isArray(items) ? items : [];
  }

  // ── fire both actors in parallel ───────────────────────────────────────────
  try {
    const [profileItems, followerItems] = await Promise.allSettled([

      // 1. Twitter User Scraper — returns profile data for a list of handles
      runActor("61RPP7dywgiy0JPD0", {
        usernames: [cleanUsername],
        tweetsDesired: 0,         // we only need profile, not tweets
      }, 12),

      // 2. Twitter Followers Scraper
      runActor("AaT0BcKU5GQh97wdt", {
        twitterHandles: [cleanUsername],
        relation: "followers",
        maxItems: Math.min(Number(limit) || 100, 500),
        outputMode: "compact",
        scrapeAllResults: false,
      }, 18),

    ]);

    // Profile result
    let target = null;
    if (profileItems.status === "fulfilled" && profileItems.value.length > 0) {
      // Find the item matching our username (actor may return multiple if given multiple handles)
      const raw = profileItems.value.find(
        it => (it.userName ?? it.username ?? "").toLowerCase() === cleanUsername.toLowerCase()
      ) ?? profileItems.value[0];
      target = normalizeUser(raw);
    }

    // Followers result
    let followers = [];
    if (followerItems.status === "fulfilled") {
      followers = followerItems.value.map(normalizeUser);
    }

    // If profile actor failed but followers returned data that includes the
    // target (some actor versions embed it), try to extract it
    if (!target && followers.length > 0) {
      const embedded = followers.find(
        it => it.username?.toLowerCase() === cleanUsername.toLowerCase()
      );
      if (embedded) {
        target = embedded;
        followers = followers.filter(it => it !== embedded);
      }
    }

    return res.status(200).json({ target, followers });

  } catch (err) {
    console.error("scrape-twitter error:", err);
    return res.status(500).json({ error: err.message || "Internal server error" });
  }
}
