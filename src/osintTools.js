const GEMINI_MODEL = import.meta.env.VITE_GEMINI_MODEL || "gemini-2.5-flash";

// Gemini API key resolution: build-time env var → runtime window var → localStorage
const BUILD_TIME_GEMINI_API_KEY =
  import.meta.env.VITE_GEMINI_API_KEY ||
  import.meta.env.VITE_GEMINI_KEY ||
  "";
const RUNTIME_GEMINI_STORAGE_KEY = "ssf.geminiApiKey";

const PUBLIC_SEARCH_ENGINES = [
  { name: "Google",    url: (q) => `https://www.google.com/search?q=${encodeURIComponent(q)}` },
  { name: "Bing",      url: (q) => `https://www.bing.com/search?q=${encodeURIComponent(q)}` },
  { name: "DuckDuckGo",url: (q) => `https://duckduckgo.com/?q=${encodeURIComponent(q)}` },
];

const PLATFORM_TEMPLATES = [
  { id: "github",    name: "GitHub",       abbr: "GH", color: "#24292e", url: (u) => `https://github.com/${u}` },
  { id: "x",         name: "Twitter / X",  abbr: "X",  color: "#111827", url: (u) => `https://x.com/${u}` },
  { id: "instagram", name: "Instagram",    abbr: "IG", color: "#e1306c", url: (u) => `https://www.instagram.com/${u}/` },
  { id: "facebook",  name: "Facebook",     abbr: "FB", color: "#1877f2", url: (u) => `https://www.facebook.com/${u}` },
  { id: "reddit",    name: "Reddit",       abbr: "RD", color: "#ff4500", url: (u) => `https://www.reddit.com/user/${u}/` },
  { id: "telegram",  name: "Telegram",     abbr: "TG", color: "#0088cc", url: (u) => `https://t.me/${u}` },
  { id: "youtube",   name: "YouTube",      abbr: "YT", color: "#ff0000", url: (u) => `https://www.youtube.com/@${u}` },
  { id: "tiktok",    name: "TikTok",       abbr: "TT", color: "#111827", url: (u) => `https://www.tiktok.com/@${u}` },
  { id: "linkedin",  name: "LinkedIn",     abbr: "LI", color: "#0077b5", url: (u) => `https://www.linkedin.com/in/${u}` },
  { id: "medium",    name: "Medium",       abbr: "MD", color: "#111827", url: (u) => `https://medium.com/@${u}` },
  { id: "snapchat",  name: "Snapchat",     abbr: "SC", color: "#fffc00", url: (u) => `https://www.snapchat.com/add/${u}` },
  { id: "pinterest", name: "Pinterest",    abbr: "PN", color: "#bd081c", url: (u) => `https://www.pinterest.com/${u}` },
];

const OPEN_SOURCE_TOOLS = [
  { name: "Jina Reader",        category: "URL/Search",  url: "https://jina.ai/reader/",                               note: "Fetches public pages/search results as clean Markdown — used automatically in this tool." },
  { name: "WhatsMyName",        category: "Username",    url: "https://whatsmyname.app/",                              note: "Checks username presence across 600+ public services." },
  { name: "Sherlock",           category: "Username",    url: "https://github.com/sherlock-project/sherlock",          note: "Open-source username enumeration CLI." },
  { name: "Maigret",            category: "Username",    url: "https://github.com/soxoj/maigret",                      note: "Open-source account discovery and report generator." },
  { name: "Socialscan",         category: "Username",    url: "https://github.com/iojw/socialscan",                    note: "Accurately checks email/username availability across platforms." },
  { name: "holehe",             category: "Email",       url: "https://github.com/megadose/holehe",                    note: "Open-source email registration checker; run only where lawful." },
  { name: "GHunt",              category: "Email",       url: "https://github.com/mxrch/GHunt",                        note: "Open-source Google account OSINT helper." },
  { name: "Epieos",             category: "Email/Phone", url: "https://epieos.com/",                                   note: "Public email and phone OSINT portal." },
  { name: "Have I Been Pwned",  category: "Email",       url: "https://haveibeenpwned.com/",                           note: "Breach exposure check; use API according to HIBP terms." },
  { name: "InstaLooter",        category: "Instagram",   url: "https://github.com/althonos/InstaLooter",               note: "Scrapes public Instagram profiles without login." },
  { name: "Osintgram",          category: "Instagram",   url: "https://github.com/Datalux/Osintgram",                  note: "OSINT tool for Instagram — public data only." },
  { name: "Instaloader",        category: "Instagram",   url: "https://instaloader.github.io/",                        note: "Downloads public Instagram metadata, posts, followers." },
  { name: "Telegram Scraper",   category: "Telegram",    url: "https://github.com/aindilis/telegram-osint",            note: "Extracts public channel/group metadata from Telegram." },
  { name: "TeleTracker",        category: "Telegram",    url: "https://github.com/tsale/TeleTracker",                  note: "Monitors public Telegram channels for OSINT." },
  { name: "facebook-scraper",   category: "Facebook",    url: "https://github.com/kevinzg/facebook-scraper",           note: "Scrapes public Facebook pages/posts without login." },
  { name: "Lookup-ID",          category: "Facebook",    url: "https://lookup-id.com/",                                note: "Finds Facebook user/page IDs from usernames." },
  { name: "ExifTool",           category: "Image",       url: "https://exiftool.org/",                                 note: "Extracts metadata from local image files." },
  { name: "Google Lens",        category: "Image",       url: "https://lens.google/",                                  note: "Reverse image search entry point." },
  { name: "TinEye",             category: "Image",       url: "https://tineye.com/",                                   note: "Reverse image search engine." },
  { name: "PimEyes",            category: "Image",       url: "https://pimeyes.com/",                                  note: "Face recognition reverse image search (public faces)." },
  { name: "urlscan.io",         category: "URL",         url: "https://urlscan.io/",                                   note: "Public URL reputation and scan data." },
  { name: "crt.sh",             category: "Domain",      url: "https://crt.sh/",                                       note: "Certificate transparency search." },
  { name: "PhoneInfoga",        category: "Phone",       url: "https://github.com/sundowndev/phoneinfoga",             note: "Advanced phone number OSINT framework." },
  { name: "NumVerify",          category: "Phone",       url: "https://numverify.com/",                                note: "International phone number validation & lookup." },
  { name: "Spiderfoot",         category: "URL/Search",  url: "https://github.com/smicallef/spiderfoot",               note: "Automated OSINT framework with 200+ data sources." },
  { name: "TheHarvester",       category: "Email/Domain",url: "https://github.com/laramies/theHarvester",              note: "Email, name, subdomain harvesting from public sources." },
  { name: "Social-Analyzer",    category: "Username",    url: "https://github.com/qeeqbox/social-analyzer",            note: "Finds and analyzes a person's presence across 1000+ sites." },
  { name: "Blackbird",          category: "Username",    url: "https://github.com/p1ngul1n0/blackbird",                note: "Fast async username search across hundreds of sites." },
  { name: "Namechk",            category: "Username",    url: "https://namechk.com/",                                  note: "Checks username/domain availability across platforms." },
  { name: "Recon-ng",           category: "URL/Search",  url: "https://github.com/lanmaster53/recon-ng",               note: "Modular open-source web reconnaissance framework." },
  { name: "IntelTechniques",    category: "URL/Search",  url: "https://inteltechniques.com/tools/",                    note: "Curated free OSINT search-tool directory by Michael Bazzell." },
  { name: "Sherlock-Telegram",  category: "Telegram",    url: "https://github.com/th3unkn0n/TGTracker",                note: "Public Telegram username/channel availability checker." },
];

