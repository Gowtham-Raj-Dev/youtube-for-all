// The user's OWN Firebase project, used only for their Storage bucket (queue files).
// It runs as a second, separately named Firebase app with its own Google sign-in,
// so files land in their bucket and count against their quota — never the app owner's.

import { deleteApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInWithPopup, type User } from "firebase/auth";
import { deleteObject, getBlob, getStorage, ref, uploadBytesResumable } from "firebase/storage";
import type { UserFirebaseConfig } from "./settings";

const APP_NAME = "user-storage";

function configKey(c: UserFirebaseConfig) {
  return `${c.projectId}|${c.storageBucket}|${c.apiKey}`;
}

let current: { key: string; app: FirebaseApp } | null = null;

async function userApp(config: UserFirebaseConfig): Promise<FirebaseApp> {
  const key = configKey(config);
  if (current?.key === key) return current.app;
  const existing = getApps().find((a) => a.name === APP_NAME);
  if (existing) await deleteApp(existing);
  const app = initializeApp(config, APP_NAME);
  current = { key, app };
  return app;
}

/** Signs in to the user's project (popup once; the session persists in this browser). */
export async function userStorageSignIn(config: UserFirebaseConfig, email?: string | null): Promise<User> {
  const auth = getAuth(await userApp(config));
  await auth.authStateReady();
  if (auth.currentUser) return auth.currentUser;
  const provider = new GoogleAuthProvider();
  if (email) provider.setCustomParameters({ login_hint: email });
  try {
    return (await signInWithPopup(auth, provider)).user;
  } catch (e) {
    throw new Error(explain(e));
  }
}

export async function userStorageUser(config: UserFirebaseConfig): Promise<User | null> {
  const auth = getAuth(await userApp(config));
  await auth.authStateReady();
  return auth.currentUser;
}

async function storageFor(config: UserFirebaseConfig) {
  const app = await userApp(config);
  const user = await userStorageSignIn(config);
  return { storage: getStorage(app), uid: user.uid };
}

export async function putUserFile(
  config: UserFirebaseConfig,
  name: string,
  file: Blob,
  onProgress?: (f: number) => void,
): Promise<string> {
  const { storage, uid } = await storageFor(config);
  const path = `tubeflow/${uid}/${name}`;
  const task = uploadBytesResumable(ref(storage, path), file, { contentType: file.type || undefined });
  await new Promise<void>((resolve, reject) =>
    task.on(
      "state_changed",
      (s) => onProgress?.(s.bytesTransferred / Math.max(1, s.totalBytes)),
      (e) => reject(new Error(explain(e))),
      () => resolve(),
    ),
  );
  return path;
}

export async function getUserFile(config: UserFirebaseConfig, path: string): Promise<Blob> {
  const { storage } = await storageFor(config);
  try {
    return await getBlob(ref(storage, path));
  } catch (e) {
    throw new Error(explain(e));
  }
}

export async function deleteUserFile(config: UserFirebaseConfig, path: string) {
  const { storage } = await storageFor(config);
  await deleteObject(ref(storage, path)).catch(() => {});
}

/** End-to-end check: sign in → write → read back → delete. Returns the step that failed. */
export async function testUserStorage(config: UserFirebaseConfig, email?: string | null) {
  await userStorageSignIn(config, email);
  const name = `_test-${Date.now()}.txt`;
  let path: string;
  try {
    path = await putUserFile(config, name, new Blob(["ok"], { type: "text/plain" }));
  } catch (e) {
    throw new Error(`Upload test failed: ${(e as Error).message}`);
  }
  try {
    await getUserFile(config, path);
  } catch (e) {
    throw new Error(`Read-back failed (usually CORS is not set on the bucket — see Step 5 of the guide): ${(e as Error).message}`);
  } finally {
    await deleteUserFile(config, path);
  }
}

function explain(e: unknown): string {
  const code = (e as { code?: string })?.code ?? "";
  const msg = (e as Error)?.message ?? String(e);
  if (code === "auth/unauthorized-domain")
    return "This site's domain is not in your Firebase project's Authorized domains. Add it in Authentication → Settings → Authorized domains.";
  if (code === "auth/operation-not-allowed")
    return "Google sign-in is not enabled in your Firebase project. Enable it in Authentication → Sign-in method.";
  if (code === "auth/popup-blocked") return "The browser blocked the sign-in popup. Allow popups for this site.";
  if (code === "auth/popup-closed-by-user") return "The sign-in window was closed before finishing.";
  if (code === "auth/invalid-api-key" || code === "auth/api-key-not-valid.-please-pass-a-valid-api-key.")
    return "The apiKey in your Firebase config is wrong.";
  if (code === "storage/unauthorized")
    return "Your Storage rules blocked this. Paste the rules from the guide (with your email) and publish them.";
  if (code === "storage/bucket-not-found" || code === "storage/project-not-found" || code === "storage/no-default-bucket")
    return "Storage is not set up in your Firebase project, or storageBucket is wrong. Click “Get started” in Firebase → Storage.";
  if (code === "storage/quota-exceeded") return "Your Firebase Storage quota is exceeded.";
  if (code === "storage/retry-limit-exceeded") return "The network kept failing. Try again.";
  if (code === "storage/unknown" && /cors|network/i.test(msg)) return "Network/CORS error — set CORS on your bucket (guide Step 5).";
  return msg;
}

/** Accepts the JS snippet Firebase shows (const firebaseConfig = {...}) or plain JSON. */
export function parseFirebaseConfig(text: string): UserFirebaseConfig {
  const pick = (k: string) => text.match(new RegExp(`["']?${k}["']?\\s*:\\s*["']([^"']+)["']`))?.[1] ?? "";
  const c = {
    apiKey: pick("apiKey"),
    authDomain: pick("authDomain"),
    projectId: pick("projectId"),
    storageBucket: pick("storageBucket"),
    messagingSenderId: pick("messagingSenderId"),
    appId: pick("appId"),
  };
  const missing = (["apiKey", "authDomain", "projectId", "storageBucket", "appId"] as const).filter((k) => !c[k]);
  if (missing.length) throw new Error(`Missing in the config: ${missing.join(", ")}. Copy the whole firebaseConfig block.`);
  return c;
}
