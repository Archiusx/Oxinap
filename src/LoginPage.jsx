import { useState, useRef, useEffect } from "react";
import { useLang, LANGUAGES } from "./LanguageContext";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  updateProfile,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithPhoneNumber,
  RecaptchaVerifier,
} from "firebase/auth";
import {
  doc, getDocFromServer, setDoc, serverTimestamp,
} from "firebase/firestore";
import {
  ref, set, onDisconnect,
  serverTimestamp as rtdbTimestamp,
  push,
} from "firebase/database";
import { auth, db, firebaseProjectId, rtdb } from "./firebase";

// ── Constants ────────────────────────────────────────────────────────────────
const ROLE_MAP = {
  analyst_l1: "analyst", analyst_l2: "analyst",
  senior_analyst: "analyst", team_lead: "investigator",
  investigator: "investigator", admin: "admin",
};
const googleProvider = new GoogleAuthProvider();

// ── Helpers ───────────────────────────────────────────────────────────────────
const validEmail = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
const validPhone = (p) => /^[6-9]\d{9}$/.test(p);

function sanitize(s) {
  const d = document.createElement("div");
  d.textContent = s;
  return d.innerHTML;
}

function authErr(code) {
  return ({
    "auth/email-already-in-use":      "This email is already registered. Please sign in.",
    "auth/invalid-email":             "Please enter a valid email address.",
    "auth/weak-password":             "Passphrase must be at least 8 characters.",
    "auth/user-not-found":            "No account found with this email.",
    "auth/wrong-password":            "Incorrect passphrase. Please try again.",
    "auth/invalid-credential":        "Invalid email or passphrase.",
    "auth/too-many-requests":         "Too many attempts. Please try again later.",
    "auth/popup-closed-by-user":      "Sign-in cancelled.",
    "auth/cancelled-popup-request":   "A sign-in window is already open.",
    "auth/invalid-phone-number":      "Enter a valid 10-digit Indian mobile number.",
    "auth/code-expired":              "OTP expired. Please request a new one.",
    "auth/invalid-verification-code": "Incorrect OTP. Please check and retry.",
    "permission-denied":              "Firestore rules blocked this write. Deploy the included firestore.rules file and try again.",
    "failed-precondition":            "Firestore needs an index or configuration change. Check the console for details.",
    "unavailable":                    "Firestore is temporarily unavailable. Please retry after a moment.",
  })[code] || `Error: ${code}`;
}

// ── The 3 Asynchronous Database Operations ──────────────────────────────────
async function setDocAndVerify(docRef, payload, label) {
  await setDoc(docRef, payload, { merge: true });

  const snap = await getDocFromServer(docRef);
  if (!snap.exists()) {
    throw new Error(`${label} write acknowledged, but no Firestore document was found at ${docRef.path}.`);
  }

  const saved = snap.data();
  if (payload.uid && saved.uid !== payload.uid) {
    throw new Error(`${label} verification failed: saved uid ${saved.uid || "<missing>"} does not match ${payload.uid}.`);
  }

  return saved;
}

async function saveRegisteredUserProfile(uid, profile) {
  const userRef = doc(db, "users", uid);
  const payload = {
    ...profile,
    uid,
    lastLogin: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  let lastError;
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      console.info(`[CyIntel] Saving registration profile to ${userRef.path} in project ${firebaseProjectId} (attempt ${attempt}).`);
      const saved = await setDocAndVerify(userRef, payload, "Registration profile");
      console.info(`[CyIntel] Registration profile verified for UID: ${uid}`);
      return saved;
    } catch (e) {
      lastError = e;
      console.error(`[CyIntel] Registration profile save attempt ${attempt} failed:`, e);
    }
  }

  throw lastError;
}

const defaultUserProfile = (uid, fields = {}) => ({
  uid,
  fullName: fields.fullName || fields.displayName || auth.currentUser?.displayName || "CyIntel Operative",
  email: fields.email || auth.currentUser?.email || "",
  phone: fields.phone || auth.currentUser?.phoneNumber || "",
  badgeID: fields.badgeID || "",
  designation: fields.designation || "",
  department: fields.department || "",
  role: fields.role || "investigator",
  status: "active",
  verified: false,
  authProvider: fields.authProvider || "email",
  ...(fields.photoURL ? { photoURL: fields.photoURL } : {}),
  createdAt: serverTimestamp(),
  updatedAt: serverTimestamp(),
  lastLogin: serverTimestamp(),
});

function mutableProfileFields(fields = {}) {
  const allowed = ["fullName", "email", "phone", "badgeID", "designation", "department", "authProvider", "photoURL", "displayName"];
  return Object.fromEntries(
    Object.entries(fields).filter(([key, value]) => allowed.includes(key) && value !== undefined)
  );
}

