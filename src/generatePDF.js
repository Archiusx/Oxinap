/**
 * generatePDF.js — Real PDF export for Oxinap OSINT Dashboard
 * Uses jsPDF (loaded dynamically from CDN) to produce a multi-section report.
 */

// ── Helpers ──────────────────────────────────────────────────────────────────

function loadScript(src) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) { resolve(); return; }
    const s = document.createElement("script");
    s.src = src;
    s.onload = resolve;
    s.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.head.appendChild(s);
  });
}

async function ensureJsPDF() {
  if (window.jspdf?.jsPDF) return window.jspdf.jsPDF;
  await loadScript("https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js");
  if (!window.jspdf?.jsPDF) throw new Error("jsPDF failed to initialise");
  return window.jspdf.jsPDF;
}

// Colours
const C = {
  navy:     [15,  23,  42],
  blue:     [37,  99, 235],
  blueLight:[239, 246, 255],
  slate:    [100, 116, 139],
  slateLight:[248, 250, 252],
  white:    [255, 255, 255],
  border:   [226, 232, 240],
  green:    [34,  197,  94],
  orange:   [249, 115,  22],
  red:      [220,  38,  38],
  amber:    [217, 119,   6],
  text:     [30,  41,  59],
  textSec:  [71,  85, 105],
};

const RISK_COLOR = {
  critical: [220,  38,  38],
  high:     [234,  88,  12],
  medium:   [217, 119,   6],
  low:      [22, 163,  74],
};

// ── Low-level drawing helpers ─────────────────────────────────────────────────

function setFill(doc, rgb)   { doc.setFillColor(...rgb); }
function setDraw(doc, rgb)   { doc.setDrawColor(...rgb); }
function setFont(doc, rgb)   { doc.setTextColor(...rgb); }

function rect(doc, x, y, w, h, rgb, rounding = 0) {
  setFill(doc, rgb);
  doc.roundedRect(x, y, w, h, rounding, rounding, "F");
}

function line(doc, x1, y1, x2, y2, rgb, width = 0.3) {
  setDraw(doc, rgb);
  doc.setLineWidth(width);
  doc.line(x1, y1, x2, y2);
}

function text(doc, str, x, y, opts = {}) {
  const { size = 9, color = C.text, bold = false, align = "left" } = opts;
  doc.setFontSize(size);
  doc.setFont("helvetica", bold ? "bold" : "normal");
  setFont(doc, color);
  doc.text(String(str ?? ""), x, y, { align });
}

function wrap(doc, str, x, y, maxW, lineH, opts = {}) {
  const { size = 9, color = C.text, bold = false } = opts;
  doc.setFontSize(size);
  doc.setFont("helvetica", bold ? "bold" : "normal");
  setFont(doc, color);
  const lines = doc.splitTextToSize(String(str ?? "—"), maxW);
  doc.text(lines, x, y);
  return lines.length * lineH;
}

// ── Page scaffolding ──────────────────────────────────────────────────────────

const PW  = 210; // A4 width mm
const PH  = 297; // A4 height mm
const M   = 16;  // margin
const CW  = PW - M * 2; // content width
const HDR = 12;  // header height
const FTR = 10;  // footer height

function addPageHeader(doc, caseId, pageNum) {
  rect(doc, 0, 0, PW, HDR, C.navy);
  text(doc, "OXINAP — OSINT Intelligence Report", M, 8, { size: 7, color: C.white, bold: true });
  text(doc, `Case ${caseId}  |  Page ${pageNum}`, PW - M, 8, { size: 7, color: C.slate, align: "right" });
}

function addPageFooter(doc, exportTs) {
  line(doc, M, PH - FTR, PW - M, PH - FTR, C.border);
  text(doc, "CONFIDENTIAL — For authorised personnel only", M, PH - 4, { size: 6.5, color: C.slate });
  text(doc, `Exported: ${exportTs}`, PW - M, PH - 4, { size: 6.5, color: C.slate, align: "right" });
}

function sectionTitle(doc, title, y) {
  rect(doc, M, y, CW, 8, C.blueLight, 2);
  line(doc, M, y, M + 3, y, C.blue, 1.2);
  text(doc, title.toUpperCase(), M + 6, y + 5.5, { size: 8, color: C.blue, bold: true });
  return y + 12;
}

