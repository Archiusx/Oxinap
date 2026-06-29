// api/image-proxy.js
// Proxies external profile images (Instagram, LinkedIn, GitHub, etc.)
// to bypass browser CORS restrictions. Only allows image content-types.

const ALLOWED_HOSTS = [
  "cdninstagram.com",
  "instagram.com",
  "scontent",           // Instagram CDN subdomains
  "licdn.com",          // LinkedIn
  "media.licdn.com",
  "avatars.githubusercontent.com",
  "githubusercontent.com",
  "lh3.googleusercontent.com",
  "googleusercontent.com",
  "pbs.twimg.com",      // Twitter/X
  "abs.twimg.com",
  "platform-lookaside.fbsbx.com", // Facebook
  "graph.facebook.com",
  "epieos.com",
  "gravatar.com",
  "secure.gravatar.com",
  "unavatar.io",
];

function isAllowed(urlStr) {
  try {
    const u = new URL(urlStr);
    return (
      (u.protocol === "https:" || u.protocol === "http:") &&
      ALLOWED_HOSTS.some(h => u.hostname === h || u.hostname.endsWith("." + h))
    );
  } catch {
    return false;
  }
}

export default async function handler(req, res) {
  const { url } = req.query;

  if (!url) {
    return res.status(400).json({ error: "Missing url param" });
  }

  if (!isAllowed(url)) {
    return res.status(403).json({ error: "Host not allowed" });
  }

  try {
    const upstream = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "Accept": "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
        "Referer": "https://www.google.com/",
      },
      redirect: "follow",
    });

    const contentType = upstream.headers.get("content-type") || "";
    if (!contentType.startsWith("image/")) {
      return res.status(415).json({ error: "Not an image" });
    }

    const buffer = await upstream.arrayBuffer();

    res.setHeader("Content-Type", contentType);
    res.setHeader("Cache-Control", "public, max-age=86400, stale-while-revalidate=604800");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.status(200).send(Buffer.from(buffer));
  } catch (err) {
    res.status(502).json({ error: "Proxy fetch failed", detail: err.message });
  }
}
