// Where queued video files live until they are uploaded to YouTube:
//  • "firebase" — the user's own Firebase Storage bucket (works across devices)
//  • "browser"  — IndexedDB in this browser only (no setup, no card needed)

import { del, get, set } from "idb-keyval";
import type { StoredFile } from "./items";
import type { Settings } from "./settings";
import { deleteUserFile, getUserFile, putUserFile } from "./userFirebase";

export async function storeFile(
  settings: Settings,
  key: string,
  file: File,
  onProgress?: (f: number) => void,
): Promise<StoredFile> {
  const base = { name: file.name, size: file.size, type: file.type };
  if (settings.storageMode === "firebase") {
    if (!settings.userFirebase) throw new Error("Your Firebase Storage is not connected. Set it up in Settings → Storage.");
    const path = await putUserFile(settings.userFirebase, `${key}/${safeName(file.name)}`, file, onProgress);
    return { ...base, storage: "firebase", path };
  }
  await navigator.storage?.persist?.().catch(() => false);
  const path = `file:${key}`;
  await set(path, file);
  onProgress?.(1);
  return { ...base, storage: "browser", path };
}

export async function loadFile(settings: Settings, f: StoredFile): Promise<Blob> {
  if (f.storage === "firebase") {
    if (!settings.userFirebase) throw new Error("This file is in your Firebase Storage, but Storage is not connected in Settings.");
    return getUserFile(settings.userFirebase, f.path);
  }
  const blob = await get<Blob>(f.path);
  if (!blob) throw new Error("This file was saved in another browser or the browser data was cleared. Add the video again.");
  return blob;
}

export async function dropFile(settings: Settings, f: StoredFile | null) {
  if (!f) return;
  if (f.storage === "firebase") {
    if (settings.userFirebase) await deleteUserFile(settings.userFirebase, f.path).catch(() => {});
  } else {
    await del(f.path).catch(() => {});
  }
}

function safeName(name: string) {
  return name.replace(/[^\w.\-]+/g, "_").slice(-120);
}
