import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from "firebase/firestore";
import { firebaseConfig, firebaseConfigured } from "../config";

// The app owner's project: login + small per-user documents only. Video files never go here.
// getAuth() throws auth/invalid-api-key on an empty key at import time, which blanks the whole
// page; a placeholder lets App render its "not configured" screen instead.
export const app = initializeApp(firebaseConfigured ? firebaseConfig : { ...firebaseConfig, apiKey: "missing", projectId: "missing" });
export const auth = getAuth(app);
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
});

export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: "select_account" });