async function upsertUser(uid, fields = {}, isNew = false) {
  const userRef = doc(db, "users", uid);

  try {
    const snap = isNew ? null : await getDocFromServer(userRef).catch(() => null);

    if (isNew || !snap?.exists()) {
      const createPayload = defaultUserProfile(uid, fields);
      await setDocAndVerify(userRef, createPayload, "User profile");
      console.log(`[CyIntel] Firestore profile created successfully for UID: ${uid}`);
      return;
    }

    const updatePayload = {
      ...mutableProfileFields(fields),
      uid,
      lastLogin: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    await setDocAndVerify(userRef, updatePayload, "User profile");
    console.log(`[CyIntel] Firestore profile updated successfully for UID: ${uid}`);
  } catch (e) {
    console.error("[CyIntel] CRITICAL FIRESTORE STORAGE FAILURE:", e);
    throw e;
  }
}

async function setUserPresence(uid, name) {
  try {
    const data = { uid, displayName: name || "Operative", online: true, lastSeen: rtdbTimestamp() };
    const pRef = ref(rtdb, `presence/${uid}`);
    const aRef = ref(rtdb, `activeUsers/${uid}`);
    await Promise.all([set(pRef, data), set(aRef, data)]);
    onDisconnect(pRef).set({ uid, online: false, lastSeen: rtdbTimestamp() });
    onDisconnect(aRef).remove();
  } catch (e) { console.warn("[CyIntel] Presence write failed:", e); }
}

async function pushNotification(uid, message, type = "info") {
  try {
    await push(ref(rtdb, `notifications/${uid}`), {
      message, type, createdAt: rtdbTimestamp(), read: false,
    });
  } catch (e) { console.warn("[CyIntel] Notification push failed:", e); }
}

// ── Sub-components ────────────────────────────────────────────────────────────
function Alert({ msg, type }) {
  if (!msg) return null;
  const styles = {
    success: { bg: "rgba(34,197,94,0.10)", color: "#4ade80", border: "rgba(34,197,94,0.2)" },
    info:    { bg: "rgba(37,99,235,0.10)",  color: "#93c5fd", border: "rgba(37,99,235,0.2)" },
    error:   { bg: "rgba(239,68,68,0.10)",  color: "#f87171", border: "rgba(239,68,68,0.2)" },
  }[type] || { bg: "rgba(239,68,68,0.10)", color: "#f87171", border: "rgba(239,68,68,0.2)" };
  const icon = type === "success" ? "✓" : type === "info" ? "ℹ" : "✕";
  return (
    <div style={{
      padding: "0.75rem 1rem", borderRadius: 8, marginBottom: "1rem",
      fontSize: "0.875rem", display: "flex", alignItems: "center", gap: "0.5rem",
      background: styles.bg, color: styles.color, border: `1px solid ${styles.border}`,
    }}>
      <span style={{ fontWeight: 700 }}>{icon}</span>
      <span>{msg}</span>
    </div>
  );
}

function PasswordInput({ id, placeholder, value, onChange }) {
  const [show, setShow] = useState(false);
  return (
    <div style={{ position: "relative" }}>
      <span style={iconStyle}>🔒</span>
      <input
        id={id} type={show ? "text" : "password"}
        value={value} onChange={onChange}
        placeholder={placeholder}
        autoComplete={id === "loginPassword" ? "current-password" : "new-password"}
        style={{ ...inputStyle, paddingRight: "2.5rem" }}
      />
      <button
        type="button"
        onClick={() => setShow(v => !v)}
        style={{
          position: "absolute", right: "0.875rem", top: "50%",
          transform: "translateY(-50%)", background: "none", border: "none",
          cursor: "pointer", color: "#4A6080", fontSize: "0.875rem", padding: 4,
        }}
      >{show ? "🙈" : "👁"}</button>
    </div>
  );
}

// ── Shared inline styles ──────────────────────────────────────────────────────
const inputStyle = {
  width: "100%", padding: "0.75rem 1rem", paddingLeft: "2.5rem",
  border: "1px solid #1E3A6E", borderRadius: 8, fontSize: "0.875rem",
  background: "#0D1835", color: "#FFFFFF", fontFamily: "inherit",
  WebkitTextFillColor: "#FFFFFF", opacity: 1, outline: "none",
  transition: "border-color 0.2s",
};
const iconStyle = {
  position: "absolute", left: "0.875rem", top: "50%",
  transform: "translateY(-50%)", fontSize: "0.8rem",
  pointerEvents: "none", color: "#4A6080",
};
const labelStyle = {
  display: "block", fontSize: "0.875rem", fontWeight: 500,
  color: "#FFFFFF", marginBottom: "0.5rem",
};
const btnPrimary = {
  width: "100%", padding: "0.875rem 1rem", border: "none",
  borderRadius: 8, fontSize: "0.875rem", fontWeight: 500,
  cursor: "pointer", display: "flex", alignItems: "center",
  justifyContent: "center", gap: "0.5rem", fontFamily: "inherit",
  background: "linear-gradient(135deg,#2563EB 0%,#1D4ED8 100%)",
  color: "white",
};
const btnSecondary = {
  padding: "0.75rem 1rem", background: "#0A1228", color: "#A8B8D8",
  border: "1px solid #1E3A6E", borderRadius: 8, cursor: "pointer",
  fontSize: "0.8rem", fontWeight: 500, whiteSpace: "nowrap",
  fontFamily: "inherit", flexShrink: 0,
};
const methodTabBase = {
  flex: 1, padding: "0.5rem 0.75rem", background: "#0A1228",
  border: "1px solid #1E3A6E", borderRadius: 8, color: "#4A6080",
  fontSize: "0.78rem", fontWeight: 500, cursor: "pointer",
  transition: "all 0.2s", fontFamily: "inherit",
  display: "flex", alignItems: "center", justifyContent: "center", gap: 4,
};

// ── Main Component ────────────────────────────────────────────────────────────
export default function LoginPage() {
  const { lang, setLang, t } = useLang();
  const [tab, setTab]           = useState("login");    
  const [loginMethod, setLoginMethod] = useState("email"); 

  // Login fields
  const [loginEmail, setLoginEmail]       = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginPhone, setLoginPhone]       = useState("");
  const [otp, setOtp]                     = useState("");
  const [otpSent, setOtpSent]             = useState(false);

  // Register fields
  const [regName, setRegName]         = useState("");
  const [regBadge, setRegBadge]       = useState("");
  const [regEmail, setRegEmail]       = useState("");
  const [regDept, setRegDept]         = useState("");
  const [regDesig, setRegDesig]       = useState("");
  const [regPhone, setRegPhone]       = useState("");
  const [regPassword, setRegPassword] = useState("");

  // UI state
  const [loginAlert, setLoginAlert]     = useState({ msg: "", type: "error" });
  const [regAlert, setRegAlert]         = useState({ msg: "", type: "error" });
  const [loading, setLoading]           = useState({});

  // OTP state
  const confirmRef    = useRef(null);
  const recaptchaRef  = useRef(null);
  const recaptchaElId = "recaptcha-container";

  function setLoad(key, val) {
    setLoading(prev => ({ ...prev, [key]: val }));
  }

  function clearAlerts() {
    setLoginAlert({ msg: "", type: "error" });
    setRegAlert({ msg: "", type: "error" });
  }

  // Sanitized text value updates
  const handleLoginPhoneChange = (e) => {
    const digits = e.target.value.replace(/\D/g, "");
    setLoginPhone(digits);
  };

  const handleRegPhoneChange = (e) => {
    const digits = e.target.value.replace(/\D/g, "");
    setRegPhone(digits);
  };

  // ── Email Login ────────────────────────────────────────────────────────────
  async function handleEmailLogin() {
    if (!loginEmail || !loginPassword) {
      setLoginAlert({ msg: "Please fill in both fields.", type: "error" }); return;
    }
    if (!validEmail(loginEmail)) {
      setLoginAlert({ msg: "Please enter a valid email address.", type: "error" }); return;
    }
    setLoad("login", true);
    try {
      const cred = await signInWithEmailAndPassword(auth, loginEmail, loginPassword);
      await upsertUser(cred.user.uid, {});
      await setUserPresence(cred.user.uid, cred.user.displayName);
      await pushNotification(cred.user.uid, "Login — " + new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }), "info");
      setLoginAlert({ msg: "Access granted. Loading dashboard…", type: "success" });
    } catch (e) {
      setLoginAlert({ msg: authErr(e.code), type: "error" });
    } finally {
      setLoad("login", false);
    }
  }

  // ── Google Login ───────────────────────────────────────────────────────────
  async function handleGoogleLogin() {
    setLoad("google", true);
    try {
      const cred  = await signInWithPopup(auth, googleProvider);
      const user  = cred.user;
      const isNew = cred._tokenResponse?.isNewUser ?? false;
      const payload = {
        authProvider: "google",
        email:    cred.user.email,
        fullName: cred.user.displayName || "CyIntel Operative",
        phone:    cred.user.phoneNumber || "",
        photoURL: cred.user.photoURL    || "",
      };
      if (isNew) {
        Object.assign(payload, { uid: user.uid, badgeID: "", designation: "", department: "", role: "investigator", status: "active", verified: false });
        await upsertUser(user.uid, payload, true);
        await pushNotification(user.uid, "Welcome to CyIntel. Please complete your profile.", "info");
      } else {
        await upsertUser(user.uid, payload);
      }
      await setUserPresence(user.uid, user.displayName);
      setLoginAlert({ msg: "Google authentication successful! Loading dashboard…", type: "success" });
    } catch (e) {
      if (e.code === "auth/popup-blocked") {
        setLoginAlert({ msg: "Popup was blocked. Please allow popups for this site and try again.", type: "error" });
      } else {
        setLoginAlert({ msg: authErr(e.code), type: "error" });
      }
    } finally {
      setLoad("google", false);
    }
  }

  // ── Phone OTP ──────────────────────────────────────────────────────────────
  function initRecaptcha() {
    if (recaptchaRef.current) return;
    recaptchaRef.current = new RecaptchaVerifier(auth, recaptchaElId, {
      size: "invisible", callback: () => {},
    });
  }

  async function handleSendOtp() {
    const cleanDigits = loginPhone.trim();
    if (!cleanDigits) { 
      setLoginAlert({ msg: "Please enter your phone number.", type: "error" }); 
      return; 
    }
    if (!validPhone(cleanDigits)) {
      setLoginAlert({ msg: "Enter a valid 10-digit Indian mobile number.", type: "error" }); 
      return;
    }
    
    const formatted = "+91" + cleanDigits;
    setLoad("otp", true);
    try {
      initRecaptcha();
      confirmRef.current = await signInWithPhoneNumber(auth, formatted, recaptchaRef.current);
      setOtpSent(true);
      setLoginAlert({ msg: `OTP sent to ${formatted}.`, type: "info" });
    } catch (e) {
      if (recaptchaRef.current) { try { recaptchaRef.current.clear(); } catch (_) {} recaptchaRef.current = null; }
      setLoginAlert({ msg: authErr(e.code), type: "error" });
    } finally {
      setLoad("otp", false);
    }
  }

  async function handleVerifyOtp() {
    if (!otp || otp.length !== 6) { setLoginAlert({ msg: "Please enter the 6-digit OTP.", type: "error" }); return; }
    if (!confirmRef.current)      { setLoginAlert({ msg: "Please request an OTP first.", type: "error" }); return; }
    setLoad("verify", true);
    try {
      const cred    = await confirmRef.current.confirm(otp);
      const user    = cred.user;
      const isNew   = cred._tokenResponse?.isNewUser ?? false;
      const payload = { authProvider: "phone", phone: user.phoneNumber || "", email: user.email || "" };
      if (isNew) {
        Object.assign(payload, { uid: user.uid, fullName: "CyIntel Operative", badgeID: "", designation: "", department: "", role: "investigator", status: "active", verified: false });
        await upsertUser(user.uid, payload, true);
        await pushNotification(user.uid, "Welcome to CyIntel. Please complete your profile.", "info");
      } else {
        await upsertUser(user.uid, payload);
      }
      await setUserPresence(user.uid, user.displayName || "Operative");
      setLoginAlert({ msg: "Phone verified. Loading dashboard…", type: "success" });
    } catch (e) {
      setLoginAlert({ msg: authErr(e.code), type: "error" });
    } finally {
      setLoad("verify", false);
    }
  }

  // ── Forgot Password ────────────────────────────────────────────────────────
  async function handleForgotPassword(e) {
    e.preventDefault();
    if (!loginEmail)            { setLoginAlert({ msg: "Enter your email above, then click Forgot Passphrase.", type: "error" }); return; }
    if (!validEmail(loginEmail)) { setLoginAlert({ msg: "Please enter a valid email address.", type: "error" }); return; }
    try {
      await sendPasswordResetEmail(auth, loginEmail);
      setLoginAlert({ msg: "Reset link sent! Check your inbox.", type: "success" });
    } catch (e) {
      setLoginAlert({ msg: authErr(e.code), type: "error" });
    }
  }

  // ── Register ───────────────────────────────────────────────────────────────
  async function handleRegister() {
    const name = regName.trim();
    const badge = regBadge.trim().toUpperCase();
    const email = regEmail.trim().toLowerCase();
    const department = regDept.trim();
    const designation = regDesig.trim();
    const phone = regPhone.trim();

    if (!name || !badge || !email || !department || !designation || !regPassword) {
      setRegAlert({ msg: "Please fill in all required fields.", type: "error" }); return;
    }
    if (!validEmail(email))  { setRegAlert({ msg: "Please enter a valid email address.", type: "error" }); return; }
    if (regPassword.length < 8) { setRegAlert({ msg: "Passphrase must be at least 8 characters.", type: "error" }); return; }
    if (badge.length < 4)    { setRegAlert({ msg: "Please enter a valid Badge / Employee ID.", type: "error" }); return; }
    if (phone && !validPhone(phone)) { setRegAlert({ msg: "Enter a valid 10-digit Indian mobile number.", type: "error" }); return; }

    setLoad("register", true);
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, regPassword);
      const user = cred.user;
      const displayName = sanitize(name);

      await updateProfile(user, { displayName });

      const profile = {
        uid: user.uid,
        fullName: displayName,
        email,
        phone: phone ? "+91" + phone : "",
        badgeID: sanitize(badge),
        designation,
        department,
        role: ROLE_MAP[designation] || "investigator",
        status: "active",
        verified: false,
        authProvider: "email",
        createdAt: serverTimestamp(),
      };

      await saveRegisteredUserProfile(user.uid, profile);
      await setUserPresence(user.uid, displayName);
      await pushNotification(user.uid, "Account registered. Pending admin verification.", "info");

      setRegAlert({ msg: "Account registered! Loading dashboard…", type: "success" });
    } catch (e) {
      console.error("Detailed registration failure:", e);
      setRegAlert({ msg: authErr(e.code || e.message), type: "error" });
    } finally {
      setLoad("register", false);
    }
  }

  // ── Enter key support ──────────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e) => {
      if (e.key !== "Enter") return;
      if (tab === "register") { handleRegister(); return; }
      if (loginMethod === "phone") {
        otpSent ? handleVerifyOtp() : handleSendOtp();
      } else {
        handleEmailLogin();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [tab, loginMethod, otpSent, loginEmail, loginPassword, loginPhone, otp, regName, regBadge, regEmail, regDept, regDesig, regPhone, regPassword]);

  return (
    <>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet" />
      <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" rel="stylesheet" />

      <style>{`
        body { margin:0; }
        .cy-input:focus { border-color:#2563EB !important; box-shadow:0 0 0 3px rgba(99,102,241,0.2); background:#0A1228 !important; outline:none; }
        .cy-input::placeholder { color:#4A6080; -webkit-text-fill-color:#4A6080; }
        .cy-input:-webkit-autofill, .cy-input:-webkit-autofill:focus {
          -webkit-text-fill-color:#FFFFFF !important;
          -webkit-box-shadow:0 0 0px 1000px #0D1835 inset !important;
          transition: background-color 5000s ease-in-out 0s;
        }
        .cy-btn-primary:hover:not(:disabled) { transform:translateY(-2px); box-shadow:0 4px 12px rgba(0,0,0,0.4); }
        .cy-btn-primary:disabled { background:#4A6080 !important; cursor:not-allowed; opacity:0.7; }
        .cy-btn-google:hover:not(:disabled) { background:#f8f9fa; box-shadow:0 2px 6px rgba(0,0,0,0.15); transform:translateY(-1px); }
        .cy-btn-google:disabled { opacity:0.6; cursor:not-allowed; }
        .cy-select option { background:#0D1835; color:#fff; }
        @keyframes bgShift {
          0%,100% { transform:translateX(0) translateY(0); opacity:.3; }
          33% { transform:translateX(-30px) translateY(-30px); opacity:.5; }
          66% { transform:translateX(30px) translateY(-20px); opacity:.4; }
        }
        @keyframes codeFloat {
          0%,100% { transform:translateY(0) translateX(0); }
          50% { transform:translateY(-20px) translateX(10px); }
        }
      `}</style>

      <div style={{
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
        minHeight: "100vh", display: "flex", flexDirection: "column",
        background: "radial-gradient(ellipse at top, #0D1835 0%, #050810 60%, #000000 100%)",
        color: "#FFFFFF", position: "relative", overflowX: "hidden",
      }}>
        <div style={{
          position: "fixed", top: 0, left: 0, width: "100%", height: "100%", pointerEvents: "none", zIndex: 0,
          background: "radial-gradient(circle at 20% 80%,rgba(37,99,235,.1) 0%,transparent 50%),radial-gradient(circle at 80% 20%,rgba(29,78,216,.07) 0%,transparent 50%),radial-gradient(circle at 40% 40%,rgba(59,130,246,.08) 0%,transparent 50%)",
          animation: "bgShift 20s ease-in-out infinite",
        }} />

        <div style={{ position:"relative", zIndex:10, display:"flex", justifyContent:"flex-end", padding:"12px 20px 0", gap:6 }}>
          {LANGUAGES.map(lng => (
            <button key={lng.code} onClick={() => setLang(lng.code)} style={{
              display:"flex", alignItems:"center", gap:5, padding:"5px 12px", borderRadius:20, fontSize:12,
              background: lang === lng.code ? "rgba(37,99,235,0.3)" : "rgba(255,255,255,0.07)",
              border: lang === lng.code ? "1px solid rgba(37,99,235,0.6)" : "1px solid rgba(255,255,255,0.12)",
              color: lang === lng.code ? "#93c5fd" : "rgba(255,255,255,0.55)", cursor:"pointer",
              fontWeight: lang === lng.code ? 600 : 400, transition:"all 0.15s",
            }}>
              <span style={{ fontSize:14 }}>{lng.flag}</span>
              <span>{lng.native}</span>
            </button>
          ))}
        </div>

        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "2rem 1rem", position: "relative", zIndex: 1 }}>
          <div style={{
            width: "100%", maxWidth: 1000, background: "#0D1835",
            border: "1px solid #1E3A6E", borderRadius: 16,
            boxShadow: "0 10px 40px rgba(0,0,0,0.7)",
            display: "grid", gridTemplateColumns: "1fr 1fr", overflow: "hidden",
          }} className="cy-auth-container">

            <div style={{
              background: "linear-gradient(135deg,#0D1835 0%,#162448 60%,#0A0F1E 100%)",
              display: "flex", flexDirection: "column", alignItems: "center",
              justifyContent: "center", padding: "3rem 2rem", textAlign: "center", position: "relative", overflow: "hidden",
            }}>
              <div style={{
                position: "absolute", top: 0, left: 0, width: "100%", height: "100%", pointerEvents: "none",
                backgroundImage: "url(\"data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='55' font-size='28' fill='rgba(255,255,255,0.07)'>&#128274;</text></svg>\"), url(\"data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='55' font-size='22' fill='rgba(56,189,248,0.08)'>&#11043;</text></svg>\")",
                backgroundSize: "150px 150px, 200px 200px",
                backgroundPosition: "10% 20%, 70% 60%",
                animation: "codeFloat 25s linear infinite",
              }} />
              <div style={{ position: "relative", zIndex: 1, marginBottom: "2rem" }}>
                <img
                  src="https://i.ibb.co/XrMWBwQT/IMG-20260609-WA0033.jpg"
                  alt="CyIntel Logo"
                  style={{
                    width: 80, height: 80, borderRadius: 12,
                    boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
                    display: "block", marginLeft: "auto", marginRight: "auto", marginBottom: "1.5rem"
                  }}
                />  
                <h1 style={{
                  fontSize: "2rem", fontWeight: 700, marginBottom: "0.5rem", margin: 0,
                  background: "linear-gradient(135deg,#fff 0%,#e2e8f0 100%)",
                  WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text",
                }}>
                  CyIntel
                </h1>  
                <p style={{ fontSize: "1rem", opacity: 0.9, margin: "0.5rem 0 2rem", color: "#cbd5e1" }}>
                  Cyber Intelligence Platform - Cyber Investigation Department Karnataka
                </p>
              </div>
              <ul style={{ listStyle: "none", textAlign: "left", padding: 0, margin: 0, position: "relative", zIndex: 1 }}>
                {[
                  ["", "Threat Intelligence & Analysis"],
                  ["", "Cyber Surveillance Network"],
                  ["", "Incident Response Management"],
                  ["", "Secure Data Vault"],
                  ["", "Real-Time Threat Monitoring"],
                ].map(([icon, text]) => (
                  <li key={text} style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "1rem", fontSize: "0.875rem", opacity: 0.9 }}>
                    <span style={{ width: 20, textAlign: "center" }}>{icon}</span>
                    <span>{text}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div style={{
              padding: "3rem 2rem", display: "flex", flexDirection: "column",
              justifyContent: "center", background: "#000000",
              overflowY: "auto", maxHeight: "90vh", position: "relative", zIndex: 1,
            }}>
              <div style={{
                display: "flex", marginBottom: "2rem",
                background: "#0A1228", borderRadius: 8, padding: "0.25rem",
                border: "1px solid #1E3A6E",
              }}>
                {["login", "register"].map(t => (
                  <button key={t} type="button" onClick={() => { setTab(t); clearAlerts(); }}
                    style={{
                      flex: 1, padding: "0.75rem 1rem", background: tab === t ? "#2563EB" : "transparent",
                      border: "none", borderRadius: 8, fontWeight: 500, cursor: "pointer",
                      color: tab === t ? "#fff" : "#A8B8D8", fontSize: "0.875rem", fontFamily: "inherit",
                      transition: "all 0.3s",
                    }}>
                    {t === "login" ? "Secure Login" : "New Registration"}
                  </button>
                ))}
              </div>

              <div style={{
                background: "rgba(37,99,235,0.08)", border: "1px solid rgba(37,99,235,0.25)",
                borderRadius: 8, padding: "0.6rem 1rem", marginBottom: "1.25rem",
                fontSize: "0.78rem", color: "#3B82F6", display: "flex", alignItems: "center", gap: "0.5rem",
              }}>
                🛡️ <span>Restricted Access — Authorized CyIntel Personnel Only</span>
              </div>

              {tab === "login" && (
                <div>
                  <Alert msg={loginAlert.msg} type={loginAlert.type} />

                  <div style={{ marginBottom: "1rem" }}>
                    <button type="button" onClick={handleGoogleLogin} disabled={!!loading.google}
                      className="cy-btn-google"
                      style={{
                        width: "100%", padding: "0.875rem 1rem", border: "1px solid #dadce0",
                        borderRadius: 8, fontSize: "0.875rem", fontWeight: 500,
                        cursor: "pointer", display: "flex", alignItems: "center",
                        justifyContent: "center", gap: "0.5rem", background: "#fff",
                        color: "#3c4043", fontFamily: "inherit", transition: "all 0.2s",
                      }}>
                      <i className="fab fa-google" style={{ color: "#DB4437" }} />
                      <span>{loading.google ? "Please wait…" : t.login_signInWithGoogle}</span>
                    </button>
                  </div>

                  <div style={{
                    display: "flex", alignItems: "center", gap: "0.75rem",
                    margin: "1rem 0", color: "#4A6080", fontSize: "0.8rem",
                  }}>
                    <div style={{ flex: 1, height: 1, background: "#1E3A6E" }} />
                    or continue with
                    <div style={{ flex: 1, height: 1, background: "#1E3A6E" }} />
                  </div>

                  <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1.25rem" }}>
                    {[["email", "✉️ Email"], ["phone", "📱 Phone OTP"]].map(([m, label]) => (
                      <button key={m} type="button" onClick={() => { setLoginMethod(m); setLoginAlert({ msg: "", type: "error" }); }}
                        style={{
                          ...methodTabBase,
                          background: loginMethod === m ? "rgba(37,99,235,0.15)" : "#0A1228",
                          borderColor: loginMethod === m ? "#2563EB" : "#1E3A6E",
                          color: loginMethod === m ? "#3B82F6" : "#4A6080",
                        }}>
                        {label}
                      </button>
                    ))}
                  </div>

                  {loginMethod === "email" && (
                    <>
                      <div style={{ marginBottom: "1rem" }}>
                        <label style={labelStyle}>Official Email Address</label>
                        <div style={{ position: "relative" }}>
                          <span style={iconStyle}>✉️</span>
                          <input type="email" value={loginEmail} onChange={e => setLoginEmail(e.target.value)}
                            placeholder="Enter your official email" autoComplete="email"
                            className="cy-input" style={inputStyle} />
                        </div>
                      </div>
                      <div style={{ marginBottom: "0.5rem" }}>
                        <label style={labelStyle}>Security Passphrase</label>
                        <PasswordInput id="loginPassword" placeholder="Enter your passphrase"
                          value={loginPassword} onChange={e => setLoginPassword(e.target.value)} />
                      </div>
                      <div style={{ textAlign: "right", marginBottom: "1rem" }}>
                        <a href="#" onClick={handleForgotPassword}
                          style={{ color: "#3B82F6", textDecoration: "none", fontSize: "0.875rem", fontWeight: 500 }}>
                          Forgot Passphrase?
                        </a>
                      </div>
                      <button type="button" onClick={handleEmailLogin} disabled={!!loading.login}
                        className="cy-btn-primary" style={btnPrimary}>
                        <span>🔐</span>
                        <span>{loading.login ? "Please wait…" : "Access Portal"}</span>
                      </button>
                    </>
                  )}

                  {loginMethod === "phone" && (
                    <>
                      <div id={recaptchaElId} />
                      <div style={{ marginBottom: "1rem" }}>
                        <label style={labelStyle}>Phone Number</label>
                        <div style={{ display: "flex", gap: "0.5rem", alignItems: "flex-start" }}>
                          <div style={{ position: "relative", flex: 1 }}>
                            <span style={iconStyle}>📱</span>
                            <input type="tel" value={loginPhone} onChange={handleLoginPhoneChange}
                              placeholder="98XXXXXXXX" autoComplete="tel" inputMode="tel" maxLength={10}
                              className="cy-input"
                              style={{ ...inputStyle, color: "#FFFFFF", WebkitTextFillColor: "#FFFFFF" }} />
                          </div>
                          <button type="button" onClick={handleSendOtp} disabled={!!loading.otp}
                            style={btnSecondary}>
                            {loading.otp ? "Sending…" : "✈ Send OTP"}
                          </button>
                        </div>
                      </div>
                      {otpSent && (
                        <>
                          <div style={{ marginBottom: "1rem" }}>
                            <label style={labelStyle}>Enter OTP</label>
                            <div style={{ position: "relative" }}>
                              <span style={iconStyle}>🔑</span>
                              <input type="tel" value={otp} onChange={e => setOtp(e.target.value.replace(/\D/g, ""))}
                                placeholder="6-digit OTP" maxLength={6} autoComplete="one-time-code" inputMode="numeric"
                                className="cy-input"
                                style={{ ...inputStyle, color: "#FFFFFF", WebkitTextFillColor: "#FFFFFF" }} />
                            </div>
                          </div>
                          <button type="button" onClick={handleVerifyOtp} disabled={!!loading.verify}
                            className="cy-btn-primary" style={btnPrimary}>
                            <span>✅</span>
                            <span>{loading.verify ? "Please wait…" : "Verify & Access Portal"}</span>
                          </button>
                        </>
                      )}
                    </>
                  )}
                </div>
              )}

              {tab === "register" && (
                <div>
                  <Alert msg={regAlert.msg} type={regAlert.type} />

                  <div style={{ marginBottom: "1rem" }}>
                    <label style={labelStyle}>Full Name <span style={{ color: "#ef4444" }}>*</span></label>
                    <div style={{ position: "relative" }}>
                      <span style={iconStyle}>👤</span>
                      <input type="text" value={regName} onChange={e => setRegName(e.target.value)}
                        placeholder="Enter your full name" autoComplete="name"
                        className="cy-input" style={inputStyle} />
                    </div>
                  </div>

                  <div style={{ marginBottom: "1rem" }}>
                    <label style={labelStyle}>Officer / Employee ID <span style={{ color: "#ef4444" }}>*</span></label>
                    <div style={{ position: "relative" }}>
                      <span style={iconStyle}>🪪</span>
                      <input type="text" value={regBadge} onChange={e => setRegBadge(e.target.value)}
                        placeholder="Enter your Badge / Employee ID"
                        className="cy-input" style={inputStyle} />
                    </div>
                  </div>

                  <div style={{ marginBottom: "1rem" }}>
                    <label style={labelStyle}>Official Email Address <span style={{ color: "#ef4444" }}>*</span></label>
                    <div style={{ position: "relative" }}>
                      <span style={iconStyle}>✉️</span>
                      <input type="email" value={regEmail} onChange={e => setRegEmail(e.target.value)}
                        placeholder="Enter your official email" autoComplete="email"
                        className="cy-input" style={inputStyle} />
                    </div>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1rem" }}>
                    <div>
                      <label style={labelStyle}>Department / Unit <span style={{ color: "#ef4444" }}>*</span></label>
                      <div style={{ position: "relative" }}>
                        <span style={iconStyle}>🏢</span>
                        <select value={regDept} onChange={e => setRegDept(e.target.value)}
                          className="cy-input cy-select"
                          style={{ ...inputStyle, cursor: "pointer", appearance: "none",
                            backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E\")",
                            backgroundRepeat: "no-repeat", backgroundPosition: "right 1rem center",
                            backgroundSize: 16, paddingRight: "2.5rem",
                          }}>
                          <option value="">Select Department</option>
                          <option value="CTI">Cyber Threat Intelligence</option>
                          <option value="IR">Incident Response</option>
                          <option value="SOC">Security Operations (SOC)</option>
                          <option value="DFIR">Digital Forensics (DFIR)</option>
                          <option value="LE">Law Enforcement Liaison</option>
                          <option value="OSINT">OSINT &amp; Analytics</option>
                          <option value="GRC">Governance, Risk &amp; Compliance</option>
                          <option value="ADMIN">Administration</option>
                        </select>
                      </div>
                    </div>
                    <div>
                      <label style={labelStyle}>Designation / Rank <span style={{ color: "#ef4444" }}>*</span></label>
                      <div style={{ position: "relative" }}>
                        <span style={iconStyle}>🛡️</span>
                        <select value={regDesig} onChange={e => setRegDesig(e.target.value)}
                          className="cy-input cy-select"
                          style={{ ...inputStyle, cursor: "pointer", appearance: "none",
                            backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E\")",
                            backgroundRepeat: "no-repeat", backgroundPosition: "right 1rem center",
                            backgroundSize: 16, paddingRight: "2.5rem",
                          }}>
                          <option value="">Select Rank</option>
                          <option value="analyst_l1">Analyst Level I</option>
                          <option value="analyst_l2">Analyst Level II</option>
                          <option value="senior_analyst">Senior Analyst</option>
                          <option value="team_lead">Team Lead / Officer</option>
                          <option value="investigator">Investigator</option>
                          <option value="admin">Administrator</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  <div style={{ marginBottom: "1rem" }}>
                    <label style={labelStyle}>Contact Number (Optional)</label>
                    <div style={{ position: "relative" }}>
                      <span style={iconStyle}>📞</span>
                      <input type="tel" value={regPhone} onChange={handleRegPhoneChange}
                        placeholder="98XXXXXXXX" autoComplete="tel" inputMode="tel" maxLength={10}
                        className="cy-input"
                        style={{ ...inputStyle, color: "#FFFFFF", WebkitTextFillColor: "#FFFFFF" }} />
                    </div>
                  </div>

                  <div style={{ marginBottom: "1rem" }}>
                    <label style={labelStyle}>Set Passphrase <span style={{ color: "#ef4444" }}>*</span></label>
                    <PasswordInput id="registerPassword" placeholder="Min 8 characters"
                      value={regPassword} onChange={e => setRegPassword(e.target.value)} />
                  </div>

                  <button type="button" onClick={handleRegister} disabled={!!loading.register}
                    className="cy-btn-primary" style={btnPrimary}>
                    <span>🛡️</span>
                    <span>{loading.register ? "Please wait…" : "Register Account"}</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        <footer style={{
          background: "#0D1835", borderTop: "1px solid #1E3A6E",
          padding: "2rem 1rem", textAlign: "center", position: "relative", zIndex: 1,
        }}>
          <p style={{ color: "#4A6080", fontSize: "0.8125rem", margin: 0 }}>
            © 2026 <strong style={{ color: "#3B82F6" }}>CyIntel</strong> — Cyber Intelligence Platform. All rights reserved.
          </p>
          <p style={{ color: "#4A6080", fontSize: "0.78rem", marginTop: 4 }}>
            A <strong style={{ color: "#3B82F6" }}>Government of Karnataka</strong> Initiative &nbsp;|&nbsp; Department of Electronics, IT, BT &amp; S&amp;T
          </p>
          <p style={{ color: "#4A6080", fontSize: "0.72rem", marginTop: 4, opacity: 0.6 }}>
            Unauthorised access is strictly prohibited and may result in legal action.
          </p>
        </footer>

        <style>{`
          .cy-auth-container { grid-template-columns: 1fr 1fr !important; }
          @media (max-width: 768px) {
            .cy-auth-container { grid-template-columns: 1fr !important; max-width: 500px !important; }
          }
        `}</style>
      </div>
    </>
  );
}
