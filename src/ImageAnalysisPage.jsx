import { useState, useEffect, useRef, useCallback } from "react";

// ──────────────────────────────────────────────────────────────────────────
// Image Analysis — standalone tab.
// NOT connected to investigations/suspects. Purely "what is in this photo":
// OCR text, detected objects/scenes, embedded EXIF metadata, and a best-guess
// language for any extracted text. Images are kept in the browser only
// (IndexedDB), never uploaded anywhere or linked to a case.
//
// Libraries are loaded lazily from a CDN (esm.sh) on first use so the rest
// of the app's bundle / npm install stays untouched. Everything runs
// client-side — no API keys, no servers.
// ──────────────────────────────────────────────────────────────────────────

const DB_NAME = "oxinap-image-analysis";
const STORE_NAME = "images";
const DB_VERSION = 1;

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbPut(record) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).put(record);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function idbGetAll() {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const req = tx.objectStore(STORE_NAME).getAll();
    req.onsuccess = () => resolve((req.result || []).sort((a, b) => b.createdAt - a.createdAt));
    req.onerror = () => reject(req.error);
  });
}

async function idbDelete(id) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// ── Lazy CDN module loaders (cached on window so we only fetch once) ──
async function loadTesseract() {
  if (!window.__oxinapTesseract) {
    window.__oxinapTesseract = await import(/* @vite-ignore */ "https://esm.sh/tesseract.js@5.1.0");
  }
  return window.__oxinapTesseract;
}
async function loadExifr() {
  if (!window.__oxinapExifr) {
    window.__oxinapExifr = await import(/* @vite-ignore */ "https://esm.sh/exifr@7.1.3");
  }
  return window.__oxinapExifr;
}
async function loadTfAndCoco() {
  if (!window.__oxinapCoco) {
    const tf = await import(/* @vite-ignore */ "https://esm.sh/@tensorflow/tfjs@4.20.0");
    const coco = await import(/* @vite-ignore */ "https://esm.sh/@tensorflow-models/coco-ssd@2.2.3?deps=@tensorflow/tfjs@4.20.0");
    const model = await coco.load();
    window.__oxinapCoco = { tf, model };
  }
  return window.__oxinapCoco;
}

