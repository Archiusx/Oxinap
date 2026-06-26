/**
 * AssociateNetworkPage.jsx
 * Isolated module — Associate Network Analysis
 * Reuses the existing SVG graph system, CSS variables, and shared component patterns
 * from dashboard.jsx. No external graph library required.
 */
import { useState, useMemo, useCallback, useRef, useEffect } from "react";

// ─────────────────────────────────────────────
// Shared icon helpers (mirrors dashboard pattern)
// ─────────────────────────────────────────────
const Ico = (d) => ({ size = 16, className = "", style = {} }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className} style={style}>
    {Array.isArray(d) ? d.map((p, i) => <path key={i} d={p} />) : <path d={d} />}
  </svg>
);
const IcoEl = (ch) => ({ size = 16, className = "", style = {} }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className} style={style}>{ch}</svg>
);

const Network  = IcoEl([<circle key="n1" cx="12" cy="5"  r="3"/>,<circle key="n2" cx="5"  cy="19" r="3"/>,<circle key="n3" cx="19" cy="19" r="3"/>,<line key="l1" x1="12" y1="8"  x2="5.5"  y2="16"/>,<line key="l2" x1="12" y1="8" x2="18.5" y2="16"/>]);
const Users    = IcoEl([<path key="p1" d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>,<circle key="c" cx="9" cy="7" r="4"/>,<path key="p2" d="M23 21v-2a4 4 0 0 0-3-3.87"/>,<path key="p3" d="M16 3.13a4 4 0 0 1 0 7.75"/>]);
const Search   = IcoEl([<circle key="c" cx="11" cy="11" r="8"/>,<line key="l" x1="21" y1="21" x2="16.65" y2="16.65"/>]);
const Plus     = Ico("M12 5v14M5 12h14");
const Trash2   = IcoEl([<polyline key="pl" points="3 6 5 6 21 6"/>,<path key="p1" d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>,<line key="l1" x1="10" y1="11" x2="10" y2="17"/>,<line key="l2" x1="14" y1="11" x2="14" y2="17"/>]);
const Eye      = IcoEl([<path key="p" d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>,<circle key="c" cx="12" cy="12" r="3"/>]);
const EyeOff   = IcoEl([<path key="p1" d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>,<path key="p2" d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>,<line key="l1" x1="1" y1="1" x2="23" y2="23"/>]);
const AtSign   = IcoEl([<circle key="c" cx="12" cy="12" r="4"/>,<path key="p" d="M16 8v5a3 3 0 0 0 6 0v-1a10 10 0 1 0-3.92 7.94"/>]);
const LinkIcon = IcoEl([<path key="p1" d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>,<path key="p2" d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>]);
const RefreshCw= IcoEl([<path key="p1" d="M3 2v6h6"/>,<path key="p2" d="M21 12A9 9 0 0 0 6 5.3L3 8"/>,<path key="p3" d="M21 22v-6h-6"/>,<path key="p4" d="M3 12a9 9 0 0 0 15 6.7l3-2.7"/>]);
const ZapIcon  = Ico("M13 2 3 14h9l-1 8 10-12h-9l1-8z");
const Hash     = Ico("M4 9h16M4 15h16M10 3 8 21M16 3l-2 18");
const X        = IcoEl([<line key="a" x1="18" y1="6" x2="6" y2="18"/>,<line key="b" x1="6" y1="6" x2="18" y2="18"/>]);
const ChevronRight = Ico("M9 18l6-6-6-6");
const Info     = IcoEl([<circle key="c" cx="12" cy="12" r="10"/>,<line key="l1" x1="12" y1="16" x2="12" y2="12"/>,<line key="l2" x1="12" y1="8" x2="12.01" y2="8"/>]);
const ExternalLink = IcoEl([<path key="p" d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>,<polyline key="pl" points="15 3 21 3 21 9"/>,<line key="l" x1="10" y1="14" x2="21" y2="3"/>]);
const Maximize2 = IcoEl([<polyline key="p1" points="15 3 21 3 21 9"/>,<polyline key="p2" points="9 21 3 21 3 15"/>,<line key="l1" x1="21" y1="3" x2="14" y2="10"/>,<line key="l2" x1="3" y1="21" x2="10" y2="14"/>]);

// ─────────────────────────────────────────────
// CSS variable helper (mirrors dashboard V)
// ─────────────────────────────────────────────
const V = {
  page:   { background: "var(--bg-page)" },
  card:   { background: "var(--bg-card)", border: "1px solid var(--border)" },
  inner:  { borderBottom: "1px solid var(--border-inner)" },
  input:  { background: "var(--bg-input)", border: "1px solid var(--border)", color: "var(--text-primary)" },
};

function cn(...a) { return a.filter(Boolean).join(" "); }

// ─────────────────────────────────────────────
// Strength colours
// ─────────────────────────────────────────────
const STRENGTH = {
  strong: { color: "#ef4444", bg: "rgba(239,68,68,0.1)",   label: "Strong",  glow: "rgba(239,68,68,0.25)"  },
  medium: { color: "#f97316", bg: "rgba(249,115,22,0.1)",  label: "Medium",  glow: "rgba(249,115,22,0.2)"  },
  weak:   { color: "#eab308", bg: "rgba(234,179,8,0.1)",   label: "Weak",    glow: "rgba(234,179,8,0.18)"  },
};

function getStrength(score) {
  if (score >= 70) return "strong";
  if (score >= 40) return "medium";
  return "weak";
}

