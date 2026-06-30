import { supabase } from "./supabase";

// Page size used ONLY for internal pagination while fetching — NOT a cap on
// how many investigations are returned. See fetchRecentInvestigations below.
const FETCH_PAGE_SIZE = 1000;
const TABLE = "investigations";

function jsonClean(value) {
  try {
    return JSON.parse(
      JSON.stringify(value, (_key, val) => {
        if (val === undefined) return null;
        if (typeof val === "function") return null;
        if (typeof val === "symbol") return null;
        if (typeof val === "bigint") return Number(val);
        if (!isFinite(val) && typeof val === "number") return 0;
        return val;
      })
    );
  } catch {
    return {};
  }
}

function rowToInvestigation(row) {
  if (!row) return null;
  return {
    ...(row.data || {}),
    id: row.case_id,
    target: row.target,
    type: row.type,
    status: row.status,
    risk: row.risk,
    platforms: row.platforms || [],
    ownerId: row.user_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// =============================
// SAVE
// =============================

export async function saveInvestigation(user, investigation) {
  if (!user?.uid) throw new Error("Sign in before saving.");
  if (!investigation?.id) throw new Error("Investigation has no ID.");

  const clean = jsonClean(investigation);

  const row = {
    case_id: clean.id,
    user_id: user.uid,
    target: String(clean.target ?? "").slice(0, 2048),
    type: String(clean.type ?? "keyword"),
    status: String(clean.status ?? "Completed"),
    risk: String(clean.risk ?? "unknown"),
    platforms: Array.isArray(clean.platforms) ? clean.platforms : [],
    data: clean, // full investigation object as JSONB — no nested-array issues here
    updated_at: new Date().toISOString(),
  };

  console.log("[CyIntel] Saving investigation to Supabase...", row.case_id);

  const { error } = await supabase
    .from(TABLE)
    .upsert(row, { onConflict: "user_id,case_id" });

  if (error) {
    console.error("[CyIntel] Supabase save FAILED:", error);
    throw new Error(error.message || "Supabase save failed.");
  }

  console.log("[CyIntel] Supabase save SUCCESS");
  return investigation.id;
}

// =============================
// READ ONE
// =============================

export async function getInvestigation(user, caseId) {
  if (!user?.uid) throw new Error("Sign in before reading.");

  const { data, error } = await supabase
    .from(TABLE)
    .select("*")
    .eq("user_id", user.uid)
    .eq("case_id", caseId)
    .maybeSingle();

  if (error) {
    console.error("[CyIntel] Supabase read FAILED:", error);
    throw new Error(error.message || "Supabase read failed.");
  }
  return rowToInvestigation(data);
}

// =============================
// LIVE SUBSCRIPTION (Supabase Realtime replaces Firestore onSnapshot)
// =============================

function rowsToInvestigations(rows) {
  return (rows || []).map((row) => {
    const full = rowToInvestigation(row);
    return {
      ...full,
      id: row.case_id,
      createdAtMs: row.created_at ? new Date(row.created_at).getTime() : Date.now(),
      fullInvestigation: full,
    };
  });
}

export async function fetchRecentInvestigations(user) {
  if (!user?.uid) return [];

  // Fetch EVERY investigation the user owns, paged through until nothing is
  // left. Previously this used `.limit(25)`, which silently dropped any case
  // beyond the most recent 25 — so the dashboard's "Total Investigations /
  // Suspects Identified / High Risk Cases / Platforms Scanned" stat cards
  // (all derived from this same array) could never go past 25, and as each
  // new case was saved, the oldest one fell out of the returned set and
  // disappeared from the table. Paging through all rows here means nothing
  // is ever hidden or erased — the full stored collection is always
  // returned, however large it grows.
  //
  // We advance `from` by however many rows actually came back (not by the
  // page size we requested) and stop using the exact row count Supabase
  // reports, so this stays correct even if the server enforces its own
  // smaller per-request row cap than FETCH_PAGE_SIZE.
  let all = [];
  let from = 0;
  let total = null;

  while (true) {
    const { data, error, count } = await supabase
      .from(TABLE)
      .select("*", { count: "exact" })
      .eq("user_id", user.uid)
      .order("created_at", { ascending: false })
      .range(from, from + FETCH_PAGE_SIZE - 1);

    if (error) {
      console.error("[CyIntel] Supabase fetch FAILED:", error);
      throw new Error(error.message || "Supabase fetch failed.");
    }

    if (total === null && typeof count === "number") total = count;
    all = all.concat(data || []);

    if (!data || data.length === 0) break;              // no more rows left
    from += data.length;                                 // advance by what actually came back
    if (total !== null && all.length >= total) break;     // collected everything
  }

  return rowsToInvestigations(all);
}

export function subscribeRecentInvestigations(user, onNext, onError) {
  if (!user?.uid) { onNext([]); return () => {}; }

  let cancelled = false;

  async function fetchAll() {
    try {
      const items = await fetchRecentInvestigations(user);
      if (cancelled) return;
      onNext(items);
    } catch (error) {
      if (cancelled) return;
      onError?.(error);
    }
  }

  fetchAll();

  // Live updates: re-fetch whenever a row for this user changes.
  const channel = supabase
    .channel(`investigations-${user.uid}`)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: TABLE, filter: `user_id=eq.${user.uid}` },
      () => fetchAll()
    )
    .subscribe();

  return () => {
    cancelled = true;
    supabase.removeChannel(channel);
  };
}