function kv(doc, label, value, x, y, labelW = 38) {
  text(doc, label, x, y, { size: 8, color: C.slate });
  text(doc, value || "—", x + labelW, y, { size: 8, color: C.text, bold: true });
  return y + 6;
}

function riskBadge(doc, risk, x, y) {
  const color = RISK_COLOR[risk] || C.slate;
  rect(doc, x, y - 4, 22, 5.5, color, 1.5);
  text(doc, (risk || "—").toUpperCase(), x + 11, y, { size: 6.5, color: C.white, bold: true, align: "center" });
}

function pill(doc, label, x, y, bg = C.slateLight, fg = C.textSec) {
  const w = label.length * 1.8 + 6;
  rect(doc, x, y - 3.5, w, 5.5, bg, 1.5);
  text(doc, label, x + w / 2, y, { size: 6.5, color: fg, align: "center" });
  return x + w + 2;
}

// ── Table helper ──────────────────────────────────────────────────────────────

function table(doc, headers, rows, startY, colWidths) {
  const rowH   = 7;
  const totalW = colWidths.reduce((a, b) => a + b, 0);
  let y = startY;

  // Header row
  rect(doc, M, y, totalW, rowH, C.navy, 1);
  let cx = M + 2;
  headers.forEach((h, i) => {
    text(doc, h, cx, y + 4.8, { size: 7, color: C.white, bold: true });
    cx += colWidths[i];
  });
  y += rowH;

  // Data rows
  rows.forEach((row, ri) => {
    const bg = ri % 2 === 0 ? C.white : C.slateLight;
    rect(doc, M, y, totalW, rowH, bg);
    line(doc, M, y, M + totalW, y, C.border, 0.2);
    cx = M + 2;
    row.forEach((cell, ci) => {
      const cellStr = String(cell ?? "—");
      const maxChars = Math.floor(colWidths[ci] / 1.8);
      const display = cellStr.length > maxChars ? cellStr.slice(0, maxChars - 1) + "…" : cellStr;
      text(doc, display, cx, y + 4.8, { size: 7, color: C.text });
      cx += colWidths[ci];
    });
    y += rowH;
  });

  // Bottom border
  line(doc, M, y, M + totalW, y, C.border, 0.4);
  return y + 4;
}

// Bar chart (horizontal)
function barChart(doc, items, x, y, maxW, barH = 5) {
  const maxVal = Math.max(...items.map(i => i.count), 1);
  items.slice(0, 10).forEach((item) => {
    const pct = item.count / maxVal;
    const label = String(item.name || "—").slice(0, 18);
    text(doc, label, x, y + barH - 1, { size: 7, color: C.textSec });
    const bx = x + 42;
    const bw = (maxW - 42) * pct;
    rect(doc, bx, y, Math.max(bw, 1), barH, C.blue, 1);
    text(doc, String(item.count), bx + (maxW - 42) + 2, y + barH - 1, { size: 6.5, color: C.slate });
    y += barH + 3;
  });
  return y;
}

// Risk donut (simple arc approximation via polygon)
function riskGauge(doc, score, cx, cy, r) {
  // Background circle
  setDraw(doc, C.border);
  setFill(doc, C.white);
  doc.setLineWidth(0.3);
  doc.circle(cx, cy, r, "S");

  // Filled arc (approximated with a filled polygon)
  const pct = Math.min(score / 100, 1);
  const steps = Math.round(pct * 60);
  if (steps > 0) {
    const color = score >= 70 ? C.red : score >= 40 ? C.orange : C.green;
    setFill(doc, color);
    const pts = [[cx, cy]];
    for (let i = 0; i <= steps; i++) {
      const angle = (Math.PI * 2 * (i / 60)) - Math.PI / 2;
      pts.push([cx + r * Math.cos(angle), cy + r * Math.sin(angle)]);
    }
    doc.setFillColor(...color);
    doc.moveTo(pts[0][0], pts[0][1]);
    pts.slice(1).forEach(([px, py]) => doc.lineTo(px, py));
    doc.fill();
  }

  // Inner white circle (donut hole)
  setFill(doc, C.white);
  doc.circle(cx, cy, r * 0.62, "F");

  // Score text
  text(doc, String(score), cx, cy + 2, { size: 10, color: C.text, bold: true, align: "center" });
  text(doc, "/100", cx, cy + 6.5, { size: 6, color: C.slate, align: "center" });
}

