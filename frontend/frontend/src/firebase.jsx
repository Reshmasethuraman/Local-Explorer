// ─── FIREBASE CONFIGURATION ─────────────────────────────────────────────────
// Steps to enable Google Sign-In:
// 1. Go to https://console.firebase.google.com
// 2. Create a project (or use existing)
// 3. Go to Authentication → Sign-in method → Enable Google
// 4. Go to Project Settings → General → Your apps → Add Web App
// 5. Copy the firebaseConfig object below and replace the placeholder values
// 6. Run: npm install firebase  (in frontend/frontend)
// ─────────────────────────────────────────────────────────────────────────────

import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut } from "firebase/auth";

// ⚠️  REPLACE THESE WITH YOUR OWN FIREBASE PROJECT CREDENTIALS
const firebaseConfig = {
  apiKey:            "AIzaSyB8DHzLkDjieKA0wnymV8lSTrZWH2UEwR0",
  authDomain:        "local-explorer-c4fca.firebaseapp.com",
  projectId:         "local-explorer-c4fca",
  storageBucket:     "local-explorer-c4fca.firebasestorage.app",
  messagingSenderId:  "978256993197",
  appId:              "1:978256993197:web:7bc810e39d1fe4e2331f24",
  measurementId: "G-X6MKLGWRR6"
};

let app, auth, googleProvider;

try {
  app            = initializeApp(firebaseConfig);
  auth           = getAuth(app);
  googleProvider = new GoogleAuthProvider();
  googleProvider.addScope("email");
  googleProvider.addScope("profile");
} catch (e) {
  console.warn("Firebase not configured. Google login will use demo mode.", e);
}

// ─── GOOGLE SIGN-IN ──────────────────────────────────────────────────────────
export async function signInWithGoogle() {
  if (!auth || firebaseConfig.apiKey === "YOUR_API_KEY") {
    // Demo fallback — remove this block once Firebase is configured
    console.warn("Firebase not configured — using demo Google login");
    return {
      uid:   "demo_google_" + Date.now(),
      email: "demo.google@gmail.com",
      name:  "Demo Google User",
      photo: null,
      provider: "google",
    };
  }
  const result = await signInWithPopup(auth, googleProvider);
  const u = result.user;
  return {
    uid:      u.uid,
    email:    u.email,
    name:     u.displayName || u.email.split("@")[0],
    photo:    u.photoURL,
    provider: "google",
  };
}

// ─── SIGN OUT ────────────────────────────────────────────────────────────────
export async function firebaseSignOut() {
  if (auth) {
    try { await signOut(auth); } catch { /* ignore */ }
  }
}

export { auth };