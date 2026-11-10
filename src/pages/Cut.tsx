import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { ExternalLink, RefreshCw, Smartphone, Video } from "lucide-react";
import { Button, Segmented, Spinner, useToast } from "../components/ui";
import { VIDEOCUT_URL, type CutClip } from "../components/VideoCutModal";

type Kind = "short" | "video";

const VIDEOCUT_ORIGIN = new URL(VIDEOCUT_URL).origin;

const isAllowedVideoCutOrigin = (origin: string) => {
  return (
    origin === VIDEOCUT_ORIGIN ||
    origin.includes("videocut.codelove.in") ||
    origin.includes("localhost:3000") ||
    origin.includes("localhost:3001") ||
    origin.includes("127.0.0.1:3000") ||
    origin.includes("127.0.0.1:3001")
  );
};

// Store incoming clips from the cut page to hand off to the upload / ready to post workflow
let cuttingStudioClips: CutClip[] | null = null;
export const takeStudioClips = (): CutClip[] | null => {
  const c = cuttingStudioClips;
  cuttingStudioClips = null;
  return c;
};

export default function CutPage() {
  const [kind, setKind] = useState<Kind>("short");
  const [ready, setReady] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const frame = useRef<HTMLIFrameElement>(null);
  const toast = useToast();
  const navigate = useNavigate();

  const src = `${VIDEOCUT_URL}/?embed=utubeflow&kind=${kind}`;

  const sendInit = useCallback(() => {
    const theme = document.documentElement.dataset.theme === "light" ? "light" : "dark";
    const payload = { type: "utubeflow:init", kind, theme };
    try {
      frame.current?.contentWindow?.postMessage(payload, "*");
    } catch {}
    try {
      frame.current?.contentWindow?.postMessage(payload, VIDEOCUT_ORIGIN);
    } catch {}
  }, [kind]);

  const handleIframeLoad = useCallback(() => {
    sendInit();
    // After load event, clear the loading screen after a short grace period
    const t = window.setTimeout(() => {
      setReady(true);
      sendInit();
    }, 1200);
    return () => window.clearTimeout(t);
  }, [sendInit]);

  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (!isAllowedVideoCutOrigin(e.origin) || e.source !== frame.current?.contentWindow) return;
      const data = e.data as { type?: string; clips?: { name?: string; type?: string; blob?: Blob; title?: string; description?: string }[] };

      if (data?.type === "videocut:ready") {
        setReady(true);
        sendInit();
        return;
      }

      if (data?.type === "videocut:clips" && Array.isArray(data.clips)) {
        const parsed: CutClip[] = data.clips
          .filter((c): c is { name: string; type: string; blob: Blob; title: string; description?: string } => c.blob instanceof Blob && typeof c.name === "string")
          .map((c) => ({
            file: new File([c.blob], c.name.slice(0, 200), { type: c.type || "video/mp4" }),
            title: c.title || "",
            description: c.description || "",
          }));

        try {
          frame.current?.contentWindow?.postMessage({ type: "utubeflow:received", count: parsed.length }, e.origin);
        } catch {}

        if (parsed.length > 0) {
          cuttingStudioClips = parsed;
          toast("ok", `Received ${parsed.length} cut clip${parsed.length > 1 ? "s" : ""} from VideoCut!`);
          navigate(`/upload/${kind}?from=videocut`);
        }
      }
    };

    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [kind, navigate, toast, sendInit]);

  return (
    <div className="flex flex-col w-full min-h-[calc(100dvh-4rem)]">
      {/* Sleek top control bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6 border-b border-line bg-card/60 backdrop-blur shrink-0">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-sm sm:text-base">VideoCut Studio</span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-accent-soft text-accent">
              Connected
            </span>
          </div>
          <div className="hidden sm:block text-xs text-muted truncate">
            Cut videos into 30s vertical Shorts or equal parts, then send directly to Ready to Post.
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Segmented
            value={kind}
            onChange={(k) => setKind(k as Kind)}
            options={[
              { value: "short", label: "Shorts (9:16)", icon: <Smartphone className="size-3.5" /> },
              { value: "video", label: "Videos (Parts)", icon: <Video className="size-3.5" /> },
            ]}
          />
          <Button
            variant="secondary"
            size="sm"
            icon={<RefreshCw className="size-3.5" />}
            onClick={() => {
              setReady(false);
              setAttempt((a) => a + 1);
            }}
            title="Reload VideoCut Studio"
          >
            Reload
          </Button>
          <a
            href={src}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-xl border border-line bg-card hover:bg-card-hover text-muted hover:text-fg transition"
            title="Open in new tab"
          >
            <ExternalLink className="size-3.5" />
            <span className="hidden sm:inline">Direct URL</span>
          </a>
        </div>
      </div>

      {/* Edge-to-edge VideoCut Embed (No extra boxes, no margins) */}
      <div className="relative flex-1 w-full min-h-[calc(100dvh-8rem)]">
        {!ready && (
          <div className="absolute inset-0 z-10 grid place-items-center bg-bg/95 p-6">
            <div className="flex flex-col items-center gap-3 text-sm text-muted">
              <Spinner />
              <span>Connecting to VideoCut Studio…</span>
              <a
                href={src}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 text-xs text-accent underline"
              >
                Having trouble? Open directly in new tab
              </a>
            </div>
          </div>
        )}

        <iframe
          key={attempt}
          ref={frame}
          src={src}
          title="VideoCut Studio"
          onLoad={handleIframeLoad}
          allow="fullscreen; clipboard-write; display-capture; camera; microphone"
          className="w-full h-[calc(100dvh-8rem)] min-h-[720px] border-0 block"
        />
      </div>
    </div>
  );
}
