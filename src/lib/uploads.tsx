// Runs uploads at the app-shell level so they keep going while the user moves between pages.
// Two kinds of work:
//  • run(item)      — one browser → YouTube upload (also used by the Queue page)
//  • batches        — many files picked at once, processed one after another with "3 / 10" progress:
//      "youtube"   → each file is uploaded straight to YouTube from this tab
//      "autopilot" → each file is copied to the user's Drive and booked for Autopilot

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { useUser } from "./auth";
import { useToast } from "../components/ui";
import { useSettings } from "./settings";
import { useYouTube } from "./youtube-context";
import { useAutopilot } from "./autopilot-context";
import { patchItem, saveItem, type Item } from "./items";
import { clearStoredToken, setThumbnail, uploadVideo, YouTubeError } from "./youtube";
import { downloadFromDrive, trashDriveFile } from "./google";
import { isReady, setRowStatus } from "./autopilot";

export type Job = { itemId: string; title: string; phase: "preparing" | "uploading" | "thumbnail"; progress: number };

export type QueueBase = Omit<Item, "id" | "file" | "thumb" | "status" | "youtubeId" | "error" | "createdAt" | "updatedAt" | "uploadedAt">;

type Task =
  | { kind: "youtube"; item: Item; video: Blob; thumb: Blob | null }
  | { kind: "autopilot"; base: QueueBase; video: File; thumb: File | null };

export type Batch = {
  id: string;
  kind: Task["kind"];
  total: number;
  done: number;
  failed: number;
  /** Title of the file being processed right now. */
  current: string | null;
  /** Item id of the current YouTube upload (its per-file job is shown inside the batch). */
  currentItemId: string | null;
  /** 0–1 progress of the current file. */
  progress: number;
  errors: string[];
  state: "waiting" | "running" | "finished" | "stopped";
};

type UploadsState = {
  jobs: Record<string, Job>;
  batches: Batch[];
  /**
   * Upload one item to YouTube from this browser. `files` are the picked files (direct uploads);
   * without them the files are fetched from the user's Drive (queued items).
   */
  run: (item: Item, files?: { video: Blob; thumb?: Blob | null }) => Promise<void>;
  /** Many files straight to YouTube, one after another. */
  startYouTubeBatch: (list: { item: Item; video: Blob; thumb: Blob | null }[]) => void;
  /** Many files into the user's Drive for Autopilot, one after another. */
  startAutopilotBatch: (list: { base: QueueBase; video: File; thumb: File | null }[]) => void;
  cancel: (itemId: string) => void;
  stopBatch: (batchId: string) => void;
  dismissBatch: (batchId: string) => void;
  /** True while anything is uploading or waiting. */
  busy: boolean;
  /** Publish times of Autopilot files not saved yet — so new uploads don't take the same slots. */
  reservedTimes: () => number[];
};

const UploadsContext = createContext<UploadsState | null>(null);

/** Files picked for direct upload, kept in memory so a failed upload can be retried this session. */
const memoryFiles = new Map<string, { video: Blob; thumb?: Blob | null }>();

/** Errors after which the rest of a batch can't succeed either. */
const FATAL = /quota|upload limit|session expired|offline|blocked the google popup|window was closed/i;

