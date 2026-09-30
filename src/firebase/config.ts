import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

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

// Initialize Firebase safely
export const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
export const auth = getAuth(app);
export const db = getFirestore(app);