// ─────────────────────────────────────────────
// Seed data builder  (derived from investigation or demo)
// ─────────────────────────────────────────────
function buildAssociates(investigation) {
  if (!investigation) return demoAssociates();

  const target = investigation.target || "Unknown";
  const findings    = investigation.findings || [];
  const gemSources  = investigation.gemini?.sources || [];
  // ── Newly-persisted card data (see osintTools/dashboard changes) ──
  // crawledPages: full text of pages the crawler fetched — often contains
  // @mentions/tags that never made it into a platform "finding".
  // instaPosts: post captions/hashtags, which frequently @mention other
  // accounts (collaborators, tagged friends, brand partners, etc).
  const crawledPages = investigation.crawledPages || [];
  const instaPosts    = investigation.instaPosts   || [];

  // extract usernames / handles that appear across findings, sources,
  // crawled page text, and Instagram post captions/hashtags
  const handleRe = /[@#]?([a-zA-Z0-9_.-]{3,32})/g;
  const freq = {};
  const snippetMap = {};

  const postTextSources = instaPosts.map((p) => ({
    title:    "Instagram post",
    snippet:  [p.caption, (p.hashtags || []).map((h) => "#" + h).join(" ")].filter(Boolean).join(" "),
    platform: "Instagram Post",
  }));

  [...findings, ...gemSources, ...crawledPages, ...postTextSources].forEach(f => {
    const text = [f.title, f.snippet, f.url, f.platform].filter(Boolean).join(" ");
    let m;
    while ((m = handleRe.exec(text)) !== null) {
      const h = m[1].toLowerCase();
      if (h === target.toLowerCase()) continue;
      freq[h] = (freq[h] || 0) + 1;
      snippetMap[h] = snippetMap[h] || f.platform || "OSINT";
    }
  });

  // ── Direct, high-confidence associates ──────────────────────────────────
  // Real followers/connections pulled straight from the Instagram/Twitter
  // follower scrapers ARE actual accounts linked to the target, so unlike
  // the regex mining above they don't need to be "mentioned" anywhere to
  // count as a connection — fold them into the same frequency map with a
  // strong starting weight so they reliably surface as real, named
  // associates rather than getting drowned out by incidental text mentions.
  const directConnections = [
    ...(investigation.instaFollowers   || []).map(f => ({ handle: (f.username || "").toLowerCase(), platform: "Instagram" })),
    ...(investigation.twitterFollowers || []).map(f => ({ handle: (f.username || "").toLowerCase(), platform: "Twitter / X" })),
  ].filter(c => c.handle && c.handle !== target.toLowerCase());

  directConnections.forEach(({ handle, platform }) => {
    freq[handle] = (freq[handle] || 0) + 4;
    snippetMap[handle] = platform;
  });

  const sorted = Object.entries(freq)
    .filter(([, c]) => c >= 1)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12);

  if (sorted.length === 0) return demoAssociates(target);

  return {
    target: { id: "target", label: target, type: "target", platform: investigation.type || "Social", score: 100 },
    nodes: sorted.map(([handle, count], i) => {
      const score = Math.min(95, 35 + count * 18);
      return {
        id: `a${i}`,
        label: handle,
        type: ["frequent", "mention", "tagged", "linked"][i % 4],
        platform: snippetMap[handle] || "OSINT",
        score,
        strength: getStrength(score),
        mutualConnections: Math.floor(count * 1.5),
        sharedUsernames: count > 2 ? 1 : 0,
        sharedLinks: count > 3 ? 1 : 0,
        interactions: count,
        hidden: false,
      };
    }),
  };
}

function demoAssociates(targetLabel = "demo_user") {
  const associates = [
    { id:"a1",  label:"@alex_forensics",   type:"frequent", platform:"Twitter",   score:88, mutualConnections:14, sharedUsernames:2, sharedLinks:3, interactions:27 },
    { id:"a2",  label:"@jsmith_intel",     type:"mention",  platform:"LinkedIn",  score:76, mutualConnections:9,  sharedUsernames:0, sharedLinks:1, interactions:18 },
    { id:"a3",  label:"@cryptowatcher99",  type:"tagged",   platform:"Instagram", score:63, mutualConnections:6,  sharedUsernames:1, sharedLinks:0, interactions:11 },
    { id:"a4",  label:"@recon_team_delta", type:"linked",   platform:"Telegram",  score:58, mutualConnections:5,  sharedUsernames:0, sharedLinks:2, interactions:8  },
    { id:"a5",  label:"@mediawatch_hq",    type:"frequent", platform:"Twitter",   score:51, mutualConnections:4,  sharedUsernames:0, sharedLinks:1, interactions:7  },
    { id:"a6",  label:"@open_source_iris", type:"mention",  platform:"GitHub",    score:45, mutualConnections:3,  sharedUsernames:1, sharedLinks:0, interactions:5  },
    { id:"a7",  label:"@dark_pattern_x",   type:"tagged",   platform:"Reddit",    score:38, mutualConnections:2,  sharedUsernames:0, sharedLinks:0, interactions:4  },
    { id:"a8",  label:"@signal_watcher",   type:"linked",   platform:"Twitter",   score:32, mutualConnections:1,  sharedUsernames:0, sharedLinks:1, interactions:3  },
  ].map(n => ({ ...n, strength: getStrength(n.score), hidden: false }));

  return {
    target: { id:"target", label: targetLabel, type:"target", platform:"Social", score:100 },
    nodes: associates,
  };
}

// ─────────────────────────────────────────────
// Physics-like layout (deterministic circle + jitter)
// ─────────────────────────────────────────────
function layoutNodes(nodes, W, H) {
  const CX = W / 2, CY = H / 2;
  const rings = [
    { count: 0, r: 0   },   // center — placeholder
    { r: 130 },
    { r: 220 },
  ];

  // bucket by strength
  const strong = nodes.filter(n => n.strength === "strong");
  const medium = nodes.filter(n => n.strength === "medium");
  const weak   = nodes.filter(n => n.strength === "weak");

  const placed = [];

  function placeRing(arr, radius) {
    arr.forEach((n, i) => {
      const angle = (2 * Math.PI * i) / Math.max(arr.length, 1) - Math.PI / 2;
      placed.push({ ...n, x: CX + radius * Math.cos(angle), y: CY + radius * Math.sin(angle) });
    });
  }

  placeRing(strong, 130);
  placeRing(medium, 215);
  placeRing(weak, 295);

  return placed;
}