// ── Page management ───────────────────────────────────────────────────────────

function newPage(doc, state) {
  doc.addPage();
  state.page++;
  addPageHeader(doc, state.caseId, state.page);
  addPageFooter(doc, state.exportTs);
  return HDR + 6;
}

function checkY(doc, state, y, needed = 20) {
  if (y + needed > PH - FTR - 6) {
    return newPage(doc, state);
  }
  return y;
}

// ── Section renderers ─────────────────────────────────────────────────────────

function renderCover(doc, inv, exportTs) {
  // Dark background
  rect(doc, 0, 0, PW, PH, C.navy);

  // Top accent bar
  rect(doc, 0, 0, PW, 6, C.blue);

  // Logo area
  rect(doc, M, 28, 50, 14, [25, 40, 70], 2);
  text(doc, "OXINAP", M + 25, 37, { size: 11, color: C.white, bold: true, align: "center" });

  // Title block
  text(doc, "OSINT INTELLIGENCE", M, 62, { size: 20, color: C.white, bold: true });
  text(doc, "INVESTIGATION REPORT", M, 74, { size: 20, color: [96, 165, 250], bold: true });

  // Divider
  rect(doc, M, 80, CW, 1, C.blue);

  // Case meta
  const risk = (inv.risk || "low").toUpperCase();
  const rColor = RISK_COLOR[inv.risk] || C.slate;

  const metaItems = [
    ["CASE ID",       inv.id || "—"],
    ["TARGET",        inv.target || "—"],
    ["INVESTIGATION TYPE", (inv.type || "—").toUpperCase()],
    ["RISK LEVEL",    risk],
    ["OPENED",        inv.startedAt ? new Date(inv.startedAt).toLocaleDateString() : "—"],
    ["EXPORTED",      exportTs],
  ];

  let my = 96;
  metaItems.forEach(([label, value]) => {
    text(doc, label, M, my, { size: 7.5, color: [148, 163, 184] });
    if (label === "RISK LEVEL") {
      rect(doc, M + 68, my - 4.5, 28, 6.5, rColor, 2);
      text(doc, value, M + 82, my, { size: 7.5, color: C.white, bold: true, align: "center" });
    } else {
      text(doc, value, M + 68, my, { size: 7.5, color: C.white, bold: true });
    }
    my += 9;
  });

  // Stats grid
  const stats = inv.stats || {};
  const findings = inv.findings || [];
  const confirmed = findings.filter(f => f.status === "found");
  const candidates = findings.filter(f => f.status === "open_link");

  const statItems = [
    { label: "Confirmed\nAccounts",   value: String(confirmed.length) },
    { label: "Platforms\nIdentified", value: String(inv.platforms?.length || 0) },
    { label: "Confidence\nScore",     value: `${stats.confidence || 0}%` },
    { label: "Evidence\nItems",       value: String(confirmed.length + candidates.length) },
  ];

  const boxW = (CW - 6) / 4;
  let bx = M;
  statItems.forEach(({ label, value }) => {
    rect(doc, bx, 185, boxW, 28, [25, 40, 70], 3);
    text(doc, value, bx + boxW / 2, 199, { size: 13, color: C.white, bold: true, align: "center" });
    label.split("\n").forEach((l, i) => {
      text(doc, l, bx + boxW / 2, 206 + i * 5, { size: 6.5, color: [148, 163, 184], align: "center" });
    });
    bx += boxW + 2;
  });

  // Classification banner
  rect(doc, M, 232, CW, 10, [30, 20, 50], 2);
  text(doc, "⚠  CONFIDENTIAL — FOR AUTHORISED PERSONNEL ONLY  ⚠", PW / 2, 238.5, { size: 7.5, color: [248, 113, 113], bold: true, align: "center" });

  // Footer
  text(doc, "Generated by Oxinap OSINT Platform", PW / 2, PH - 14, { size: 7, color: [71, 85, 105], align: "center" });
  text(doc, exportTs, PW / 2, PH - 8, { size: 6.5, color: [71, 85, 105], align: "center" });
}

