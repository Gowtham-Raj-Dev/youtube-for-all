import { useState } from "react";
import { Link } from "react-router";
import { CalendarClock, Clapperboard, ExternalLink, HardDrive, ListVideo, Monitor, Pencil, Play, Rocket, Smartphone, Trash2 } from "lucide-react";
import { useUser } from "../lib/auth";
import { useSettings } from "../lib/settings";
import { patchItem, removeItem, useItems, type Item } from "../lib/items";
import { hasMemoryFile, useUploads, type Job } from "../lib/uploads";
import { useYouTube } from "../lib/youtube-context";
import { dropFile } from "../lib/files";
import { fmtBytes, fmtDateTime, fmtRelative, fromLocalInput, MIN_LEAD_MS, nextFreeSlots, toLocalInput } from "../lib/schedule";
import { DAILY_QUOTA, UPLOAD_COST, useQuotaUsed } from "../lib/quota";
import { Alert, Badge, Button, Card, CardHeader, cx, Empty, Field, Input, PageHeader, Progress, Spinner, StatusBadge, Textarea, useToast } from "../components/ui";
import { parseTags, tagsLength } from "../lib/meta";

/** An "uploading" item with no live job in this tab was interrupted (tab closed, crash…). */
export function effectiveStatus(item: Item, jobs: Record<string, Job>) {
  if (item.status === "uploading" && !jobs[item.id] && Date.now() - item.updatedAt > 2 * 60_000) return "failed" as const;
  return item.status;
}

