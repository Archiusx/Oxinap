import { createContext, useContext, useState } from "react";

export const LANGUAGES = [
  { code: "en", label: "English", native: "English", flag: "🇬🇧" },
  { code: "kn", label: "Kannada", native: "ಕನ್ನಡ", flag: "🇮🇳" },
  { code: "te", label: "Telugu", native: "తెలుగు", flag: "🇮🇳" },
];

export const translations = {
  en: {
    // App
    appName: "SMART SUSPECT",
    appVersion: "FINDER · v2.1",
    signOut: "Sign Out",
    // Nav labels
    dashboard: "Dashboard",
    newInvestigation: "New Investigation",
    osintCollection: "OSINT Collection",
    aiAnalysis: "AI Analysis",
    relationshipGraph: "Relationship Graph",
    timeline: "Timeline",
    contentAnalysis: "Content Analysis",
    accessControl: "Access Control",
    reports: "Reports",
    analytics: "Analytics",
    settings: "Settings",
    // Nav groups
    investigation: "INVESTIGATION",
    output: "OUTPUT",
    system: "SYSTEM",
    vehicleVerify: "Vehicle RC / DL",
    // Page titles
    pageTitle_dashboard: "Investigation Dashboard",
    pageSub_dashboard: "Overview of all active & completed cases",
    pageTitle_osint: "OSINT Data Collection",
    pageTitle_aiAnalysis: "AI Analysis & Fingerprinting",
    pageSub_aiAnalysis: "INV-2024-089 · Digital identity correlation engine",
    pageTitle_graph: "Relationship Graph & Timeline",
    pageSub_graph: "INV-2024-089 · Network visualization & event reconstruction",
    pageTitle_report: "Forensic Report Generation",
    pageSub_report: "INV-2024-089 · Exportable investigation summary",
    // Stepper
    step1: "1. Input",
    step2: "2. Collection",
    step3: "3. Analysis",
    step4: "4. Graph",
    step5: "5. Report",
    // Search
    investigate: "Investigate",
    running: "Running…",
    enterTargetFirst: "Enter a target identifier first.",
    searchByUsername: "Search by username…",
    searchByEmail: "Search by email…",
    searchByPhone: "Search by phone…",
    searchByUrl: "Search by profile url…",
    searchByKeyword: "Search by keyword…",
    pasteImageUrl: "Paste a public image URL to investigate…",
    // Search tabs
    username: "Username",
    email: "Email",
    phone: "Phone",
    profileUrl: "Profile URL",
    keyword: "Keyword",
    image: "Image",
    // Stats
    totalInvestigations: "Total Investigations",
    suspectsIdentified: "Suspects Identified",
    highRiskCases: "High Risk Cases",
    platformsScanned: "Platforms Scanned",
    syncedFromSupabase: "Synced from Supabase",
    loadingDots: "Loading…",
    uniqueCaseTargets: "Unique case targets",
    criticalAndHigh: "Critical + high risk",
    acrossRecentCases: "Across recent cases",
    // Table
    caseId: "Case ID",
    target: "Target",
    type: "Type",
    risk: "Risk",
    status: "Status",
    saved: "Saved",
    deleteCase: "Delete case",
    casesOnRecord: (n) => `${n} case${n === 1 ? "" : "s"} on record`,
    loadingFromSupabase: "Loading from Supabase…",
    supabaseSyncError: "Supabase sync error",
    // Active case badge
    activeCase: "ACTIVE CASE",
    // Language selector
    language: "Language",
    selectLanguage: "Select Language",
    // Login
    login_welcome: "Welcome Back",
    login_subtitle: "Sign in to CyIntel",
    login_email: "Email Address",
    login_password: "Password",
    login_signIn: "Sign In",
    login_createAccount: "Create Account",
    login_forgotPassword: "Forgot Password?",
    login_phoneNumber: "Phone Number",
    login_sendOtp: "Send OTP",
    login_verifyOtp: "Verify OTP",
    login_orContinueWith: "or continue with",
    login_signInWithGoogle: "Sign in with Google",
  },

  kn: {
    // App
    appName: "ಸ್ಮಾರ್ಟ್ ಅನುಮಾನಿತ",
    appVersion: "ಹುಡುಕಾಟ · v2.1",
    signOut: "ನಿರ್ಗಮಿಸಿ",
    // Nav labels
    dashboard: "ಡ್ಯಾಶ್‌ಬೋರ್ಡ್",
    newInvestigation: "ಹೊಸ ತನಿಖೆ",
    osintCollection: "OSINT ಸಂಗ್ರಹ",
    aiAnalysis: "AI ವಿಶ್ಲೇಷಣೆ",
    relationshipGraph: "ಸಂಬಂಧ ಗ್ರಾಫ್",
    timeline: "ಸಮಯರೇಖೆ",
    reports: "ವರದಿಗಳು",
    analytics: "ವಿಶ್ಲೇಷಣಾಶಾಸ್ತ್ರ",
    settings: "ಸೆಟ್ಟಿಂಗ್‌ಗಳು",
    // Nav groups
    investigation: "ತನಿಖೆ",
    output: "ಔಟ್‌ಪುಟ್",
    system: "ಸಿಸ್ಟಮ್",
    vehicleVerify: "ವಾಹನ RC / DL",
    // Page titles
    pageTitle_dashboard: "ತನಿಖೆ ಡ್ಯಾಶ್‌ಬೋರ್ಡ್",
    pageSub_dashboard: "ಎಲ್ಲಾ ಸಕ್ರಿಯ ಮತ್ತು ಪೂರ್ಣಗೊಂಡ ಪ್ರಕರಣಗಳ ಅವಲೋಕನ",
    pageTitle_osint: "OSINT ಡೇಟಾ ಸಂಗ್ರಹ",
    pageTitle_aiAnalysis: "AI ವಿಶ್ಲೇಷಣೆ ಮತ್ತು ಫಿಂಗರ್‌ಪ್ರಿಂಟಿಂಗ್",
    pageSub_aiAnalysis: "INV-2024-089 · ಡಿಜಿಟಲ್ ಗುರುತು ಪರಸ್ಪರ ಸಂಬಂಧ ಎಂಜಿನ್",
    pageTitle_graph: "ಸಂಬಂಧ ಗ್ರಾಫ್ ಮತ್ತು ಸಮಯರೇಖೆ",
    pageSub_graph: "INV-2024-089 · ನೆಟ್‌ವರ್ಕ್ ದೃಶ್ಯೀಕರಣ ಮತ್ತು ಘಟನೆ ಪುನರ್ನಿರ್ಮಾಣ",
    pageTitle_report: "ಫೊರೆನ್ಸಿಕ್ ವರದಿ ರಚನೆ",
    pageSub_report: "INV-2024-089 · ರಫ್ತು ಮಾಡಬಹುದಾದ ತನಿಖೆ ಸಾರಾಂಶ",
    // Stepper
    step1: "೧. ಇನ್‌ಪುಟ್",
    step2: "೨. ಸಂಗ್ರಹ",
    step3: "೩. ವಿಶ್ಲೇಷಣೆ",
    step4: "೪. ಗ್ರಾಫ್",
    step5: "೫. ವರದಿ",
    // Search
    investigate: "ತನಿಖೆ ಮಾಡಿ",
    running: "ಚಾಲನೆಯಲ್ಲಿದೆ…",
    enterTargetFirst: "ಮೊದಲು ಗುರಿ ಗುರುತಿಸುವಿಕೆಯನ್ನು ನಮೂದಿಸಿ.",
    searchByUsername: "ಬಳಕೆದಾರ ಹೆಸರಿನಿಂದ ಹುಡುಕಿ…",
    searchByEmail: "ಇಮೇಲ್‌ನಿಂದ ಹುಡುಕಿ…",
    searchByPhone: "ಫೋನ್‌ನಿಂದ ಹುಡುಕಿ…",
    searchByUrl: "ಪ್ರೊಫೈಲ್ URL ನಿಂದ ಹುಡುಕಿ…",
    searchByKeyword: "ಕೀವರ್ಡ್‌ನಿಂದ ಹುಡುಕಿ…",
    pasteImageUrl: "ತನಿಖೆ ಮಾಡಲು ಸಾರ್ವಜನಿಕ ಚಿತ್ರ URL ಅಂಟಿಸಿ…",
    // Search tabs
    username: "ಬಳಕೆದಾರ ಹೆಸರು",
    email: "ಇಮೇಲ್",
    phone: "ಫೋನ್",
    profileUrl: "ಪ್ರೊಫೈಲ್ URL",
    keyword: "ಕೀವರ್ಡ್",
    image: "ಚಿತ್ರ",
    // Stats
    totalInvestigations: "ಒಟ್ಟು ತನಿಖೆಗಳು",
    suspectsIdentified: "ಅನುಮಾನಿತರ ಗುರುತಿಸುವಿಕೆ",
    highRiskCases: "ಹೆಚ್ಚಿನ ಅಪಾಯದ ಪ್ರಕರಣಗಳು",
    platformsScanned: "ಸ್ಕ್ಯಾನ್ ಮಾಡಿದ ಪ್ಲಾಟ್‌ಫಾರ್ಮ್‌ಗಳು",
    syncedFromSupabase: "Supabase ನಿಂದ ಸಿಂಕ್ ಆಗಿದೆ",
    loadingDots: "ಲೋಡ್ ಆಗುತ್ತಿದೆ…",
    uniqueCaseTargets: "ಅನನ್ಯ ಪ್ರಕರಣ ಗುರಿಗಳು",
    criticalAndHigh: "ಗಂಭೀರ + ಹೆಚ್ಚಿನ ಅಪಾಯ",
    acrossRecentCases: "ಇತ್ತೀಚಿನ ಪ್ರಕರಣಗಳಲ್ಲಿ",
    // Table
    caseId: "ಪ್ರಕರಣ ID",
    target: "ಗುರಿ",
    type: "ಪ್ರಕಾರ",
    risk: "ಅಪಾಯ",
    status: "ಸ್ಥಿತಿ",
    saved: "ಉಳಿಸಲಾಗಿದೆ",
    deleteCase: "ಪ್ರಕರಣ ಅಳಿಸಿ",
    casesOnRecord: (n) => `${n} ಪ್ರಕರಣ${n === 1 ? "" : "ಗಳು"} ದಾಖಲಿವೆ`,
    loadingFromSupabase: "Supabase ನಿಂದ ಲೋಡ್ ಆಗುತ್ತಿದೆ…",
    supabaseSyncError: "Supabase ಸಿಂಕ್ ದೋಷ",
    // Active case badge
    activeCase: "ಸಕ್ರಿಯ ಪ್ರಕರಣ",
    // Language selector
    language: "ಭಾಷೆ",
    selectLanguage: "ಭಾಷೆ ಆಯ್ಕೆ ಮಾಡಿ",
    // Login
    login_welcome: "ಮತ್ತೆ ಸ್ವಾಗತ",
    login_subtitle: "CyIntel ಗೆ ಸೈನ್ ಇನ್ ಮಾಡಿ",
    login_email: "ಇಮೇಲ್ ವಿಳಾಸ",
    login_password: "ಪಾಸ್‌ವರ್ಡ್",
    login_signIn: "ಸೈನ್ ಇನ್",
    login_createAccount: "ಖಾತೆ ರಚಿಸಿ",
    login_forgotPassword: "ಪಾಸ್‌ವರ್ಡ್ ಮರೆತಿರಾ?",
    login_phoneNumber: "ಫೋನ್ ಸಂಖ್ಯೆ",
    login_sendOtp: "OTP ಕಳುಹಿಸಿ",
    login_verifyOtp: "OTP ಪರಿಶೀಲಿಸಿ",
    login_orContinueWith: "ಅಥವಾ ಮುಂದುವರಿಯಿರಿ",
    login_signInWithGoogle: "Google ನಿಂದ ಸೈನ್ ಇನ್",
  },

  te: {
    // App
    appName: "స్మార్ట్ నిందితుడు",
    appVersion: "వెతుకుడు · v2.1",
    signOut: "సైన్ అవుట్",
    // Nav labels
    dashboard: "డాష్‌బోర్డ్",
    newInvestigation: "కొత్త దర్యాప్తు",
    osintCollection: "OSINT సేకరణ",
    aiAnalysis: "AI విశ్లేషణ",
    relationshipGraph: "సంబంధ గ్రాఫ్",
    timeline: "కాలరేఖ",
    reports: "నివేదికలు",
    analytics: "విశ్లేషణలు",
    settings: "సెట్టింగ్‌లు",
    // Nav groups
    investigation: "దర్యాప్తు",
    output: "అవుట్‌పుట్",
    system: "సిస్టమ్",
    vehicleVerify: "వాహన RC / DL",
    // Page titles
    pageTitle_dashboard: "దర్యాప్తు డాష్‌బోర్డ్",
    pageSub_dashboard: "అన్ని చురుకైన & పూర్తయిన కేసుల అవలోకనం",
    pageTitle_osint: "OSINT డేటా సేకరణ",
    pageTitle_aiAnalysis: "AI విశ్లేషణ & ఫింగర్‌ప్రింటింగ్",
    pageSub_aiAnalysis: "INV-2024-089 · డిజిటల్ గుర్తింపు సహసంబంధ ఇంజిన్",
    pageTitle_graph: "సంబంధ గ్రాఫ్ & కాలరేఖ",
    pageSub_graph: "INV-2024-089 · నెట్‌వర్క్ దృశ్యమానం & సంఘటన పునర్నిర్మాణం",
    pageTitle_report: "ఫోరెన్సిక్ నివేదిక తయారీ",
    pageSub_report: "INV-2024-089 · ఎగుమతి చేయగల దర్యాప్తు సారాంశం",
    // Stepper
    step1: "1. ఇన్‌పుట్",
    step2: "2. సేకరణ",
    step3: "3. విశ్లేషణ",
    step4: "4. గ్రాఫ్",
    step5: "5. నివేదిక",
    // Search
    investigate: "దర్యాప్తు చేయండి",
    running: "నడుస్తోంది…",
    enterTargetFirst: "ముందుగా లక్ష్య గుర్తింపును నమోదు చేయండి.",
    searchByUsername: "వినియోగదారు పేరు ద్వారా వెతకండి…",
    searchByEmail: "ఇమెయిల్ ద్వారా వెతకండి…",
    searchByPhone: "ఫోన్ ద్వారా వెతకండి…",
    searchByUrl: "ప్రొఫైల్ URL ద్వారా వెతకండి…",
    searchByKeyword: "కీవర్డ్ ద్వారా వెతకండి…",
    pasteImageUrl: "దర్యాప్తు కోసం పబ్లిక్ చిత్రం URL అతికించండి…",
    // Search tabs
    username: "వినియోగదారు పేరు",
    email: "ఇమెయిల్",
    phone: "ఫోన్",
    profileUrl: "ప్రొఫైల్ URL",
    keyword: "కీవర్డ్",
    image: "చిత్రం",
    // Stats
    totalInvestigations: "మొత్తం దర్యాప్తులు",
    suspectsIdentified: "గుర్తించిన నిందితులు",
    highRiskCases: "అధిక ప్రమాద కేసులు",
    platformsScanned: "స్కాన్ చేసిన ప్లాట్‌ఫారమ్‌లు",
    syncedFromSupabase: "Supabase నుండి సింక్ అయింది",
    loadingDots: "లోడ్ అవుతోంది…",
    uniqueCaseTargets: "ప్రత్యేక కేసు లక్ష్యాలు",
    criticalAndHigh: "క్రిటికల్ + అధిక ప్రమాదం",
    acrossRecentCases: "ఇటీవలి కేసులలో",
    // Table
    caseId: "కేసు ID",
    target: "లక్ష్యం",
    type: "రకం",
    risk: "ప్రమాదం",
    status: "స్థితి",
    saved: "సేవ్ అయింది",
    deleteCase: "కేసు తొలగించు",
    casesOnRecord: (n) => `${n} కేసు${n === 1 ? "" : "లు"} నమోదులో ఉన్నాయి`,
    loadingFromSupabase: "Supabase నుండి లోడ్ అవుతోంది…",
    supabaseSyncError: "Supabase సింక్ లోపం",
    // Active case badge
    activeCase: "చురుకైన కేసు",
    // Language selector
    language: "భాష",
    selectLanguage: "భాష ఎంచుకోండి",
    // Login
    login_welcome: "తిరిగి స్వాగతం",
    login_subtitle: "CyIntel లో సైన్ ఇన్ చేయండి",
    login_email: "ఇమెయిల్ చిరునామా",
    login_password: "పాస్‌వర్డ్",
    login_signIn: "సైన్ ఇన్",
    login_createAccount: "ఖాతా సృష్టించండి",
    login_forgotPassword: "పాస్‌వర్డ్ మర్చిపోయారా?",
    login_phoneNumber: "ఫోన్ నంబర్",
    login_sendOtp: "OTP పంపండి",
    login_verifyOtp: "OTP ధృవీకరించండి",
    login_orContinueWith: "లేదా కొనసాగించండి",
    login_signInWithGoogle: "Google తో సైన్ ఇన్",
  },
};

const LanguageContext = createContext(null);

export function LanguageProvider({ children }) {
  const stored = typeof localStorage !== "undefined" ? localStorage.getItem("oxinap_lang") : null;
  const [lang, setLangState] = useState(stored || "en");

  function setLang(code) {
    setLangState(code);
    localStorage.setItem("oxinap_lang", code);
  }

  const t = translations[lang] || translations.en;

  return (
    <LanguageContext.Provider value={{ lang, setLang, t, LANGUAGES }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLang() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLang must be used inside LanguageProvider");
  return ctx;
}
