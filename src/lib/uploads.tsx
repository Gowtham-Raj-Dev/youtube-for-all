// Runs browser uploads at the app-shell level so they keep going while the user moves between pages.

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { useUser } from "./auth";
import { useSettings } from "./settings";
import { useYouTube } from "./youtube-context";
import { patchItem, type Item } from "./items";
import { clearStoredToken, setThumbnail, uploadVideo, YouTubeError } from "./youtube";
import { downloadFromDrive, trashDriveFile } from "./google";
import { isReady, setRowStatus } from "./autopilot";

export type Job = { itemId: string; title: string; phase: "preparing" | "uploading" | "thumbnail"; progress: number };

type UploadsState = {
  jobs: Record<string, Job>;
  /**
   * Upload an item to YouTube from this browser. `files` are the picked files (direct uploads);
   * without them the files are fetched from the user's Drive (queued items).
   */
  run: (item: Item, files?: { video: Blob; thumb?: Blob | null }) => Promise<void>;
  cancel: (itemId: string) => void;
};

const UploadsContext = createContext<UploadsState | null>(null);

/** Files picked for direct upload, kept in memory so a failed upload can be retried this session. */
const memoryFiles = new Map<string, { video: Blob; thumb?: Blob | null }>();

export function UploadsProvider({ children }: { children: ReactNode }) {
  const user = useUser();
  const { settings } = useSettings();
  const yt = useYouTube();
  const [jobs, setJobs] = useState<Record<string, Job>>({});
  const aborts = useRef(new Map<string, AbortController>());
  const autopilot = isReady(settings.autopilot) ? settings.autopilot : null;

  const setJob = (id: string, patch: Partial<Job> | null) =>
    setJobs((j) => {
      const next = { ...j };
      if (patch === null) delete next[id];
      else next[id] = { ...(next[id] as Job), ...patch };
      return next;
    });

  useEffect(() => {
    if (!Object.keys(jobs).length) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [jobs]);

  const run = useCallback(
    async (item: Item, files?: { video: Blob; thumb?: Blob | null }) => {
      if (aborts.current.has(item.id)) return;
      if (files) memoryFiles.set(item.id, files);
      const ctrl = new AbortController();
      aborts.current.set(item.id, ctrl);
      setJob(item.id, { itemId: item.id, title: item.title, phase: "preparing", progress: 0 });
      const fromDrive = !memoryFiles.has(item.id) && item.file?.storage === "drive";
      let token = "";
      try {
        token = await yt.ensureToken(fromDrive);
        await patchItem(user.uid, item.id, { status: "uploading", error: null });
        // Tell Autopilot to keep its hands off this one.
        if (fromDrive && autopilot) await setRowStatus(token, autopilot, item.id, "uploading");

        const mem = memoryFiles.get(item.id);
        const video = mem?.video ?? (item.file ? await downloadFromDrive(token, item.file.path) : null);
        if (!video) throw new Error("The video file is gone. Delete this item and add the video again.");
        const thumb = mem?.thumb ?? (item.thumb ? await downloadFromDrive(token, item.thumb.path).catch(() => null) : null);

        // A planned time that already passed means "publish now".
        const publishAt = item.publishAt && item.publishAt > Date.now() + 2 * 60_000 ? item.publishAt : null;

        setJob(item.id, { phase: "uploading", progress: 0 });
        const videoId = await uploadVideo(token, video, { ...item, publishAt }, (p) => setJob(item.id, { progress: p }), ctrl.signal);

        let warning: string | null = null;
        if (thumb) {
          setJob(item.id, { phase: "thumbnail" });
          try {
            await setThumbnail(token, videoId, thumb);
          } catch (e) {
            warning = `Video uploaded, but the thumbnail was not set: ${(e as Error).message} (custom thumbnails need a phone-verified channel).`;
          }
        }

        const status = publishAt ? "scheduled" : "uploaded";
        if (fromDrive && autopilot) {
          await setRowStatus(token, autopilot, item.id, status, videoId, warning ?? "");
          if (item.file) await trashDriveFile(token, item.file.path);
          if (item.thumb) await trashDriveFile(token, item.thumb.path);
        }
        memoryFiles.delete(item.id);
        await patchItem(user.uid, item.id, {
          status,
          publishAt,
          youtubeId: videoId,
          uploadedAt: Date.now(),
          error: warning,
          file: null,
          thumb: null,
        });
      } catch (e) {
        const msg = (e as Error).message;
        if (e instanceof YouTubeError && e.reason === "authExpired") clearStoredToken(settings.youtubeClientId);
        // Hand a Drive item back to Autopilot so it can try again by itself.
        if (fromDrive && autopilot && token) await setRowStatus(token, autopilot, item.id, "queued", "", msg).catch(() => {});
        await patchItem(user.uid, item.id, { status: fromDrive ? "queued" : "failed", error: msg }).catch(() => {});
        throw e;
      } finally {
        aborts.current.delete(item.id);
        setJob(item.id, null);
      }
    },
    [settings.youtubeClientId, autopilot, user.uid, yt],
  );

  const cancel = useCallback((id: string) => aborts.current.get(id)?.abort(), []);

  return <UploadsContext.Provider value={{ jobs, run, cancel }}>{children}</UploadsContext.Provider>;
}

export function useUploads() {
  const ctx = useContext(UploadsContext);
  if (!ctx) throw new Error("useUploads outside UploadsProvider");
  return ctx;
}

export const hasMemoryFile = (id: string) => memoryFiles.has(id);