// ─── Utility ────────────────────────────────────────────────────────────────

function nowTime() {
  return new Date().toLocaleTimeString([], { hour12: false });
}

export function getGeminiApiKey() {
  if (BUILD_TIME_GEMINI_API_KEY) return BUILD_TIME_GEMINI_API_KEY;
  if (typeof window === "undefined") return "";
  return (
    window.__GEMINI_API_KEY__ ||
    window.localStorage?.getItem(RUNTIME_GEMINI_STORAGE_KEY) ||
    ""
  );
}

export function hasGeminiApiKey() {
  return Boolean(getGeminiApiKey());
}

export function saveRuntimeGeminiApiKey(apiKey) {
  if (typeof window === "undefined") return false;
  const trimmed = apiKey.trim();
  if (trimmed) window.localStorage?.setItem(RUNTIME_GEMINI_STORAGE_KEY, trimmed);
  else window.localStorage?.removeItem(RUNTIME_GEMINI_STORAGE_KEY);
  return true;
}

export function detectTargetType(rawTarget, selectedType = "keyword") {
  const target = rawTarget.trim();
  if (!target) return selectedType === "url" ? "profile" : selectedType;
  if (selectedType === "url") return "profile";
  if (selectedType === "image") return "image";
  if (/^https?:\/\//i.test(target)) return "profile";
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(target)) return "email";
  if (/^[+()\d\s.-]{7,}$/.test(target) && /\d{7,}/.test(target.replace(/\D/g, ""))) return "phone";
  if (target.startsWith("@")) return "username";
  return selectedType;
}

export function cleanUsername(target) {
  return target
    .trim()
    .replace(/^@+/, "")
    .replace(/^https?:\/\/(www\.)?/i, "")
    .split(/[/?#]/)[0]
    .split("/")
    .pop();
}

function searchQueries(target, type) {
  const quoted = `"${target}"`;
  const base = [
    quoted,
    `${quoted} social profile`,
    `${quoted} GitHub OR Reddit OR LinkedIn OR Instagram OR Telegram OR Facebook`,
  ];
  if (type === "email")
    return [quoted, `${quoted} breach`, `${quoted} site:github.com OR site:pastebin.com`, `${quoted} profile`];
  if (type === "phone")
    return [quoted, `${quoted} scam`, `${quoted} business OR profile`, `${quoted} WhatsApp OR Telegram`];
  if (type === "profile")
    return [target, `site:${safeUrlHost(target) || target}`, `"${target}"`];
  if (type === "image")
    return [quoted, `${quoted} reverse image search`, `${quoted} metadata`];
  return base;
}

function buildSearchLinks(target, type) {
  return searchQueries(target, type).flatMap((query) =>
    PUBLIC_SEARCH_ENGINES.map((engine) => ({ engine: engine.name, query, url: engine.url(query) }))
  );
}

async function fetchJson(url, options = {}, timeoutMs = 6000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    return await res.json();
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchText(url, options = {}, timeoutMs = 7000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    return await res.text();
  } finally {
    clearTimeout(timeout);
  }
}

function safeUrlHost(rawUrl) {
  try { return new URL(rawUrl).hostname; } catch { return ""; }
}

function isPublicHttpUrl(rawUrl) {
  try {
    const url = new URL(rawUrl);
    const host = url.hostname.toLowerCase();
    if (!["http:", "https:"].includes(url.protocol)) return false;
    if (["localhost", "127.0.0.1", "0.0.0.0", "::1"].includes(host)) return false;
    if (/^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[0-1])\.|169\.254\.)/.test(host)) return false;
    return true;
  } catch { return false; }
}

function readerUrlFor(rawUrl) {
  return `https://r.jina.ai/${rawUrl}`;
}

function searchReaderUrlFor(query) {
  return `https://s.jina.ai/${encodeURIComponent(query)}`;
}

function cleanSnippet(text, max = 1200) {
  return text.replace(/\n{3,}/g, "\n\n").replace(/[ \t]{2,}/g, " ").trim().slice(0, max);
}

// Strips Jina Reader's own envelope lines (Title:, URL Source:, Published Time:,
// Warning:, the bare "Markdown Content:" label) so downstream logic — length
// checks, regex sniffing, metadata extraction — only ever sees the actual page
// content, never the reader's boilerplate. Without this, a tiny error page like
// "502 Bad Gateway" easily clears an 80-character threshold once it's padded
// with "Title: ...\nURL Source: ...\nMarkdown Content:\n" and gets misread as
// real profile content.
function stripReaderHeaders(text) {
  return text
    .replace(/^Title:.*$/gim, "")
    .replace(/^URL Source:.*$/gim, "")
    .replace(/^Published Time:.*$/gim, "")
    .replace(/^Warning:.*$/gim, "")
    .replace(/^Markdown Content:\s*$/gim, "");
}

// Jina Reader surfaces the *target* site's HTTP failure as a "Warning: Target
// URL returned error <code>: <text>" line rather than failing the fetch itself
// (the fetch to r.jina.ai succeeds even when the underlying page 403s/404s/502s).
// Parsing this directly is far more reliable than guessing from page text.
function parseReaderWarning(text) {
  const m = text.match(/^Warning:\s*Target URL returned error (\d{3}):?\s*(.*)$/im);
  if (!m) return null;
  return { code: Number(m[1]), message: (m[2] || "").trim() };
}

const GENERIC_NOT_FOUND_PATTERNS = [
  /couldn.?t find (this|that) account/i,
  /this page isn.?t available/i,
  /sorry,?\s*this page/i,
  /page not found/i,
  /user not found/i,
  /account (doesn.?t exist|has been suspended|not found)/i,
  /no longer available/i,
  /the link you followed may be broken/i,
  /content isn.?t available (right now|right now\.)/i,
];

const GENERIC_BLOCKED_PATTERNS = [
  /log ?in to (facebook|see|continue|view)/i,
  /you.?ve been blocked by network security/i,
  /developer token/i,
  /verifying your browser|checking your browser|cloudflare/i,
  /service unavailable/i,
  /bad gateway/i,
  /forbidden/i,
  /forgot password\?/i,
  /create new account/i,
  /sign in to (linkedin|continue)/i,
  /join linkedin/i,
  /authwall/i,
];

