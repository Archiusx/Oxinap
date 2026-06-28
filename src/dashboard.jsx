import { useState, useEffect, useMemo, Fragment, useRef } from "react";
import { saveIgPosts, getIgPosts } from "./postsDB";
import { uploadAttachmentToCloudinary } from "./cloudinaryUpload";
import { PieChart, Pie, Cell, Tooltip, AreaChart, Area, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from "recharts";
import { auth } from "./firebase";
import { saveInvestigation, subscribeRecentInvestigations, fetchRecentInvestigations, deleteInvestigation, updateInvestigation, analyzeContent, grantCaseAccess, listCaseAccess, revokeCaseAccess, fetchSharedWithMe, fetchPendingInvites, acceptCaseInvite, declineCaseInvite } from "./investigationStore";
import { runPublicOsintInvestigation, detectTargetType, saveRuntimeGeminiApiKey, hasGeminiApiKey, getDisplayFields } from "./osintTools";
import { signOut } from "firebase/auth";
import { useLang, LANGUAGES } from "./LanguageContext";
import ImageAnalysisPage from "./ImageAnalysisPage";
// ── Icons ──
const Ico = (d) => ({ size=16, className="", style={} }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className} style={style}>
    {Array.isArray(d) ? d.map((p,i)=><path key={i} d={p}/>) : <path d={d}/>}
  </svg>
);
const IcoEl = (ch) => ({ size=16, className="", style={} }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className} style={style}>{ch}</svg>
);
const Moon = Ico(["M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"]);
const Sun = IcoEl([<circle key="c" cx="12" cy="12" r="5"/>,<line key="l1" x1="12" y1="1" x2="12" y2="3"/>,<line key="l2" x1="12" y1="21" x2="12" y2="23"/>,<line key="l3" x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>,<line key="l4" x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>,<line key="l5" x1="1" y1="12" x2="3" y2="12"/>,<line key="l6" x1="21" y1="12" x2="23" y2="12"/>]);
const MenuIcon = IcoEl([<line key="a" x1="3" y1="6" x2="21" y2="6"/>,<line key="b" x1="3" y1="12" x2="21" y2="12"/>,<line key="c" x1="3" y1="18" x2="21" y2="18"/>]);
const XIcon = IcoEl([<line key="a" x1="18" y1="6" x2="6" y2="18"/>,<line key="b" x1="6" y1="6" x2="18" y2="18"/>]);
const Shield = IcoEl([<path key="s" d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>]);
const LayoutDashboard = IcoEl([<rect key="a" x="3" y="3" width="7" height="7" rx="1"/>,<rect key="b" x="14" y="3" width="7" height="7" rx="1"/>,<rect key="c" x="3" y="14" width="7" height="7" rx="1"/>,<rect key="d" x="14" y="14" width="7" height="7" rx="1"/>]);
const Search = IcoEl([<circle key="c" cx="11" cy="11" r="8"/>,<line key="l" x1="21" y1="21" x2="16.65" y2="16.65"/>]);
const Database = IcoEl([<ellipse key="e" cx="12" cy="5" rx="9" ry="3"/>,<path key="p1" d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/>,<path key="p2" d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/>]);
const Brain = Ico("M12 5a3 3 0 1 0-5.997.142 4 4 0 0 0-2.526 5.77 4 4 0 0 0 .556 6.588 4 4 0 0 0 7.636 2.106 3.2 3.2 0 0 0 .164-.546c.028-.13.058-.26.126-.38a4 4 0 0 0 0-7.208 3.2 3.2 0 0 0-.126-.38 3.2 3.2 0 0 0-.164-.546A3 3 0 0 0 12 5z");
const Network = IcoEl([<circle key="n1" cx="12" cy="5" r="3"/>,<circle key="n2" cx="5" cy="19" r="3"/>,<circle key="n3" cx="19" cy="19" r="3"/>,<line key="l1" x1="12" y1="8" x2="5.5" y2="16"/>,<line key="l2" x1="12" y1="8" x2="18.5" y2="16"/>]);
const Clock = IcoEl([<circle key="c" cx="12" cy="12" r="10"/>,<polyline key="p" points="12 6 12 12 16 14"/>]);
const FileText = IcoEl([<path key="p1" d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>,<polyline key="p2" points="14 2 14 8 20 8"/>,<line key="l1" x1="16" y1="13" x2="8" y2="13"/>,<line key="l2" x1="16" y1="17" x2="8" y2="17"/>]);
const BarChart3 = IcoEl([<path key="a" d="M3 3v18h18"/>,<path key="b" d="M18 17V9"/>,<path key="c" d="M13 17V5"/>,<path key="d" d="M8 17v-3"/>]);
const Settings = IcoEl([<circle key="c" cx="12" cy="12" r="3"/>,<path key="p" d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>]);
const Bell = IcoEl([<path key="p1" d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>,<path key="p2" d="M13.73 21a2 2 0 0 1-3.46 0"/>]);
const User = IcoEl([<path key="p" d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>,<circle key="c" cx="12" cy="7" r="4"/>]);
const Plus = Ico("M12 5v14M5 12h14");
const Upload = IcoEl([<path key="p" d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>,<polyline key="pl" points="17 8 12 3 7 8"/>,<line key="l" x1="12" y1="3" x2="12" y2="15"/>]);
const CheckCircle2 = IcoEl([<circle key="c" cx="12" cy="12" r="10"/>,<path key="p" d="m9 12 2 2 4-4"/>]);
const Loader2 = IcoEl([<path key="p" d="M21 12a9 9 0 1 1-6.219-8.56"/>]);
const TrendingUp = IcoEl([<polyline key="p1" points="22 7 13.5 15.5 8.5 10.5 2 17"/>,<polyline key="p2" points="16 7 22 7 22 13"/>]);
const Users = IcoEl([<path key="p1" d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>,<circle key="c" cx="9" cy="7" r="4"/>,<path key="p2" d="M23 21v-2a4 4 0 0 0-3-3.87"/>,<path key="p3" d="M16 3.13a4 4 0 0 1 0 7.75"/>]);
const Download = IcoEl([<path key="p" d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>,<polyline key="pl" points="7 10 12 15 17 10"/>,<line key="l" x1="12" y1="15" x2="12" y2="3"/>]);
const Share2 = IcoEl([<circle key="c1" cx="18" cy="5" r="3"/>,<circle key="c2" cx="6" cy="12" r="3"/>,<circle key="c3" cx="18" cy="19" r="3"/>,<line key="l1" x1="8.59" y1="13.51" x2="15.42" y2="17.49"/>,<line key="l2" x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>]);
const Filter = IcoEl([<polygon key="p" points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>]);
const Hash = Ico("M4 9h16M4 15h16M10 3 8 21M16 3l-2 18");
const AtSign = IcoEl([<circle key="c" cx="12" cy="12" r="4"/>,<path key="p" d="M16 8v5a3 3 0 0 0 6 0v-1a10 10 0 1 0-3.92 7.94"/>]);
const Phone = IcoEl([<path key="p" d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.36 12a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.11 1h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9a16 16 0 0 0 6.29 6.29l.38-.38a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>]);
const LinkIcon = IcoEl([<path key="p1" d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>,<path key="p2" d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>]);
const RefreshCw = IcoEl([<path key="p1" d="M3 2v6h6"/>,<path key="p2" d="M21 12A9 9 0 0 0 6 5.3L3 8"/>,<path key="p3" d="M21 22v-6h-6"/>,<path key="p4" d="M3 12a9 9 0 0 0 15 6.7l3-2.7"/>]);
const Calendar = IcoEl([<rect key="r" x="3" y="4" width="18" height="18" rx="2" ry="2"/>,<line key="l1" x1="16" y1="2" x2="16" y2="6"/>,<line key="l2" x1="8" y1="2" x2="8" y2="6"/>,<line key="l3" x1="3" y1="10" x2="21" y2="10"/>]);
const Activity = IcoEl([<polyline key="p" points="22 12 18 12 15 21 9 3 6 12 2 12"/>]);
const Fingerprint = IcoEl([<path key="p1" d="M2 12C2 6.5 6.5 2 12 2a10 10 0 0 1 8 4"/>,<path key="p2" d="M5 19.5C5.5 18 6 15 6 12c0-.7.12-1.37.34-2"/>,<path key="p3" d="M17.29 21.02c.12-.6.43-2.3.5-3.02"/>,<path key="p4" d="M12 10a2 2 0 0 0-2 2c0 1.02-.1 2.51-.26 4"/>,<path key="p5" d="M8.65 22c.21-.66.45-1.32.57-2"/>,<path key="p6" d="M14 13.12c0 2.38 0 6.38-1 8.88"/>]);
const AlertCircle = IcoEl([<circle key="c" cx="12" cy="12" r="10"/>,<line key="l1" x1="12" y1="8" x2="12" y2="12"/>,<line key="l2" x1="12" y1="16" x2="12.01" y2="16"/>]);
const Zap = Ico("M13 2 3 14h9l-1 8 10-12h-9l1-8z");
const ChevronRight = Ico("M9 18l6-6-6-6");
const ArrowUpRight = Ico("M7 7h10v10M7 17 17 7");
const MoreHorizontal = IcoEl([<circle key="c1" cx="12" cy="12" r="1"/>,<circle key="c2" cx="19" cy="12" r="1"/>,<circle key="c3" cx="5" cy="12" r="1"/>]);
const Globe = IcoEl([<circle key="c" cx="12" cy="12" r="10"/>,<line key="l" x1="2" y1="12" x2="22" y2="12"/>,<path key="p" d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>]);
const AlertTriangle = IcoEl([<path key="p" d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>,<line key="l1" x1="12" y1="9" x2="12" y2="13"/>,<line key="l2" x1="12" y1="17" x2="12.01" y2="17"/>]);
const Circle = IcoEl([<circle key="c" cx="12" cy="12" r="10"/>]);
const Flag = IcoEl([<path key="p" d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/>,<line key="l" x1="4" y1="22" x2="4" y2="15"/>]);
const Eye = IcoEl([<path key="p" d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>,<circle key="c" cx="12" cy="12" r="3"/>]);
const Info = IcoEl([<circle key="c" cx="12" cy="12" r="10"/>,<line key="l1" x1="12" y1="16" x2="12" y2="12"/>,<line key="l2" x1="12" y1="8" x2="12.01" y2="8"/>]);
const Target = IcoEl([<circle key="c1" cx="12" cy="12" r="10"/>,<circle key="c2" cx="12" cy="12" r="6"/>,<circle key="c3" cx="12" cy="12" r="2"/>]);
const Mail = IcoEl([<path key="p" d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>,<polyline key="pl" points="22,6 12,13 2,6"/>]);
const ImageIcon = IcoEl([<rect key="r" x="3" y="3" width="18" height="18" rx="2" ry="2"/>,<circle key="c" cx="8.5" cy="8.5" r="1.5"/>,<polyline key="p" points="21 15 16 10 5 21"/>]);
const ChevronDown = Ico("m6 9 6 6 6-6");
const Check = Ico("M20 6 9 17l-5-5");
const Scan = IcoEl([<path key="p1" d="M3 7V5a2 2 0 0 1 2-2h2"/>,<path key="p2" d="M17 3h2a2 2 0 0 1 2 2v2"/>,<path key="p3" d="M21 17v2a2 2 0 0 1-2 2h-2"/>,<path key="p4" d="M7 21H5a2 2 0 0 1-2-2v-2"/>,<line key="l" x1="7" y1="12" x2="17" y2="12"/>]);
const MapPin = IcoEl([<path key="p" d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>,<circle key="c" cx="12" cy="10" r="3"/>]);
const CreditCard = IcoEl([<rect key="r" x="1" y="4" width="22" height="16" rx="2" ry="2"/>,<line key="l" x1="1" y1="10" x2="23" y2="10"/>]);
const Award = IcoEl([<circle key="c" cx="12" cy="8" r="7"/>,<polyline key="p1" points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"/>]);
const BookOpen = IcoEl([<path key="p1" d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/>,<path key="p2" d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>]);
const FolderOpen = IcoEl([<path key="p1" d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>,<polyline key="p2" points="2 9 22 9"/>]);
const Key = IcoEl([<path key="p" d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/>]);
const Building = IcoEl([<rect key="r" x="4" y="2" width="16" height="20" rx="2" ry="2"/>,<path key="p1" d="M9 22v-4h6v4"/>,<path key="p2" d="M8 6h.01M16 6h.01M12 6h.01M12 10h.01M8 10h.01M16 10h.01M12 14h.01M8 14h.01M16 14h.01"/>]);
const ExternalLink = IcoEl([<path key="p" d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>,<polyline key="pl" points="15 3 21 3 21 9"/>,<line key="l" x1="10" y1="14" x2="21" y2="3"/>]);
const Lock = IcoEl([<rect key="r" x="3" y="11" width="18" height="11" rx="2" ry="2"/>,<path key="p" d="M7 11V7a5 5 0 0 1 10 0v4"/>]);
const Trash2 = IcoEl([<polyline key="pl" points="3 6 5 6 21 6"/>,<path key="p1" d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>,<line key="l1" x1="10" y1="11" x2="10" y2="17"/>,<line key="l2" x1="14" y1="11" x2="14" y2="17"/>]);
const GitMerge = IcoEl([<circle key="c1" cx="18" cy="18" r="3"/>,<circle key="c2" cx="6" cy="6" r="3"/>,<path key="p1" d="M6 9v6a6 6 0 0 0 6 6h3"/>,<path key="p2" d="M15 9a6 6 0 0 1-6 6"/>]);
const Tag = IcoEl([<path key="p" d="M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.42 0l6.58-6.58a2.426 2.426 0 0 0 0-3.42z"/>,<circle key="c" cx="7.5" cy="7.5" r="1.5"/>]);
const SquareIcon = IcoEl([<rect key="r" x="3" y="3" width="18" height="18" rx="3"/>]);
const CheckSquareIcon = IcoEl([<path key="p1" d="M9 11l3 3L22 4"/>,<path key="p2" d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>]);

// ── Language Switcher ──
function LanguageSwitcher() {
  const { lang, setLang, t } = useLang();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    function handler(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false); }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);
  const current = LANGUAGES.find(l => l.code === lang) || LANGUAGES[0];
  return (
    <div ref={ref} style={{ position:"relative" }}>
      <button
        onClick={() => setOpen(o => !o)}
        title={t.selectLanguage}
        style={{
          display:"flex", alignItems:"center", gap:5, height:34, padding:"0 10px",
          borderRadius:8, cursor:"pointer", border:"1px solid var(--border)",
          background:"var(--bg-input)", color:"var(--text-sec)", fontSize:12, fontWeight:500,
        }}
      >
        <span style={{ fontSize:15 }}>{current.flag}</span>
        <span style={{ fontFamily:"monospace", letterSpacing:"0.03em" }}>{current.native}</span>
        <svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" style={{ opacity:0.6 }}><path d="m6 9 6 6 6-6"/></svg>
      </button>
      {open && (
        <div style={{
          position:"absolute", top:"calc(100% + 6px)", right:0, zIndex:200,
          background:"var(--bg-card)", border:"1px solid var(--border)",
          borderRadius:10, padding:"4px 0", minWidth:150,
          boxShadow:"0 8px 24px rgba(0,0,0,0.12)",
        }}>
          <div style={{ padding:"6px 12px 4px", fontSize:10, fontWeight:600, letterSpacing:"0.08em", color:"var(--text-muted)", textTransform:"uppercase" }}>{t.language}</div>
          {LANGUAGES.map(lng => (
            <button
              key={lng.code}
              onClick={() => { setLang(lng.code); setOpen(false); }}
              style={{
                display:"flex", alignItems:"center", gap:9, width:"100%", padding:"7px 12px",
                background: lang === lng.code ? "var(--bg-active)" : "transparent",
                border:"none", cursor:"pointer", fontSize:13, color:"var(--text-primary)",
                textAlign:"left", transition:"background 0.15s",
              }}
            >
              <span style={{ fontSize:16 }}>{lng.flag}</span>
              <span style={{ flex:1 }}>{lng.native}</span>
              {lang === lng.code && <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Data ──

function formatRelativeTime(timestampMs) {
  if (!timestampMs) return "Just now";
  const diffSeconds = Math.max(0, Math.floor((Date.now() - timestampMs) / 1000));
  if (diffSeconds < 10) return "Just now";
  if (diffSeconds < 60) return `${diffSeconds} Sec ago`;
  const diffMinutes = Math.floor(diffSeconds / 60);
  if (diffMinutes < 60) return `${diffMinutes} Min ago`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours} Hr ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 30) return `${diffDays} Day${diffDays === 1 ? "" : "s"} ago`;
  return new Date(timestampMs).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function normalizeRecentInvestigation(inv) {
  return {
    ...inv,
    platforms: inv.platforms?.length ? inv.platforms : ["Public OSINT"],
    date: inv.createdAtMs ? formatRelativeTime(inv.createdAtMs) : inv.date,
  };
}

const riskFill = {
  critical: { fill: "#fff1f2", stroke: "#ef4444", glow: "rgba(239,68,68,0.2)" },
  high:     { fill: "#fff7ed", stroke: "#f97316", glow: "rgba(249,115,22,0.2)" },
  medium:   { fill: "#fefce8", stroke: "#eab308", glow: "rgba(234,179,8,0.2)" },
  low:      { fill: "#f0fdf4", stroke: "#22c55e", glow: "rgba(34,197,94,0.2)" },
};

// ── Shared Components ──
function cn(...a) { return a.filter(Boolean).join(" "); }

function RiskBadge({ risk }) {
  const safe = (risk && typeof risk === "string") ? risk.toLowerCase() : "unknown";
  const map = { critical:"bg-red-50 text-red-700 ring-red-200", high:"bg-orange-50 text-orange-700 ring-orange-200", medium:"bg-amber-50 text-amber-700 ring-amber-200", low:"bg-green-50 text-green-700 ring-green-200", unknown:"bg-slate-100 text-slate-500 ring-slate-200" };
  const dot = { critical:"bg-red-500", high:"bg-orange-500", medium:"bg-amber-500", low:"bg-green-500", unknown:"bg-slate-400" };
  const label = map[safe] ? safe : "unknown";
  return <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ring-1", map[label])}><span className={cn("w-1.5 h-1.5 rounded-full", dot[label])}/>{label.charAt(0).toUpperCase()+label.slice(1)}</span>;
}

function StatusBadge({ status }) {
  const map = { Active:"bg-blue-50 text-blue-700 ring-1 ring-blue-200", Analysis:"bg-violet-50 text-violet-700 ring-1 ring-violet-200", Collection:"bg-cyan-50 text-cyan-700 ring-1 ring-cyan-200", Completed:"bg-slate-100 text-slate-600 ring-1 ring-slate-200" };
  return <span className={cn("inline-flex px-2 py-0.5 rounded-full text-xs font-medium", map[status]||"bg-slate-100 text-slate-600")}>{status}</span>;
}

function ScoreBar({ score, color="#2563eb" }) {
  return <div className="flex items-center gap-3"><div className="flex-1 bg-slate-100 rounded-full h-1.5"><div className="h-1.5 rounded-full" style={{ width:`${score}%`, backgroundColor:color }}/></div><span className="text-xs font-medium tabular-nums text-slate-600 w-8 text-right" style={{ fontFamily:"monospace" }}>{score}%</span></div>;
}

function PlatformPill({ abbr, color }) {
  return <span className="inline-flex items-center justify-center w-6 h-6 rounded-md text-white font-bold" style={{ backgroundColor:color, fontSize:10, fontFamily:"monospace" }}>{abbr}</span>;
}

function FieldCell({ icon:Ic, label, value, span }) {
  const empty = !value || value === "Not public" || value === "Not listed publicly" || value === "Not listed in bio";
  return <div className={cn("min-w-0", span ? "col-span-2" : "")}>
    <div className="flex items-center gap-1" style={{ fontSize:9.5, textTransform:"uppercase", letterSpacing:"0.03em", color:"#94a3b8" }}><Ic size={9}/>{label}</div>
    <div className="truncate font-medium" style={{ fontSize:11, color: empty ? "#94a3b8" : "var(--text-primary)", fontStyle: empty ? "italic" : "normal" }}>{empty ? "Not public" : value}</div>
  </div>;
}

// ── CSS Vars inline style helper ──
const V = {
  page: { background:"var(--bg-page)" },
  card: { background:"var(--bg-card)", border:"1px solid var(--border)" },
  topnav: { background:"var(--bg-topnav)", borderBottom:"1px solid var(--border)" },
  sidebar: { backgroundColor:"var(--bg-sidebar)", borderRight:"1px solid var(--sidebar-border)" },
  inner: { borderBottom:"1px solid var(--border-inner)" },
};

// ── Sidebar ──
// NOTE: `id` is the page that gets rendered (several nav entries intentionally
// point at the same page, e.g. "New Investigation" and "OSINT Collection" both
// open the OSINT page). `navKey` is unique per row and is the ONLY thing used
// to decide which single sidebar row is highlighted — this keeps multiple
// entries that share a page id from all lighting up at once.
const navItemDefs = [
  { id:"dashboard",  navKey:"dashboard",         tKey:"dashboard",        icon:LayoutDashboard, group:"main" },
  { id:"osint",      navKey:"osint-collection",  tKey:"osintCollection",   icon:Database,        group:"work" },
  { id:"case-inventory", navKey:"case-inventory", tKey:"caseInventory",   icon:FolderOpen,        group:"main" },
  { id:"ai-analysis",navKey:"ai-analysis",        tKey:"aiAnalysis",        icon:Brain,           group:"work" },
  { id:"crypto-wallet", navKey:"crypto-wallet",   tKey:"cryptoWallet",      icon:Search,          group:"work" },
  { id:"vehicle",    navKey:"vehicle",            tKey:"vehicleVerify",     icon:Search,          group:"work" },
  { id:"graph",      navKey:"relationship-graph", tKey:"relationshipGraph", icon:Network,         group:"work" },
  { id:"graph",      navKey:"timeline",           tKey:"timeline",          icon:Clock,           group:"work" },
  { id:"content",    navKey:"content",            tKey:"contentAnalysis",   icon:Hash,            group:"work" },
  { id:"image-analysis", navKey:"image-analysis", tKey:"imageAnalysis",     icon:ImageIcon,       group:"work" },
  { id:"access",     navKey:"access",             tKey:"accessControl",     icon:Lock,            group:"work" },
  { id:"report",     navKey:"report",             tKey:"reports",           icon:FileText,        group:"output" },
  { id:"dashboard",  navKey:"analytics",          tKey:"analytics",         icon:BarChart3,       group:"output" },
  { id:"settings",   navKey:"settings",           tKey:"settings",          icon:Settings,        group:"system" },
];

function Sidebar({ activePage, setActivePage, sidebarOpen, setSidebarOpen, user, onLogout, investigation }) {
  const { t } = useLang();
  const displayName = user?.fullName || user?.displayName || user?.email?.split("@")[0] || "Operative";
  const designation = user?.designation || user?.role || "Analyst";
  const initials = displayName.split(" ").map(w=>w[0]).join("").toUpperCase().slice(0,2) || "OP";
  const navItems = navItemDefs.map(item => ({ ...item, label: t[item.tKey] || item.tKey }));

  // Highlighting is keyed off `navKey`, not `id` — several nav rows intentionally
  // share the same page id (e.g. "New Investigation" / "OSINT Collection" both
  // open the OSINT page), so highlighting by id would light up every row that
  // shares it. Clicking a row always sets the exact navKey that was clicked.
  // If the page changes from somewhere else in the app (stepper, dashboard
  // buttons, etc.) and the currently-highlighted row no longer matches that
  // page, fall back to the first nav row defined for that page id.
  const [activeNavKey, setActiveNavKey] = useState(() => navItemDefs.find(i => i.id === activePage)?.navKey || null);
  useEffect(() => {
    const current = navItemDefs.find(i => i.navKey === activeNavKey);
    if (!current || current.id !== activePage) {
      setActiveNavKey(navItemDefs.find(i => i.id === activePage)?.navKey || null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePage]);

  const hasActiveCase = !!investigation?.id;

  return <Fragment>
    <div className={cn("sidebar-overlay", sidebarOpen?"open":"")} onClick={()=>setSidebarOpen(false)}/>
    <aside className={cn("sidebar-drawer flex flex-col h-full overflow-y-auto scrollbar-thin", sidebarOpen?"open":"")} style={{ width:220, minWidth:220, ...V.sidebar }}>
      <div className="flex items-center gap-3 px-4 py-5" style={{ borderBottom:"1px solid var(--sidebar-border)" }}>
        <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background:"linear-gradient(135deg,#2563eb,#4f46e5)" }}><Shield size={15} className="text-white"/></div>
        <div className="min-w-0 flex-1">
          <div className="text-white font-semibold leading-tight tracking-wide" style={{ fontSize:11, fontFamily:"monospace" }}>{t.appName}</div>
          <div className="text-blue-400 leading-tight tracking-widest" style={{ fontSize:10, fontFamily:"monospace" }}>{t.appVersion}</div>
        </div>
        <button className="menu-btn ml-auto p-1 rounded text-slate-400 hover:text-white" onClick={()=>setSidebarOpen(false)}><XIcon size={16}/></button>
      </div>
      <nav className="flex-1 py-4 px-2">
        <div className="mx-2 mb-4 px-3 py-2 rounded-lg" style={hasActiveCase
          ? { backgroundColor:"rgba(34,197,94,0.1)", border:"1px solid rgba(34,197,94,0.25)" }
          : { backgroundColor:"var(--sidebar-badge-bg)", border:"1px solid var(--sidebar-badge-border)" }}>
          <div className="flex items-center gap-2">
            <span className={cn("w-1.5 h-1.5 rounded-full", hasActiveCase ? "bg-green-400 animate-pulse" : "bg-red-400")}/>
            <span className={cn("font-medium", hasActiveCase ? "text-green-300" : "text-red-300")} style={{ fontSize:10 }}>
              {hasActiveCase ? t.activeCase : (t.noActiveCase || "NO ACTIVE CASES")}
            </span>
          </div>
          <div className="text-slate-400 mt-0.5" style={{ fontSize:10, fontFamily:"monospace" }}>
            {hasActiveCase ? investigation.id : (t.startInvestigationHint || "Start a new investigation")}
          </div>
        </div>
        {["main","work","output","system"].map(group => {
          const items = navItems.filter(i=>i.group===group);
          const labelKeys = { main:"", work:"investigation", output:"output", system:"system" };
          const groupLabel = labelKeys[group] ? (t[labelKeys[group]] || labelKeys[group]).toUpperCase() : "";
          return <div key={group} className={group!=="main"?"pt-3":""}>
            {groupLabel && <div className="px-3 pb-1.5"><span className="font-semibold tracking-widest" style={{ color:"rgba(148,163,184,0.5)", fontSize:10 }}>{groupLabel}</span></div>}
            {items.map((item) => {
              const isActive = activeNavKey===item.navKey;
              return <button key={item.navKey} onClick={()=>{ setActivePage(item.id); setActiveNavKey(item.navKey); setSidebarOpen(false); }} className={cn("w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-all", isActive?"text-white":"text-slate-400 hover:text-slate-200")} style={isActive?{ backgroundColor:"var(--bg-active)" }:{}}>
                <item.icon size={15} className={isActive?"text-blue-400":"text-slate-500"}/>
                <span className="text-sm">{item.label}</span>
                {isActive && <span className="ml-auto w-1 h-4 rounded-full bg-blue-400"/>}
              </button>;
            })}
          </div>;
        })}
      </nav>
      <div className="px-4 py-4" style={{ borderTop:"1px solid var(--sidebar-border)" }}>
        <div className="flex items-center gap-2.5 mb-2">
          {user?.photoURL
            ? <img src={user.photoURL} referrerPolicy="no-referrer" alt={displayName} className="w-7 h-7 rounded-full flex-shrink-0 object-cover" style={{ border:"1.5px solid rgba(99,102,241,0.5)" }}/>
            : <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0" style={{ background:"linear-gradient(135deg,#3b82f6,#4f46e5)" }}><span className="text-white font-bold" style={{ fontSize:10 }}>{initials}</span></div>
          }
          <div className="min-w-0 flex-1"><div className="text-slate-200 text-xs font-medium truncate">{displayName}</div><div className="text-slate-500 truncate" style={{ fontSize:10 }}>{designation}</div></div>
        </div>
        <button onClick={onLogout} className="w-full flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg text-red-400 hover:text-red-300 hover:bg-red-900/20 transition-colors" style={{ fontSize:11, fontWeight:500, border:"1px solid rgba(239,68,68,0.2)", background:"rgba(239,68,68,0.06)" }}>
          <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
          {t.signOut}
        </button>
      </div>
    </aside>
  </Fragment>;
}

// ── TopNav ──
const pageTitleKeys = {
  dashboard:    { title:"pageTitle_dashboard",  sub:"pageSub_dashboard" },
  osint:        { title:"pageTitle_osint",      sub:null },
  "ai-analysis":{ title:"pageTitle_aiAnalysis", sub:"pageSub_aiAnalysis" },
  graph:        { title:"pageTitle_graph",      sub:"pageSub_graph" },
  content:      { title:"Content & Keyword Analysis", sub:"Keyword frequency, hashtags, tone, and cross-posting signals" },
  "image-analysis": { title:"Image Analysis", sub:"Standalone OCR, object/landmark detection, EXIF, and language ID — not linked to any case" },
  access:       { title:"Access Control",             sub:"Manage who can view or edit this case" },
  report:       { title:"pageTitle_report",     sub:"pageSub_report" },
  settings:     { title:"Settings", sub:"Your profile, investigation stats, and preferences" },
  "case-inventory":  { title:"Case Inventory",             sub:"All saved investigations — view, edit, attach files, and manage cases" },
  "crypto-wallet":   { title:"Crypto Wallet & Tx OSINT",   sub:"Transaction ID lookup · Wallet intelligence · Fund flow · BitQuery V2" },
};

function TopNav({ activePage, setActivePage, dark, setDark, setSidebarOpen, user, onLogout, investigation }) {
  const { t } = useLang();
  const keys = pageTitleKeys[activePage] || pageTitleKeys.dashboard;
  const title = t[keys.title] || keys.title;
  // A couple of the localized subtitles embed a hardcoded sample case id
  // ("INV-2024-089") — swap that for whichever case is actually loaded
  // (or a neutral placeholder when nothing is loaded) instead of always
  // showing the same fake id.
  const sub = keys.sub
    ? (t[keys.sub] || keys.sub).replace("INV-2024-089", investigation?.id || "No case loaded")
    : "";
  const displayName = user?.fullName || user?.displayName || user?.email?.split("@")[0] || "Operative";
  const initials = displayName.split(" ").map(w=>w[0]).join("").toUpperCase().slice(0,2) || "OP";
  const steps = [
    { id:"dashboard",   label: t.step1 }, { id:"osint",       label: t.step2 },
    { id:"ai-analysis", label: t.step3 }, { id:"graph",       label: t.step4 }, { id:"report", label: t.step5 },
  ];
  const stepIdx = steps.findIndex(s=>s.id===activePage);
  return <header className="dk-topnav flex flex-col flex-shrink-0" style={V.topnav}>
    <div className="flex items-center justify-between px-4 md:px-6 h-14">
      <div className="flex items-center gap-3 min-w-0">
        <button className="menu-btn p-2 rounded-lg transition-colors flex-shrink-0" style={{ background:"var(--bg-input)", border:"1px solid var(--border)", color:"var(--text-sec)" }} onClick={()=>setSidebarOpen(true)}><MenuIcon size={16}/></button>
        <div className="min-w-0">
          <h1 className="font-semibold text-sm md:text-base leading-tight truncate" style={{ color:"var(--text-primary)" }}>{title}</h1>
          {sub && <p className="text-xs mt-0.5 truncate hidden sm:block" style={{ color:"var(--text-muted)" }}>{sub}</p>}
        </div>
      </div>
      <div className="flex items-center gap-2 ml-3 flex-shrink-0">
        <div className="stepper-bar hidden lg:flex items-center gap-1">
          {steps.map((step,i)=><button key={step.id} onClick={()=>setActivePage(step.id)} className={cn("flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors", i===stepIdx?"bg-blue-600 text-white":i<stepIdx?"bg-blue-50 text-blue-600":"text-slate-400 hover:text-slate-600")}>
            {i<stepIdx && <Check size={10}/>}{step.label}
          </button>)}
        </div>
        <div className="hidden lg:block w-px h-5" style={{ background:"var(--border)" }}/>
        <LanguageSwitcher />
        <button className="theme-toggle" onClick={()=>setDark(!dark)} title={dark?"Light mode":"Dark mode"} style={{ display:"flex",alignItems:"center",justifyContent:"center",width:34,height:34,borderRadius:8,cursor:"pointer",border:"1px solid var(--border)",background:"var(--bg-input)",color:"var(--text-sec)" }}>
          {dark ? <Sun size={15}/> : <Moon size={15}/>}
        </button>
        <button className="relative p-2 rounded-lg" style={{ color:"var(--text-muted)" }}><Bell size={17}/><span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full"/></button>
        <div className="flex items-center gap-2">
          {user?.photoURL
            ? <img src={user.photoURL} referrerPolicy="no-referrer" alt={displayName} className="w-7 h-7 rounded-full flex-shrink-0 object-cover" style={{ border:"1.5px solid rgba(99,102,241,0.5)" }}/>
            : <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0" style={{ background:"linear-gradient(135deg,#3b82f6,#4f46e5)" }}><span className="text-white font-bold" style={{ fontSize:10 }}>{initials}</span></div>
          }
          <span className="hidden md:block text-xs font-medium max-w-[100px] truncate" style={{ color:"var(--text-sec)" }}>{displayName}</span>
          <button onClick={onLogout} title={t.signOut} className="flex items-center justify-center w-7 h-7 rounded-lg transition-colors" style={{ background:"rgba(239,68,68,0.08)", border:"1px solid rgba(239,68,68,0.2)", color:"#f87171" }}>
            <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
          </button>
        </div>
      </div>
    </div>
  </header>;
}

// ── Dashboard Page ──
function DashboardPage({ setActivePage, onStartInvestigation, onSelectInvestigation, investigation, investigationLoading, investigationError, recentItems, recentError, recentLoaded, onDeleteInvestigation, savingId, lastSavedId, user }) {
  const { t } = useLang();
  const [searchTab, setSearchTab] = useState("username");
  const [searchVal, setSearchVal] = useState("");
  const [searchError, setSearchError] = useState("");
  const [deletingId, setDeletingId] = useState(null);
  const [deleteError, setDeleteError] = useState("");
  const [, setRelativeClock] = useState(0);
  const searchInputRef = useRef(null);

  const resetDashboardSearch = () => {
    setSearchVal("");
    setSearchError("");
    searchInputRef.current?.focus();
  };
  const startSearch = async () => {
    const value = searchVal.trim();
    if (!value) { setSearchError(t.enterTargetFirst); return; }
    setSearchError("");
    await onStartInvestigation({ target: value, type: detectTargetType(value, searchTab), redirectToOsint: false });
  };
  const handleDelete = async (e, inv) => {
    e.stopPropagation();
    if (!window.confirm(`Delete case ${inv.id}? This cannot be undone.`)) return;
    setDeletingId(inv.id);
    setDeleteError("");
    try {
      await onDeleteInvestigation(inv.id);
    } catch(err) {
      setDeleteError(`Delete failed: ${err.message}`);
    } finally {
      setDeletingId(null);
    }
  };

  useEffect(() => {
    const timer = window.setInterval(() => setRelativeClock(c => c + 1), 30000);
    return () => window.clearInterval(timer);
  }, []);

  const searchTabs = [
    { id:"username", label:t.username, icon:AtSign }, { id:"email", label:t.email, icon:Mail },
    { id:"phone", label:t.phone, icon:Phone }, { id:"url", label:t.profileUrl, icon:LinkIcon },
    { id:"keyword", label:t.keyword, icon:Hash }, { id:"image", label:t.image, icon:ImageIcon },
  ];

  // Always use real Firestore data; show skeleton only while first load is pending
  const liveItems = recentLoaded ? recentItems.map(normalizeRecentInvestigation) : [];
  const isFirstLoad = !recentLoaded && !recentError;
  const totalCount = liveItems.length;
  // Unique suspects = distinct target values across all cases
  const suspectCount = new Set(liveItems.map(i => (i.target || "").toLowerCase().trim()).filter(Boolean)).size;
  const highRiskCount = liveItems.filter(i => ["critical","high"].includes(i.risk)).length;
  const platformCount = new Set(liveItems.flatMap(i => i.platforms || [])).size;

  // Build a 7-day activity chart from real data
  const activityChartData = (() => {
    const days = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
    const buckets = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(); d.setDate(d.getDate() - (6 - i));
      return { day: days[d.getDay()], date: d.toDateString(), investigations: 0 };
    });
    liveItems.forEach(inv => {
      if (!inv.createdAtMs) return;
      const ds = new Date(inv.createdAtMs).toDateString();
      const b = buckets.find(x => x.date === ds);
      if (b) b.investigations++;
    });
    return buckets;
  })();

  const stats = [
    { label:t.totalInvestigations, value: isFirstLoad ? null : String(totalCount),    delta: recentLoaded ? t.syncedFromSupabase : t.loadingDots, icon:Target,        color:"blue"   },
    { label:t.suspectsIdentified,  value: isFirstLoad ? null : String(suspectCount),  delta:t.uniqueCaseTargets,  icon:Users,         color:"indigo" },
    { label:t.highRiskCases,       value: isFirstLoad ? null : String(highRiskCount), delta:t.criticalAndHigh,    icon:AlertTriangle, color:"red"    },
    { label:t.platformsScanned,    value: isFirstLoad ? null : String(platformCount), delta:t.acrossRecentCases,  icon:Globe,         color:"cyan"   },
  ];
  const colorMap = {
    blue:  { bg:"bg-blue-50",   icon:"text-blue-600",   ring:"ring-blue-100"   },
    indigo:{ bg:"bg-indigo-50", icon:"text-indigo-600", ring:"ring-indigo-100" },
    red:   { bg:"bg-red-50",    icon:"text-red-600",    ring:"ring-red-100"    },
    cyan:  { bg:"bg-cyan-50",   icon:"text-cyan-600",   ring:"ring-cyan-100"   },
  };

  return <div className="page-pad space-y-4">
    {/* ── Search card ── */}
    <div className="rounded-xl shadow-sm" style={V.card}>
      <div className="px-5 pt-5 pb-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="font-semibold text-sm" style={{ color:"var(--text-primary)" }}>New Investigation</h2>
            <p className="text-xs mt-0.5" style={{ color:"var(--text-muted)" }}>Enter a target identifier to begin OSINT data collection — results are saved to your account automatically.</p>
          </div>
          <button onClick={resetDashboardSearch} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors"><Plus size={14}/>New</button>
        </div>
        <div className="flex gap-1 p-1 rounded-lg w-fit mb-4" style={{ backgroundColor:"var(--bg-input)" }}>
          {searchTabs.map(({ id, label, icon:Ic }) =>
            <button key={id} onClick={() => setSearchTab(id)} className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all", searchTab===id?"bg-white text-slate-800 shadow-sm":"text-slate-500 hover:text-slate-700")}>
              <Ic size={12}/>{label}
            </button>
          )}
        </div>
        <div className="flex gap-3">
          <div className="flex-1 relative">
            {searchTab==="image" ? <Upload size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/> : <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/>}
            <input ref={searchInputRef} value={searchVal} onChange={e => setSearchVal(e.target.value)}
              onKeyDown={e => { if(e.key==="Enter") startSearch(); }}
              placeholder={searchTab==="image" ? t.pasteImageUrl : `${searchTabs.find(st=>st.id===searchTab)?.label}…`}
              className="w-full pl-9 pr-4 py-2.5 rounded-lg text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-200 transition-all"
              style={{ background:"var(--bg-input)", border:"1px solid var(--border)", color:"var(--text-primary)" }}/>
          </div>
          <button disabled={investigationLoading} onClick={startSearch}
            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white rounded-lg text-sm font-medium flex items-center gap-2 transition-colors">
            {investigationLoading ? <Loader2 size={14} className="animate-spin"/> : <Zap size={14}/>}
            {investigationLoading ? t.running : t.investigate}
          </button>
        </div>
        {searchError && <p className="mt-2 text-xs text-red-500">{searchError}</p>}
        {investigationError && !investigationError.includes("Supabase save failed") && <p className="mt-2 text-xs text-red-500">{investigationError}</p>}
        {investigationLoading && (
          <div className="mt-3 rounded-lg px-3 py-2 text-xs text-blue-700 bg-blue-50 border border-blue-100 flex items-center gap-2">
            <Loader2 size={12} className="animate-spin"/>Collecting OSINT data across all platforms — Apify scrapers run in background (1–2 min). Do not close this tab.
          </div>
        )}
        {savingId && !investigationLoading && (
          <div className="mt-3 rounded-lg px-3 py-2 text-xs text-amber-700 bg-amber-50 border border-amber-100 flex items-center gap-2">
            <Loader2 size={12} className="animate-spin"/>Saving case to Supabase…
          </div>
        )}
        {lastSavedId && !savingId && !investigationLoading && (
          <div className="mt-3 rounded-lg px-3 py-2 text-xs text-green-700 bg-green-50 border border-green-100 flex items-center gap-2">
            <CheckCircle2 size={12}/>Case <span className="font-mono font-semibold">{lastSavedId}</span> saved.{" "}
            <button onClick={() => setActivePage("osint")} className="underline font-semibold">Open full collection →</button>
          </div>
        )}
      </div>
    </div>

    {/* ── Stat cards ── */}
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {stats.map(({ label, value, delta, icon:Ic, color }) => {
        const c = colorMap[color];
        return <div key={label} className="rounded-xl p-5 shadow-sm" style={V.card}>
          <div className="flex items-start justify-between mb-3">
            <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center ring-1", c.bg, c.ring)}><Ic size={16} className={c.icon}/></div>
            <ArrowUpRight size={14} className="text-slate-300"/>
          </div>
          {value === null ? (
            <>
              <div className="h-6 w-12 rounded animate-pulse mb-1.5" style={{ background:"var(--bg-input)" }}/>
              <div className="text-xs font-medium" style={{ color:"var(--text-sec)" }}>{label}</div>
              <div className="h-2.5 w-20 rounded animate-pulse mt-1.5" style={{ background:"var(--bg-input)" }}/>
            </>
          ) : (
            <>
              <div className="text-2xl font-bold mb-0.5" style={{ fontFamily:"monospace", color:"var(--text-primary)" }}>{value}</div>
              <div className="text-xs font-medium" style={{ color:"var(--text-sec)" }}>{label}</div>
              <div className="mt-1" style={{ fontSize:11, color:"var(--text-muted)" }}>{delta}</div>
            </>
          )}
        </div>;
      })}
    </div>

    {/* ── Investigations table + sidebar ── */}
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
      <div className="lg:col-span-2 rounded-xl shadow-sm overflow-hidden" style={V.card}>
        <div className="flex items-center justify-between px-5 py-4" style={V.inner}>
          <div>
            <h3 className="font-semibold text-sm" style={{ color:"var(--text-primary)" }}>Your Investigations</h3>
            <p className="text-xs mt-0.5" style={{ color:"var(--text-muted)" }}>
              {recentLoaded ? t.casesOnRecord(totalCount) : isFirstLoad ? t.loadingFromSupabase : t.supabaseSyncError}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] hidden sm:inline" style={{ color:"var(--text-muted)" }}>
              {recentLoaded ? "● Live" : "○ Syncing"}
            </span>
          </div>
        </div>

        {/* Loading skeleton */}
        {isFirstLoad && (
          <div className="px-5 py-6 space-y-3">
            {[1,2,3].map(i => (
              <div key={i} className="flex gap-4 items-center animate-pulse">
                <div className="h-3 rounded bg-slate-100 w-24"/>
                <div className="h-3 rounded bg-slate-100 w-32"/>
                <div className="h-3 rounded bg-slate-100 w-16"/>
                <div className="h-3 rounded bg-slate-100 w-16 ml-auto"/>
              </div>
            ))}
          </div>
        )}

        {/* Error state */}
        {recentError && (
          <div className="px-5 py-4 text-xs text-amber-700 bg-amber-50 border-b border-amber-100 flex items-center gap-2">
            <AlertCircle size={13}/>Could not sync: {recentError}
          </div>
        )}

        {/* Delete error */}
        {deleteError && (
          <div className="px-5 py-2 text-xs text-red-600 bg-red-50 border-b border-red-100 flex items-center justify-between gap-2">
            <span className="flex items-center gap-1.5"><AlertCircle size={12}/>{deleteError}</span>
            <button onClick={() => setDeleteError("")} className="text-red-400 hover:text-red-600">✕</button>
          </div>
        )}

        {/* Table */}
        {!isFirstLoad && (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr style={V.inner}>
                  {[t.caseId, t.target, t.type, t.risk, t.status, t.saved, ""].map(hd =>
                    <th key={hd} className="text-left px-5 py-2.5 font-medium tracking-wide whitespace-nowrap" style={{ fontSize:11, color:"var(--text-muted)" }}>{hd}</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {liveItems.map(inv => {
                  const isSaving  = savingId === inv.id;
                  const isDeleting = deletingId === inv.id;
                  return (
                    <tr key={inv.id}
                      onClick={() => !isDeleting && inv.fullInvestigation && onSelectInvestigation?.(inv.fullInvestigation)}
                      className="transition-colors cursor-pointer hover:bg-slate-50"
                      style={{ ...V.inner, opacity: isDeleting ? 0.4 : 1 }}>
                      <td className="px-5 py-3">
                        <span className="text-blue-600 font-medium" style={{ fontFamily:"monospace" }}>{inv.id}</span>
                      </td>
                      <td className="px-5 py-3">
                        <span className="font-medium truncate max-w-[120px] block" style={{ color:"var(--text-primary)" }}>{inv.target}</span>
                      </td>
                      <td className="px-5 py-3" style={{ color:"var(--text-muted)" }}>{inv.type}</td>
                      <td className="px-5 py-3"><RiskBadge risk={inv.risk}/></td>
                      <td className="px-5 py-3"><StatusBadge status={inv.status}/></td>
                      <td className="px-5 py-3">
                        {isSaving
                          ? <span className="flex items-center gap-1 text-amber-500"><Loader2 size={11} className="animate-spin"/>Saving…</span>
                          : <span style={{ color:"var(--text-muted)" }}>{inv.date}</span>
                        }
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={e => handleDelete(e, inv)}
                          disabled={isDeleting}
                          title={t.deleteCase}
                          className="p-1.5 rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-40">
                          {isDeleting
                            ? <Loader2 size={13} className="animate-spin"/>
                            : <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/>
                              </svg>
                          }
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* Empty state */}
            {liveItems.length === 0 && !recentError && (
              <div className="px-5 py-12 text-center">
                <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-3">
                  <Database size={20} className="text-slate-400"/>
                </div>
                <p className="text-sm font-medium" style={{ color:"var(--text-primary)" }}>No investigations yet</p>
                <p className="text-xs mt-1 mb-4" style={{ color:"var(--text-muted)" }}>Search for a username, email, or phone number above — results are saved here automatically.</p>
                <button onClick={() => searchInputRef.current?.focus()} className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium transition-colors flex items-center gap-1.5 mx-auto">
                  <Plus size={13}/>Start first investigation
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Right sidebar ── */}
      <div className="space-y-5">
        {/* Live threat distribution derived from real data */}
        <div className="rounded-xl p-5 shadow-sm" style={V.card}>
          <h3 className="font-semibold text-sm mb-4" style={{ color:"var(--text-primary)" }}>Threat Distribution</h3>
          {liveItems.length > 0 ? (() => {
            const counts = { critical:0, high:0, medium:0, low:0 };
            liveItems.forEach(i => { if(counts[i.risk]!==undefined) counts[i.risk]++; });
            const total = liveItems.length;
            const colors = { critical:"#dc2626", high:"#f97316", medium:"#eab308", low:"#22c55e" };
            const labels = { critical:"Critical", high:"High", medium:"Medium", low:"Low" };
            return (
              <div>
                <ResponsiveContainer width="100%" height={90}>
                  <PieChart>
                    <Pie data={Object.entries(counts).filter(([,v])=>v>0).map(([k,v])=>({ name:labels[k], value:v, color:colors[k] }))}
                      cx="50%" cy="50%" innerRadius={28} outerRadius={42} dataKey="value" stroke="none">
                      {Object.entries(counts).filter(([,v])=>v>0).map(([k],i) => <Cell key={i} fill={colors[k]}/>)}
                    </Pie>
                    <Tooltip formatter={v=>[v+" cases"]} contentStyle={{ fontSize:11 }}/>
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-1.5 mt-2">
                  {Object.entries(counts).map(([k,v]) => v>0 && (
                    <div key={k} className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor:colors[k] }}/>
                      <span className="text-xs flex-1" style={{ color:"var(--text-sec)" }}>{labels[k]}</span>
                      <span className="text-xs font-medium tabular-nums" style={{ fontFamily:"monospace", color:"var(--text-primary)" }}>{v} ({Math.round(v/total*100)}%)</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })() : (
            <div className="text-center py-4 text-xs" style={{ color:"var(--text-muted)" }}>Run investigations to see threat breakdown.</div>
          )}
        </div>

        {/* Top platforms from real data */}
        <div className="rounded-xl p-5 shadow-sm" style={V.card}>
          <h3 className="font-semibold text-sm mb-4" style={{ color:"var(--text-primary)" }}>Platforms Found</h3>
          {(() => {
            const pMap = {};
            liveItems.forEach(inv => (inv.platforms||[]).forEach(p => { pMap[p] = (pMap[p]||0)+1; }));
            const sorted = Object.entries(pMap).sort((a,b)=>b[1]-a[1]).slice(0,6);
            const max = sorted[0]?.[1] || 1;
            return sorted.length > 0 ? (
              <div className="space-y-2.5">
                {sorted.map(([name, count]) => (
                  <div key={name}>
                    <div className="flex justify-between text-xs mb-1">
                      <span style={{ color:"var(--text-sec)" }}>{name}</span>
                      <span className="tabular-nums" style={{ fontFamily:"monospace", color:"var(--text-muted)" }}>{count}</span>
                    </div>
                    <div className="h-1.5 rounded-full" style={{ background:"var(--bg-input)" }}>
                      <div className="h-1.5 rounded-full" style={{ width:`${(count/max)*100}%`, background:"linear-gradient(90deg,#2563eb,#4f46e5)" }}/>
                    </div>
                  </div>
                ))}
              </div>
            ) : <div className="text-xs text-center py-3" style={{ color:"var(--text-muted)" }}>No platform data yet.</div>;
          })()}
        </div>
      </div>
    </div>

    {/* ── Activity chart from real data ── */}
    <div className="rounded-xl p-5 shadow-sm" style={V.card}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-sm" style={{ color:"var(--text-primary)" }}>Investigation Activity — Last 7 Days</h3>
        <div className="flex items-center gap-4 text-xs" style={{ color:"var(--text-muted)" }}>
          <span className="flex items-center gap-1.5"><span className="w-3 h-0.5 bg-blue-500 rounded inline-block"/>Investigations</span>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={120}>
        <AreaChart data={activityChartData} margin={{ top:0, right:0, left:-20, bottom:0 }}>
          <defs>
            <linearGradient id="gInv" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#2563eb" stopOpacity={0.18}/>
              <stop offset="95%" stopColor="#2563eb" stopOpacity={0}/>
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)"/>
          <XAxis dataKey="day" tick={{ fontSize:11, fill:"var(--text-muted)" }} axisLine={false} tickLine={false}/>
          <YAxis tick={{ fontSize:11, fill:"var(--text-muted)" }} axisLine={false} tickLine={false} allowDecimals={false}/>
          <Tooltip contentStyle={{ fontSize:11, borderRadius:8, border:"1px solid var(--border)", background:"var(--bg-card)", color:"var(--text-primary)" }}/>
          <Area type="monotone" dataKey="investigations" stroke="#2563eb" strokeWidth={2} fill="url(#gInv)" dot={false}/>
        </AreaChart>
      </ResponsiveContainer>
    </div>
  </div>;
}

// ── OSINT Page ──
function OSINTPage({ setActivePage, investigation, investigationLoading, investigationError, onStartInvestigation, onPatchInvestigation }) {
  const [target, setTarget] = useState("");
  const [type, setType] = useState("username");
  const [reverseImageUrl, setReverseImageUrl] = useState("");
  const [breachQuery, setBreachQuery] = useState("");
  const [geminiKey, setGeminiKey] = useState("");
  const [geminiConfigured, setGeminiConfigured] = useState(hasGeminiApiKey());

  // ── Instagram Posts Scraper state — declared early so runSearch can reference them ──
  const [igPosts, setIgPosts]               = useState([]);
  const [igPostsStatus, setIgPostsStatus]   = useState("idle"); // idle|loading|success|error|timeout
  const [igPostsOpen, setIgPostsOpen]       = useState(true);
  const [igPostsTarget, setIgPostsTarget]   = useState("");
  const igPostsPollRef                      = useRef(null);

  // Load cached posts from IndexedDB when target changes
  useEffect(() => {
    if (!igPostsTarget) return;
    getIgPosts(igPostsTarget).then(cached => {
      if (cached && cached.length > 0) {
        setIgPosts(cached);
        if (igPostsStatus === "idle") setIgPostsStatus("success");
      }
    }).catch(() => {});
  }, [igPostsTarget]);

  const steps = ["Input","Collection","Correlation","Analysis","Report"];
  const currentStep = investigation ? 3 : investigationLoading ? 1 : 0;
  const statusIcon = s => {
    if (s==="found") return <CheckCircle2 size={14} className="text-green-500"/>;
    if (s==="open_link") return <ExternalLink size={14} className="text-blue-500"/>;
    if (s==="blocked") return <Lock size={14} className="text-rose-500"/>;
    if (s==="not_found") return <AlertTriangle size={14} className="text-amber-500"/>;
    return <Circle size={14} className="text-slate-300"/>;
  };
  const statusLabel = s => {
    if (s==="found") return { text:"Auto-Confirmed", cls:"bg-green-50 text-green-700 ring-1 ring-green-200" };
    if (s==="open_link") return { text:"Auto-Scraped", cls:"bg-blue-50 text-blue-700 ring-1 ring-blue-200" };
    if (s==="blocked") return { text:"Blocked by Platform", cls:"bg-rose-50 text-rose-700 ring-1 ring-rose-200" };
    if (s==="not_found") return { text:"Not Detected", cls:"bg-amber-50 text-amber-700 ring-1 ring-amber-200" };
    return { text:"Pending", cls:"bg-slate-100 text-slate-500" };
  };
  const logColor = l => l==="success"?"text-green-400":l==="warn"?"text-amber-400":"text-slate-400";
  const logDot = l => l==="success"?"bg-green-500":l==="warn"?"bg-amber-500":"bg-blue-500";
  const runSearch = async () => {
    const resolvedType = detectTargetType(target, type);
    // Fire main OSINT investigation (non-blocking for IG scraper)
    onStartInvestigation({ target, type: resolvedType });
    // Auto-fire Instagram scraper silently whenever search type is username
    if (target.trim() && (resolvedType === "username" || type === "username")) {
      setIgScrapeData([]);
      setIgScrapeStatus("loading");
      setIgOpen(true);
      fetch("/api/scrape-instagram", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: target.trim().replace(/^@/, ""), dataToScrape: "Followers", limit: 100 }),
      })
        .then(r => r.json())
        .then(data => { setIgScrapeData(Array.isArray(data) ? data : []); setIgScrapeStatus("success"); })
        .catch(() => setIgScrapeStatus("error"));

      // ── Auto-fire Instagram Posts scraper ──
      const cleanTarget = target.trim().replace(/^@/, "");
      setIgPostsTarget(cleanTarget);
      setIgPosts([]);
      setIgPostsStatus("loading");
      setIgPostsOpen(true);
      if (igPostsPollRef.current) clearTimeout(igPostsPollRef.current);
      const CLIENT_TIMEOUT_MS = 3 * 60 * 1000;
      const postsStartedAt = Date.now();
      const finalisePosts = (username, posts) => {
        setIgPosts(posts);
        setIgPostsStatus("success");
        saveIgPosts(username, posts).catch(() => {});
        // ── Inject posts into investigation so AI Analysis & Report can use them ──
        if (posts.length > 0 && onPatchInvestigation) {
          // Convert posts to crawledPages format so Gemini/Analysis sees the content
          const postPages = posts.map((p) => ({
            url:       p.url ?? `https://www.instagram.com/p/${p.shortCode ?? ""}/`,
            title:     `Instagram post by @${username}${p.timestamp ? " · " + new Date(p.timestamp).toLocaleDateString() : ""}`,
            snippet:   [p.caption, p.hashtags?.map(h=>"#"+h).join(" "), p.locationName ? "📍 "+p.locationName : ""].filter(Boolean).join(" · ").slice(0, 400) || "(no caption)",
            extractor: "Instagram Posts Scraper",
          }));
          onPatchInvestigation({
            instaPosts: posts,
            // Merge with existing crawledPages so Gemini analysis includes post content
            crawledPages: [...(investigation?.crawledPages ?? []), ...postPages],
          });
        }
      };
      const pollPosts = (runId, datasetId) => {
        if (Date.now() - postsStartedAt > CLIENT_TIMEOUT_MS) { setIgPostsStatus("timeout"); return; }
        igPostsPollRef.current = setTimeout(async () => {
          try {
            const pr = await fetch("/api/scrape-instagram-posts-poll", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({runId,datasetId}) });
            const pd = await pr.json();
            if (pr.status===202 && pd.pending) pollPosts(runId, pd.datasetId??datasetId);
            else if (pr.ok && pd.posts) finalisePosts(cleanTarget, pd.posts);
            else setIgPostsStatus("error");
          } catch { setIgPostsStatus("error"); }
        }, 8000);
      };
      (async () => {
        try {
          const r = await fetch("/api/scrape-instagram-posts", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({username:cleanTarget,limit:30}) });
          const d = await r.json();
          if (r.status===202 && d.pending) pollPosts(d.runId, d.datasetId);
          else if (r.ok && d.posts) finalisePosts(cleanTarget, d.posts);
          else setIgPostsStatus("error");
        } catch { setIgPostsStatus("error"); }
      })();

      // Auto-fire Twitter/X followers scraper via Apify
      setTwScrapeData([]);
      setTwScrapeStatus("loading");
      setTwOpen(true);
      fetch("/api/scrape-twitter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: target.trim().replace(/^@/, ""), limit: 100 }),
      })
        .then(r => r.json())
        .then(data => {
          // API now returns { target, followers } — store the full payload
          const followers = data?.followers ?? (Array.isArray(data) ? data : []);
          setTwScrapeData({ target: data?.target ?? null, followers });
          setTwScrapeStatus("success");
        })
        .catch(() => setTwScrapeStatus("error"));
    }
  };
  useEffect(() => {
    if (investigation?.target && (investigation.type === "email" || investigation.type === "username")) {
      setBreachQuery(investigation.target);
    }
  }, [investigation?.target, investigation?.type]);
  const saveGeminiKey = () => {
    saveRuntimeGeminiApiKey(geminiKey);
    setGeminiConfigured(hasGeminiApiKey());
    setGeminiKey("");
  };
  const targetRows = investigation ? [
    { label:"Target", val:investigation.target, icon:Target },
    { label:"Type", val:investigation.type, icon:Hash },
    { label:"Case ID", val:investigation.id, icon:FileText },
    { label:"Status", val:investigation.status, icon:CheckCircle2 },
  ] : [
    { label:"Username", val:"@example_handle", icon:AtSign },
    { label:"Email", val:"name@example.com", icon:Mail },
    { label:"Phone", val:"+1 555 0100", icon:Phone },
    { label:"Profile URL", val:"https://example.com/profile", icon:LinkIcon },
  ];
  const metadata = investigation?.metadata || [{key:"Collection Mode",value:"Public web search + crawler + open-source APIs"},{key:"Gemini Search",value:geminiConfigured?"Runtime key saved":"Add VITE_GEMINI_API_KEY or paste key below"},{key:"Privacy Guardrail",value:"No private databases or intrusive enrichment"},{key:"Output",value:"Fetched source content, links, and verification checklist"}];
  const findings = investigation?.findings || [];
  const stats = investigation?.stats || { foundProfiles:0, candidateProfiles:0, searchLinks:0, sources:0, crawledPages:0, confidence:0 };
  const tools = investigation?.tools || [];
  const logs = investigation?.logs || [{ time:"--:--:--", level:"info", msg:"Run an investigation to see live activity logs here." }];
  const sourceLinks = investigation?.gemini?.sources || [];
  const searchLinks = investigation?.searchLinks || [];
  const crawledPages = investigation?.crawledPages || [];

  // ── Public Platform Checks: filter / search / sort ──
  // ── Instagram Scraper — fully automatic, silent background ──
  const [igScrapeData, setIgScrapeData]     = useState([]);
  const [igScrapeStatus, setIgScrapeStatus] = useState("idle"); // idle|loading|success|error
  const [igFilter, setIgFilter]             = useState("");
  const [igOpen, setIgOpen]                 = useState(false);

  // ── Twitter/X Followers Scraper (Apify) ──
  const [twScrapeData, setTwScrapeData]     = useState([]);
  const [twScrapeStatus, setTwScrapeStatus] = useState("idle"); // idle|loading|success|error
  const [twFilter, setTwFilter]             = useState("");
  const [twOpen, setTwOpen]                 = useState(false);

  const [checkQuery, setCheckQuery] = useState("");
  const [checkStatus, setCheckStatus] = useState("all");
  const [checkSort, setCheckSort] = useState("relevance");
  const STATUS_FILTERS = [
    { id:"all",       label:"All statuses" },
    { id:"found",     label:"Confirmed" },
    { id:"open_link", label:"Candidate" },
    { id:"blocked",   label:"Blocked by platform" },
    { id:"not_found", label:"Not detected" },
  ];
  const SORT_OPTIONS = [
    { id:"relevance", label:"Relevance (confirmed first)" },
    { id:"platform",  label:"Platform A → Z" },
    { id:"newest",    label:"Created date — newest" },
    { id:"oldest",    label:"Created date — oldest" },
    { id:"followers",label:"Followers — highest" },
  ];
  const parseCount = (v) => {
    if (!v || typeof v !== "string") return -1;
    const n = parseFloat(v.replace(/,/g,""));
    if (isNaN(n)) return -1;
    if (/[Kk]$/.test(v)) return n*1e3;
    if (/[Mm]$/.test(v)) return n*1e6;
    return n;
  };
  const parseDate = (v) => { const t = v ? new Date(v).getTime() : NaN; return isNaN(t) ? null : t; };
  const reverseImageEngines = useMemo(() => {
    const u = reverseImageUrl.trim();
    if (!u || !/^https?:\/\//i.test(u)) return [];
    const enc = encodeURIComponent(u);
    return [
      { name: "Google Lens", note: "Visual match across the public web", url: `https://lens.google.com/uploadbyurl?url=${enc}` },
      { name: "Yandex Images", note: "Strong face/photo similarity matching", url: `https://yandex.com/images/search?rpt=imageview&url=${enc}` },
      { name: "Bing Visual Search", note: "Visually similar image matches", url: `https://www.bing.com/images/search?view=detailv2&iss=sbi&q=imgurl:${enc}` },
      { name: "TinEye", note: "Finds exact/reused copies of this photo", url: `https://tineye.com/search?url=${enc}` },
    ];
  }, [reverseImageUrl]);
  const breachEngines = useMemo(() => {
    const q = breachQuery.trim();
    if (!q) return [];
    const enc = encodeURIComponent(q);
    const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(q);
    return [
      { name: "Have I Been Pwned", note: isEmail ? "Checks this email against known public breaches" : "Domain/account breach exposure lookup", url: isEmail ? `https://haveibeenpwned.com/account/${enc}` : `https://haveibeenpwned.com/DomainSearch?domain=${enc}` },
      { name: "Intelligence X", note: "Searches leaks, pastes, and breach archives", url: `https://intelx.io/?s=${enc}` },
      { name: "LeakCheck", note: "Checks email/username against leaked databases", url: `https://leakcheck.io/search?query=${enc}` },
      { name: "DeHashed", note: "Searches breach data for matching identifiers", url: `https://dehashed.com/search?query=${enc}` },
      { name: "Pastebin (via search)", note: "Finds pastes referencing this identifier", url: `https://www.google.com/search?q=${enc}+site:pastebin.com` },
    ];
  }, [breachQuery]);
  const visibleFindings = useMemo(() => {
    let list = findings.map((f) => ({ raw: f, fields: getDisplayFields(f) }));
    if (checkStatus !== "all") list = list.filter(({ raw }) => raw.status === checkStatus);
    if (checkQuery.trim()) {
      const q = checkQuery.trim().toLowerCase();
      list = list.filter(({ raw, fields }) =>
        (raw.platform||"").toLowerCase().includes(q) ||
        (raw.snippet||"").toLowerCase().includes(q) ||
        (fields.username||"").toLowerCase().includes(q)
      );
    }
    const statusRank = { found:0, open_link:1, blocked:2, not_found:3 };
    if (checkSort === "platform") list.sort((a,b)=>(a.raw.platform||"").localeCompare(b.raw.platform||""));
    else if (checkSort === "newest") list.sort((a,b)=>(parseDate(b.fields.createdDate)||-Infinity)-(parseDate(a.fields.createdDate)||-Infinity));
    else if (checkSort === "oldest") list.sort((a,b)=>(parseDate(a.fields.createdDate)??Infinity)-(parseDate(b.fields.createdDate)??Infinity));
    else if (checkSort === "followers") list.sort((a,b)=>parseCount(b.fields.followers)-parseCount(a.fields.followers));
    else list.sort((a,b)=>(statusRank[a.raw.status]??9)-(statusRank[b.raw.status]??9));
    return list;
  }, [findings, checkQuery, checkStatus, checkSort]);

  return <div className="page-pad space-y-4">
    <div className="bg-white rounded-xl px-6 py-4 shadow-sm" style={V.card}>
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="flex items-center gap-2"><span className="text-slate-500 text-xs">Case:</span><span className="text-blue-600 font-medium text-xs" style={{ fontFamily:"monospace" }}>{investigation?.id || "NEW-CASE"}</span><span className="text-slate-300">·</span><span className={cn("w-2 h-2 rounded-full", investigationLoading?"bg-blue-500 animate-pulse":investigation?"bg-green-500":"bg-slate-300")}/><span className={cn("text-xs font-medium", investigationLoading?"text-blue-600":investigation?"text-green-600":"text-slate-500")}>{investigationLoading ? "Collecting" : investigation ? "Ready" : "Awaiting Target"}</span></div>
        <div className="flex items-center gap-1 stepper-bar">{steps.map((s,i)=><div key={s} className="flex items-center"><div className={cn("flex items-center justify-center w-6 h-6 rounded-full font-bold", i<currentStep?"bg-blue-600 text-white":i===currentStep?"bg-blue-100 text-blue-700 ring-2 ring-blue-400":"bg-slate-100 text-slate-400")} style={{ fontSize:10 }}>{i<currentStep?<Check size={10}/>:i+1}</div><span className={cn("hidden sm:block mx-1.5", i===currentStep?"text-blue-600 font-medium":"text-slate-400")} style={{ fontSize:10 }}>{s}</span>{i<steps.length-1&&<div className={cn("w-6 h-px", i<currentStep?"bg-blue-300":"bg-slate-200")}/>}</div>)}</div>
      </div>
    </div>

    <div className="rounded-xl p-5 shadow-sm" style={V.card}>
      <div className="flex items-center gap-2 mb-3"><Search size={15} className="text-blue-600"/><h3 className="font-semibold text-sm" style={{ color:"var(--text-primary)" }}>Run Public OSINT Search</h3></div>
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-3">
        <select value={type} onChange={(e)=>setType(e.target.value)} className="rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200" style={{ background:"var(--bg-input)", border:"1px solid var(--border)", color:"var(--text-primary)" }}>
          <option value="username">Username</option><option value="email">Email</option><option value="phone">Phone</option><option value="profile">Profile URL</option><option value="keyword">Keyword</option><option value="image">Image URL</option>
        </select>
        <input value={target} onChange={(e)=>setTarget(e.target.value)} onKeyDown={(e)=>{ if(e.key==="Enter") runSearch(); }} placeholder="Enter username, email, phone, URL, keyword, or image URL…" className="lg:col-span-3 rounded-lg px-3 py-2.5 text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-200" style={{ background:"var(--bg-input)", border:"1px solid var(--border)", color:"var(--text-primary)" }}/>
        <button disabled={investigationLoading} onClick={runSearch} className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition-colors">{investigationLoading ? <Loader2 size={14} className="animate-spin"/> : <Zap size={14}/>}Investigate</button>
      </div>
      <div className="mt-3 grid grid-cols-1 lg:grid-cols-5 gap-3">
        <input value={geminiKey} onChange={(e)=>setGeminiKey(e.target.value)} type="password" placeholder={geminiConfigured ? "Gemini key saved — paste a new key to replace" : "Paste Gemini API key for this browser session"} className="lg:col-span-4 rounded-lg px-3 py-2 text-xs placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-200" style={{ background:"var(--bg-input)", border:"1px solid var(--border)", color:"var(--text-primary)" }}/>
        <button type="button" onClick={saveGeminiKey} className="px-4 py-2 rounded-lg text-xs font-medium border border-blue-200 text-blue-700 bg-blue-50 hover:bg-blue-100">{geminiConfigured ? "Update Gemini Key" : "Save Gemini Key"}</button>
      </div>
      <p className="mt-3 text-xs text-slate-500">Runs public web search, page-reader crawling for publicly accessible URLs, GitHub's public API, and Gemini grounded analysis when a key is available. You can use <span className="font-mono">VITE_GEMINI_API_KEY</span> at build time or save a runtime key locally in this browser.</p>
      {investigationError && <div className="mt-3 rounded-lg px-3 py-2 bg-red-50 text-red-600 border border-red-100 text-xs">{investigationError}</div>}

    </div>

    {/* ── Instagram Scraper results panel ── */}
    {igScrapeStatus !== "idle" && (
      <div className="rounded-xl shadow-sm overflow-hidden" style={V.card}>
        <button onClick={()=>setIgOpen(v=>!v)} className="w-full flex items-center justify-between px-5 py-3.5 text-left" style={V.inner}>
          <div className="flex items-center gap-2">
            <span className="text-sm">📸</span>
            <h3 className="font-semibold text-sm" style={{ color:"var(--text-primary)" }}>
              Instagram Followers
              {igScrapeStatus==="success" && <span className="ml-2 text-xs font-normal" style={{ color:"var(--text-muted)" }}>({igScrapeData.length} found)</span>}
            </h3>
            {igScrapeStatus==="loading" && <Loader2 size={12} className="animate-spin text-pink-500"/>}
            {igScrapeStatus==="success" && <span className="w-2 h-2 rounded-full bg-green-500"/>}
            {igScrapeStatus==="error"   && <span className="w-2 h-2 rounded-full bg-red-500"/>}
          </div>
          <ChevronDown size={14} style={{ color:"var(--text-muted)", transform: igOpen?"rotate(180deg)":"none", transition:"transform 0.2s" }}/>
        </button>

        {igOpen && (
          <div className="px-4 pb-4">
            {igScrapeStatus==="loading" && (
              <div className="flex items-center gap-3 py-6 justify-center text-sm" style={{ color:"var(--text-muted)" }}>
                <Loader2 size={16} className="animate-spin text-pink-500"/>
                Scraping @{target.replace(/^@/,"")} followers in background…
              </div>
            )}
            {igScrapeStatus==="error" && (
              <div className="py-4 text-center text-xs text-red-400">Scrape failed — check Apify token or try again.</div>
            )}
            {igScrapeStatus==="success" && igScrapeData.length > 0 && (
              <>
                <div className="relative mb-3 mt-1">
                  <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400"/>
                  <input value={igFilter} onChange={e=>setIgFilter(e.target.value)} placeholder="Filter by username or name…"
                    className="w-full pl-7 pr-3 py-1.5 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-pink-300"
                    style={{ background:"var(--bg-input)", border:"1px solid var(--border)", color:"var(--text-primary)" }}/>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-96 overflow-y-auto pr-1 platform-grid">
                  {igScrapeData
                    .filter(r => !igFilter.trim() || (r.username??"").toLowerCase().includes(igFilter.toLowerCase()) || (r.full_name??"").toLowerCase().includes(igFilter.toLowerCase()))
                    .map((item, i) => (
                      <div key={item.id??i} className="flex items-center gap-2.5 px-3 py-2 rounded-lg" style={{ border:"1px solid var(--border)", background:"var(--bg-card)" }}>
                        <img src={item.profile_pic_url || "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='32' height='32'%3E%3Crect width='32' height='32' fill='%23e2e8f0'/%3E%3Ccircle cx='16' cy='12' r='5' fill='%2394a3b8'/%3E%3Cellipse cx='16' cy='26' rx='9' ry='6' fill='%2394a3b8'/%3E%3C/svg%3E"}
                          onError={e=>e.target.src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='32' height='32'%3E%3Crect width='32' height='32' fill='%23e2e8f0'/%3E%3C/svg%3E"}
                          alt="" className="w-8 h-8 rounded-full object-cover shrink-0" style={{ border:"1px solid var(--border)" }}
                          referrerPolicy="no-referrer" crossOrigin="anonymous"/>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1 flex-wrap">
                            <a href={`https://www.instagram.com/${item.username}/`} target="_blank" rel="noopener noreferrer"
                              className="text-xs font-semibold font-mono hover:underline" style={{ color:"#e1306c" }}>
                              @{item.username}
                            </a>
                            {item.is_private && <span className="text-[9px] px-1 py-0.5 rounded-full font-bold bg-red-50 text-red-500 border border-red-100">🔒</span>}
                            {item.is_verified && <span className="text-[9px] px-1 py-0.5 rounded-full font-bold bg-blue-50 text-blue-500 border border-blue-100">✓</span>}
                          </div>
                          <p className="text-[10px] truncate mt-0.5" style={{ color:"var(--text-muted)" }}>{item.full_name||""}</p>
                        </div>
                      </div>
                    ))
                  }
                </div>
              </>
            )}
          </div>
        )}
      </div>
    )}

    {/* ── Twitter/X Followers Scraper results panel (Apify) ── */}
    {twScrapeStatus !== "idle" && (
      <div className="rounded-xl shadow-sm overflow-hidden" style={V.card}>
        <button onClick={()=>setTwOpen(v=>!v)} className="w-full flex items-center justify-between px-5 py-3.5 text-left" style={V.inner}>
          <div className="flex items-center gap-2">
            <span className="text-sm">𝕏</span>
            <h3 className="font-semibold text-sm" style={{ color:"var(--text-primary)" }}>
              Twitter / X Followers
              {twScrapeStatus==="success" && <span className="ml-2 text-xs font-normal" style={{ color:"var(--text-muted)" }}>({(twScrapeData?.followers ?? []).length} found)</span>}
            </h3>
            {twScrapeStatus==="loading" && <Loader2 size={12} className="animate-spin" style={{ color:"#1d9bf0" }}/>}
            {twScrapeStatus==="success" && <span className="w-2 h-2 rounded-full bg-green-500"/>}
            {twScrapeStatus==="error"   && <span className="w-2 h-2 rounded-full bg-red-500"/>}
          </div>
          <ChevronDown size={14} style={{ color:"var(--text-muted)", transform: twOpen?"rotate(180deg)":"none", transition:"transform 0.2s" }}/>
        </button>

        {twOpen && (
          <div className="px-4 pb-4">
            {twScrapeStatus==="loading" && (
              <div className="flex items-center gap-3 py-6 justify-center text-sm" style={{ color:"var(--text-muted)" }}>
                <Loader2 size={16} className="animate-spin" style={{ color:"#1d9bf0" }}/>
                Scraping @{target.replace(/^@/,"")} followers via Apify…
              </div>
            )}
            {twScrapeStatus==="error" && (
              <div className="py-4 text-center text-xs text-red-400">Scrape failed — check Apify token or try again.</div>
            )}
            {twScrapeStatus==="success" && (() => {
              const twTarget    = twScrapeData?.target ?? null;
              const twFollowers = twScrapeData?.followers ?? [];
              return (
                <>
                  {/* ── Target profile summary card ── */}
                  {twTarget && (
                    <div className="flex items-start gap-3 px-3 py-3 rounded-xl mb-3 mt-1" style={{ background:"var(--bg-input)", border:"1px solid #1d9bf030" }}>
                      <img
                        src={twTarget.profile_pic_url || "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='44' height='44'%3E%3Crect width='44' height='44' fill='%23e2e8f0'/%3E%3Ccircle cx='22' cy='16' r='8' fill='%2394a3b8'/%3E%3Cellipse cx='22' cy='36' rx='13' ry='9' fill='%2394a3b8'/%3E%3C/svg%3E"}
                        onError={e=>e.target.src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='44' height='44'%3E%3Crect width='44' height='44' fill='%23e2e8f0'/%3E%3C/svg%3E"}
                        alt="" className="w-11 h-11 rounded-full object-cover shrink-0" style={{ border:"2px solid #1d9bf040" }}
                        referrerPolicy="no-referrer" crossOrigin="anonymous"/>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1 flex-wrap">
                          <a href={`https://x.com/${twTarget.username}`} target="_blank" rel="noopener noreferrer"
                            className="text-sm font-bold hover:underline" style={{ color:"var(--text-primary)" }}>
                            {twTarget.display_name || twTarget.username}
                          </a>
                          {twTarget.is_blue_verified && <span className="text-[9px] px-1 py-0.5 rounded-full font-bold" style={{ background:"#e8f5fd", color:"#1d9bf0", border:"1px solid #bee3f8" }}>𝕏</span>}
                          {twTarget.is_verified      && <span className="text-[9px] px-1 py-0.5 rounded-full font-bold bg-blue-50 text-blue-600 border border-blue-100">✓</span>}
                        </div>
                        <div className="text-xs font-mono mt-0.5" style={{ color:"#1d9bf0" }}>@{twTarget.username}</div>
                        {twTarget.description && <p className="text-xs mt-1 leading-snug" style={{ color:"var(--text-muted)" }}>{twTarget.description}</p>}
                        <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-1.5">
                          {twTarget.follower_count != null && (
                            <span className="text-[11px]" style={{ color:"var(--text-muted)" }}>
                              <strong style={{ color:"var(--text-primary)" }}>{Number(twTarget.follower_count).toLocaleString()}</strong> Followers
                            </span>
                          )}
                          {twTarget.following_count != null && (
                            <span className="text-[11px]" style={{ color:"var(--text-muted)" }}>
                              <strong style={{ color:"var(--text-primary)" }}>{Number(twTarget.following_count).toLocaleString()}</strong> Following
                            </span>
                          )}
                          {twTarget.tweet_count != null && (
                            <span className="text-[11px]" style={{ color:"var(--text-muted)" }}>
                              <strong style={{ color:"var(--text-primary)" }}>{Number(twTarget.tweet_count).toLocaleString()}</strong> Posts
                            </span>
                          )}
                          {twTarget.location && (
                            <span className="text-[11px]" style={{ color:"var(--text-muted)" }}>📍 {twTarget.location}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {twFollowers.length === 0 && (
                    <div className="py-3 text-center text-xs" style={{ color:"var(--text-muted)" }}>No followers returned — account may be private or not found.</div>
                  )}

                  {twFollowers.length > 0 && (
                    <>
                      <div className="relative mb-3">
                        <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400"/>
                        <input value={twFilter} onChange={e=>setTwFilter(e.target.value)} placeholder="Filter followers by username or name…"
                          className="w-full pl-7 pr-3 py-1.5 rounded-lg text-xs focus:outline-none focus:ring-2"
                          style={{ background:"var(--bg-input)", border:"1px solid var(--border)", color:"var(--text-primary)" }}/>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-80 overflow-y-auto pr-1 platform-grid">
                        {twFollowers
                          .filter(r => !twFilter.trim() ||
                            (r.username??"").toLowerCase().includes(twFilter.toLowerCase()) ||
                            (r.display_name??"").toLowerCase().includes(twFilter.toLowerCase()))
                          .map((item, i) => (
                            <div key={item.id??i} className="flex items-center gap-2.5 px-3 py-2 rounded-lg" style={{ border:"1px solid var(--border)", background:"var(--bg-card)" }}>
                              <img
                                src={item.profile_pic_url || "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='32' height='32'%3E%3Crect width='32' height='32' fill='%23e2e8f0'/%3E%3Ccircle cx='16' cy='12' r='5' fill='%2394a3b8'/%3E%3Cellipse cx='16' cy='26' rx='9' ry='6' fill='%2394a3b8'/%3E%3C/svg%3E"}
                                onError={e=>e.target.src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='32' height='32'%3E%3Crect width='32' height='32' fill='%23e2e8f0'/%3E%3C/svg%3E"}
                                alt="" className="w-8 h-8 rounded-full object-cover shrink-0" style={{ border:"1px solid var(--border)" }}
                                referrerPolicy="no-referrer" crossOrigin="anonymous"/>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1 flex-wrap">
                                  <a href={`https://x.com/${item.username}`} target="_blank" rel="noopener noreferrer"
                                    className="text-xs font-semibold font-mono hover:underline" style={{ color:"#1d9bf0" }}>
                                    @{item.username}
                                  </a>
                                  {item.is_verified      && <span className="text-[9px] px-1 py-0.5 rounded-full font-bold bg-blue-50 text-blue-600 border border-blue-100">✓</span>}
                                  {item.is_blue_verified && <span className="text-[9px] px-1 py-0.5 rounded-full font-bold" style={{ background:"#e8f5fd", color:"#1d9bf0", border:"1px solid #bee3f8" }}>𝕏</span>}
                                </div>
                                <p className="text-[10px] truncate mt-0.5" style={{ color:"var(--text-muted)" }}>
                                  {item.display_name || ""}
                                  {item.follower_count != null && (
                                    <span className="ml-1 opacity-60">· {Number(item.follower_count).toLocaleString()} followers</span>
                                  )}
                                </p>
                              </div>
                            </div>
                          ))
                        }
                      </div>
                    </>
                  )}
                </>
              );
            })()}
          </div>
        )}
      </div>
    )}

    <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
      <div className="space-y-4">
        <div className="rounded-xl shadow-sm" style={V.card}>
          <div className="px-5 py-4" style={V.inner}><h3 className="font-semibold text-sm" style={{ color:"var(--text-primary)" }}>Target Details</h3></div>
          <div className="px-5 py-4 space-y-3">
            {targetRows.map(({ label, val, icon:Ic })=><div key={label}><label className="font-medium uppercase tracking-wide block mb-1" style={{ fontSize:11, color:"#94a3b8" }}>{label}</label><div className="flex items-center gap-2 px-3 py-2 rounded-lg" style={V.card}><Ic size={12} className="text-slate-400"/><span className="text-slate-600 text-xs break-all" style={{ fontFamily:"monospace" }}>{val}</span></div></div>)}
          </div>
        </div>
        <div className="rounded-xl p-5 shadow-sm" style={V.card}>
          <h3 className="text-slate-800 font-semibold text-sm mb-3">Collection Metadata</h3>
          <div className="space-y-2">{metadata.map((m,i)=>{const k=m?.key??m?.[0]??"";const v=m?.value??m?.[1]??"";return(<div key={k||i} className="flex justify-between items-start gap-2"><span className="text-slate-400 flex-shrink-0" style={{ fontSize:11 }}>{k}</span><span className="text-slate-600 text-right break-all" style={{ fontSize:11, fontFamily:"monospace" }}>{v}</span></div>);})}</div>
        </div>
        <div className="rounded-xl p-5 shadow-sm" style={V.card}>
          <h3 className="text-slate-800 font-semibold text-sm mb-3">Open Source Tools</h3>
          <div className="space-y-2 max-h-80 overflow-y-auto scrollbar-thin pr-1">{(tools.length?tools:[{name:"WhatsMyName",url:"https://whatsmyname.app/",note:"Username checks"},{name:"Sherlock",url:"https://github.com/sherlock-project/sherlock",note:"Open-source CLI"},{name:"Google Lens",url:"https://lens.google/",note:"Reverse image search"}]).map(tool=><a key={tool.name} href={tool.url} target="_blank" rel="noreferrer" className="block rounded-lg p-3 hover:bg-slate-50" style={{ border:"1px solid var(--border)" }}><div className="flex items-center justify-between gap-2"><span className="text-xs font-semibold text-slate-700">{tool.name}</span><ExternalLink size={12} className="text-slate-400"/></div><p className="text-slate-400 mt-1" style={{ fontSize:10 }}>{tool.note}</p></a>)}</div>
        </div>
        <div className="rounded-xl p-5 shadow-sm" style={V.card}>
          <h3 className="text-slate-800 font-semibold text-sm mb-1">Reverse Image Search</h3>
          <p className="text-slate-400 mb-3" style={{ fontSize:11 }}>Paste a public profile photo URL to check for reused/similar images across the web.</p>
          <input value={reverseImageUrl} onChange={(e)=>setReverseImageUrl(e.target.value)} placeholder="https://…/profile-photo.jpg" className="w-full rounded-lg px-3 py-2 text-xs placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-200 mb-2" style={{ background:"var(--bg-input)", border:"1px solid var(--border)", color:"var(--text-primary)" }}/>
          {reverseImageUrl.trim() && reverseImageEngines.length===0 && <p className="text-amber-600 mb-2" style={{ fontSize:10.5 }}>Enter a valid http(s) image URL.</p>}
          <div className="space-y-2">{(reverseImageEngines.length?reverseImageEngines:[{name:"Google Lens",note:"Visual match across the public web"},{name:"Yandex Images",note:"Strong face/photo similarity matching"},{name:"Bing Visual Search",note:"Visually similar image matches"},{name:"TinEye",note:"Finds exact/reused copies of this photo"}]).map(eng=>eng.url?
            <a key={eng.name} href={eng.url} target="_blank" rel="noreferrer" className="block rounded-lg p-3 hover:bg-slate-50" style={{ border:"1px solid var(--border)" }}><div className="flex items-center justify-between gap-2"><span className="text-xs font-semibold text-slate-700">{eng.name}</span><ExternalLink size={12} className="text-slate-400"/></div><p className="text-slate-400 mt-1" style={{ fontSize:10 }}>{eng.note}</p></a>
            : <div key={eng.name} className="block rounded-lg p-3 opacity-50 cursor-not-allowed" style={{ border:"1px solid var(--border)" }}><div className="flex items-center justify-between gap-2"><span className="text-xs font-semibold text-slate-700">{eng.name}</span><ExternalLink size={12} className="text-slate-400"/></div><p className="text-slate-400 mt-1" style={{ fontSize:10 }}>{eng.note}</p></div>
          )}</div>
        </div>
        <div className="rounded-xl p-5 shadow-sm" style={V.card}>
          <h3 className="text-slate-800 font-semibold text-sm mb-1">Breach &amp; Leak Exposure</h3>
          <p className="text-slate-400 mb-3" style={{ fontSize:11 }}>Check an email or username against known public breach/leak references and exposed paste data.</p>
          <input value={breachQuery} onChange={(e)=>setBreachQuery(e.target.value)} placeholder="email@example.com or username" className="w-full rounded-lg px-3 py-2 text-xs placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-200 mb-2" style={{ background:"var(--bg-input)", border:"1px solid var(--border)", color:"var(--text-primary)" }}/>
          <div className="space-y-2">{(breachEngines.length?breachEngines:[{name:"Have I Been Pwned",note:"Checks this email against known public breaches"},{name:"Intelligence X",note:"Searches leaks, pastes, and breach archives"},{name:"LeakCheck",note:"Checks email/username against leaked databases"},{name:"DeHashed",note:"Searches breach data for matching identifiers"},{name:"Pastebin (via search)",note:"Finds pastes referencing this identifier"}]).map(eng=>eng.url?
            <a key={eng.name} href={eng.url} target="_blank" rel="noreferrer" className="block rounded-lg p-3 hover:bg-slate-50" style={{ border:"1px solid var(--border)" }}><div className="flex items-center justify-between gap-2"><span className="text-xs font-semibold text-slate-700">{eng.name}</span><ExternalLink size={12} className="text-slate-400"/></div><p className="text-slate-400 mt-1" style={{ fontSize:10 }}>{eng.note}</p></a>
            : <div key={eng.name} className="block rounded-lg p-3 opacity-50 cursor-not-allowed" style={{ border:"1px solid var(--border)" }}><div className="flex items-center justify-between gap-2"><span className="text-xs font-semibold text-slate-700">{eng.name}</span><ExternalLink size={12} className="text-slate-400"/></div><p className="text-slate-400 mt-1" style={{ fontSize:10 }}>{eng.note}</p></div>
          )}</div>
        </div>
        {/* Email Intelligence — auto-shows when type is email or breach query is an email */}
        {(investigation?.type === "email" || (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(breachQuery))) && (
          <EmailOsintCard email={investigation?.type === "email" ? investigation.target : breachQuery} />
        )}
      </div>
      <div className="lg:col-span-2 space-y-4">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 card-grid-4">{[{ label:"Confirmed", value:stats.foundProfiles, color:"text-green-600" },{ label:"Crawled", value:stats.crawledPages || 0, color:"text-blue-600" },{ label:"Sources", value:stats.sources || 0, color:"text-indigo-600" },{ label:"Confidence", value:`${stats.confidence}%`, color:"text-amber-600" }].map(({ label, value, color })=><div key={label} className="rounded-xl px-4 py-3 shadow-sm" style={V.card}><div className={cn("text-lg font-bold tabular-nums", color)} style={{ fontFamily:"monospace" }}>{value}</div><div className="text-xs mt-0.5" style={{ color:"var(--text-muted)" }}>{label}</div></div>)}</div>
        <div className="rounded-xl shadow-sm" style={V.card}>
          <div className="flex items-center justify-between px-5 py-3.5" style={V.inner}><h3 className="font-semibold text-sm" style={{ color:"var(--text-primary)" }}>Public Platform Checks</h3><div className="flex items-center gap-1.5 text-xs text-blue-600">{investigationLoading?<Loader2 size={12} className="animate-spin"/>:<Globe size={12}/>}<span>{visibleFindings.length} of {findings.length} checks</span></div></div>
          <div className="px-4 pt-3 flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1 min-w-0">
              <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400"/>
              <input value={checkQuery} onChange={(e)=>setCheckQuery(e.target.value)} placeholder="Search platform, username, or text…" className="w-full rounded-lg pl-7 pr-3 py-1.5 text-xs placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-200" style={{ background:"var(--bg-input)", border:"1px solid var(--border)", color:"var(--text-primary)" }}/>
            </div>
            <select value={checkStatus} onChange={(e)=>setCheckStatus(e.target.value)} className="rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-200" style={{ background:"var(--bg-input)", border:"1px solid var(--border)", color:"var(--text-primary)" }}>
              {STATUS_FILTERS.map(s=><option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
            <select value={checkSort} onChange={(e)=>setCheckSort(e.target.value)} className="rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-200" style={{ background:"var(--bg-input)", border:"1px solid var(--border)", color:"var(--text-primary)" }}>
              {SORT_OPTIONS.map(s=><option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
          </div>
          <div className="platform-grid grid gap-3 p-4">{visibleFindings.length ? visibleFindings.map(({ raw:p, fields }, i)=>{
            const sl = statusLabel(p.status);
            const bg = p.status==="found" ? "var(--bg-card)" : p.status==="blocked" ? "var(--bg-card)" : "var(--bg-card)";
            return <div key={`${p.platform}-${i}`} className="rounded-xl p-3.5 transition-all" style={{ border:"1px solid #e2e8f0", backgroundColor:bg }}>
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  {p.metadata?.profile_pic
                    ? <img src={p.metadata.profile_pic} alt="" referrerPolicy="no-referrer" crossOrigin="anonymous"
                        onError={e=>{ e.target.style.display="none"; e.target.nextSibling.style.display="flex"; }}
                        className="w-8 h-8 rounded-full object-cover shrink-0" style={{ border:"1px solid #e2e8f0" }}/>
                    : null}
                  <span style={{ display: p.metadata?.profile_pic ? "none" : "flex" }}>
                    <PlatformPill abbr={p.abbr || (p.platform || "?").slice(0,2).toUpperCase()} color={p.color || "#2563eb"}/>
                  </span>
                  <span className="text-slate-700 text-xs font-semibold">{p.platform || "Unknown"}</span>
                </div>
                {statusIcon(p.status)}
              </div>
              <div className="flex items-center justify-between gap-2 mb-2.5"><span className={cn("font-medium px-2 py-0.5 rounded-full", sl.cls)} style={{ fontSize:10 }}>{sl.text}</span><a href={p.url} target="_blank" rel="noreferrer" className="text-slate-400 hover:text-blue-500"><ExternalLink size={12}/></a></div>
              <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 rounded-lg p-2.5" style={{ background:"var(--bg-input)", border:"1px solid var(--border)" }}>
                <FieldCell icon={AtSign} label="Username" value={fields.username}/>
                <FieldCell icon={Calendar} label="Created Date" value={fields.createdDate}/>
                {fields.fullName && <FieldCell icon={User} label="Full Name" value={fields.fullName} span/>}
                <FieldCell icon={Users} label="Followers" value={fields.followers}/>
                <FieldCell icon={TrendingUp} label="Following" value={fields.following}/>
                {fields.posts && <FieldCell icon={Hash} label="Posts" value={fields.posts}/>}
                {fields.verified && <FieldCell icon={CheckCircle2} label="Verified" value={fields.verified}/>}
                {fields.acctType && <FieldCell icon={Lock} label="Account Type" value={fields.acctType}/>}
                <FieldCell icon={MapPin} label="Location" value={fields.location} span/>
                {fields.bio && <FieldCell icon={Info} label="Bio" value={fields.bio} span/>}
                {fields.category && <FieldCell icon={Flag} label="Category" value={fields.category} span/>}
                {fields.extUrl && <FieldCell icon={LinkIcon} label="Website" value={fields.extUrl} span/>}
                {/* ── Reddit-specific fields ── */}
                {fields.redditPostKarma    && <FieldCell icon={TrendingUp}   label="Post Karma"     value={fields.redditPostKarma}/>}
                {fields.redditCommentKarma && <FieldCell icon={Hash}         label="Comment Karma"  value={fields.redditCommentKarma}/>}
                {fields.redditSubreddits   && <FieldCell icon={Globe}        label="Active In"      value={fields.redditSubreddits} span/>}
                {fields.redditLastActive   && <FieldCell icon={Calendar}     label="Last Active"    value={fields.redditLastActive}/>}
                {fields.redditIsGold       && <FieldCell icon={Award}        label="Reddit Gold"    value={fields.redditIsGold}/>}
                {/* ── Google Maps Review fields ── */}
                {fields.mapsPlace          && <FieldCell icon={MapPin}       label="Reviewed Place" value={fields.mapsPlace} span/>}
                {fields.mapsRating         && <FieldCell icon={Award}        label="Rating"         value={fields.mapsRating}/>}
                {fields.mapsReviewDate     && <FieldCell icon={Calendar}     label="Review Date"    value={fields.mapsReviewDate}/>}
                {fields.mapsReviewsScanned && <FieldCell icon={Eye}          label="Reviews Scanned" value={fields.mapsReviewsScanned}/>}
                {fields.mapsReviewText     && <FieldCell icon={Info}         label="Review Text"    value={fields.mapsReviewText} span/>}
                {fields.other.map((o,oi)=><FieldCell key={oi} icon={Hash} label={o.label} value={o.value} span={o.value.length>18}/>)}
              </div>
              {p.snippet && <div className="mt-2 line-clamp-2" style={{ fontSize:10.5, color:"var(--text-sec)" }}>{p.snippet}</div>}
            </div>;
          }) : <div className="col-span-full rounded-xl p-6 text-center text-slate-400 text-sm" style={{ border:"1px dashed var(--border)" }}>{findings.length ? "No checks match the current filter/search." : "Run an investigation to populate public profile checks."}</div>}</div>
        </div>

        <div className="rounded-xl shadow-sm" style={V.card}>
          <div className="flex items-center justify-between px-5 py-3.5" style={V.inner}><h3 className="font-semibold text-sm" style={{ color:"var(--text-primary)" }}>Fetched Public Page Content</h3><span className="text-xs text-slate-400">{crawledPages.length} crawled</span></div>
          <div className="grid grid-cols-1 gap-3 p-4">{crawledPages.length ? crawledPages.slice(0,8).map((page,i)=><a key={`${page.url}-${i}`} href={page.url} target="_blank" rel="noreferrer" className="rounded-xl p-3.5 hover:shadow-sm transition-all" style={{ border:"1px solid var(--border)", background:"var(--bg-card)" }}><div className="flex items-start justify-between gap-3"><div className="min-w-0"><div className="text-xs font-semibold text-slate-700 truncate">{page.title}</div><div className="text-blue-500 truncate mt-0.5" style={{ fontSize:10, fontFamily:"monospace" }}>{page.url}</div></div><span className="text-slate-400 flex items-center gap-1 flex-shrink-0" style={{ fontSize:10 }}><ExternalLink size={11}/>{page.extractor}</span></div><p className="mt-2 text-slate-500 leading-relaxed line-clamp-4" style={{ fontSize:11, whiteSpace:"pre-wrap" }}>{page.snippet || "No readable text returned by the public crawler."}</p></a>) : <div className="rounded-xl p-6 text-center text-slate-400 text-sm" style={{ border:"1px dashed var(--border)" }}>Run an investigation to search URLs and fetch readable public page content here.</div>}</div>
        </div>
        <div className="rounded-xl shadow-sm" style={V.card}>
          <div className="flex items-center justify-between px-5 py-3.5" style={V.inner}><h3 className="font-semibold text-sm" style={{ color:"var(--text-primary)" }}>Gemini Grounded Web Search</h3><span className="text-xs text-slate-400">{sourceLinks.length} sources</span></div>
          <div className="p-4 space-y-3">
            <div className="rounded-xl p-4 text-sm leading-relaxed whitespace-pre-wrap" style={{ background:"var(--bg-input)", color:"var(--text-sec)", border:"1px solid var(--border)" }}>{investigation?.gemini?.summary || (geminiConfigured ? "Run a search to combine Gemini grounded web search with fetched crawler content." : "Add VITE_GEMINI_API_KEY at build time or paste a runtime key above, then run a search to combine Gemini grounded web search with fetched crawler content.")}</div>
            {sourceLinks.length>0 && <div className="grid grid-cols-1 md:grid-cols-2 gap-2">{sourceLinks.slice(0,8).map((src,i)=><a key={`${src.url}-${i}`} href={src.url} target="_blank" rel="noreferrer" className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs text-blue-700 bg-blue-50 border border-blue-100 hover:bg-blue-100"><ExternalLink size={12}/><span className="truncate">{src.title}</span></a>)}</div>}
          </div>
        </div>
        {investigation?.deepseekFallback && <div className="rounded-xl shadow-sm" style={V.card}>
          <div className="flex items-center justify-between px-5 py-3.5" style={V.inner}>
            <div className="flex items-center gap-2"><Globe size={14} className="text-amber-600"/><h3 className="font-semibold text-sm" style={{ color:"var(--text-primary)" }}>Fallback Search (DeepSeek)</h3></div>
            <span className="flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200"><AlertTriangle size={11}/>Gemini unavailable</span>
          </div>
          <div className="p-4 space-y-3">
            <div className="rounded-xl p-3 text-xs leading-relaxed" style={{ background:"var(--bg-input)", color:"var(--text-sec)", border:"1px solid var(--border)" }}>{investigation.deepseekFallback.summary}</div>
            {investigation.deepseekFallback.sites?.length>0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {investigation.deepseekFallback.sites.map((site,i)=>(
                  <a key={`${site.url}-${i}`} href={site.url} target="_blank" rel="noreferrer" className="rounded-lg px-3 py-2.5 hover:shadow-sm transition-all" style={{ border:"1px solid var(--border)", background:"var(--bg-card)" }}>
                    <div className="flex items-center justify-between gap-2"><span className="text-xs font-semibold text-slate-700 truncate">{site.name}</span><ExternalLink size={11} className="text-slate-400 flex-shrink-0"/></div>
                    <div className="text-amber-600 truncate mt-0.5" style={{ fontSize:10, fontFamily:"monospace" }}>{site.url}</div>
                    {site.reason && <p className="mt-1.5 text-slate-500 leading-relaxed line-clamp-2" style={{ fontSize:10.5 }}>{site.reason}</p>}
                  </a>
                ))}
              </div>
            ) : (
              <div className="rounded-xl p-4 text-center text-slate-400 text-xs" style={{ border:"1px dashed var(--border)" }}>
                {investigation.deepseekFallback.enabled ? "DeepSeek returned no parseable site suggestions for this target." : "Add VITE_DEEPSEEK_API_KEY (or DEEPSEEK_API_KEY) to enable the fallback search engine for when Gemini is unavailable."}
              </div>
            )}
          </div>
        </div>}
        <div className="rounded-xl shadow-sm" style={V.card}>
          <div className="flex items-center justify-between px-5 py-3.5" style={V.inner}><h3 className="font-semibold text-sm" style={{ color:"var(--text-primary)" }}>Search Operators</h3><span className="text-xs text-slate-400">Open in new tabs</span></div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 p-4">{searchLinks.length ? searchLinks.slice(0,12).map((link,i)=><a key={`${link.engine}-${i}`} href={link.url} target="_blank" rel="noreferrer" className="rounded-lg px-3 py-2 hover:bg-slate-50" style={{ border:"1px solid var(--border)" }}><div className="flex items-center justify-between gap-2"><span className="text-xs font-semibold text-slate-700">{link.engine}</span><ExternalLink size={12} className="text-slate-400"/></div><div className="text-slate-400 truncate mt-1" style={{ fontSize:10, fontFamily:"monospace" }}>{link.query}</div></a>) : <div className="col-span-full text-center text-slate-400 text-sm py-6">Search links will appear here after a run.</div>}</div>
        </div>
        <div className="rounded-xl shadow-sm" style={V.card}>
          <div className="flex items-center justify-between px-5 py-3.5" style={V.inner}><h3 className="font-semibold text-sm" style={{ color:"var(--text-primary)" }}>Activity Log</h3><div className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"/><span className="text-xs text-green-600 font-medium">Live</span></div></div>
          <div className="px-4 py-3 space-y-2" style={{ maxHeight:192, overflowY:"auto" }}>{logs.map((entry,i)=><div key={i} className="flex items-start gap-3"><span className="tabular-nums text-slate-400 pt-0.5 flex-shrink-0" style={{ fontSize:10, width:64, fontFamily:"monospace" }}>{entry.time}</span><span className={cn("w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0", logDot(entry.level))}/><span className={cn("leading-relaxed", logColor(entry.level))} style={{ fontSize:11 }}>{entry.msg}</span></div>)}</div>
        </div>

        {/* ── Instagram Posts Panel ── */}
        {igPostsStatus !== "idle" && (
          <div className="rounded-xl shadow-sm overflow-hidden" style={V.card}>
            <button onClick={()=>setIgPostsOpen(v=>!v)} className="w-full flex items-center justify-between px-5 py-3.5 text-left" style={V.inner}>
              <div className="flex items-center gap-2">
                <span className="text-sm">📸</span>
                <h3 className="font-semibold text-sm" style={{ color:"var(--text-primary)" }}>
                  Instagram Posts
                  {igPostsStatus==="success" && <span className="ml-2 text-xs font-normal" style={{ color:"var(--text-muted)" }}>({igPosts.length} posts)</span>}
                  {igPostsTarget && <span className="ml-1.5 text-xs font-normal text-pink-500">@{igPostsTarget}</span>}
                </h3>
                {igPostsStatus==="loading"  && <Loader2 size={12} className="animate-spin text-pink-500"/>}
                {igPostsStatus==="success"  && <span className="w-2 h-2 rounded-full bg-green-500"/>}
                {igPostsStatus==="error"    && <span className="w-2 h-2 rounded-full bg-red-500"/>}
                {igPostsStatus==="timeout"  && <span className="w-2 h-2 rounded-full bg-amber-400"/>}
              </div>
              <ChevronDown size={14} style={{ color:"var(--text-muted)", transform: igPostsOpen?"rotate(180deg)":"none", transition:"transform 0.2s" }}/>
            </button>

            {igPostsOpen && (
              <div className="p-4">
                {igPostsStatus==="loading" && (
                  <div className="flex flex-col items-center gap-3 py-8 text-center">
                    <Loader2 size={20} className="animate-spin text-pink-500"/>
                    <div>
                      <p className="text-sm font-medium" style={{ color:"var(--text-primary)" }}>Collecting posts for @{igPostsTarget}…</p>
                      <p className="text-xs mt-1" style={{ color:"var(--text-muted)" }}>Instagram scraping can take 1–2 minutes. Hang tight.</p>
                    </div>
                  </div>
                )}
                {igPostsStatus==="timeout" && (
                  <div className="py-6 text-center">
                    <AlertTriangle size={20} className="text-amber-400 mx-auto mb-2"/>
                    <p className="text-sm font-medium" style={{ color:"var(--text-primary)" }}>Still processing in background</p>
                    <p className="text-xs mt-1" style={{ color:"var(--text-muted)" }}>Apify is still scraping. Try re-running the search in ~2 min to see results.</p>
                  </div>
                )}
                {igPostsStatus==="error" && (
                  <div className="py-5 text-center text-xs text-red-400">
                    Posts scrape failed — check Apify token or try again.
                  </div>
                )}
                {igPostsStatus==="success" && igPosts.length === 0 && (
                  <div className="py-6 flex flex-col items-center gap-2 text-center">
                    <span className="text-2xl">📭</span>
                    <p className="text-sm font-medium" style={{ color:"var(--text-primary)" }}>No posts returned</p>
                    <p className="text-xs" style={{ color:"var(--text-muted)" }}>Account may be private, or the scraper got an empty dataset. Check Vercel logs or retry.</p>
                    <button
                      onClick={() => {
                        setIgPosts([]);
                        setIgPostsStatus("loading");
                        const ct = igPostsTarget;
                        (async () => {
                          try {
                            const r = await fetch("/api/scrape-instagram-posts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username: ct, limit: 30 }) });
                            const d = await r.json();
                            if (r.ok && d.posts) { setIgPosts(d.posts); setIgPostsStatus("success"); saveIgPosts(ct, d.posts).catch(() => {}); }
                            else setIgPostsStatus("error");
                          } catch { setIgPostsStatus("error"); }
                        })();
                      }}
                      className="mt-1 px-4 py-1.5 rounded-lg text-xs font-medium bg-pink-500 hover:bg-pink-600 text-white transition-colors"
                    >
                      Retry Posts Scrape
                    </button>
                  </div>
                )}
                {igPostsStatus==="success" && igPosts.length > 0 && (
                  <>
                    {/* ── Debug: raw field inspector (shows first post's keys so we can verify field names) ── */}
                    {process.env.NODE_ENV !== "production" && (
                      <details className="mb-3 text-xs rounded-lg p-2" style={{ background:"var(--bg-input)", color:"var(--text-muted)" }}>
                        <summary className="cursor-pointer font-mono">🔍 Debug: first post keys</summary>
                        <pre className="mt-1 overflow-auto" style={{ fontSize:9, maxHeight:120 }}>
                          {JSON.stringify(igPosts[0], null, 2)}
                        </pre>
                      </details>
                    )}
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                      {igPosts.map((post, i) => {
                        // Resolve thumbnail — handle every known field name from Apify actors
                        const thumb =
                          post.displayUrl ||
                          post.thumbnailSrc ||
                          post.thumbnailUrl ||
                          post.imageUrl ||
                          post.previewUrl ||
                          (Array.isArray(post.images) && post.images.length > 0
                            ? (typeof post.images[0] === "string" ? post.images[0] : post.images[0]?.url ?? post.images[0]?.src)
                            : null) ||
                          null;
                        const postUrl =
                          post.url ||
                          (post.shortCode ? `https://www.instagram.com/p/${post.shortCode}/` : null) ||
                          (post.code ? `https://www.instagram.com/p/${post.code}/` : null) ||
                          `https://www.instagram.com/${igPostsTarget}/`;
                        const likes   = post.likesCount ?? post.likes ?? post.likeCount ?? null;
                        const comments = post.commentsCount ?? post.commentsNumber ?? post.commentCount ?? post.comments ?? null;
                        const views   = post.videoViewCount ?? post.videoViews ?? post.viewCount ?? null;
                        const ts      = post.timestamp ?? post.takenAt ?? post.taken_at ?? null;
                        const isVideo = post.isVideo ?? post.type === "Video" ?? post.mediaType === 2 ?? false;
                        return (
                          <a key={post.id ?? i} href={postUrl}
                            target="_blank" rel="noopener noreferrer"
                            className="group rounded-xl overflow-hidden transition-all hover:shadow-md"
                            style={{ border:"1px solid var(--border)", background:"var(--bg-card)" }}>
                            {/* Thumbnail */}
                            <div className="relative w-full" style={{ paddingTop:"100%", background:"var(--bg-input)" }}>
                              {thumb ? (
                                <img src={thumb} alt={post.caption?.slice(0,60) ?? "post"}
                                  referrerPolicy="no-referrer"
                                  className="absolute inset-0 w-full h-full object-cover"
                                  onError={e => { e.currentTarget.style.display="none"; e.currentTarget.nextElementSibling.style.display="flex"; }}
                                />
                              ) : null}
                              <div className="absolute inset-0 items-center justify-center flex-col gap-1"
                                style={{ display: thumb ? "none" : "flex", color:"var(--text-muted)" }}>
                                <ImageIcon size={20}/>
                                <span style={{ fontSize:9 }}>No image</span>
                              </div>
                              {isVideo && (
                                <div className="absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded-full text-white"
                                  style={{ background:"rgba(0,0,0,0.65)", fontSize:9, fontWeight:700 }}>▶ VIDEO</div>
                              )}
                            </div>
                            {/* Meta */}
                            <div className="p-2.5">
                              {post.caption && (
                                <p className="text-xs leading-snug line-clamp-2 mb-1.5" style={{ color:"var(--text-sec)" }}>
                                  {post.caption}
                                </p>
                              )}
                              <div className="flex items-center gap-3 flex-wrap">
                                {likes != null && (
                                  <span className="flex items-center gap-1 text-xs" style={{ color:"var(--text-muted)" }}>
                                    ❤️ {Number(likes).toLocaleString()}
                                  </span>
                                )}
                                {comments != null && (
                                  <span className="flex items-center gap-1 text-xs" style={{ color:"var(--text-muted)" }}>
                                    💬 {Number(comments).toLocaleString()}
                                  </span>
                                )}
                                {views != null && (
                                  <span className="flex items-center gap-1 text-xs" style={{ color:"var(--text-muted)" }}>
                                    👁 {Number(views).toLocaleString()}
                                  </span>
                                )}
                              </div>
                              {post.locationName && (
                                <p className="text-xs mt-1 truncate" style={{ color:"var(--text-muted)" }}>📍 {post.locationName}</p>
                              )}
                              {ts && (
                                <p className="text-xs mt-0.5" style={{ color:"var(--text-muted)", fontSize:10 }}>
                                  {new Date(ts).toLocaleDateString(undefined, {day:"numeric",month:"short",year:"numeric"})}
                                </p>
                              )}
                              {post.hashtags?.length > 0 && (
                                <div className="flex flex-wrap gap-1 mt-1.5">
                                  {post.hashtags.slice(0,3).map(h => (
                                    <span key={h} className="text-blue-500 font-medium" style={{ fontSize:9 }}>#{h}</span>
                                  ))}
                                </div>
                              )}
                            </div>
                          </a>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        )}

        <button onClick={()=>setActivePage("ai-analysis")} className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors"><Brain size={15}/>Proceed to AI Analysis<ChevronRight size={14}/></button>
      </div>
    </div>
  </div>;
}

// ── Email OSINT Card (Epieos-style) ──────────────────────────────────────────

function EmailOsintCard({ email }) {
  const [loading, setLoading] = useState(false);
  const [result, setResult]   = useState(null);
  const [error, setError]     = useState("");
  const [query, setQuery]     = useState(email || "");

  // Auto-run when email prop arrives / changes
  useEffect(() => {
    if (email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setQuery(email);
      runLookup(email);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [email]);

  async function runLookup(target) {
    const addr = (target || query).trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(addr)) { setError("Enter a valid email address."); return; }
    setLoading(true); setError(""); setResult(null);
    try {
      const res = await fetch("/api/email-osint", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: addr }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Lookup failed");
      setResult(data);
    } catch (e) {
      setError(e.message || "Request failed");
    } finally {
      setLoading(false);
    }
  }

  const ServiceIcon = ({ name }) => {
    const icons = { "Twitter/X":"𝕏", GitHub:"⚙", Spotify:"🎵", Duolingo:"🦉", Adobe:"🅰", Imgur:"🖼", Gravatar:"🌐" };
    return <span className="mr-1 text-sm">{icons[name] || "🔗"}</span>;
  };

  const riskColor = (count) => count >= 5 ? "#ef4444" : count >= 2 ? "#f97316" : count >= 1 ? "#eab308" : "#22c55e";
  const riskLabel = (count) => count >= 5 ? "High Exposure" : count >= 2 ? "Moderate" : count >= 1 ? "Low" : "Clean";

  return (
    <div className="rounded-xl shadow-sm overflow-hidden" style={{ border:"1px solid var(--border)", background:"var(--bg-card)" }}>
      {/* Header */}
      <div className="px-5 py-3.5 flex items-center justify-between" style={{ borderBottom:"1px solid var(--border)", background:"linear-gradient(135deg,#1e3a5f08,#2563eb0a)" }}>
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background:"linear-gradient(135deg,#2563eb,#4f46e5)" }}>
            <Mail size={13} className="text-white"/>
          </div>
          <div>
            <h3 className="font-semibold text-sm" style={{ color:"var(--text-primary)" }}>Email Intelligence</h3>
            <p className="text-xs" style={{ color:"var(--text-muted)" }}>Google Account • Breach Exposure • Service Enumeration</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 text-xs" style={{ color:"var(--text-muted)" }}>
          <Shield size={11}/><span>Epieos-style</span>
        </div>
      </div>

      <div className="p-4 space-y-3">
        {/* Search bar */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Mail size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400"/>
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => e.key === "Enter" && runLookup()}
              placeholder="target@email.com"
              className="w-full rounded-lg pl-8 pr-3 py-2 text-xs placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-200"
              style={{ background:"var(--bg-input)", border:"1px solid var(--border)", color:"var(--text-primary)" }}
            />
          </div>
          <button
            onClick={() => runLookup()}
            disabled={loading}
            className="px-3 py-2 rounded-lg text-xs font-semibold text-white transition-opacity disabled:opacity-50"
            style={{ background:"linear-gradient(135deg,#2563eb,#4f46e5)", minWidth:64 }}
          >
            {loading ? <Loader2 size={12} className="animate-spin mx-auto"/> : "Search"}
          </button>
        </div>

        {error && (
          <div className="rounded-lg px-3 py-2 text-xs text-red-700 bg-red-50 flex items-center gap-2">
            <AlertTriangle size={12}/>{error}
          </div>
        )}

        {loading && (
          <div className="rounded-xl p-6 flex flex-col items-center gap-3" style={{ border:"1px solid var(--border)" }}>
            <Loader2 size={20} className="animate-spin text-blue-500"/>
            <p className="text-xs text-slate-400">Querying Google, HIBP &amp; service probes…</p>
          </div>
        )}

        {result && !loading && (
          <div className="space-y-3">

            {/* ── Google Account Card ── */}
            <div className="rounded-xl p-4 space-y-3" style={{ border:"1px solid #e2e8f0", background:"var(--bg-card)" }}>
              {/* Google logo area */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <svg width="18" height="18" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
                  <span className="text-sm font-semibold" style={{ color:"var(--text-primary)" }}>Google Account</span>
                </div>
                {result.google?.found
                  ? <span className="text-xs px-2 py-0.5 rounded-full bg-green-50 text-green-700 ring-1 ring-green-200">Found</span>
                  : <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">Not Found</span>}
              </div>

              {result.google?.found ? (
                <div className="space-y-2">
                  {/* Profile photo + name */}
                  <div className="flex items-center gap-3 p-3 rounded-lg" style={{ background:"var(--bg-input)" }}>
                    {result.google.profilePhoto ? (
                      <img src={result.google.profilePhoto} alt="" referrerPolicy="no-referrer"
                        className="w-10 h-10 rounded-full object-cover ring-2 ring-blue-100"
                        onError={e => { e.target.style.display="none"; }}/>
                    ) : (
                      <div className="w-10 h-10 rounded-full flex items-center justify-center text-lg" style={{ background:"#e2e8f0" }}>👤</div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-semibold truncate" style={{ color:"var(--text-primary)" }}>
                        {result.google.displayName || result.email}
                      </div>
                      <div className="text-xs font-mono mt-0.5" style={{ color:"var(--text-muted)" }}>
                        ID: {result.google.gaiaId}
                      </div>
                      {result.google.lastUpdated && (
                        <div className="text-xs mt-0.5" style={{ color:"var(--text-muted)" }}>
                          Last updated: {result.google.lastUpdated.slice(0, 10)}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Linked Services */}
                  <div>
                    <p className="text-xs font-medium mb-1.5" style={{ color:"var(--text-muted)" }}>Linked Services</p>
                    <div className="space-y-1">
                      {[
                        { label:"Google Maps", key:"googleMaps", icon:"🗺" },
                        { label:"Google Calendar", key:"googleCalendar", icon:"📅" },
                        { label:"Google+ Archive", key:"googlePlusArchive", icon:"📦" },
                        { label:"Google Photos", key:"googlePhotos", icon:"📷" },
                      ].map(({ label, key, icon }) => (
                        <a key={key} href={result.google.services?.[key]} target="_blank" rel="noreferrer"
                          className="flex items-center justify-between px-3 py-2 rounded-lg hover:bg-blue-50 transition-colors group"
                          style={{ border:"1px solid var(--border)" }}>
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-sm">{icon}</span>
                            <span className="text-xs font-medium truncate" style={{ color:"var(--text-primary)" }}>{label}</span>
                          </div>
                          <ExternalLink size={11} className="text-slate-400 group-hover:text-blue-500 flex-shrink-0"/>
                        </a>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-xs px-3 py-2 rounded-lg bg-slate-50" style={{ color:"var(--text-muted)" }}>
                  {result.google?.reason || "No public Google account associated with this email."}
                </p>
              )}
            </div>

            {/* ── HIBP Breach Card ── */}
            <div className="rounded-xl p-4 space-y-3" style={{ border:"1px solid #e2e8f0", background:"var(--bg-card)" }}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded flex items-center justify-center text-white text-xs font-bold" style={{ background:"#d13c47" }}>!</div>
                  <span className="text-sm font-semibold" style={{ color:"var(--text-primary)" }}>Have I Been Pwned</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold" style={{ color: riskColor(result.hibp?.found || 0) }}>
                    {result.hibp?.found || 0} breach{result.hibp?.found !== 1 ? "es" : ""}
                  </span>
                  <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                    style={{ background: riskColor(result.hibp?.found || 0) + "18", color: riskColor(result.hibp?.found || 0), border:`1px solid ${riskColor(result.hibp?.found || 0)}40` }}>
                    {riskLabel(result.hibp?.found || 0)}
                  </span>
                </div>
              </div>

              {result.hibp?.source === "HIBP Public List (no API key)" && (
                <div className="text-xs px-3 py-2 rounded-lg bg-amber-50 text-amber-700 flex items-center gap-2">
                  <AlertTriangle size={11}/>
                  Domain-level results only — add <code className="font-mono bg-amber-100 px-1 rounded">HIBP_API_KEY</code> for per-email breach data
                </div>
              )}

              {result.hibp?.breaches?.length > 0 ? (
                <div className="space-y-2">
                  {result.hibp.breaches.map((b, i) => (
                    <div key={i} className="rounded-lg px-3 py-2.5" style={{ border:"1px solid var(--border)", background:"var(--bg-input)" }}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="text-xs font-semibold" style={{ color:"var(--text-primary)" }}>{b.name}</div>
                          {b.domain && <div className="text-xs font-mono" style={{ color:"var(--text-muted)" }}>{b.domain}</div>}
                        </div>
                        <div className="flex-shrink-0 text-right">
                          {b.date && <div className="text-xs tabular-nums" style={{ color:"var(--text-muted)" }}>{b.date}</div>}
                          {b.pwnCount && <div className="text-xs tabular-nums text-red-500">{(b.pwnCount/1e6).toFixed(1)}M records</div>}
                        </div>
                      </div>
                      {b.dataClasses?.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {b.dataClasses.map(dc => (
                            <span key={dc} className="text-xs px-1.5 py-0.5 rounded bg-red-50 text-red-600 ring-1 ring-red-100">{dc}</span>
                          ))}
                        </div>
                      )}
                      {b.note && <p className="text-xs mt-1 italic" style={{ color:"var(--text-muted)" }}>{b.note}</p>}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-green-50">
                  <CheckCircle2 size={13} className="text-green-500"/>
                  <span className="text-xs text-green-700">No breaches found for this domain</span>
                </div>
              )}

              {/* Manual check links */}
              <div className="grid grid-cols-2 gap-1.5 pt-1">
                {[
                  { label:"Have I Been Pwned", url:`https://haveibeenpwned.com/account/${encodeURIComponent(query)}` },
                  { label:"Intelligence X", url:`https://intelx.io/?s=${encodeURIComponent(query)}` },
                  { label:"LeakCheck", url:`https://leakcheck.io/search?query=${encodeURIComponent(query)}` },
                  { label:"DeHashed", url:`https://dehashed.com/search?query=${encodeURIComponent(query)}` },
                ].map(({ label, url }) => (
                  <a key={label} href={url} target="_blank" rel="noreferrer"
                    className="flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-blue-50 transition-colors group text-xs"
                    style={{ border:"1px solid var(--border)" }}>
                    <span style={{ color:"var(--text-primary)" }}>{label}</span>
                    <ExternalLink size={9} className="text-slate-400 group-hover:text-blue-500"/>
                  </a>
                ))}
              </div>
            </div>

            {/* ── Service Enumeration Card ── */}
            {result.services?.length > 0 && (
              <div className="rounded-xl p-4 space-y-3" style={{ border:"1px solid #e2e8f0", background:"var(--bg-card)" }}>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold" style={{ color:"var(--text-primary)" }}>Service Registration</span>
                  <span className="text-xs" style={{ color:"var(--text-muted)" }}>
                    {result.services.filter(s => s.status === "registered").length} registered
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  {result.services.map(svc => (
                    <div key={svc.name}
                      className="flex items-center gap-2 px-3 py-2 rounded-lg"
                      style={{ border:"1px solid var(--border)", background:svc.status==="registered"?"var(--bg-card)":"var(--bg-input)" }}>
                      <ServiceIcon name={svc.name}/>
                      <span className="text-xs flex-1 truncate" style={{ color:"var(--text-primary)" }}>{svc.name}</span>
                      {svc.status === "registered"
                        ? <CheckCircle2 size={12} className="text-green-500 flex-shrink-0"/>
                        : <Circle size={12} className="text-slate-300 flex-shrink-0"/>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── Quick OSINT links ── */}
            <div className="rounded-xl p-4 space-y-2" style={{ border:"1px solid #e2e8f0", background:"var(--bg-card)" }}>
              <span className="text-xs font-semibold" style={{ color:"var(--text-primary)" }}>Quick Investigation Links</span>
              <div className="grid grid-cols-2 gap-1.5 mt-1.5">
                {[
                  { label:"Epieos", url:`https://epieos.com/?q=${encodeURIComponent(query)}&t=email` },
                  { label:"Holehe Check", url:`https://github.com/megadose/holehe` },
                  { label:"Google Search", url:`https://www.google.com/search?q=%22${encodeURIComponent(query)}%22` },
                  { label:"Pastebin Search", url:`https://psbdmp.ws/api/v3/search/${encodeURIComponent(query)}` },
                  { label:"Hunter.io", url:`https://hunter.io/email-verifier/${encodeURIComponent(query)}` },
                  { label:"EmailRep.io", url:`https://emailrep.io/${encodeURIComponent(query)}` },
                ].map(({ label, url }) => (
                  <a key={label} href={url} target="_blank" rel="noreferrer"
                    className="flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-blue-50 transition-colors group text-xs"
                    style={{ border:"1px solid var(--border)" }}>
                    <span style={{ color:"var(--text-primary)" }}>{label}</span>
                    <ExternalLink size={9} className="text-slate-400 group-hover:text-blue-500"/>
                  </a>
                ))}
              </div>
            </div>

            <p className="text-xs text-center" style={{ color:"var(--text-muted)" }}>
              Scanned {new Date(result.scannedAt).toLocaleTimeString()} · Public APIs only · No private data
            </p>
          </div>
        )}

        {/* Empty state */}
        {!result && !loading && !error && (
          <div className="rounded-xl p-5 text-center" style={{ border:"1px dashed var(--border)" }}>
            <Mail size={20} className="mx-auto mb-2 text-slate-300"/>
            <p className="text-xs" style={{ color:"var(--text-muted)" }}>
              Enter an email address to look up the associated Google account, breach exposure, and service registrations.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Vehicle RC / DL Verification Page ──

const RC_REGEX = /^[A-Z]{2}[\s-]?\d{1,2}[\s-]?[A-Z]{1,3}[\s-]?\d{1,4}$/i;
const DL_REGEX = /^[A-Z]{2}\d{2}[\s-]?\d{4,14}$/i;

// ── Crypto Wallet & Transaction OSINT ────────────────────────────────────────

// Token manager — fetches from /api/bitquery-token, caches in memory 24 h
const _bqTokenCache = { token: null, expiry: 0 };

async function fetchBitQueryToken(force = false) {
  const now = Date.now();
  if (!force && _bqTokenCache.token && now < _bqTokenCache.expiry - 120_000) {
    return _bqTokenCache.token;
  }
  const res = await fetch("/api/bitquery-token", {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({ force }),
  });
  if (!res.ok) {
    const j = await res.json().catch(() => ({}));
    throw new Error(j.error || `Token fetch failed (${res.status})`);
  }
  const data = await res.json();
  _bqTokenCache.token  = data.access_token;
  _bqTokenCache.expiry = now + (data.expires_in ?? 86400) * 1000;
  return _bqTokenCache.token;
}

const CHAIN_OPTIONS = [
  { id: "ETH", label: "Ethereum", color: "#627eea", symbol: "ETH" },
  { id: "BTC", label: "Bitcoin",  color: "#f7931a", symbol: "BTC" },
  { id: "TRX", label: "Tron",     color: "#e84142", symbol: "TRX" },
  { id: "SOL", label: "Solana",   color: "#9945ff", symbol: "SOL" },
];

const EXPLORER_URLS = {
  ETH: { tx: h => `https://etherscan.io/tx/${h}`,             addr: a => `https://etherscan.io/address/${a}` },
  BTC: { tx: h => `https://blockstream.info/tx/${h}`,         addr: a => `https://blockstream.info/address/${a}` },
  TRX: { tx: h => `https://tronscan.org/#/transaction/${h}`,  addr: a => `https://tronscan.org/#/address/${a}` },
  SOL: { tx: h => `https://solscan.io/tx/${h}`,               addr: a => `https://solscan.io/account/${a}` },
};

function shortAddr(addr, n = 8) {
  if (!addr || addr === "—") return addr;
  if (addr.length <= n * 2) return addr;
  return addr.slice(0, n) + "…" + addr.slice(-6);
}

// ── SVG Icon library ──────────────────────────────────────────────────────────
const Icons = {
  Chain: ({ color = "currentColor", size = 16 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
    </svg>
  ),
  Search: ({ color = "currentColor", size = 16 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
    </svg>
  ),
  Wallet: ({ color = "currentColor", size = 16 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 12V8H6a2 2 0 0 1-2-2c0-1.1.9-2 2-2h12v4"/>
      <path d="M4 6v12c0 1.1.9 2 2 2h14v-4"/>
      <path d="M18 12a2 2 0 0 0 0 4h4v-4z"/>
    </svg>
  ),
  Refresh: ({ color = "currentColor", size = 16 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/>
      <path d="M21 3v5h-5"/>
      <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/>
      <path d="M8 16H3v5"/>
    </svg>
  ),
  ArrowUp: ({ color = "currentColor", size = 12 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="m5 12 7-7 7 7"/><path d="M12 19V5"/>
    </svg>
  ),
  ArrowDown: ({ color = "currentColor", size = 12 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="m19 12-7 7-7-7"/><path d="M12 5v14"/>
    </svg>
  ),
  ArrowRight: ({ color = "currentColor", size = 20 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>
    </svg>
  ),
  ExternalLink: ({ color = "currentColor", size = 12 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
      <polyline points="15 3 21 3 21 9"/><line x1="10" x2="21" y1="14" y2="3"/>
    </svg>
  ),
  Copy: ({ color = "currentColor", size = 12 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect width="14" height="14" x="8" y="8" rx="2" ry="2"/>
      <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>
    </svg>
  ),
  Check: ({ color = "currentColor", size = 12 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12"/>
    </svg>
  ),
  AlertTriangle: ({ color = "currentColor", size = 14 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/>
      <path d="M12 9v4"/><path d="M12 17h.01"/>
    </svg>
  ),
  Info: ({ color = "currentColor", size = 14 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>
    </svg>
  ),
  Hash: ({ color = "currentColor", size = 14 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="4" x2="20" y1="9" y2="9"/><line x1="4" x2="20" y1="15" y2="15"/>
      <line x1="10" x2="8" y1="3" y2="21"/><line x1="16" x2="14" y1="3" y2="21"/>
    </svg>
  ),
  Clock: ({ color = "currentColor", size = 14 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
    </svg>
  ),
  Shield: ({ color = "currentColor", size = 18 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
    </svg>
  ),
  Network: ({ color = "currentColor", size = 18 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="16" y="16" width="6" height="6" rx="1"/>
      <rect x="2" y="16" width="6" height="6" rx="1"/>
      <rect x="9" y="2" width="6" height="6" rx="1"/>
      <path d="M5 16v-3a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v3"/>
      <path d="M12 12V8"/>
    </svg>
  ),
  Token: ({ color = "currentColor", size = 18 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/>
      <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/>
      <path d="M12 17h.01"/>
    </svg>
  ),
};

// ── Shared atoms ──────────────────────────────────────────────────────────────

function CryptoAddrLink({ addr, chain }) {
  if (!addr || addr === "—") return <span style={{ color: "var(--text-muted)" }}>—</span>;
  const url = EXPLORER_URLS[chain]?.addr(addr);
  return (
    <a href={url} target="_blank" rel="noopener noreferrer"
       style={{ color: "#3b82f6", fontFamily: "monospace", fontSize: 11, wordBreak: "break-all", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 3 }}
       title={addr}>
      {shortAddr(addr)}
      <Icons.ExternalLink color="#3b82f6" size={10} />
    </a>
  );
}

function TxHashLink({ hash, chain }) {
  if (!hash || hash === "—") return <span style={{ color: "var(--text-muted)" }}>—</span>;
  const url = EXPLORER_URLS[chain]?.tx(hash);
  return (
    <a href={url} target="_blank" rel="noopener noreferrer"
       style={{ color: "#3b82f6", fontFamily: "monospace", fontSize: 11, wordBreak: "break-all", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 3 }}
       title={hash}>
      {shortAddr(hash, 12)}
      <Icons.ExternalLink color="#3b82f6" size={10} />
    </a>
  );
}

function CopyBtn({ text }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(text).catch(() => {}); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
      title="Copy to clipboard"
      style={{ display: "inline-flex", alignItems: "center", gap: 3, padding: "2px 7px", borderRadius: 4,
        border: `1px solid ${copied ? "#86efac" : "var(--border)"}`,
        background: copied ? "#f0fdf4" : "var(--bg-input)",
        color: copied ? "#16a34a" : "var(--text-muted)",
        cursor: "pointer", fontSize: 10, fontWeight: 600, transition: "all 0.15s" }}>
      {copied ? <Icons.Check color="#16a34a" size={11} /> : <Icons.Copy color="currentColor" size={11} />}
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

function TokenChip({ symbol, color }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "2px 8px", borderRadius: 999,
      fontSize: 11, fontWeight: 700, background: color + "18", color, border: `1px solid ${color}44` }}>
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: color, flexShrink: 0 }} />
      {symbol}
    </span>
  );
}

function DirectionBadge({ direction }) {
  const isIn = direction === "in";
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "3px 8px", borderRadius: 999,
      fontSize: 10, fontWeight: 700,
      background: isIn ? "#f0fdf4" : "#fef2f2",
      color:      isIn ? "#16a34a" : "#dc2626",
      border: `1px solid ${isIn ? "#bbf7d0" : "#fecaca"}` }}>
      {isIn ? <Icons.ArrowDown color="#16a34a" size={10} /> : <Icons.ArrowUp color="#dc2626" size={10} />}
      {isIn ? "IN" : "OUT"}
    </span>
  );
}

function CryptoStatusBadge({ status }) {
  const color = status === "Success" || status === "Confirmed" ? "#16a34a"
              : status === "Failed"  ? "#dc2626" : "#64748b";
  const bg    = status === "Success" || status === "Confirmed" ? "#f0fdf4"
              : status === "Failed"  ? "#fef2f2" : "#f8fafc";
  const border= status === "Success" || status === "Confirmed" ? "#bbf7d0"
              : status === "Failed"  ? "#fecaca" : "#e2e8f0";
  return (
    <span style={{ fontSize: 11, padding: "3px 10px", borderRadius: 999, fontWeight: 700, color, background: bg, border: `1px solid ${border}` }}>
      {status === "Success" || status === "Confirmed" ? "✓ " : ""}{status || "Unknown"}
    </span>
  );
}

// BitQuery token expiry progress bar
function TokenStatus({ expiry }) {
  const [, forceRender] = useState(0);
  useEffect(() => {
    const id = setInterval(() => forceRender(n => n + 1), 30_000);
    return () => clearInterval(id);
  }, []);
  if (!expiry || expiry <= 0) return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "5px 10px", borderRadius: 6,
      background: "var(--bg-input)", border: "1px solid var(--border)", fontSize: 11, color: "var(--text-muted)" }}>
      <Icons.Clock color="currentColor" size={12} />
      No token cached
    </div>
  );
  const secsLeft  = Math.max(0, Math.round((expiry - Date.now()) / 1000));
  const hoursLeft = (secsLeft / 3600).toFixed(1);
  const pct       = Math.min(100, Math.max(0, (secsLeft / 86400) * 100));
  const color     = pct > 50 ? "#16a34a" : pct > 20 ? "#d97706" : "#dc2626";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 10px", borderRadius: 6,
      background: "var(--bg-input)", border: "1px solid var(--border)", fontSize: 11 }}>
      <Icons.Clock color={color} size={12} />
      <div style={{ width: 52, height: 3, borderRadius: 999, background: "var(--border)", overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${pct}%`, background: color, borderRadius: 999, transition: "width 0.3s" }} />
      </div>
      <span style={{ color, fontWeight: 700 }}>{hoursLeft}h</span>
      <span style={{ color: "var(--text-muted)" }}>token</span>
    </div>
  );
}

// Info card for the empty state
function InfoCard({ icon, title, desc }) {
  return (
    <div style={{ padding: "14px 16px", borderRadius: 10, background: "var(--bg-input)", border: "1px solid var(--border)" }}>
      <div style={{ marginBottom: 8, color: "var(--text-sec)" }}>{icon}</div>
      <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-primary)", marginBottom: 4 }}>{title}</div>
      <div style={{ fontSize: 11, color: "var(--text-sec)", lineHeight: 1.6 }}>{desc}</div>
    </div>
  );
}

// Metadata field grid cell
function MetaCell({ label, value, copy = false, mono = false }) {
  return (
    <div style={{ padding: "10px 12px", borderRadius: 8, background: "var(--bg-input)", border: "1px solid var(--border)" }}>
      <div style={{ fontSize: 9, color: "var(--text-muted)", fontWeight: 700, textTransform: "uppercase",
        letterSpacing: "0.08em", marginBottom: 5 }}>{label}</div>
      <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
        <span style={{ fontSize: 12, color: "var(--text-primary)", fontFamily: mono ? "monospace" : "inherit",
          wordBreak: "break-all", lineHeight: 1.4 }}>
          {value || "—"}
        </span>
        {copy && value && value !== "—" && <CopyBtn text={String(value)} />}
      </div>
    </div>
  );
}

// Section header inside result cards
function SectionLabel({ children, count }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
      <span style={{ fontSize: 10, fontWeight: 800, color: "var(--text-sec)", textTransform: "uppercase",
        letterSpacing: "0.1em" }}>{children}</span>
      {count != null && (
        <span style={{ fontSize: 10, padding: "1px 7px", borderRadius: 999, background: "var(--border)",
          color: "var(--text-muted)", fontWeight: 700 }}>{count}</span>
      )}
    </div>
  );
}

// ── Main page component ───────────────────────────────────────────────────────

function CryptoWalletPage() {
  const [mode, setMode]         = useState("tx");       // "tx" | "wallet"
  const [chain, setChain]       = useState("ETH");
  const [inputVal, setInputVal] = useState("");
  const [loading, setLoading]   = useState(false);
  const [result, setResult]     = useState(null);
  const [error, setError]       = useState("");
  const [tokenStatus, setTokenStatus] = useState({ expiry: _bqTokenCache.expiry || 0 });
  const [tokenLoading, setTokenLoading] = useState(false);

  const chainMeta = CHAIN_OPTIONS.find(c => c.id === chain) ?? CHAIN_OPTIONS[0];

  const refreshToken = async () => {
    setTokenLoading(true);
    setError("");
    try {
      await fetchBitQueryToken(true);
      setTokenStatus({ expiry: _bqTokenCache.expiry });
    } catch (e) {
      setError("Token refresh failed: " + e.message);
    } finally {
      setTokenLoading(false);
    }
  };

  const search = async () => {
    const val = inputVal.trim();
    if (!val) { setError("Enter a transaction hash or wallet address."); return; }
    setLoading(true);
    setError("");
    setResult(null);

    try {
      await fetchBitQueryToken(false);
      setTokenStatus({ expiry: _bqTokenCache.expiry });

      const endpoint = mode === "tx" ? "/api/bitquery-tx" : "/api/bitquery-wallet";
      const body     = mode === "tx"
        ? { txHash: val, chain }
        : { address: val, chain };

      const res  = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body:   JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `API error ${res.status}`);
      setResult({ ...data, _mode: mode });
    } catch (e) {
      setError(e.message || "Search failed.");
    } finally {
      setLoading(false);
    }
  };

  const handleKey = e => { if (e.key === "Enter") search(); };

  const placeholders = {
    tx:     chain === "SOL"
      ? "Paste Solana transaction signature…"
      : `Paste ${chain} transaction hash (0x…)`,
    wallet: `Paste ${chain} wallet address…`,
  };

  // card style shared
  const card = {
    background: "var(--bg-card)",
    borderRadius: 12,
    border: "1px solid var(--border)",
    overflow: "hidden",
  };

  const cardHeader = {
    padding: "12px 16px",
    borderBottom: "1px solid var(--border)",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: 8,
    background: "var(--bg-input)",
  };

  return (
    <div className="page-pad space-y-5">

      {/* ── Page Header ── */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: chainMeta.color + "18",
            border: `1px solid ${chainMeta.color}33`, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Icons.Chain color={chainMeta.color} size={18} />
          </div>
          <div>
            <h2 style={{ fontSize: 17, fontWeight: 800, color: "var(--text-primary)", margin: 0, letterSpacing: "-0.01em" }}>
              Crypto Wallet &amp; Transaction OSINT
            </h2>
            <p style={{ fontSize: 11, color: "var(--text-muted)", margin: "2px 0 0", letterSpacing: "0.02em" }}>
              Powered by BitQuery V2 · ETH · BTC · TRX · SOL
            </p>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <TokenStatus expiry={tokenStatus.expiry} />
          <button
            onClick={refreshToken}
            disabled={tokenLoading}
            style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 8,
              border: "1px solid var(--border)", background: "var(--bg-card)", color: "var(--text-sec)",
              fontSize: 11, fontWeight: 700, cursor: tokenLoading ? "not-allowed" : "pointer",
              opacity: tokenLoading ? 0.6 : 1, transition: "all 0.15s" }}>
            <Icons.Refresh color="currentColor" size={12} style={{ animation: tokenLoading ? "spin 0.8s linear infinite" : "none" }} />
            {tokenLoading ? "Refreshing…" : "Refresh Token"}
          </button>
        </div>
      </div>

      {/* ── Query Panel ── */}
      <div style={{ ...card, overflow: "visible" }}>
        <div style={{ padding: 16 }}>

          {/* Mode tabs */}
          <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
            {[
              { id: "tx",     label: "Transaction Lookup", Icon: Icons.Search },
              { id: "wallet", label: "Wallet Address Scan", Icon: Icons.Wallet },
            ].map(({ id, label, Icon }) => (
              <button key={id}
                onClick={() => { setMode(id); setResult(null); setError(""); }}
                style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 14px",
                  borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: "pointer", transition: "all 0.15s",
                  background: mode === id ? chainMeta.color : "var(--bg-input)",
                  color:      mode === id ? "#fff"          : "var(--text-sec)",
                  border:     mode === id ? `1.5px solid ${chainMeta.color}` : "1.5px solid var(--border)" }}>
                <Icon color="currentColor" size={13} />
                {label}
              </button>
            ))}
          </div>

          {/* Chain pills */}
          <div style={{ display: "flex", gap: 6, marginBottom: 14, flexWrap: "wrap" }}>
            {CHAIN_OPTIONS.map(c => (
              <button key={c.id}
                onClick={() => { setChain(c.id); setResult(null); setError(""); }}
                style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "5px 14px",
                  borderRadius: 999, fontSize: 11, fontWeight: 800, cursor: "pointer", transition: "all 0.15s",
                  background: chain === c.id ? c.color + "18" : "var(--bg-input)",
                  color:      chain === c.id ? c.color        : "var(--text-sec)",
                  border:     chain === c.id ? `2px solid ${c.color}` : "2px solid transparent" }}>
                <span style={{ width: 7, height: 7, borderRadius: "50%", background: c.color, flexShrink: 0 }} />
                {c.label}
              </button>
            ))}
          </div>

          {/* Search input */}
          <div style={{ display: "flex", gap: 8 }}>
            <div style={{ flex: 1, position: "relative" }}>
              <div style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}>
                <Icons.Hash color="var(--text-muted)" size={14} />
              </div>
              <input
                value={inputVal}
                onChange={e => setInputVal(e.target.value)}
                onKeyDown={handleKey}
                placeholder={placeholders[mode]}
                style={{ width: "100%", padding: "10px 14px 10px 34px", borderRadius: 8,
                  border: "1.5px solid var(--border)", background: "var(--bg-input)",
                  color: "var(--text-primary)", fontSize: 13, fontFamily: "monospace", outline: "none",
                  boxSizing: "border-box", transition: "border-color 0.15s" }}
              />
            </div>
            <button
              onClick={search}
              disabled={loading}
              style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "10px 22px",
                borderRadius: 8, background: chainMeta.color, color: "#fff", fontSize: 13,
                fontWeight: 800, border: "none", cursor: loading ? "not-allowed" : "pointer",
                opacity: loading ? 0.7 : 1, minWidth: 110, transition: "opacity 0.15s" }}>
              <Icons.Search color="#fff" size={14} />
              {loading ? "Searching…" : "Search"}
            </button>
          </div>

          {/* Error */}
          {error && (
            <div style={{ marginTop: 10, padding: "9px 12px", borderRadius: 8,
              background: "#fef2f2", border: "1px solid #fecaca", color: "#b91c1c",
              fontSize: 12, display: "flex", alignItems: "flex-start", gap: 7 }}>
              <Icons.AlertTriangle color="#b91c1c" size={14} style={{ flexShrink: 0, marginTop: 1 }} />
              {error}
            </div>
          )}
        </div>
      </div>

      {/* ── Loading spinner ── */}
      {loading && (
        <div style={{ ...card, padding: 32, textAlign: "center" }}>
          <div style={{ display: "inline-flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
            <div style={{ width: 34, height: 34, borderRadius: "50%",
              border: `3px solid ${chainMeta.color}33`,
              borderTopColor: chainMeta.color,
              animation: "spin 0.8s linear infinite" }} />
            <span style={{ color: "var(--text-sec)", fontSize: 13, fontWeight: 600 }}>
              Querying BitQuery for {chain} {mode === "tx" ? "transaction" : "wallet"}…
            </span>
          </div>
        </div>
      )}

      {/* ── Transaction Result ── */}
      {result && result._mode === "tx" && (
        <div style={card}>
          {/* Card header */}
          <div style={cardHeader}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 28, height: 28, borderRadius: 8, background: chainMeta.color + "18",
                display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Icons.Hash color={chainMeta.color} size={13} />
              </div>
              <span style={{ fontWeight: 800, fontSize: 13, color: "var(--text-primary)" }}>Transaction Details</span>
              <TokenChip symbol={chain} color={chainMeta.color} />
              <CryptoStatusBadge status={result.status} />
            </div>
            <a href={result.explorerUrl} target="_blank" rel="noopener noreferrer"
               style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11,
                 color: "#3b82f6", textDecoration: "none", fontWeight: 700 }}>
              View on Explorer <Icons.ExternalLink color="#3b82f6" size={11} />
            </a>
          </div>

          <div style={{ padding: 16 }}>

            {/* Sender → Receiver flow */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 44px 1fr", alignItems: "center",
              gap: 8, marginBottom: 16, padding: "14px 16px", borderRadius: 10,
              background: chainMeta.color + "08", border: `1px solid ${chainMeta.color}22` }}>
              <div>
                <div style={{ fontSize: 9, fontWeight: 800, color: "#dc2626", textTransform: "uppercase",
                  letterSpacing: "0.1em", marginBottom: 6, display: "flex", alignItems: "center", gap: 4 }}>
                  <Icons.ArrowUp color="#dc2626" size={10} /> Sender
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 5, flexWrap: "wrap" }}>
                  <CryptoAddrLink addr={result.sender} chain={chain} />
                  {result.sender && result.sender !== "—" && <CopyBtn text={result.sender} />}
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
                <div style={{ width: 36, height: 36, borderRadius: "50%",
                  background: chainMeta.color + "18", border: `1.5px solid ${chainMeta.color}44`,
                  display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Icons.ArrowRight color={chainMeta.color} size={16} />
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 9, fontWeight: 800, color: "#16a34a", textTransform: "uppercase",
                  letterSpacing: "0.1em", marginBottom: 6, display: "flex", alignItems: "center",
                  justifyContent: "flex-end", gap: 4 }}>
                  <Icons.ArrowDown color="#16a34a" size={10} /> Receiver
                </div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 5, flexWrap: "wrap" }}>
                  {result.receiver && result.receiver !== "—" && <CopyBtn text={result.receiver} />}
                  <CryptoAddrLink addr={result.receiver} chain={chain} />
                </div>
              </div>
            </div>

            {/* Native value pill */}
            <div style={{ marginBottom: 16, padding: "10px 14px", borderRadius: 8,
              background: "var(--bg-input)", border: "1px solid var(--border)",
              display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: "var(--text-muted)",
                textTransform: "uppercase", letterSpacing: "0.08em" }}>Value</span>
              <span style={{ fontSize: 17, fontWeight: 800, color: "var(--text-primary)",
                fontFamily: "monospace" }}>{result.nativeValue || "—"}</span>
            </div>

            {/* Metadata grid */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 8, marginBottom: 16 }}>
              <MetaCell label="Transaction Hash" value={result.hash}      copy mono />
              <MetaCell label="Block"            value={String(result.block || "—")} />
              <MetaCell label="Timestamp"        value={result.timestamp ? new Date(result.timestamp).toLocaleString() : "—"} />
              <MetaCell label="Tx Type"          value={String(result.txType ?? "—")} />
              <MetaCell label="Nonce"            value={String(result.nonce ?? "—")} />
              <MetaCell label="Fee"              value={result.fee || "—"} />
              <MetaCell label="Gas Limit"        value={String(result.gas || "—")} />
              <MetaCell label="Gas Price"        value={result.gasPrice || "—"} />
            </div>

            {/* Token transfers */}
            {(result.transfers?.length ?? 0) > 0 && (
              <div>
                <SectionLabel count={result.transfers.length}>Token Transfers</SectionLabel>
                <div style={{ overflowX: "auto", borderRadius: 8, border: "1px solid var(--border)" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
                    <thead>
                      <tr style={{ background: "var(--bg-input)" }}>
                        {["From", "To", "Amount", "Token", "Contract"].map(h => (
                          <th key={h} style={{ padding: "8px 10px", textAlign: "left", fontWeight: 800,
                            color: "var(--text-sec)", borderBottom: "1px solid var(--border)",
                            whiteSpace: "nowrap", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.06em" }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {result.transfers.map((tf, i) => (
                        <tr key={i} style={{ borderBottom: "1px solid var(--border-inner)" }}>
                          <td style={{ padding: "7px 10px" }}><CryptoAddrLink addr={tf.sender}   chain={chain} /></td>
                          <td style={{ padding: "7px 10px" }}><CryptoAddrLink addr={tf.receiver} chain={chain} /></td>
                          <td style={{ padding: "7px 10px", fontFamily: "monospace", fontWeight: 700, color: "var(--text-primary)" }}>
                            {Number(tf.amount ?? 0).toLocaleString(undefined, { maximumFractionDigits: 8 })}
                          </td>
                          <td style={{ padding: "7px 10px" }}>
                            <TokenChip symbol={tf.symbol || "—"} color={chainMeta.color} />
                            {tf.tokenName && <span style={{ marginLeft: 5, color: "var(--text-muted)", fontSize: 10 }}>{tf.tokenName}</span>}
                          </td>
                          <td style={{ padding: "7px 10px" }}>
                            {tf.contract
                              ? <CryptoAddrLink addr={tf.contract} chain={chain} />
                              : <span style={{ color: "var(--text-muted)", fontStyle: "italic", fontSize: 10 }}>Native</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Wallet Result ── */}
      {result && result._mode === "wallet" && (
        <div style={card}>
          {/* Card header */}
          <div style={cardHeader}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 28, height: 28, borderRadius: 8, background: chainMeta.color + "18",
                display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Icons.Wallet color={chainMeta.color} size={14} />
              </div>
              <span style={{ fontWeight: 800, fontSize: 13, color: "var(--text-primary)" }}>Wallet Intelligence</span>
              <TokenChip symbol={chain} color={chainMeta.color} />
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 10, color: "var(--text-muted)", fontFamily: "monospace",
                background: "var(--bg-input)", padding: "3px 8px", borderRadius: 6, border: "1px solid var(--border)" }}>
                {result.caseId}
              </span>
              <a href={EXPLORER_URLS[chain]?.addr(result.address)} target="_blank" rel="noopener noreferrer"
                 style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11,
                   color: "#3b82f6", textDecoration: "none", fontWeight: 700 }}>
                Explorer <Icons.ExternalLink color="#3b82f6" size={11} />
              </a>
            </div>
          </div>

          <div style={{ padding: 16 }}>

            {/* Address + balance hero */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 10, marginBottom: 16, alignItems: "stretch" }}>
              <div style={{ padding: "12px 14px", borderRadius: 8, background: "var(--bg-input)", border: "1px solid var(--border)" }}>
                <div style={{ fontSize: 9, fontWeight: 800, color: "var(--text-muted)", textTransform: "uppercase",
                  letterSpacing: "0.1em", marginBottom: 6 }}>Wallet Address</div>
                <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 12, fontFamily: "monospace", color: "var(--text-primary)", wordBreak: "break-all" }}>
                    {result.address}
                  </span>
                  <CopyBtn text={result.address} />
                </div>
              </div>
              <div style={{ padding: "12px 22px", borderRadius: 8, background: chainMeta.color + "12",
                border: `1px solid ${chainMeta.color}30`, textAlign: "center", display: "flex",
                flexDirection: "column", justifyContent: "center" }}>
                <div style={{ fontSize: 9, fontWeight: 800, color: chainMeta.color, textTransform: "uppercase",
                  letterSpacing: "0.1em", marginBottom: 5 }}>Balance</div>
                <div style={{ fontSize: 19, fontWeight: 900, color: chainMeta.color, fontFamily: "monospace",
                  letterSpacing: "-0.02em" }}>
                  {result.balance}
                </div>
              </div>
            </div>

            {/* Recent Transactions */}
            {(result.recentTxs?.length ?? 0) > 0 && (
              <div style={{ marginBottom: 16 }}>
                <SectionLabel count={result.recentTxs.length}>Recent Transactions</SectionLabel>
                <div style={{ overflowX: "auto", borderRadius: 8, border: "1px solid var(--border)" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
                    <thead>
                      <tr style={{ background: "var(--bg-input)" }}>
                        {["Dir", "Hash", "From", "To", "Value", "Time"].map(h => (
                          <th key={h} style={{ padding: "8px 10px", textAlign: "left", fontWeight: 800,
                            color: "var(--text-sec)", borderBottom: "1px solid var(--border)",
                            whiteSpace: "nowrap", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.06em" }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {result.recentTxs.map((tx, i) => (
                        <tr key={i} style={{ borderBottom: "1px solid var(--border-inner)" }}>
                          <td style={{ padding: "7px 10px" }}><DirectionBadge direction={tx.direction} /></td>
                          <td style={{ padding: "7px 10px" }}><TxHashLink hash={tx.hash} chain={chain} /></td>
                          <td style={{ padding: "7px 10px" }}><CryptoAddrLink addr={tx.from} chain={chain} /></td>
                          <td style={{ padding: "7px 10px" }}><CryptoAddrLink addr={tx.to}   chain={chain} /></td>
                          <td style={{ padding: "7px 10px", fontFamily: "monospace", fontWeight: 700, color: "var(--text-primary)", whiteSpace: "nowrap" }}>{tx.value}</td>
                          <td style={{ padding: "7px 10px", color: "var(--text-muted)", whiteSpace: "nowrap", fontSize: 10 }}>{tx.time}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Counterparty flow graph */}
            {(result.fundFlow?.nodes?.length ?? 0) > 1 && (
              <div>
                <SectionLabel count={result.fundFlow.nodes.length - 1}>Counterparty Network</SectionLabel>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {result.fundFlow.nodes.slice(1).map((node, i) => {
                    const edge     = result.fundFlow.edges[i];
                    const isHigh   = node.type === "high";
                    return (
                      <div key={node.id} style={{ padding: "9px 12px", borderRadius: 8,
                        background: "var(--bg-input)",
                        border: `1px solid ${isHigh ? "#f59e0b" : "var(--border)"}`,
                        minWidth: 190, position: "relative" }}>
                        {isHigh && (
                          <div style={{ position: "absolute", top: 8, right: 8 }}>
                            <Icons.AlertTriangle color="#f59e0b" size={11} />
                          </div>
                        )}
                        <div style={{ fontSize: 11, marginBottom: 5 }}>
                          {node.full
                            ? <CryptoAddrLink addr={node.full} chain={chain} />
                            : <span style={{ fontFamily: "monospace", fontSize: 11, color: "var(--text-primary)" }}>{node.label}</span>}
                        </div>
                        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                          {edge?.sent     > 0 && (
                            <span style={{ display: "inline-flex", alignItems: "center", gap: 3,
                              fontSize: 10, fontWeight: 700, color: "#dc2626" }}>
                              <Icons.ArrowUp color="#dc2626" size={10} /> {edge.sent}
                            </span>
                          )}
                          {edge?.received > 0 && (
                            <span style={{ display: "inline-flex", alignItems: "center", gap: 3,
                              fontSize: 10, fontWeight: 700, color: "#16a34a" }}>
                              <Icons.ArrowDown color="#16a34a" size={10} /> {edge.received}
                            </span>
                          )}
                          <span style={{ fontSize: 10, color: "var(--text-muted)" }}>{node.txCount} tx</span>
                          {isHigh && <span style={{ fontSize: 9, fontWeight: 800, color: "#f59e0b",
                            textTransform: "uppercase", letterSpacing: "0.05em" }}>High activity</span>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Empty state info cards ── */}
      {!result && !loading && (
        <div style={card}>
          <div style={{ padding: 20 }}>
            <div style={{ fontSize: 10, fontWeight: 800, color: "var(--text-sec)", textTransform: "uppercase",
              letterSpacing: "0.1em", marginBottom: 14 }}>How to use</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(210px, 1fr))", gap: 10 }}>
              <InfoCard
                icon={<Icons.Search color="var(--text-sec)" size={17} />}
                title="Transaction Lookup"
                desc="Paste any ETH / BTC / TRX / SOL tx hash to decode sender, receiver, value, gas, and block metadata." />
              <InfoCard
                icon={<Icons.Wallet color="var(--text-sec)" size={17} />}
                title="Wallet Scan"
                desc="Paste a wallet address to retrieve balance, recent transfers, and a counterparty network map." />
              <InfoCard
                icon={<Icons.Shield color="var(--text-sec)" size={17} />}
                title="Token Auto-refresh"
                desc="BitQuery OAuth tokens last 24 h. The status bar tracks remaining time. Force-refresh anytime." />
              <InfoCard
                icon={<Icons.Network color="var(--text-sec)" size={17} />}
                title="Explorer Links"
                desc="Every address and hash links to Etherscan, Blockstream, Tronscan, or Solscan for full detail." />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function parseRCFromText(text) {
  // Matches Indian number plates like MH12AB1234, KA-05-MK-7890, etc.
  const pattern = /\b([A-Z]{2}[\s-]?\d{1,2}[\s-]?[A-Z]{1,3}[\s-]?\d{1,4})\b/gi;
  const matches = [...text.matchAll(pattern)].map(m => m[1].replace(/[\s-]/g, "").toUpperCase());
  return [...new Set(matches)];
}

function VehicleRCPage() {
  const { t } = useLang();
  const [mode, setMode]           = useState("rc");       // "rc" | "dl"
  const [inputVal, setInputVal]   = useState("");
  const [apiKey, setApiKey]       = useState(() => localStorage.getItem("oxinap_rapidapi_key") || "");
  const [showKeyInput, setShowKeyInput] = useState(false);
  const [loading, setLoading]     = useState(false);
  const [result, setResult]       = useState(null);
  const [error, setError]         = useState("");
  const [history, setHistory]     = useState(() => {
    try { return JSON.parse(localStorage.getItem("oxinap_vehicle_history") || "[]"); } catch { return []; }
  });
  const [textExtract, setTextExtract] = useState("");
  const [extractedPlates, setExtractedPlates] = useState([]);

  const saveKey = (k) => {
    setApiKey(k);
    localStorage.setItem("oxinap_rapidapi_key", k);
    setShowKeyInput(false);
  };

  const saveHistory = (entry) => {
    const updated = [entry, ...history].slice(0, 20);
    setHistory(updated);
    localStorage.setItem("oxinap_vehicle_history", JSON.stringify(updated));
  };

  const verify = async (numOverride) => {
    const num = (numOverride || inputVal).trim().toUpperCase().replace(/[\s-]/g, "");
    if (!num) { setError("Please enter a vehicle number."); return; }
    if (!apiKey) { setError("Enter your RapidAPI key first (free tier available)."); setShowKeyInput(true); return; }

    setLoading(true);
    setError("");
    setResult(null);

    try {
      // Using RapidAPI's RTO Vehicle Information India (free: 50 req/day)
      // Endpoint: GET https://rto-vehicle-information-india.p.rapidapi.com/api/v1/rc/vehicleinfo
      const url = mode === "rc"
        ? `https://rto-vehicle-information-india.p.rapidapi.com/api/v1/rc/vehicleinfo/${encodeURIComponent(num)}`
        : `https://rto-vehicle-information-india.p.rapidapi.com/api/v1/dl/details/${encodeURIComponent(num)}`;

      const res = await fetch(url, {
        method: "GET",
        headers: {
          "x-rapidapi-host": "rto-vehicle-information-india.p.rapidapi.com",
          "x-rapidapi-key": apiKey,
        },
      });

      if (res.status === 429) throw new Error("Rate limit exceeded (50/day on free plan). Try again tomorrow or upgrade.");
      if (res.status === 401 || res.status === 403) throw new Error("Invalid API key. Check your RapidAPI key.");
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.message || body?.error || `API error ${res.status}`);
      }

      const data = await res.json();
      const entry = { num, mode, data, ts: Date.now() };
      setResult(entry);
      saveHistory(entry);
    } catch (e) {
      setError(e.message || "Verification failed.");
    } finally {
      setLoading(false);
    }
  };

  const extractPlates = () => {
    const plates = parseRCFromText(textExtract);
    setExtractedPlates(plates);
    if (!plates.length) setError("No vehicle numbers detected in the text.");
    else setError("");
  };

  const RCResultCard = ({ data }) => {
    // Normalise across different API response shapes
    const d = data?.result || data?.data || data?.response || data || {};
    const rows = [
      ["RC Number",         d.rc_number       || d.vehicleNumber    || d.registrationNumber || "—"],
      ["Owner",             d.owner_name       || d.ownerName        || d.owner             || "—"],
      ["Registration Date", d.registration_date|| d.regDate          || d.reg_date          || "—"],
      ["RC Expiry",         d.rc_expiry_date   || d.rcExpiryDate     || d.fitness_upto       || "—"],
      ["Vehicle Class",     d.vehicle_class    || d.vehicleClass     || d.class             || "—"],
      ["Fuel Type",         d.fuel_type        || d.fuelType         || d.fuel              || "—"],
      ["Maker / Model",     [d.maker_model || d.makerModel, d.model].filter(Boolean).join(" ") || "—"],
      ["Colour",            d.color            || d.colour           || d.vehicle_color      || "—"],
      ["Chassis No",        d.chassis_number   || d.chassisNumber    || d.chassis           || "—"],
      ["Engine No",         d.engine_number    || d.engineNumber     || d.engine            || "—"],
      ["Insurance Co",      d.insurance_company|| d.insuranceCompany || "—"],
      ["Insurance Upto",    d.insurance_upto   || d.insuranceUpto    || d.insurance_expiry  || "—"],
      ["Blacklist Status",  d.blacklist_status || d.blacklistStatus  || "—"],
      ["Financer",          d.financer_name    || d.financerName     || "—"],
      ["RTO",               d.state_cd         || d.rto_name         || d.rto               || "—"],
      ["Owner Address",     d.present_address  || d.address          || "—"],
    ].filter(([, v]) => v && v !== "—" && v !== "null" && v !== "undefined");

    const isBlacklisted = String(d.blacklist_status || "").toLowerCase().includes("yes");
    const insExpiry = d.insurance_upto || d.insuranceUpto || d.insurance_expiry || "";
    const insExpired = insExpiry && new Date(insExpiry) < new Date();

    return (
      <div style={{ marginTop:16 }}>
        {/* Status banner */}
        <div style={{
          display:"flex", gap:10, marginBottom:14, flexWrap:"wrap",
        }}>
          <span style={{ padding:"4px 12px", borderRadius:20, fontSize:12, fontWeight:600,
            background: isBlacklisted ? "rgba(239,68,68,0.12)" : "rgba(34,197,94,0.1)",
            border: `1px solid ${isBlacklisted ? "rgba(239,68,68,0.4)" : "rgba(34,197,94,0.3)"}`,
            color: isBlacklisted ? "#ef4444" : "#22c55e",
          }}>
            {isBlacklisted ? "🚫 BLACKLISTED" : "✅ ACTIVE"}
          </span>
          {insExpiry && (
            <span style={{ padding:"4px 12px", borderRadius:20, fontSize:12, fontWeight:600,
              background: insExpired ? "rgba(239,68,68,0.12)" : "rgba(34,197,94,0.1)",
              border: `1px solid ${insExpired ? "rgba(239,68,68,0.4)" : "rgba(34,197,94,0.3)"}`,
              color: insExpired ? "#ef4444" : "#22c55e",
            }}>
              {insExpired ? "❌ Insurance Expired" : "✅ Insurance Valid"}
            </span>
          )}
        </div>

        {/* Data grid */}
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
          {rows.map(([label, val]) => (
            <div key={label} style={{ padding:"10px 14px", borderRadius:8, background:"var(--bg-input)", border:"1px solid var(--border)" }}>
              <div style={{ fontSize:10, color:"var(--text-muted)", fontWeight:600, marginBottom:3, textTransform:"uppercase", letterSpacing:"0.06em" }}>{label}</div>
              <div style={{ fontSize:12, color:"var(--text-primary)", fontWeight:500, wordBreak:"break-word" }}>{String(val)}</div>
            </div>
          ))}
        </div>

        {/* Raw JSON toggle */}
        <details style={{ marginTop:12 }}>
          <summary style={{ fontSize:11, color:"var(--text-muted)", cursor:"pointer" }}>View raw API response</summary>
          <pre style={{ marginTop:8, padding:12, borderRadius:8, background:"var(--bg-input)", fontSize:10, color:"var(--text-sec)", overflow:"auto", maxHeight:200 }}>
            {JSON.stringify(data, null, 2)}
          </pre>
        </details>
      </div>
    );
  };

  return (
    <div className="p-6 space-y-5" style={{ maxWidth:900, margin:"0 auto" }}>
      {/* Header */}
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:10 }}>
        <div>
          <h2 style={{ margin:0, fontSize:16, fontWeight:700, color:"var(--text-primary)" }}>🚗 Vehicle RC / DL Verification</h2>
          <p style={{ margin:"4px 0 0", fontSize:12, color:"var(--text-muted)" }}>
            Cross-reference vehicle plates from suspect social media images · Powered by RTO / VAHAN database
          </p>
        </div>
        <button onClick={() => setShowKeyInput(s => !s)} style={{
          display:"flex", alignItems:"center", gap:6, padding:"6px 14px", borderRadius:8, fontSize:12,
          fontWeight:500, cursor:"pointer", border:"1px solid var(--border)", background:"var(--bg-input)",
          color: apiKey ? "#22c55e" : "#f97316",
        }}>
          <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/></svg>
          {apiKey ? "✓ API Key Set" : "Set RapidAPI Key"}
        </button>
      </div>

      {/* API Key input */}
      {showKeyInput && (
        <div style={{ padding:16, borderRadius:10, background:"var(--bg-input)", border:"1px solid var(--border)" }}>
          <div style={{ fontSize:12, fontWeight:600, color:"var(--text-primary)", marginBottom:8 }}>RapidAPI Key (free tier: 50 requests/day)</div>
          <div style={{ fontSize:11, color:"var(--text-muted)", marginBottom:10 }}>
            1. Sign up free at{" "}
            <a href="https://rapidapi.com/streamifyworld/api/rto-vehicle-information-india" target="_blank" rel="noopener noreferrer" style={{ color:"#3b82f6" }}>
              rapidapi.com → RTO Vehicle Information India
            </a><br/>
            2. Subscribe to the <strong>Free</strong> plan (50 calls/day, no credit card required)<br/>
            3. Copy your API key and paste below
          </div>
          <div style={{ display:"flex", gap:8 }}>
            <input
              type="password"
              placeholder="Paste your RapidAPI key here…"
              defaultValue={apiKey}
              id="vehicle-api-key-input"
              style={{ flex:1, padding:"8px 12px", borderRadius:8, fontSize:12,
                background:"var(--bg-card)", border:"1px solid var(--border)", color:"var(--text-primary)" }}
            />
            <button onClick={() => saveKey(document.getElementById("vehicle-api-key-input").value)} style={{
              padding:"8px 16px", borderRadius:8, background:"#2563eb", color:"#fff", fontSize:12,
              fontWeight:600, border:"none", cursor:"pointer",
            }}>Save</button>
          </div>
        </div>
      )}

      {/* Mode tabs */}
      <div style={{ display:"flex", gap:0, background:"var(--bg-input)", borderRadius:8, padding:4, width:"fit-content" }}>
        {[["rc","🚗  RC Verification"],["dl","🪪  DL Verification"],["extract","🔍  Extract from Text"]].map(([m, label]) => (
          <button key={m} onClick={() => { setMode(m); setResult(null); setError(""); }} style={{
            padding:"7px 18px", borderRadius:6, fontSize:12, fontWeight:500, border:"none", cursor:"pointer",
            background: mode === m ? "var(--bg-card)" : "transparent",
            color: mode === m ? "var(--text-primary)" : "var(--text-muted)",
            boxShadow: mode === m ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
            transition:"all 0.15s",
          }}>{label}</button>
        ))}
      </div>

      {/* RC / DL lookup */}
      {(mode === "rc" || mode === "dl") && (
        <div style={{ padding:20, borderRadius:12, ...V.card }}>
          <div style={{ fontSize:12, color:"var(--text-muted)", marginBottom:10 }}>
            {mode === "rc"
              ? "Enter vehicle registration number (e.g. MH12AB1234, KA-05-MK-7890)"
              : "Enter driving licence number (e.g. MH0120190012345)"}
          </div>
          <div style={{ display:"flex", gap:10 }}>
            <input
              value={inputVal}
              onChange={e => setInputVal(e.target.value.toUpperCase())}
              onKeyDown={e => e.key === "Enter" && verify()}
              placeholder={mode === "rc" ? "e.g. MH12AB1234" : "e.g. MH0120190012345"}
              style={{ flex:1, padding:"10px 14px", borderRadius:8, fontSize:13, fontWeight:500,
                letterSpacing:"0.08em", background:"var(--bg-input)", border:"1px solid var(--border)",
                color:"var(--text-primary)", fontFamily:"monospace" }}
            />
            <button disabled={loading} onClick={() => verify()} style={{
              padding:"10px 24px", borderRadius:8, background:"#2563eb", color:"#fff",
              fontSize:13, fontWeight:600, border:"none", cursor:"pointer",
              opacity: loading ? 0.7 : 1, display:"flex", alignItems:"center", gap:8,
            }}>
              {loading
                ? <><Loader2 size={14} className="animate-spin"/> Verifying…</>
                : <><Search size={14}/> Verify</>}
            </button>
          </div>

          {/* Quick format hints */}
          <div style={{ marginTop:10, display:"flex", gap:6, flexWrap:"wrap" }}>
            {(mode === "rc"
              ? ["KA05MK7890","MH12AB1234","DL3CAF0001","TN09BV5678"]
              : ["MH0120190012345","KA0320180056789","DL0420170098765"]
            ).map(ex => (
              <button key={ex} onClick={() => setInputVal(ex)} style={{
                padding:"2px 10px", borderRadius:12, fontSize:10, fontWeight:500,
                background:"rgba(37,99,235,0.08)", border:"1px solid rgba(37,99,235,0.2)",
                color:"#3b82f6", cursor:"pointer", fontFamily:"monospace",
              }}>{ex}</button>
            ))}
          </div>

          {error && (
            <div style={{ marginTop:12, padding:"10px 14px", borderRadius:8, background:"rgba(239,68,68,0.08)",
              border:"1px solid rgba(239,68,68,0.2)", fontSize:12, color:"#ef4444" }}>
              ⚠️ {error}
            </div>
          )}

          {result && <RCResultCard data={result.data} />}
        </div>
      )}

      {/* Extract from text / image OCR simulation */}
      {mode === "extract" && (
        <div style={{ padding:20, borderRadius:12, ...V.card }}>
          <div style={{ fontSize:12, color:"var(--text-muted)", marginBottom:10 }}>
            Paste text scraped from social media captions, comments, or OCR output — we'll auto-detect vehicle numbers
          </div>
          <textarea
            value={textExtract}
            onChange={e => setTextExtract(e.target.value)}
            placeholder={"Paste social media text here…\n\nExample: 'My new car KA05MK7890 is amazing! Just got it registered. MH12AB1234 was my old one.'"}
            rows={6}
            style={{ width:"100%", padding:"12px 14px", borderRadius:8, fontSize:12,
              background:"var(--bg-input)", border:"1px solid var(--border)", color:"var(--text-primary)",
              resize:"vertical", boxSizing:"border-box", fontFamily:"inherit" }}
          />
          <button onClick={extractPlates} style={{
            marginTop:10, padding:"8px 20px", borderRadius:8, background:"#4f46e5", color:"#fff",
            fontSize:12, fontWeight:600, border:"none", cursor:"pointer",
          }}>
            🔍 Extract Plates
          </button>

          {extractedPlates.length > 0 && (
            <div style={{ marginTop:14 }}>
              <div style={{ fontSize:12, fontWeight:600, color:"var(--text-primary)", marginBottom:8 }}>
                {extractedPlates.length} plate{extractedPlates.length > 1 ? "s" : ""} detected:
              </div>
              <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
                {extractedPlates.map(p => (
                  <button key={p} onClick={() => { setMode("rc"); setInputVal(p); setExtractedPlates([]); }} style={{
                    padding:"6px 16px", borderRadius:20, fontSize:12, fontWeight:700,
                    background:"rgba(37,99,235,0.1)", border:"1px solid rgba(37,99,235,0.3)",
                    color:"#3b82f6", cursor:"pointer", fontFamily:"monospace", letterSpacing:"0.06em",
                  }}>
                    {p} → Verify
                  </button>
                ))}
              </div>
            </div>
          )}

          {error && (
            <div style={{ marginTop:12, padding:"10px 14px", borderRadius:8, background:"rgba(239,68,68,0.08)",
              border:"1px solid rgba(239,68,68,0.2)", fontSize:12, color:"#ef4444" }}>
              ⚠️ {error}
            </div>
          )}
        </div>
      )}

      {/* History */}
      {history.length > 0 && (
        <div style={{ padding:20, borderRadius:12, ...V.card }}>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:12 }}>
            <div style={{ fontSize:13, fontWeight:600, color:"var(--text-primary)" }}>Recent Lookups</div>
            <button onClick={() => { setHistory([]); localStorage.removeItem("oxinap_vehicle_history"); }}
              style={{ fontSize:11, color:"var(--text-muted)", background:"none", border:"none", cursor:"pointer" }}>
              Clear
            </button>
          </div>
          <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
            {history.slice(0,8).map((h, i) => {
              const d = h.data?.result || h.data?.data || h.data || {};
              const owner = d.owner_name || d.ownerName || d.owner || "—";
              const model = d.maker_model || d.makerModel || d.model || "—";
              const isBlack = String(d.blacklist_status || "").toLowerCase().includes("yes");
              return (
                <div key={i} onClick={() => { setMode(h.mode); setInputVal(h.num); setResult(h); setError(""); }}
                  style={{ display:"flex", alignItems:"center", gap:12, padding:"10px 14px", borderRadius:8,
                    background:"var(--bg-input)", border:"1px solid var(--border)", cursor:"pointer" }}>
                  <span style={{ fontFamily:"monospace", fontWeight:700, fontSize:12, color:"#3b82f6", minWidth:100 }}>{h.num}</span>
                  <span style={{ fontSize:10, color:"var(--text-muted)", textTransform:"uppercase",
                    padding:"2px 8px", borderRadius:10, background:"rgba(99,102,241,0.1)", border:"1px solid rgba(99,102,241,0.2)" }}>
                    {h.mode === "rc" ? "RC" : "DL"}
                  </span>
                  <span style={{ flex:1, fontSize:12, color:"var(--text-sec)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                    {owner !== "—" ? owner : model !== "—" ? model : "Lookup result"}
                  </span>
                  {isBlack && <span style={{ fontSize:10, color:"#ef4444", fontWeight:600 }}>🚫 BLACKLISTED</span>}
                  <span style={{ fontSize:10, color:"var(--text-muted)" }}>
                    {new Date(h.ts).toLocaleTimeString([], { hour:"2-digit", minute:"2-digit" })}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Info note */}
      <div style={{ padding:"12px 16px", borderRadius:10, background:"rgba(37,99,235,0.06)",
        border:"1px solid rgba(37,99,235,0.2)", fontSize:11, color:"var(--text-muted)", lineHeight:1.6 }}>
        <strong style={{ color:"var(--text-sec)" }}>Data source:</strong> RTO Vehicle Information India API via RapidAPI
        (pulls from VAHAN national database). Free plan: 50 requests/day.{" "}
        <a href="https://rapidapi.com/streamifyworld/api/rto-vehicle-information-india" target="_blank"
          rel="noopener noreferrer" style={{ color:"#3b82f6" }}>Get your free API key →</a>
      </div>
    </div>
  );
}

// ── AI Analysis Page ──


function AIAnalysisPage({ setActivePage, investigation }) {
  const [activeCategory, setActiveCategory] = useState("platforms");
  const iconMap = { Hash, FileText, Activity, Database, Scan, Network, Globe };
  const riskColor = { critical:"#ef4444", high:"#f97316", medium:"#eab308", low:"#22c55e" };

  if (!investigation) {
    return <div className="p-6">
      <div className="rounded-xl p-10 shadow-sm flex flex-col items-center text-center" style={V.card}>
        <Brain size={28} className="text-slate-300 mb-3"/>
        <h3 className="font-semibold text-sm mb-1" style={{ color:"var(--text-primary)" }}>No investigation loaded</h3>
        <p className="text-slate-400 text-xs max-w-sm">Run a public OSINT search first — the AI analysis here is generated from that case's real findings and Gemini grounded search, not sample data.</p>
        <button onClick={()=>setActivePage("osint")} className="mt-4 flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium transition-colors"><Search size={13}/>Go to OSINT Search</button>
      </div>
    </div>;
  }

  const circumference = 2*Math.PI*40;
  const stats = investigation.stats || {};
  const confidenceScore = stats.confidence ?? 0;
  const fingerScore = confidenceScore;
  const riskNumeric = { critical:92, high:70, medium:48, low:20 }[investigation.risk] ?? confidenceScore;
  const overallRisk = riskNumeric;
  const scoreOffset = circumference - (fingerScore/100)*circumference;

  const findings = investigation.findings || [];
  const confirmed = findings.filter(f=>f.status==="found");
  const candidates = findings.filter(f=>f.status==="open_link");
  const geminiSources = investigation.gemini?.sources || [];
  const crawledPages = investigation.crawledPages || [];

  const toMatch = (label, score, risk) => ({ account: label, platform: "", score, risk });

  const analysisCategories = [
    {
      id: "platforms", title: "Confirmed Platform Matches", icon: "Hash",
      score: confirmed.length ? Math.min(95, 50 + confirmed.length*8) : 0,
      confidence: confirmed.length ? "High" : "No data",
      matches: confirmed.length ? confirmed.map(f=>({ account:f.title || f.platform, platform:f.platform, score:Math.min(95,70+ (f.platform?.length||0)%10), risk: confidenceScore>=80?"critical":confidenceScore>=60?"high":"medium" })) : [],
    },
    {
      id: "candidates", title: "Candidate / Open Links", icon: "Network",
      score: candidates.length ? Math.min(85, 30 + candidates.length*6) : 0,
      confidence: candidates.length ? "Unverified" : "No data",
      matches: candidates.length ? candidates.map(f=>({ account:f.title || f.platform, platform:f.platform, score:55, risk:"medium" })) : [],
    },
    {
      id: "gemini", title: "Gemini Grounded Sources", icon: "Activity",
      score: geminiSources.length ? Math.min(90, 40 + geminiSources.length*8) : 0,
      confidence: investigation.gemini?.enabled ? "AI grounded" : "Gemini not configured",
      matches: geminiSources.length ? geminiSources.map(s=>({ account:s.title || s.url, platform:"Gemini Search", score:65, risk:"medium" })) : [],
    },
    {
      id: "crawl", title: "Crawled Web Sources", icon: "Database",
      score: crawledPages.length ? Math.min(90, 40 + crawledPages.length*6) : 0,
      confidence: crawledPages.length ? "Page content fetched" : "No data",
      matches: crawledPages.length ? crawledPages.map(p=>({ account:p.title || p.url, platform:p.extractor || "Web", score:60, risk:"low" })) : [],
    },
  ];
  if (!analysisCategories.find(c=>c.id===activeCategory)) {/* noop, default stays */}

  const riskLabel = (investigation.risk || "low").toUpperCase();
  const riskBg = { critical:"bg-red-50 border-red-200 text-red-700", high:"bg-orange-50 border-orange-200 text-orange-700", medium:"bg-amber-50 border-amber-200 text-amber-700", low:"bg-green-50 border-green-200 text-green-700" }[investigation.risk] || "bg-slate-50 border-slate-200 text-slate-600";

  return <div className="p-6 space-y-5">
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
      <div className="lg:col-span-1 rounded-xl p-5 flex flex-col items-center" style={V.card}>
        <div className="text-slate-800 font-semibold text-sm mb-3 text-center">Digital Identity<br/>Fingerprint Score</div>
        <div className="relative mb-3" style={{ width:128, height:128 }}>
          <svg viewBox="0 0 100 100" width={128} height={128} style={{ transform:"rotate(-90deg)" }}>
            <circle cx={50} cy={50} r={40} fill="none" stroke="#f1f5f9" strokeWidth={8}/>
            <circle cx={50} cy={50} r={40} fill="none" stroke="url(#scoreGrad)" strokeWidth={8} strokeDasharray={circumference} strokeDashoffset={scoreOffset} strokeLinecap="round"/>
            <defs><linearGradient id="scoreGrad" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" stopColor="#2563eb"/><stop offset="100%" stopColor="#4f46e5"/></linearGradient></defs>
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center"><span className="text-3xl font-bold text-slate-800" style={{ fontFamily:"monospace" }}>{fingerScore}</span><span className="text-xs text-slate-400">/100</span></div>
        </div>
        <div className="w-full">
          <div className="flex justify-between mb-1" style={{ fontSize:11 }}><span className="text-slate-400">Confidence</span><span className="font-medium text-blue-600">{confidenceScore}%</span></div>
          <ScoreBar score={confidenceScore} color="#2563eb"/>
          <div className="flex justify-between mb-1 mt-2" style={{ fontSize:11 }}><span className="text-slate-400">Risk Level</span><span className="font-medium text-red-600">{overallRisk}%</span></div>
          <ScoreBar score={overallRisk} color="#ef4444"/>
        </div>
        <div className="mt-3 w-full"><div className={cn("rounded-lg px-3 py-2 text-center", riskBg)} style={{ border:"1px solid" }}><div className="text-xs font-semibold">{riskLabel} THREAT</div><div className="mt-0.5" style={{ fontSize:10 }}>{confirmed.length} confirmed · {candidates.length} candidate account(s)</div></div></div>
      </div>
      <div className="lg:col-span-3 grid grid-cols-2 sm:grid-cols-3 gap-4">{[
        { label:"Linked Accounts", value:String(confirmed.length), sub:`Across ${investigation.platforms?.length || 0} platforms`, icon:Users, color:"#2563eb" },
        { label:"Match Confidence", value:`${confidenceScore}%`, sub:"From real findings + sources", icon:Target, color:"#4f46e5" },
        { label:"Risk Score", value:`${overallRisk}/100`, sub:investigation.risk==="critical"||investigation.risk==="high" ? "Requires review" : "Low/medium concern", icon:AlertTriangle, color:"#ef4444" },
        { label:"Candidate Links", value:String(candidates.length), sub:"Unverified open links", icon:Activity, color:"#0891b2" },
        { label:"Sources Crawled", value:String(stats.sources || 0), sub:"Cross-source coverage", icon:Database, color:"#7c3aed" },
        { label:"Gemini Sources", value:String(geminiSources.length), sub:investigation.gemini?.enabled ? "Grounded search" : "Not configured", icon:Scan, color:"#0f766e" },
      ].map(({ label, value, sub, icon:Ic, color })=><div key={label} className="rounded-xl p-4 shadow-sm" style={V.card}>
        <div className="flex items-center gap-2 mb-2"><div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ backgroundColor:`${color}18` }}><Ic size={14} style={{ color }}/></div></div>
        <div className="text-xl font-bold text-slate-800 tabular-nums" style={{ fontFamily:"monospace" }}>{value}</div>
        <div className="text-slate-600 text-xs font-medium mt-0.5">{label}</div>
        <div className="text-slate-400 mt-0.5" style={{ fontSize:10 }}>{sub}</div>
      </div>)}</div>
    </div>

    {investigation.gemini?.summary && <div className="rounded-xl shadow-sm" style={V.card}>
      <div className="flex items-center justify-between px-5 py-4" style={V.inner}><h3 className="font-semibold text-sm" style={{ color:"var(--text-primary)" }}>Gemini AI Analysis Summary</h3><div className="flex items-center gap-2 text-xs text-slate-400"><Zap size={12} className="text-indigo-500"/><span>{investigation.gemini.enabled ? "Grounded search" : "Unavailable"}</span></div></div>
      <div className="p-5"><div className="rounded-xl p-4 text-sm leading-relaxed whitespace-pre-wrap" style={{ background:"var(--bg-input)", color:"var(--text-sec)", border:"1px solid var(--border)" }}>{investigation.gemini.summary}</div></div>
    </div>}

    <div className="rounded-xl shadow-sm" style={V.card}>
      <div className="flex items-center justify-between px-5 py-4" style={V.inner}><h3 className="font-semibold text-sm" style={{ color:"var(--text-primary)" }}>Correlation Analysis</h3><div className="flex items-center gap-2 text-xs text-slate-400"><Zap size={12} className="text-indigo-500"/><span>Derived from case {investigation.id}</span></div></div>
      <div className="flex">
        <div className="flex-shrink-0 p-2 space-y-0.5" style={{ width:208, borderRight:"1px solid #f1f5f9" }}>
          {analysisCategories.map(cat=>{
            const Ic = iconMap[cat.icon]||Hash;
            const isActive = activeCategory===cat.id;
            return <button key={cat.id} onClick={()=>setActiveCategory(cat.id)} className={cn("w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-left transition-all", isActive?"bg-blue-50":"hover:bg-slate-50")}>
              <Ic size={13} className={isActive?"text-blue-600":"text-slate-400"}/>
              <div className="flex-1 min-w-0"><div className={cn("text-xs font-medium truncate", isActive?"text-blue-700":"text-slate-600")}>{cat.title}</div><div className="text-slate-400 mt-0.5 tabular-nums" style={{ fontSize:10, fontFamily:"monospace" }}>{cat.score}%</div></div>
              <div className="w-1 h-8 rounded-full flex-shrink-0" style={{ backgroundColor:isActive?"#2563eb":"transparent" }}/>
            </button>;
          })}
        </div>
        {(()=>{
          const cat = analysisCategories.find(c=>c.id===activeCategory) || analysisCategories[0];
          const Ic = iconMap[cat.icon]||Hash;
          const scoreColor = cat.score>=90?"#ef4444":cat.score>=75?"#f97316":"#eab308";
          return <div className="flex-1 p-6">
            <div className="flex items-start justify-between mb-5">
              <div className="flex items-center gap-3"><div className="w-10 h-10 rounded-xl flex items-center justify-center bg-blue-50"><Ic size={18} className="text-blue-600"/></div><div><h4 className="font-semibold text-sm" style={{ color:"var(--text-primary)" }}>{cat.title}</h4><div className="text-slate-400 text-xs mt-0.5">Confidence: <span className="font-medium text-slate-600">{cat.confidence}</span></div></div></div>
              <div className="text-right"><div className="text-2xl font-bold tabular-nums" style={{ color:scoreColor, fontFamily:"monospace" }}>{cat.score}%</div><div className="text-slate-400" style={{ fontSize:11 }}>Match Score</div></div>
            </div>
            <div className="mb-5"><div className="flex justify-between text-xs mb-1.5"><span className="text-slate-500">Overall similarity score</span><span className="font-medium text-slate-700">{cat.score}%</span></div><div className="h-3 bg-slate-100 rounded-full overflow-hidden"><div className="h-full rounded-full" style={{ width:`${cat.score}%`, background:"linear-gradient(90deg,#2563eb,#4f46e5)" }}/></div></div>
            <div><h5 className="text-slate-600 text-xs font-semibold uppercase tracking-wide mb-3">Matched Items</h5>
              <div className="space-y-2">{cat.matches.length ? cat.matches.map((m,i)=><div key={i} className="flex items-center gap-3 p-3 rounded-xl transition-colors" style={{ border:"1px solid #f1f5f9" }}>
                <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor:riskColor[m.risk] }}/>
                <div className="flex-1 min-w-0"><div className="text-slate-700 text-xs font-medium truncate" style={{ fontFamily:"monospace" }}>{m.account}</div><div className="text-slate-400" style={{ fontSize:10 }}>{m.platform}</div></div>
                <div className="flex items-center gap-2"><ScoreBar score={m.score} color={riskColor[m.risk]}/><RiskBadge risk={m.risk}/></div>
              </div>) : <div className="rounded-xl p-6 text-center text-slate-400 text-sm" style={{ border:"1px dashed var(--border)" }}>No items in this category for this case.</div>}</div>
            </div>
          </div>;
        })()}
      </div>
    </div>
    {/* ── Instagram Posts Analysis ── */}
    {(()=>{
      const posts = investigation.instaPosts || [];
      if (!posts.length) return null;
      const totalLikes    = posts.reduce((s,p)=>s+(p.likesCount||p.likes||0),0);
      const totalComments = posts.reduce((s,p)=>s+(p.commentsCount||p.commentsNumber||p.commentCount||0),0);
      const avgLikes      = posts.length ? Math.round(totalLikes/posts.length) : 0;
      const avgComments   = posts.length ? Math.round(totalComments/posts.length) : 0;
      const allHashtags   = posts.flatMap(p=>p.hashtags||[]);
      const hashFreq      = allHashtags.reduce((m,h)=>{ m[h]=(m[h]||0)+1; return m; },{});
      const topHashtags   = Object.entries(hashFreq).sort((a,b)=>b[1]-a[1]).slice(0,10);
      const videoCount    = posts.filter(p=>p.isVideo||p.type==="Video").length;
      const withLocation  = posts.filter(p=>p.locationName).length;
      const engagementRate = posts.length && (investigation.findings||[]).find(f=>f.platform==="Instagram")
        ? null : null; // would need follower count
      return (
        <div className="rounded-xl shadow-sm" style={V.card}>
          <div className="flex items-center justify-between px-5 py-4" style={V.inner}>
            <div className="flex items-center gap-2">
              <span className="text-base">📸</span>
              <h3 className="font-semibold text-sm" style={{ color:"var(--text-primary)" }}>Instagram Posts Analysis</h3>
              <span className="text-xs px-2 py-0.5 rounded-full bg-pink-50 text-pink-600 font-medium">{posts.length} posts scraped</span>
            </div>
          </div>
          <div className="p-5 space-y-5">
            {/* Stats row */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label:"Total Posts",    value:posts.length,   color:"#e11d48", icon:"📸" },
                { label:"Avg Likes",      value:avgLikes.toLocaleString(), color:"#f97316", icon:"❤️" },
                { label:"Avg Comments",   value:avgComments.toLocaleString(), color:"#2563eb", icon:"💬" },
                { label:"Video Posts",    value:videoCount,     color:"#7c3aed", icon:"▶️" },
              ].map(({label,value,color,icon})=>(
                <div key={label} className="rounded-xl p-3 text-center" style={{ background:"var(--bg-input)", border:"1px solid var(--border)" }}>
                  <div style={{ fontSize:18 }}>{icon}</div>
                  <div className="text-lg font-bold mt-1" style={{ color, fontFamily:"monospace" }}>{value}</div>
                  <div className="text-xs mt-0.5" style={{ color:"var(--text-muted)" }}>{label}</div>
                </div>
              ))}
            </div>
            {/* Captions & content */}
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color:"var(--text-muted)" }}>Post Captions &amp; Content</h4>
              <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                {posts.filter(p=>p.caption).slice(0,10).map((p,i)=>(
                  <div key={i} className="rounded-lg p-3 text-xs" style={{ background:"var(--bg-input)", border:"1px solid var(--border)" }}>
                    <div className="flex items-start justify-between gap-2 mb-1.5">
                      <span className="font-medium" style={{ color:"var(--text-sec)", lineHeight:1.5 }}>{p.caption.slice(0,180)}{p.caption.length>180?"…":""}</span>
                      <div className="flex-shrink-0 text-right" style={{ color:"var(--text-muted)", fontSize:10 }}>
                        {p.likesCount!=null && <div>❤️ {Number(p.likesCount).toLocaleString()}</div>}
                        {p.commentsCount!=null && <div>💬 {Number(p.commentsCount).toLocaleString()}</div>}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {(p.hashtags||[]).slice(0,5).map(h=>(
                        <span key={h} className="text-pink-500 font-medium" style={{ fontSize:9 }}>#{h}</span>
                      ))}
                      {p.locationName && <span className="text-blue-500" style={{ fontSize:9 }}>📍 {p.locationName}</span>}
                      {p.timestamp && <span style={{ color:"var(--text-muted)", fontSize:9 }}>{new Date(p.timestamp).toLocaleDateString()}</span>}
                    </div>
                  </div>
                ))}
                {posts.filter(p=>p.caption).length===0 && (
                  <div className="text-xs text-center py-4" style={{ color:"var(--text-muted)" }}>No captions found in scraped posts.</div>
                )}
              </div>
            </div>
            {/* Top hashtags */}
            {topHashtags.length>0 && (
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color:"var(--text-muted)" }}>Top Hashtags Used</h4>
                <div className="flex flex-wrap gap-2">
                  {topHashtags.map(([tag,count])=>(
                    <span key={tag} className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium"
                      style={{ background:"var(--bg-input)", border:"1px solid var(--border)", color:"var(--text-sec)" }}>
                      <span className="text-pink-500">#{tag}</span>
                      <span className="text-xs px-1 rounded-full bg-pink-100 text-pink-600" style={{ fontSize:9 }}>{count}×</span>
                    </span>
                  ))}
                </div>
              </div>
            )}
            {/* Location intel */}
            {withLocation>0 && (
              <div className="rounded-lg p-3 text-xs" style={{ background:"rgba(239,246,255,0.8)", border:"1px solid rgba(191,219,254,0.6)" }}>
                <span className="font-semibold text-blue-700">📍 Location Intelligence: </span>
                <span className="text-blue-600">{withLocation} of {posts.length} posts have location data — </span>
                <span className="text-blue-500">{[...new Set(posts.filter(p=>p.locationName).map(p=>p.locationName))].slice(0,4).join(", ")}</span>
              </div>
            )}
          </div>
        </div>
      );
    })()}
    <button onClick={()=>setActivePage("graph")} className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors"><Network size={15}/>View Relationship Graph<ChevronRight size={14}/></button>
  </div>;
}

// ── Graph Page ──
function GraphPage({ setActivePage, investigation }) {
  const [hoveredNode, setHoveredNode] = useState(null);
  const [activeTab, setActiveTab] = useState("graph");
  const edgeColor = s => s>=80?"#ef4444":s>=65?"#f97316":"#eab308";
  const timelineColor = { success:"#22c55e", warn:"#f97316", info:"#2563eb" };

  if (!investigation) {
    return <div className="p-6">
      <div className="rounded-xl p-10 shadow-sm flex flex-col items-center text-center" style={V.card}>
        <Network size={28} className="text-slate-300 mb-3"/>
        <h3 className="font-semibold text-sm mb-1" style={{ color:"var(--text-primary)" }}>No investigation loaded</h3>
        <p className="text-slate-400 text-xs max-w-sm">Run a public OSINT search first — the relationship graph and timeline here are built from that case's real findings, not sample data.</p>
        <button onClick={()=>setActivePage("osint")} className="mt-4 flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium transition-colors"><Search size={13}/>Go to OSINT Search</button>
      </div>
    </div>;
  }

  // ── Build real graph from the investigation: center node = target, ──
  // one node per confirmed/candidate platform finding, one per Gemini source.
  const findings = investigation.findings || [];
  const geminiSources = investigation.gemini?.sources || [];
  const W=760, H=490, CX=W/2, CY=H/2;
  const orbitNodes = [
    ...findings.map((f,i)=>({ key:`f${i}`, label:f.title||f.platform||"Finding", platform:f.platform||"", risk: f.status==="found" ? (investigation.risk||"medium") : "medium", matchPct: f.status==="found"?80:50, abbr:(f.platform||"?").slice(0,2).toUpperCase(), url:f.url })),
    ...geminiSources.slice(0,6).map((s,i)=>({ key:`g${i}`, label:s.title||s.url, platform:"Gemini Source", risk:"low", matchPct:55, abbr:"AI", url:s.url })),
  ];
  const N = orbitNodes.length;
  const R = Math.min(W,H)/2 - 90;
  const graphNodes = [
    { id:"center", label:investigation.target, platform:investigation.type, risk:investigation.risk||"medium", matchPct:investigation.stats?.confidence||0, abbr:(investigation.target||"?").slice(0,2).toUpperCase(), x:CX, y:CY, size:26 },
    ...orbitNodes.map((n,i)=>{
      const angle = (2*Math.PI*i)/Math.max(N,1) - Math.PI/2;
      return { id:n.key, label:n.label, platform:n.platform, risk:n.risk, matchPct:n.matchPct, abbr:n.abbr, x:CX+R*Math.cos(angle), y:CY+R*Math.sin(angle), size:18 };
    }),
  ];
  const graphEdges = orbitNodes.map(n=>({ from:"center", to:n.key, strength:n.matchPct }));
  const nodeById = id => graphNodes.find(n=>n.id===id) || graphNodes[0];
  const hNode = hoveredNode ? graphNodes.find(n=>n.id===hoveredNode) : null;

  const avgMatch = graphNodes.length>1 ? Math.round(graphNodes.slice(1).reduce((s,n)=>s+n.matchPct,0)/(graphNodes.length-1)) : 0;
  const criticalNodes = graphNodes.filter(n=>n.risk==="critical"||n.risk==="high").length;

  // ── Timeline straight from the case's real activity logs ──
  const logs = investigation.logs || [];
  const logCounts = { success:0, warn:0, info:0 };
  logs.forEach(l=>{ if (logCounts[l.level]!==undefined) logCounts[l.level]++; });

  return <div className="p-6 space-y-5">
    <div className="flex items-center gap-1 p-1 rounded-xl w-fit shadow-sm" style={V.card}>
      {["graph","timeline"].map(tab=><button key={tab} onClick={()=>setActiveTab(tab)} className={cn("px-4 py-2 rounded-lg text-sm font-medium transition-all", activeTab===tab?"bg-blue-600 text-white shadow-sm":"text-slate-500 hover:text-slate-700")}>{tab==="graph"?"🕸 Relationship Graph":"📅 Timeline"}</button>)}
    </div>
    {activeTab==="graph" && <div className="grid grid-cols-1 lg:grid-cols-4 gap-5">
      <div className="lg:col-span-3 bg-white rounded-xl shadow-sm" style={V.card}>
        <div className="flex items-center justify-between px-5 py-4" style={V.inner}><div><h3 className="font-semibold text-sm" style={{ color:"var(--text-primary)" }}>Identity Network</h3><p className="text-slate-400 text-xs mt-0.5">{graphNodes.length} nodes · {graphEdges.length} edges · Target: {investigation.target}</p></div><div className="flex items-center gap-3"><div className="flex items-center gap-3 text-slate-400" style={{ fontSize:10 }}>{["critical","high","medium"].map(r=><div key={r} className="flex items-center gap-1"><span className="w-2 h-2 rounded-full" style={{ backgroundColor:riskFill[r].stroke }}/><span className="capitalize">{r}</span></div>)}</div><button className="p-1.5 rounded-lg hover:bg-slate-50 text-slate-400"><RefreshCw size={13}/></button></div></div>
        <div style={{ background:"var(--bg-card)" }}>
          {N===0 ? <div className="flex flex-col items-center justify-center text-center py-16"><Network size={24} className="text-slate-200 mb-2"/><p className="text-slate-400 text-xs">No platform findings or sources to graph yet for this case.</p></div> :
          <svg viewBox={`0 0 ${W} ${H}`} style={{ width:"100%", minHeight:380 }}>
            <defs><filter id="nodeShadow"><feDropShadow dx={0} dy={2} stdDeviation={4} floodOpacity={0.12}/></filter></defs>
            {Array.from({ length:10 }).map((_,i)=><line key={`h${i}`} x1={0} y1={i*50} x2={W} y2={i*50} stroke="#f1f5f9" strokeWidth={1}/>)}
            {Array.from({ length:16 }).map((_,i)=><line key={`v${i}`} x1={i*50} y1={0} x2={i*50} y2={H} stroke="#f1f5f9" strokeWidth={1}/>)}
            {graphEdges.map((edge,i)=>{
              const from=nodeById(edge.from), to=nodeById(edge.to);
              const isHov = hoveredNode===edge.from||hoveredNode===edge.to;
              const color = edgeColor(edge.strength);
              const midX=(from.x+to.x)/2, midY=(from.y+to.y)/2-20;
              return <g key={i}><path d={`M${from.x},${from.y} Q${midX},${midY} ${to.x},${to.y}`} fill="none" stroke={color} strokeWidth={isHov?2.5:1.5} strokeOpacity={isHov?0.9:0.35} strokeDasharray={edge.from!=="center"?"5,4":undefined}/><text x={(from.x+to.x)/2} y={(from.y+to.y)/2-5} textAnchor="middle" fill={color} fontSize={9} fontFamily="monospace" opacity={isHov?0.9:0.5}>{edge.strength}%</text></g>;
            })}
            {graphNodes.map(node=>{
              const style=riskFill[node.risk]||riskFill.medium, isHov=hoveredNode===node.id, isCenter=node.id==="center";
              return <g key={node.id} style={{ cursor:"pointer" }} onMouseEnter={()=>setHoveredNode(node.id)} onMouseLeave={()=>setHoveredNode(null)}>
                {isHov&&<circle cx={node.x} cy={node.y} r={node.size+10} fill={style.glow}/>}
                <circle cx={node.x} cy={node.y} r={node.size} fill={isCenter?"#fef2f2":style.fill} stroke={style.stroke} strokeWidth={isCenter?3:isHov?2.5:2} filter="url(#nodeShadow)"/>
                {isCenter&&<circle cx={node.x} cy={node.y} r={node.size-6} fill="none" stroke="#ef4444" strokeWidth={1} strokeDasharray="3,3" opacity={0.5}/>}
                <text x={node.x} y={node.y-3} textAnchor="middle" fill={style.stroke} fontSize={isCenter?11:9} fontWeight={700} fontFamily="monospace">{node.abbr}</text>
                <text x={node.x} y={node.y+9} textAnchor="middle" fill="#64748b" fontSize={7.5} fontFamily="monospace">{node.matchPct}%</text>
                <text x={node.x} y={node.y+node.size+14} textAnchor="middle" fill="#475569" fontSize={9}>{(node.label||"").length>14?node.label.slice(0,13)+"…":node.label}</text>
                <text x={node.x} y={node.y+node.size+24} textAnchor="middle" fill="#94a3b8" fontSize={8}>{node.platform}</text>
              </g>;
            })}
          </svg>}
        </div>
      </div>
      <div className="space-y-4">
        <div className="rounded-xl p-5 shadow-sm" style={{ ...V.card, minHeight:200 }}>
          {hNode ? <Fragment>
            <div className="flex items-center gap-2 mb-4"><div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor:(riskFill[hNode.risk]||riskFill.medium).stroke }}/><h3 className="font-semibold text-sm" style={{ color:"var(--text-primary)" }}>Node Details</h3></div>
            <div className="space-y-3">
              <div><div className="text-slate-400 mb-0.5" style={{ fontSize:11 }}>Account / Source</div><div className="text-sm font-medium text-slate-700 break-all" style={{ fontFamily:"monospace" }}>{hNode.label}</div></div>
              <div><div className="text-slate-400 mb-0.5" style={{ fontSize:11 }}>Platform</div><div className="text-sm text-slate-600">{hNode.platform || "—"}</div></div>
              <div><div className="text-slate-400 mb-1" style={{ fontSize:11 }}>Match Score</div><ScoreBar score={hNode.matchPct} color={(riskFill[hNode.risk]||riskFill.medium).stroke}/></div>
              <div className="flex items-center justify-between"><div className="text-slate-400" style={{ fontSize:11 }}>Risk Level</div><RiskBadge risk={hNode.risk}/></div>
            </div>
          </Fragment> : <div className="flex flex-col items-center justify-center h-32 text-center"><Network size={24} className="text-slate-200 mb-2"/><p className="text-slate-400 text-xs">Hover a node to see details</p></div>}
        </div>
        <div className="rounded-xl p-5 shadow-sm" style={V.card}>
          <h3 className="text-slate-700 font-semibold uppercase tracking-wide mb-3" style={{ fontSize:12 }}>Risk Legend</h3>
          {["critical","high","medium","low"].map(r=><div key={r} className="flex items-center gap-2 mb-2"><span className="w-3 h-3 rounded-full border-2" style={{ borderColor:riskFill[r].stroke, backgroundColor:riskFill[r].fill }}/><span className="text-slate-600 text-xs capitalize">{r}</span></div>)}
        </div>
        <div className="rounded-xl p-4 shadow-sm" style={V.card}>
          <h3 className="text-slate-700 font-semibold uppercase tracking-wide mb-3" style={{ fontSize:12 }}>Network Stats</h3>
          {[["Total Nodes", String(graphNodes.length)],["Avg Match Score", `${avgMatch}%`],["Critical/High Nodes", String(criticalNodes)],["Sources Crawled", String(investigation.stats?.sources||0)]].map(([k,v])=><div key={k} className="flex justify-between items-center mb-2"><span className="text-slate-400 text-xs">{k}</span><span className="text-slate-700 text-xs font-medium" style={{ fontFamily:"monospace" }}>{v}</span></div>)}
        </div>
      </div>
    </div>}
    {activeTab==="timeline" && <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
      <div className="lg:col-span-2 rounded-xl shadow-sm" style={V.card}>
        <div className="px-6 py-4" style={V.inner}><h3 className="font-semibold text-sm" style={{ color:"var(--text-primary)" }}>Investigation Timeline</h3><p className="text-slate-400 text-xs mt-0.5">Chronological activity log for case {investigation.id}</p></div>
        <div className="px-6 py-5">{logs.length ? <div className="relative"><div className="absolute top-4 bottom-4 w-px bg-slate-200" style={{ left:18 }}/><div className="space-y-6">{logs.map((ev,i)=>{
          const color=timelineColor[ev.level]||"#64748b";
          const Ic = ev.level==="success" ? CheckCircle2 : ev.level==="warn" ? AlertTriangle : Circle;
          return <div key={i} className="flex gap-4 relative">
            <div className="w-9 h-9 rounded-full flex items-center justify-center z-10 flex-shrink-0 shadow-sm" style={{ backgroundColor:`${color}18`, border:`2px solid ${color}40` }}><Ic size={14} style={{ color }}/></div>
            <div className="flex-1 pb-2"><p className="text-slate-700 text-sm leading-relaxed">{ev.msg}</p><div className="flex items-center gap-2 mt-1.5"><Calendar size={11} className="text-slate-400"/><span className="text-slate-400" style={{ fontSize:11 }}>{ev.time}</span></div></div>
          </div>;
        })}</div></div> : <div className="text-center text-slate-400 text-sm py-10">No activity log recorded for this case.</div>}</div>
      </div>
      <div className="space-y-4">
        <div className="rounded-xl p-5 shadow-sm" style={V.card}>
          <h3 className="text-slate-800 font-semibold text-sm mb-4">Log Breakdown</h3>
          <div className="space-y-3">{[["Success","success","#22c55e"],["Warning","warn","#f97316"],["Info","info","#2563eb"]].map(([label,key,color])=><div key={key}><div className="flex justify-between mb-1" style={{ fontSize:11 }}><span className="text-slate-500">{label}</span><span className="font-medium" style={{ color }}>{logCounts[key]}</span></div><div className="h-2 rounded-full bg-slate-100 overflow-hidden"><div className="h-full rounded-full" style={{ width:`${logs.length?Math.round((logCounts[key]/logs.length)*100):0}%`, backgroundColor:color }}/></div></div>)}</div>
        </div>
        <div className="rounded-xl p-5 shadow-sm" style={V.card}>
          <h3 className="text-slate-800 font-semibold text-sm mb-3">Top Findings</h3>
          {findings.length ? findings.slice(0,5).map((f,i)=><div key={i} className="flex items-center gap-3 mb-3"><PlatformPill abbr={(f.platform||"?").slice(0,2).toUpperCase()} color={f.color||"#2563eb"}/><div className="flex-1 min-w-0"><div className="text-slate-700 text-xs font-medium truncate" style={{ fontFamily:"monospace" }}>{f.title || f.platform}</div><div className="text-slate-400" style={{ fontSize:10 }}>{f.status==="found"?"Confirmed":"Candidate"}</div></div></div>) : <div className="text-center text-slate-400 text-xs py-4">No platform findings yet.</div>}
        </div>
      </div>
    </div>}
    <button onClick={()=>setActivePage("report")} className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors"><FileText size={15}/>Generate Forensic Report<ChevronRight size={14}/></button>
  </div>;
}

// ── Report Page ──
// ── Content & Keyword Analysis Page (SOCMINT core feature #5) ──
function ContentAnalysisPage({ setActivePage, investigation }) {
  if (!investigation) {
    return <div className="p-6">
      <div className="rounded-xl p-10 shadow-sm flex flex-col items-center text-center" style={V.card}>
        <Hash size={28} className="text-slate-300 mb-3"/>
        <h3 className="font-semibold text-sm mb-1" style={{ color:"var(--text-primary)" }}>No investigation loaded</h3>
        <p className="text-slate-400 text-xs max-w-sm">Run a public OSINT search first — keyword frequency, hashtags, tone, and cross-posting are derived from that case's real findings, not sample data.</p>
        <button onClick={()=>setActivePage("osint")} className="mt-4 flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium transition-colors"><Search size={13}/>Go to OSINT Search</button>
      </div>
    </div>;
  }

  const data = analyzeContent(investigation);
  const maxKeyword = data.keywords[0]?.count || 1;
  const maxHashtag = data.hashtags[0]?.count || 1;
  const toneStyle = {
    positive:    { bg:"#dcfce7", text:"#166534", label:"Positive" },
    aggressive:  { bg:"#fee2e2", text:"#991b1b", label:"Aggressive" },
    promotional: { bg:"#fef3c7", text:"#92400e", label:"Promotional" },
    neutral:     { bg:"#e2e8f0", text:"#475569", label:"Neutral" },
  };

  return <div className="p-4 md:p-6 space-y-5">
    <div className="rounded-xl p-5" style={V.card}>
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h3 className="font-semibold text-sm" style={{ color:"var(--text-primary)" }}>Content & Keyword Analysis</h3>
          <p className="text-slate-400 text-xs mt-0.5">Derived from {data.totalSnippets} collected snippet(s) for case {investigation.id}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400">Dominant tone</span>
          <span className="px-2.5 py-1 rounded-full text-xs font-medium" style={{ background:toneStyle[data.dominantTone]?.bg, color:toneStyle[data.dominantTone]?.text }}>{toneStyle[data.dominantTone]?.label || "Neutral"}</span>
        </div>
      </div>
    </div>

    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
      {/* Keyword frequency */}
      <div className="rounded-xl p-5" style={V.card}>
        <h4 className="font-semibold text-xs uppercase tracking-wide mb-3 flex items-center gap-1.5" style={{ color:"var(--text-primary)" }}><Hash size={13} className="text-blue-500"/>Top Keywords</h4>
        {data.keywords.length===0 ? <p className="text-slate-400 text-xs py-6 text-center">No recurring keywords found yet.</p> :
        <div className="space-y-2">
          {data.keywords.slice(0,12).map(k => <div key={k.word} className="flex items-center gap-2">
            <span className="text-xs w-24 truncate" style={{ color:"var(--text-sec)" }}>{k.word}</span>
            <div className="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden"><div className="h-full bg-blue-500 rounded-full" style={{ width:`${(k.count/maxKeyword)*100}%` }}/></div>
            <span className="text-xs text-slate-400 w-6 text-right">{k.count}</span>
          </div>)}
        </div>}
      </div>

      {/* Hashtags */}
      <div className="rounded-xl p-5" style={V.card}>
        <h4 className="font-semibold text-xs uppercase tracking-wide mb-3 flex items-center gap-1.5" style={{ color:"var(--text-primary)" }}><Hash size={13} className="text-indigo-500"/>Hashtags & Tags</h4>
        {data.hashtags.length===0 ? <p className="text-slate-400 text-xs py-6 text-center">No hashtags detected in collected content.</p> :
        <div className="flex flex-wrap gap-2">
          {data.hashtags.map(h => <span key={h.tag} className="px-2.5 py-1 rounded-full text-xs font-medium" style={{ background:"rgba(79,70,229,0.08)", color:"#4338ca", fontSize: 10 + Math.min(6, (h.count/maxHashtag)*6) }}>{h.tag} <span className="opacity-60">×{h.count}</span></span>)}
        </div>}
      </div>
    </div>

    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
      {/* Tone per platform */}
      <div className="rounded-xl p-5" style={V.card}>
        <h4 className="font-semibold text-xs uppercase tracking-wide mb-3" style={{ color:"var(--text-primary)" }}>Tone / Language Indicators by Source</h4>
        {data.toneByPlatform.length===0 ? <p className="text-slate-400 text-xs py-6 text-center">No content collected yet.</p> :
        <div className="space-y-2">
          {data.toneByPlatform.map((t,i) => <div key={i} className="flex items-center justify-between px-3 py-2 rounded-lg" style={{ background:"var(--bg-input)" }}>
            <span className="text-xs capitalize" style={{ color:"var(--text-sec)" }}>{t.platform}</span>
            <span className="px-2 py-0.5 rounded-full text-xs font-medium" style={{ background:toneStyle[t.tone]?.bg, color:toneStyle[t.tone]?.text }}>{toneStyle[t.tone]?.label}</span>
          </div>)}
        </div>}
      </div>

      {/* Cross-posting / repetition */}
      <div className="rounded-xl p-5" style={V.card}>
        <h4 className="font-semibold text-xs uppercase tracking-wide mb-3" style={{ color:"var(--text-primary)" }}>Content Repetition / Cross-Posting</h4>
        {data.repeats.length===0 ? <p className="text-slate-400 text-xs py-6 text-center">No overlapping content detected across collected platforms.</p> :
        <div className="space-y-2">
          {data.repeats.slice(0,10).map((r,i) => <div key={i} className="flex items-center justify-between px-3 py-2 rounded-lg" style={{ background:"var(--bg-input)" }}>
            <span className="text-xs" style={{ color:"var(--text-sec)" }}>{r.from} ↔ {r.to}</span>
            <span className="text-xs text-slate-400">{r.sharedShingles} shared phrase(s)</span>
          </div>)}
          <p className="text-slate-400 text-xs pt-1">Detected via shared 8-word text shingles between platform snippets — a signal of reposted or cross-posted captions/bios.</p>
        </div>}
      </div>
    </div>
  </div>;
}

function ReportPage({ investigation }) {
  const [downloaded, setDownloaded] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);
  const circumference = 2*Math.PI*36;

  // ── Build HTML report string (shared by PDF download + share) ──────────────
  const buildReportHTML = () => {
    const inv = investigation;
    const stats = inv.stats || {};
    const findings = inv.findings || [];
    const confirmed = findings.filter(f => f.status === "found");
    const candidates = findings.filter(f => f.status === "open_link");
    const riskScore = { critical:92, high:70, medium:48, low:20 }[inv.risk] ?? (stats.confidence||0);
    const riskLabel = (inv.risk || "low").toUpperCase();
    const riskColor = { critical:"#dc2626", high:"#f97316", medium:"#d97706", low:"#16a34a" }[inv.risk] || "#64748b";
    const startedDate = inv.startedAt ? new Date(inv.startedAt).toLocaleString() : "Unknown";
    const generatedAt = new Date().toLocaleString();
    const findingRows = findings.map((f, i) => `<tr><td>EV-${String(i+1).padStart(3,"0")}</td><td>${f.platform||"Unknown"}</td><td>${f.title||f.platform||"—"}</td><td style="color:${f.status==="found"?"#16a34a":f.status==="blocked"?"#dc2626":"#d97706"}">${f.status}</td><td>${f.url||"—"}</td></tr>`).join("");
    const metaRows = (inv.metadata||[]).map(m=>`<tr><td>${m.key||""}</td><td>${m.value||""}</td></tr>`).join("");
    const logRows = (inv.logs||[]).map(l=>`<tr><td style="font-family:monospace">${l.time}</td><td style="color:${l.level==="success"?"#16a34a":l.level==="warn"?"#f97316":"#2563eb"};font-weight:600">${l.level.toUpperCase()}</td><td>${l.msg}</td></tr>`).join("") || "<tr><td colspan='3'>No logs.</td></tr>";
    const geminiSummary = (inv.gemini?.summary || "Gemini analysis not available.").replace(/</g,"&lt;").replace(/>/g,"&gt;");
    return `<!DOCTYPE html><html><head><meta charset="UTF-8"/><title>OSINT Report — ${inv.id}</title><style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:'Segoe UI',Arial,sans-serif;font-size:11px;color:#0f172a;background:#fff;padding:32px}h1{font-size:20px;font-weight:700;color:#1e3a5f;margin-bottom:2px}h2{font-size:13px;font-weight:700;color:#1e3a5f;margin:18px 0 8px;border-bottom:1.5px solid #e2e8f0;padding-bottom:4px}.header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:20px;padding-bottom:16px;border-bottom:2px solid #1e3a5f}.badge{display:inline-block;padding:3px 10px;border-radius:20px;font-size:10px;font-weight:700;border:1px solid;margin-right:6px}.stats-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin:14px 0}.stat-box{border:1px solid #e2e8f0;border-radius:8px;padding:10px 12px;text-align:center;background:#f8fafc}.stat-val{font-size:18px;font-weight:800;font-family:monospace;color:#1e3a5f}.stat-label{font-size:9px;color:#64748b;margin-top:2px;text-transform:uppercase;letter-spacing:.05em}table{width:100%;border-collapse:collapse;margin:8px 0;font-size:10px}th{background:#1e3a5f;color:#fff;padding:6px 8px;text-align:left;font-weight:600;font-size:9.5px}td{padding:5px 8px;border-bottom:1px solid #f1f5f9;vertical-align:top}tr:nth-child(even) td{background:#f8fafc}.risk-box{border:1.5px solid ${riskColor};border-radius:8px;padding:10px 14px;margin:10px 0;background:${riskColor}18}.ai-box{background:#f0f4ff;border:1px solid #c7d7fa;border-radius:8px;padding:12px;font-size:10.5px;line-height:1.7;color:#1e40af;white-space:pre-wrap;word-break:break-word}.footer{margin-top:28px;padding-top:10px;border-top:1px solid #e2e8f0;font-size:9px;color:#94a3b8;display:flex;justify-content:space-between}@media print{body{padding:18px}.no-print{display:none!important}}</style></head><body><div class="header"><div><div style="font-size:10px;color:#2563eb;font-weight:700;letter-spacing:.08em;text-transform:uppercase;margin-bottom:4px">🔒 OSINT Intelligence Report — CONFIDENTIAL</div><h1>Case ${inv.id}</h1><div style="font-size:10px;color:#64748b;margin-top:2px;font-family:monospace">Target: ${inv.target} | Type: ${inv.type} | Started: ${startedDate}</div></div><div style="text-align:right"><div style="font-size:9px;color:#94a3b8">Generated by Oxinap</div><div style="font-size:9px;color:#94a3b8">${generatedAt}</div><div style="margin-top:6px"><span class="badge" style="color:${riskColor};border-color:${riskColor}80;background:${riskColor}12">⚠ ${riskLabel} RISK</span><span class="badge" style="color:#2563eb;border-color:#93c5fd;background:#eff6ff">${stats.confidence||0}% Confidence</span></div></div></div><div class="stats-grid"><div class="stat-box"><div class="stat-val">${confirmed.length}</div><div class="stat-label">Confirmed Accounts</div></div><div class="stat-box"><div class="stat-val">${candidates.length}</div><div class="stat-label">Candidate Links</div></div><div class="stat-box"><div class="stat-val">${inv.platforms?.length||0}</div><div class="stat-label">Platforms Found</div></div><div class="stat-box"><div class="stat-val">${stats.sources||0}</div><div class="stat-label">Sources Crawled</div></div></div><div class="risk-box"><div style="font-size:13px;font-weight:800;color:${riskColor}">${riskLabel} THREAT — Risk Score: ${riskScore}/100</div><div style="margin-top:4px;font-size:10px;color:#475569">${confirmed.length} confirmed account(s) across ${inv.platforms?.length||0} platform(s). ${candidates.length} candidate link(s) remain unverified.</div></div><h2>Executive Summary</h2><p style="line-height:1.7;color:#334155">Public-source OSINT investigation <strong>${inv.id}</strong> was conducted against target <strong>${inv.target}</strong> (${inv.type}). The pipeline identified ${confirmed.length} confirmed account(s) and ${candidates.length} candidate link(s) across ${inv.platforms?.length||0} platform(s) at ${stats.confidence||0}% confidence.</p><h2>AI / Gemini Analysis</h2><div class="ai-box">${geminiSummary}</div><h2>Evidence Registry (${findings.length} items)</h2><table><thead><tr><th>ID</th><th>Platform</th><th>Description</th><th>Status</th><th>URL</th></tr></thead><tbody>${findingRows||"<tr><td colspan='5' style='text-align:center;color:#94a3b8'>No evidence items.</td></tr>"}</tbody></table><h2>Collection Metadata</h2><table><thead><tr><th>Field</th><th>Value</th></tr></thead><tbody>${metaRows}</tbody></table><h2>Activity Log</h2><table><thead><tr><th>Time</th><th>Level</th><th>Event</th></tr></thead><tbody>${logRows}</tbody></table><div class="footer"><div>OXINAP — Automated OSINT Platform | For authorised law enforcement use only</div><div style="font-family:monospace">CASE: ${inv.id} | RESTRICTED | ${generatedAt}</div></div></body></html>`;
  };

  // ── PDF: generate Blob → <a download> → direct file download ───────────────
  const handleDownloadPDF = () => {
    const html = buildReportHTML();
    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href     = url;
    a.download = `Oxinap-Report-${investigation.id}-${investigation.target}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setDownloaded(true);
    setTimeout(() => setDownloaded(false), 3000);
  };

  // ── Share text ──────────────────────────────────────────────────────────────
  const shareText = investigation
    ? `🔒 OSINT Report — Case ${investigation.id}\n👤 Target: ${investigation.target}\n⚠️ Risk: ${(investigation.risk||"").toUpperCase()}\n📊 Confidence: ${investigation.stats?.confidence||0}%\n🌐 Platforms: ${(investigation.platforms||[]).join(", ")}\n\nGenerated by Oxinap SOCMINT Platform`
    : "";

  // ── Share modal open ────────────────────────────────────────────────────────
  const handleShare = () => setShareOpen(true);

  // ── Copy to clipboard ───────────────────────────────────────────────────────
  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareText);
    } catch {
      const el = document.createElement("textarea");
      el.value = shareText;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
    }
    setShareCopied(true);
    setTimeout(() => setShareCopied(false), 2500);
  };

  // ── Direct app share links ──────────────────────────────────────────────────
  const shareApps = investigation ? [
    {
      label: "WhatsApp",
      color: "#25D366",
      icon: "💬",
      url: `https://wa.me/?text=${encodeURIComponent(shareText)}`,
    },
    {
      label: "Telegram",
      color: "#229ED9",
      icon: "✈️",
      url: `https://t.me/share/url?url=${encodeURIComponent(window.location.href)}&text=${encodeURIComponent(shareText)}`,
    },
    {
      label: "Email",
      color: "#EA4335",
      icon: "📧",
      url: `mailto:?subject=${encodeURIComponent("OSINT Report — Case " + investigation.id)}&body=${encodeURIComponent(shareText)}`,
    },
    {
      label: "Twitter/X",
      color: "#000000",
      icon: "𝕏",
      url: `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText.slice(0,240))}`,
    },
  ] : [];

  if (!investigation) {
    return <div className="p-6">
      <div className="rounded-xl p-10 shadow-sm flex flex-col items-center text-center" style={V.card}>
        <FileText size={28} className="text-slate-300 mb-3"/>
        <h3 className="font-semibold text-sm mb-1" style={{ color:"var(--text-primary)" }}>No investigation loaded</h3>
        <p className="text-slate-400 text-xs max-w-sm">Run a public OSINT search first — this report is generated from that case's real findings, not sample data.</p>
      </div>
    </div>;
  }

  const stats = investigation.stats || {};
  const riskScore = { critical:92, high:70, medium:48, low:20 }[investigation.risk] ?? (stats.confidence||0);
  const riskOffset = circumference-(riskScore/100)*circumference;
  const findings = investigation.findings || [];
  const confirmed = findings.filter(f=>f.status==="found");
  const candidates = findings.filter(f=>f.status==="open_link");
  const platformCounts = {};
  findings.forEach(f=>{ const p=f.platform||"Unknown"; platformCounts[p]=(platformCounts[p]||0)+1; });
  const platformList = Object.entries(platformCounts).map(([name,count])=>({ name, count }));
  const evidenceItems = [
    ...confirmed.map((f,i)=>({ id:`EV-${String(i+1).padStart(3,"0")}`, type:"Confirmed Profile", description:`${f.title || f.platform} — confirmed via ${f.extractor || "scraper"}`, platform:f.platform, risk:investigation.risk||"medium", url:f.url })),
    ...candidates.map((f,i)=>({ id:`EV-${String(confirmed.length+i+1).padStart(3,"0")}`, type:"Candidate Link", description:`${f.title || f.platform} — unverified open link`, platform:f.platform, risk:"medium", url:f.url })),
  ];
  const riskLabel = (investigation.risk||"low").toUpperCase();
  const riskCardCls = { critical:"bg-red-50 border-red-200 text-red-700", high:"bg-orange-50 border-orange-200 text-orange-700", medium:"bg-amber-50 border-amber-200 text-amber-700", low:"bg-green-50 border-green-200 text-green-700" }[investigation.risk] || "bg-slate-50 border-slate-200 text-slate-600";
  const startedDate = investigation.startedAt ? new Date(investigation.startedAt) : null;

  return <div className="p-6 space-y-5">
    <div className="rounded-xl shadow-sm" style={V.card}>
      <div className="p-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div><div className="flex items-center gap-2 mb-1"><Shield size={16} className="text-blue-600"/><span className="text-blue-600 text-xs font-semibold uppercase tracking-wider">OSINT Investigation Report</span></div><h2 className="font-bold text-xl mb-1" style={{ color:"var(--text-primary)" }}>Case {investigation.id}</h2><p className="text-slate-500 text-sm">Target: <span className="font-medium text-slate-700" style={{ fontFamily:"monospace" }}>{investigation.target}</span>{startedDate && <> · Opened {startedDate.toLocaleDateString()}</>}</p></div>
          <div className="flex items-center gap-2.5 flex-shrink-0">
            <button onClick={handleDownloadPDF} className={cn("flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all", downloaded?"bg-green-600 text-white":"bg-blue-600 hover:bg-blue-700 text-white")}>{downloaded?<CheckCircle2 size={14}/>:<Download size={14}/>}{downloaded?"Opening PDF…":"Download PDF"}</button>
            <button onClick={handleShare} className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"><Share2 size={14}/>Share Report</button>
            {shareOpen && (
              <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.5)", zIndex:1000, display:"flex", alignItems:"center", justifyContent:"center" }} onClick={()=>setShareOpen(false)}>
                <div style={{ background:"var(--bg-card)", border:"1px solid var(--border)", borderRadius:18, padding:24, width:380, maxWidth:"92vw", boxShadow:"0 24px 64px rgba(0,0,0,0.25)" }} onClick={e=>e.stopPropagation()}>
                  {/* Header */}
                  <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:18 }}>
                    <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                      <Share2 size={16} className="text-blue-600"/>
                      <span style={{ fontWeight:700, fontSize:15, color:"var(--text-primary)" }}>Share Report</span>
                    </div>
                    <button onClick={()=>setShareOpen(false)} style={{ background:"none", border:"none", cursor:"pointer", color:"var(--text-muted)", fontSize:20, lineHeight:1, padding:"0 4px" }}>×</button>
                  </div>

                  {/* Preview */}
                  <div style={{ background:"var(--bg-input)", border:"1px solid var(--border)", borderRadius:10, padding:10, marginBottom:16, fontSize:11, color:"var(--text-sec)", fontFamily:"monospace", whiteSpace:"pre-wrap", maxHeight:100, overflowY:"auto", lineHeight:1.6 }}>{shareText}</div>

                  {/* App share buttons */}
                  <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:12 }}>
                    {shareApps.map(app => (
                      <a key={app.label} href={app.url} target="_blank" rel="noopener noreferrer"
                        style={{ display:"flex", alignItems:"center", gap:10, padding:"11px 14px", borderRadius:10, background:app.color, color:"#fff", textDecoration:"none", fontWeight:600, fontSize:13, transition:"opacity 0.15s" }}
                        onMouseEnter={e=>e.currentTarget.style.opacity="0.88"}
                        onMouseLeave={e=>e.currentTarget.style.opacity="1"}>
                        <span style={{ fontSize:18, lineHeight:1 }}>{app.icon}</span>
                        {app.label}
                      </a>
                    ))}
                  </div>

                  {/* Copy + Download row */}
                  <div style={{ display:"flex", gap:8 }}>
                    <button onClick={handleCopyLink} style={{ flex:1, display:"flex", alignItems:"center", justifyContent:"center", gap:7, padding:"10px 14px", borderRadius:10, background: shareCopied?"#16a34a":"var(--bg-input)", color: shareCopied?"#fff":"var(--text-primary)", border:"1px solid var(--border)", cursor:"pointer", fontWeight:600, fontSize:12, transition:"all 0.2s" }}>
                      {shareCopied ? <CheckCircle2 size={13}/> : <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>}
                      {shareCopied ? "Copied!" : "Copy Text"}
                    </button>
                    <button onClick={()=>{ setShareOpen(false); handleDownloadPDF(); }} style={{ flex:1, display:"flex", alignItems:"center", justifyContent:"center", gap:7, padding:"10px 14px", borderRadius:10, background:"var(--bg-input)", color:"var(--text-primary)", border:"1px solid var(--border)", cursor:"pointer", fontWeight:600, fontSize:12 }}>
                      <Download size={13}/>Download
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 mt-4 pt-4" style={{ borderTop:"1px solid var(--border-inner)" }}>
          <span className={cn("flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full ring-1", riskCardCls)}><span className="w-1.5 h-1.5 rounded-full bg-current"/>Threat Level: {riskLabel}</span>
          <span className="text-xs bg-slate-100 text-slate-600 px-3 py-1.5 rounded-full">{confirmed.length} Confirmed Account(s)</span>
          <span className="text-xs bg-slate-100 text-slate-600 px-3 py-1.5 rounded-full">{investigation.platforms?.length || 0} Platforms Identified</span>
          <span className="text-xs bg-indigo-50 text-indigo-700 px-3 py-1.5 rounded-full ring-1 ring-indigo-200">{stats.confidence||0}% Confidence</span>
          <span className="text-xs bg-slate-100 text-slate-500 px-3 py-1.5 rounded-full">Generated {new Date().toLocaleString()}</span>
        </div>
      </div>
    </div>
    <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-4">{[
      { label:"Connected Accounts", value:String(confirmed.length), icon:Users, color:"#2563eb" },{ label:"Platforms Found", value:String(investigation.platforms?.length||0), icon:Globe, color:"#4f46e5" },
      { label:"Confidence Score", value:`${stats.confidence||0}%`, icon:Target, color:"#0891b2" },{ label:"Risk Score", value:`${riskScore}/100`, icon:AlertTriangle, color:"#ef4444" },
      { label:"Evidence Items", value:String(evidenceItems.length), icon:FileText, color:"#7c3aed" },{ label:"Sources Crawled", value:String(stats.sources||0), icon:Calendar, color:"#f97316" },
    ].map(({ label, value, icon:Ic, color })=><div key={label} className="rounded-xl p-4 shadow-sm text-center" style={V.card}><div className="w-8 h-8 rounded-lg flex items-center justify-center mx-auto mb-2" style={{ backgroundColor:`${color}15` }}><Ic size={15} style={{ color }}/></div><div className="text-lg font-bold text-slate-800 tabular-nums" style={{ fontFamily:"monospace" }}>{value}</div><div className="text-slate-500 leading-tight mt-0.5" style={{ fontSize:10 }}>{label}</div></div>)}</div>
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
      <div className="lg:col-span-2 space-y-4">
        <div className="rounded-xl shadow-sm" style={V.card}>
          <div className="px-6 py-4" style={V.inner}><h3 className="font-semibold text-sm" style={{ color:"var(--text-primary)" }}>Executive Findings</h3></div>
          <div className="px-6 py-5 space-y-4 text-sm text-slate-600 leading-relaxed">
            <p>Public-source OSINT investigation <span className="font-medium text-slate-800" style={{ fontFamily:"monospace" }}>{investigation.id}</span> was run against target <span className="font-medium text-slate-800">{investigation.target}</span> ({investigation.type}). The collection pipeline found <span className="font-semibold text-blue-700">{confirmed.length} confirmed account(s)</span> and <span className="font-semibold text-blue-700">{candidates.length} candidate link(s)</span> across <span className="font-semibold text-blue-700">{investigation.platforms?.length||0} platform(s)</span>, with an overall confidence score of <span className="font-semibold text-blue-700">{stats.confidence||0}%</span>.</p>
            {investigation.gemini?.summary ? <p className="whitespace-pre-wrap">{investigation.gemini.summary}</p> : <p className="text-slate-400 text-xs">Gemini grounded search summary not available for this case.</p>}
            <div className={cn("rounded-xl p-4 shadow-sm", riskCardCls)} style={{ border:"1px solid" }}>
              <div className="flex items-start gap-3"><AlertTriangle size={15} className="mt-0.5 flex-shrink-0"/><div><div className="font-semibold text-sm mb-1">Risk Assessment</div><p className="text-xs leading-relaxed">Risk level is {riskLabel} based on {confirmed.length} confirmed account(s) and {stats.sources||0} corroborating source(s). Review findings before escalating.</p></div></div>
            </div>
          </div>
        </div>
        <div className="rounded-xl shadow-sm" style={V.card}>
          <div className="flex items-center justify-between px-6 py-4" style={V.inner}><h3 className="font-semibold text-sm" style={{ color:"var(--text-primary)" }}>Evidence Registry</h3><span className="text-xs text-slate-400">{evidenceItems.length} items collected</span></div>
          <div className="overflow-x-auto"><table className="w-full text-xs">
            <thead><tr style={V.inner}>{["Evidence ID","Type","Description","Platform","Risk"].map(hd=><th key={hd} className="text-left px-5 py-2.5 font-medium tracking-wide whitespace-nowrap" style={{ fontSize:11, color:"var(--text-muted)" }}>{hd}</th>)}</tr></thead>
            <tbody>{evidenceItems.length ? evidenceItems.map(ev=><tr key={ev.id} className="hover:bg-slate-50 transition-colors" style={V.inner}>
              <td className="px-5 py-3"><span className="text-blue-600 font-medium" style={{ fontFamily:"monospace" }}>{ev.id}</span></td>
              <td className="px-5 py-3"><span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded" style={{ fontSize:10 }}>{ev.type}</span></td>
              <td className="px-5 py-3 text-slate-600 truncate" style={{ maxWidth:220 }}>{ev.description}</td>
              <td className="px-5 py-3 text-slate-400">{ev.platform}</td>
              <td className="px-5 py-3"><RiskBadge risk={ev.risk}/></td>
            </tr>) : <tr><td colSpan={5} className="px-5 py-6 text-center text-slate-400">No evidence items collected for this case.</td></tr>}</tbody>
          </table></div>
        </div>
      </div>
      <div className="space-y-4">
        <div className="bg-white rounded-xl shadow-sm p-5 text-center" style={V.card}>
          <h3 className="text-slate-700 font-semibold text-sm mb-4">Threat Assessment</h3>
          <div className="relative mx-auto mb-3" style={{ width:112, height:112 }}>
            <svg viewBox="0 0 80 80" width={112} height={112} style={{ transform:"rotate(-90deg)" }}>
              <circle cx={40} cy={40} r={36} fill="none" stroke="#f1f5f9" strokeWidth={7}/>
              <circle cx={40} cy={40} r={36} fill="none" stroke="url(#riskGrad)" strokeWidth={7} strokeDasharray={circumference} strokeDashoffset={riskOffset} strokeLinecap="round"/>
              <defs><linearGradient id="riskGrad" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" stopColor="#f97316"/><stop offset="100%" stopColor="#dc2626"/></linearGradient></defs>
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center"><span className="text-2xl font-bold text-slate-800" style={{ fontFamily:"monospace" }}>{riskScore}</span><span className="text-slate-400" style={{ fontSize:10 }}>/100</span></div>
          </div>
          <div className={cn("rounded-xl px-3 py-2", riskCardCls)} style={{ border:"1px solid" }}><div className="font-bold text-sm">{riskLabel}</div><div className="mt-0.5" style={{ fontSize:10 }}>{investigation.risk==="critical"||investigation.risk==="high" ? "Review recommended" : "Low/medium concern"}</div></div>
        </div>
        <div className="rounded-xl p-5 shadow-sm" style={V.card}>
          <h3 className="text-slate-700 font-semibold text-sm mb-3">Platforms Identified</h3>
          <div className="space-y-2">{platformList.length ? platformList.map(p=><div key={p.name} className="flex items-center gap-2"><PlatformPill abbr={p.name.slice(0,2).toUpperCase()} color="#2563eb"/><span className="text-slate-600 text-xs flex-1">{p.name}</span><span className="text-slate-400 text-xs tabular-nums" style={{ fontFamily:"monospace" }}>{p.count} item{p.count>1?"s":""}</span></div>) : <div className="text-center text-slate-400 text-xs py-2">No platforms identified yet.</div>}</div>
        </div>
        {/* Instagram Posts in Report */}
        {(investigation.instaPosts||[]).length>0 && (
          <div className="rounded-xl shadow-sm" style={V.card}>
            <div className="px-5 py-3" style={V.inner}>
              <h3 className="font-semibold text-sm" style={{ color:"var(--text-primary)" }}>📸 Instagram Posts Evidence</h3>
              <p className="text-xs mt-0.5" style={{ color:"var(--text-muted)" }}>{(investigation.instaPosts||[]).length} posts collected via Apify scraper</p>
            </div>
            <div className="p-4 space-y-2 max-h-72 overflow-y-auto">
              {(investigation.instaPosts||[]).filter(p=>p.caption).slice(0,8).map((p,i)=>(
                <div key={i} className="flex gap-3 p-2.5 rounded-lg text-xs" style={{ background:"var(--bg-input)", border:"1px solid var(--border)" }}>
                  <span className="text-slate-400 font-mono flex-shrink-0 mt-0.5">P{String(i+1).padStart(2,"0")}</span>
                  <div className="flex-1 min-w-0">
                    <p className="leading-relaxed" style={{ color:"var(--text-sec)" }}>{p.caption.slice(0,200)}{p.caption.length>200?"…":""}</p>
                    <div className="flex gap-3 mt-1.5 flex-wrap" style={{ color:"var(--text-muted)", fontSize:10 }}>
                      {p.likesCount!=null && <span>❤️ {Number(p.likesCount).toLocaleString()}</span>}
                      {(p.commentsCount??p.commentsNumber)!=null && <span>💬 {Number(p.commentsCount??p.commentsNumber).toLocaleString()}</span>}
                      {p.locationName && <span>📍 {p.locationName}</span>}
                      {p.timestamp && <span>{new Date(p.timestamp).toLocaleDateString()}</span>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        <div className="rounded-xl p-4 shadow-sm" style={{ background:"rgba(239,246,255,1)", border:"1px solid rgba(191,219,254,1)" }}>
          <div className="flex items-center gap-2 mb-2"><CheckCircle2 size={14} className="text-blue-600"/><span className="text-blue-700 font-semibold text-xs">Investigation Conclusion</span></div>
          <p className="text-blue-600 leading-relaxed" style={{ fontSize:11 }}>{confirmed.length ? `${confirmed.length} account(s) confirmed across public sources with ${stats.confidence||0}% confidence.` : "No accounts confirmed yet — re-run the search or refine the target to improve coverage."} {candidates.length ? `${candidates.length} additional candidate link(s) remain unverified.` : ""}</p>
          <div className="mt-2 text-blue-400" style={{ fontSize:10, fontFamily:"monospace" }}>Generated {new Date().toLocaleString()}</div>
        </div>
      </div>
    </div>
  </div>;
}


// ── Case Inventory Page ──
function CaseInventoryPage({ setActivePage, recentItems, recentLoaded, recentError, onSelectInvestigation, onDeleteInvestigation, onUpdateInvestigation, user }) {
  const [searchQ, setSearchQ] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [savingEdit, setSavingEdit] = useState(false);
  const [editMsg, setEditMsg] = useState("");
  const [attachTarget, setAttachTarget] = useState(null);
  const [attachName, setAttachName] = useState("");
  const [attachUrl, setAttachUrl] = useState("");
  const [uploadingFile, setUploadingFile] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState("");
  const fileInputRef = useRef(null);
  // NOTE: attachments are NOT cached in localStorage/IndexedDB. This map is only an
  // optimistic in-memory overlay for instant UI feedback — the source of truth is
  // Supabase (investigation.data.attachments), refreshed after every mutation below.
  // Uploaded files themselves always live on Cloudinary; only the {name,url,...} pointer
  // is persisted with the case record.
  const [attachments, setAttachments] = useState({});
  const [deletingId, setDeletingId] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  // ── Chain-of-custody / activity log (append-only, per case) ──
  const [auditLog, setAuditLog] = useState(() => {
    try { return JSON.parse(localStorage.getItem("oxinap_case_audit") || "{}"); } catch { return {}; }
  });
  const [auditOpenId, setAuditOpenId] = useState(null);
  const investigatorName = user?.displayName || user?.email || "Investigator";

  const logAudit = (caseId, action, detail) => {
    setAuditLog(prev => {
      const entry = { time: Date.now(), action, detail, by: investigatorName };
      const next = { ...prev, [caseId]: [...(prev[caseId] || []), entry].slice(-40) };
      localStorage.setItem("oxinap_case_audit", JSON.stringify(next));
      return next;
    });
  };

  // ── Case linking (connect related cases — same suspect / MO / network) ──
  const [linkTarget, setLinkTarget] = useState(null);
  const [linkPick, setLinkPick] = useState("");

  // ── Multi-select for linking / merging duplicate or related cases ──
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);
  const [mergePrimary, setMergePrimary] = useState(null);
  const [merging, setMerging] = useState(false);
  const [mergeMsg, setMergeMsg] = useState("");
  const [linkingBulk, setLinkingBulk] = useState(false);

  const liveItems = recentLoaded ? recentItems.map(normalizeRecentInvestigation) : [];
  const filtered = liveItems.filter(inv =>
    !searchQ.trim() ||
    (inv.target || "").toLowerCase().includes(searchQ.toLowerCase()) ||
    (inv.id || "").toLowerCase().includes(searchQ.toLowerCase()) ||
    (inv.type || "").toLowerCase().includes(searchQ.toLowerCase()) ||
    (inv.risk || "").toLowerCase().includes(searchQ.toLowerCase()) ||
    (inv.caseRefNo || "").toLowerCase().includes(searchQ.toLowerCase()) ||
    (inv.ioName || "").toLowerCase().includes(searchQ.toLowerCase()) ||
    (Array.isArray(inv.tags) && inv.tags.some(t => t.toLowerCase().includes(searchQ.toLowerCase())))
  );

  const riskRank = { critical: 4, high: 3, medium: 2, low: 1, unknown: 0 };

  const toggleSelect = (id) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
    setMergePrimary(null);
    setMergeMsg("");
  };

  const exitSelectMode = () => { setSelectMode(false); setSelectedIds([]); setMergePrimary(null); setMergeMsg(""); };

  // ── Link two cases together, bidirectionally ──
  const linkCasesTogether = async (idA, idB, { silentRefresh } = {}) => {
    if (!idA || !idB || idA === idB) return;
    const a = liveItems.find(i => i.id === idA)?.fullInvestigation;
    const b = liveItems.find(i => i.id === idB)?.fullInvestigation;
    if (a) {
      const linked = Array.from(new Set([...(Array.isArray(a.linkedCases) ? a.linkedCases : []), idB]));
      await onUpdateInvestigation(idA, { data: { ...a, linkedCases: linked } });
    }
    if (b) {
      const linked = Array.from(new Set([...(Array.isArray(b.linkedCases) ? b.linkedCases : []), idA]));
      await onUpdateInvestigation(idB, { data: { ...b, linkedCases: linked } });
    }
    logAudit(idA, "Linked", `Connected to case ${idB}`);
    logAudit(idB, "Linked", `Connected to case ${idA}`);
  };

  const unlinkCases = async (idA, idB) => {
    const a = liveItems.find(i => i.id === idA)?.fullInvestigation;
    const b = liveItems.find(i => i.id === idB)?.fullInvestigation;
    if (a) await onUpdateInvestigation(idA, { data: { ...a, linkedCases: (a.linkedCases || []).filter(x => x !== idB) } });
    if (b) await onUpdateInvestigation(idB, { data: { ...b, linkedCases: (b.linkedCases || []).filter(x => x !== idA) } });
    logAudit(idA, "Unlinked", `Disconnected from case ${idB}`);
  };

  const linkSelectedTogether = async () => {
    if (selectedIds.length < 2) return;
    setLinkingBulk(true);
    try {
      for (const id of selectedIds) {
        const others = selectedIds.filter(x => x !== id);
        const full = liveItems.find(i => i.id === id)?.fullInvestigation;
        if (!full) continue;
        const linked = Array.from(new Set([...(Array.isArray(full.linkedCases) ? full.linkedCases : []), ...others]));
        await onUpdateInvestigation(id, { data: { ...full, linkedCases: linked } });
        logAudit(id, "Linked", `Connected to ${others.join(", ")}`);
      }
    } finally {
      setLinkingBulk(false);
      exitSelectMode();
    }
  };

  // ── Merge duplicate / related cases into one primary case ──
  const confirmMerge = async () => {
    if (!mergePrimary || selectedIds.length < 2) return;
    setMerging(true);
    setMergeMsg("");
    try {
      const others = selectedIds.filter(id => id !== mergePrimary);
      const primaryFull = liveItems.find(i => i.id === mergePrimary)?.fullInvestigation || {};

      let mergedFindings = Array.isArray(primaryFull.findings) ? [...primaryFull.findings] : [];
      let mergedPlatforms = Array.isArray(primaryFull.platforms) ? [...primaryFull.platforms] : [];
      let mergedCrawled = Array.isArray(primaryFull.crawledPages) ? [...primaryFull.crawledPages] : [];
      let mergedTags = Array.isArray(primaryFull.tags) ? [...primaryFull.tags] : [];
      let mergedLinked = Array.isArray(primaryFull.linkedCases) ? [...primaryFull.linkedCases] : [];
      let mergedNotes = primaryFull.notes || "";
      let topRisk = (primaryFull.risk || "low").toLowerCase();
      let mergedAttachments = [...(attachments[mergePrimary] ?? primaryFull.attachments ?? [])];
      const mergedFromIds = Array.isArray(primaryFull.mergedFrom) ? [...primaryFull.mergedFrom] : [];

      for (const id of others) {
        const full = liveItems.find(i => i.id === id)?.fullInvestigation || {};
        mergedFindings = mergedFindings.concat(full.findings || []);
        mergedPlatforms = Array.from(new Set(mergedPlatforms.concat(full.platforms || [])));
        mergedCrawled = mergedCrawled.concat(full.crawledPages || []);
        mergedTags = Array.from(new Set(mergedTags.concat(full.tags || [])));
        mergedLinked = Array.from(new Set(mergedLinked.concat(full.linkedCases || [])));
        if (full.notes) mergedNotes = mergedNotes ? `${mergedNotes}\n\n[Merged from ${id}] ${full.notes}` : `[Merged from ${id}] ${full.notes}`;
        const r = (full.risk || "low").toLowerCase();
        if ((riskRank[r] || 0) > (riskRank[topRisk] || 0)) topRisk = r;
        mergedAttachments = mergedAttachments.concat(attachments[id] ?? full.attachments ?? []);
        mergedFromIds.push(id);
      }

      // de-dupe findings by value
      const seen = new Set();
      mergedFindings = mergedFindings.filter(f => {
        const k = f?.value;
        if (!k) return true;
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      });

      const mergedData = {
        ...primaryFull,
        findings: mergedFindings,
        platforms: mergedPlatforms,
        crawledPages: mergedCrawled,
        tags: mergedTags,
        linkedCases: mergedLinked.filter(id => id !== mergePrimary && !others.includes(id)),
        notes: mergedNotes,
        risk: topRisk,
        mergedFrom: Array.from(new Set(mergedFromIds)),
        attachments: mergedAttachments,
      };

      await onUpdateInvestigation(mergePrimary, { risk: topRisk, platforms: mergedPlatforms, data: mergedData });

      // Optimistic in-memory overlay only — the merge above already persisted
      // mergedAttachments to Supabase as part of mergedData.
      setAttachments(prev => {
        const next = { ...prev, [mergePrimary]: mergedAttachments };
        for (const id of others) delete next[id];
        return next;
      });

      for (const id of others) {
        await onDeleteInvestigation(id);
      }

      logAudit(mergePrimary, "Merged", `Merged case(s) ${others.join(", ")} into this case`);
      setMergeMsg("✓ Merged successfully");
      setTimeout(exitSelectMode, 1400);
    } catch (e) {
      setMergeMsg("⚠️ " + (e.message || "Merge failed"));
    } finally {
      setMerging(false);
    }
  };

  // ── Export a full case dossier (case data + attachments + audit trail) as JSON ──
  const exportDossier = (inv) => {
    const dossier = {
      case: inv.fullInvestigation || inv,
      attachments: attachments[inv.id] ?? inv.attachments ?? [],
      activityLog: auditLog[inv.id] || [],
      exportedAt: new Date().toISOString(),
      exportedBy: investigatorName,
    };
    const blob = new Blob([JSON.stringify(dossier, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${inv.id || "case"}_dossier.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    logAudit(inv.id, "Exported", "Case dossier exported (JSON)");
  };

  const riskColor = { critical:"#ef4444", high:"#f97316", medium:"#eab308", low:"#22c55e", unknown:"#94a3b8" };
  const riskBg    = { critical:"rgba(239,68,68,0.08)", high:"rgba(249,115,22,0.08)", medium:"rgba(234,179,8,0.08)", low:"rgba(34,197,94,0.08)", unknown:"rgba(148,163,184,0.08)" };
  const statusColor = { Active:"#2563eb", Analysis:"#7c3aed", Collection:"#0891b2", Completed:"#475569" };

  // ── Persist attachments with the case record in Supabase ──
  // Files themselves are already on Cloudinary by the time this runs; this only
  // saves the {name,url,...} pointer array as part of investigation.data, so it
  // survives across devices/browsers instead of living only in this browser.
  const persistAttachments = async (caseId, next) => {
    setAttachments(prev => ({ ...prev, [caseId]: next }));
    const full = liveItems.find(i => i.id === caseId)?.fullInvestigation || {};
    try {
      await onUpdateInvestigation(caseId, { data: { ...full, attachments: next } });
    } catch (e) {
      setUploadError(e.message || "Failed to save attachment to case record.");
    }
  };

  const addAttachment = async () => {
    if (!attachName.trim() && !attachUrl.trim()) return;
    const key = attachTarget;
    const inv = liveItems.find(i => i.id === key);
    const prev = attachments[key] ?? inv?.attachments ?? [];
    const label = attachName.trim() || attachUrl.trim();
    const next = [...prev, { id: Date.now(), name: label, url: attachUrl.trim(), addedAt: Date.now() }];
    await persistAttachments(key, next);
    logAudit(key, "Attachment added", label);
    setAttachName("");
    setAttachUrl("");
  };

  const removeAttachment = async (caseId, attId) => {
    const inv = liveItems.find(i => i.id === caseId);
    const current = attachments[caseId] ?? inv?.attachments ?? [];
    const removed = current.find(a => a.id === attId);
    const next = current.filter(a => a.id !== attId);
    await persistAttachments(caseId, next);
    if (removed) logAudit(caseId, "Attachment removed", removed.name);
  };

  // ── Upload an evidence file straight to Cloudinary (signed, per-case folder) ──
  const handleFileUpload = async (caseId, file) => {
    if (!file) return;
    setUploadError("");
    setUploadingFile(true);
    setUploadProgress(0);
    try {
      const result = await uploadAttachmentToCloudinary(file, caseId, setUploadProgress);
      const inv = liveItems.find(i => i.id === caseId);
      const prev = attachments[caseId] ?? inv?.attachments ?? [];
      const entry = {
        id: Date.now(),
        name: file.name,
        url: result.url,
        publicId: result.publicId,
        resourceType: result.resourceType,
        format: result.format,
        bytes: result.bytes,
        addedAt: Date.now(),
        source: "cloudinary",
      };
      await persistAttachments(caseId, [...prev, entry]);
      logAudit(caseId, "Attachment uploaded", `${file.name} (${(file.size / 1024).toFixed(0)} KB) → Cloudinary`);
    } catch (e) {
      setUploadError(e.message || "Upload failed.");
    } finally {
      setUploadingFile(false);
      setUploadProgress(0);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const startEdit = (inv) => {
    setEditingId(inv.id);
    setEditMsg("");
    setEditForm({
      target: inv.target || "",
      type: inv.type || "",
      risk: inv.risk || "low",
      status: inv.status || "Active",
      notes: inv.notes || "",
      caseRefNo: inv.caseRefNo || "",
      ioName: inv.ioName || "",
      policeStation: inv.policeStation || "",
      tags: Array.isArray(inv.tags) ? inv.tags.join(", ") : (inv.tags || ""),
    });
  };

  const saveEdit = async (inv) => {
    setSavingEdit(true);
    setEditMsg("");
    try {
      const tagsArr = (editForm.tags || "").split(",").map(t => t.trim()).filter(Boolean);
      const mergedData = {
        ...(inv.fullInvestigation || {}),
        target: editForm.target,
        type: editForm.type,
        risk: editForm.risk,
        status: editForm.status,
        notes: editForm.notes,
        caseRefNo: editForm.caseRefNo,
        ioName: editForm.ioName,
        policeStation: editForm.policeStation,
        tags: tagsArr,
      };
      if (onUpdateInvestigation) {
        await onUpdateInvestigation(inv.id, {
          target: editForm.target,
          type: editForm.type,
          risk: editForm.risk,
          status: editForm.status,
          data: mergedData,
        });
      }
      logAudit(inv.id, "Edited", "Updated case details");
      setEditMsg("✓ Saved");
      setTimeout(() => { setEditingId(null); setEditMsg(""); }, 1200);
    } catch(e) {
      setEditMsg("⚠️ " + (e.message || "Save failed"));
    } finally {
      setSavingEdit(false);
    }
  };

  const doDelete = async (caseId) => {
    setDeletingId(caseId);
    try { await onDeleteInvestigation(caseId); } catch(e) { /* silent */ }
    finally { setDeletingId(null); setDeleteConfirm(null); }
  };

  // ── Folder SVG icon ──
  function FolderIcon({ risk = "low", size = 48 }) {
    const col = riskColor[risk] || "#94a3b8";
    const shadow = col + "40";
    return (
      <svg width={size} height={size} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <filter id={`folderShadow-${risk}`} x="-10%" y="-10%" width="120%" height="130%">
            <feDropShadow dx="0" dy="2" stdDeviation="2" floodColor={shadow}/>
          </filter>
        </defs>
        {/* Folder back */}
        <rect x="4" y="14" width="40" height="28" rx="4" fill={col} opacity="0.18"/>
        {/* Tab */}
        <path d="M4 16 Q4 14 6 14 L18 14 Q20 14 21 16 L22 18 H42 Q44 18 44 20 V38 Q44 40 42 40 H6 Q4 40 4 38 V16 Z" fill={col} opacity="0.32"/>
        {/* Folder front body */}
        <rect x="4" y="18" width="40" height="22" rx="3" fill={col} filter={`url(#folderShadow-${risk})`}/>
        {/* Shine */}
        <rect x="8" y="22" width="20" height="2.5" rx="1.25" fill="white" opacity="0.3"/>
        {/* Lines suggesting contents */}
        <rect x="8" y="27" width="32" height="1.5" rx="0.75" fill="white" opacity="0.2"/>
        <rect x="8" y="31" width="24" height="1.5" rx="0.75" fill="white" opacity="0.2"/>
        <rect x="8" y="35" width="16" height="1.5" rx="0.75" fill="white" opacity="0.15"/>
      </svg>
    );
  }

  return (
    <div className="page-pad space-y-5">
      {/* Header */}
      <div className="rounded-xl p-5 shadow-sm" style={V.card}>
        <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
          <div>
            <h2 className="font-bold text-base" style={{ color:"var(--text-primary)" }}>Case Inventory</h2>
            <p className="text-xs mt-0.5" style={{ color:"var(--text-muted)" }}>
              {recentLoaded ? `${filtered.length} of ${liveItems.length} case(s)` : "Loading cases…"}
              {recentError && <span className="text-red-400 ml-2">· Sync error</span>}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => selectMode ? exitSelectMode() : setSelectMode(true)}
              className="flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium transition-colors"
              style={ selectMode
                ? { background:"rgba(234,179,8,0.12)", color:"#92400e", border:"1px solid rgba(234,179,8,0.35)" }
                : { background:"var(--bg-input)", color:"var(--text-sec)", border:"1px solid var(--border)" } }
              title="Select multiple cases to link or merge"
            >
              {selectMode ? <XIcon size={14}/> : <CheckSquareIcon size={14}/>}
              {selectMode ? "Cancel Selection" : "Select Cases"}
            </button>
            <button
              onClick={() => setActivePage("osint")}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors"
            >
              <Plus size={14}/>New Investigation
            </button>
          </div>
        </div>
        {/* Search */}
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/>
          <input
            value={searchQ}
            onChange={e => setSearchQ(e.target.value)}
            placeholder="Search by target, ID, FIR/ref no., IO, tag, type, or risk…"
            className="w-full pl-9 pr-4 py-2.5 rounded-lg text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-200"
            style={{ background:"var(--bg-input)", border:"1px solid var(--border)", color:"var(--text-primary)" }}
          />
        </div>

        {/* Select-mode action bar: connect or merge related/duplicate cases */}
        {selectMode && (
          <div className="mt-4 pt-4 rounded-lg" style={{ borderTop:"1px solid var(--border-inner)" }}>
            <div className="flex items-center justify-between flex-wrap gap-3">
              <p className="text-xs" style={{ color:"var(--text-muted)" }}>
                {selectedIds.length === 0 ? "Tap folder icons below to select cases to link or merge." : `${selectedIds.length} case(s) selected.`}
              </p>
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={linkSelectedTogether}
                  disabled={selectedIds.length < 2 || linkingBulk}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors disabled:opacity-40"
                  style={{ background:"rgba(14,165,233,0.1)", color:"#0284c7", border:"1px solid rgba(14,165,233,0.25)" }}
                >
                  {linkingBulk ? <Loader2 size={11} className="animate-spin"/> : <LinkIcon size={11}/>}
                  Connect Selected
                </button>
                <button
                  onClick={() => setMergePrimary(mergePrimary ? null : (selectedIds[0] || null))}
                  disabled={selectedIds.length < 2}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors disabled:opacity-40"
                  style={{ background:"rgba(79,70,229,0.1)", color:"#4f46e5", border:"1px solid rgba(79,70,229,0.25)" }}
                >
                  <GitMerge size={11}/>Merge Selected
                </button>
              </div>
            </div>

            {/* Merge target picker */}
            {mergePrimary !== null && selectedIds.length >= 2 && (
              <div className="mt-3 p-3 rounded-lg space-y-2" style={{ background:"var(--bg-input)", border:"1px solid var(--border)" }}>
                <p className="text-xs font-semibold" style={{ color:"var(--text-primary)" }}>Keep which case as the primary record?</p>
                <p className="text-xs" style={{ color:"var(--text-muted)" }}>Findings, platforms, attachments, notes, and tags from the other case(s) will be merged into the primary case. The other case(s) will then be permanently deleted.</p>
                <div className="flex flex-wrap gap-2">
                  {selectedIds.map(id => {
                    const item = liveItems.find(i => i.id === id);
                    return (
                      <label key={id} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs cursor-pointer" style={{ background: mergePrimary===id ? "rgba(79,70,229,0.12)" : "var(--bg-card)", border:`1px solid ${mergePrimary===id ? "#4f46e5" : "var(--border)"}`, color:"var(--text-primary)" }}>
                        <input type="radio" name="mergePrimary" checked={mergePrimary===id} onChange={() => setMergePrimary(id)} className="accent-indigo-600"/>
                        <span style={{ fontFamily:"monospace" }}>{id}</span>
                        <span style={{ color:"var(--text-muted)" }}>— {item?.target || "—"}</span>
                      </label>
                    );
                  })}
                </div>
                {mergeMsg && <p className="text-xs" style={{ color: mergeMsg.startsWith("✓") ? "#16a34a" : "#ef4444" }}>{mergeMsg}</p>}
                <div className="flex gap-2">
                  <button
                    onClick={confirmMerge}
                    disabled={merging}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white transition-colors"
                  >
                    {merging ? <Loader2 size={11} className="animate-spin"/> : <GitMerge size={11}/>}
                    {merging ? "Merging…" : "Confirm Merge"}
                  </button>
                  <button onClick={() => setMergePrimary(null)} className="px-3 py-1.5 rounded-lg text-xs font-medium" style={{ background:"var(--bg-card)", border:"1px solid var(--border)", color:"var(--text-sec)" }}>
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Loading skeleton */}
      {!recentLoaded && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {[1,2,3,4].map(i => (
            <div key={i} className="rounded-xl p-5 animate-pulse" style={V.card}>
              <div className="w-12 h-12 rounded-lg bg-slate-100 mb-3"/>
              <div className="h-3 bg-slate-100 rounded mb-2 w-3/4"/>
              <div className="h-3 bg-slate-100 rounded w-1/2"/>
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {recentLoaded && filtered.length === 0 && (
        <div className="rounded-xl p-12 text-center" style={V.card}>
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ background:"var(--bg-input)" }}>
            <Database size={24} className="text-slate-300"/>
          </div>
          <p className="font-medium text-sm mb-1" style={{ color:"var(--text-primary)" }}>
            {searchQ ? "No cases match your search" : "No cases yet"}
          </p>
          <p className="text-xs mb-5" style={{ color:"var(--text-muted)" }}>
            {searchQ ? "Try a different keyword." : "Run your first investigation to populate the case inventory."}
          </p>
          {!searchQ && (
            <button onClick={() => setActivePage("osint")} className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium transition-colors flex items-center gap-1.5 mx-auto">
              <Plus size={13}/>Start Investigation
            </button>
          )}
        </div>
      )}

      {/* Case folder grid */}
      {recentLoaded && filtered.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map(inv => {
            const caseAttachments = attachments[inv.id] ?? inv.attachments ?? [];
            const isEditing = editingId === inv.id;
            const isAttaching = attachTarget === inv.id;
            const isLinking = linkTarget === inv.id;
            const isAuditOpen = auditOpenId === inv.id;
            const isSelected = selectedIds.includes(inv.id);
            const risk = (inv.risk || "unknown").toLowerCase();
            const col = riskColor[risk] || riskColor.unknown;
            const linkedIds = Array.isArray(inv.linkedCases) ? inv.linkedCases : [];
            const caseTags = Array.isArray(inv.tags) ? inv.tags : [];
            const caseLog = auditLog[inv.id] || [];

            return (
              <div
                key={inv.id}
                className="rounded-xl overflow-hidden shadow-sm transition-shadow duration-150 hover:shadow-md"
                style={{
                  border: isSelected ? "1px solid #4f46e5" : `1px solid ${col}30`,
                  background:"var(--bg-card)",
                  boxShadow: isSelected ? "0 0 0 3px rgba(79,70,229,0.15)" : undefined,
                  position:"relative",
                  isolation:"isolate",
                  contain:"layout paint",
                  transform:"translateZ(0)",
                }}
              >
                {/* Folder header */}
                <div
                  className="px-4 pt-4 pb-3 flex items-start gap-3 cursor-pointer relative"
                  onClick={() => selectMode ? toggleSelect(inv.id) : (inv.fullInvestigation && onSelectInvestigation(inv.fullInvestigation))}
                  style={{ background: riskBg[risk] || riskBg.unknown }}
                >
                  {selectMode && (
                    <div className="absolute top-2 right-2 w-5 h-5 rounded-md flex items-center justify-center" style={{ background: isSelected ? "#4f46e5" : "var(--bg-card)", border: `1.5px solid ${isSelected ? "#4f46e5" : "var(--border)"}` }}>
                      {isSelected && <Check size={12} className="text-white"/>}
                    </div>
                  )}
                  <FolderIcon risk={risk} size={44}/>
                  <div className="flex-1 min-w-0 pt-0.5">
                    <div className="font-bold text-xs truncate" style={{ color: col, fontFamily:"monospace" }}>{inv.id}</div>
                    <div className="font-semibold text-sm truncate mt-0.5" style={{ color:"var(--text-primary)", fontFamily:"monospace" }}>
                      {inv.target || "—"}
                    </div>
                    <div className="text-xs mt-0.5 truncate" style={{ color:"var(--text-muted)" }}>{inv.type || "unknown type"}</div>
                    {(inv.caseRefNo || inv.ioName || inv.policeStation) && (
                      <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1">
                        {inv.caseRefNo && <span className="flex items-center gap-1 text-xs" style={{ color:"var(--text-muted)" }}><Hash size={9}/>{inv.caseRefNo}</span>}
                        {inv.ioName && <span className="flex items-center gap-1 text-xs" style={{ color:"var(--text-muted)" }}><User size={9}/>{inv.ioName}</span>}
                        {inv.policeStation && <span className="flex items-center gap-1 text-xs" style={{ color:"var(--text-muted)" }}><Building size={9}/>{inv.policeStation}</span>}
                      </div>
                    )}
                  </div>
                </div>

                {/* Badges row */}
                <div className="px-4 py-2.5 flex items-center gap-2 flex-wrap" style={{ borderBottom:"1px solid var(--border-inner)" }}>
                  <RiskBadge risk={inv.risk}/>
                  <span
                    className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium"
                    style={{ background: (statusColor[inv.status] || "#94a3b8") + "18", color: statusColor[inv.status] || "#94a3b8", border:`1px solid ${(statusColor[inv.status] || "#94a3b8")}40` }}
                  >
                    {inv.status || "—"}
                  </span>
                  <span className="ml-auto text-xs" style={{ color:"var(--text-muted)", fontFamily:"monospace" }}>{inv.date}</span>
                </div>

                {/* Tags row */}
                {caseTags.length > 0 && (
                  <div className="px-4 py-2 flex flex-wrap gap-1.5" style={{ borderBottom:"1px solid var(--border-inner)" }}>
                    {caseTags.map((tag, i) => (
                      <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs" style={{ background:"rgba(124,58,237,0.08)", color:"#7c3aed", border:"1px solid rgba(124,58,237,0.2)" }}>
                        <Tag size={9}/>{tag}
                      </span>
                    ))}
                  </div>
                )}

                {/* Details row */}
                <div className="px-4 py-2.5 grid grid-cols-4 gap-2 text-center" style={{ borderBottom:"1px solid var(--border-inner)" }}>
                  {[
                    { label:"Platforms", value: (inv.platforms||[]).length || "—" },
                    { label:"Confidence", value: inv.stats?.confidence != null ? inv.stats.confidence + "%" : "—" },
                    { label:"Files", value: caseAttachments.length },
                    { label:"Linked", value: linkedIds.length || "—" },
                  ].map(({ label, value }) => (
                    <div key={label}>
                      <div className="text-xs font-bold" style={{ color:"var(--text-primary)", fontFamily:"monospace" }}>{value}</div>
                      <div style={{ fontSize:9, color:"var(--text-muted)", textTransform:"uppercase", letterSpacing:"0.05em" }}>{label}</div>
                    </div>
                  ))}
                </div>

                {/* Edit form (inline) */}
                {isEditing && (
                  <div className="px-4 py-3 space-y-2.5" style={{ background:"var(--bg-input)", borderBottom:"1px solid var(--border-inner)" }}>
                    <div className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color:"var(--text-muted)" }}>Edit Case</div>
                    <div>
                      <label className="block text-xs mb-1" style={{ color:"var(--text-muted)" }}>Target</label>
                      <input
                        value={editForm.target}
                        onChange={e => setEditForm(f => ({ ...f, target: e.target.value }))}
                        className="w-full rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-200"
                        style={{ background:"var(--bg-card)", border:"1px solid var(--border)", color:"var(--text-primary)" }}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-xs mb-1" style={{ color:"var(--text-muted)" }}>FIR / Case Ref No.</label>
                        <input
                          value={editForm.caseRefNo}
                          onChange={e => setEditForm(f => ({ ...f, caseRefNo: e.target.value }))}
                          placeholder="e.g. CR-114/2026"
                          className="w-full rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-200"
                          style={{ background:"var(--bg-card)", border:"1px solid var(--border)", color:"var(--text-primary)" }}
                        />
                      </div>
                      <div>
                        <label className="block text-xs mb-1" style={{ color:"var(--text-muted)" }}>Investigating Officer</label>
                        <input
                          value={editForm.ioName}
                          onChange={e => setEditForm(f => ({ ...f, ioName: e.target.value }))}
                          placeholder="IO name"
                          className="w-full rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-200"
                          style={{ background:"var(--bg-card)", border:"1px solid var(--border)", color:"var(--text-primary)" }}
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-xs mb-1" style={{ color:"var(--text-muted)" }}>Police Station / Jurisdiction</label>
                        <input
                          value={editForm.policeStation}
                          onChange={e => setEditForm(f => ({ ...f, policeStation: e.target.value }))}
                          placeholder="e.g. CID Cyber Crime, Bengaluru"
                          className="w-full rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-200"
                          style={{ background:"var(--bg-card)", border:"1px solid var(--border)", color:"var(--text-primary)" }}
                        />
                      </div>
                      <div>
                        <label className="block text-xs mb-1" style={{ color:"var(--text-muted)" }}>Tags (comma separated)</label>
                        <input
                          value={editForm.tags}
                          onChange={e => setEditForm(f => ({ ...f, tags: e.target.value }))}
                          placeholder="cyber-fraud, phishing"
                          className="w-full rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-200"
                          style={{ background:"var(--bg-card)", border:"1px solid var(--border)", color:"var(--text-primary)" }}
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-xs mb-1" style={{ color:"var(--text-muted)" }}>Risk</label>
                        <select
                          value={editForm.risk}
                          onChange={e => setEditForm(f => ({ ...f, risk: e.target.value }))}
                          className="w-full rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-200"
                          style={{ background:"var(--bg-card)", border:"1px solid var(--border)", color:"var(--text-primary)" }}
                        >
                          {["critical","high","medium","low"].map(r => <option key={r} value={r}>{r.charAt(0).toUpperCase()+r.slice(1)}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs mb-1" style={{ color:"var(--text-muted)" }}>Status</label>
                        <select
                          value={editForm.status}
                          onChange={e => setEditForm(f => ({ ...f, status: e.target.value }))}
                          className="w-full rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-200"
                          style={{ background:"var(--bg-card)", border:"1px solid var(--border)", color:"var(--text-primary)" }}
                        >
                          {["Active","Analysis","Collection","Completed"].map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs mb-1" style={{ color:"var(--text-muted)" }}>Notes</label>
                      <textarea
                        value={editForm.notes}
                        onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))}
                        rows={2}
                        className="w-full rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-200 resize-none"
                        style={{ background:"var(--bg-card)", border:"1px solid var(--border)", color:"var(--text-primary)" }}
                        placeholder="Case notes…"
                      />
                    </div>
                    {editMsg && <p className="text-xs" style={{ color: editMsg.startsWith("✓") ? "#16a34a" : "#ef4444" }}>{editMsg}</p>}
                    <div className="flex gap-2">
                      <button
                        onClick={() => saveEdit(inv)}
                        disabled={savingEdit}
                        className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-xs font-medium transition-colors"
                      >
                        {savingEdit ? <Loader2 size={11} className="animate-spin"/> : <CheckCircle2 size={11}/>}
                        {savingEdit ? "Saving…" : "Save"}
                      </button>
                      <button
                        onClick={() => { setEditingId(null); setEditMsg(""); }}
                        className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                        style={{ background:"var(--bg-card)", border:"1px solid var(--border)", color:"var(--text-sec)" }}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                {/* Attachment panel */}
                {isAttaching && (
                  <div style={{ background:"var(--bg-input)", borderBottom:"1px solid var(--border-inner)" }}>
                    <button
                      onClick={() => setAttachTarget(null)}
                      className="w-full px-4 pt-3 pb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide transition-colors"
                      style={{ color:"var(--text-muted)" }}
                    >
                      <Upload size={11} className="text-sky-500"/>
                      Attachments{caseAttachments.length > 0 ? ` (${caseAttachments.length})` : ""}
                      <ChevronDown size={11} style={{ marginLeft:"auto", transform:"rotate(180deg)", transition:"transform 0.15s" }}/>
                    </button>
                    <div className="px-4 pb-3 space-y-2.5">
                    {/* Existing attachments */}
                    {caseAttachments.length > 0 && (
                      <div className="space-y-1.5 mb-2">
                        {caseAttachments.map(att => (
                          <div key={att.id} className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg" style={{ background:"var(--bg-card)", border:"1px solid var(--border)" }}>
                            {att.source === "cloudinary" ? <Upload size={11} className="text-emerald-500 flex-shrink-0"/> : <FileText size={11} className="text-blue-500 flex-shrink-0"/>}
                            {att.url ? (
                              <a href={att.url} target="_blank" rel="noopener noreferrer" className="flex-1 text-xs truncate text-blue-600 hover:underline">{att.name}</a>
                            ) : (
                              <span className="flex-1 text-xs truncate" style={{ color:"var(--text-sec)" }}>{att.name}</span>
                            )}
                            {att.bytes ? <span style={{ fontSize:10, color:"var(--text-muted)" }}>{(att.bytes/1024).toFixed(0)} KB</span> : null}
                            <button onClick={() => removeAttachment(inv.id, att.id)} className="text-red-400 hover:text-red-600 flex-shrink-0">
                              <XIcon size={11}/>
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Upload evidence file → Cloudinary */}
                    <div className="p-2.5 rounded-lg" style={{ background:"var(--bg-card)", border:"1px dashed var(--border)" }}>
                      <div className="flex items-center gap-1.5 text-xs font-medium mb-1.5" style={{ color:"var(--text-primary)" }}>
                        <Upload size={11} className="text-emerald-500"/>Upload evidence file
                      </div>
                      <input
                        ref={fileInputRef}
                        type="file"
                        onChange={e => handleFileUpload(inv.id, e.target.files?.[0])}
                        disabled={uploadingFile}
                        className="w-full text-xs"
                        style={{ color:"var(--text-sec)" }}
                      />
                      {uploadingFile && (
                        <div className="mt-2">
                          <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ background:"var(--border)" }}>
                            <div className="h-full bg-emerald-500 transition-all" style={{ width:`${uploadProgress}%` }}/>
                          </div>
                          <p className="text-xs mt-1" style={{ color:"var(--text-muted)" }}>Uploading… {uploadProgress}%</p>
                        </div>
                      )}
                      {!uploadingFile && uploadError && (
                        <p className="text-xs mt-1.5" style={{ color:"#ef4444" }}>⚠️ {uploadError}</p>
                      )}
                      <p className="text-xs mt-1.5" style={{ color:"var(--text-muted)" }}>Images, PDFs, and documents up to 25 MB — uploaded to Cloudinary and linked to this case record.</p>
                    </div>

                    <div className="flex items-center gap-2 my-1">
                      <div className="flex-1 h-px" style={{ background:"var(--border)" }}/>
                      <span className="text-xs" style={{ color:"var(--text-muted)" }}>or paste a link</span>
                      <div className="flex-1 h-px" style={{ background:"var(--border)" }}/>
                    </div>

                    {/* Add new attachment manually (external link) */}
                    <div>
                      <input
                        value={attachName}
                        onChange={e => setAttachName(e.target.value)}
                        placeholder="Attachment name / label"
                        className="w-full rounded-lg px-2.5 py-1.5 text-xs mb-1.5 focus:outline-none focus:ring-2 focus:ring-blue-200"
                        style={{ background:"var(--bg-card)", border:"1px solid var(--border)", color:"var(--text-primary)" }}
                      />
                      <input
                        value={attachUrl}
                        onChange={e => setAttachUrl(e.target.value)}
                        placeholder="URL (optional)"
                        className="w-full rounded-lg px-2.5 py-1.5 text-xs mb-2 focus:outline-none focus:ring-2 focus:ring-blue-200"
                        style={{ background:"var(--bg-card)", border:"1px solid var(--border)", color:"var(--text-primary)" }}
                      />
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={addAttachment}
                        disabled={!attachName.trim() && !attachUrl.trim()}
                        className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white text-xs font-medium transition-colors"
                      >
                        <Plus size={11}/>Add Link
                      </button>
                      <button
                        onClick={() => { setAttachTarget(null); setAttachName(""); setAttachUrl(""); setUploadError(""); }}
                        className="px-3 py-1.5 rounded-lg text-xs font-medium"
                        style={{ background:"var(--bg-card)", border:"1px solid var(--border)", color:"var(--text-sec)" }}
                      >
                        Done
                      </button>
                    </div>
                    </div>
                  </div>
                )}

                {/* Attachment chips (visible when not in attach mode) */}
                {!isAttaching && caseAttachments.length > 0 && (
                  <div className="px-4 py-2 flex flex-wrap gap-1.5" style={{ borderBottom:"1px solid var(--border-inner)" }}>
                    {caseAttachments.slice(0,3).map(att => (
                      <a
                        key={att.id}
                        href={att.url || undefined}
                        target={att.url ? "_blank" : undefined}
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs"
                        style={{ background:"rgba(79,70,229,0.1)", color:"#4f46e5", border:"1px solid rgba(79,70,229,0.2)", textDecoration:"none" }}
                        title={att.name}
                      >
                        <FileText size={9}/>
                        <span className="max-w-[80px] truncate">{att.name}</span>
                      </a>
                    ))}
                    {caseAttachments.length > 3 && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs" style={{ background:"var(--bg-input)", color:"var(--text-muted)" }}>
                        +{caseAttachments.length - 3}
                      </span>
                    )}
                  </div>
                )}

                {/* Link panel (connect to another related/duplicate case) */}
                {isLinking && (
                  <div className="px-4 py-3 space-y-2.5" style={{ background:"var(--bg-input)", borderBottom:"1px solid var(--border-inner)" }}>
                    <div className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color:"var(--text-muted)" }}>Linked / Connected Cases</div>
                    {linkedIds.length > 0 && (
                      <div className="space-y-1.5 mb-2">
                        {linkedIds.map(lid => {
                          const lcase = liveItems.find(i => i.id === lid);
                          return (
                            <div key={lid} className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg" style={{ background:"var(--bg-card)", border:"1px solid var(--border)" }}>
                              <LinkIcon size={11} className="text-cyan-500 flex-shrink-0"/>
                              <span className="flex-1 text-xs truncate" style={{ color:"var(--text-sec)", fontFamily:"monospace" }}>{lid}{lcase ? ` — ${lcase.target}` : " (not found)"}</span>
                              <button onClick={() => unlinkCases(inv.id, lid)} className="text-red-400 hover:text-red-600 flex-shrink-0" title="Unlink">
                                <XIcon size={11}/>
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                    <div className="flex gap-2">
                      <select
                        value={linkPick}
                        onChange={e => setLinkPick(e.target.value)}
                        className="flex-1 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-200"
                        style={{ background:"var(--bg-card)", border:"1px solid var(--border)", color:"var(--text-primary)" }}
                      >
                        <option value="">Select a case to connect…</option>
                        {liveItems.filter(o => o.id !== inv.id && !linkedIds.includes(o.id)).map(o => (
                          <option key={o.id} value={o.id}>{o.id} — {o.target}</option>
                        ))}
                      </select>
                      <button
                        onClick={async () => { if (linkPick) { await linkCasesTogether(inv.id, linkPick); setLinkPick(""); } }}
                        disabled={!linkPick}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-700 disabled:opacity-40 text-white text-xs font-medium transition-colors"
                      >
                        <LinkIcon size={11}/>Link
                      </button>
                    </div>
                    <button onClick={() => { setLinkTarget(null); setLinkPick(""); }} className="w-full px-3 py-1.5 rounded-lg text-xs font-medium" style={{ background:"var(--bg-card)", border:"1px solid var(--border)", color:"var(--text-sec)" }}>
                      Done
                    </button>
                  </div>
                )}

                {/* Linked-case chips (when not in link mode) — click to jump/filter */}
                {!isLinking && linkedIds.length > 0 && (
                  <div className="px-4 py-2 flex flex-wrap gap-1.5" style={{ borderBottom:"1px solid var(--border-inner)" }}>
                    {linkedIds.slice(0,3).map(lid => (
                      <button
                        key={lid}
                        onClick={() => setSearchQ(lid)}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs"
                        style={{ background:"rgba(8,145,178,0.1)", color:"#0891b2", border:"1px solid rgba(8,145,178,0.2)" }}
                        title={`Jump to ${lid}`}
                      >
                        <LinkIcon size={9}/>
                        <span className="max-w-[80px] truncate" style={{ fontFamily:"monospace" }}>{lid}</span>
                      </button>
                    ))}
                    {linkedIds.length > 3 && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs" style={{ background:"var(--bg-input)", color:"var(--text-muted)" }}>
                        +{linkedIds.length - 3}
                      </span>
                    )}
                  </div>
                )}

                {/* Notes (if set and not editing) */}
                {!isEditing && inv.notes && (
                  <div className="px-4 py-2" style={{ borderBottom:"1px solid var(--border-inner)" }}>
                    <p className="text-xs leading-relaxed whitespace-pre-line" style={{ color:"var(--text-muted)", fontStyle:"italic" }}>{inv.notes.slice(0,140)}{inv.notes.length > 140 ? "…" : ""}</p>
                  </div>
                )}

                {/* Activity log / chain of custody */}
                <div style={{ borderBottom:"1px solid var(--border-inner)" }}>
                  <button
                    onClick={() => setAuditOpenId(isAuditOpen ? null : inv.id)}
                    className="w-full px-4 py-2 flex items-center gap-1.5 text-xs transition-colors"
                    style={{ color:"var(--text-muted)" }}
                  >
                    <Clock size={11}/>Activity log{caseLog.length > 0 ? ` (${caseLog.length})` : ""}
                    <ChevronDown size={11} style={{ marginLeft:"auto", transform: isAuditOpen ? "rotate(180deg)" : "none", transition:"transform 0.15s" }}/>
                  </button>
                  {isAuditOpen && (
                    <div className="px-4 pb-3 space-y-1.5">
                      {caseLog.length === 0 ? (
                        <p className="text-xs" style={{ color:"var(--text-muted)" }}>No activity recorded yet.</p>
                      ) : (
                        [...caseLog].slice(-6).reverse().map((entry, i) => (
                          <div key={i} className="text-xs px-2.5 py-1.5 rounded-lg" style={{ background:"var(--bg-input)" }}>
                            <div className="flex items-center justify-between">
                              <span className="font-medium" style={{ color:"var(--text-primary)" }}>{entry.action}</span>
                              <span style={{ color:"var(--text-muted)", fontFamily:"monospace", fontSize:10 }}>{new Date(entry.time).toLocaleString()}</span>
                            </div>
                            {entry.detail && <div style={{ color:"var(--text-muted)" }}>{entry.detail}</div>}
                            <div style={{ color:"var(--text-muted)", fontSize:10 }}>by {entry.by}</div>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>

                {/* Action buttons */}
                <div className="px-4 pt-3 flex items-center gap-2">
                  <button
                    onClick={() => inv.fullInvestigation && onSelectInvestigation(inv.fullInvestigation)}
                    className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-xs font-medium transition-colors"
                    style={{ background:"rgba(37,99,235,0.1)", color:"#2563eb", border:"1px solid rgba(37,99,235,0.2)" }}
                    title="Open case"
                  >
                    <Eye size={11}/>Open
                  </button>
                  <button
                    onClick={() => isEditing ? (setEditingId(null)) : startEdit(inv)}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors"
                    style={{ background: isEditing ? "rgba(234,179,8,0.1)" : "rgba(79,70,229,0.1)", color: isEditing ? "#92400e" : "#4f46e5", border:`1px solid ${isEditing ? "rgba(234,179,8,0.3)" : "rgba(79,70,229,0.2)"}` }}
                    title="Edit case"
                  >
                    <svg width={11} height={11} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                    {isEditing ? "Close" : "Edit"}
                  </button>
                  <button
                    onClick={() => isAttaching ? (setAttachTarget(null)) : setAttachTarget(inv.id)}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors"
                    style={{ background: isAttaching ? "rgba(14,165,233,0.15)" : "rgba(14,165,233,0.08)", color:"#0284c7", border:"1px solid rgba(14,165,233,0.2)" }}
                    title="Attachments"
                  >
                    <Upload size={11}/>
                    {caseAttachments.length > 0 ? caseAttachments.length : ""}
                  </button>
                </div>
                <div className="px-4 pt-2 pb-3 flex items-center gap-2">
                  <button
                    onClick={() => isLinking ? (setLinkTarget(null)) : setLinkTarget(inv.id)}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors"
                    style={{ background: isLinking ? "rgba(8,145,178,0.15)" : "rgba(8,145,178,0.08)", color:"#0891b2", border:"1px solid rgba(8,145,178,0.2)" }}
                    title="Link to another case"
                  >
                    <LinkIcon size={11}/>Link{linkedIds.length > 0 ? ` (${linkedIds.length})` : ""}
                  </button>
                  <button
                    onClick={() => exportDossier(inv)}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors"
                    style={{ background:"rgba(71,85,105,0.08)", color:"var(--text-sec)", border:"1px solid var(--border)" }}
                    title="Export case dossier (JSON)"
                  >
                    <Download size={11}/>Export
                  </button>
                  <span className="flex-1"/>
                  {deleteConfirm === inv.id ? (
                    <button
                      onClick={() => doDelete(inv.id)}
                      disabled={deletingId === inv.id}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-red-600 hover:bg-red-700 text-white transition-colors disabled:opacity-60"
                    >
                      {deletingId === inv.id ? <Loader2 size={11} className="animate-spin"/> : <Trash2 size={11}/>}
                    </button>
                  ) : (
                    <button
                      onClick={() => setDeleteConfirm(inv.id)}
                      className="flex items-center px-2.5 py-1.5 rounded-lg text-xs transition-colors"
                      style={{ color:"#ef4444", border:"1px solid rgba(239,68,68,0.2)", background:"rgba(239,68,68,0.06)" }}
                      title="Delete case"
                    >
                      <Trash2 size={11}/>
                    </button>
                  )}
                </div>
                {deleteConfirm === inv.id && (
                  <div className="px-4 pb-3 flex items-center justify-between gap-2">
                    <span className="text-xs text-red-500">Delete this case? This cannot be undone.</span>
                    <button onClick={() => setDeleteConfirm(null)} className="text-xs text-slate-400 hover:text-slate-600">Cancel</button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Root App ──
// ── Access Control Page (SOCMINT core feature #1 — authorised access) ──
function AccessControlPage({ setActivePage, investigation, user, onSelectInvestigation }) {
  const [grants, setGrants] = useState([]);
  const [grantsLoading, setGrantsLoading] = useState(false);
  const [grantsError, setGrantsError] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("viewer");
  const [submitting, setSubmitting] = useState(false);
  const [formMsg, setFormMsg] = useState("");
  const [shared, setShared] = useState([]);
  const [sharedLoading, setSharedLoading] = useState(true);
  const [sharedError, setSharedError] = useState("");
  const [invites, setInvites] = useState([]);
  const [invitesLoading, setInvitesLoading] = useState(true);
  const [invitesError, setInvitesError] = useState("");
  const [respondingId, setRespondingId] = useState("");

  const loadGrants = () => {
    if (!investigation?.id || !user) return;
    setGrantsLoading(true);
    setGrantsError("");
    listCaseAccess(user, investigation.id)
      .then(setGrants)
      .catch((e) => setGrantsError(e.message || "Failed to load access list."))
      .finally(() => setGrantsLoading(false));
  };

  const loadSharedAndInvites = () => {
    if (!user) return;
    setSharedLoading(true);
    fetchSharedWithMe(user)
      .then(setShared)
      .catch((e) => setSharedError(e.message || "Failed to load shared cases."))
      .finally(() => setSharedLoading(false));
    setInvitesLoading(true);
    fetchPendingInvites(user)
      .then(setInvites)
      .catch((e) => setInvitesError(e.message || "Failed to load pending invites."))
      .finally(() => setInvitesLoading(false));
  };

  useEffect(() => { loadGrants(); /* eslint-disable-next-line */ }, [investigation?.id, user]);
  useEffect(() => { loadSharedAndInvites(); /* eslint-disable-next-line */ }, [user]);

  const isOwner = investigation && investigation.ownerId ? investigation.ownerId === user?.uid : true;

  const handleGrant = async (e) => {
    e.preventDefault();
    setFormMsg("");
    setSubmitting(true);
    try {
      await grantCaseAccess(user, investigation.id, email, role);
      setFormMsg(`✓ Invite sent to ${email.trim().toLowerCase()} (${role}). It stays inactive until they accept it.`);
      setEmail("");
      loadGrants();
    } catch (err) {
      setFormMsg(`⚠️ ${err.message || "Failed to grant access."}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleRevoke = async (grantId) => {
    try {
      await revokeCaseAccess(user, grantId);
      setGrants((g) => g.filter((x) => x.id !== grantId));
    } catch (err) {
      setGrantsError(err.message || "Failed to revoke access.");
    }
  };

  const handleAccept = async (grantId) => {
    setRespondingId(grantId);
    try {
      await acceptCaseInvite(user, grantId);
      setInvites((g) => g.filter((x) => x.id !== grantId));
      loadSharedAndInvites();
    } catch (err) {
      setInvitesError(err.message || "Failed to accept invite.");
    } finally {
      setRespondingId("");
    }
  };

  const handleDecline = async (grantId) => {
    setRespondingId(grantId);
    try {
      await declineCaseInvite(user, grantId);
      setInvites((g) => g.filter((x) => x.id !== grantId));
    } catch (err) {
      setInvitesError(err.message || "Failed to decline invite.");
    } finally {
      setRespondingId("");
    }
  };

  return <div className="p-4 md:p-6 space-y-5">
    {/* Pending invites addressed to me — require explicit accept before any case data is visible */}
    {(invitesLoading || invites.length > 0 || invitesError) && (
      <div className="rounded-xl p-5" style={{ ...V.card, border:"1px solid rgba(234,179,8,0.4)" }}>
        <h4 className="font-semibold text-sm flex items-center gap-1.5 mb-1" style={{ color:"var(--text-primary)" }}><Mail size={14} className="text-amber-500"/>Pending Invites
          {invites.length > 0 && <span className="px-1.5 py-0.5 rounded-full text-white" style={{ background:"#eab308", fontSize:10 }}>{invites.length}</span>}
        </h4>
        <p className="text-slate-400 text-xs mb-3">Someone shared a case with you. You won't see any details until you accept — this stops typos or stale invites from quietly exposing case data.</p>
        {invitesError && <p className="text-xs text-red-500 mb-2">{invitesError}</p>}
        {invitesLoading ? <p className="text-slate-400 text-xs py-3">Loading…</p> :
        invites.length === 0 ? null :
        <div className="space-y-2">
          {invites.map((inv) => <div key={inv.id} className="flex items-center justify-between px-3 py-2.5 rounded-lg" style={{ background:"rgba(234,179,8,0.08)" }}>
            <div className="min-w-0">
              <div className="text-xs font-medium" style={{ color:"var(--text-primary)" }}>Case <span style={{ fontFamily:"monospace" }}>{inv.case_id}</span></div>
              <div className="text-slate-400" style={{ fontSize:10 }}>Invited as <span className="capitalize font-medium">{inv.role}</span> · details hidden until accepted</div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <button onClick={()=>handleDecline(inv.id)} disabled={respondingId===inv.id} className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-500 hover:bg-slate-100 disabled:opacity-50 transition-colors">Decline</button>
              <button onClick={()=>handleAccept(inv.id)} disabled={respondingId===inv.id} className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 disabled:opacity-60 text-white text-xs font-medium transition-colors"><Check size={12}/>{respondingId===inv.id?"…":"Accept"}</button>
            </div>
          </div>)}
        </div>}
      </div>
    )}

    {/* Case sharing panel */}
    <div className="rounded-xl p-5" style={V.card}>
      <div className="flex items-center justify-between flex-wrap gap-2 mb-1">
        <h3 className="font-semibold text-sm flex items-center gap-1.5" style={{ color:"var(--text-primary)" }}><Lock size={14} className="text-blue-500"/>Case Access Control</h3>
        {investigation && <span className="text-xs text-slate-400" style={{ fontFamily:"monospace" }}>{investigation.id}</span>}
      </div>

      {!investigation ? (
        <div className="flex flex-col items-center text-center py-10">
          <Lock size={26} className="text-slate-300 mb-3"/>
          <p className="text-slate-400 text-xs max-w-sm mb-4">Open or run an investigation first — then come back here to control who else can view or edit that case.</p>
          <button onClick={()=>setActivePage("osint")} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium transition-colors"><Search size={13}/>Go to OSINT Search</button>
        </div>
      ) : !isOwner ? (
        <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg mt-3" style={{ background:"var(--bg-input)" }}>
          <Info size={14} className="text-amber-500 flex-shrink-0"/>
          <p className="text-xs" style={{ color:"var(--text-sec)" }}>This case was shared with you — only the case owner can manage access.</p>
        </div>
      ) : (
        <Fragment>
          <p className="text-slate-400 text-xs mt-0.5 mb-4">Invite other investigators to <span className="font-medium" style={{ color:"var(--text-primary)" }}>{investigation.target}</span> by email. An invite stays <span className="font-medium">pending</span> — and the case stays hidden from them — until they accept it themselves. Viewers can only read the case; editors can also update it.</p>

          <form onSubmit={handleGrant} className="flex flex-col sm:flex-row gap-2 mb-4">
            <div className="relative flex-1">
              <Mail size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/>
              <input type="email" required value={email} onChange={(e)=>setEmail(e.target.value)} placeholder="investigator@example.com" className="w-full rounded-lg pl-9 pr-3 py-2.5 text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-200" style={{ background:"var(--bg-input)", border:"1px solid var(--border)", color:"var(--text-primary)" }}/>
            </div>
            <select value={role} onChange={(e)=>setRole(e.target.value)} className="rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200" style={{ background:"var(--bg-input)", border:"1px solid var(--border)", color:"var(--text-primary)" }}>
              <option value="viewer">Viewer (read-only)</option>
              <option value="editor">Editor (can update)</option>
            </select>
            <button type="submit" disabled={submitting} className="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-medium transition-colors whitespace-nowrap"><Plus size={14}/>{submitting?"Sending…":"Send Invite"}</button>
          </form>
          {formMsg && <p className="text-xs mb-4" style={{ color: formMsg.startsWith("✓") ? "#16a34a" : "#dc2626" }}>{formMsg}</p>}

          <h4 className="font-semibold text-xs uppercase tracking-wide mb-2" style={{ color:"var(--text-primary)" }}>Authorised Investigators</h4>
          {grantsError && <p className="text-xs text-red-500 mb-2">{grantsError}</p>}
          {grantsLoading ? <p className="text-slate-400 text-xs py-4">Loading…</p> :
          grants.length===0 ? <p className="text-slate-400 text-xs py-4 text-center rounded-lg" style={{ background:"var(--bg-input)" }}>Only you have access to this case right now.</p> :
          <div className="space-y-2">
            {grants.map((g) => <div key={g.id} className="flex items-center justify-between px-3 py-2.5 rounded-lg" style={{ background:"var(--bg-input)" }}>
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-white" style={{ background: g.status==="accepted" ? "linear-gradient(135deg,#3b82f6,#4f46e5)" : "linear-gradient(135deg,#cbd5e1,#94a3b8)", fontSize:10, fontWeight:700 }}>{g.grantee_email.slice(0,2).toUpperCase()}</div>
                <span className="text-xs truncate" style={{ color:"var(--text-primary)" }}>{g.grantee_email}</span>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className="px-2 py-0.5 rounded-full text-xs font-medium" style={{ background: g.status==="accepted" ? "rgba(34,197,94,0.12)" : "rgba(234,179,8,0.15)", color: g.status==="accepted" ? "#16a34a" : "#92400e" }}>{g.status==="accepted" ? "Active" : "Pending"}</span>
                <span className="px-2 py-0.5 rounded-full text-xs font-medium capitalize" style={{ background: g.role==="editor" ? "rgba(37,99,235,0.12)" : "rgba(100,116,139,0.12)", color: g.role==="editor" ? "#1d4ed8" : "#475569" }}>{g.role}</span>
                <button onClick={()=>handleRevoke(g.id)} title="Revoke access" className="p-1.5 rounded-lg text-red-400 hover:text-red-600 hover:bg-red-50 transition-colors"><Trash2 size={13}/></button>
              </div>
            </div>)}
          </div>}
        </Fragment>
      )}
    </div>

    {/* Cases shared with me (accepted only) */}
    <div className="rounded-xl p-5" style={V.card}>
      <h4 className="font-semibold text-sm flex items-center gap-1.5 mb-3" style={{ color:"var(--text-primary)" }}><Users size={14} className="text-indigo-500"/>Shared With Me</h4>
      {sharedError && <p className="text-xs text-red-500 mb-2">{sharedError}</p>}
      {sharedLoading ? <p className="text-slate-400 text-xs py-4">Loading…</p> :
      shared.length===0 ? <p className="text-slate-400 text-xs py-6 text-center rounded-lg" style={{ background:"var(--bg-input)" }}>No accepted shared cases yet — check Pending Invites above if someone shared one with you.</p> :
      <div className="space-y-2">
        {shared.map((inv) => <div key={inv.id} className="flex items-center justify-between px-3 py-2.5 rounded-lg" style={{ background:"var(--bg-input)" }}>
          <div className="min-w-0">
            <div className="text-xs font-medium truncate" style={{ color:"var(--text-primary)" }}>{inv.target}</div>
            <div className="text-slate-400" style={{ fontSize:10, fontFamily:"monospace" }}>{inv.id}</div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className="px-2 py-0.5 rounded-full text-xs font-medium capitalize" style={{ background: inv.sharedRole==="editor" ? "rgba(37,99,235,0.12)" : "rgba(100,116,139,0.12)", color: inv.sharedRole==="editor" ? "#1d4ed8" : "#475569" }}>{inv.sharedRole}</span>
            <button onClick={()=>onSelectInvestigation(inv.fullInvestigation || inv)} className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium transition-colors">Open<ChevronRight size={12}/></button>
          </div>
        </div>)}
      </div>}
    </div>
  </div>;
}

// ── Settings Page ──
function SettingsPage({ user, investigation, recentItems, recentLoaded, dark, setDark, onLogout }) {
  const displayName   = user?.fullName || user?.displayName || user?.email?.split("@")[0] || "Operative";
  const designation   = user?.designation || user?.role || "Analyst";
  const department    = user?.department || "";
  const badgeID       = user?.badgeID || "";
  const kgid          = user?.kgid || "";
  const cjsid         = user?.cjsid || "";
  const stationCode   = user?.stationCode || "";
  const postingDistrict = user?.postingDistrict || "";
  const dateOfJoining = user?.dateOfJoining || "";
  const jurisdiction  = user?.jurisdiction || "";
  const initials      = displayName.split(" ").map(w=>w[0]).join("").toUpperCase().slice(0,2) || "OP";
  const isVerified    = !!user?.verified;
  const accountStatus = (user?.status || "active").toLowerCase();

  // ── Derive authority-to-testify from designation ──
  const seniorRoles   = ["senior_analyst","team_lead","investigator","admin","SP","DSP","CI","SI","PSI","ACP","DCP","commissioner"];
  const canTestify    = seniorRoles.some(r => (designation||"").toLowerCase().includes(r.toLowerCase())) || isVerified;
  const authorityLabel = canTestify ? "Authorised to Submit Evidence" : "Pending Authorisation";

  const liveItems       = recentLoaded ? recentItems.map(normalizeRecentInvestigation) : [];
  const totalCases      = liveItems.length;
  const highRiskCases   = liveItems.filter(i => ["critical","high"].includes((i.risk||"").toLowerCase())).length;
  const platformsScanned = new Set(liveItems.flatMap(i => i.platforms || [])).size;

  const profileFields = [
    { label:"Email",            value: user?.email || "Not set",      icon:Mail     },
    { label:"Phone",            value: user?.phone || "Not set",      icon:Phone    },
    { label:"Badge / Emp. ID",  value: badgeID || "Not assigned",     icon:FileText },
    { label:"Department / Unit",value: department || "Not set",       icon:Flag     },
    { label:"KGID",             value: kgid || "Not assigned",        icon:CreditCard },
    { label:"CJSID",            value: cjsid || "Not assigned",       icon:Key      },
  ];

  const officialFields = [
    { label:"Station / Unit Code",   value: stationCode || "Not set",      icon:Building  },
    { label:"Posting District",      value: postingDistrict || "Not set",  icon:MapPin    },
    { label:"Jurisdiction",          value: jurisdiction || "Not set",     icon:Globe     },
    { label:"Date of Joining",       value: dateOfJoining || "Not set",    icon:Calendar  },
  ];

  const statCards = [
    { label:"Total Cases Investigated", value: recentLoaded ? String(totalCases) : null,   icon:Target,        color:"blue"  },
    { label:"Active Case",              value: investigation?.id || "None",                icon:Activity,      color: investigation ? "green" : "slate" },
    { label:"High Risk Cases Handled",  value: recentLoaded ? String(highRiskCases) : null, icon:AlertTriangle, color:"red"   },
    { label:"Platforms Scanned",        value: recentLoaded ? String(platformsScanned) : null, icon:Globe,      color:"cyan"  },
  ];

  const colorMap = {
    blue:  { bg:"bg-blue-50",   icon:"text-blue-600",   ring:"ring-blue-100"   },
    green: { bg:"bg-green-50",  icon:"text-green-600",  ring:"ring-green-100"  },
    red:   { bg:"bg-red-50",    icon:"text-red-600",    ring:"ring-red-100"    },
    cyan:  { bg:"bg-cyan-50",   icon:"text-cyan-600",   ring:"ring-cyan-100"   },
    slate: { bg:"bg-slate-100", icon:"text-slate-500",  ring:"ring-slate-200"  },
  };

  // ── Court credential badge helper ──
  function CourtBadge({ ok, label }) {
    return (
      <span className={cn("inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ring-1",
        ok ? "bg-green-50 text-green-700 ring-green-200" : "bg-amber-50 text-amber-700 ring-amber-200")}>
        {ok ? <CheckCircle2 size={11}/> : <AlertCircle size={11}/>}
        {label}
      </span>
    );
  }

  return <div className="p-4 md:p-6 space-y-5">

    {/* ── Official header banner ── */}
    <div className="rounded-xl px-5 py-3 flex items-center gap-3" style={{ background:"linear-gradient(135deg,rgba(30,58,138,0.92),rgba(30,27,75,0.95))", border:"1px solid rgba(99,102,241,0.3)" }}>
      <div style={{ flexShrink:0, width:38, height:38, borderRadius:8, background:"rgba(255,255,255,0.08)", display:"flex", alignItems:"center", justifyContent:"center", border:"1px solid rgba(255,255,255,0.15)" }}>
        <Shield size={18} style={{ color:"#93c5fd" }}/>
      </div>
      <div className="min-w-0">
        <div className="font-bold text-sm" style={{ color:"#e0e7ff", letterSpacing:"0.02em" }}>CYBER INVESTIGATION DEPARTMENT — KARNATAKA</div>
        <div className="text-xs mt-0.5" style={{ color:"#93c5fd" }}>Government of Karnataka · Department of Electronics, IT, BT &amp; S&amp;T · Official Operator Profile</div>
      </div>
    </div>

    {/* ── Profile card ── */}
    <div className="rounded-xl p-5 md:p-6 shadow-sm" style={V.card}>
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        {user?.photoURL
          ? <img src={user.photoURL} referrerPolicy="no-referrer" alt={displayName} className="w-16 h-16 rounded-full object-cover flex-shrink-0" style={{ border:"2px solid rgba(99,102,241,0.4)" }}/>
          : <div className="w-16 h-16 rounded-full flex items-center justify-center flex-shrink-0" style={{ background:"linear-gradient(135deg,#3b82f6,#4f46e5)" }}><span className="text-white font-bold text-lg">{initials}</span></div>
        }
        <div className="min-w-0 flex-1">
          <h2 className="font-bold text-lg leading-tight" style={{ color:"var(--text-primary)" }}>{displayName}</h2>
          <p className="text-slate-500 text-sm mt-0.5">{designation}{department ? ` · ${department}` : ""}</p>
          <div className="flex items-center gap-2 mt-2.5 flex-wrap">
            <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ring-1", accountStatus==="active" ? "bg-green-50 text-green-700 ring-green-200" : "bg-slate-100 text-slate-600 ring-slate-200")}>
              <span className={cn("w-1.5 h-1.5 rounded-full", accountStatus==="active"?"bg-green-500":"bg-slate-400")}/>
              {accountStatus==="active" ? "Active" : "Inactive"}
            </span>
            <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ring-1", isVerified ? "bg-blue-50 text-blue-700 ring-blue-200" : "bg-amber-50 text-amber-700 ring-amber-200")}>
              {isVerified ? <CheckCircle2 size={11}/> : <AlertCircle size={11}/>}
              {isVerified ? "Verified" : "Pending Verification"}
            </span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ring-1 bg-indigo-50 text-indigo-700 ring-indigo-200">
              <Award size={11}/>
              {designation || "Operative"}
            </span>
          </div>
        </div>
      </div>
      {/* Profile fields: 2-col on mobile, 3-col on md */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-5 pt-5" style={{ borderTop:"1px solid var(--border-inner)" }}>
        {profileFields.map(f => <FieldCell key={f.label} icon={f.icon} label={f.label} value={f.value}/>)}
      </div>
    </div>

    {/* ── Official Posting Details ── */}
    <div className="rounded-xl p-5 shadow-sm" style={V.card}>
      <div className="flex items-center gap-2 mb-4">
        <Building size={14} style={{ color:"var(--text-muted)" }}/>
        <h3 className="font-semibold text-sm" style={{ color:"var(--text-primary)" }}>Official Posting Details</h3>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {officialFields.map(f => <FieldCell key={f.label} icon={f.icon} label={f.label} value={f.value}/>)}
      </div>
    </div>

    {/* ── Court Credentials ── */}
    <div className="rounded-xl p-5 shadow-sm" style={{ ...V.card, borderLeft:"3px solid #4f46e5" }}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <BookOpen size={14} style={{ color:"#4f46e5" }}/>
          <h3 className="font-semibold text-sm" style={{ color:"var(--text-primary)" }}>Court Credentials &amp; Authority</h3>
        </div>
        <span className="text-xs px-2 py-0.5 rounded font-semibold" style={{ background:"rgba(79,70,229,0.1)", color:"#4f46e5", border:"1px solid rgba(79,70,229,0.2)" }}>CID KARNATAKA</span>
      </div>

      {/* KGID + CJSID highlight row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
        <div className="rounded-lg px-4 py-3" style={{ background:"rgba(79,70,229,0.06)", border:"1px solid rgba(79,70,229,0.18)" }}>
          <div className="flex items-center gap-1.5 mb-1">
            <CreditCard size={11} style={{ color:"#4f46e5" }}/>
            <span className="text-xs font-semibold uppercase tracking-widest" style={{ color:"#4f46e5" }}>KGID</span>
            <span className="text-xs ml-1" style={{ color:"var(--text-muted)" }}>Karnataka Govt. ID</span>
          </div>
          <div className="font-bold text-sm" style={{ fontFamily:"monospace", color: kgid ? "var(--text-primary)" : "#94a3b8", fontStyle: kgid ? "normal" : "italic" }}>
            {kgid || "Not assigned"}
          </div>
        </div>
        <div className="rounded-lg px-4 py-3" style={{ background:"rgba(79,70,229,0.06)", border:"1px solid rgba(79,70,229,0.18)" }}>
          <div className="flex items-center gap-1.5 mb-1">
            <Key size={11} style={{ color:"#4f46e5" }}/>
            <span className="text-xs font-semibold uppercase tracking-widest" style={{ color:"#4f46e5" }}>CJSID</span>
            <span className="text-xs ml-1" style={{ color:"var(--text-muted)" }}>Criminal Justice System ID</span>
          </div>
          <div className="font-bold text-sm" style={{ fontFamily:"monospace", color: cjsid ? "var(--text-primary)" : "#94a3b8", fontStyle: cjsid ? "normal" : "italic" }}>
            {cjsid || "Not assigned"}
          </div>
        </div>
      </div>

      {/* Authority badges */}
      <div className="flex flex-wrap gap-2 mb-4">
        <CourtBadge ok={isVerified}   label={isVerified   ? "Identity Verified" : "Identity Pending"}/>
        <CourtBadge ok={canTestify}   label={authorityLabel}/>
        <CourtBadge ok={!!kgid}       label={kgid  ? "KGID Assigned" : "KGID Not Assigned"}/>
        <CourtBadge ok={!!cjsid}      label={cjsid ? "CJSID Assigned" : "CJSID Not Assigned"}/>
        <CourtBadge ok={accountStatus==="active"} label={accountStatus==="active" ? "Account Active" : "Account Inactive"}/>
      </div>

      {/* Disclaimer for court use */}
      <div className="rounded-lg px-4 py-3 text-xs leading-relaxed" style={{ background:"rgba(15,23,42,0.04)", border:"1px solid var(--border-inner)", color:"var(--text-sec)" }}>
        <span className="font-semibold" style={{ color:"var(--text-primary)" }}>📋 Court Submission Notice: </span>
        This profile record is generated from the Oxinap Cyber Intelligence Platform operated by the Cyber Investigation Department, Government of Karnataka. The KGID and CJSID identifiers uniquely link this operator to the Karnataka Government HR registry and the Criminal Justice System database respectively. All investigation records and digital evidence generated under this profile carry operator traceability through these credentials and are admissible as official records under the Information Technology Act, 2000 and the Indian Evidence Act.
      </div>
    </div>

    {/* ── Investigation stats ── */}
    <div>
      <h3 className="font-semibold text-sm mb-3 px-1" style={{ color:"var(--text-primary)" }}>Investigation Stats</h3>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map(({ label, value, icon:Ic, color }) => {
          const c = colorMap[color];
          return <div key={label} className="rounded-xl p-5 shadow-sm" style={V.card}>
            <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center ring-1 mb-3", c.bg, c.ring)}><Ic size={16} className={c.icon}/></div>
            {value === null ? (
              <div className="h-5 w-14 rounded animate-pulse mb-1.5" style={{ background:"var(--bg-input)" }}/>
            ) : (
              <div className="text-lg font-bold mb-0.5 truncate" style={{ fontFamily:"monospace", color:"var(--text-primary)" }} title={value}>{value}</div>
            )}
            <div className="text-xs font-medium" style={{ color:"var(--text-sec)" }}>{label}</div>
          </div>;
        })}
      </div>
    </div>

    {/* ── Preferences ── */}
    <div className="rounded-xl p-5 shadow-sm" style={V.card}>
      <h3 className="font-semibold text-sm mb-1" style={{ color:"var(--text-primary)" }}>Preferences</h3>
      <div className="flex items-center justify-between py-3" style={{ borderBottom:"1px solid var(--border-inner)" }}>
        <div className="min-w-0 pr-3">
          <div className="text-sm font-medium" style={{ color:"var(--text-primary)" }}>Theme</div>
          <div className="text-slate-400 text-xs mt-0.5">Toggle between light and dark interface</div>
        </div>
        <button onClick={()=>setDark(!dark)} className="flex-shrink-0" title={dark?"Switch to light mode":"Switch to dark mode"} style={{ display:"flex",alignItems:"center",justifyContent:"center",width:34,height:34,borderRadius:8,cursor:"pointer",border:"1px solid var(--border)",background:"var(--bg-input)",color:"var(--text-sec)" }}>
          {dark ? <Sun size={15}/> : <Moon size={15}/>}
        </button>
      </div>
      <div className="flex items-center justify-between py-3">
        <div className="min-w-0 pr-3">
          <div className="text-sm font-medium" style={{ color:"var(--text-primary)" }}>Language</div>
          <div className="text-slate-400 text-xs mt-0.5">Choose your interface language</div>
        </div>
        <div className="flex-shrink-0"><LanguageSwitcher/></div>
      </div>
    </div>

    {/* ── Account ── */}
    <div className="rounded-xl p-5 shadow-sm" style={V.card}>
      <h3 className="font-semibold text-sm mb-1" style={{ color:"var(--text-primary)" }}>Account</h3>
      <div className="flex items-center justify-between py-3">
        <div className="min-w-0 pr-3">
          <div className="text-sm font-medium" style={{ color:"var(--text-primary)" }}>Sign Out</div>
          <div className="text-slate-400 text-xs mt-0.5">End your session on this device</div>
        </div>
        <button onClick={onLogout} className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-red-600 hover:bg-red-50 transition-colors text-xs font-medium" style={{ border:"1px solid rgba(239,68,68,0.25)" }}>
          <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
          Sign Out
        </button>
      </div>
    </div>
  </div>;
}

export default function App({ user }) {
const handleLogout = async () => {
  try { await signOut(auth); } catch(e) { console.error("Logout error:", e); }
};
  
  const [activePage, setActivePage] = useState("dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [investigation, setInvestigation] = useState(null);
  const [recentInvestigationsFromStore, setRecentInvestigationsFromStore] = useState([]);
  const [recentInvestigationsLoaded, setRecentInvestigationsLoaded] = useState(false);
  const [recentInvestigationError, setRecentInvestigationError] = useState("");
  const [investigationLoading, setInvestigationLoading] = useState(false);
  const [investigationError, setInvestigationError] = useState("");
  const [savingId, setSavingId] = useState("");
  const [lastSavedId, setLastSavedId] = useState("");
  const handleStartInvestigation = async ({ target, type, redirectToOsint = true }) => {
    setInvestigationError("");
    setInvestigationLoading(true);
    setLastSavedId("");
    if (redirectToOsint) setActivePage("osint");
    try {
      // Apify actors (Twitter, LinkedIn, Instagram, Facebook) each take 60-90s.
      // 30s was firing before any actor finished — bumped to 4 minutes.
      const INVESTIGATION_TIMEOUT_MS = 4 * 60 * 1000;
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(
          () => reject(new Error("Investigation is taking longer than expected. Partial results may be available — try again if needed.")),
          INVESTIGATION_TIMEOUT_MS
        )
      );
      const result = await Promise.race([
        runPublicOsintInvestigation({ target, type }),
        timeoutPromise,
      ]);
      setInvestigation(result);
      setSavingId(result.id);
      // Save to Firestore asynchronously — don't block UI on save
      saveInvestigation(user, result)
        .then(() => {
          console.info("[CyIntel] Supabase save succeeded for case:", result.id);
          setSavingId("");
          setLastSavedId(result.id);
          // Don't rely solely on the Realtime channel — refresh the list directly
          // so the Dashboard updates immediately even if replication/Realtime
          // isn't enabled on the table.
          fetchRecentInvestigations(user)
            .then((items) => {
              setRecentInvestigationsFromStore(items);
              setRecentInvestigationsLoaded(true);
            })
            .catch((e) => console.error("[CyIntel] Manual refresh after save failed:", e));
        })
        .catch((saveErr) => {
          console.error("[CyIntel] Supabase save failed:", saveErr);
          setSavingId("");
          // Show a visible banner — error is displayed globally above <main>
          setInvestigationError(
            "Supabase save failed: " +
            (saveErr?.message || String(saveErr)) +
            " — check your Supabase RLS policy and Firebase auth state."
          );
        });
    } catch (error) {
      setInvestigationError(error.message || "Investigation failed.");
    } finally {
      setInvestigationLoading(false);
    }
  };
  const handleSelectInvestigation = (selectedInvestigation) => {
    setInvestigation(selectedInvestigation);
    setActivePage("osint");
  };
  const handleDeleteInvestigation = async (caseId) => {
    await deleteInvestigation(user, caseId);
    try {
      const items = await fetchRecentInvestigations(user);
      setRecentInvestigationsFromStore(items);
    } catch (e) {
      console.error("[CyIntel] Manual refresh after delete failed:", e);
    }
    if (investigation?.id === caseId) setInvestigation(null);
  };

  const prefersDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
  const [dark, setDark] = useState(prefersDark);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
  }, [dark]);

  useEffect(() => {
    setRecentInvestigationError("");
    setRecentInvestigationsLoaded(false);
    return subscribeRecentInvestigations(
      user,
      (items) => {
        setRecentInvestigationsFromStore(items);
        setRecentInvestigationsLoaded(true);
      },
      (error) => {
        setRecentInvestigationError(error.message || "Supabase listener failed.");
        setRecentInvestigationsLoaded(true);
      }
    );
  }, [user]);

  useEffect(() => {
    const handler = () => { if (window.innerWidth>=768) setSidebarOpen(false); };
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);

  const pages = {
    dashboard: <DashboardPage setActivePage={setActivePage} dark={dark} onStartInvestigation={handleStartInvestigation} onSelectInvestigation={handleSelectInvestigation} onDeleteInvestigation={handleDeleteInvestigation} investigation={investigation} investigationLoading={investigationLoading} investigationError={investigationError} recentItems={recentInvestigationsFromStore} recentError={recentInvestigationError} recentLoaded={recentInvestigationsLoaded} savingId={savingId} lastSavedId={lastSavedId} user={user}/>,
    "case-inventory": <CaseInventoryPage setActivePage={setActivePage} recentItems={recentInvestigationsFromStore} recentLoaded={recentInvestigationsLoaded} recentError={recentInvestigationError} onSelectInvestigation={handleSelectInvestigation} onDeleteInvestigation={handleDeleteInvestigation} user={user} onUpdateInvestigation={async (caseId, patch) => { await updateInvestigation(user, caseId, patch); const items = await fetchRecentInvestigations(user); setRecentInvestigationsFromStore(items); }}/>,
    osint: <OSINTPage setActivePage={setActivePage} dark={dark} investigation={investigation} investigationLoading={investigationLoading} investigationError={investigationError} onStartInvestigation={handleStartInvestigation} onPatchInvestigation={(patch) => setInvestigation(prev => prev ? { ...prev, ...patch } : prev)}/>,
    "ai-analysis": <AIAnalysisPage setActivePage={setActivePage} dark={dark} investigation={investigation}/>,
    "crypto-wallet": <CryptoWalletPage />,
    vehicle: <VehicleRCPage />,
    graph: <GraphPage setActivePage={setActivePage} dark={dark} investigation={investigation}/>,
    content: <ContentAnalysisPage setActivePage={setActivePage} investigation={investigation}/>,
    "image-analysis": <ImageAnalysisPage/>,
    access: <AccessControlPage setActivePage={setActivePage} investigation={investigation} user={user} onSelectInvestigation={handleSelectInvestigation}/>,
    report: <ReportPage dark={dark} investigation={investigation}/>,
    settings: <SettingsPage user={user} investigation={investigation} recentItems={recentInvestigationsFromStore} recentLoaded={recentInvestigationsLoaded} dark={dark} setDark={setDark} onLogout={handleLogout}/>,
  };

  return (
    <div style={{ display:"flex", height:"100dvh", width:"100vw", overflow:"hidden", background:"var(--bg-page)", fontFamily:"'Inter', system-ui, sans-serif" }}>
      <style>{`
        *, *::before, *::after { box-sizing: border-box; }
        :root {
          --bg-page: #f8fafc; --bg-card: #ffffff; --bg-sidebar: #0f172a; --bg-topnav: #ffffff;
          --bg-input: #f1f5f9; --bg-hover: #f8fafc; --bg-active: rgba(59,130,246,0.15);
          --border: #e2e8f0; --border-inner: #f1f5f9; --text-primary: #0f172a; --text-sec: #475569;
          --text-muted: #94a3b8; --sidebar-border: rgba(255,255,255,0.07);
          --sidebar-badge-bg: rgba(239,68,68,0.1); --sidebar-badge-border: rgba(239,68,68,0.2);
        }
        .dark {
          --bg-page: #0d1117; --bg-card: #161b22; --bg-sidebar: #0d1117; --bg-topnav: #161b22;
          --bg-input: #21262d; --bg-hover: #21262d; --bg-active: rgba(59,130,246,0.2);
          --border: #30363d; --border-inner: #21262d; --text-primary: #e6edf3; --text-sec: #8b949e;
          --text-muted: #6e7681; --sidebar-border: rgba(255,255,255,0.06);
          --sidebar-badge-bg: rgba(239,68,68,0.12); --sidebar-badge-border: rgba(239,68,68,0.25);
        }
        .dark .bg-white, .dark .bg-slate-50 { background: var(--bg-card) !important; }
        .dark .bg-slate-100 { background: var(--bg-hover) !important; }
        .dark .text-slate-800, .dark .text-slate-700 { color: var(--text-primary) !important; }
        .dark .text-slate-600, .dark .text-slate-500 { color: var(--text-sec) !important; }
        .dark .text-slate-400 { color: var(--text-muted) !important; }
        .dark input, .dark textarea { background: var(--bg-input) !important; border-color: var(--border) !important; color: var(--text-primary) !important; }
        .dark .hover\\:bg-slate-50:hover { background: var(--bg-hover) !important; }
        .dark table tr:hover { background: rgba(255,255,255,0.03) !important; }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%,100%{opacity:1}50%{opacity:.5} }
        .animate-spin { animation: spin 1s linear infinite; }
        .animate-pulse { animation: pulse 2s cubic-bezier(.4,0,.6,1) infinite; }
        .scrollbar-thin { scrollbar-width: thin; }
        .scrollbar-thin::-webkit-scrollbar { width: 5px; }
        .scrollbar-thin::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 9999px; }
        .sidebar-overlay { display:none; position:fixed; inset:0; background:rgba(0,0,0,0.5); z-index:40; }
        .sidebar-overlay.open { display:block; }

        /* ── Phone (< 640px) ── */
        @media (max-width:639px) {
          .sidebar-drawer { position:fixed !important; left:-240px; top:0; bottom:0; z-index:50; transition:left 0.25s ease; width:240px !important; min-width:240px !important; }
          .sidebar-drawer.open { left:0 !important; }
          .menu-btn { display:flex !important; }
          .stepper-bar { display:none !important; }
          /* Pages: reduce padding */
          .page-pad { padding: 12px !important; }
          /* Cards: full width single column */
          .card-grid-2 { grid-template-columns: 1fr !important; }
          .card-grid-3 { grid-template-columns: 1fr !important; }
          .card-grid-4 { grid-template-columns: 1fr 1fr !important; }
          /* Tables: horizontal scroll */
          .table-wrap { overflow-x: auto; -webkit-overflow-scrolling: touch; }
          /* Topnav: compact */
          .topnav-right { gap: 6px !important; }
          /* Platform checks: single col */
          .platform-grid { grid-template-columns: 1fr !important; }
          /* Text sizing */
          .resp-title { font-size: 13px !important; }
          /* FieldCell label wrapping */
          .field-grid { grid-template-columns: 1fr !important; }
        }

        /* ── Tablet (640px–1023px) ── */
        @media (min-width:640px) and (max-width:1023px) {
          .sidebar-drawer { position:fixed !important; left:-240px; top:0; bottom:0; z-index:50; transition:left 0.25s ease; width:240px !important; min-width:240px !important; }
          .sidebar-drawer.open { left:0 !important; }
          .menu-btn { display:flex !important; }
          .stepper-bar { display:none !important; }
          .page-pad { padding: 16px !important; }
          .card-grid-3 { grid-template-columns: 1fr 1fr !important; }
          .card-grid-4 { grid-template-columns: 1fr 1fr !important; }
          .platform-grid { grid-template-columns: 1fr 1fr !important; }
        }

        /* ── Desktop (>= 1024px) ── */
        @media (min-width:1024px) {
          .menu-btn { display:none !important; }
          .sidebar-drawer { position:relative !important; left:0 !important; }
          .page-pad { padding: 24px !important; }
          .platform-grid { grid-template-columns: 1fr 1fr !important; }
        }

        /* ── Large Desktop (>= 1440px) ── */
        @media (min-width:1440px) {
          .platform-grid { grid-template-columns: 1fr 1fr 1fr !important; }
          .card-grid-4 { grid-template-columns: 1fr 1fr 1fr 1fr !important; }
        }
      `}</style>
      <Sidebar activePage={activePage} setActivePage={setActivePage} sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} user={user} onLogout={handleLogout} investigation={investigation}/>
      <div style={{ display:"flex", flexDirection:"column", flex:1, minWidth:0, overflow:"hidden" }}>
        <TopNav activePage={activePage} setActivePage={setActivePage} dark={dark} setDark={setDark} setSidebarOpen={setSidebarOpen} user={user} onLogout={handleLogout} investigation={investigation}/>
        {investigationError && investigationError.includes("Supabase save failed") && (
          <div style={{ background:"#fef2f2", borderBottom:"1px solid #fecaca", padding:"8px 16px", display:"flex", alignItems:"center", justifyContent:"space-between", gap:8, flexShrink:0 }}>
            <span style={{ fontSize:12, color:"#b91c1c", fontWeight:500 }}>⚠️ {investigationError}</span>
            <button onClick={() => setInvestigationError("")} style={{ fontSize:11, color:"#b91c1c", background:"none", border:"none", cursor:"pointer", padding:"2px 6px", borderRadius:4, flexShrink:0 }}>Dismiss</button>
          </div>
        )}
        <main style={{ flex:1, overflowY:"auto", overflowX:"hidden", background:"var(--bg-page)", WebkitOverflowScrolling:"touch" }} className="scrollbar-thin">
          {pages[activePage]}
        </main>
      </div>
    </div>
  );
}
