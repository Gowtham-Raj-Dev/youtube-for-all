import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router";
import { CalendarClock, Clapperboard, ImagePlus, ListPlus, Rocket, Smartphone, Trash2, UploadCloud } from "lucide-react";
import { useUser } from "../lib/auth";
import { useSettings, YT_CATEGORIES, type Privacy } from "../lib/settings";
import { newItemId, saveItem, useItems, type Item, type ItemKind } from "../lib/items";
import { useUploads } from "../lib/uploads";
import { useYouTube } from "../lib/youtube-context";
import { storeFile } from "../lib/files";
import { parseTags, tagsLength } from "../lib/meta";
import { fmtBytes, fmtDateTime, fromLocalInput, MIN_LEAD_MS, nextFreeSlot, toLocalInput } from "../lib/schedule";
import { DAILY_QUOTA, UPLOAD_COST, useQuotaUsed } from "../lib/quota";
import { Alert, Button, Card, CardHeader, cx, Field, Input, PageHeader, Progress, Segmented, Select, Textarea, Toggle, useToast } from "../components/ui";

type Mode = "now" | "schedule" | "queue";
type When = "slot" | "custom" | "none";
type VideoInfo = { duration: number; width: number; height: number; url: string };

function readVideoInfo(file: File): Promise<VideoInfo> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const v = document.createElement("video");
    v.preload = "metadata";
    v.onloadedmetadata = () => resolve({ duration: v.duration, width: v.videoWidth, height: v.videoHeight, url });
    v.onerror = () => resolve({ duration: 0, width: 0, height: 0, url });
    v.src = url;
  });
}