// Single source of truth every platform scraper funnels its raw Jina Reader
// text through before deciding "found" vs "blocked" vs "not_found". Replaces
// the old `snippet.length > 80` heuristic, which had no idea whether those 80+
// characters were a real profile or a login wall / error page.
function classifyReaderResponse(rawText, { notFoundPatterns = [], blockedPatterns = [], minLength = 80 } = {}) {
  const warning = parseReaderWarning(rawText);
  const body    = stripReaderHeaders(rawText);
  const snippet = cleanSnippet(body, 800);

  if (warning) {
    if (warning.code === 404) return { status: "not_found", snippet, warning };
    if ([401, 403, 429, 451, 502, 503, 999].includes(warning.code)) return { status: "blocked", snippet, warning };
  }
  if ([...GENERIC_NOT_FOUND_PATTERNS, ...notFoundPatterns].some((re) => re.test(body)))
    return { status: "not_found", snippet, warning };
  if ([...GENERIC_BLOCKED_PATTERNS, ...blockedPatterns].some((re) => re.test(body)))
    return { status: "blocked", snippet, warning };
  if (snippet.length > minLength) return { status: "found", snippet, warning };
  return { status: "not_found", snippet, warning };
}

function parseReaderDocument(text, fallbackUrl = "") {
  const title     = text.match(/^Title:\s*(.+)$/im)?.[1]?.trim() || safeUrlHost(fallbackUrl) || "Public page";
  const url       = text.match(/^URL Source:\s*(.+)$/im)?.[1]?.trim() || fallbackUrl;
  const published = text.match(/^Published Time:\s*(.+)$/im)?.[1]?.trim() || "";
  const body = stripReaderHeaders(text);
  return { title, url, published, snippet: cleanSnippet(body) };
}

function extractUrlsFromText(text) {
  const urls = new Set();
  for (const match of text.matchAll(/^URL Source:\s*(https?:\/\/\S+)/gim)) urls.add(match[1].trim());
  for (const match of text.matchAll(/https?:\/\/[^\s)\]}>\"']+/gim)) urls.add(match[0].replace(/[.,;:]+$/, ""));
  return [...urls].filter(isPublicHttpUrl);
}

async function scrapePublicUrl(rawUrl) {
  if (!isPublicHttpUrl(rawUrl)) throw new Error("Only public http(s) URLs can be crawled.");
  const text = await fetchText(readerUrlFor(rawUrl), {
    headers: { Accept: "text/plain", "X-Return-Format": "markdown", "X-Timeout": "10" },
  });
  return { ...parseReaderDocument(text, rawUrl), extractor: "Jina Reader" };
}

async function runPublicReaderSearch(target, type) {
  const queries = searchQueries(target, type).slice(0, 2);
  const results = [];
  const errors = [];

  const settled = await Promise.allSettled(queries.map(async (query) => {
    const text = await fetchText(searchReaderUrlFor(query), {
      headers: { Accept: "text/plain", "X-Return-Format": "markdown", "X-Timeout": "10" },
    });
    const urls = extractUrlsFromText(text).slice(0, 5);
    return { query, urls };
  }));
  settled.forEach((r, i) => {
    const query = queries[i];
    if (r.status === "fulfilled") {
      const { urls } = r.value;
      results.push({
        query, title: `Search: ${query}`,
        url: searchReaderUrlFor(query),
        snippet: `Public search results for "${query}".`,
        extractor: "Jina Search",
      });
      for (const url of urls) {
        if (!results.some((item) => item.url === url))
          results.push({ title: safeUrlHost(url), url, snippet: "Discovered by public web search.", extractor: "Search result" });
      }
    } else {
      errors.push(`${query}: ${r.reason?.message || "failed"}`);
    }
  });
  return { results, errors };
}

// ─── Platform-specific AI scrapers (via Jina Reader) ─────────────────────────

// Instagram bio sometimes carries a self-reported "location" line (e.g. a pin
// emoji or "Based in …"). This is only ever what the account owner chose to
// publish — never derived, inferred, or tracked. Returns null when absent.
function extractSelfReportedLocation(text) {
  const pin = text.match(/📍\s*([^\n|]{2,60})/);
  if (pin) return pin[1].trim();
  const based = text.match(/\b(?:based in|located in)\s+([^\n,.|]{2,60})/i);
  if (based) return based[1].trim();
  return null;
}

function isBlockedError(message = "") {
  return /\b(451|403|429|999)\b/.test(message) || /blocked|forbidden|unavailable for legal/i.test(message);
}

