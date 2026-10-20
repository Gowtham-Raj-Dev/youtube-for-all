import { useState } from "react";
import { Link } from "react-router";
import { Bot, CalendarClock, Clapperboard, ExternalLink, ListVideo, Pencil, Play, RefreshCw, Smartphone, Trash2 } from "lucide-react";
import { useUser } from "../lib/auth";
import { useSettings } from "../lib/settings";
import { removeItem, useItems, type Item } from "../lib/items";
import { hasMemoryFile, useUploads, type Job } from "../lib/uploads";
import { useYouTube } from "../lib/youtube-context";
import { useAutopilot } from "../lib/autopilot-context";
import { statusTime } from "../lib/autopilot";
import { parseTags, tagsLength } from "../lib/meta";
import { fmtBytes, fmtDateTime, fmtRelative, fromLocalInput, MIN_LEAD_MS, toLocalInput } from "../lib/schedule";
import { Alert, Badge, Button, Card, CardHeader, cx, Empty, Field, Input, PageHeader, Progress, Spinner, StatusBadge, Textarea, useToast } from "../components/ui";

/** An "uploading" item with no live job in this tab, untouched for a while, was interrupted. */
function effectiveStatus(item: Item, jobs: Record<string, Job>) {
  if (item.status === "uploading" && !jobs[item.id] && item.file?.storage !== "drive" && Date.now() - item.updatedAt > 2 * 60_000) return "failed" as const;
  return item.status;
}