function fmtDuration(s: number) {
  const m = Math.floor(s / 60);
  const sec = Math.round(s % 60);
  return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}:${String(sec).padStart(2, "0")}`;
}

export default function UploadPage({ kind }: { kind: ItemKind }) {
  const user = useUser();
  const { settings } = useSettings();
  const yt = useYouTube();
  const uploads = useUploads();
  const { items } = useItems(user.uid);
  const toast = useToast();
  const navigate = useNavigate();
  const quotaUsed = useQuotaUsed();
  const isShort = kind === "short";
  const ytReady = !!settings.youtubeClientId;

  const [file, setFile] = useState<File | null>(null);
  const [info, setInfo] = useState<VideoInfo | null>(null);
  const [thumb, setThumb] = useState<File | null>(null);
  const [thumbUrl, setThumbUrl] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState(settings.defaults.tags);
  const [categoryId, setCategoryId] = useState(settings.defaults.categoryId);
  const [privacy, setPrivacy] = useState<Privacy>(settings.defaults.privacy);
  const [madeForKids, setMadeForKids] = useState(settings.defaults.madeForKids);
  const [notify, setNotify] = useState(settings.defaults.notifySubscribers);
  const [mode, setMode] = useState<Mode>(ytReady ? "now" : "queue");
  const [when, setWhen] = useState<When>("slot");
  const [custom, setCustom] = useState(() => toLocalInput(Date.now() + 3600_000));
  const [saving, setSaving] = useState<number | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  // Defaults arrive asynchronously from Firestore; apply them while the form is untouched.
  const touched = useRef(false);
  useEffect(() => {
    if (touched.current) return;
    setTags(settings.defaults.tags);
    setCategoryId(settings.defaults.categoryId);
    setPrivacy(settings.defaults.privacy);
    setMadeForKids(settings.defaults.madeForKids);
    setNotify(settings.defaults.notifySubscribers);
    if (!ytReady) setMode("queue");
  }, [settings, ytReady]);

  useEffect(() => () => {
    if (info?.url) URL.revokeObjectURL(info.url);
  }, [info]);
  useEffect(() => () => {
    if (thumbUrl) URL.revokeObjectURL(thumbUrl);
  }, [thumbUrl]);

  const slot = useMemo(() => nextFreeSlot(settings.slots, items), [settings.slots, items]);
  const tagList = parseTags(tags);
  const tagLen = tagsLength(tagList);
  const fullDescription = useMemo(() => {
    let d = description.trim();
    if (settings.defaults.descriptionFooter.trim()) d = `${d}\n\n${settings.defaults.descriptionFooter.trim()}`.trim();
    if (isShort && settings.defaults.addShortsTag && !/#shorts\b/i.test(`${title} ${d}`)) d = `${d}\n\n#Shorts`.trim();
    return d;
  }, [description, settings.defaults, isShort, title]);

  const publishAt: number | null =
    mode === "now" ? null : when === "slot" ? slot : when === "custom" ? fromLocalInput(custom) : null;

  const problems: string[] = [];
  if (!file) problems.push("Choose a video file.");
  if (!title.trim()) problems.push("Add a title.");
  if (title.length > 100) problems.push("Title must be 100 characters or less.");
  if (/[<>]/.test(title + fullDescription)) problems.push("Title and description cannot contain < or >.");
  if (fullDescription.length > 5000) problems.push("Description (with footer) must be 5000 characters or less.");
  if (tagLen > 500) problems.push("Tags are over YouTube's 500-character limit.");
  if (mode === "schedule") {
    if (publishAt === null) problems.push(when === "slot" ? "No free slot — add daily times in Settings." : "Pick a publish time.");
    else if (publishAt < Date.now() + MIN_LEAD_MS) problems.push("Schedule time must be at least 15 minutes from now.");
  }
  if (mode === "queue" && when === "custom" && (publishAt === null || publishAt < Date.now())) problems.push("Pick a future time for the queue.");

  const shortWarnings: string[] = [];
  if (isShort && info && info.width) {
    if (info.width > info.height) shortWarnings.push("This video is horizontal. Shorts should be vertical (9:16) or square.");
    if (info.duration > 180) shortWarnings.push(`This video is ${fmtDuration(info.duration)} long. Shorts can be at most 3 minutes.`);
  }
  if (!isShort && info && info.width && info.height > info.width && info.duration <= 180)
    shortWarnings.push("This looks like a Short (vertical, under 3 min). YouTube will treat it as a Short anyway.");

  const pickFile = async (f: File | undefined | null) => {
    if (!f) return;
    if (!f.type.startsWith("video/") && !/\.(mp4|mov|mkv|webm|avi|m4v|wmv|flv|3gp|mpeg|mpg)$/i.test(f.name)) {
      toast("error", "That is not a video file.");
      return;
    }
    touched.current = true;
    setFile(f);
    setInfo(await readVideoInfo(f));
    if (!title) setTitle(f.name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").slice(0, 100));
  };

  const pickThumb = (f: File | undefined | null) => {
    if (!f) return;
    if (!/^image\/(jpeg|png)$/.test(f.type)) return toast("error", "Thumbnail must be a JPG or PNG.");
    if (f.size > 2 * 1024 * 1024) return toast("error", "Thumbnail must be under 2 MB.");
    setThumb(f);
    setThumbUrl(URL.createObjectURL(f));
  };

  const reset = () => {
    setFile(null);
    setInfo(null);
    setThumb(null);
    setThumbUrl(null);
    setTitle("");
    setDescription("");
    touched.current = false;
  };

  const submit = async () => {
    if (!file || problems.length) return;
    const id = newItemId();
    const now = Date.now();
    const base: Item = {
      id,
      kind,
      title: title.trim(),
      description: fullDescription,
      tags: tagList,
      categoryId,
      privacy,
      madeForKids,
      notifySubscribers: notify,
      publishAt,
      status: mode === "queue" ? "queued" : "uploading",
      youtubeId: null,
      file: null,
      thumb: null,
      error: null,
      createdAt: now,
      updatedAt: now,
      uploadedAt: null,
    };

    if (mode === "queue") {
      setSaving(0);
      try {
        const stored = await storeFile(settings, `${id}/video`, file, setSaving);
        const storedThumb = thumb ? await storeFile(settings, `${id}/thumb`, thumb) : null;
        await saveItem(user.uid, { ...base, file: stored, thumb: storedThumb });
        toast("ok", "Saved to your queue.");
        reset();
      } catch (e) {
        toast("error", (e as Error).message);
      } finally {
        setSaving(null);
      }
      return;
    }

    try {
      // Get the token first, inside the click, so the Google popup is not blocked.
      await yt.ensureToken();
    } catch (e) {
      toast("error", (e as Error).message);
      return;
    }
    await saveItem(user.uid, base);
    const video = file;
    const t = thumb;
    reset();
    toast("info", "Upload started — you can keep using the app, just keep this tab open.");
    uploads
      .run(base, { video, thumb: t })
      .then(() => toast("ok", mode === "schedule" ? `“${base.title}” is scheduled for ${fmtDateTime(publishAt!)}.` : `“${base.title}” is uploaded.`))
      .catch((e) => toast("error", `Upload failed: ${(e as Error).message}`));
  };

  const quotaLeft = DAILY_QUOTA - quotaUsed;

  return (
    <>
      <PageHeader
        title={isShort ? "Upload a Short" : "Upload a Video"}
        subtitle={isShort ? "Vertical 9:16, up to 3 minutes." : "Any length your channel allows. Add a custom thumbnail if you like."}
        action={
          <Link to={isShort ? "/upload/video" : "/upload/short"}>
            <Button variant="ghost" icon={isShort ? <Clapperboard className="size-4" /> : <Smartphone className="size-4" />}>
              {isShort ? "Upload a long video instead" : "Upload a Short instead"}
            </Button>
          </Link>
        }
      />

      {!ytReady && (
        <div className="mb-6">
          <Alert tone="warn" title="YouTube is not connected yet" action={<Button size="sm" variant="primary" onClick={() => navigate("/guide")}>Open guide</Button>}>
            You can still add videos to your queue. To upload or schedule, add your OAuth Client ID in Settings.
          </Alert>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
        <div className="space-y-6">
          {/* File */}
          <Card>
            {!file ? (
              <button
                type="button"
                onClick={() => fileInput.current?.click()}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOver(false);
                  pickFile(e.dataTransfer.files[0]);
                }}
                className={cx(
                  "flex w-full flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-14 text-center transition",
                  dragOver ? "border-accent bg-accent-soft" : "border-line hover:border-faint/50 hover:bg-card-hover",
                )}
              >
                <div className="grad-bg mb-4 grid size-14 place-items-center rounded-2xl text-white shadow-lg shadow-accent/30">
                  <UploadCloud className="size-7" />
                </div>
                <div className="font-semibold">Drop your {isShort ? "Short" : "video"} here</div>
                <div className="mt-1 text-sm text-muted">or click to choose · MP4, MOV, WebM…</div>
              </button>
            ) : (
              <div className="flex flex-col gap-4 p-4 sm:flex-row">
                <video
                  src={info?.url}
                  controls
                  className={cx("rounded-xl bg-black object-contain", isShort ? "aspect-[9/16] w-full sm:w-44" : "aspect-video w-full sm:w-72")}
                />
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{file.name}</div>
                  <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted">
                    <span>{fmtBytes(file.size)}</span>
                    {info?.duration ? <span>{fmtDuration(info.duration)}</span> : null}
                    {info?.width ? <span>{info.width}×{info.height}</span> : null}
                  </div>
                  <div className="mt-3 space-y-2">
                    {shortWarnings.map((w) => (
                      <Alert key={w} tone="warn">{w}</Alert>
                    ))}
                  </div>
                  <Button variant="ghost" size="sm" className="mt-3" icon={<Trash2 className="size-4" />} onClick={reset}>
                    Remove
                  </Button>
                </div>
              </div>
            )}
            <input ref={fileInput} type="file" accept="video/*" hidden onChange={(e) => pickFile(e.target.files?.[0])} />
          </Card>

          {/* Details */}
          <Card>
            <CardHeader title="Details" subtitle="This is what viewers see on YouTube." />
            <div className="space-y-5 p-5">
              <Field label="Title" counter={`${title.length}/100`}>
                <Input value={title} maxLength={100} onChange={(e) => ((touched.current = true), setTitle(e.target.value))} placeholder="A title that makes people click" />
              </Field>
              <Field
                label="Description"
                counter={`${fullDescription.length}/5000`}
                hint={settings.defaults.descriptionFooter || (isShort && settings.defaults.addShortsTag) ? "Your default footer / #Shorts is added automatically (change it in Settings)." : undefined}
              >
                <Textarea rows={6} value={description} onChange={(e) => ((touched.current = true), setDescription(e.target.value))} placeholder="Tell viewers what this video is about…" />
              </Field>
              <Field label="Tags" counter={`${tagLen}/500`} hint="Separate with commas.">
                <Input value={tags} onChange={(e) => ((touched.current = true), setTags(e.target.value))} placeholder="comedy, tamil, shorts" />
              </Field>
              {tagList.length > 0 && (
                <div className="-mt-2 flex flex-wrap gap-1.5">
                  {tagList.map((t) => (
                    <span key={t} className="rounded-full bg-bg-soft px-2.5 py-1 text-xs text-muted ring-1 ring-line">{t}</span>
                  ))}
                </div>
              )}
              <div className="grid gap-5 sm:grid-cols-2">
                <Field label="Category">
                  <Select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
                    {YT_CATEGORIES.map(([id, name]) => (
                      <option key={id} value={id}>{name}</option>
                    ))}
                  </Select>
                </Field>
                {!isShort && (
                  <Field label="Thumbnail (optional)" hint="JPG/PNG, 1280×720, under 2 MB">
                    <div className="flex items-center gap-3">
                      {thumbUrl ? (
                        <img src={thumbUrl} alt="" className="aspect-video h-11 rounded-lg object-cover ring-1 ring-line" />
                      ) : null}
                      <label className="flex h-11 flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-line text-sm text-muted transition hover:bg-card-hover hover:text-fg">
                        <ImagePlus className="size-4" /> {thumb ? "Change" : "Choose image"}
                        <input type="file" accept="image/jpeg,image/png" hidden onChange={(e) => pickThumb(e.target.files?.[0])} />
                      </label>
                      {thumb && (
                        <button type="button" onClick={() => (setThumb(null), setThumbUrl(null))} className="text-faint hover:text-danger">
                          <Trash2 className="size-4" />
                        </button>
                      )}
                    </div>
                  </Field>
                )}
              </div>
              <div className="space-y-4 border-t border-line pt-5">
                <Toggle checked={madeForKids} onChange={setMadeForKids} label="Made for kids" hint="Required by law (COPPA). Turns off comments and personalised ads." />
                <Toggle checked={notify} onChange={setNotify} label="Notify subscribers" hint="Send a notification and show it in subscribers' feeds." />
              </div>
            </div>
          </Card>
        </div>

        {/* Publish panel */}
        <div className="space-y-6 lg:sticky lg:top-6 lg:self-start">
          <Card>
            <CardHeader title="Publish" />
            <div className="space-y-5 p-5">
              <Segmented<Mode>
                value={mode}
                onChange={(m) => {
                  setMode(m);
                  if (m !== "queue" && when === "none") setWhen("slot");
                }}
                options={[
                  { value: "now", label: "Now", icon: <Rocket className="size-4" /> },
                  { value: "schedule", label: "Schedule", icon: <CalendarClock className="size-4" /> },
                  { value: "queue", label: "Queue", icon: <ListPlus className="size-4" /> },
                ]}
              />
              <p className="text-xs text-muted">
                {mode === "now" && "Uploads right away with the visibility you pick."}
                {mode === "schedule" && "Uploads now as private; YouTube makes it public at the time you pick — your computer can be off."}
                {mode === "queue" &&
                  `Saves the file to ${settings.storageMode === "firebase" ? "your Firebase Storage" : "this browser"} without uploading. Push it to YouTube later from the Queue.`}
              </p>

              {mode === "now" ? (
                <Field label="Visibility">
                  <Select value={privacy} onChange={(e) => setPrivacy(e.target.value as Privacy)}>
                    <option value="public">Public</option>
                    <option value="unlisted">Unlisted</option>
                    <option value="private">Private</option>
                  </Select>
                </Field>
              ) : (
                <div className="space-y-2">
                  {(
                    [
                      ["slot", slot ? `Next free slot · ${fmtDateTime(slot)}` : "Next free slot · none set"],
                      ["custom", "Pick a date & time"],
                      ...(mode === "queue" ? [["none", "Decide later"]] : []),
                    ] as [When, string][]
                  ).map(([v, label]) => (
                    <label key={v} className={cx("flex cursor-pointer items-center gap-3 rounded-xl border px-3.5 py-3 text-sm transition", when === v ? "border-accent bg-accent-soft" : "border-line hover:bg-card-hover")}>
                      <input type="radio" className="accent-[var(--accent)]" checked={when === v} onChange={() => setWhen(v)} />
                      {label}
                    </label>
                  ))}
                  {when === "custom" && <Input type="datetime-local" value={custom} min={toLocalInput(Date.now())} onChange={(e) => setCustom(e.target.value)} />}
                </div>
              )}

              {mode !== "queue" && quotaLeft < UPLOAD_COST && (
                <Alert tone="warn">About {Math.max(0, quotaLeft)} API units left today; an upload needs {UPLOAD_COST}. It may fail until the quota resets.</Alert>
              )}

              {saving !== null && (
                <div>
                  <div className="mb-1.5 flex justify-between text-xs text-muted">
                    <span>Saving to {settings.storageMode === "firebase" ? "your Firebase Storage" : "this browser"}…</span>
                    <span className="tabular-nums">{Math.round(saving * 100)}%</span>
                  </div>
                  <Progress value={saving} />
                </div>
              )}

              {problems.length > 0 && file && (
                <ul className="space-y-1 text-xs text-danger">
                  {problems.map((p) => (
                    <li key={p}>• {p}</li>
                  ))}
                </ul>
              )}

              <Button
                variant="primary"
                size="lg"
                className="w-full"
                disabled={!!problems.length || (mode !== "queue" && !ytReady)}
                loading={saving !== null}
                onClick={submit}
                icon={mode === "now" ? <Rocket className="size-4.5" /> : mode === "schedule" ? <CalendarClock className="size-4.5" /> : <ListPlus className="size-4.5" />}
              >
                {mode === "now" ? "Upload now" : mode === "schedule" ? "Upload & schedule" : "Add to queue"}
              </Button>
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}
