// api/scrape-facebook.js — Vercel Serverless Function
// Runs the Apify Facebook Pages Scraper (4Hv5RhChiaDk6iwad) server-side.
// Accepts a POST body: { identifier: "username | page-slug | facebook.com/..." }
// Returns normalised Facebook page/profile data.

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const APIFY_TOKEN =
    process.env.VITE_APIFY_API_TOKEN || process.env.APIFY_API_TOKEN;
  if (!APIFY_TOKEN) {
    return res
      .status(500)
      .json({ error: "Apify API token not configured on server." });
  }

  const { identifier } = req.body || {};
  if (!identifier || !identifier.trim()) {
    return res.status(400).json({ error: "identifier is required" });
  }

  // Build a canonical Facebook URL from whatever the user supplied
  function toFacebookUrl(raw) {
    const s = raw.trim();
    if (/^https?:\/\//i.test(s)) return s;
    // Strip leading "facebook.com/" variants so we always build a clean URL
    const slug = s
      .replace(/^(?:www\.)?facebook\.com\//i, "")
      .replace(/^@/, "")
      .split(/[?#]/)[0]
      .trim();
    return `https://www.facebook.com/${slug}`;
  }

  const facebookUrl = toFacebookUrl(identifier);

  function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
  }

  // Run an Apify actor and return its dataset items
  async function runActor(actorId, input, maxPolls = 18) {
    const startRes = await fetch(
      `https://api.apify.com/v2/acts/${actorId}/runs?token=${APIFY_TOKEN}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      }
    );
    if (!startRes.ok)
      throw new Error(`Actor ${actorId} start failed: ${startRes.status}`);
    const startData = await startRes.json();
    const runId = startData?.data?.id;
    const datasetId = startData?.data?.defaultDatasetId;
    if (!runId) throw new Error(`No run ID from actor ${actorId}`);

    let status = "RUNNING";
    let finalDatasetId = datasetId;
    for (let i = 0; i < maxPolls; i++) {
      await sleep(5000);
      const pollRes = await fetch(
        `https://api.apify.com/v2/actor-runs/${runId}?token=${APIFY_TOKEN}`
      );
      if (!pollRes.ok) break;
      const p = await pollRes.json();
      status = p?.data?.status;
      finalDatasetId = p?.data?.defaultDatasetId ?? finalDatasetId;
      if (["SUCCEEDED", "FAILED", "ABORTED"].includes(status)) break;
    }
    if (status !== "SUCCEEDED")
      throw new Error(`Actor ${actorId} ended with: ${status}`);

    const dataRes = await fetch(
      `https://api.apify.com/v2/datasets/${finalDatasetId}/items?token=${APIFY_TOKEN}&limit=5`
    );
    if (!dataRes.ok)
      throw new Error(`Dataset fetch failed for actor ${actorId}`);
    const items = await dataRes.json();
    return Array.isArray(items) ? items : [];
  }

  // Normalise the raw Apify item into a consistent shape
  function normalizePage(raw) {
    const likes =
      raw.likes ??
      raw.likesCount ??
      raw.fans ??
      raw.fanCount ??
      raw.page_fans ??
      null;
    const followers =
      raw.followers ??
      raw.followersCount ??
      raw.pageFollowers ??
      raw.follower_count ??
      null;
    const checkins =
      raw.checkins ?? raw.checkinsCount ?? raw.check_ins ?? null;
    const rating = raw.rating ?? raw.overallStarRating ?? null;
    const reviewCount = raw.reviewCount ?? raw.ratingCount ?? null;

    return {
      title: raw.title ?? raw.name ?? raw.pageName ?? null,
      url: raw.url ?? raw.pageUrl ?? facebookUrl,
      description: raw.description ?? raw.about ?? raw.pageDescription ?? null,
      category: raw.categories?.[0] ?? raw.category ?? raw.pageCategory ?? null,
      likes: likes != null ? Number(likes).toLocaleString() : null,
      followers: followers != null ? Number(followers).toLocaleString() : null,
      checkins: checkins != null ? Number(checkins).toLocaleString() : null,
      rating: rating != null ? String(rating) : null,
      reviewCount: reviewCount != null ? String(reviewCount) : null,
      phone: raw.phone ?? raw.phones?.[0] ?? null,
      email: raw.email ?? raw.emails?.[0] ?? null,
      website: raw.website ?? raw.websites?.[0] ?? null,
      address: raw.address ?? raw.street ?? null,
      city: raw.city ?? null,
      country: raw.country ?? null,
      postalCode: raw.postalCode ?? raw.zip ?? null,
      isVerified: raw.isVerified ?? raw.verified ?? false,
      priceRange: raw.priceRange ?? null,
      pageId: raw.pageId ?? raw.id ?? null,
      profilePic: raw.profilePicUrl ?? raw.profilePhoto ?? null,
      coverPhoto: raw.coverPhotoUrl ?? raw.coverPhoto ?? null,
    };
  }

  try {
    const items = await runActor(
      "4Hv5RhChiaDk6iwad", // Apify Facebook Pages Scraper
      {
        startUrls: [{ url: facebookUrl }],
        maxRequestsPerCrawl: 1,
      },
      20 // up to 100s polling
    );

    if (!items.length) {
      return res.status(200).json({
        status: "not_found",
        message: "No data returned from Apify for this Facebook page.",
        url: facebookUrl,
      });
    }

    const page = normalizePage(items[0]);
    return res.status(200).json({ status: "found", page });
  } catch (err) {
    console.error("scrape-facebook error:", err);
    return res.status(500).json({ error: err.message || "Internal server error" });
  }
}
