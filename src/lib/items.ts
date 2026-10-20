import { useEffect, useState } from "react";
import {
  collection,
  deleteDoc,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { db } from "./firebase";
import type { Privacy } from "./settings";

export type ItemKind = "video" | "short";
/**
 * queued    – file is in the user's Drive; Autopilot uploads it before publishAt
 * uploading – upload in progress (a browser tab or Autopilot)
 * scheduled – on YouTube as private, YouTube will publish at publishAt
 * uploaded  – on YouTube with its final privacy
 * failed    – last upload attempt failed
 */
export type ItemStatus = "queued" | "uploading" | "scheduled" | "uploaded" | "failed";

export type StoredFile = {
  name: string;
  size: number;
  type: string;
  storage: "drive";
  /** Google Drive file id. */
  path: string;
};

export type Item = {
  id: string;
  kind: ItemKind;
  title: string;
  description: string;
  tags: string[];
  categoryId: string;
  privacy: Privacy;
  madeForKids: boolean;
  notifySubscribers: boolean;
  /** Planned (queued) or booked (scheduled) publish time in ms, or null to publish on upload. */
  publishAt: number | null;
  status: ItemStatus;
  youtubeId: string | null;
  file: StoredFile | null;
  thumb: StoredFile | null;
  error: string | null;
  createdAt: number;
  updatedAt: number;
  uploadedAt: number | null;
};

const itemsCol = (uid: string) => collection(db, "users", uid, "items");

export function newItemId() {
  return crypto.randomUUID().replace(/-/g, "").slice(0, 20);
}

export function useItems(uid: string) {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(
    () =>
      onSnapshot(
        query(itemsCol(uid), orderBy("createdAt", "desc"), limit(500)),
        (snap) => {
          setItems(snap.docs.map((d) => ({ ...(d.data() as Item), id: d.id })));
          setLoading(false);
        },
        () => setLoading(false),
      ),
    [uid],
  );
  return { items, loading };
}

export function saveItem(uid: string, item: Item) {
  const { id, ...data } = item;
  return setDoc(doc(itemsCol(uid), id), data);
}

export function patchItem(uid: string, id: string, patch: Partial<Item>) {
  return updateDoc(doc(itemsCol(uid), id), { ...patch, updatedAt: Date.now() });
}

export function removeItem(uid: string, id: string) {
  return deleteDoc(doc(itemsCol(uid), id));
}

export const STATUS_LABEL: Record<ItemStatus, string> = {
  queued: "In queue",
  uploading: "Uploading",
  scheduled: "Scheduled",
  uploaded: "Uploaded",
  failed: "Failed",
};