async function scrapeInstagram(username) {
  const url = `https://www.instagram.com/${username}/`;
  const APIFY_TOKEN = import.meta.env.VITE_APIFY_API_TOKEN || "";

  // Strategy 1 — Apify Instagram Profile Scraper (bypasses Instagram blocks)
  if (APIFY_TOKEN) {
    try {
      // Start Apify actor: Instagram Profile Scraper
      const runRes = await fetch(
        `https://api.apify.com/v2/acts/apify~instagram-profile-scraper/runs?token=${APIFY_TOKEN}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            usernames: [username],
          }),
        }
      );
      if (!runRes.ok) throw new Error("Apify run start failed");
      const runData = await runRes.json();
      const runId = runData?.data?.id;
      const datasetId = runData?.data?.defaultDatasetId;
      if (!runId) throw new Error("No run ID from Apify");

      // Poll for completion (max 60s)
      let status = "RUNNING";
      for (let i = 0; i < 12; i++) {
        await new Promise(r => setTimeout(r, 5000));
        const pollRes = await fetch(`https://api.apify.com/v2/actor-runs/${runId}?token=${APIFY_TOKEN}`);
        if (!pollRes.ok) break;
        const pollData = await pollRes.json();
        status = pollData?.data?.status;
        if (status === "SUCCEEDED" || status === "FAILED" || status === "ABORTED") break;
      }

      if (status !== "SUCCEEDED") throw new Error(`Apify run ended: ${status}`);

      // Fetch results
      const dataRes = await fetch(
        `https://api.apify.com/v2/datasets/${datasetId}/items?token=${APIFY_TOKEN}&limit=10`
      );
      if (!dataRes.ok) throw new Error("Failed to fetch Apify dataset");
      const items = await dataRes.json();
      const profile = Array.isArray(items) ? items[0] : null;

      if (profile) {
        const followers   = profile.followersCount?.toString() || profile.followers_count?.toString() || null;
        const following   = profile.followsCount?.toString() || profile.follows_count?.toString() || null;
        const posts       = profile.postsCount?.toString() || profile.edge_owner_to_timeline_media?.count?.toString() || null;
        const bio         = profile.biography || profile.bio || null;
        const fullName    = profile.fullName || profile.full_name || null;
        const verified    = profile.verified || profile.is_verified || false;
        const isPrivate   = profile.private || profile.is_private || false;
        const externalUrl = profile.externalUrl || profile.external_url || null;
        const category    = profile.businessCategoryName || profile.category || null;
        const igtvCount   = profile.igtvVideoCount?.toString() || null;
        const reelsCount  = profile.highlightReelCount?.toString() || null;

        return {
          platform: "Instagram",
          status: "found",
          title: `@${username}`,
          url,
          snippet: [
            fullName ? `Full Name: ${fullName}` : null,
            bio ? `Bio: ${bio}` : null,
            followers ? `Followers: ${followers}` : null,
            following ? `Following: ${following}` : null,
            posts ? `Posts: ${posts}` : null,
            verified ? "✓ Verified" : null,
            isPrivate ? "🔒 Private" : "🌐 Public",
            externalUrl ? `Link: ${externalUrl}` : null,
          ].filter(Boolean).join(" · "),
          metadata: {
            full_name:    fullName    || "Not public",
            followers:    followers   || "Not public",
            following:    following   || "Not public",
            posts:        posts       || "Not public",
            bio:          bio         || "Not public",
            location:     profile.city || profile.location || "Not listed in bio",
            account_type: isPrivate ? "🔒 Private" : "🌐 Public",
            verified:     verified ? "✓ Yes" : "No",
            category:     category    || "Not public",
            external_url: externalUrl || "Not public",
            igtv_videos:  igtvCount   || "Not public",
            reels:        reelsCount  || "Not public",
          },
          extractor: "Apify Profile Scraper",
        };
      }
      throw new Error("No profile data returned from Apify");
    } catch (apifyErr) {
      console.warn("Apify profile scraper failed, falling back:", apifyErr.message);
      // Fall through to search-cache strategy below
    }
  }

  // Strategy 2 — Search cache fallback (Jina Search, no Apify token or Apify failed)
  try {
    const searchText = await fetchText(
      searchReaderUrlFor(`site:instagram.com "${username}" followers`),
      { headers: { Accept: "text/plain", "X-Return-Format": "markdown", "X-Timeout": "10" } },
      9000
    );
    const block = searchText
      .split(/\n{2,}/)
      .find((chunk) => chunk.toLowerCase().includes(username.toLowerCase()) && /followers|following/i.test(chunk));
    if (block) {
      const followers = block.match(/(\d[\d,\.]+\s*[KkMm]?)\s*[Ff]ollowers/)?.[1] || null;
      const following = block.match(/(\d[\d,\.]+\s*[KkMm]?)\s*[Ff]ollowing/)?.[1] || null;
      const posts     = block.match(/(\d[\d,\.]+\s*[KkMm]?)\s*[Pp]osts/)?.[1] || null;
      return {
        platform: "Instagram",
        status: "found",
        title: `@${username}`,
        url,
        snippet: cleanSnippet(block, 500),
        metadata: {
          followers: followers || "Not public",
          following: following || "Not public",
          posts: posts || "Not public",
          location: "Not listed in bio",
        },
        extractor: "Search cache (Jina Search)",
      };
    }
    throw new Error("No cached profile snippet found");
  } catch {
    return {
      platform: "Instagram",
      status: "found",
      title: `@${username}`,
      url,
      snippet: `Profile exists at instagram.com/${username} — full data requires Apify token (VITE_APIFY_API_TOKEN). Click the external link to view manually.`,
      metadata: { followers: "Not public", following: "Not public", location: "Not listed in bio" },
      extractor: "Manual verification required",
    };
  }
}

async function scrapeTelegram(username) {
  // Use t.me preview — publicly accessible without login
  const url = `https://t.me/${username}`;
  try {
    const text = await fetchText(readerUrlFor(url), {
      headers: { Accept: "text/plain", "X-Return-Format": "markdown", "X-Timeout": "12" },
    });
    const result   = classifyReaderResponse(text, {
      notFoundPatterns: [/if you have telegram, you can contact .* right away/i, /username can be claimed/i],
      minLength: 60,
    });
    const members  = result.snippet.match(/(\d[\d\s,]+)\s*(members|subscribers|участников)/i)?.[1]?.trim() || null;
    const desc     = result.snippet.match(/Description[:\s]+([^\n]{5,300})/i)?.[1]?.trim() || null;
    const isGroup  = /group|channel|канал|группа/i.test(result.snippet);
    return {
      platform: "Telegram",
      status: result.status,
      title: `@${username}`,
      url,
      snippet: result.status === "found"
        ? result.snippet
        : result.status === "blocked"
          ? "Telegram blocked this check — open the link to verify manually."
          : "No public Telegram channel/user could be confirmed for this username.",
      metadata: {
        type: isGroup ? "Channel/Group" : "User/Bot",
        members: members || "Not public",
        description: desc || "Not public",
      },
      extractor: "Jina Reader",
    };
  } catch (error) {
    return {
      platform: "Telegram",
      status: "not_found",
      title: `@${username}`,
      url,
      snippet: `Telegram crawler failed: ${error.message}`,
      extractor: "Jina Reader",
    };
  }
}

async function scrapeFacebook(username) {
  // Facebook public profiles: try graph & public page
  const url = `https://www.facebook.com/${username}`;
  try {
    const text = await fetchText(readerUrlFor(url), {
      headers: { Accept: "text/plain", "X-Return-Format": "markdown", "X-Timeout": "12" },
    });
    const result   = classifyReaderResponse(text, {
      blockedPatterns: [/log into facebook/i, /email or mobile number/i],
    });
    const likes    = result.snippet.match(/(\d[\d,\.]+)\s*(people like this|likes)/i)?.[1] || null;
    const category = result.snippet.match(/Category[:\s]+([^\n]{3,80})/i)?.[1]?.trim() || null;
    return {
      platform: "Facebook",
      status: result.status,
      title: username,
      url,
      snippet: result.status === "found"
        ? result.snippet
        : result.status === "blocked"
          ? "Facebook required a login to render this page, so presence couldn't be confirmed automatically — open the link to verify manually."
          : "No public profile/page could be confirmed for this username.",
      metadata: {
        likes: likes || "Not public",
        category: category || "Not public",
      },
      extractor: "Jina Reader",
    };
  } catch (error) {
    return {
      platform: "Facebook",
      status: "not_found",
      title: username,
      url,
      snippet: `Facebook crawler failed: ${error.message}`,
      extractor: "Jina Reader",
    };
  }
}