function renderSubjectOverview(doc, inv, state) {
  let y = newPage(doc, state);
  y = sectionTitle(doc, "1. Subject Overview", y);

  const stats    = inv.stats || {};
  const findings = inv.findings || [];
  const confirmed = findings.filter(f => f.status === "found");

  // Two-column info grid
  const col2 = M + CW / 2 + 4;

  y = kv(doc, "Case ID:",         inv.id || "—",               M, y);
  y = kv(doc, "Target:",          inv.target || "—",            M, y);
  y = kv(doc, "Type:",            inv.type || "—",              M, y);
  y = kv(doc, "Status:",          inv.status || "active",       M, y);
  y = kv(doc, "Platforms Found:", String(inv.platforms?.length || 0), M, y);
  y = kv(doc, "Confidence:",      `${stats.confidence || 0}%`,  M, y);
  y += 4;

  // Risk indicator
  const riskScore = { critical: 92, high: 70, medium: 48, low: 20 }[inv.risk] ?? (stats.confidence || 0);
  riskGauge(doc, riskScore, PW - M - 22, HDR + 42, 18);
  text(doc, "Risk Score", PW - M - 22, HDR + 64, { size: 7, color: C.slate, align: "center" });
  riskBadge(doc, inv.risk, PW - M - 44, HDR + 72);

  // Gemini summary
  if (inv.gemini?.summary) {
    y = checkY(doc, state, y, 24);
    rect(doc, M, y, CW, 5, C.blueLight, 1);
    text(doc, "AI Summary", M + 3, y + 3.5, { size: 7, color: C.blue, bold: true });
    y += 7;
    const lines = doc.setFontSize(8) || doc.splitTextToSize(inv.gemini.summary, CW - 4);
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    setFont(doc, C.textSec);
    const split = doc.splitTextToSize(inv.gemini.summary, CW - 4);
    const needed = split.length * 5;
    y = checkY(doc, state, y, needed + 6);
    doc.text(split, M + 2, y);
    y += needed + 4;
  }

  // Platforms list
  if (inv.platforms?.length) {
    y = checkY(doc, state, y, 16);
    text(doc, "Platforms Identified:", M, y, { size: 8, color: C.text, bold: true });
    y += 5;
    let px = M;
    inv.platforms.forEach(p => {
      const label = String(p).slice(0, 16);
      const w = label.length * 1.9 + 8;
      if (px + w > PW - M) { y += 7; px = M; }
      pill(doc, label, px, y, C.blueLight, C.blue);
      px += w + 3;
    });
    y += 9;
  }

  return y;
}

function renderAccountSummary(doc, inv, state) {
  let y = checkY(doc, state, state._y, 40);
  y = sectionTitle(doc, "2. Account Summary", y);

  const findings  = inv.findings || [];
  const confirmed = findings.filter(f => f.status === "found");
  const candidates= findings.filter(f => f.status === "open_link");
  const stats     = inv.stats || {};

  // Summary stats row
  const boxes = [
    { label: "Total Findings",   value: findings.length,    color: C.blue },
    { label: "Confirmed",        value: confirmed.length,   color: C.green },
    { label: "Candidates",       value: candidates.length,  color: C.orange },
    { label: "Sources Crawled",  value: stats.sources || 0, color: [139, 92, 246] },
  ];
  const bw = (CW - 6) / 4;
  let bx = M;
  boxes.forEach(({ label, value, color }) => {
    rect(doc, bx, y, bw, 16, [color[0], color[1], color[2], 0.08], 2);
    // Lighter tinted box
    doc.setFillColor(color[0], color[1], color[2]);
    doc.setGState && doc.setGState(doc.GState({ opacity: 0.08 }));
    rect(doc, bx, y, bw, 16, [...color], 2);
    text(doc, String(value), bx + bw / 2, y + 8, { size: 12, color, bold: true, align: "center" });
    text(doc, label, bx + bw / 2, y + 13.5, { size: 6, color: C.slate, align: "center" });
    bx += bw + 2;
  });
  y += 22;

  // Confirmed accounts table
  if (confirmed.length) {
    y = checkY(doc, state, y, 20);
    text(doc, "Confirmed Accounts", M, y, { size: 8, color: C.text, bold: true });
    y += 4;
    const rows = confirmed.slice(0, 20).map((f, i) => [
      `EV-${String(i + 1).padStart(3, "0")}`,
      f.platform || "—",
      f.title || f.username || "—",
      (f.extractor || "scraper").slice(0, 18),
    ]);
    y = table(doc, ["Evidence ID", "Platform", "Account / Title", "Method"], rows, y, [28, 30, 80, 40]);
  }

  // Candidate links table
  if (candidates.length) {
    y = checkY(doc, state, y, 20);
    text(doc, "Candidate Links (Unverified)", M, y, { size: 8, color: C.text, bold: true });
    y += 4;
    const rows = candidates.slice(0, 15).map((f, i) => [
      `EV-${String(confirmed.length + i + 1).padStart(3, "0")}`,
      f.platform || "—",
      f.title || "—",
      "Open Link",
    ]);
    y = table(doc, ["Evidence ID", "Platform", "Title", "Type"], rows, y, [28, 30, 90, 30]);
  }

  state._y = y;
}

