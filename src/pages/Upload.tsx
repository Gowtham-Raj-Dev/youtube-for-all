import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router";
import { Bot, CalendarClock, Clapperboard, ImagePlus, Plus, Rocket, Smartphone, Trash2, UploadCloud } from "lucide-react";
import { useUser } from "../lib/auth";
import { useSettings, type Privacy } from "../lib/settings";
import { newItemId, useItems, type Item, type ItemKind } from "../lib/items";
import { useUploads } from "../lib/uploads";
import { useYouTube } from "../lib/youtube-context";
import { useAutopilot } from "../lib/autopilot-context";
import { parseTags, tagsLength } from "../lib/meta";
import { fmtBytes, fmtDateTime, fromLocalInput, MIN_LEAD_MS, nextFreeSlots, toLocalInput } from "../lib/schedule";
import { DAILY_QUOTA, UPLOAD_COST, useQuotaUsed } from "../lib/quota";
import { Alert, Button, Card, CardHeader, cx, Field, Input, PageHeader, Segmented, Dropdown, Textarea, Toggle, useToast } from "../components/ui";
import { CATEGORY_OPTIONS, PRIVACY_OPTIONS } from "../components/options";

type Mode = "now" | "schedule";
type When = "slot" | "custom";
type VideoInfo = { duration: number; width: number; height: number; url: string };
type Entry = { key: string; file: File; title: string; info: VideoInfo | null };

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

const isVideo = (f: File) => f.type.startsWith("video/") || /\.(mp4|mov|mkv|webm|avi|m4v|wmv|flv|3gp|mpeg|mpg)$/i.test(f.name);
const titleFromName = (name: string) => name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim().slice(0, 100);