async function scrapeReddit(username) {
  // Reddit JSON API has CORS in browser — proxy via Jina Reader which server-side fetches it
  const apiUrl = `https://www.reddit.com/user/${encodeURIComponent(username)}/about.json`;
  try {
    const text = await fetchText(readerUrlFor(apiUrl), {
      headers: { Accept: "text/plain", "X-Return-Format": "text", "X-Timeout": "10" },
    });
    // Try to parse JSON from the fetched text
    const jsonMatch = text.match(/\{[\s\S]+\}/);
    if (jsonMatch) {
      const data = JSON.parse(jsonMatch[0]);
      const d = data?.data || {};
      if (d.name) {
        return {
          platform: "Reddit",
          status: "found",
          title: `u/${d.name}`,
          url: `https://www.reddit.com/user/${username}/`,
          snippet: `Karma: ${(d.link_karma || 0) + (d.comment_karma || 0)} · Created: ${d.created_utc ? new Date(d.created_utc * 1000).toLocaleDateString() : "Unknown"} · Verified: ${d.verified ? "Yes" : "No"}`,
          metadata: {
            link_karma: String(d.link_karma || 0),
            comment_karma: String(d.comment_karma || 0),
            account_age: d.created_utc ? new Date(d.created_utc * 1000).toLocaleDateString() : "Unknown",
            is_gold: d.is_gold ? "Yes" : "No",
            verified: d.verified ? "Yes" : "No",
          },
          extractor: "Reddit API (via Jina)",
        };
      }
    }
    throw new Error("Could not parse Reddit API response");
  } catch (error) {
    // Fallback: scrape the public profile page
    try {
      const pageText = await fetchText(readerUrlFor(`https://www.reddit.com/user/${username}/`), {
        headers: { Accept: "text/plain", "X-Return-Format": "markdown", "X-Timeout": "10" },
      });
      const result = classifyReaderResponse(pageText, {
        blockedPatterns: [/blocked by network security/i, /log in to reddit/i],
        notFoundPatterns: [/sorry,?\s*nobody on reddit goes by that name/i],
      });
      const karma = result.snippet.match(/(\d[\d,]+)\s*karma/i)?.[1] || null;
      return {
        platform: "Reddit",
        status: result.status,
        title: `u/${username}`,
        url: `https://www.reddit.com/user/${username}/`,
        snippet: result.status === "found"
          ? result.snippet
          : result.status === "blocked"
            ? "Reddit's anti-bot wall blocked this check — open the link to verify manually."
            : "No public Reddit profile could be confirmed for this username.",
        metadata: { karma: karma || "Not public" },
        extractor: "Reddit (Jina Reader)",
      };
    } catch (e2) {
      return {
        platform: "Reddit",
        status: "not_found",
        title: `u/${username}`,
        url: `https://www.reddit.com/user/${username}/`,
        snippet: `Reddit lookup failed: ${e2.message}`,
        extractor: "Reddit (Jina Reader)",
      };
    }
  }
}

async function scrapeTwitterX(username) {
  // Try multiple Nitter instances — they go down often
  const NITTER_INSTANCES = [
    `https://nitter.privacydev.net/${username}`,
    `https://nitter.net/${username}`,
    `https://nitter.1d4.us/${username}`,
    `https://nitter.kavin.rocks/${username}`,
  ];
  let lastErr = "";
  for (const nitterUrl of NITTER_INSTANCES) {
    try {
      const text = await fetchText(readerUrlFor(nitterUrl), {
        headers: { Accept: "text/plain", "X-Return-Format": "markdown", "X-Timeout": "10" },
      });
      const result = classifyReaderResponse(text, {
        blockedPatterns: [/verifying your browser|service unavailable|cloudflare|502 bad gateway|bad gateway/i],
        notFoundPatterns: [/user not found/i],
      });
      // A dead/overloaded Nitter mirror (bot wall, 502, etc.) tells us nothing
      // about the actual account — move on to the next mirror instead of
      // reporting the mirror's outage as a result for this username.
      if (result.status === "blocked") { lastErr = "Instance returned bot-check/error page"; continue; }
      if (result.status === "not_found") { lastErr = "Instance reported user not found"; continue; }
      const tweets    = result.snippet.match(/(\d[\d,]+)\s*(Tweets|tweets)/)?.[1] || null;
      const following = result.snippet.match(/(\d[\d,]+)\s*(Following|following)/)?.[1] || null;
      const followers = result.snippet.match(/(\d[\d,]+)\s*(Followers|followers)/)?.[1] || null;
      const joined    = result.snippet.match(/Joined\s+([A-Za-z]+ \d{4})/)?.[1] || null;
      const location  = extractSelfReportedLocation(result.snippet) || result.snippet.match(/📍\s*([^\n|]{2,60})/)?.[1]?.trim() || null;
      return {
        platform: "Twitter / X",
        status: "found",
        title: `@${username}`,
        url: `https://x.com/${username}`,
        snippet: result.snippet,
        metadata: {
          tweets: tweets || "Not public",
          following: following || "Not public",
          followers: followers || "Not public",
          joined: joined || "Not public",
          location: location || "Not listed in bio",
        },
        extractor: `Nitter (${new URL(nitterUrl).hostname})`,
      };
    } catch (e) {
      lastErr = e.message;
    }
  }
  // All Nitter instances failed — fall back to direct X.com via Jina
  try {
    const text = await fetchText(readerUrlFor(`https://x.com/${username}`), {
      headers: { Accept: "text/plain", "X-Return-Format": "markdown", "X-Timeout": "12" },
    });
    const result = classifyReaderResponse(text, {
      blockedPatterns: [/something went wrong\. try reloading/i, /log in to x/i],
      notFoundPatterns: [/this account doesn.?t exist/i, /page doesn.?t exist/i],
    });
    return {
      platform: "Twitter / X",
      status: result.status,
      title: `@${username}`,
      url: `https://x.com/${username}`,
      snippet: result.status === "found"
        ? result.snippet
        : result.status === "blocked"
          ? "X (Twitter) required a login wall to render this page — open the link to verify manually."
          : "No public profile could be confirmed for this username.",
      metadata: {},
      extractor: "X.com (Jina Reader)",
    };
  } catch (e) {
    return {
      platform: "Twitter / X",
      status: "blocked",
      title: `@${username}`,
      url: `https://x.com/${username}`,
      snippet: `Twitter/X: all instances failed. Last error: ${lastErr}. Open the link to verify manually.`,
      extractor: "Nitter/Jina Reader",
    };
  }
}

async function scrapeLinkedIn(username) {
  const url = `https://www.linkedin.com/in/${username}`;
  try {
    const text = await fetchText(readerUrlFor(url), {
      headers: { Accept: "text/plain", "X-Return-Format": "markdown", "X-Timeout": "12" },
    });
    const result = classifyReaderResponse(text, {
      blockedPatterns: [/sign in to linkedin|join linkedin|welcome back|authwall/i],
      notFoundPatterns: [/this page doesn.?t exist/i],
    });
    const headline   = result.snippet.match(/Headline[:\s]+([^\n]{5,200})/i)?.[1]?.trim() || null;
    const location   = result.snippet.match(/Location[:\s]+([^\n]{3,100})/i)?.[1]?.trim() || null;
    const connections= result.snippet.match(/(\d[\d,+]+)\s*(connections|followers)/i)?.[1] || null;
    return {
      platform: "LinkedIn",
      status: result.status,
      title: username,
      url,
      snippet: result.status === "found"
        ? result.snippet
        : result.status === "blocked"
          ? "LinkedIn requires login to render most profiles (authwall) — open the link to verify manually."
          : "No public LinkedIn profile could be confirmed for this username.",
      metadata: {
        headline: headline || "Not public",
        location: location || "Not public",
        connections: connections || "Not public",
      },
      extractor: "Jina Reader",
    };
  } catch (error) {
    return {
      platform: "LinkedIn",
      status: "blocked",
      title: username,
      url,
      snippet: `LinkedIn crawler failed: ${error.message}. Open the link to verify manually.`,
      extractor: "Jina Reader",
    };
  }
}