// ─────────────────────────────────────────────
// ScoreBar  (mirrors dashboard)
// ─────────────────────────────────────────────
function ScoreBar({ score, color = "#2563eb" }) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 bg-slate-100 rounded-full h-1.5">
        <div className="h-1.5 rounded-full" style={{ width: `${score}%`, backgroundColor: color }}/>
      </div>
      <span className="text-xs font-medium tabular-nums text-slate-600 w-8 text-right"
        style={{ fontFamily: "monospace" }}>{score}%</span>
    </div>
  );
}

// ─────────────────────────────────────────────
// Strength Badge
// ─────────────────────────────────────────────
function StrengthBadge({ strength }) {
  const s = STRENGTH[strength] || STRENGTH.weak;
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium"
      style={{ background: s.bg, color: s.color, border: `1px solid ${s.color}33` }}>
      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: s.color }}/>
      {s.label}
    </span>
  );
}

// ─────────────────────────────────────────────
// Type Pill
// ─────────────────────────────────────────────
const TYPE_COLORS = {
  frequent: { bg:"rgba(99,102,241,0.1)",  color:"#4f46e5" },
  mention:  { bg:"rgba(59,130,246,0.1)",  color:"#2563eb" },
  tagged:   { bg:"rgba(16,185,129,0.1)",  color:"#059669" },
  linked:   { bg:"rgba(245,158,11,0.1)",  color:"#d97706" },
  target:   { bg:"rgba(239,68,68,0.1)",   color:"#dc2626" },
};

function TypePill({ type }) {
  const c = TYPE_COLORS[type] || TYPE_COLORS.mention;
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium capitalize"
      style={{ background: c.bg, color: c.color }}>{type}</span>
  );
}

