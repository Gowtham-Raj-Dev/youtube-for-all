// App-wide settings. The Firebase web config comes from build-time env vars (VITE_FIREBASE_*):
// locally from .env.local (git-ignored), in CI from GitHub Actions secrets. It ends up in the
// public JS bundle anyway, so the real protection is firestore.rules plus the API-key
// restrictions (HTTP referrers + allowed APIs) in Google Cloud Console.

export const APP_NAME = "UTubeFlow";
export const APP_URL = "https://utubeflow.codelove.in";

const env = import.meta.env;

export const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY ?? "",
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN ?? "",
  projectId: env.VITE_FIREBASE_PROJECT_ID ?? "",
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET ?? "",
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID ?? "",
  appId: env.VITE_FIREBASE_APP_ID ?? "",
};

export const firebaseConfigured = Boolean(firebaseConfig.apiKey && firebaseConfig.projectId);