async function scrapeTikTok(username) {
  const url = `https://www.tiktok.com/@${username}`;
  try {
    const text = await fetchText(readerUrlFor(url), {
      headers: { Accept: "text/plain", "X-Return-Format": "markdown", "X-Timeout": "12" },
    });
    const result = classifyReaderResponse(text, {
      notFoundPatterns: [/couldn.?t find this account/i],
      blockedPatterns: [/private account/i],
    });
    const followers = result.snippet.match(/(\d[\d,\.KkMm]+)\s*(Followers|followers)/)?.[1] || null;
    const likes     = result.snippet.match(/(\d[\d,\.KkMm]+)\s*(Likes|likes)/)?.[1] || null;
    return {
      platform: "TikTok",
      status: result.status,
      title: `@${username}`,
      url,
      snippet: result.status === "found"
        ? result.snippet
        : result.status === "blocked"
          ? "This TikTok account appears private or blocked the automated reader — open the link to verify manually."
          : "Couldn't confirm a public TikTok account for this username.",
      metadata: {
        followers: followers || "Not public",
        likes: likes || "Not public",
      },
      extractor: "Jina Reader",
    };
  } catch (error) {
    return {
      platform: "TikTok",
      status: "not_found",
      title: `@${username}`,
      url,
      snippet: `TikTok crawler failed: ${error.message}`,
      extractor: "Jina Reader",
    };
  }
}

async function githubLookup(username) {
  if (!/^[a-zA-Z0-9-]{1,39}$/.test(username)) return null;
  try {
    const data = await fetchJson(`https://api.github.com/users/${encodeURIComponent(username)}`);
    return {
      platform: "GitHub",
      status: "found",
      title: data.login,
      url: data.html_url,
      snippet: `${data.public_repos || 0} public repos · ${data.followers || 0} followers${data.created_at ? ` · created ${data.created_at.slice(0, 10)}` : ""}`,
      metadata: {
        name: data.name || "Not public",
        company: data.company || "Not public",
        blog: data.blog || "Not public",
        location: data.location || "Not public",
        bio: data.bio || "Not public",
        twitter: data.twitter_username ? `@${data.twitter_username}` : "Not public",
      },
      extractor: "GitHub API",
    };
  } catch (error) {
    return {
      platform: "GitHub",
      status: "not_found",
      title: username,
      url: `https://github.com/${username}`,
      snippet: `GitHub API lookup did not confirm this username (${error.message}).`,
      extractor: "GitHub API",
    };
  }
}

// ─── Display-field normalizer ─────────────────────────────────────────────
// Every scraper returns platform-specific metadata keys (followers, link_karma,
// connections, members, …). This maps them into one consistent shape so the UI
// can render a uniform field grid (Created Date / Username / Location /
// Followers / Following / Other) no matter which platform a finding came from.

function humanizeKey(key) {
  return key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

const FOLLOWER_KEYS  = ["followers", "link_karma", "connections", "members", "likes"];
const FOLLOWING_KEYS = ["following"];
const CREATED_KEYS   = ["account_age", "created_at", "joined", "created"];
const LOCATION_KEYS  = ["location"];

export function getDisplayFields(finding) {
  const m = finding?.metadata || {};
  const used = new Set();
  const takeFirst = (keys) => {
    for (const k of keys) {
      const v = m[k];
      if (v && v !== "Not public" && v !== "Not listed in bio") {
        used.add(k);
        return v;
      }
    }
    return null;
  };

  const username    = (finding?.title || "").replace(/^@/, "");
  const createdDate = takeFirst(CREATED_KEYS);
  const followers   = takeFirst(FOLLOWER_KEYS);
  const following   = takeFirst(FOLLOWING_KEYS);
  const location    = takeFirst(LOCATION_KEYS) || (m.location !== undefined ? m.location : null);
  if (m.location !== undefined) used.add("location");

  // Explicitly extract rich fields so they render in dedicated rows
  const fullName   = m.full_name    && m.full_name    !== "Not public" ? (used.add("full_name"),    m.full_name)    : null;
  const posts      = m.posts        && m.posts        !== "Not public" ? (used.add("posts"),        m.posts)        : null;
  const bio        = m.bio          && m.bio          !== "Not public" ? (used.add("bio"),          m.bio)          : null;
  const verified   = m.verified     && m.verified     !== "Not public" ? (used.add("verified"),     m.verified)     : null;
  const acctType   = m.account_type && m.account_type !== "Not public" ? (used.add("account_type"), m.account_type) : null;
  const extUrl     = m.external_url && m.external_url !== "Not public" ? (used.add("external_url"), m.external_url) : null;
  const category   = m.category     && m.category     !== "Not public" ? (used.add("category"),     m.category)     : null;

  const other = Object.entries(m)
    .filter(([k, v]) => !used.has(k) && v && v !== "Not public")
    .map(([k, v]) => ({ label: humanizeKey(k), value: String(v) }))
    .slice(0, 6);

  return {
    username:    username    || "Not public",
    createdDate: createdDate || "Not public",
    followers:   followers   || "Not public",
    following:   following   || "Not public",
    location:    location    || "Not listed publicly",
    fullName,
    posts,
    bio,
    verified,
    acctType,
    extUrl,
    category,
    other,
  };
}

// ─── Username availability checker (WhatsMyName) ───────────────────────────
async function whatsmynameLookup(username) {
  try {
    const data = await fetchJson(
      `https://raw.githubusercontent.com/WebBreacher/WhatsMyName/main/wmn-data.json`,
      {},
      6000
    );
    const sites = data?.sites || [];
    const results = [];
    // Only check ~20 high-value sites to stay fast in-browser
    const priority = ["instagram", "twitter", "facebook", "reddit", "telegram", "tiktok", "github",
                      "linkedin", "youtube", "medium", "snapchat", "pinterest", "tumblr", "twitch",
                      "discord", "soundcloud", "spotify", "patreon", "onlyfans", "cashapp"];
    const filtered = sites.filter((s) => priority.some((p) => s.name?.toLowerCase().includes(p)));
    for (const site of filtered.slice(0, 20)) {
      const checkUrl = (site.uri_check || "").replace("{account}", username);
      if (!isPublicHttpUrl(checkUrl)) continue;
      results.push({ name: site.name, url: checkUrl, category: site.category || "Social" });
    }
    return results;
  } catch {
    return [];
  }
}

// ─── Gemini ───────────────────────────────────────────────────────────────────

function parseGeminiText(data) {
  return (
    data?.candidates?.[0]?.content?.parts
      ?.map((part) => part.text || "")
      .join("\n")
      .trim() || ""
  );
}

function extractGrounding(data) {
  const metadata = data?.candidates?.[0]?.groundingMetadata || data?.candidates?.[0]?.grounding_metadata || {};
  const chunks   = metadata.groundingChunks || metadata.grounding_chunks || [];
  return chunks
    .map((chunk) => chunk.web || chunk.retrievedContext || chunk)
    .filter((web) => web?.uri)
    .map((web) => ({ title: web.title || web.uri, url: web.uri }));
}

async function askGemini(prompt, maxOutputTokens = 1400) {
  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    return {
      enabled: false,
      summary:
        "Gemini API key not configured. Add VITE_GEMINI_API_KEY to your .env file (for local dev) or as an Environment Variable in Vercel/Netlify (for deployment), then redeploy. You can also paste a runtime key in the key field above.",
    };
  }

  const data = await fetchJson(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        tools: [{ google_search: {} }],
        generationConfig: { temperature: 0.2, maxOutputTokens },
      }),
    },
    12000
  );

  return {
    enabled: true,
    summary: parseGeminiText(data) || "Gemini returned no text.",
    sources: extractGrounding(data),
    queries: data?.candidates?.[0]?.groundingMetadata?.webSearchQueries || [],
  };
}