function EditDialog({ item, onClose }: { item: Item; onClose: () => void }) {
  const user = useUser();
  const toast = useToast();
  const [title, setTitle] = useState(item.title);
  const [description, setDescription] = useState(item.description);
  const [tags, setTags] = useState(item.tags.join(", "));
  const [time, setTime] = useState(item.publishAt ? toLocalInput(item.publishAt) : "");
  const [busy, setBusy] = useState(false);
  const tagList = parseTags(tags);
  const bad = !title.trim() || title.length > 100 || description.length > 5000 || tagsLength(tagList) > 500 || /[<>]/.test(title + description);

  const save = async () => {
    setBusy(true);
    try {
      await patchItem(user.uid, item.id, {
        title: title.trim(),
        description,
        tags: tagList,
        publishAt: time ? fromLocalInput(time) : null,
      });
      onClose();
    } catch (e) {
      toast("error", (e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-4">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-2xl border border-line bg-card shadow-2xl">
        <CardHeader title="Edit queued video" subtitle={item.file?.name} />
        <div className="space-y-4 p-5">
          <Field label="Title" counter={`${title.length}/100`}>
            <Input value={title} maxLength={100} onChange={(e) => setTitle(e.target.value)} />
          </Field>
          <Field label="Description" counter={`${description.length}/5000`}>
            <Textarea rows={6} value={description} onChange={(e) => setDescription(e.target.value)} />
          </Field>
          <Field label="Tags" counter={`${tagsLength(tagList)}/500`}>
            <Input value={tags} onChange={(e) => setTags(e.target.value)} />
          </Field>
          <Field label="Planned publish time" hint="Leave empty to decide later.">
            <Input type="datetime-local" value={time} onChange={(e) => setTime(e.target.value)} />
          </Field>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={onClose}>Cancel</Button>
            <Button variant="primary" onClick={save} loading={busy} disabled={bad}>Save</Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Queue() {
  const user = useUser();
  const { settings } = useSettings();
  const yt = useYouTube();
  const { jobs, run } = useUploads();
  const { items, loading } = useItems(user.uid);
  const toast = useToast();
  const quotaUsed = useQuotaUsed();
  const [editing, setEditing] = useState<Item | null>(null);
  const [bulk, setBulk] = useState(false);

  const waiting = items
    .filter((i) => {
      const s = effectiveStatus(i, jobs);
      return s === "queued" || s === "failed" || s === "uploading";
    })
    .sort((a, b) => (a.publishAt ?? Infinity) - (b.publishAt ?? Infinity) || a.createdAt - b.createdAt);
  const done = items.filter((i) => i.status === "scheduled" || i.status === "uploaded").slice(0, 12);
  const canUpload = Math.max(0, Math.floor((DAILY_QUOTA - quotaUsed) / UPLOAD_COST));
  const ready = waiting.filter((i) => !jobs[i.id] && (i.file || hasMemoryFile(i.id)));

  const uploadOne = async (item: Item) => {
    if (!settings.youtubeClientId) return toast("error", "Add your OAuth Client ID in Settings first.");
    try {
      await yt.ensureToken();
    } catch (e) {
      return toast("error", (e as Error).message);
    }
    run(item)
      .then(() => toast("ok", `“${item.title}” ${item.publishAt && item.publishAt > Date.now() ? `scheduled for ${fmtDateTime(item.publishAt)}` : "uploaded"}.`))
      .catch((e) => toast("error", `“${item.title}”: ${(e as Error).message}`));
  };

  const uploadAll = async () => {
    if (!settings.youtubeClientId) return toast("error", "Add your OAuth Client ID in Settings first.");
    const batch = ready.slice(0, Math.max(1, canUpload));
    if (!batch.length) return;
    const needSlot = batch.filter((i) => !i.publishAt || i.publishAt < Date.now() + MIN_LEAD_MS);
    const slots = nextFreeSlots(settings.slots, items, needSlot.length);
    if (slots.length < needSlot.length) return toast("error", "Not enough free daily slots — add times in Settings → Schedule.");
    const msg =
      `Upload ${batch.length} video${batch.length > 1 ? "s" : ""} to YouTube?\n\n` +
      (needSlot.length ? `${needSlot.length} without a future time will go to the next free slots (first: ${fmtDateTime(slots[0])}).\n` : "") +
      (ready.length > batch.length ? `\nOnly ${batch.length} fit in today's API quota; the rest stay queued.` : "");
    if (!confirm(msg)) return;
    try {
      await yt.ensureToken();
    } catch (e) {
      return toast("error", (e as Error).message);
    }
    setBulk(true);
    let ok = 0;
    try {
      for (const item of batch) {
        const i = needSlot.indexOf(item);
        const publishAt = i >= 0 ? slots[i] : item.publishAt;
        if (i >= 0) await patchItem(user.uid, item.id, { publishAt });
        try {
          await run({ ...item, publishAt });
          ok++;
        } catch (e) {
          toast("error", `“${item.title}”: ${(e as Error).message}`);
          if (/quota|session expired/i.test((e as Error).message)) break;
        }
      }
    } finally {
      setBulk(false);
      if (ok) toast("ok", `${ok} video${ok > 1 ? "s" : ""} sent to YouTube.`);
    }
  };

  const remove = async (item: Item) => {
    if (!confirm(`Delete “${item.title}” from the queue? The saved file is deleted too.`)) return;
    await dropFile(settings, item.file);
    await dropFile(settings, item.thumb);
    await removeItem(user.uid, item.id);
  };

  return (
    <>
      <PageHeader
        title="Queue"
        subtitle="Videos saved and waiting. Push them to YouTube whenever you're ready."
        action={
          ready.length > 0 && (
            <Button variant="primary" icon={<Rocket className="size-4" />} loading={bulk} onClick={uploadAll}>
              Upload all ({Math.min(ready.length, Math.max(1, canUpload))})
            </Button>
          )
        }
      />

      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <Stat label="Waiting" value={waiting.length} />
        <Stat label="Storage" value={settings.storageMode === "firebase" ? "Your Firebase" : "This browser"} icon={settings.storageMode === "firebase" ? <HardDrive className="size-4" /> : <Monitor className="size-4" />} />
        <Stat label="Uploads left today (est.)" value={canUpload} />
      </div>

      {settings.storageMode === "browser" && waiting.some((i) => i.file?.storage === "browser") && (
        <div className="mb-6">
          <Alert tone="info" title="Files are saved in this browser only">
            Upload them from this same browser. To use your queue from any device, connect your own Firebase Storage in{" "}
            <Link to="/settings" className="font-medium text-fg underline">Settings</Link>.
          </Alert>
        </div>
      )}

      <Card>
        {loading ? (
          <div className="grid place-items-center py-16">
            <Spinner />
          </div>
        ) : waiting.length === 0 ? (
          <Empty
            icon={<ListVideo className="size-7" />}
            title="Your queue is empty"
            action={
              <div className="flex flex-wrap justify-center gap-2">
                <Link to="/upload/video"><Button icon={<Clapperboard className="size-4" />}>Add a video</Button></Link>
                <Link to="/upload/short"><Button icon={<Smartphone className="size-4" />}>Add a Short</Button></Link>
              </div>
            }
          >
            On the upload page choose <b>Queue</b> to save videos here without uploading them yet.
          </Empty>
        ) : (
          <ul className="divide-y divide-line">
            {waiting.map((item) => {
              const job = jobs[item.id];
              const status = effectiveStatus(item, jobs);
              const missing = !item.file && !hasMemoryFile(item.id);
              return (
                <li key={item.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
                  <div className={cx("grid size-12 shrink-0 place-items-center rounded-xl", item.kind === "short" ? "bg-accent-2/10 text-accent-2" : "bg-accent-soft text-accent")}>
                    {item.kind === "short" ? <Smartphone className="size-5" /> : <Clapperboard className="size-5" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="truncate font-medium">{item.title}</span>
                      <StatusBadge status={status} />
                      {item.kind === "short" && <Badge>Short</Badge>}
                    </div>
                    <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
                      <span className="flex items-center gap-1">
                        <CalendarClock className="size-3.5" />
                        {item.publishAt ? (item.publishAt > Date.now() ? fmtDateTime(item.publishAt) : `${fmtDateTime(item.publishAt)} (passed → publishes on upload)`) : "No time yet"}
                      </span>
                      {item.file && <span>{fmtBytes(item.file.size)} · {item.file.storage === "firebase" ? "Firebase" : "Browser"}</span>}
                    </div>
                    {item.error && status === "failed" && <p className="mt-1.5 text-xs text-danger">{item.error}</p>}
                    {missing && <p className="mt-1.5 text-xs text-danger">The file is not available. Delete this and add the video again.</p>}
                    {job && <Progress value={job.phase === "uploading" ? job.progress : 0.02} className="mt-2.5" />}
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <Button size="sm" variant="primary" icon={<Play className="size-3.5" />} disabled={!!job || bulk || missing} onClick={() => uploadOne(item)}>
                      {status === "failed" ? "Retry" : "Upload"}
                    </Button>
                    <Button size="sm" variant="ghost" disabled={!!job} onClick={() => setEditing(item)} title="Edit">
                      <Pencil className="size-4" />
                    </Button>
                    <Button size="sm" variant="ghost" disabled={!!job} onClick={() => remove(item)} title="Delete" className="hover:text-danger">
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      {done.length > 0 && (
        <Card className="mt-6">
          <CardHeader title="Recently sent to YouTube" />
          <ul className="divide-y divide-line">
            {done.map((item) => (
              <li key={item.id} className="flex items-center gap-3 px-5 py-3 text-sm">
                <StatusBadge status={item.status} />
                <span className="min-w-0 flex-1 truncate">{item.title}</span>
                <span className="hidden text-xs text-muted sm:block">
                  {item.status === "scheduled" && item.publishAt ? `goes live ${fmtRelative(item.publishAt)}` : item.uploadedAt ? fmtRelative(item.uploadedAt) : ""}
                </span>
                {item.youtubeId && (
                  <a href={`https://studio.youtube.com/video/${item.youtubeId}/edit`} target="_blank" rel="noreferrer" className="text-muted hover:text-fg" title="Open in YouTube Studio">
                    <ExternalLink className="size-4" />
                  </a>
                )}
              </li>
            ))}
          </ul>
        </Card>
      )}

      {editing && <EditDialog item={editing} onClose={() => setEditing(null)} />}
    </>
  );
}

function Stat({ label, value, icon }: { label: string; value: React.ReactNode; icon?: React.ReactNode }) {
  return (
    <Card className="px-4 py-3.5">
      <div className="text-xs text-muted">{label}</div>
      <div className="mt-1 flex items-center gap-2 text-lg font-semibold">
        {icon}
        {value}
      </div>
    </Card>
  );
}
