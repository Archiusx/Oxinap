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

async function fetchJson(url, options = {}, timeoutMs = 9000) {
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

async function fetchText(url, options = {}, timeoutMs = 12000) {
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

function parseReaderDocument(text, fallbackUrl = "") {
  const title     = text.match(/^Title:\s*(.+)$/im)?.[1]?.trim() || safeUrlHost(fallbackUrl) || "Public page";
  const url       = text.match(/^URL Source:\s*(.+)$/im)?.[1]?.trim() || fallbackUrl;
  const published = text.match(/^Published Time:\s*(.+)$/im)?.[1]?.trim() || "";
  const body = text
    .replace(/^Title:.*$/gim, "")
    .replace(/^URL Source:.*$/gim, "")
    .replace(/^Published Time:.*$/gim, "");
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

  for (const query of queries) {
    try {
      const text = await fetchText(searchReaderUrlFor(query), {
        headers: { Accept: "text/plain", "X-Return-Format": "markdown", "X-Timeout": "10" },
      });
      const urls = extractUrlsFromText(text).slice(0, 5);
      results.push({
        query, title: `Search: ${query}`,
        url: searchReaderUrlFor(query),
        snippet: cleanSnippet(text, 900),
        extractor: "Jina Search",
      });
      for (const url of urls) {
        if (!results.some((item) => item.url === url))
          results.push({ title: safeUrlHost(url), url, snippet: "Discovered by public web search.", extractor: "Search result" });
      }
    } catch (error) {
      errors.push(`${query}: ${error.message}`);
    }
  }
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

  // Strategy 1 — direct page read via Jina Reader.
  try {
    const text = await fetchText(readerUrlFor(url), {
      headers: { Accept: "text/plain", "X-Return-Format": "markdown", "X-Timeout": "12" },
    });
    const followers = text.match(/(\d[\d,\.]+\s*[KkMm]?)\s*(followers|Followers)/)?.[1] || null;
    const following = text.match(/(\d[\d,\.]+\s*[KkMm]?)\s*(following|Following)/)?.[1] || null;
    const posts     = text.match(/(\d[\d,\.]+\s*[KkMm]?)\s*(posts|Posts)/)?.[1] || null;
    const bio       = text.match(/Bio[:\s]+([^\n]{5,200})/i)?.[1]?.trim() || null;
    const location  = extractSelfReportedLocation(text);
    const snippet    = cleanSnippet(text, 800);
    if (snippet.length > 100) {
      return {
        platform: "Instagram",
        status: "found",
        title: `@${username}`,
        url,
        snippet,
        metadata: {
          followers: followers || "Not public",
          following: following || "Not public",
          posts: posts || "Not public",
          bio: bio || "Not public",
          location: location || "Not listed in bio",
        },
        extractor: "Jina Reader",
      };
    }
    throw new Error("Empty/blocked response from direct page read");
  } catch (error) {
    // Strategy 2 — Instagram actively blocks most server-side readers. Fall
    // back to a public search-cache lookup (search engines index the page's
    // public meta description, which includes follower/post counts) instead
    // of just surfacing the raw HTTP error.
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
      const blocked = isBlockedError(error.message);
      return {
        platform: "Instagram",
        status: blocked ? "blocked" : "not_found",
        title: `@${username}`,
        url,
        snippet: blocked
          ? "Instagram is actively blocking automated readers for this profile (common anti-scraping response). Open the link to verify manually."
          : "No public profile data could be confirmed for this username.",
        metadata: { followers: "Not public", following: "Not public", location: "Not listed in bio" },
        extractor: "Jina Reader",
      };
    }
  }
}

async function scrapeTelegram(username) {
  // Use t.me preview — publicly accessible without login
  const url = `https://t.me/${username}`;
  try {
    const text = await fetchText(readerUrlFor(url), {
      headers: { Accept: "text/plain", "X-Return-Format": "markdown", "X-Timeout": "12" },
    });
    const members  = text.match(/(\d[\d\s,]+)\s*(members|subscribers|участников)/i)?.[1]?.trim() || null;
    const desc     = text.match(/Description[:\s]+([^\n]{5,300})/i)?.[1]?.trim() || null;
    const isGroup  = /group|channel|канал|группа/i.test(text);
    const snippet  = cleanSnippet(text, 800);
    return {
      platform: "Telegram",
      status: snippet.length > 80 ? "found" : "not_found",
      title: `@${username}`,
      url,
      snippet: snippet || "Telegram preview page crawled.",
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
    const snippet  = cleanSnippet(text, 800);
    const likes    = text.match(/(\d[\d,\.]+)\s*(people like this|likes)/i)?.[1] || null;
    const category = text.match(/Category[:\s]+([^\n]{3,80})/i)?.[1]?.trim() || null;
    return {
      platform: "Facebook",
      status: snippet.length > 80 ? "found" : "not_found",
      title: username,
      url,
      snippet: snippet || "Facebook profile/page crawled — limited public data.",
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
      const snippet = cleanSnippet(pageText, 600);
      const karma = pageText.match(/(\d[\d,]+)\s*karma/i)?.[1] || null;
      return {
        platform: "Reddit",
        status: snippet.length > 80 ? "found" : "not_found",
        title: `u/${username}`,
        url: `https://www.reddit.com/user/${username}/`,
        snippet: snippet || `Reddit profile page fetched.`,
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
  const url = NITTER_INSTANCES[0];
  let lastErr = "";
  for (const nitterUrl of NITTER_INSTANCES) {
    try {
      const text = await fetchText(readerUrlFor(nitterUrl), {
        headers: { Accept: "text/plain", "X-Return-Format": "markdown", "X-Timeout": "10" },
      });
      // Skip if we got a "Verifying your browser" or 503 page
      if (/verifying your browser|service unavailable|cloudflare/i.test(text)) {
        lastErr = "Instance returned bot-check page";
        continue;
      }
      const tweets    = text.match(/(\d[\d,]+)\s*(Tweets|tweets)/)?.[1] || null;
      const following = text.match(/(\d[\d,]+)\s*(Following|following)/)?.[1] || null;
      const followers = text.match(/(\d[\d,]+)\s*(Followers|followers)/)?.[1] || null;
      const joined    = text.match(/Joined\s+([A-Za-z]+ \d{4})/)?.[1] || null;
      const location  = extractSelfReportedLocation(text) || text.match(/📍\s*([^\n|]{2,60})/)?.[1]?.trim() || null;
      const snippet   = cleanSnippet(text, 800);
      if (snippet.length < 80) { lastErr = "Empty response"; continue; }
      return {
        platform: "Twitter / X",
        status: "found",
        title: `@${username}`,
        url: `https://x.com/${username}`,
        snippet,
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
    const snippet = cleanSnippet(text, 800);
    return {
      platform: "Twitter / X",
      status: snippet.length > 80 ? "found" : "not_found",
      title: `@${username}`,
      url: `https://x.com/${username}`,
      snippet: snippet || "Twitter/X profile crawled via fallback.",
      metadata: {},
      extractor: "X.com (Jina Reader)",
    };
  } catch (e) {
    return {
      platform: "Twitter / X",
      status: "not_found",
      title: `@${username}`,
      url: `https://x.com/${username}`,
      snippet: `Twitter/X: all instances failed. Last error: ${lastErr}`,
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
    const headline   = text.match(/Headline[:\s]+([^\n]{5,200})/i)?.[1]?.trim() || null;
    const location   = text.match(/Location[:\s]+([^\n]{3,100})/i)?.[1]?.trim() || null;
    const connections= text.match(/(\d[\d,+]+)\s*(connections|followers)/i)?.[1] || null;
    const snippet    = cleanSnippet(text, 800);
    return {
      platform: "LinkedIn",
      status: snippet.length > 80 ? "found" : "not_found",
      title: username,
      url,
      snippet: snippet || "LinkedIn public profile crawled.",
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
      status: "not_found",
      title: username,
      url,
      snippet: `LinkedIn crawler failed: ${error.message}`,
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
    const followers = text.match(/(\d[\d,\.KkMm]+)\s*(Followers|followers)/)?.[1] || null;
    const likes     = text.match(/(\d[\d,\.KkMm]+)\s*(Likes|likes)/)?.[1] || null;
    const snippet   = cleanSnippet(text, 800);
    return {
      platform: "TikTok",
      status: snippet.length > 80 ? "found" : "not_found",
      title: `@${username}`,
      url,
      snippet: snippet || "TikTok profile crawled.",
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
  const followers    = takeFirst(FOLLOWER_KEYS);
  const following     = takeFirst(FOLLOWING_KEYS);
  const location       = takeFirst(LOCATION_KEYS) || (m.location !== undefined ? m.location : null);
  if (m.location !== undefined) used.add("location");

  const other = Object.entries(m)
    .filter(([k, v]) => !used.has(k) && v && v !== "Not public")
    .map(([k, v]) => ({ label: humanizeKey(k), value: String(v) }))
    .slice(0, 4);

  return {
    username: username || "Not public",
    createdDate: createdDate || "Not public",
    followers: followers || "Not public",
    following: following || "Not public",
    location: location || "Not listed publicly",
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
    20000
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

  // ── Platform scrapers (run in parallel for speed) ─────────────────────────
  const platformFindings = [];
  if (username) {
    const [gh, ig, tg, fb, rd, tw, li, tt] = await Promise.allSettled([
      githubLookup(username),
      scrapeInstagram(username),
      scrapeTelegram(username),
      scrapeFacebook(username),
      scrapeReddit(username),
      scrapeTwitterX(username),
      scrapeLinkedIn(username),
      scrapeTikTok(username),
    ]);

    const scraped = [
      gh.value, ig.value, tg.value, fb.value,
      rd.value, tw.value, li.value, tt.value,
    ].filter(Boolean);

    for (const r of scraped) {
      platformFindings.push(r);
      if (r.status === "found") {
        logs.unshift({ time: nowTime(), level: "success", msg: `${r.platform}: auto-scraped — ${r.snippet.slice(0, 80)}…` });
      } else if (r.status === "blocked") {
        logs.unshift({ time: nowTime(), level: "warn", msg: `${r.platform}: blocked the automated reader — open the link to verify manually.` });
      } else {
        logs.push({ time: nowTime(), level: "warn", msg: `${r.platform}: no public data confirmed for this username.` });
      }
    }

    // WhatsMyName cross-check
    try {
      const wmn = await whatsmynameLookup(username);
      if (wmn.length) {
        logs.unshift({ time: nowTime(), level: "info", msg: `WhatsMyName: found ${wmn.length} candidate URLs across platforms.` });
        // Add as crawled pages
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
    } catch { /* silent */ }
  }

  // ── Web crawl + search ────────────────────────────────────────────────────
  const crawledPages = [];
  const crawlErrors  = [];

  if ((detectedType === "profile" || detectedType === "image") && isPublicHttpUrl(normalizedTarget)) {
    try {
      crawledPages.push(await scrapePublicUrl(normalizedTarget));
      logs.unshift({ time: nowTime(), level: "success", msg: "Fetched the submitted public URL with the page reader." });
    } catch (error) {
      crawlErrors.push(`${normalizedTarget}: ${error.message}`);
      logs.unshift({ time: nowTime(), level: "warn", msg: `Submitted URL crawler failed: ${error.message}` });
    }
  }

  try {
    const webSearch = await runPublicReaderSearch(normalizedTarget, detectedType);
    crawledPages.push(...webSearch.results);
    crawlErrors.push(...webSearch.errors);
    if (webSearch.results.length)
      logs.unshift({ time: nowTime(), level: "success", msg: `Public web search collected ${webSearch.results.length} readable result(s).` });
  } catch (error) {
    crawlErrors.push(error.message);
    logs.unshift({ time: nowTime(), level: "warn", msg: `Web search failed: ${error.message}` });
  }

  const uniqueUrls = [...new Set(crawledPages.map((p) => p.url).filter(isPublicHttpUrl))].slice(0, 4);
  for (const url of uniqueUrls) {
    if (crawledPages.some((p) => p.url === url && p.extractor === "Jina Reader")) continue;
    try { crawledPages.push(await scrapePublicUrl(url)); } catch (e) { crawlErrors.push(`${url}: ${e.message}`); }
  }

  // ── Gemini grounded search ─────────────────────────────────────────────────
  let gemini = null;
  try {
    gemini = await runGeminiGroundedSearch(normalizedTarget, detectedType, crawledPages);
    logs.unshift({
      time:  nowTime(),
      level: gemini.enabled ? "success" : "warn",
      msg:   gemini.enabled ? "Gemini grounded web search analyzed crawler output." : gemini.summary,
    });
  } catch (error) {
    gemini = { enabled: true, summary: `Gemini search failed: ${error.message}`, sources: [], queries: [] };
    logs.unshift({ time: nowTime(), level: "warn", msg: `Gemini search failed: ${error.message}` });
  }

  if (gemini?.sources?.length) {
    const geminiUrls = [...new Set(gemini.sources.map((s) => s.url).filter(isPublicHttpUrl))].slice(0, 5);
    for (const url of geminiUrls) {
      if (crawledPages.some((p) => p.url === url)) continue;
      try { crawledPages.push(await scrapePublicUrl(url)); } catch (e) { crawlErrors.push(`${url}: ${e.message}`); }
    }
  }

  if (getGeminiApiKey() && crawledPages.length) {
    try {
      const crawlSummary = await summarizeWithGemini(normalizedTarget, detectedType, crawledPages);
      if (crawlSummary?.summary) {
        gemini = {
          ...gemini,
          summary: `${gemini?.summary || ""}\n\n---\nCrawler synthesis:\n${crawlSummary.summary}`.trim(),
          sources: [...(gemini?.sources || []), ...(crawlSummary.sources || [])],
        };
      }
    } catch (error) {
      logs.unshift({ time: nowTime(), level: "warn", msg: `Gemini crawler synthesis failed: ${error.message}` });
    }
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
