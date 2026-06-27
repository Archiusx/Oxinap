import React, { useState, useEffect } from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import Dashboard from "./dashboard";
import LoginPage from "./LoginPage";
import { LanguageProvider } from "./LanguageContext";
import { auth, db, rtdb, authReady } from "./firebase";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { Analytics } from "@vercel/analytics/react";

const FIRESTORE_TIMEOUT_MS = 5000;

// CRITICAL FIX: without an error boundary, ANY uncaught render-time error
// anywhere in the tree (e.g. a search result missing a field) unmounts the
// whole React app and leaves a blank/white screen with only a console error.
// This boundary catches that, shows a recoverable error screen instead, and
// logs the real error to the console so it can be debugged.
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error) {
    return { error };
  }
  componentDidCatch(error, info) {
    console.error("[CyIntel] Render error:", error, info?.componentStack);
  }
  render() {
    if (this.state.error) {
      return (
        <div style={{ minHeight:"100vh", background:"#050810", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:16, color:"#94a3b8", fontFamily:"system-ui,sans-serif" }}>
          <img src="https://i.ibb.co/XrMWBwQT/IMG-20260609-WA0033.jpg" alt="CyIntel" style={{ width:48, height:48, borderRadius:10, opacity:0.7 }}/>
          <p style={{ fontSize:14 }}>Something went wrong. Please refresh.</p>
          <button onClick={() => this.setState({ error: null })} style={{ padding:"8px 20px", background:"#2563eb", color:"#fff", border:"none", borderRadius:8, cursor:"pointer", fontSize:13 }}>Retry</button>
        </div>
      );
    }
    return this.props.children;
  }
}

// Bug 1 fix: if the user doc doesn't exist yet (first OAuth/phone login before
// LoginPage's upsertUser has finished), create a minimal profile here so the
// dashboard never starts with a broken/missing profile state.
async function fetchUserProfile(u) {
  // Hard timeout: if Firestore takes >4s on slow network, just use Auth user
  const timeout = new Promise(resolve => setTimeout(() => resolve(null), 4000));
  try {
    const result = await Promise.race([_fetchFirestoreProfile(u), timeout]);
    return result || u;
  } catch {
    return u;
  }
}

async function _fetchFirestoreProfile(u) {
  const docRef = doc(db, "users", u.uid);
  try {
    const snap = await Promise.race([
      getDoc(docRef),
      new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), FIRESTORE_TIMEOUT_MS)),
    ]);
    if (snap.exists()) {
      const d = snap.data();
      return {
        ...u,
        ...d,
        photoURL:    d.photoURL    || u.photoURL,
        displayName: d.fullName    || d.displayName || u.displayName,
      };
    }
    // Doc missing — first login race: create a bootstrap profile so downstream
    // code always has a Firestore document to work with.
    const bootstrap = {
      uid:         u.uid,
      fullName:    u.displayName || "CyIntel Operative",
      email:       u.email       || "",
      phone:       u.phoneNumber || "",
      photoURL:    u.photoURL    || "",
      role:        "investigator",
      status:      "active",
      verified:    false,
      authProvider: u.providerData?.[0]?.providerId || "unknown",
      createdAt:   serverTimestamp(),
      updatedAt:   serverTimestamp(),
      lastLogin:   serverTimestamp(),
    };
    await setDoc(docRef, bootstrap, { merge: true });
    console.info("[CyIntel] Bootstrap profile created for UID:", u.uid);
    return { ...u, ...bootstrap, displayName: bootstrap.fullName };
  } catch (e) {
    console.warn("[CyIntel] Firestore fetch/create failed, using Auth user:", e.message);
  }
  return u;
}

function Root() {
  const [user,     setUser]     = useState(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let unsub = () => {};
    let globalTimer;
    let authStateTimer;

    // Absolute max wait: 7s then show login regardless
    globalTimer = setTimeout(() => {
      setChecking(false);
    }, 7000);

    // Wait for persistence, but don't wait more than 3s for that either
    const persistenceReady = Promise.race([
      authReady,
      new Promise(r => setTimeout(r, 3000)),
    ]);

    persistenceReady.then(() => {
      unsub = onAuthStateChanged(auth, async (u) => {
        // Cancel the global timer — auth state arrived
        clearTimeout(globalTimer);
        clearTimeout(authStateTimer);
        try {
          if (u) {
            const profile = await fetchUserProfile(u);
            setUser(profile || u);
          } else {
            setUser(null);
          }
        } catch {
          // Even if profile fetch blows up, set user from auth object
          if (u) setUser(u);
        } finally {
          setChecking(false);
        }
      });

      // If onAuthStateChanged never fires (e.g. Firebase offline), unblock after 4s
      authStateTimer = setTimeout(() => setChecking(false), 4000);
    });

    return () => {
      unsub();
      clearTimeout(globalTimer);
      clearTimeout(authStateTimer);
    };
  }, []);

  if (checking) {
    return (
      <div style={{
        minHeight: "100vh", display: "flex", alignItems: "center",
        justifyContent: "center",
        background: "radial-gradient(ellipse at top,#0D1835 0%,#050810 60%,#000 100%)",
        flexDirection: "column", gap: "1rem",
      }}>
        <img
          src="https://i.ibb.co/XrMWBwQT/IMG-20260609-WA0033.jpg"
          alt="CyIntel"
          style={{ width: 64, height: 64, borderRadius: 12, opacity: 0.9 }}
        />
        <div style={{
          width: 36, height: 36, border: "3px solid #1E3A6E",
          borderTopColor: "#2563EB", borderRadius: "50%",
          animation: "spin 0.8s linear infinite",
        }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return user ? <Dashboard user={user} /> : <LoginPage />;
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <LanguageProvider>
      <ErrorBoundary>
        <Root />
        <Analytics />
      </ErrorBoundary>
    </LanguageProvider>
  </React.StrictMode>
);