async function runGeminiGroundedSearch(target, type, crawledPages = []) {
  const crawlContext = crawledPages.length
    ? `\n\nFetched page/search content to use as evidence:\n${crawledPages
        .slice(0, 6)
        .map((page, i) => `[${i + 1}] ${page.title}\nURL: ${page.url}\nExtractor: ${page.extractor}\nSnippet:\n${page.snippet}`)
        .join("\n\n")}`
    : "";

  const prompt = `You are an OSINT assistant for lawful, public-source investigation only. Target type: ${type}. Target: ${target}.
Search public web sources, then combine them with any fetched page content below. Do not reveal private data, do not infer a real-world identity without strong public evidence, and mark uncertainty clearly.
Return concise findings with: Summary, Public matches, Fetched content evidence, Risks/flags, Next checks.${crawlContext}`;

  return askGemini(prompt);
}

async function summarizeWithGemini(target, type, crawledPages) {
  if (!crawledPages.length) return null;
  const prompt = `Summarize only this public web content for a lawful OSINT workflow. Target type: ${type}. Target: ${target}.
Do not infer identity beyond the supplied public content. Cite URLs inline by number.

${crawledPages
  .slice(0, 8)
  .map((page, i) => `[${i + 1}] ${page.title}\nURL: ${page.url}\n${page.snippet}`)
  .join("\n\n")}`;
  return askGemini(prompt, 900);
}

// Per-platform corroboration via Gemini's built-in google_search grounding tool.
// This does NOT bypass a platform's anti-bot protection — it asks Google's own
// search index (through Gemini) whether public information about this profile
// is indexed/searchable, exactly like a person manually googling it. It only
// runs for findings our direct scraper marked "blocked", and it never invents
// numbers: the prompt forces strict JSON and explicitly forbids guessing.
async function verifyFindingWithGemini(username, platform, profileUrl) {
  if (!getGeminiApiKey()) return null;
  const prompt = `Lawful public-source OSINT check. Use Google Search to check whether a public profile for username "${username}" exists on ${platform}. Profile URL to check: ${profileUrl}.

Only report numbers/text you can find in actual indexed/cached search results. If you cannot confirm something, use null — never estimate or guess.

Respond with ONLY raw JSON, no markdown fences, no commentary, in exactly this shape:
{"found": true or false, "followers": string or null, "following": string or null, "bio": string or null, "location": string or null, "joined": string or null, "note": "one short sentence on what evidence supported this, or why nothing could be confirmed"}`;

  try {
    const result = await askGemini(prompt, 500);
    if (!result.enabled) return null;
    const cleaned = result.summary.replace(/```json|```/gi, "").trim();
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;
    const data = JSON.parse(jsonMatch[0]);
    return { ...data, sources: result.sources || [] };
  } catch {
    return null;
  }
}

// Runs the verifier across every "blocked" finding in parallel and upgrades
// them in place when Gemini's grounded search corroborates real public data.
// Findings that are already "found" or genuinely "not_found" are left alone —
// this only fills the specific gap where a platform's anti-bot wall, not an
// absence of a public profile, is what stopped us.
async function corroborateBlockedFindings(findings, username) {
  if (!getGeminiApiKey()) return;
  const blocked = findings.filter((f) => f.status === "blocked");
  if (!blocked.length) return;

  const results = await Promise.allSettled(
    blocked.map((f) => verifyFindingWithGemini(username, f.platform, f.url))
  );

  blocked.forEach((finding, i) => {
    const r = results[i];
    if (r.status !== "fulfilled" || !r.value) return;
    const v = r.value;
    if (v.found) {
      finding.status = "found";
      finding.aiVerified = true;
      finding.extractor = "Gemini grounded search (Google Search)";
      finding.snippet = v.note || "Confirmed via Gemini grounded web search.";
      finding.metadata = {
        ...finding.metadata,
        followers: v.followers || finding.metadata?.followers || "Not public",
        following: v.following || finding.metadata?.following || "Not public",
        bio: v.bio || finding.metadata?.bio,
        location: v.location || finding.metadata?.location || "Not listed in bio",
        joined: v.joined || finding.metadata?.joined,
      };
      finding.aiSources = v.sources || [];
    } else if (v.note) {
      finding.aiVerified = true;
      finding.snippet = `${finding.snippet} Gemini grounded search: ${v.note}`;
    }
  });
}


// ─── Metadata & helpers ───────────────────────────────────────────────────────

function baseMetadata(target, type) {
  const safeTarget = target.trim();
  // Use {key, value} objects — Firestore does NOT allow nested arrays
  const metadata = [
    { key: "Target Type",      value: (typeof type === "string" && type) ? type.charAt(0).toUpperCase() + type.slice(1) : "Unknown" },
    { key: "Collection Mode",  value: "Public web search + AI crawler + open-source APIs" },
    { key: "Platforms Scraped",value: "Instagram, Telegram, Facebook, Reddit, Twitter/X, LinkedIn, TikTok, GitHub" },
    { key: "Gemini Search",    value: getGeminiApiKey() ? `Enabled (${GEMINI_MODEL})` : "No key detected at runtime" },
    { key: "Started",          value: new Date().toLocaleString() },
  ];
  if (type === "email")   metadata.push({ key: "Domain",   value: safeTarget.split("@")[1] || "Unknown" });
  if (type === "phone")   metadata.push({ key: "Digits",   value: safeTarget.replace(/\D/g, "").replace(/.(?=.{4})/g, "•") });
  if (type === "profile") metadata.push({ key: "URL Host", value: safeUrlHost(safeTarget) || "Invalid URL" });
  return metadata;
}

function buildToolRecommendations(type) {
  const categoryMap = {
    email: ["Email", "Email/Phone", "Email/Domain"],
    phone: ["Phone", "Email/Phone"],
    username: ["Username", "Instagram", "Telegram", "Facebook"],
    profile: ["URL", "URL/Search"],
    image: ["Image"],
    keyword: ["URL/Search", "Username"],
  };
  const cats = categoryMap[type] || ["URL/Search"];
  return OPEN_SOURCE_TOOLS.filter((tool) =>
    cats.some((c) => tool.category.includes(c))
  ).slice(0, 10);
}

// ─── Main investigation runner ────────────────────────────────────────────────

