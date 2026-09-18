// IAMTRADER Firebase configuration
// Paste the Web App configuration from Firebase Console here.
// This object is client-side configuration; never put Admin SDK credentials here.
export const firebaseConfig = {
  apiKey: '',
  authDomain: '',
  projectId: '',
  storageBucket: '',
  messagingSenderId: '',
  appId: ''
};

export const firebaseConfigured = Object.values(firebaseConfig).every(Boolean);