// =============================
// UPDATE
// =============================

export async function updateInvestigation(user, caseId, fields = {}) {
  if (!user?.uid) throw new Error("Sign in before updating.");

  const patch = { updated_at: new Date().toISOString() };
  if (fields.status) patch.status = fields.status;
  if (fields.risk) patch.risk = fields.risk;
  // Keep the indexed columns (target/type/platforms) in sync too — rowToInvestigation
  // reads these explicit columns and lets them win over whatever is inside `data`,
  // so without this, editing target/type/platforms via the case inventory would
  // silently fail to persist across reloads even though `data` was updated.
  if (fields.target !== undefined) patch.target = String(fields.target ?? "").slice(0, 2048);
  if (fields.type !== undefined) patch.type = String(fields.type ?? "keyword");
  if (Array.isArray(fields.platforms)) patch.platforms = fields.platforms;
  if (fields.data) patch.data = jsonClean(fields.data);

  const { error } = await supabase
    .from(TABLE)
    .update(patch)
    .eq("user_id", user.uid)
    .eq("case_id", caseId);

  if (error) throw new Error(error.message || "Supabase update failed.");
  return caseId;
}

// =============================
// DELETE
// =============================

export async function deleteInvestigation(user, caseId) {
  if (!user?.uid) throw new Error("Sign in before deleting.");

  const { error } = await supabase
    .from(TABLE)
    .delete()
    .eq("user_id", user.uid)
    .eq("case_id", caseId);

  if (error) throw new Error(error.message || "Supabase delete failed.");
  return caseId;
}

// =============================
// ACCESS CONTROL  (SOCMINT core feature #1 — authorised access)
// Grant/revoke viewer or editor access to a case by email. Relies on the
// `case_access` table + RLS policies defined in Supabase/schema.sql.
// =============================

const ACCESS_TABLE = "case_access";

export async function grantCaseAccess(user, caseId, granteeEmail, role = "viewer") {
  if (!user?.uid) throw new Error("Sign in before sharing a case.");
  const email = String(granteeEmail || "").trim().toLowerCase();
  if (!email || !email.includes("@")) throw new Error("Enter a valid email address.");
  if (email === (user.email || "").toLowerCase()) throw new Error("You already own this case.");
  if (!["viewer", "editor"].includes(role)) throw new Error("Role must be viewer or editor.");

  const { error } = await supabase
    .from(ACCESS_TABLE)
    .upsert(
      { case_id: caseId, owner_id: user.uid, grantee_email: email, role },
      { onConflict: "case_id,grantee_email" }
    );

  if (error) throw new Error(error.message || "Failed to grant access.");
  return true;
}

export async function listCaseAccess(user, caseId) {
  if (!user?.uid) return [];
  const { data, error } = await supabase
    .from(ACCESS_TABLE)
    .select("*")
    .eq("case_id", caseId)
    .eq("owner_id", user.uid)
    .order("created_at", { ascending: true });

  if (error) throw new Error(error.message || "Failed to load access list.");
  return data || [];
}

export async function revokeCaseAccess(user, grantId) {
  if (!user?.uid) throw new Error("Sign in before revoking access.");
  const { error } = await supabase.from(ACCESS_TABLE).delete().eq("id", grantId).eq("owner_id", user.uid);
  if (error) throw new Error(error.message || "Failed to revoke access.");
  return true;
}

