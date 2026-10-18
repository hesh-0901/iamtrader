import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, setPersistence, browserLocalPersistence } from "firebase/auth";
import { initializeFirestore } from "firebase/firestore";

// Existing production Firebase Configuration
export const firebaseConfig = {
  apiKey: "AIzaSyAutt6qFIP9lx4Z0yJo-GG6KpfDBXmWFPQ",
  authDomain: "iamtrader.firebaseapp.com",
  projectId: "iamtrader",
  storageBucket: "iamtrader.firebasestorage.app",
  messagingSenderId: "512508952368",
  appId: "1:512508952368:web:451f04647871e3bb8992f5",
  measurementId: "G-2Z3EDNZPX5"
};

// Initialize the app once.
export const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
export const auth = getAuth(app);

export const authPersistenceReady = setPersistence(auth, browserLocalPersistence).catch((error) => {
  console.error("[Firebase Auth] Local persistence initialization failed:", error);
  throw error;
});

// Force long polling to avoid Firestore WebChannel requests being blocked by
// some browser privacy protections, extensions, proxies, or network filters.
// This must be the first Firestore initialization for this app.
export const db = initializeFirestore(app, {
  experimentalForceLongPolling: true
});