// Very small script-based language heuristic — no network call, no API key.
function detectLanguage(text) {
  const clean = (text || "").trim();
  if (!clean) return null;
  const scripts = [
    { name: "Hindi / Devanagari", re: /[\u0900-\u097F]/ },
    { name: "Arabic", re: /[\u0600-\u06FF]/ },
    { name: "Chinese", re: /[\u4E00-\u9FFF]/ },
    { name: "Japanese", re: /[\u3040-\u30FF]/ },
    { name: "Korean", re: /[\uAC00-\uD7AF]/ },
    { name: "Cyrillic (Russian etc.)", re: /[\u0400-\u04FF]/ },
    { name: "Tamil", re: /[\u0B80-\u0BFF]/ },
    { name: "Bengali", re: /[\u0980-\u09FF]/ },
    { name: "Greek", re: /[\u0370-\u03FF]/ },
  ];
  for (const s of scripts) if (s.re.test(clean)) return s.name;
  if (/^[\x00-\x7F\s.,!?'"()\-:;]+$/.test(clean)) return "Latin script (likely English)";
  return "Unknown / mixed script";
}

function fmtBytes(n) {
  if (!n) return "—";
  const u = ["B", "KB", "MB", "GB"];
  let i = 0;
  while (n >= 1024 && i < u.length - 1) { n /= 1024; i++; }
  return `${n.toFixed(1)} ${u[i]}`;
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

export default function ImageAnalysisPage() {
  const [records, setRecords] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState("");
  const [error, setError] = useState("");
  const fileInputRef = useRef(null);

  const refresh = useCallback(async () => {
    try {
      const items = await idbGetAll();
      setRecords(items);
      if (!selectedId && items.length) setSelectedId(items[0].id);
    } catch (e) {
      console.error("[ImageAnalysis] load failed", e);
    }
  }, [selectedId]);

  useEffect(() => { refresh(); }, []); // eslint-disable-line

  const handleFiles = async (fileList) => {
    const files = Array.from(fileList || []).filter((f) => f.type.startsWith("image/"));
    if (!files.length) return;
    setError("");
    for (const file of files) {
      await analyzeAndStore(file);
    }
    await refresh();
  };

  const analyzeAndStore = async (file) => {
    setBusy(true);
    const id = `img_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    try {
      const dataUrl = await fileToDataUrl(file);

      setStage("Reading EXIF metadata…");
      let exif = null;
      try {
        const exifr = await loadExifr();
        exif = await exifr.parse(file, { gps: true, tiff: true, exif: true, translateValues: true });
      } catch (e) {
        console.warn("[ImageAnalysis] EXIF parse failed", e);
      }

      setStage("Running OCR (text extraction)…");
      let ocrText = "";
      try {
        const { recognize } = await loadTesseract();
        const result = await recognize(dataUrl, "eng");
        ocrText = (result?.data?.text || "").trim();
      } catch (e) {
        console.warn("[ImageAnalysis] OCR failed", e);
      }

      setStage("Detecting objects / landmarks…");
      let objects = [];
      try {
        const { model } = await loadTfAndCoco();
        const img = await loadImageEl(dataUrl);
        const preds = await model.detect(img);
        objects = (preds || [])
          .map((p) => ({ label: p.class, score: Math.round(p.score * 100) }))
          .sort((a, b) => b.score - a.score);
      } catch (e) {
        console.warn("[ImageAnalysis] object detection failed", e);
      }

      const language = detectLanguage(ocrText);

      const record = {
        id,
        name: file.name,
        size: file.size,
        type: file.type,
        dataUrl,
        createdAt: Date.now(),
        ocrText,
        language,
        objects,
        exif: exif ? sanitizeExif(exif) : null,
      };
      await idbPut(record);
      setSelectedId(id);
    } catch (e) {
      console.error("[ImageAnalysis] analysis failed", e);
      setError(e.message || "Analysis failed for one of the images.");
    } finally {
      setBusy(false);
      setStage("");
    }
  };

  const handleDelete = async (id) => {
    await idbDelete(id);
    if (selectedId === id) setSelectedId(null);
    refresh();
  };

  const selected = records.find((r) => r.id === selectedId) || null;

  return (
    <div className="p-4 md:p-6 space-y-5" style={{ maxWidth: 1200, margin: "0 auto" }}>
      <div>
        <h2 className="text-lg font-bold text-slate-800">Image Analysis</h2>
        <p className="text-sm text-slate-500 mt-0.5">
          Standalone tool — analyzes what's in a photo (text, objects/landmarks, embedded
          metadata, language). Not linked to investigations or suspects. Images are stored only
          in this browser (IndexedDB) and never uploaded anywhere.
        </p>
      </div>

      {/* Upload zone */}
      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => { e.preventDefault(); handleFiles(e.dataTransfer.files); }}
        onClick={() => fileInputRef.current?.click()}
        className="rounded-xl border-2 border-dashed border-slate-300 hover:border-blue-400 transition-colors cursor-pointer flex flex-col items-center justify-center text-center py-10 px-4 bg-white"
      >
        <div className="text-sm font-medium text-slate-700">Drop an image here, or click to upload</div>
        <div className="text-xs text-slate-400 mt-1">JPG, PNG, WEBP — processed entirely in your browser</div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
      </div>

      {busy && (
        <div className="rounded-lg bg-blue-50 border border-blue-200 text-blue-700 text-xs px-3 py-2 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
          {stage || "Analyzing…"}
        </div>
      )}
      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 text-red-600 text-xs px-3 py-2">{error}</div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* List */}
        <div className="lg:col-span-1 rounded-xl border border-slate-200 bg-white overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 text-xs font-semibold text-slate-600">
            Analyzed images ({records.length})
          </div>
          <div className="max-h-[520px] overflow-y-auto divide-y divide-slate-100">
            {records.length === 0 && (
              <div className="text-center text-xs text-slate-400 py-8">No images analyzed yet.</div>
            )}
            {records.map((r) => (
              <button
                key={r.id}
                onClick={() => setSelectedId(r.id)}
                className={`w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-slate-50 ${selectedId === r.id ? "bg-blue-50" : ""}`}
              >
                <img src={r.dataUrl} alt="" className="w-10 h-10 rounded object-cover flex-shrink-0 border border-slate-200" />
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-medium text-slate-700 truncate">{r.name}</div>
                  <div className="text-[10px] text-slate-400">{fmtBytes(r.size)} · {new Date(r.createdAt).toLocaleString()}</div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Detail */}
        <div className="lg:col-span-2 rounded-xl border border-slate-200 bg-white p-4">
          {!selected && <div className="text-center text-sm text-slate-400 py-16">Select an image to see its analysis.</div>}
          {selected && (
            <div className="space-y-5">
              <div className="flex items-start gap-4">
                <img src={selected.dataUrl} alt="" className="w-32 h-32 rounded-lg object-cover border border-slate-200 flex-shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold text-slate-800 truncate">{selected.name}</div>
                  <div className="text-xs text-slate-400 mt-0.5">{selected.type} · {fmtBytes(selected.size)}</div>
                  <button
                    onClick={() => handleDelete(selected.id)}
                    className="mt-3 text-xs text-red-500 hover:text-red-600 font-medium"
                  >
                    Delete from this browser
                  </button>
                </div>
              </div>

              <Section title="Extracted text (OCR)">
                {selected.ocrText ? (
                  <pre className="whitespace-pre-wrap text-xs text-slate-700 bg-slate-50 rounded-lg p-3 max-h-48 overflow-y-auto">{selected.ocrText}</pre>
                ) : (
                  <div className="text-xs text-slate-400">No text detected.</div>
                )}
              </Section>

              <Section title="Detected language">
                <div className="text-xs text-slate-700">{selected.language || "—"}</div>
              </Section>

              <Section title="Detected objects / scene elements">
                {selected.objects?.length ? (
                  <div className="flex flex-wrap gap-1.5">
                    {selected.objects.map((o, i) => (
                      <span key={i} className="px-2 py-1 rounded-full bg-indigo-50 text-indigo-700 text-[11px] font-medium">
                        {o.label} <span className="text-indigo-400">{o.score}%</span>
                      </span>
                    ))}
                  </div>
                ) : (
                  <div className="text-xs text-slate-400">Nothing recognized.</div>
                )}
              </Section>

              <Section title="EXIF / embedded metadata">
                {selected.exif ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
                    {Object.entries(selected.exif).map(([k, v]) => (
                      <div key={k} className="flex justify-between gap-2 border-b border-slate-50 py-1">
                        <span className="text-slate-400">{k}</span>
                        <span className="text-slate-700 font-medium text-right truncate">{String(v)}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-xs text-slate-400">No EXIF metadata found (often stripped by messaging apps / social platforms).</div>
                )}
              </Section>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div>
      <div className="text-xs font-semibold text-slate-600 mb-1.5">{title}</div>
      {children}
    </div>
  );
}

function loadImageEl(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

// Keep only human-readable, non-bulky EXIF fields (drop thumbnails/binary blobs).
function sanitizeExif(exif) {
  const out = {};
  const allow = [
    "Make", "Model", "Software", "DateTimeOriginal", "CreateDate", "ModifyDate",
    "ImageWidth", "ImageHeight", "Orientation", "ISO", "FNumber", "ExposureTime",
    "FocalLength", "LensModel", "GPSLatitude", "GPSLongitude", "GPSAltitude",
  ];
  for (const k of allow) {
    if (exif[k] !== undefined && exif[k] !== null) {
      out[k] = typeof exif[k] === "number" ? Math.round(exif[k] * 1000) / 1000 : exif[k];
    }
  }
  return Object.keys(out).length ? out : null;
}