// Cases shared TO the current user by other investigators (accepted only).
export async function fetchSharedWithMe(user) {
  if (!user?.uid || !user?.email) return [];
  const { data: grants, error: grantErr } = await supabase
    .from(ACCESS_TABLE)
    .select("*")
    .ilike("grantee_email", user.email)
    .eq("status", "accepted");
  if (grantErr) throw new Error(grantErr.message || "Failed to load shared access.");
  if (!grants?.length) return [];

  const caseIds = grants.map((g) => g.case_id);
  const { data: rows, error } = await supabase.from(TABLE).select("*").in("case_id", caseIds);
  if (error) throw new Error(error.message || "Failed to load shared cases.");

  const roleByCase = Object.fromEntries(grants.map((g) => [g.case_id, g.role]));
  return rowsToInvestigations(rows).map((inv) => ({
    ...inv,
    shared: true,
    sharedRole: roleByCase[inv.id] || "viewer",
    ownerId: inv.ownerId,
  }));
}

// Invites sent to the current user that they haven't accepted yet. We
// deliberately do NOT join the investigations table here (RLS hides the
// underlying case data until accepted) — only the invite metadata + the
// target/owner info needed to decide whether to accept, pulled separately.
export async function fetchPendingInvites(user) {
  if (!user?.uid || !user?.email) return [];
  const { data, error } = await supabase
    .from(ACCESS_TABLE)
    .select("*")
    .ilike("grantee_email", user.email)
    .eq("status", "pending")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message || "Failed to load pending invites.");
  return data || [];
}

export async function acceptCaseInvite(user, grantId) {
  if (!user?.uid) throw new Error("Sign in before accepting an invite.");
  const { error } = await supabase
    .from(ACCESS_TABLE)
    .update({ status: "accepted", accepted_at: new Date().toISOString() })
    .eq("id", grantId)
    .ilike("grantee_email", user.email);
  if (error) throw new Error(error.message || "Failed to accept invite.");
  return true;
}

export async function declineCaseInvite(user, grantId) {
  if (!user?.uid) throw new Error("Sign in before declining an invite.");
  const { error } = await supabase.from(ACCESS_TABLE).delete().eq("id", grantId).ilike("grantee_email", user.email);
  if (error) throw new Error(error.message || "Failed to decline invite.");
  return true;
}

// =============================
// SOCMINT GRAPH ENGINE (unchanged — pure functions, no DB calls)
// =============================

export function buildEntityGraph(investigation) {
  const nodes = new Map();
  const edges = [];

  const addNode = (id, type, data) => {
    if (!nodes.has(id)) nodes.set(id, { id, type, ...data });
  };
  const connect = (a, b, type) => edges.push({ from: a, to: b, type });

  for (const f of investigation.findings || []) {
    if (f?.value) {
      addNode(f.value, "entity", f);
      addNode(investigation.id, "case", {});
      connect(investigation.id, f.value, "found");
    }
  }
  for (const p of investigation.crawledPages || []) {
    if (p?.url) {
      addNode(p.url, "source", p);
      connect(investigation.id, p.url, "crawled");
    }
  }
  return { nodes: [...nodes.values()], edges };
}

export function buildTimeline(investigation) {
  const events = [];
  for (const log of investigation.logs || []) {
    events.push({ time: log.time || Date.now(), type: log.type || "log", message: log.message || "event" });
  }
  for (const p of investigation.crawledPages || []) {
    events.push({ time: p.time || Date.now(), type: "crawl", message: p.url || "page" });
  }
  return events.sort((a, b) => new Date(a.time) - new Date(b.time));
}

export function correlateEntities(investigation) {
  const freq = {};
  for (const f of investigation.findings || []) {
    const k = f?.value;
    if (!k) continue;
    freq[k] = (freq[k] || 0) + 1;
  }
  const ranked = Object.entries(freq).sort((a, b) => b[1] - a[1]).map(([entity, score]) => ({ entity, score }));
  return { clusters: ranked.slice(0, 20), confidence: ranked.length > 0 ? Math.min(100, ranked[0][1] * 10) : 0 };
}

// =============================
// CONTENT & KEYWORD / TONE ANALYSIS  (SOCMINT core feature #5)
// Pure function — works off the snippets/bios already collected per
// platform finding. No extra network calls, no extra DB writes.
// =============================