function renderSocialProfiles(doc, inv, state) {
  let y = checkY(doc, state, state._y, 40);
  y = sectionTitle(doc, "3. Social Profiles", y);

  const findings = inv.findings || [];
  const confirmed = findings.filter(f => f.status === "found");

  if (!confirmed.length) {
    text(doc, "No confirmed social profiles found for this investigation.", M, y, { size: 8, color: C.slate });
    state._y = y + 10;
    return;
  }

  confirmed.slice(0, 25).forEach((f, i) => {
    y = checkY(doc, state, y, 22);

    // Profile card
    rect(doc, M, y, CW, 18, C.slateLight, 2);
    line(doc, M, y, M, y + 18, RISK_COLOR[f.risk] || C.blue, 2);

    // Avatar placeholder
    const avatarColor = [37 + i * 13 % 200, 99, 235];
    rect(doc, M + 4, y + 3, 12, 12, avatarColor, 2);
    text(doc, (f.platform || "?").slice(0, 2).toUpperCase(), M + 10, y + 11, { size: 6.5, color: C.white, bold: true, align: "center" });

    // Details
    const name = f.title || f.username || f.platform || "Unknown";
    text(doc, name.slice(0, 50), M + 20, y + 7, { size: 8, color: C.text, bold: true });
    text(doc, `Platform: ${f.platform || "—"}   |   Status: ${f.status === "found" ? "Confirmed" : "Candidate"}   |   Extractor: ${f.extractor || "—"}`, M + 20, y + 12.5, { size: 6.5, color: C.slate });

    // URL
    if (f.url) {
      const urlStr = f.url.slice(0, 72);
      text(doc, urlStr, M + 20, y + 17, { size: 6, color: C.blue });
    }

    riskBadge(doc, f.risk || "medium", PW - M - 24, y + 4);
    y += 22;
  });

  if (confirmed.length > 25) {
    text(doc, `… and ${confirmed.length - 25} more confirmed profiles (truncated for readability)`, M, y, { size: 7, color: C.slate });
    y += 6;
  }

  state._y = y;
}

function renderPostingBehaviour(doc, inv, state) {
  let y = checkY(doc, state, state._y, 40);
  y = sectionTitle(doc, "4. Posting Behaviour Analysis", y);

  const findings = inv.findings || [];
  const platformCounts = {};
  findings.forEach(f => {
    const p = f.platform || "Unknown";
    platformCounts[p] = (platformCounts[p] || 0) + 1;
  });
  const platformList = Object.entries(platformCounts)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);

  if (!platformList.length) {
    text(doc, "No posting behaviour data available.", M, y, { size: 8, color: C.slate });
    state._y = y + 10;
    return;
  }

  // Bar chart
  text(doc, "Activity by Platform", M, y, { size: 8, color: C.text, bold: true });
  y += 6;
  y = barChart(doc, platformList, M, y, CW - 20);
  y += 6;

  // Platform breakdown table
  y = checkY(doc, state, y, 20);
  text(doc, "Platform Distribution", M, y, { size: 8, color: C.text, bold: true });
  y += 4;
  const rows = platformList.map(p => [p.name, String(p.count), `${Math.round((p.count / findings.length) * 100)}%`]);
  y = table(doc, ["Platform", "Findings", "Share"], rows, y, [80, 30, 30]);

  // Content repetition
  const contentAnalysis = inv.contentAnalysis || {};
  if (contentAnalysis.repeats?.length) {
    y = checkY(doc, state, y, 20);
    text(doc, "Content Cross-Posting (Overlap Detected)", M, y, { size: 8, color: C.text, bold: true });
    y += 4;
    const repRows = contentAnalysis.repeats.slice(0, 10).map(r => [
      r.from || "—", r.to || "—", String(r.sharedShingles || 0)
    ]);
    y = table(doc, ["Source A", "Source B", "Shared Phrases"], repRows, y, [60, 60, 40]);
  }

  state._y = y;
}