export default function UploadPage({ kind }: { kind: ItemKind }) {
  const user = useUser();
  const { settings } = useSettings();
  const yt = useYouTube();
  const uploads = useUploads();
  const autopilot = useAutopilot();
  const { items } = useItems(user.uid);
  const toast = useToast();
  const navigate = useNavigate();
  const quotaUsed = useQuotaUsed();
  const isShort = kind === "short";
  const ytReady = !!settings.youtubeClientId;
  const viaAutopilot = !!autopilot.config;

  const [entries, setEntries] = useState<Entry[]>([]);
  const [thumb, setThumb] = useState<File | null>(null);
  const [thumbUrl, setThumbUrl] = useState<string | null>(null);
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState(settings.defaults.tags);
  const [categoryId, setCategoryId] = useState(settings.defaults.categoryId);
  const [privacy, setPrivacy] = useState<Privacy>(settings.defaults.privacy);
  const [madeForKids, setMadeForKids] = useState(settings.defaults.madeForKids);
  const [notify, setNotify] = useState(settings.defaults.notifySubscribers);
  const [mode, setMode] = useState<Mode>("schedule");
  const [when, setWhen] = useState<When>("slot");
  const [custom, setCustom] = useState(() => toLocalInput(Date.now() + 3600_000));
  const [dragOver, setDragOver] = useState(false);
  const [starting, setStarting] = useState(false);
  const submitting = useRef(false);
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
  }, [settings]);

  useEffect(() => () => {
    if (thumbUrl) URL.revokeObjectURL(thumbUrl);
  }, [thumbUrl]);

  const single = entries.length === 1 ? entries[0] : null;
  const bulk = entries.length > 1;
  const tagList = parseTags(tags);
  const tagLen = tagsLength(tagList);

  const fullDescription = (title: string) => {
    let d = description.trim();
    if (settings.defaults.descriptionFooter.trim()) d = `${d}\n\n${settings.defaults.descriptionFooter.trim()}`.trim();
    if (isShort && settings.defaults.addShortsTag && !/#shorts\b/i.test(`${title} ${d}`)) d = `${d}\n\n#Shorts`.trim();
    return d;
  };

  // Publish time for each entry: consecutive free slots, or the custom time for a single video.
  const times: (number | null)[] = useMemo(() => {
    if (mode === "now") return entries.map(() => null);
    if (!bulk && when === "custom") return [fromLocalInput(custom)];
    // Count files still being copied for Autopilot as taken, so two batches never share a slot.
    const reserved = uploads.reservedTimes().map((t, i) => ({ id: `reserved-${i}`, status: "queued", publishAt: t }) as Item);
    const s = nextFreeSlots(settings.slots, [...items, ...reserved], entries.length);
    return entries.map((_, i) => s[i] ?? null);
  }, [mode, bulk, when, custom, settings.slots, items, entries]);

  const quotaLeft = Math.max(0, Math.floor((DAILY_QUOTA - quotaUsed) / UPLOAD_COST));
  const direct = mode === "now" || !viaAutopilot;

  const problems: string[] = [];
  if (!entries.length) problems.push("Choose a video file.");
  if (entries.some((e) => !e.title.trim())) problems.push("Every video needs a title.");
  if (entries.some((e) => e.title.length > 100)) problems.push("Titles must be 100 characters or less.");
  if (entries.some((e) => /[<>]/.test(e.title)) || /[<>]/.test(description)) problems.push("Titles and description cannot contain < or >.");
  if (fullDescription("").length > 5000) problems.push("Description (with footer) must be 5000 characters or less.");
  if (tagLen > 500) problems.push("Tags are over YouTube's 500-character limit.");
  if (mode === "schedule") {
    if (times.some((t) => t === null)) problems.push(when === "custom" && !bulk ? "Pick a publish time." : "Not enough free slots — add daily times in Settings.");
    else if (times.some((t) => t! < Date.now() + MIN_LEAD_MS)) problems.push("Publish time must be at least 15 minutes from now.");
  }
  if (direct && entries.length > quotaLeft)
    problems.push(
      quotaLeft === 0
        ? "No YouTube API quota left today for browser uploads."
        : `Today's quota allows about ${quotaLeft} more upload${quotaLeft > 1 ? "s" : ""} from the browser.${viaAutopilot ? "" : " Set up Autopilot to schedule more."}`,
    );
  if (!ytReady) problems.push("Connect YouTube in Settings first.");

  const shortWarnings: string[] = [];
  if (single?.info?.width) {
    const { info } = single;
    if (isShort && info.width > info.height) shortWarnings.push("This video is horizontal. Shorts should be vertical (9:16) or square.");
    if (isShort && info.duration > 180) shortWarnings.push(`This video is ${fmtDuration(info.duration)} long. Shorts can be at most 3 minutes.`);
    if (!isShort && info.height > info.width && info.duration <= 180) shortWarnings.push("This looks like a Short (vertical, under 3 min). YouTube will treat it as a Short.");
  }

  const addFiles = async (list: FileList | File[] | null | undefined) => {
    const files = [...(list ?? [])].filter(isVideo);
    if (!files.length) return toast("error", "Choose video files (MP4, MOV, WebM…).");
    touched.current = true;
    const added: Entry[] = files.map((f) => ({ key: newItemId(), file: f, title: titleFromName(f.name), info: null }));
    setEntries((e) => [...e, ...added]);
    // Read duration/size in the background (small files first is not needed — order is kept).
    for (const a of added) {
      const info = await readVideoInfo(a.file);
      setEntries((e) => e.map((x) => (x.key === a.key ? { ...x, info } : x)));
    }
  };

  const removeEntry = (key: string) =>
    setEntries((e) => {
      const gone = e.find((x) => x.key === key);
      if (gone?.info?.url) URL.revokeObjectURL(gone.info.url);
      return e.filter((x) => x.key !== key);
    });

  const pickThumb = (f: File | undefined | null) => {
    if (!f) return;
    if (!/^image\/(jpeg|png)$/.test(f.type)) return toast("error", "Thumbnail must be a JPG or PNG.");
    if (f.size > 2 * 1024 * 1024) return toast("error", "Thumbnail must be under 2 MB.");
    setThumb(f);
    setThumbUrl(URL.createObjectURL(f));
  };

  const reset = () => {
    entries.forEach((e) => e.info?.url && URL.revokeObjectURL(e.info.url));
    setEntries([]);
    setThumb(null);
    setThumbUrl(null);
    setDescription("");
    touched.current = false;
  };

  const baseFor = (e: Entry, publishAt: number | null) => ({
    kind,
    title: e.title.trim(),
    description: fullDescription(e.title),
    tags: tagList,
    categoryId,
    privacy,
    madeForKids,
    notifySubscribers: notify,
    publishAt,
  });

  const submit = async () => {
    // One submit at a time: a second click (e.g. while the network is slow) must not start another upload.
    if (problems.length || submitting.current) return;
    if (!navigator.onLine) return toast("error", "You're offline. Connect to the internet and try again.");
    submitting.current = true;
    setStarting(true);
    try {
      await doSubmit();
    } finally {
      submitting.current = false;
      setStarting(false);
    }
  };

  const doSubmit = async () => {
    const list = entries;
    const t = single ? thumb : null;
    const publishTimes = times;

    try {
      // Get the token inside the click so the Google popup is not blocked.
      // Direct uploads talk to YouTube; Autopilot only writes to Drive/Sheets.
      await (direct ? yt.ensureToken() : yt.ensureDriveToken());
    } catch (e) {
      return toast("error", (e as Error).message);
    }

    // The work runs in the app shell (see UploadsProvider), so it keeps going on other pages.
    // Progress shows in the panel at the bottom-right: "3 / 10".
    if (!direct) {
      // Autopilot: copy each file to the user's Drive and book it. Google uploads it on time.
      uploads.startAutopilotBatch(list.map((e, i) => ({ base: baseFor(e, publishTimes[i]), video: e.file, thumb: t })));
    } else {
      // Direct browser upload (Now, or Schedule without Autopilot).
      const now = Date.now();
      uploads.startYouTubeBatch(
        list.map((e, i) => ({
          item: {
            ...baseFor(e, publishTimes[i]),
            id: newItemId(),
            status: "queued",
            youtubeId: null,
            file: null,
            thumb: null,
            error: null,
            createdAt: now + i,
            updatedAt: now,
            uploadedAt: null,
          } satisfies Item,
          video: e.file,
          thumb: t,
        })),
      );
    }
    reset();
    toast(
      "info",
      `${list.length} video${list.length > 1 ? "s" : ""} started. You can switch pages — just keep this tab open until the panel says done.`,
    );
  };

  const busy = starting;

  return (
    <>
      <PageHeader
        title={isShort ? "Upload Shorts" : "Upload Videos"}
        subtitle={isShort ? "Vertical 9:16, up to 3 minutes. Select one or many." : "Long videos. Select one or many."}
        action={
          <Link to={isShort ? "/upload/video" : "/upload/short"}>
            <Button variant="ghost" icon={isShort ? <Clapperboard className="size-4" /> : <Smartphone className="size-4" />}>
              {isShort ? "Long videos instead" : "Shorts instead"}
            </Button>
          </Link>
        }
      />

      {!ytReady && (
        <div className="mb-6">
          <Alert tone="warn" title="YouTube is not connected yet" action={<Button size="sm" variant="primary" onClick={() => navigate("/settings")}>Settings</Button>}>
            Add your OAuth Client ID in Settings to start uploading.
          </Alert>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
        <div className="space-y-6">
          {/* Files */}
          <Card>
            {entries.length === 0 ? (
              <button
                type="button"
                onClick={() => fileInput.current?.click()}
                onDragOver={(e) => (e.preventDefault(), setDragOver(true))}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOver(false);
                  addFiles(e.dataTransfer.files);
                }}
                className={cx(
                  "flex w-full flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-14 text-center transition",
                  dragOver ? "border-accent bg-accent-soft" : "border-line hover:border-faint/50 hover:bg-card-hover",
                )}
              >
                <div className="grad-bg mb-4 grid size-14 place-items-center rounded-2xl text-on-accent shadow-lg shadow-accent/30">
                  <UploadCloud className="size-7" />
                </div>
                <div className="font-semibold">Drop your {isShort ? "Shorts" : "videos"} here</div>
                <div className="mt-1 text-sm text-muted">or click to choose · one or many at once</div>
              </button>
            ) : single ? (
              <div className="flex flex-col gap-4 p-4 sm:flex-row">
                <video src={single.info?.url} controls className={cx("rounded-xl bg-black object-contain", isShort ? "aspect-[9/16] w-full sm:w-44" : "aspect-video w-full sm:w-72")} />
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{single.file.name}</div>
                  <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted">
                    <span>{fmtBytes(single.file.size)}</span>
                    {single.info?.duration ? <span>{fmtDuration(single.info.duration)}</span> : null}
                    {single.info?.width ? <span>{single.info.width}×{single.info.height}</span> : null}
                  </div>
                  <div className="mt-3 space-y-2">
                    {shortWarnings.map((w) => (
                      <Alert key={w} tone="warn">{w}</Alert>
                    ))}
                  </div>
                  <div className="mt-3 flex gap-2">
                    <Button variant="ghost" size="sm" icon={<Plus className="size-4" />} onClick={() => fileInput.current?.click()} disabled={busy}>Add more</Button>
                    <Button variant="ghost" size="sm" icon={<Trash2 className="size-4" />} onClick={reset} disabled={busy}>Remove</Button>
                  </div>
                </div>
              </div>
            ) : (
              <>
                <CardHeader
                  title={`${entries.length} ${isShort ? "Shorts" : "videos"} selected`}
                  subtitle={mode === "schedule" ? "Each one gets the next free slot. Edit titles below." : "Edit titles below."}
                  action={
                    <div className="flex gap-1">
                      <Button size="sm" variant="ghost" icon={<Plus className="size-4" />} onClick={() => fileInput.current?.click()} disabled={busy}>Add</Button>
                      <Button size="sm" variant="ghost" icon={<Trash2 className="size-4" />} onClick={reset} disabled={busy}>Clear</Button>
                    </div>
                  }
                />
                <ul className="max-h-[32rem] divide-y divide-line overflow-y-auto">
                  {entries.map((e, i) => (
                    <li key={e.key} className="flex items-center gap-3 px-4 py-2.5">
                      <span className="w-6 shrink-0 text-right text-xs tabular-nums text-faint">{i + 1}</span>
                      <div className="min-w-0 flex-1">
                        <Input
                          value={e.title}
                          maxLength={100}
                          disabled={busy}
                          onChange={(ev) => setEntries((all) => all.map((x) => (x.key === e.key ? { ...x, title: ev.target.value } : x)))}
                          className="py-1.5"
                        />
                        <div className="mt-1 flex flex-wrap gap-x-3 text-[11px] text-muted">
                          <span className="truncate">{e.file.name}</span>
                          <span>{fmtBytes(e.file.size)}</span>
                          {e.info?.duration ? <span>{fmtDuration(e.info.duration)}</span> : null}
                          {isShort && e.info?.width && (e.info.width > e.info.height || e.info.duration > 180) ? <span className="text-warn">not Short-shaped</span> : null}
                        </div>
                      </div>
                      {times[i] && <span className="hidden w-32 shrink-0 text-right text-xs text-muted sm:block">{fmtDateTime(times[i]!)}</span>}
                      <button onClick={() => removeEntry(e.key)} disabled={busy} className="text-faint hover:text-danger">
                        <Trash2 className="size-4" />
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            )}
            <input ref={fileInput} type="file" accept="video/*" multiple hidden onChange={(e) => (addFiles(e.target.files), (e.target.value = ""))} />
          </Card>

          {/* Details */}
          <Card>
            <CardHeader title="Details" subtitle={bulk ? "Shared by all selected videos." : "This is what viewers see on YouTube."} />
            <div className="space-y-5 p-5">
              {single && (
                <Field label="Title" counter={`${single.title.length}/100`}>
                  <Input
                    value={single.title}
                    maxLength={100}
                    onChange={(e) => setEntries([{ ...single, title: e.target.value }])}
                    placeholder="A title that makes people click"
                  />
                </Field>
              )}
              <Field
                label="Description"
                counter={`${fullDescription("").length}/5000`}
                hint={settings.defaults.descriptionFooter || (isShort && settings.defaults.addShortsTag) ? "Your default footer / #Shorts is added automatically (change it in Settings)." : undefined}
              >
                <Textarea rows={5} value={description} onChange={(e) => ((touched.current = true), setDescription(e.target.value))} placeholder="Tell viewers what this video is about…" />
              </Field>
              <Field label="Tags" counter={`${tagLen}/500`} hint="Separate with commas.">
                <Input value={tags} onChange={(e) => ((touched.current = true), setTags(e.target.value))} placeholder="comedy, tamil, shorts" />
              </Field>
              <div className="grid gap-5 sm:grid-cols-2">
                <Field label="Category">
                  <Dropdown value={categoryId} onChange={setCategoryId} options={CATEGORY_OPTIONS} />
                </Field>
                {!isShort && !bulk && (
                  <Field label="Thumbnail (optional)" hint="JPG/PNG, 1280×720, under 2 MB">
                    <div className="flex items-center gap-3">
                      {thumbUrl && <img src={thumbUrl} alt="" className="aspect-video h-11 rounded-lg object-cover ring-1 ring-line" />}
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
                onChange={setMode}
                options={[
                  { value: "schedule", label: "Schedule", icon: <CalendarClock className="size-4" /> },
                  { value: "now", label: "Publish now", icon: <Rocket className="size-4" /> },
                ]}
              />

              {mode === "schedule" &&
                (viaAutopilot && !autopilot.running ? (
                  <div className="flex gap-3 rounded-xl border border-warn/30 bg-warn/5 p-3 text-xs">
                    <Bot className="size-4.5 shrink-0 text-warn" />
                    <span className="text-muted">
                      <b className="text-fg">Autopilot is paused.</b> Videos are saved to your Google Drive, but nothing goes to YouTube until you{" "}
                      <Link to="/settings#autopilot" className="font-medium text-accent hover:underline">activate Autopilot</Link>.
                    </span>
                  </div>
                ) : viaAutopilot ? (
                  <div className="flex gap-3 rounded-xl border border-ok/25 bg-ok/5 p-3 text-xs">
                    <Bot className="size-4.5 shrink-0 text-ok" />
                    <span className="text-muted">
                      <b className="text-fg">Autopilot is on.</b> Files are saved to your Google Drive, and Google uploads each one before its time — your PC can be off.
                    </span>
                  </div>
                ) : (
                  <div className="flex gap-3 rounded-xl border border-line bg-bg-soft p-3 text-xs">
                    <Bot className="size-4.5 shrink-0 text-muted" />
                    <span className="text-muted">
                      Uploads now from this tab and YouTube publishes on time. Want to schedule many videos with your PC off?{" "}
                      <Link to="/settings#autopilot" className="font-medium text-accent hover:underline">Set up Autopilot</Link>
                    </span>
                  </div>
                ))}

              {mode === "now" ? (
                <Field label="Visibility">
                  <Dropdown<Privacy> value={privacy} onChange={setPrivacy} options={PRIVACY_OPTIONS} />
                </Field>
              ) : bulk ? (
                <p className="text-sm">
                  {times[0] && times[times.length - 1] ? (
                    <>
                      <b>{entries.length}</b> videos from <b>{fmtDateTime(times[0]!)}</b> to <b>{fmtDateTime(times[times.length - 1]!)}</b>, using your daily slots.
                    </>
                  ) : (
                    <span className="text-warn">Add daily time slots in Settings.</span>
                  )}
                </p>
              ) : (
                <div className="space-y-2">
                  {(
                    [
                      ["slot", times[0] && when === "slot" ? `Next free slot · ${fmtDateTime(times[0])}` : "Next free slot"],
                      ["custom", "Pick a date & time"],
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

              {problems.length > 0 && entries.length > 0 && (
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
                disabled={!!problems.length}
                loading={busy}
                onClick={submit}
                icon={mode === "now" ? <Rocket className="size-4.5" /> : direct ? <CalendarClock className="size-4.5" /> : <Bot className="size-4.5" />}
              >
                {starting
                  ? "Starting…"
                  : mode === "now"
                  ? `Upload now${bulk ? ` (${entries.length})` : ""}`
                  : direct
                    ? `Upload & schedule${bulk ? ` (${entries.length})` : ""}`
                    : `Add to Autopilot${bulk ? ` (${entries.length})` : ""}`}
              </Button>
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}
