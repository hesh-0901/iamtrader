// IAMTRADER Firebase Web App configuration
// Ces valeurs sont destinées au SDK Firebase côté navigateur.
// Ne jamais mettre ici de credentials Admin SDK / service account.

export const firebaseConfig = {
  apiKey: "AIzaSyAutt6qFIP9lx4Z0yJo-GG6KpfDBXmWFPQ",
  authDomain: "iamtrader.firebaseapp.com",
  projectId: "iamtrader",
  storageBucket: "iamtrader.firebasestorage.app",
  messagingSenderId: "512508952368",
  appId: "1:512508952368:web:451f04647871e3bb8992f5",
  measurementId: "G-2Z3EDNZPX5"
};

export const firebaseConfigured = Object.values(firebaseConfig)
  .filter((value, index) => index < 6)
  .every(Boolean);
