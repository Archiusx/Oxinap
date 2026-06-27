import { initializeApp } from "firebase/app";
import {
  getAuth,
  browserLocalPersistence,
  indexedDBLocalPersistence,
  setPersistence,
} from "firebase/auth";
import { initializeFirestore } from "firebase/firestore";
import { getDatabase } from "firebase/database";

const firebaseConfig = {
  apiKey:            "AIzaSyCjPu3W9L0rSXXf3aVCzmx9fJ9n9HP9K3s",
  authDomain:        "cyintel-cb4c9.firebaseapp.com",
  databaseURL:       "https://cyintel-cb4c9-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId:         "cyintel-cb4c9",
  storageBucket:     "cyintel-cb4c9.firebasestorage.app",
  messagingSenderId: "1067686818980",
  appId:             "1:1067686818980:web:fc491062474f1010b12231",
  measurementId:     "G-W6E553YQGN",
};

export const app  = initializeApp(firebaseConfig);
export const auth = getAuth(app);

export const db = initializeFirestore(app, {
  experimentalAutoDetectLongPolling: true,
});

export const rtdb = getDatabase(app);
export const firebaseProjectId = firebaseConfig.projectId;

// authReady: resolves as soon as persistence is set (or immediately on failure)
// Never rejects — always resolves so app never hangs waiting for this
export const authReady = setPersistence(auth, indexedDBLocalPersistence)
  .catch(() => setPersistence(auth, browserLocalPersistence))
  .catch(() => {}) // swallow all errors — app must still load
  .then(() => true);

// NO ensureAuth, NO signInAnonymously — removed. 
// Those caused double onAuthStateChanged fires and Firestore calls on slow networks.