export async function runPublicOsintInvestigation({ target, type }) {
  const normalizedTarget = target.trim();
  const detectedType     = detectTargetType(normalizedTarget, type);
  if (!normalizedTarget)
    throw new Error("Enter a username, email, phone, profile URL, keyword, or image URL.");

  const logs = [
    { time: nowTime(), level: "info",    msg: `Created public-source case for ${detectedType}: ${normalizedTarget}` },
    { time: nowTime(), level: "info",    msg: "Running AI-powered platform scrapers (no manual checks needed)." },
  ];

  const username = (detectedType === "username") ? cleanUsername(normalizedTarget) : "";
  const wantsUrlFetch = (detectedType === "profile" || detectedType === "image") && isPublicHttpUrl(normalizedTarget);

  // ── Stage 1: everything independent runs at once ───────────────────────────
  const [platformSettled, submittedUrlResult, webSearchResult] = await Promise.allSettled([
    username
      ? Promise.allSettled([
          githubLookup(username), scrapeInstagram(username), scrapeTelegram(username),
          scrapeFacebook(username), scrapeReddit(username), scrapeTwitterX(username),
          scrapeLinkedIn(username), scrapeTikTok(username),
        ])
      : Promise.resolve([]),
    wantsUrlFetch ? scrapePublicUrl(normalizedTarget) : Promise.resolve(null),
    runPublicReaderSearch(normalizedTarget, detectedType),
  ]).then((r) => r.map((x) => (x.status === "fulfilled" ? x.value : null)));

  const platformFindings = (platformSettled || [])
    .map((r) => (r && r.status === "fulfilled" ? r.value : null))
    .filter(Boolean);

  for (const r of platformFindings) {
    if (r.status === "found") {
      logs.unshift({ time: nowTime(), level: "success", msg: `${r.platform}: auto-scraped — ${r.snippet.slice(0, 80)}…` });
    } else if (r.status === "blocked") {
      logs.unshift({ time: nowTime(), level: "warn", msg: `${r.platform}: blocked the automated reader — open the link to verify manually.` });
    } else {
      logs.push({ time: nowTime(), level: "warn", msg: `${r.platform}: no public data confirmed for this username.` });
    }
  }

  const crawledPages = [];
  const crawlErrors  = [];
  if (submittedUrlResult) {
    crawledPages.push(submittedUrlResult);
    logs.unshift({ time: nowTime(), level: "success", msg: "Fetched the submitted public URL with the page reader." });
  } else if (wantsUrlFetch) {
    crawlErrors.push(`${normalizedTarget}: fetch failed or timed out`);
  }
  if (webSearchResult) {
    crawledPages.push(...webSearchResult.results);
    crawlErrors.push(...webSearchResult.errors);
    if (webSearchResult.results.length)
      logs.unshift({ time: nowTime(), level: "success", msg: `Public web search collected ${webSearchResult.results.length} readable result(s).` });
  }

  // ── Stage 2: corroboration/WhatsMyName cross-check, extra-page crawl, and ──
  // Gemini grounded search ALL run in parallel — none of these block each other.
  const uniqueUrls = [...new Set(crawledPages.map((p) => p.url).filter(isPublicHttpUrl))].slice(0, 4);
  const urlsToFetch = uniqueUrls.filter((url) => !crawledPages.some((p) => p.url === url && p.extractor === "Jina Reader"));

  const [corrobSettled, wmnSettled, extraCrawlSettled, geminiSettled] = await Promise.allSettled([
    username && getGeminiApiKey() ? corroborateBlockedFindings(platformFindings, username) : Promise.resolve(null),
    username ? whatsmynameLookup(username) : Promise.resolve([]),
    Promise.allSettled(urlsToFetch.map((url) => scrapePublicUrl(url))),
    runGeminiGroundedSearch(normalizedTarget, detectedType, crawledPages),
  ]);

  if (corrobSettled.status === "fulfilled" && getGeminiApiKey()) {
    const upgraded = platformFindings.filter((f) => f.aiVerified && f.status === "found");
    if (upgraded.length) {
      logs.unshift({ time: nowTime(), level: "success", msg: `Gemini grounded search corroborated ${upgraded.length} blocked platform(s) via Google Search.` });
    }
  }
  if (wmnSettled.status === "fulfilled" && wmnSettled.value?.length) {
    const wmn = wmnSettled.value;
    logs.unshift({ time: nowTime(), level: "info", msg: `WhatsMyName: found ${wmn.length} candidate URLs across platforms.` });
    for (const entry of wmn.slice(0, 6)) {
      platformFindings.push({
        platform: entry.name,
        status: "open_link",
        title: `${entry.name}: ${username}`,
        url: entry.url,
        snippet: `WhatsMyName detected a public URL candidate for "${username}" on ${entry.name}.`,
        extractor: "WhatsMyName",
      });
    }
  }
  if (extraCrawlSettled.status === "fulfilled") {
    extraCrawlSettled.value.forEach((r, i) => {
      if (r.status === "fulfilled") crawledPages.push(r.value);
      else crawlErrors.push(`${urlsToFetch[i]}: ${r.reason?.message || "failed"}`);
    });
  }

  let gemini = null;
  if (geminiSettled.status === "fulfilled") {
    gemini = geminiSettled.value;
    logs.unshift({
      time:  nowTime(),
      level: gemini.enabled ? "success" : "warn",
      msg:   gemini.enabled ? "Gemini grounded web search analyzed crawler output." : gemini.summary,
    });
  } else {
    gemini = { enabled: true, summary: `Gemini search failed: ${geminiSettled.reason?.message}`, sources: [], queries: [] };
    logs.unshift({ time: nowTime(), level: "warn", msg: `Gemini search failed: ${geminiSettled.reason?.message}` });
  }

  if (crawlErrors.length)
    logs.push({ time: nowTime(), level: "warn", msg: `Crawler skipped ${crawlErrors.length} page(s) — blocked or timed out.` });

  // ── Build result ──────────────────────────────────────────────────────────
  const findings      = platformFindings;
  const foundCount    = findings.filter((f) => f.status === "found").length;
  const sourceCount   = new Set([...(gemini?.sources || []).map((s) => s.url), ...crawledPages.map((p) => p.url)]).size;
  const confidence    = Math.min(92, 35 + foundCount * 10 + Math.min(sourceCount, 8) * 5);
  const searchLinks   = buildSearchLinks(normalizedTarget, detectedType);
  const risk           = confidence >= 80 ? "critical" : confidence >= 60 ? "high" : confidence >= 35 ? "medium" : "low";
  const platforms       = [...new Set(findings.map((f) => f.platform).filter(Boolean))].slice(0, 8);

  return {
    id:        `INV-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`,
    target:    normalizedTarget,
    type:      detectedType,
    status:    "Completed",
    risk,
    platforms,
    startedAt: new Date().toISOString(),
    metadata:  baseMetadata(normalizedTarget, detectedType),
    searchLinks,
    findings,
    crawledPages,
    crawlErrors,
    gemini,
    logs,
    tools: buildToolRecommendations(detectedType),
    stats: {
      foundProfiles:     foundCount,
      candidateProfiles: findings.filter((f) => f.status === "open_link").length,
      searchLinks:       searchLinks.length,
      sources:           sourceCount,
      crawledPages:      crawledPages.length,
      confidence,
    },
  };
}
