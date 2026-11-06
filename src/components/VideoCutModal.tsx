// VideoCut (videocut.codelove.in) inside a full-screen popup. The user cuts one long video into parts or
// 9:16 Shorts there; the finished clips come back here over postMessage and go straight into the upload list.
//
// Protocol (origins are checked on both sides):
//   VideoCut  → here    : { type: "videocut:ready" }
//   here      → VideoCut: { type: "utubeflow:init", kind, theme }
//   VideoCut  → here    : { type: "videocut:clips", clips: { name, type, blob, title, index, duration }[] }
//   here      → VideoCut: { type: "utubeflow:received", count }

import { useCallback, useEffect, useRef, useState } from "react";
import { Scissors, X } from "lucide-react";
import { Spinner } from "./ui";

export const VIDEOCUT_URL: string = import.meta.env.VITE_VIDEOCUT_URL || "https://videocut.codelove.in";
const VIDEOCUT_ORIGIN = new URL(VIDEOCUT_URL).origin;

export type CutClip = { file: File; title: string };

type IncomingClip = { name?: unknown; type?: unknown; blob?: unknown; title?: unknown };

const toCutClips = (raw: IncomingClip[]): CutClip[] =>
  raw
    .filter((c): c is { name: string; type: string; blob: Blob; title: string } => c.blob instanceof Blob && typeof c.name === "string")
    .map((c) => ({
      file: new File([c.blob], c.name.slice(0, 200), { type: typeof c.type === "string" && c.type ? c.type : "video/mp4" }),
      title: typeof c.title === "string" ? c.title.replace(/[<>]/g, "").slice(0, 100) : "",
    }));

// Clips that arrived on the other upload page (Shorts vs long videos); the right page picks them up on mount.
let pendingClips: CutClip[] | null = null;
export const takePendingVideoCutClips = (): CutClip[] | null => {
  const p = pendingClips;
  pendingClips = null;
  return p;
};

/**
 * Second way in: the user opened UTubeFlow from the VideoCut site ("Connect UTubeFlow"), so VideoCut is our
 * window.opener. We say hello (only to the VideoCut origin), and clips VideoCut sends later land in this list.
 *   here     → VideoCut: { type: "utubeflow:hello", kind }
 *   VideoCut → here    : { type: "videocut:linked" }
 *   VideoCut → here    : { type: "videocut:clips", kind, clips }
 *   here     → VideoCut: { type: "utubeflow:received", count }
 * Returns true while linked.
 */
export function useVideoCutOpener(kind: "short" | "video", onClips: (clips: CutClip[]) => void, goTo: (kind: "short" | "video") => void) {
  const [linked, setLinked] = useState(false);

  useEffect(() => {
    const opener = window.opener as Window | null;
    if (!opener) return;

    const onMessage = (e: MessageEvent) => {
      if (e.origin !== VIDEOCUT_ORIGIN || e.source !== opener) return;
      const data = e.data as { type?: string; kind?: unknown; clips?: IncomingClip[] };
      if (data?.type === "videocut:linked") {
        setLinked(true);
      } else if (data?.type === "videocut:clips" && Array.isArray(data.clips)) {
        const clips = toCutClips(data.clips);
        opener.postMessage({ type: "utubeflow:received", count: clips.length }, VIDEOCUT_ORIGIN);
        if (!clips.length) return;
        const target = data.kind === "short" || data.kind === "video" ? data.kind : kind;
        if (target === kind) {
          onClips(clips);
        } else {
          pendingClips = clips;
          goTo(target);
        }
      }
    };

    window.addEventListener("message", onMessage);
    try {
      opener.postMessage({ type: "utubeflow:hello", kind }, VIDEOCUT_ORIGIN);
    } catch {
      /* opener gone or navigated elsewhere: nothing to link */
    }
    const closedCheck = window.setInterval(() => {
      if (opener.closed) setLinked(false);
    }, 2000);
    return () => {
      window.removeEventListener("message", onMessage);
      window.clearInterval(closedCheck);
    };
  }, [kind, onClips, goTo]);

  return linked;
}

const currentTheme = (): "dark" | "light" => {
  const t = document.documentElement.dataset.theme;
  if (t === "dark" || t === "light") return t;
  return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
};

export function VideoCutModal({
  open,
  kind,
  onClose,
  onClips,
}: {
  open: boolean;
  kind: "short" | "video";
  onClose: () => void;
  onClips: (clips: CutClip[]) => void;
}) {
  const frame = useRef<HTMLIFrameElement>(null);
  const [ready, setReady] = useState(false);

  const sendInit = useCallback(() => {
    frame.current?.contentWindow?.postMessage({ type: "utubeflow:init", kind, theme: currentTheme() }, VIDEOCUT_ORIGIN);
  }, [kind]);

  useEffect(() => {
    if (!open) return;
    setReady(false);

    const onMessage = (e: MessageEvent) => {
      if (e.origin !== VIDEOCUT_ORIGIN || e.source !== frame.current?.contentWindow) return;
      const data = e.data as { type?: string; clips?: IncomingClip[] };

      if (data?.type === "videocut:ready") {
        setReady(true);
        sendInit();
        return;
      }

      if (data?.type === "videocut:clips" && Array.isArray(data.clips)) {
        const clips = toCutClips(data.clips);
        frame.current?.contentWindow?.postMessage({ type: "utubeflow:received", count: clips.length }, VIDEOCUT_ORIGIN);
        if (clips.length) onClips(clips);
      }
    };

    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("message", onMessage);
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("message", onMessage);
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose, onClips, sendInit]);

  if (!open) return null;

  const src = `${VIDEOCUT_URL}/?embed=utubeflow&kind=${kind}`;

  return (
    <div className="fixed inset-0 z-[70] flex items-stretch justify-center bg-black/70 p-0 backdrop-blur-sm sm:p-4" role="dialog" aria-modal="true" aria-label="Cut with VideoCut">
      <div className="flex w-full max-w-[1400px] flex-col overflow-hidden bg-bg shadow-2xl ring-1 ring-line sm:rounded-2xl">
        <div className="flex items-center gap-3 border-b border-line bg-card px-4 py-3">
          <div className="grid size-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-500 text-white">
            <Scissors className="size-4.5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate font-semibold">Cut with VideoCut</div>
            <div className="truncate text-xs text-muted">
              Cut one long video into {kind === "short" ? "9:16 Shorts" : "parts"}, then press <b className="text-fg">Send to UTubeFlow</b>. The clips land in your upload list.
            </div>
          </div>
          <button onClick={onClose} className="grid size-9 place-items-center rounded-xl text-muted transition hover:bg-card-hover hover:text-fg" aria-label="Close">
            <X className="size-5" />
          </button>
        </div>

        <div className="relative flex-1">
          {!ready && (
            <div className="absolute inset-0 grid place-items-center bg-bg">
              <div className="flex flex-col items-center gap-3 text-sm text-muted">
                <Spinner />
                Loading VideoCut…
              </div>
            </div>
          )}
          <iframe
            ref={frame}
            src={src}
            title="VideoCut — cut videos into parts and Shorts"
            onLoad={sendInit}
            allow="fullscreen; clipboard-write"
            className="h-full w-full border-0"
          />
        </div>
      </div>
    </div>
  );
}
