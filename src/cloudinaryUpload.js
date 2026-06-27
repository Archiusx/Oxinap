// src/cloudinaryUpload.js
//
// Uploads a case attachment (image, PDF, document, etc.) straight from the
// browser to Cloudinary, using a short-lived signature minted by our own
// /api/cloudinary-sign serverless function. The Cloudinary API secret never
// touches the browser — only a one-time signature that's valid for this
// single upload.

const MAX_FILE_BYTES = 25 * 1024 * 1024; // 25 MB — adjust to taste

export async function uploadAttachmentToCloudinary(file, caseId, onProgress) {
  if (!file) throw new Error("No file selected.");
  if (file.size > MAX_FILE_BYTES) {
    throw new Error(`File is too large (${(file.size / (1024 * 1024)).toFixed(1)} MB). Max is ${MAX_FILE_BYTES / (1024 * 1024)} MB.`);
  }

  // 1) Ask our backend for a signed set of upload params for this case.
  const signRes = await fetch("/api/cloudinary-sign", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ caseId }),
  });

  if (!signRes.ok) {
    const body = await signRes.json().catch(() => ({}));
    throw new Error(body.error || "Could not get an upload signature from the server.");
  }

  const { signature, timestamp, apiKey, cloudName, folder } = await signRes.json();

  // 2) Upload directly to Cloudinary using those signed params.
  const form = new FormData();
  form.append("file", file);
  form.append("api_key", apiKey);
  form.append("timestamp", timestamp);
  form.append("signature", signature);
  form.append("folder", folder);

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`);

    xhr.upload.onprogress = (e) => {
      if (onProgress && e.lengthComputable) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    };

    xhr.onload = () => {
      let data;
      try {
        data = JSON.parse(xhr.responseText);
      } catch {
        reject(new Error("Unexpected response from Cloudinary."));
        return;
      }
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve({
          url: data.secure_url,
          publicId: data.public_id,
          resourceType: data.resource_type, // "image" | "video" | "raw"
          format: data.format,
          bytes: data.bytes,
          originalFilename: data.original_filename,
        });
      } else {
        reject(new Error(data?.error?.message || "Cloudinary upload failed."));
      }
    };

    xhr.onerror = () => reject(new Error("Network error while uploading to Cloudinary."));
    xhr.send(form);
  });
}