export function UploadsProvider({ children }: { children: ReactNode }) {
  const user = useUser();
  const { settings } = useSettings();
  const yt = useYouTube();
  const autopilot = useAutopilot();
  const [jobs, setJobs] = useState<Record<string, Job>>({});
  const [batches, setBatches] = useState<Batch[]>([]);
  const aborts = useRef(new Map<string, AbortController>());
  const autopilotCfg = isReady(settings.autopilot) ? settings.autopilot : null;
  const toast = useToast();
  const batchesRef = useRef(batches);
  batchesRef.current = batches;
  // Called when a batch ends; reads the latest batch state on the next tick (after React applies it).
  const finishedRef = useRef((id: string) => {
    setTimeout(() => {
      const b = batchesRef.current.find((x) => x.id === id);
      if (!b) return;
      const what = b.kind === "youtube" ? "uploaded to YouTube" : "added to Autopilot";
      if (b.failed) toast("error", `${b.done} of ${b.total} ${what} · ${b.failed} failed — see the uploads panel.`);
      else toast("ok", `All ${b.total} video${b.total > 1 ? "s" : ""} ${what}.`);
    }, 50);
  });

  const setJob = (id: string, patch: Partial<Job> | null) =>
    setJobs((j) => {
      const next = { ...j };
      if (patch === null) delete next[id];
      else next[id] = { ...(next[id] as Job), ...patch };
      return next;
    });

  const patchBatch = (id: string, patch: Partial<Batch> | ((b: Batch) => Partial<Batch>)) =>
    setBatches((all) => all.map((b) => (b.id === id ? { ...b, ...(typeof patch === "function" ? patch(b) : patch) } : b)));

  const busy = Object.keys(jobs).length > 0 || batches.some((b) => b.state === "running" || b.state === "waiting");

  useEffect(() => {
    if (!busy) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [busy]);

  const run = useCallback(
    async (item: Item, files?: { video: Blob; thumb?: Blob | null }, onProgress?: (p: number) => void) => {
      if (aborts.current.has(item.id)) return;
      if (files) memoryFiles.set(item.id, files);
      const ctrl = new AbortController();
      aborts.current.set(item.id, ctrl);
      setJob(item.id, { itemId: item.id, title: item.title, phase: "preparing", progress: 0 });
      const fromDrive = !memoryFiles.has(item.id) && item.file?.storage === "drive";
      let token = "";
      let driveToken = "";
      try {
        token = await yt.ensureToken();
        if (fromDrive) driveToken = await yt.ensureDriveToken();
        // Firestore applies writes locally at once; don't block the upload on the server ack.
        patchItem(user.uid, item.id, { status: "uploading", error: null }).catch(() => {});
        // Tell Autopilot to keep its hands off this one.
        if (fromDrive && autopilotCfg) await setRowStatus(driveToken, autopilotCfg, item.id, "uploading");

        const mem = memoryFiles.get(item.id);
        const video = mem?.video ?? (item.file ? await downloadFromDrive(driveToken, item.file.path) : null);
        if (!video) throw new Error("The video file is gone. Delete this item and add the video again.");
        const thumb = mem?.thumb ?? (item.thumb ? await downloadFromDrive(driveToken, item.thumb.path).catch(() => null) : null);

        // A planned time that already passed means "publish now".
        const publishAt = item.publishAt && item.publishAt > Date.now() + 2 * 60_000 ? item.publishAt : null;

        setJob(item.id, { phase: "uploading", progress: 0 });
        const videoId = await uploadVideo(
          token,
          video,
          { ...item, publishAt },
          (p) => {
            setJob(item.id, { progress: p });
            onProgress?.(p);
          },
          ctrl.signal,
        );

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
        if (fromDrive && autopilotCfg) {
          await setRowStatus(driveToken, autopilotCfg, item.id, status, videoId, warning ?? "");
          if (item.file) await trashDriveFile(driveToken, item.file.path);
          if (item.thumb) await trashDriveFile(driveToken, item.thumb.path);
        }
        memoryFiles.delete(item.id);
        patchItem(user.uid, item.id, {
          status,
          publishAt,
          youtubeId: videoId,
          uploadedAt: Date.now(),
          error: warning,
          file: null,
          thumb: null,
        }).catch(() => {});
      } catch (e) {
        const msg = (e as Error).message;
        if (e instanceof YouTubeError && e.reason === "authExpired") clearStoredToken(settings.youtubeClientId, "yt");
        // Hand a Drive item back to Autopilot so it can try again by itself.
        if (fromDrive && autopilotCfg && driveToken) await setRowStatus(driveToken, autopilotCfg, item.id, "queued", "", msg).catch(() => {});
        patchItem(user.uid, item.id, { status: fromDrive ? "queued" : "failed", error: msg }).catch(() => {});
        throw e;
      } finally {
        aborts.current.delete(item.id);
        setJob(item.id, null);
      }
    },
    [settings.youtubeClientId, autopilotCfg, user.uid, yt],
  );

  // ---------- Batch worker: one task at a time, across all batches ----------

  // Latest functions for the long-running worker loop (which outlives many renders).
  const runRef = useRef(run);
  runRef.current = run;
  const queueRef = useRef(autopilot.queue);
  queueRef.current = autopilot.queue;

  const pending = useRef<{ batchId: string; task: Task; title: string }[]>([]);
  const stopped = useRef(new Set<string>());
  const working = useRef(false);
  /** What the worker is doing right now (so Stop can also cancel the running upload). */
  const currentTask = useRef<{ batchId: string; itemId: string | null; publishAt: number | null } | null>(null);

  const work = useCallback(async () => {
    if (working.current) return;
    working.current = true;
    try {
      while (pending.current.length) {
        const { batchId, task, title } = pending.current.shift()!;
        if (stopped.current.has(batchId)) continue;
        patchBatch(batchId, { state: "running", current: title, currentItemId: task.kind === "youtube" ? task.item.id : null, progress: 0 });
        currentTask.current = { batchId, itemId: task.kind === "youtube" ? task.item.id : null, publishAt: task.kind === "autopilot" ? task.base.publishAt : null };
        try {
          if (task.kind === "youtube") {
            await runRef.current(task.item, { video: task.video, thumb: task.thumb }, (p) => patchBatch(batchId, { progress: p }));
          } else {
            await queueRef.current(task.base, task.video, task.thumb, (p) => patchBatch(batchId, { progress: p }));
          }
          patchBatch(batchId, (b) => ({ done: b.done + 1, progress: 1 }));
        } catch (e) {
          const msg = (e as Error).message;
          patchBatch(batchId, (b) => ({ failed: b.failed + 1, errors: [...b.errors, `${title}: ${msg}`] }));
          // Quota / sign-in problems: the rest of this batch would fail the same way — stop it.
          if (FATAL.test(msg)) {
            stopped.current.add(batchId);
            const left = pending.current.filter((p) => p.batchId === batchId);
            pending.current = pending.current.filter((p) => p.batchId !== batchId);
            for (const p of left) if (p.task.kind === "youtube") patchItem(user.uid, p.task.item.id, { status: "failed", error: `Not started: ${msg}` }).catch(() => {});
            patchBatch(batchId, (b) => ({ state: "stopped", failed: b.failed + left.length, errors: [...b.errors, `Stopped: ${msg}`] }));
          }
        }
        currentTask.current = null;
        // Mark a batch finished once nothing of it is left.
        if (!pending.current.some((p) => p.batchId === batchId)) {
          patchBatch(batchId, (b) => (b.state === "stopped" ? {} : { state: "finished", current: null, currentItemId: null }));
          finishedRef.current(batchId);
        }
      }
    } finally {
      working.current = false;
    }
  }, [user.uid]);

  const enqueue = useCallback(
    (kind: Task["kind"], tasks: { task: Task; title: string }[]) => {
      if (!tasks.length) return;
      const id = crypto.randomUUID();
      setBatches((all) => [...all, { id, kind, total: tasks.length, done: 0, failed: 0, current: null, currentItemId: null, progress: 0, errors: [], state: "waiting" }]);
      pending.current.push(...tasks.map((t) => ({ batchId: id, ...t })));
      work();
    },
    [work],
  );

  const startYouTubeBatch = useCallback<UploadsState["startYouTubeBatch"]>(
    (list) => {
      // Save every item first so they show up in the Queue/Schedule pages straight away.
      for (const { item } of list) saveItem(user.uid, item).catch(() => {});
      enqueue("youtube", list.map((l) => ({ task: { kind: "youtube" as const, ...l }, title: l.item.title })));
    },
    [enqueue, user.uid],
  );

  const startAutopilotBatch = useCallback<UploadsState["startAutopilotBatch"]>(
    (list) => enqueue("autopilot", list.map((l) => ({ task: { kind: "autopilot" as const, ...l }, title: l.base.title }))),
    [enqueue],
  );

  const cancel = useCallback((id: string) => aborts.current.get(id)?.abort(), []);

  const stopBatch = useCallback(
    (batchId: string) => {
      stopped.current.add(batchId);
      const cur = currentTask.current;
      if (cur?.batchId === batchId && cur.itemId) aborts.current.get(cur.itemId)?.abort();
      const left = pending.current.filter((p) => p.batchId === batchId);
      pending.current = pending.current.filter((p) => p.batchId !== batchId);
      for (const p of left) if (p.task.kind === "youtube") patchItem(user.uid, p.task.item.id, { status: "failed", error: "Stopped before it started." }).catch(() => {});
      patchBatch(batchId, (b) => ({ state: b.state === "finished" ? "finished" : "stopped", failed: b.failed + left.length }));
    },
    [user.uid],
  );

  const reservedTimes = useCallback(
    () =>
      [currentTask.current?.publishAt ?? null, ...pending.current.map((p) => (p.task.kind === "autopilot" ? p.task.base.publishAt : null))].filter(
        (t): t is number => t !== null,
      ),
    [],
  );

  const dismissBatch = useCallback((batchId: string) => setBatches((all) => all.filter((b) => b.id !== batchId)), []);

  return (
    <UploadsContext.Provider value={{ jobs, batches, run, startYouTubeBatch, startAutopilotBatch, cancel, stopBatch, dismissBatch, busy, reservedTimes }}>
      {children}
    </UploadsContext.Provider>
  );
}

export function useUploads() {
  const ctx = useContext(UploadsContext);
  if (!ctx) throw new Error("useUploads outside UploadsProvider");
  return ctx;
}

export const hasMemoryFile = (id: string) => memoryFiles.has(id);