function renderNetworkAnalysis(doc, inv, state) {
  let y = checkY(doc, state, state._y, 40);
  y = sectionTitle(doc, "5. Network Analysis", y);

  const findings  = inv.findings || [];
  const confirmed = findings.filter(f => f.status === "found");
  const stats     = inv.stats || {};

  // Summary
  const netStats = [
    ["Total Nodes (Accounts + Sources)", String(confirmed.length + 1)],
    ["Average Match Score",              `${stats.confidence || 0}%`],
    ["Sources Crawled",                  String(stats.sources || 0)],
    ["Platforms Interconnected",         String(inv.platforms?.length || 0)],
  ];

  y = checkY(doc, state, y, netStats.length * 7 + 4);
  netStats.forEach(([k, v]) => {
    y = kv(doc, k + ":", v, M, y, 80);
  });
  y += 4;

  // Node list
  if (confirmed.length) {
    y = checkY(doc, state, y, 20);
    text(doc, "Network Nodes", M, y, { size: 8, color: C.text, bold: true });
    y += 4;
    const rows = confirmed.slice(0, 20).map(f => [
      (f.title || f.platform || "—").slice(0, 30),
      f.platform || "—",
      `${f.matchPct || stats.confidence || 0}%`,
      (f.risk || "medium").toUpperCase(),
    ]);
    y = table(doc, ["Node / Account", "Platform", "Match %", "Risk"], rows, y, [70, 40, 20, 28]);
  }

  state._y = y;
}

function renderRiskAssessment(doc, inv, state) {
  let y = checkY(doc, state, state._y, 50);
  y = sectionTitle(doc, "6. Risk Assessment", y);

  const stats     = inv.stats || {};
  const findings  = inv.findings || [];
  const confirmed = findings.filter(f => f.status === "found");
  const riskScore = { critical: 92, high: 70, medium: 48, low: 20 }[inv.risk] ?? (stats.confidence || 0);

  // Gauge (right side)
  riskGauge(doc, riskScore, PW - M - 22, y + 24, 20);
  text(doc, "Risk Score", PW - M - 22, y + 48, { size: 7, color: C.slate, align: "center" });

  // Details (left side)
  const rColor = RISK_COLOR[inv.risk] || C.slate;
  rect(doc, M, y, CW - 52, 8, [rColor[0], rColor[1], rColor[2]], 2);
  text(doc, `THREAT LEVEL: ${(inv.risk || "LOW").toUpperCase()}`, M + 4, y + 5.5, { size: 9, color: C.white, bold: true });
  y += 11;

  const riskItems = [
    ["Risk Level",            (inv.risk || "low").toUpperCase()],
    ["Risk Score",            `${riskScore}/100`],
    ["Confirmed Accounts",    String(confirmed.length)],
    ["Corroborating Sources", String(stats.sources || 0)],
    ["Confidence Score",      `${stats.confidence || 0}%`],
  ];
  riskItems.forEach(([k, v]) => {
    y = kv(doc, k + ":", v, M, y, 60);
  });

  // Risk explanation
  y += 4;
  const explanation = inv.risk === "critical"
    ? "CRITICAL: Immediate escalation recommended. Multiple confirmed high-confidence accounts identified with significant cross-platform activity."
    : inv.risk === "high"
    ? "HIGH: Review recommended. Several confirmed accounts found with substantial evidence of coordinated activity."
    : inv.risk === "medium"
    ? "MEDIUM: Monitor closely. Some confirmed accounts identified, further investigation may be warranted."
    : "LOW: Minimal risk indicators. Limited confirmed activity across platforms.";

  y = checkY(doc, state, y, 20);
  rect(doc, M, y, CW - 52, 22, C.slateLight, 2);
  line(doc, M, y, M, y + 22, rColor, 1.5);
  wrap(doc, explanation, M + 4, y + 5, CW - 60, 5, { size: 7.5, color: C.textSec });
  y += 26;

  state._y = y;
}

