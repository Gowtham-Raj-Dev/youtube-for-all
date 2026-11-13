import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { CheckCircle2, RefreshCw } from "lucide-react";
import { Spinner, useToast } from "../components/ui";
import { useUser } from "../lib/auth";
import { useSettings } from "../lib/settings";
import { newItemId, saveItem, type Item } from "../lib/items";
import { rememberMemoryFile } from "../lib/uploads";
import { parseTags } from "../lib/meta";
import { VIDEOCUT_URL, type CutClip } from "../components/VideoCutModal";

type Kind = "short" | "video";

const VIDEOCUT_ORIGIN = new URL(VIDEOCUT_URL).origin;

const isAllowedVideoCutOrigin = (origin: string) =>
  origin === VIDEOCUT_ORIGIN ||
  origin === "https://videocut.codelove.in" ||
  /^http:\/\/(localhost|127\.0\.0\.1):30\d\d$/.test(origin);

const currentTheme = (): "dark" | "light" => (document.documentElement.dataset.theme === "dark" ? "dark" : "light");

// Clips sent from the studio, handed to the upload page.
let cuttingStudioClips: CutClip[] | null = null;
export const takeStudioClips = (): CutClip[] | null => {
  const c = cuttingStudioClips;
  cuttingStudioClips = null;
  return c;
};

/**
 * VideoCut Studio inside UTubeFlow: one tool to split a video into Shorts / parts and edit it.
 * Whatever it sends lands in the upload list — Shorts or Videos, decided by the frame shape.
 */
export default function CutPage() {
  const [ready, setReady] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const frame = useRef<HTMLIFrameElement>(null);
  const navigate = useNavigate();
  const toast = useToast();
  const user = useUser();
  const { settings } = useSettings();
  // Clips coming in from the studio: saved straight to Ready to Post.
  const [saving, setSaving] = useState<{ done: number; total: number } | null>(null);
  const savingRef = useRef(false);

  const saveToReady = useCallback(
    async (clips: CutClip[], kind: Kind) => {
      if (savingRef.current) return;
      savingRef.current = true;
      setSaving({ done: 0, total: clips.length });
      const d = settings.defaults;
      try {
        const now = Date.now();
        for (let i = 0; i < clips.length; i++) {
          const c = clips[i];
          let desc = (c.description ?? "").trim();
          if (d.descriptionFooter.trim()) desc = `${desc}\n\n${d.descriptionFooter.trim()}`.trim();
          if (kind === "short" && d.addShortsTag && !/#shorts\b/i.test(`${c.title} ${desc}`)) desc = `${desc}\n\n#Shorts`.trim();
          const id = newItemId();
          const item: Item = {
            kind,
            title: (c.title.trim() || c.file.name.replace(/\.[^.]+$/, "")).slice(0, 100),
            description: desc.slice(0, 5000),
            tags: parseTags(d.tags),
            categoryId: d.categoryId,
            privacy: d.privacy,
            madeForKids: d.madeForKids,
            notifySubscribers: d.notifySubscribers,
            publishAt: null,
            id,
            status: "draft",
            youtubeId: null,
            file: { name: c.file.name, size: c.file.size, type: c.file.type, storage: "drive", path: "" },
            thumb: null,
            error: null,
            createdAt: now + i,
            updatedAt: now,
            uploadedAt: null,
          };
          rememberMemoryFile(id, c.file, null);
          // The write lands in the local cache at once (Ready to Post shows it); the server copy syncs in the background.
          saveItem(user.uid, item).catch((err) => toast("error", `Could not save “${item.title}”: ${(err as Error).message}`));
          setSaving({ done: i + 1, total: clips.length });
          await new Promise((r) => setTimeout(r, 120));
        }
        toast("ok", `${clips.length} clip${clips.length > 1 ? "s" : ""} added to Ready to Post`);
        navigate("/ready");
      } catch (err) {
        toast("error", (err as Error).message || "Could not save the clips.");
        setSaving(null);
      } finally {
        savingRef.current = false;
      }
    },
    [navigate, settings.defaults, toast, user.uid],
  );

  const src = `${VIDEOCUT_URL}/cutter/?embed=utubeflow&kind=auto`;

  const sendInit = useCallback(() => {
    const payload = { type: "utubeflow:init", kind: "auto", theme: currentTheme() };
    try {
      frame.current?.contentWindow?.postMessage(payload, VIDEOCUT_ORIGIN);
    } catch {}
  }, []);

  // Theme toggled while the studio is open: tell it, so it switches too.
  useEffect(() => {
    const mo = new MutationObserver(sendInit);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => mo.disconnect();
  }, [sendInit]);

  const onLoad = useCallback(() => {
    sendInit();
    window.setTimeout(() => {
      setReady(true);
      sendInit();
    }, 1500);
  }, [sendInit]);

  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (!isAllowedVideoCutOrigin(e.origin) || e.source !== frame.current?.contentWindow) return;
      const data = e.data as { type?: string; kind?: string; clips?: { name?: string; type?: string; blob?: Blob; title?: string; description?: string }[] };

      if (data?.type === "videocut:ready") {
        setReady(true);
        try {
          frame.current?.contentWindow?.postMessage({ type: "utubeflow:init", kind: "auto", theme: currentTheme() }, e.origin);
        } catch {}
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

        if (parsed.length > 0) saveToReady(parsed, data.kind === "video" ? "video" : "short");
      }
    };

    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [saveToReady]);

  return (
    // Full height under the top bar; on phones the bottom tab bar takes 4rem more.
    <div className="relative h-[calc(100dvh-8rem)] w-full lg:h-[calc(100dvh-4rem)]">
      {!ready && (
        <div className="absolute inset-0 z-10 grid place-items-center bg-bg-soft p-6">
          <div className="flex flex-col items-center gap-3 text-sm text-muted">
            <Spinner />
            <span>Opening VideoCut Studio…</span>
            <button
              onClick={() => {
                setReady(false);
                setAttempt((a) => a + 1);
              }}
              className="mt-1 inline-flex items-center gap-1.5 text-xs font-medium text-accent hover:underline"
            >
              <RefreshCw className="size-3.5" /> Taking long? Reload
            </button>
          </div>
        </div>
      )}
      {saving && (
        <div className="absolute inset-0 z-20 grid place-items-center bg-bg-soft/85 p-6 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl border border-line bg-card p-6 text-center shadow-[var(--shadow-card)]">
            {saving.done < saving.total ? <Spinner className="mx-auto size-7" /> : <CheckCircle2 className="mx-auto size-7 text-ok" />}
            <div className="mt-3 font-semibold">Adding to Ready to Post</div>
            <div className="mt-1 text-sm text-muted tabular-nums">
              {saving.done} of {saving.total} clip{saving.total > 1 ? "s" : ""}
            </div>
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-bg-soft">
              <div className="grad-bg h-full rounded-full transition-all" style={{ width: `${Math.max(6, (saving.done / saving.total) * 100)}%` }} />
            </div>
          </div>
        </div>
      )}
      <iframe
        key={attempt}
        ref={frame}
        src={src}
        title="VideoCut Studio"
        onLoad={onLoad}
        allow="fullscreen; clipboard-write"
        className="block h-full w-full border-0 bg-bg-soft"
      />
    </div>
  );
}
