// Keeps the app's list (Firestore) and Autopilot's job sheet in step. The app is the only editor:
// adding/editing/deleting here writes both; the script's progress is pulled back by sync().

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { useUser } from "./auth";
import { useSettings } from "./settings";
import { useYouTube } from "./youtube-context";
import { newItemId, patchItem, removeItem, saveItem, useItems, type Item, type ItemStatus } from "./items";
import { trashDriveFile, uploadToDrive } from "./google";
import {
  addQueueRow,
  deleteQueueRow,
  isReady,
  isRunning,
  readQueue,
  readStatus,
  updateQueueRow,
  type AutopilotConfig,
  type AutopilotStatus,
} from "./autopilot";

type AutopilotState = {
  config: AutopilotConfig | null;
  status: AutopilotStatus | null;
  running: boolean;
  syncing: boolean;
  lastSync: number | null;
  sync: () => Promise<void>;
  setStatus: (s: AutopilotStatus | null) => void;
  /** Saves the video (and thumbnail) to Drive and books it in the queue. */
  queue: (
    base: Omit<Item, "id" | "file" | "thumb" | "status" | "youtubeId" | "error" | "createdAt" | "updatedAt" | "uploadedAt">,
    video: File,
    thumb: File | null,
    onProgress: (f: number) => void,
  ) => Promise<Item>;
  edit: (item: Item, patch: Partial<Item>) => Promise<void>;
  remove: (item: Item) => Promise<void>;
};

const AutopilotContext = createContext<AutopilotState | null>(null);

const SYNC_EVERY = 3 * 60_000;

export function AutopilotProvider({ children }: { children: ReactNode }) {
  const user = useUser();
  const { settings } = useSettings();
  const yt = useYouTube();
  const { items } = useItems(user.uid);
  const config = isReady(settings.autopilot) ? settings.autopilot : null;
  const [status, setStatus] = useState<AutopilotStatus | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<number | null>(null);
  const itemsRef = useRef(items);
  itemsRef.current = items;

  const sync = useCallback(async () => {
    if (!config || !yt.driveAllowed) return;
    setSyncing(true);
    try {
      const token = await yt.ensureToken(true);
      const [rows, st] = await Promise.all([readQueue(token, config), readStatus(token, config)]);
      setStatus(st);
      const byId = new Map(rows.map((r) => [r.id, r]));
      for (const it of itemsRef.current) {
        if (it.file?.storage !== "drive" || !["queued", "uploading", "failed"].includes(it.status)) continue;
        const row = byId.get(it.id);
        if (!row) {
          if (it.status === "queued") await patchItem(user.uid, it.id, { status: "failed", error: "Not found in the Autopilot queue. Delete it and add the video again." });
          continue;
        }
        const s = row.status as ItemStatus;
        if (s === "scheduled" || s === "uploaded") {
          await patchItem(user.uid, it.id, {
            status: s,
            youtubeId: row.youtubeId || null,
            error: row.error || null,
            uploadedAt: Date.now(),
            file: null,
            thumb: null,
          });
        } else if (s !== it.status || (row.error || null) !== it.error) {
          await patchItem(user.uid, it.id, { status: s, error: row.error || null });
        }
      }
      setLastSync(Date.now());
    } finally {
      setSyncing(false);
    }
  }, [config, yt, user.uid]);

  // Sync when the connection comes up, then every few minutes while the app is open.
  useEffect(() => {
    if (!config || !yt.connected || !yt.driveAllowed) return;
    sync().catch(() => {});
    const id = setInterval(() => sync().catch(() => {}), SYNC_EVERY);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config?.sheetId, yt.connected, yt.driveAllowed]);

  const queue: AutopilotState["queue"] = useCallback(
    async (base, video, thumb, onProgress) => {
      if (!config) throw new Error("Set up Autopilot in Settings first.");
      const token = await yt.ensureToken(true);
      const id = newItemId();
      const fileId = await uploadToDrive(token, config.folderId, video, `${id}-${video.name}`, (f) => onProgress(f * (thumb ? 0.97 : 1)));
      const thumbId = thumb ? await uploadToDrive(token, config.folderId, thumb, `${id}-thumb-${thumb.name}`, () => {}) : null;
      onProgress(1);
      const now = Date.now();
      const item: Item = {
        ...base,
        id,
        status: "queued",
        youtubeId: null,
        error: null,
        file: { name: video.name, size: video.size, type: video.type, storage: "drive", path: fileId },
        thumb: thumb && thumbId ? { name: thumb.name, size: thumb.size, type: thumb.type, storage: "drive", path: thumbId } : null,
        createdAt: now,
        updatedAt: now,
        uploadedAt: null,
      };
      try {
        await addQueueRow(token, config, item);
      } catch (e) {
        await trashDriveFile(token, fileId);
        if (thumbId) await trashDriveFile(token, thumbId);
        throw e;
      }
      await saveItem(user.uid, item);
      return item;
    },
    [config, yt, user.uid],
  );

  const edit = useCallback(
    async (item: Item, patch: Partial<Item>) => {
      const next = { ...item, ...patch, status: "queued" as const, error: null };
      if (config && item.file?.storage === "drive") {
        const token = await yt.ensureToken(true);
        await updateQueueRow(token, config, next);
      }
      await patchItem(user.uid, item.id, { ...patch, status: "queued", error: null });
    },
    [config, yt, user.uid],
  );

  const remove = useCallback(
    async (item: Item) => {
      if (config && item.file?.storage === "drive") {
        const token = await yt.ensureToken(true);
        await deleteQueueRow(token, config, item.id);
        await trashDriveFile(token, item.file.path);
        if (item.thumb) await trashDriveFile(token, item.thumb.path);
      }
      await removeItem(user.uid, item.id);
    },
    [config, yt, user.uid],
  );

  return (
    <AutopilotContext.Provider value={{ config, status, running: isRunning(status), syncing, lastSync, sync, setStatus, queue, edit, remove }}>
      {children}
    </AutopilotContext.Provider>
  );
}

export function useAutopilot() {
  const ctx = useContext(AutopilotContext);
  if (!ctx) throw new Error("useAutopilot outside AutopilotProvider");
  return ctx;
}