function renderTimeline(doc, inv, state) {
  let y = checkY(doc, state, state._y, 40);
  y = sectionTitle(doc, "7. Investigation Timeline", y);

  const logs = inv.logs || [];

  if (!logs.length) {
    text(doc, "No activity log recorded for this investigation.", M, y, { size: 8, color: C.slate });
    state._y = y + 10;
    return;
  }

  const colorMap = { success: C.green, warn: C.orange, info: C.blue };

  logs.slice(0, 30).forEach((ev, i) => {
    y = checkY(doc, state, y, 14);
    const color = colorMap[ev.level] || C.slate;

    // Timeline dot + line
    if (i < logs.length - 1) {
      line(doc, M + 3, y + 5, M + 3, y + 14, C.border, 0.5);
    }
    rect(doc, M, y + 1, 6, 6, color, 3);

    // Event text
    text(doc, ev.msg || "—", M + 10, y + 5, { size: 7.5, color: C.text });
    text(doc, ev.time || "—", M + 10, y + 10, { size: 6.5, color: C.slate });
    y += 14;
  });

  if (logs.length > 30) {
    text(doc, `… ${logs.length - 30} more log entries omitted.`, M, y, { size: 7, color: C.slate });
    y += 6;
  }

  state._y = y;
}

function renderEvidenceLinks(doc, inv, state) {
  let y = checkY(doc, state, state._y, 40);
  y = sectionTitle(doc, "8. Evidence Links", y);

  const findings  = inv.findings || [];
  const confirmed = findings.filter(f => f.status === "found");
  const candidates= findings.filter(f => f.status === "open_link");
  const all = [
    ...confirmed.map((f, i) => ({ ...f, evId: `EV-${String(i + 1).padStart(3, "0")}`, evType: "Confirmed Profile" })),
    ...candidates.map((f, i) => ({ ...f, evId: `EV-${String(confirmed.length + i + 1).padStart(3, "0")}`, evType: "Candidate Link" })),
  ];

  if (!all.length) {
    text(doc, "No evidence links collected.", M, y, { size: 8, color: C.slate });
    state._y = y + 10;
    return;
  }

  // Table with ID, Type, Platform, URL
  const rows = all.slice(0, 40).map(ev => [
    ev.evId,
    ev.evType,
    ev.platform || "—",
    (ev.url || "—").slice(0, 56),
  ]);
  y = table(doc, ["Evidence ID", "Type", "Platform", "URL"], rows, y, [24, 30, 24, 100]);

  if (all.length > 40) {
    text(doc, `… ${all.length - 40} more links omitted.`, M, y + 2, { size: 7, color: C.slate });
    y += 8;
  }

  state._y = y + 4;
}

// ── Main export ───────────────────────────────────────────────────────────────

export async function generateOsintPDF(investigation) {
  const JsPDF = await ensureJsPDF();

  const exportTs = new Date().toLocaleString();
  const caseId   = investigation?.id || "UNKNOWN";

  const doc = new JsPDF({ unit: "mm", format: "a4", compress: true });

  // State object passed through renderers
  const state = { page: 0, caseId, exportTs, _y: 0 };

  // ── Cover page (page 1, no header/footer) ──
  renderCover(doc, investigation, exportTs);
  state.page = 1;

  // ── Content pages ──
  // Each renderer calls newPage internally, then updates state._y
  state._y = renderSubjectOverview(doc, investigation, state);
  renderAccountSummary(doc, investigation, state);
  renderSocialProfiles(doc, investigation, state);
  renderPostingBehaviour(doc, investigation, state);
  renderNetworkAnalysis(doc, investigation, state);
  renderRiskAssessment(doc, investigation, state);
  renderTimeline(doc, investigation, state);
  renderEvidenceLinks(doc, investigation, state);

  // ── Save ──
  const filename = `oxinap-report-${caseId}-${Date.now()}.pdf`;
  doc.save(filename);

  return filename;
}