const STOPWORDS = new Set("the a an is are was were be been being and or but if then so to of in on at for with from by as it its this that these those he she they we you your his her their our not no do does did have has had can could will would should may might i me my mine us them about into over under more most other some such only own same than too very just".split(" "));

const POSITIVE_WORDS = new Set(["great","good","love","amazing","best","awesome","happy","excited","thank","thanks","grateful","wonderful","fantastic","win","success","proud","beautiful","nice","enjoy","glad"]);
const NEGATIVE_WORDS = new Set(["hate","worst","bad","angry","scam","fraud","fake","stupid","idiot","kill","threat","attack","fight","abuse","disgusting","terrible","awful","sad","fear","warning","illegal","steal","threaten"]);
const PROMOTIONAL_WORDS = new Set(["buy","sale","discount","offer","deal","subscribe","follow","link","bio","dm","promo","free","limited","shop","order","price"]);

// ── Tool/process status messages that the OSINT modules generate while
// scanning (e.g. WhatsMyName site-by-site checks, "lookup failed",
// "could not be confirmed", generic search-result placeholders). These are
// app-generated log text, NOT actual post/profile content, so they must be
// excluded from keyword/hashtag/tone/cross-posting analysis or they flood
// the stats with words like "public", "url", "candidate", "detected",
// the tool name, etc. instead of real scraped text. ──
const STATUS_MESSAGE_PATTERNS = [
  /whatsmyname detected a public url candidate/i,
  /public search results for/i,
  /discovered by public web search/i,
  /lookup (failed|did not confirm)/i,
  /crawler failed/i,
  /scrape failed/i,
  /scan failed/i,
  /no public .* could be confirmed/i,
  /could not be confirmed/i,
  /account not found or invalid username/i,
  /no reviews returned/i,
  /scanned \d+ review/i,
  /crawled \d+ page/i,
  /profile exists at instagram\.com.* requires apify token/i,
  /open the link to (verify|check) manually/i,
];

const isStatusMessage = (snippet) =>
  STATUS_MESSAGE_PATTERNS.some((re) => re.test(snippet || ""));

// ── Defensive field extraction for Instagram post objects — different Apify
// actors use different key names for the same data. Try every known variant
// so a post's caption/image/url/code is never silently dropped just because
// one actor calls a field something else. Shared by keyword analysis and
// the Top Posts panel below. ──
const pickCaption = (p) => {
  if (typeof p.caption === "string") return p.caption;
  if (typeof p.caption?.text === "string") return p.caption.text;
  if (typeof p.text === "string") return p.text;
  if (typeof p.edge_media_to_caption?.edges?.[0]?.node?.text === "string")
    return p.edge_media_to_caption.edges[0].node.text;
  if (typeof p.alt === "string") return p.alt;
  return "";
};
const pickImage = (p) =>
  p.displayUrl || p.display_url || p.thumbnailSrc || p.thumbnail_src ||
  p.thumbnailUrl || p.imageUrl || p.image || p.photo || p.media_url || p.mediaUrl ||
  (Array.isArray(p.images) && (typeof p.images[0] === "string" ? p.images[0] : p.images[0]?.url)) ||
  null;
const pickShortCode = (p) => p.shortCode ?? p.shortcode ?? p.code ?? null;
const pickUrl = (p) => {
  const sc = pickShortCode(p);
  return p.url ?? p.postUrl ?? p.link ?? (sc ? `https://www.instagram.com/p/${sc}/` : null);
};