function EditDialog({ item, onClose }: { item: Item; onClose: () => void }) {
  const autopilot = useAutopilot();
  const toast = useToast();
  const [title, setTitle] = useState(item.title);
  const [description, setDescription] = useState(item.description);
  const [tags, setTags] = useState(item.tags.join(", "));
  const [time, setTime] = useState(item.publishAt ? toLocalInput(item.publishAt) : "");
  const [busy, setBusy] = useState(false);
  const tagList = parseTags(tags);
  const publishAt = time ? fromLocalInput(time) : null;
  const bad =
    !title.trim() || title.length > 100 || description.length > 5000 || tagsLength(tagList) > 500 || /[<>]/.test(title + description) || !publishAt || publishAt < Date.now() + MIN_LEAD_MS;

  const save = async () => {
    setBusy(true);
    try {
      await autopilot.edit(item, { title: title.trim(), description, tags: tagList, publishAt });
      toast("ok", "Saved.");
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
          <Field label="Publish time" hint="At least 15 minutes from now.">
            <Input type="datetime-local" value={time} min={toLocalInput(Date.now())} onChange={(e) => setTime(e.target.value)} />
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
  const autopilot = useAutopilot();
  const { jobs, run } = useUploads();
  const { items, loading } = useItems(user.uid);
  const toast = useToast();
  const [editing, setEditing] = useState<Item | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  const waiting = items
    .filter((i) => ["queued", "failed", "uploading"].includes(effectiveStatus(i, jobs)))
    .sort((a, b) => (a.publishAt ?? Infinity) - (b.publishAt ?? Infinity) || a.createdAt - b.createdAt);
  const done = items.filter((i) => i.status === "scheduled" || i.status === "uploaded").slice(0, 12);
  const next = waiting.find((i) => i.status === "queued" && i.publishAt);
  const lastRun = statusTime(autopilot.status?.lastRun);

  const uploadOne = async (item: Item) => {
    try {
      await yt.ensureToken(item.file?.storage === "drive");
    } catch (e) {
      return toast("error", (e as Error).message);
    }
    run(item)
      .then(() => toast("ok", `“${item.title}” ${item.publishAt && item.publishAt > Date.now() ? `scheduled for ${fmtDateTime(item.publishAt)}` : "uploaded"}.`))
      .catch((e) => toast("error", `“${item.title}”: ${(e as Error).message}`));
  };

  const remove = async (item: Item) => {
    if (!confirm(`Delete “${item.title}”? It won't be uploaded and its file is removed from your Drive.`)) return;
    setDeleting(item.id);
    try {
      if (item.file?.storage === "drive") await autopilot.remove(item);
      else await removeItem(user.uid, item.id);
    } catch (e) {
      toast("error", (e as Error).message);
    } finally {
      setDeleting(null);
    }
  };

  const sync = () =>
    autopilot
      .sync()
      .then(() => toast("ok", "Synced with Autopilot."))
      .catch((e) => toast("error", (e as Error).message));

  return (
    <>
      <PageHeader
        title="Queue"
        subtitle="Videos waiting to go to YouTube. Autopilot uploads each one before its publish time."
        action={
          autopilot.config && (
            <Button icon={<RefreshCw className={cx("size-4", autopilot.syncing && "animate-spin")} />} onClick={sync} disabled={autopilot.syncing}>
              Sync
            </Button>
          )
        }
      />

      <div className="mb-6">
        {!autopilot.config ? (
          <Alert tone="info" title="Autopilot is not set up" action={<Link to="/settings#autopilot"><Button size="sm" variant="primary">Set up</Button></Link>}>
            With Autopilot you can add 100s of videos and they go out on schedule even when your PC is off.
          </Alert>
        ) : !yt.driveAllowed ? (
          <Alert tone="warn" title="Reconnect to see live status" action={<Button size="sm" variant="primary" onClick={() => yt.connect(true).catch((e) => toast("error", e.message))}>Connect</Button>}>
            Autopilot keeps working in the background. Connect to sync its progress here.
          </Alert>
        ) : autopilot.running ? (
          <Alert tone="ok" title="Autopilot is running">
            Checks every 30 minutes{lastRun ? ` · last run ${fmtRelative(lastRun)}` : ""}{autopilot.status?.lastResult ? ` · ${autopilot.status.lastResult}` : ""}
          </Alert>
        ) : autopilot.status ? (
          <Alert tone="warn" title="Autopilot is not running" action={<Link to="/settings#autopilot"><Button size="sm" variant="primary">Fix</Button></Link>}>
            Open Settings → Autopilot and click “Activate Autopilot”.
          </Alert>
        ) : null}
      </div>

      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <Stat label="Waiting" value={waiting.length} />
        <Stat label="Next to go live" value={next?.publishAt ? fmtDateTime(next.publishAt) : "—"} />
        <Stat label="Size in Drive" value={fmtBytes(waiting.reduce((n, i) => n + (i.file?.size ?? 0), 0))} />
      </div>

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
                <Link to="/upload/short"><Button variant="primary" icon={<Smartphone className="size-4" />}>Add Shorts</Button></Link>
                <Link to="/upload/video"><Button icon={<Clapperboard className="size-4" />}>Add videos</Button></Link>
              </div>
            }
          >
            Pick one or many videos, choose <b>Schedule</b>, and they'll appear here until they go live.
          </Empty>
        ) : (
          <ul className="divide-y divide-line">
            {waiting.map((item) => {
              const job = jobs[item.id];
              const status = effectiveStatus(item, jobs);
              const onDrive = item.file?.storage === "drive";
              const missing = !onDrive && !hasMemoryFile(item.id);
              return (
                <li key={item.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
                  <div className={cx("grid size-11 shrink-0 place-items-center rounded-xl", item.kind === "short" ? "bg-accent-2/10 text-accent-2" : "bg-accent-soft text-accent")}>
                    {item.kind === "short" ? <Smartphone className="size-5" /> : <Clapperboard className="size-5" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="truncate font-medium">{item.title}</span>
                      <StatusBadge status={status} />
                      {onDrive && <Badge><Bot className="size-3" /> Autopilot</Badge>}
                    </div>
                    <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
                      <span className="flex items-center gap-1">
                        <CalendarClock className="size-3.5" />
                        {item.publishAt ? `${fmtDateTime(item.publishAt)} · ${fmtRelative(item.publishAt)}` : "No time"}
                      </span>
                      {item.file && <span>{fmtBytes(item.file.size)}</span>}
                    </div>
                    {item.error && <p className={cx("mt-1.5 text-xs", status === "failed" ? "text-danger" : "text-warn")}>{item.error}</p>}
                    {missing && <p className="mt-1.5 text-xs text-danger">This upload was interrupted and the file is not saved anywhere. Delete it and add the video again.</p>}
                    {job && <Progress value={job.phase === "uploading" ? job.progress : 0.02} className="mt-2.5" />}
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <Button
                      size="sm"
                      variant={status === "failed" ? "primary" : "secondary"}
                      icon={<Play className="size-3.5" />}
                      disabled={!!job || missing || (status === "uploading" && onDrive) || !settings.youtubeClientId}
                      onClick={() => uploadOne(item)}
                      title="Upload from this browser right now instead of waiting for Autopilot"
                    >
                      {status === "failed" ? "Retry" : "Upload now"}
                    </Button>
                    {onDrive && (
                      <Button size="sm" variant="ghost" disabled={!!job || status === "uploading"} onClick={() => setEditing(item)} title="Edit">
                        <Pencil className="size-4" />
                      </Button>
                    )}
                    <Button size="sm" variant="ghost" loading={deleting === item.id} disabled={!!job || (status === "uploading" && onDrive)} onClick={() => remove(item)} title="Delete" className="hover:text-danger">
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

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <Card className="px-4 py-3.5">
      <div className="text-xs text-muted">{label}</div>
      <div className="mt-1 truncate text-lg font-semibold">{value}</div>
    </Card>
  );
}
