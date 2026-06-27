// api/cloudinary-sign.js — Vercel serverless (Node 18+)
//
// Issues a short-lived, signed set of upload params so the browser can
// upload a case attachment DIRECTLY to Cloudinary without the API secret
// ever reaching the client. This is the secure alternative to an "unsigned
// upload preset" — appropriate here since attachments may be case evidence.
//
// POST /api/cloudinary-sign  { "caseId": "INV-2026-571136" }
// Returns: { signature, timestamp, apiKey, cloudName, folder }

import { createHash } from "crypto";

export const config = { maxDuration: 10 };

function ok(res, data) {
  res.setHeader("Content-Type", "application/json");
  res.status(200).json(data);
}

function err(res, msg, status = 400) {
  res.setHeader("Content-Type", "application/json");
  res.status(status).json({ error: msg });
}

export default async function handler(req, res) {
  if (req.method !== "POST") return err(res, "POST only", 405);

  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;

  if (!apiSecret || !apiKey || !cloudName) {
    return err(
      res,
      "Cloudinary is not configured on the server. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET in your environment variables (see CLOUDINARY_SETUP.md), then redeploy.",
      500
    );
  }

  let body = req.body;
  if (typeof body === "string") {
    try { body = JSON.parse(body); } catch { body = {}; }
  }

  // Sanitize caseId into a safe folder segment so attachments are organised
  // per case inside Cloudinary (oxinap_cases/<caseId>/...).
  const caseId = String(body?.caseId || "general")
    .replace(/[^a-zA-Z0-9_-]/g, "_")
    .slice(0, 80) || "general";

  const timestamp = Math.round(Date.now() / 1000);
  const folder = `oxinap_cases/${caseId}`;

  // Every param sent to Cloudinary on upload (other than file/api_key/signature
  // itself) MUST be included here, sorted alphabetically, exactly as Cloudinary
  // requires: https://cloudinary.com/documentation/signatures
  const paramsToSign = { folder, timestamp };
  const toSign = Object.keys(paramsToSign)
    .sort()
    .map((k) => `${k}=${paramsToSign[k]}`)
    .join("&");

  const signature = createHash("sha1").update(toSign + apiSecret).digest("hex");

  ok(res, { signature, timestamp, apiKey, cloudName, folder });
}