export function analyzeContent(investigation) {
  const baseFindings = (investigation?.findings || [])
    .filter(f => f?.snippet)
    .filter(f => !isStatusMessage(f.snippet));

  // ── Fold in scraped Instagram post captions/hashtags (already collected by the
  // existing IG posts scraper — no extra network calls here) so keyword/hashtag/
  // tone/cross-posting analysis reflects real post content, not just bio snippets. ──
  const igPosts = Array.isArray(investigation?.instaPosts) ? investigation.instaPosts : [];

  // Older saved cases (or cases where instaPosts failed to persist for any
  // reason) may still have the post content sitting in crawledPages from the
  // IG Posts scraper. Reconstruct minimal post-like objects from those so
  // the Top Posts panel still has something to show instead of going blank.
  const crawledIgPages = (Array.isArray(investigation?.crawledPages) ? investigation.crawledPages : [])
    .filter(pg => pg?.extractor === "Instagram Posts Scraper" && pg?.snippet);
  const igPostsFromCrawled = igPosts.length === 0
    ? crawledIgPages.map((pg, i) => ({
        id: pg.url || `crawled-ig-${i}`,
        url: pg.url,
        caption: pg.snippet,
      }))
    : [];
  const allIgPosts = igPosts.length > 0 ? igPosts : igPostsFromCrawled;
  const igFindings = allIgPosts
    .map(p => {
      const snippet = [pickCaption(p), (p.hashtags || []).map(h => "#" + h).join(" ")].filter(Boolean).join(" ").trim();
      if (!snippet) return null;
      return { platform: "instagram", source: "instagram", snippet, value: pickShortCode(p) || p.id };
    })
    .filter(Boolean);

  const findings = [...baseFindings, ...igFindings];

  // ── Pull the actual bio/description text out of each card, not the whole
  // mixed snippet string. ──
  // Every platform card's snippet is a "Label: value · Label: value · …"
  // line built for display (Followers: 98 · Posts: 2 · Link: https://… ·
  // 🌐 Public), with the real free-text bio buried inside it (or, for most
  // platforms, sitting separately on the card's metadata as `bio` /
  // `description` / `headline`). Tokenizing the whole snippet is exactly why
  // keyword analysis was full of "https", site names, "followers", url
  // fragments, and the searched username — none of that is bio content.
  // Prefer the dedicated bio-like metadata field every scraper already
  // exposes (Instagram/Twitter/Reddit/GitHub: bio, Telegram: description,
  // LinkedIn: headline); only fall back to picking apart the snippet when a
  // card has no such field (e.g. Facebook, TikTok).
  const NOT_PUBLIC_VALUES = new Set(["not public", "not listed", "not listed publicly", "not listed in bio", ""]);
  const STRUCTURED_LABEL = /^(full name|followers|following|posts|verified|private|public|link|bio|location|category|about|likes|check-?ins?|rating|phone|website|email|headline|current|total karma|joined|reddit gold|email verified|active in|total score|address)\s*:/i;
  const extractContentText = (f) => {
    const meta = f.metadata || {};
    const bioLike = meta.bio || meta.description || meta.headline || meta.about;
    if (bioLike && !NOT_PUBLIC_VALUES.has(String(bioLike).trim().toLowerCase())) {
      return String(bioLike);
    }
    // Fallback — strip out the structured "Label: value" segments and emoji
    // status markers from the snippet, keep only genuine free-text parts.
    return (f.snippet || "")
      .split("·")
      .map(s => s.trim())
      .filter(s => s && !STRUCTURED_LABEL.test(s) && !/^[✓🔒🌐]/.test(s))
      .join(" ");
  };

  // ── Strip URLs before tokenizing ──
  // Snippets legitimately contain full URLs (profile links, "Link: " bio
  // fields, WhatsMyName check URLs baked into other text, etc). A bare word
  // regex happily tokenizes pieces of those URLs ("https", "com", path
  // segments, tracking-param fragments) as if they were real content
  // keywords — which is why "https", site names, and URL fragments were
  // outranking actual bio/caption words. Remove URLs first so only prose
  // content feeds the keyword/hashtag/tone analysis below.
  const stripUrls = (s) => (s || "").replace(/https?:\/\/\S+/gi, " ");
  const text = findings.map(f => stripUrls(extractContentText(f))).join(" \n ");

  // ── The searched value itself (username/handle/email/etc, and any of its
  // dot/underscore-separated parts) isn't "content" — it's the search query
  // repeated back across every platform-confirmation snippet ("Profile
  // exists at instagram.com/spotify.piux", "x.com/spotify.piux", …), so it
  // would otherwise dominate the keyword chart instead of real bio text. ──
  const targetValue = String(investigation?.target || "").toLowerCase();
  const targetParts = new Set(
    targetValue.split(/[^a-z0-9]+/i).filter(p => p.length >= 3)
  );

  // ── Keyword frequency (excluding stopwords, the search target itself, and
  // generic URL-leftover tokens, 3+ chars) ──
  const URL_NOISE_WORDS = new Set(["www","http","https","com","org","net","html","php","html5","utm","ref","src"]);
  const words = (text.toLowerCase().match(/[a-z][a-z0-9'_-]{2,}/g) || [])
    .filter(w => !STOPWORDS.has(w))
    .filter(w => !URL_NOISE_WORDS.has(w))
    .filter(w => !targetParts.has(w));
  const wordFreq = {};
  for (const w of words) wordFreq[w] = (wordFreq[w] || 0) + 1;
  const keywords = Object.entries(wordFreq).sort((a, b) => b[1] - a[1]).slice(0, 20)
    .map(([word, count]) => ({ word, count }));

  // ── Hashtags & mentions ──
  const hashtags = [...text.matchAll(/#[a-zA-Z0-9_]{2,}/g)].map(m => m[0].toLowerCase());
  const hashtagFreq = {};
  for (const h of hashtags) hashtagFreq[h] = (hashtagFreq[h] || 0) + 1;
  const topHashtags = Object.entries(hashtagFreq).sort((a, b) => b[1] - a[1]).slice(0, 15)
    .map(([tag, count]) => ({ tag, count }));

  // ── Tone / sentiment heuristic per finding (based on actual bio/content text) ──
  const toneByPlatform = findings.map(f => {
    const lower = stripUrls(extractContentText(f)).toLowerCase();
    const tokens = lower.match(/[a-z]+/g) || [];
    let pos = 0, neg = 0, promo = 0;
    for (const tk of tokens) {
      if (POSITIVE_WORDS.has(tk)) pos++;
      if (NEGATIVE_WORDS.has(tk)) neg++;
      if (PROMOTIONAL_WORDS.has(tk)) promo++;
    }
    let tone = "neutral";
    if (promo >= 2 && promo >= pos && promo >= neg) tone = "promotional";
    else if (neg > pos && neg > 0) tone = "aggressive";
    else if (pos > neg && pos > 0) tone = "positive";
    return { platform: f.platform || f.source || "unknown", tone, pos, neg, promo };
  });

  const toneCounts = toneByPlatform.reduce((acc, t) => { acc[t.tone] = (acc[t.tone] || 0) + 1; return acc; }, {});
  const dominantTone = Object.entries(toneCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || "neutral";

  // ── Cross-posting / content repetition detection ──
  // Flags findings whose snippets are near-duplicates (shared 8+ word shingle)
  // of another platform's snippet — a signal of reposted/cross-posted content.
  const shingles = (s) => {
    const w = s.toLowerCase().match(/[a-z0-9]+/g) || [];
    const out = new Set();
    for (let i = 0; i + 8 <= w.length; i++) out.add(w.slice(i, i + 8).join(" "));
    return out;
  };
  const repeats = [];
  for (let i = 0; i < findings.length; i++) {
    for (let j = i + 1; j < findings.length; j++) {
      const a = shingles(findings[i].snippet), b = shingles(findings[j].snippet);
      if (a.size === 0 || b.size === 0) continue;
      let shared = 0;
      for (const s of a) if (b.has(s)) shared++;
      if (shared > 0) {
        repeats.push({
          from: findings[i].platform || findings[i].source || "unknown",
          to: findings[j].platform || findings[j].source || "unknown",
          sharedShingles: shared,
        });
      }
    }
  }

  // ── Top 3 Instagram posts (photo, caption, date, likes, comments) for the
  // Content & Keyword Analysis page — purely a view of already-scraped data. ──
  const topPosts = allIgPosts.slice(0, 3).map((p, i) => ({
    id:        p.id ?? pickShortCode(p) ?? `post-${i}`,
    image:     pickImage(p),
    caption:   pickCaption(p),
    url:       pickUrl(p),
    likes:     p.likesCount ?? p.likes ?? p.like_count ?? null,
    comments:  p.commentsCount ?? p.commentsNumber ?? p.comments ?? p.comment_count ?? null,
    timestamp: p.timestamp ?? p.takenAt ?? p.taken_at_timestamp ?? p.takenAtTimestamp ?? null,
  }));

  return {
    keywords,
    hashtags: topHashtags,
    toneByPlatform,
    toneCounts,
    dominantTone,
    repeats,
    totalSnippets: findings.length,
    topPosts,
  };
}

export async function runSafeCrawler(seedUrls = []) {
  return seedUrls.map((url) => ({ url, status: "queued", note: "public-source crawl simulation only" }));
}

export async function generatePdfReport(investigation) {
  const graph = buildEntityGraph(investigation);
  const timeline = buildTimeline(investigation);
  const correlation = correlateEntities(investigation);
  return {
    title: `Investigation Report - ${investigation.id}`,
    summary: investigation.gemini?.summary || "No AI summary",
    graph,
    timeline,
    correlation,
    generatedAt: new Date().toISOString(),
  };
}