// ─────────────────────────────────────────────
// Add-Account Modal
// ─────────────────────────────────────────────
function AddAccountModal({ onAdd, onClose }) {
  const [label, setLabel] = useState("");
  const [platform, setPlatform] = useState("Twitter");
  const [type, setType] = useState("frequent");
  const [score, setScore] = useState(50);

  function submit() {
    if (!label.trim()) return;
    onAdd({ label: label.trim(), platform, type, score: Number(score) });
    onClose();
  }

  return (
    <div style={{ position:"fixed", inset:0, zIndex:9999, display:"flex", alignItems:"center", justifyContent:"center", background:"rgba(0,0,0,0.5)" }}>
      <div className="rounded-xl shadow-xl p-6 w-80" style={V.card}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-sm" style={{ color:"var(--text-primary)" }}>Add Account</h3>
          <button onClick={onClose} style={{ color:"var(--text-muted)", background:"none", border:"none", cursor:"pointer" }}><X size={16}/></button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="block text-xs text-slate-400 mb-1">Username / Handle</label>
            <input className="w-full px-3 py-2 rounded-lg text-sm" style={{ ...V.input, outline:"none" }}
              placeholder="@username" value={label} onChange={e=>setLabel(e.target.value)}
              onKeyDown={e=>e.key==="Enter"&&submit()} autoFocus/>
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Platform</label>
            <select className="w-full px-3 py-2 rounded-lg text-sm" style={{ ...V.input, outline:"none" }}
              value={platform} onChange={e=>setPlatform(e.target.value)}>
              {["Twitter","Instagram","LinkedIn","Facebook","Telegram","Reddit","GitHub","TikTok","YouTube"].map(p=>(
                <option key={p}>{p}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Relationship Type</label>
            <select className="w-full px-3 py-2 rounded-lg text-sm" style={{ ...V.input, outline:"none" }}
              value={type} onChange={e=>setType(e.target.value)}>
              <option value="frequent">Frequently Appearing</option>
              <option value="mention">Mention Network</option>
              <option value="tagged">Tagged User</option>
              <option value="linked">Common Interaction</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Connection Score: {score}%</label>
            <input type="range" min={5} max={100} value={score} onChange={e=>setScore(e.target.value)}
              className="w-full" style={{ accentColor:"#2563eb" }}/>
          </div>
        </div>

        <div className="flex gap-2 mt-5">
          <button onClick={onClose} className="flex-1 py-2 rounded-lg text-sm" style={{ ...V.input, cursor:"pointer" }}>Cancel</button>
          <button onClick={submit} className="flex-1 py-2 rounded-lg text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 transition-colors" style={{ border:"none", cursor:"pointer" }}>Add</button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Node Inspector Panel (right sidebar of graph)
// ─────────────────────────────────────────────
function NodeInspector({ node, allNodes, onExpand, onHide }) {
  if (!node) {
    return (
      <div className="flex flex-col items-center justify-center h-48 text-center">
        <Network size={24} className="mb-2" style={{ color:"var(--text-muted)" }}/>
        <p className="text-xs" style={{ color:"var(--text-muted)" }}>Click a node to inspect the account</p>
      </div>
    );
  }

  const s = STRENGTH[node.strength] || STRENGTH.weak;
  const related = allNodes.filter(n => n.id !== node.id && n.strength === node.strength).slice(0, 3);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 font-bold text-white text-xs"
          style={{ background: `linear-gradient(135deg,${s.color},${s.color}aa)`, fontFamily:"monospace" }}>
          {(node.label||"?").replace("@","").slice(0,2).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-semibold text-sm truncate" style={{ color:"var(--text-primary)", fontFamily:"monospace" }}>{node.label}</div>
          <div className="text-xs mt-0.5" style={{ color:"var(--text-muted)" }}>{node.platform}</div>
        </div>
      </div>

      {/* Badges */}
      <div className="flex flex-wrap gap-1.5">
        <StrengthBadge strength={node.strength}/>
        <TypePill type={node.type}/>
      </div>

      {/* Score */}
      <div>
        <div className="text-xs mb-1" style={{ color:"var(--text-muted)" }}>Connection Score</div>
        <ScoreBar score={node.score} color={s.color}/>
      </div>

      {/* Metrics */}
      <div className="rounded-lg p-3 space-y-2" style={{ background:"var(--bg-input)" }}>
        {[
          ["Mutual Connections", node.mutualConnections],
          ["Shared Usernames",   node.sharedUsernames],
          ["Shared Profile Links", node.sharedLinks],
          ["Common Interactions", node.interactions],
        ].map(([k, v]) => (
          <div key={k} className="flex justify-between items-center">
            <span className="text-xs" style={{ color:"var(--text-muted)" }}>{k}</span>
            <span className="text-xs font-semibold" style={{ color:"var(--text-primary)", fontFamily:"monospace" }}>{v ?? "—"}</span>
          </div>
        ))}
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <button onClick={() => onExpand(node)} className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 transition-colors" style={{ border:"none", cursor:"pointer" }}>
          <Maximize2 size={12}/>Expand
        </button>
        <button onClick={() => onHide(node.id)} className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-colors" style={{ ...V.input, cursor:"pointer" }}>
          <EyeOff size={12}/>Hide
        </button>
      </div>

      {/* Related */}
      {related.length > 0 && (
        <div>
          <div className="text-xs font-semibold mb-2" style={{ color:"var(--text-muted)", textTransform:"uppercase", letterSpacing:"0.06em" }}>Similar Strength</div>
          {related.map(r => (
            <div key={r.id} className="flex items-center justify-between px-3 py-2 rounded-lg mb-1" style={{ background:"var(--bg-input)" }}>
              <span className="text-xs truncate" style={{ color:"var(--text-primary)", fontFamily:"monospace" }}>{r.label}</span>
              <span className="text-xs ml-2" style={{ color:"var(--text-muted)" }}>{r.score}%</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// Interactive Network Graph (SVG — reuses existing pattern)
// ─────────────────────────────────────────────
function NetworkGraph({ data, hiddenTypes, onSelectNode, selectedNodeId }) {
  const W = 760, H = 500;
  const CX = W / 2, CY = H / 2;
  const [hovered, setHovered] = useState(null);

  const visibleNodes = useMemo(
    () => data.nodes.filter(n => !n.hidden && !hiddenTypes.has(n.type)),
    [data.nodes, hiddenTypes]
  );

  const positioned = useMemo(() => layoutNodes(visibleNodes, W, H), [visibleNodes]);

  const nodeMap = useMemo(() => {
    const m = { target: { ...data.target, x: CX, y: CY } };
    positioned.forEach(n => { m[n.id] = n; });
    return m;
  }, [positioned, data.target, CX, CY]);

  const edges = useMemo(() =>
    positioned.map(n => ({ from:"target", to: n.id, score: n.score, strength: n.strength })),
    [positioned]
  );

  function edgeColor(strength) {
    return STRENGTH[strength]?.color || "#94a3b8";
  }

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width:"100%", minHeight:380 }}>
      <defs>
        <filter id="anShadow">
          <feDropShadow dx={0} dy={2} stdDeviation={5} floodOpacity={0.14}/>
        </filter>
        <filter id="anGlow">
          <feGaussianBlur stdDeviation="4" result="coloredBlur"/>
          <feMerge><feMergeNode in="coloredBlur"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
        {/* ring gradients */}
        {["strong","medium","weak"].map(s => (
          <radialGradient key={s} id={`grad-${s}`} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={STRENGTH[s].color} stopOpacity={0.18}/>
            <stop offset="100%" stopColor={STRENGTH[s].color} stopOpacity={0}/>
          </radialGradient>
        ))}
      </defs>

      {/* Background grid */}
      {Array.from({length:10}).map((_,i)=><line key={`h${i}`} x1={0} y1={i*52} x2={W} y2={i*52} stroke="var(--border-inner)" strokeWidth={1}/>)}
      {Array.from({length:16}).map((_,i)=><line key={`v${i}`} x1={i*50} y1={0} x2={i*50} y2={H} stroke="var(--border-inner)" strokeWidth={1}/>)}

      {/* Orbit rings */}
      {[130,215,295].map((r,i)=>(
        <circle key={r} cx={CX} cy={CY} r={r}
          fill={`url(#grad-${["strong","medium","weak"][i]})`}
          stroke={STRENGTH[["strong","medium","weak"][i]].color}
          strokeWidth={1} strokeOpacity={0.12} strokeDasharray="4,4"/>
      ))}

      {/* Edges */}
      {edges.map((e, i) => {
        const from = nodeMap[e.from], to = nodeMap[e.to];
        if (!from || !to) return null;
        const isHov = hovered === e.to || selectedNodeId === e.to;
        const color = edgeColor(e.strength);
        const midX = (from.x + to.x) / 2;
        const midY = (from.y + to.y) / 2 - 25;
        return (
          <g key={i}>
            <path
              d={`M${from.x},${from.y} Q${midX},${midY} ${to.x},${to.y}`}
              fill="none" stroke={color}
              strokeWidth={isHov ? 2.5 : 1.5}
              strokeOpacity={isHov ? 0.9 : 0.3}
              strokeDasharray={e.strength === "weak" ? "5,4" : undefined}/>
            {isHov && (
              <text x={(from.x+to.x)/2} y={(from.y+to.y)/2-5}
                textAnchor="middle" fill={color}
                fontSize={9} fontFamily="monospace" opacity={0.85}>{e.score}%</text>
            )}
          </g>
        );
      })}

      {/* Satellite nodes */}
      {positioned.map(node => {
        const isHov = hovered === node.id;
        const isSel = selectedNodeId === node.id;
        const s = STRENGTH[node.strength] || STRENGTH.weak;
        const r = isSel ? 22 : isHov ? 20 : 17;
        return (
          <g key={node.id} style={{ cursor:"pointer" }}
            onMouseEnter={() => setHovered(node.id)}
            onMouseLeave={() => setHovered(null)}
            onClick={() => onSelectNode(node)}>
            {(isHov || isSel) && <circle cx={node.x} cy={node.y} r={r+12} fill={s.glow}/>}
            <circle cx={node.x} cy={node.y} r={r}
              fill={s.bg} stroke={s.color}
              strokeWidth={isSel ? 3 : isHov ? 2.5 : 2}
              filter="url(#anShadow)"/>
            <text x={node.x} y={node.y-1} textAnchor="middle"
              fill={s.color} fontSize={isSel?10:9} fontWeight={700} fontFamily="monospace">
              {(node.label||"").replace("@","").slice(0,3).toUpperCase()}
            </text>
            <text x={node.x} y={node.y+10} textAnchor="middle"
              fill="#64748b" fontSize={7} fontFamily="monospace">{node.score}%</text>
            <text x={node.x} y={node.y+r+14} textAnchor="middle"
              fill="var(--text-sec)" fontSize={8.5}>
              {(node.label||"").length>14 ? node.label.slice(0,13)+"…" : node.label}
            </text>
            <text x={node.x} y={node.y+r+24} textAnchor="middle"
              fill="var(--text-muted)" fontSize={7.5}>{node.platform}</text>
          </g>
        );
      })}

      {/* Center target node */}
      {(() => {
        const t = nodeMap["target"];
        if (!t) return null;
        const isHov = hovered === "target";
        const isSel = selectedNodeId === "target";
        return (
          <g style={{ cursor:"pointer" }}
            onMouseEnter={() => setHovered("target")}
            onMouseLeave={() => setHovered(null)}
            onClick={() => onSelectNode({ ...data.target, x: CX, y: CY, strength:"strong", mutualConnections:0, sharedUsernames:0, sharedLinks:0, interactions:0 })}>
            {(isHov || isSel) && <circle cx={CX} cy={CY} r={44} fill="rgba(239,68,68,0.15)" filter="url(#anGlow)"/>}
            <circle cx={CX} cy={CY} r={30} fill="#fef2f2" stroke="#ef4444" strokeWidth={3} filter="url(#anShadow)"/>
            <circle cx={CX} cy={CY} r={22} fill="none" stroke="#ef4444" strokeWidth={1} strokeDasharray="3,3" opacity={0.5}/>
            <text x={CX} y={CY-3} textAnchor="middle" fill="#ef4444" fontSize={11} fontWeight={800} fontFamily="monospace">
              {(data.target.label||"TGT").replace("@","").slice(0,3).toUpperCase()}
            </text>
            <text x={CX} y={CY+10} textAnchor="middle" fill="#64748b" fontSize={8} fontFamily="monospace">TARGET</text>
            <text x={CX} y={CY+46} textAnchor="middle" fill="var(--text-sec)" fontSize={9}>
              {(data.target.label||"").length>14 ? data.target.label.slice(0,13)+"…" : data.target.label}
            </text>
          </g>
        );
      })()}
    </svg>
  );
}

// ─────────────────────────────────────────────
// Dashboard Metric Card
// ─────────────────────────────────────────────
function MetricCard({ icon: Ic, label, value, sub, color = "#2563eb" }) {
  return (
    <div className="rounded-xl p-4 flex items-start gap-3" style={V.card}>
      <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
        style={{ background: `${color}18`, border: `1px solid ${color}30` }}>
        <Ic size={16} style={{ color }}/>
      </div>
      <div>
        <div className="text-xl font-bold" style={{ color:"var(--text-primary)", fontFamily:"monospace" }}>{value}</div>
        <div className="text-xs font-medium mt-0.5" style={{ color:"var(--text-sec)" }}>{label}</div>
        {sub && <div className="text-xs mt-0.5" style={{ color:"var(--text-muted)" }}>{sub}</div>}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Associate Row (table)
// ─────────────────────────────────────────────
function AssociateRow({ node, isSelected, onSelect, onDelete }) {
  return (
    <tr onClick={() => onSelect(node)}
      className="cursor-pointer transition-colors"
      style={{ background: isSelected ? "var(--bg-active)" : undefined }}>
      <td className="px-4 py-3">
        <div className="font-medium text-xs" style={{ color:"var(--text-primary)", fontFamily:"monospace" }}>{node.label}</div>
        <div className="text-xs mt-0.5" style={{ color:"var(--text-muted)" }}>{node.platform}</div>
      </td>
      <td className="px-4 py-3"><TypePill type={node.type}/></td>
      <td className="px-4 py-3"><StrengthBadge strength={node.strength}/></td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2 min-w-[100px]">
          <div className="flex-1 h-1.5 rounded-full" style={{ background:"var(--bg-input)" }}>
            <div className="h-1.5 rounded-full" style={{ width:`${node.score}%`, backgroundColor: STRENGTH[node.strength]?.color }}/>
          </div>
          <span className="text-xs" style={{ color:"var(--text-muted)", fontFamily:"monospace" }}>{node.score}%</span>
        </div>
      </td>
      <td className="px-4 py-3 text-center text-xs" style={{ color:"var(--text-sec)" }}>{node.mutualConnections}</td>
      <td className="px-4 py-3 text-center text-xs" style={{ color:"var(--text-sec)" }}>{node.interactions}</td>
      <td className="px-4 py-3">
        <button onClick={e=>{e.stopPropagation(); onDelete(node.id);}}
          className="p-1 rounded hover:text-red-400 transition-colors"
          style={{ background:"none", border:"none", cursor:"pointer", color:"var(--text-muted)" }}>
          <Trash2 size={13}/>
        </button>
      </td>
    </tr>
  );
}

// ─────────────────────────────────────────────
// Main Page Export
// ─────────────────────────────────────────────
export default function AssociateNetworkPage({ investigation, setActivePage }) {
  const rawData = useMemo(() => buildAssociates(investigation), [investigation]);

  const [nodes, setNodes] = useState(() => rawData.nodes);
  const [selectedNode, setSelectedNode] = useState(null);
  const [activeView, setActiveView] = useState("graph"); // "graph" | "table"
  const [hiddenTypes, setHiddenTypes] = useState(new Set());
  const [searchQ, setSearchQ] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [expandedIds, setExpandedIds] = useState(new Set());

  // Reset nodes when investigation changes
  useEffect(() => { setNodes(rawData.nodes); setSelectedNode(null); }, [rawData]);

  // ── Derived data ──
  const filteredNodes = useMemo(() => {
    const q = searchQ.toLowerCase();
    return nodes.filter(n =>
      !n.hidden &&
      (!q || n.label.toLowerCase().includes(q) || n.platform.toLowerCase().includes(q))
    );
  }, [nodes, searchQ]);

  const graphData = useMemo(() => ({
    target: rawData.target,
    nodes: filteredNodes,
  }), [rawData.target, filteredNodes]);

  // ── Metrics ──
  const totalAssociates = nodes.filter(n=>!n.hidden).length;
  const strongest = [...nodes].sort((a,b)=>b.score-a.score)[0];
  const mutualCount = nodes.reduce((sum,n)=>sum+(n.mutualConnections||0),0);

  // ── Handlers ──
  const handleToggleType = useCallback((type) => {
    setHiddenTypes(prev => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type); else next.add(type);
      return next;
    });
  }, []);

  const handleHideNode = useCallback((id) => {
    setNodes(prev => prev.map(n => n.id === id ? { ...n, hidden: true } : n));
    if (selectedNode?.id === id) setSelectedNode(null);
  }, [selectedNode]);

  const handleDeleteNode = useCallback((id) => {
    setNodes(prev => prev.filter(n => n.id !== id));
    if (selectedNode?.id === id) setSelectedNode(null);
  }, [selectedNode]);

  const handleExpandNode = useCallback((node) => {
    if (expandedIds.has(node.id)) return;
    setExpandedIds(prev => new Set([...prev, node.id]));
    // Synthesise 2–3 related accounts from the expanded node
    const related = [
      { id:`exp-${node.id}-1`, label:`@${(node.label||"").replace("@","")}_contact1`, type:"mention",  platform:node.platform, score:Math.max(10, node.score-22), mutualConnections:1, sharedUsernames:0, sharedLinks:0, interactions:2, hidden:false },
      { id:`exp-${node.id}-2`, label:`@${(node.label||"").replace("@","")}_assoc2`,   type:"tagged",   platform:node.platform, score:Math.max(10, node.score-38), mutualConnections:0, sharedUsernames:0, sharedLinks:0, interactions:1, hidden:false },
    ].map(n=>({ ...n, strength: getStrength(n.score) }));
    setNodes(prev => [...prev, ...related.filter(r=>!prev.find(p=>p.id===r.id))]);
  }, [expandedIds]);

  const handleAddNode = useCallback((newNode) => {
    const id = `manual-${Date.now()}`;
    setNodes(prev => [...prev, {
      ...newNode, id,
      strength: getStrength(newNode.score),
      mutualConnections: 0, sharedUsernames: 0, sharedLinks: 0, interactions: 0, hidden: false,
    }]);
  }, []);

  const handleShowAll = () => {
    setNodes(prev => prev.map(n => ({ ...n, hidden: false })));
    setHiddenTypes(new Set());
  };

  const TYPE_FILTERS = ["frequent", "mention", "tagged", "linked"];

  return (
    <div className="p-4 md:p-6 space-y-5 page-pad" style={V.page}>

      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="font-bold text-base" style={{ color:"var(--text-primary)" }}>Associate Network Analysis</h2>
          <p className="text-xs mt-0.5" style={{ color:"var(--text-muted)" }}>
            {investigation ? `Case: ${investigation.target} · ${totalAssociates} associates discovered` : "Demo mode — run an OSINT search to populate real data"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowAddModal(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 transition-colors"
            style={{ border:"none", cursor:"pointer" }}>
            <Plus size={13}/>Add Account
          </button>
          <button onClick={handleShowAll}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors"
            style={{ ...V.input, cursor:"pointer" }}>
            <Eye size={13}/>Show All
          </button>
        </div>
      </div>

      {/* ── Metrics Row ── */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 card-grid-3">
        <MetricCard icon={Users}    label="Total Associates"    value={totalAssociates} sub="Unique accounts found" color="#2563eb"/>
        <MetricCard icon={ZapIcon}  label="Strongest Connection" value={strongest?.label || "—"} sub={strongest ? `${strongest.score}% match` : ""} color="#ef4444"/>
        <MetricCard icon={Network}  label="Mutual Account Count" value={mutualCount} sub="Across all associates" color="#8b5cf6"/>
      </div>

      {/* ── View toggle + filters ── */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-1 p-1 rounded-xl w-fit shadow-sm" style={V.card}>
          {["graph","table"].map(v=>(
            <button key={v} onClick={()=>setActiveView(v)}
              className={cn("px-4 py-1.5 rounded-lg text-sm font-medium transition-all",
                activeView===v ? "bg-blue-600 text-white shadow-sm" : "text-slate-500 hover:text-slate-700")}
              style={{ border:"none", cursor:"pointer", background: activeView===v ? "#2563eb" : "transparent" }}>
              {v==="graph" ? "🕸 Network Graph" : "📋 Associate Table"}
            </button>
          ))}
        </div>

        {/* Type filter pills */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {TYPE_FILTERS.map(type=>(
            <button key={type} onClick={()=>handleToggleType(type)}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-all capitalize"
              style={{
                background: hiddenTypes.has(type) ? "var(--bg-input)" : TYPE_COLORS[type]?.bg,
                color: hiddenTypes.has(type) ? "var(--text-muted)" : TYPE_COLORS[type]?.color,
                border: `1px solid ${hiddenTypes.has(type) ? "var(--border)" : TYPE_COLORS[type]?.color+"44"}`,
                cursor:"pointer",
                opacity: hiddenTypes.has(type) ? 0.5 : 1,
              }}>
              {hiddenTypes.has(type) ? <EyeOff size={10}/> : <Eye size={10}/>}
              {type}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg ml-auto" style={V.input}>
          <Search size={13} style={{ color:"var(--text-muted)" }}/>
          <input className="bg-transparent border-none outline-none text-xs w-32"
            style={{ color:"var(--text-primary)" }}
            placeholder="Search accounts…"
            value={searchQ} onChange={e=>setSearchQ(e.target.value)}/>
        </div>
      </div>

      {/* ── Graph View ── */}
      {activeView === "graph" && (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-5">
          {/* Graph panel */}
          <div className="lg:col-span-3 rounded-xl shadow-sm" style={V.card}>
            <div className="flex items-center justify-between px-5 py-4" style={V.inner}>
              <div>
                <h3 className="font-semibold text-sm" style={{ color:"var(--text-primary)" }}>Identity Network</h3>
                <p className="text-xs mt-0.5" style={{ color:"var(--text-muted)" }}>
                  {graphData.nodes.length} associates · Target: {rawData.target.label}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-3" style={{ fontSize:10, color:"var(--text-muted)" }}>
                  {["strong","medium","weak"].map(s=>(
                    <div key={s} className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor:STRENGTH[s].color }}/>
                      <span className="capitalize">{s}</span>
                    </div>
                  ))}
                </div>
                <button className="p-1.5 rounded-lg hover:bg-slate-50 transition-colors"
                  style={{ color:"var(--text-muted)", background:"none", border:"none", cursor:"pointer" }}
                  onClick={handleShowAll}>
                  <RefreshCw size={13}/>
                </button>
              </div>
            </div>

            <div>
              {graphData.nodes.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                  <Network size={28} className="mb-2" style={{ color:"var(--text-muted)" }}/>
                  <p className="text-xs" style={{ color:"var(--text-muted)" }}>No associates match the current filters.</p>
                  <button onClick={handleShowAll} className="mt-3 text-xs text-blue-500 hover:underline" style={{ background:"none",border:"none",cursor:"pointer" }}>Reset filters</button>
                </div>
              ) : (
                <NetworkGraph
                  data={graphData}
                  hiddenTypes={hiddenTypes}
                  selectedNodeId={selectedNode?.id}
                  onSelectNode={setSelectedNode}/>
              )}
            </div>
          </div>

          {/* Inspector panel */}
          <div className="space-y-4">
            <div className="rounded-xl p-5 shadow-sm" style={V.card}>
              <div className="flex items-center gap-2 mb-4" style={V.inner}>
                <h3 className="font-semibold text-sm pb-3" style={{ color:"var(--text-primary)" }}>
                  {selectedNode ? "Account Inspector" : "Node Inspector"}
                </h3>
              </div>
              <NodeInspector
                node={selectedNode}
                allNodes={nodes}
                onExpand={handleExpandNode}
                onHide={handleHideNode}/>
            </div>

            {/* Legend */}
            <div className="rounded-xl p-4 shadow-sm" style={V.card}>
              <h4 className="text-xs font-semibold mb-3" style={{ color:"var(--text-muted)", textTransform:"uppercase", letterSpacing:"0.07em" }}>Node Categories</h4>
              <div className="space-y-2">
                {TYPE_FILTERS.map(type=>{
                  const c = TYPE_COLORS[type];
                  const icons = { frequent:<Hash size={11}/>, mention:<AtSign size={11}/>, tagged:<Hash size={11}/>, linked:<LinkIcon size={11}/> };
                  return (
                    <button key={type} onClick={()=>handleToggleType(type)}
                      className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs transition-all capitalize"
                      style={{ background: hiddenTypes.has(type)?"var(--bg-input)":c.bg, color: hiddenTypes.has(type)?"var(--text-muted)":c.color, border:`1px solid ${hiddenTypes.has(type)?"var(--border)":c.color+"33"}`, cursor:"pointer", opacity: hiddenTypes.has(type)?0.5:1 }}>
                      {icons[type]}<span className="flex-1 text-left">{type.charAt(0).toUpperCase()+type.slice(1)}</span>
                      {hiddenTypes.has(type) ? <EyeOff size={10}/> : <Eye size={10}/>}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Table View ── */}
      {activeView === "table" && (
        <div className="rounded-xl shadow-sm overflow-hidden" style={V.card}>
          <div className="flex items-center justify-between px-5 py-4" style={V.inner}>
            <div>
              <h3 className="font-semibold text-sm" style={{ color:"var(--text-primary)" }}>Associate Directory</h3>
              <p className="text-xs mt-0.5" style={{ color:"var(--text-muted)" }}>{filteredNodes.length} accounts · sorted by connection score</p>
            </div>
          </div>

          <div className="table-wrap overflow-x-auto">
            <table className="w-full" style={{ borderCollapse:"collapse" }}>
              <thead>
                <tr style={{ background:"var(--bg-input)", borderBottom:"1px solid var(--border)" }}>
                  {["Account","Type","Strength","Score","Mutual","Interactions",""].map(h=>(
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold"
                      style={{ color:"var(--text-muted)", whiteSpace:"nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[...filteredNodes]
                  .sort((a,b)=>b.score-a.score)
                  .map(node=>(
                    <AssociateRow
                      key={node.id}
                      node={node}
                      isSelected={selectedNode?.id===node.id}
                      onSelect={n=>{ setSelectedNode(n); setActiveView("graph"); }}
                      onDelete={handleDeleteNode}/>
                  ))}
                {filteredNodes.length===0 && (
                  <tr><td colSpan={7} className="text-center py-12 text-xs" style={{ color:"var(--text-muted)" }}>No associates match your search.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Mutual Connections Detail ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Mutual connections */}
        <div className="rounded-xl p-5 shadow-sm" style={V.card}>
          <h4 className="font-semibold text-xs uppercase tracking-wide mb-4 flex items-center gap-1.5" style={{ color:"var(--text-primary)" }}>
            <Users size={13} style={{ color:"#2563eb" }}/>Mutual Connections
          </h4>
          <div className="space-y-2">
            {[...filteredNodes].sort((a,b)=>b.mutualConnections-a.mutualConnections).slice(0,6).map(n=>(
              <div key={n.id} className="flex items-center justify-between px-3 py-2 rounded-lg"
                style={{ background:"var(--bg-input)" }}>
                <div>
                  <div className="text-xs font-medium" style={{ color:"var(--text-primary)", fontFamily:"monospace" }}>{n.label}</div>
                  <div className="text-xs" style={{ color:"var(--text-muted)" }}>
                    {n.sharedUsernames > 0 && `${n.sharedUsernames} shared username · `}
                    {n.sharedLinks > 0 && `${n.sharedLinks} shared link`}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold" style={{ color:"var(--text-sec)", fontFamily:"monospace" }}>{n.mutualConnections}</span>
                  <StrengthBadge strength={n.strength}/>
                </div>
              </div>
            ))}
            {filteredNodes.length===0 && <p className="text-xs text-center py-4" style={{ color:"var(--text-muted)" }}>No data.</p>}
          </div>
        </div>

        {/* Mention Network */}
        <div className="rounded-xl p-5 shadow-sm" style={V.card}>
          <h4 className="font-semibold text-xs uppercase tracking-wide mb-4 flex items-center gap-1.5" style={{ color:"var(--text-primary)" }}>
            <AtSign size={13} style={{ color:"#4f46e5" }}/>Mention & Tag Network
          </h4>
          <div className="space-y-2">
            {filteredNodes.filter(n=>["mention","tagged"].includes(n.type)).slice(0,6).map(n=>(
              <div key={n.id} className="flex items-center gap-3 px-3 py-2 rounded-lg"
                style={{ background:"var(--bg-input)" }}>
                <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold"
                  style={{ background:TYPE_COLORS[n.type]?.bg, color:TYPE_COLORS[n.type]?.color, fontFamily:"monospace" }}>
                  {(n.label||"").replace("@","").slice(0,2).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium truncate" style={{ color:"var(--text-primary)", fontFamily:"monospace" }}>{n.label}</div>
                  <div className="text-xs" style={{ color:"var(--text-muted)" }}>{n.interactions} interactions · {n.platform}</div>
                </div>
                <TypePill type={n.type}/>
              </div>
            ))}
            {filteredNodes.filter(n=>["mention","tagged"].includes(n.type)).length===0 && (
              <p className="text-xs text-center py-4" style={{ color:"var(--text-muted)" }}>No mention/tagged accounts.</p>
            )}
          </div>
        </div>
      </div>

      {/* ── Frequently Appearing Accounts ── */}
      <div className="rounded-xl p-5 shadow-sm" style={V.card}>
        <h4 className="font-semibold text-xs uppercase tracking-wide mb-4 flex items-center gap-1.5" style={{ color:"var(--text-primary)" }}>
          <ZapIcon size={13} style={{ color:"#f97316" }}/>Frequently Appearing Accounts
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 card-grid-3">
          {filteredNodes.filter(n=>n.type==="frequent"||n.interactions>=5).slice(0,6).map(n=>(
            <div key={n.id} className="rounded-lg p-3 flex items-center gap-3"
              style={{ background:"var(--bg-input)", border:`1px solid ${STRENGTH[n.strength]?.color}22` }}>
              <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold text-white"
                style={{ background:`linear-gradient(135deg,${STRENGTH[n.strength]?.color},${STRENGTH[n.strength]?.color}88)`, fontFamily:"monospace" }}>
                {(n.label||"").replace("@","").slice(0,2).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-medium truncate" style={{ color:"var(--text-primary)", fontFamily:"monospace" }}>{n.label}</div>
                <div className="text-xs" style={{ color:"var(--text-muted)" }}>{n.interactions}× · {n.platform}</div>
              </div>
              <StrengthBadge strength={n.strength}/>
            </div>
          ))}
          {filteredNodes.filter(n=>n.type==="frequent"||n.interactions>=5).length===0 && (
            <p className="text-xs col-span-3 text-center py-4" style={{ color:"var(--text-muted)" }}>No frequently appearing accounts.</p>
          )}
        </div>
      </div>

      {/* ── CTA ── */}
      {setActivePage && (
        <button onClick={()=>setActivePage("report")}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-white text-sm font-medium transition-colors bg-blue-600 hover:bg-blue-700"
          style={{ border:"none", cursor:"pointer" }}>
          Include in Forensic Report <ChevronRight size={14}/>
        </button>
      )}

      {/* ── Add Modal ── */}
      {showAddModal && <AddAccountModal onAdd={handleAddNode} onClose={()=>setShowAddModal(false)}/>}
    </div>
  );
}
