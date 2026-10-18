import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
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

export const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// getAuth() already uses browser-local persistence in supported browser environments.
// Do not call setPersistence() again at module startup: it can migrate/reset the
// current user while Firestore listeners and writes are being initialized.
export const auth = getAuth(app);

// Automatically select the appropriate Firestore transport for this browser/network.
export const db = initializeFirestore(app, {
  experimentalAutoDetectLongPolling: true
});
