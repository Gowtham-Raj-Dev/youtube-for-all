import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router";
import {
  Bot,
  CalendarClock,
  CheckSquare,
  Clapperboard,
  ExternalLink,
  ListVideo,
  Pencil,
  Play,
  RefreshCw,
  Scissors,
  Smartphone,
  Square,
  Trash2,
  Video,
} from "lucide-react";
import { useUser } from "../lib/auth";
import { useSettings } from "../lib/settings";
import { patchItem, removeItem, useItems, type Item } from "../lib/items";
import { getMemoryFile, hasMemoryFile, useUploads, type Job } from "../lib/uploads";
import { useYouTube } from "../lib/youtube-context";
import { useAutopilot } from "../lib/autopilot-context";
import { statusTime } from "../lib/autopilot";
import { parseTags, tagsLength } from "../lib/meta";
import { fmtBytes, fmtDateTime, fmtRelative, fromLocalInput, nextFreeSlots, toLocalInput } from "../lib/schedule";
import {
  Alert,
  Badge,
  Button,
  Card,
  CardHeader,
  cx,
  Empty,
  Field,
  Input,
  PageHeader,
  Progress,
  Spinner,
  StatusBadge,
  Textarea,
  useToast,
} from "../components/ui";

/** An "uploading" item with no live job in this tab, untouched for a while, was interrupted. */
function effectiveStatus(item: Item, jobs: Record<string, Job>) {
  if (item.status === "uploading" && !jobs[item.id] && item.file?.storage !== "drive" && Date.now() - item.updatedAt > 2 * 60_000) return "failed" as const;
  return item.status;
}

function EditDialog({ item, onClose }: { item: Item; onClose: () => void }) {
  const user = useUser();
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
    !title.trim() ||
    title.length > 100 ||
    description.length > 5000 ||
    tagsLength(tagList) > 500 ||
    /[<>]/.test(title + description);

  const save = async () => {
    setBusy(true);
    try {
      const patch: Partial<Item> = {
        title: title.trim(),
        description,
        tags: tagList,
      };
      if (publishAt !== null) {
        patch.publishAt = publishAt;
      }
      await patchItem(user.uid, item.id, patch);

      if (item.file?.storage === "drive" && autopilot.config) {
        try {
          await autopilot.edit(item, { title: title.trim(), description, tags: tagList, publishAt });
        } catch (apErr) {
          console.warn("Autopilot sync note:", apErr);
        }
      }

      toast("ok", "Video details saved.");
      onClose();
    } catch (e) {
      toast("error", (e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-2xl border border-line bg-card shadow-2xl">
        <CardHeader title="Edit video details" subtitle={item.file?.name || item.title} />
        <div className="space-y-4 p-5">
          <Field label="Title" counter={`${title.length}/100`}>
            <Input value={title} maxLength={100} onChange={(e) => setTitle(e.target.value)} />
          </Field>
          <Field label="Description" counter={`${description.length}/5000`}>
            <Textarea rows={6} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Add a description for this video..." />
          </Field>
          <Field label="Tags" counter={`${tagsLength(tagList)}/500`} hint="Separate with commas">
            <Input value={tags} onChange={(e) => setTags(e.target.value)} />
          </Field>
          <Field label="Publish time (optional)" hint="Leave blank to publish upon upload, or pick future time.">
            <Input type="datetime-local" value={time} onChange={(e) => setTime(e.target.value)} />
          </Field>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button variant="primary" onClick={save} loading={busy} disabled={bad}>
              Save Changes
            </Button>
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
  const [searchParams, setSearchParams] = useSearchParams();

  const [editing, setEditing] = useState<Item | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [starting, setStarting] = useState<Set<string>>(new Set());
  const [selectedDraftIds, setSelectedDraftIds] = useState<Set<string>>(new Set());
  const [schedulingDrafts, setSchedulingDrafts] = useState(false);

  // Group items
  const readyItems = useMemo(
    () => items.filter((i) => i.status === "draft").sort((a, b) => b.createdAt - a.createdAt),
    [items]
  );

  const waiting = useMemo(
    () =>
      items
        .filter((i) => ["queued", "failed", "uploading"].includes(effectiveStatus(i, jobs)))
        .sort((a, b) => (a.publishAt ?? Infinity) - (b.publishAt ?? Infinity) || a.createdAt - b.createdAt),
    [items, jobs]
  );

  const done = useMemo(
    () => items.filter((i) => i.status === "scheduled" || i.status === "uploaded").slice(0, 20),
    [items]
  );

  const next = waiting.find((i) => i.status === "queued" && i.publishAt);
  const lastRun = statusTime(autopilot.status?.lastRun);

  // Active Tab: "ready" | "queue" | "done"
  const tabParam = searchParams.get("tab");
  const tab: "ready" | "queue" | "done" =
    tabParam === "ready" || tabParam === "queue" || tabParam === "done"
      ? tabParam
      : readyItems.length > 0 && waiting.length === 0
      ? "ready"
      : "queue";

  const setTab = (t: "ready" | "queue" | "done") => {
    setSearchParams((prev) => {
      const p = new URLSearchParams(prev);
      p.set("tab", t);
      return p;
    });
  };

  const uploadOne = async (item: Item) => {
    if (starting.has(item.id)) return;
    if (!navigator.onLine) return toast("error", "You're offline. Connect to the internet and try again.");
    setStarting((s) => new Set(s).add(item.id));
    // A clip still held in this tab (e.g. just cut in VideoCut) uploads straight from memory: no Drive permission needed.
    const mem = getMemoryFile(item.id);
    try {
      await yt.ensureToken();
      if (!mem && item.file?.storage === "drive") await yt.ensureDriveToken();
    } catch (e) {
      return toast("error", (e as Error).message);
    } finally {
      setStarting((s) => {
        const n = new Set(s);
        n.delete(item.id);
        return n;
      });
    }

    run(item, mem)
      .then(() => toast("ok", `“${item.title}” ${item.publishAt && item.publishAt > Date.now() ? `scheduled for ${fmtDateTime(item.publishAt)}` : "uploaded"}.`))
      .catch((e) => toast("error", `“${item.title}”: ${(e as Error).message}`));
  };

  const remove = async (item: Item) => {
    if (!confirm(`Delete “${item.title}”?`)) return;
    setDeleting(item.id);
    try {
      if (item.file?.storage === "drive" && item.status !== "draft") await autopilot.remove(item);
      else await removeItem(user.uid, item.id);
      setSelectedDraftIds((s) => {
        const n = new Set(s);
        n.delete(item.id);
        return n;
      });
    } catch (e) {
      toast("error", (e as Error).message);
    } finally {
      setDeleting(null);
    }
  };

  const toggleSelectDraft = (id: string) => {
    setSelectedDraftIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAllDrafts = (select: boolean) => {
    if (select) setSelectedDraftIds(new Set(readyItems.map((i) => i.id)));
    else setSelectedDraftIds(new Set());
  };

  // Move selected ready-to-post drafts to active queue
  const sendDraftsToQueue = async () => {
    const selected = readyItems.filter((i) => selectedDraftIds.has(i.id));
    if (!selected.length) return toast("error", "Select at least one video to send to queue.");

    setSchedulingDrafts(true);
    try {
      const freeSlots = nextFreeSlots(settings.slots, items, selected.length);

      for (let i = 0; i < selected.length; i++) {
        const item = selected[i];
        const publishAt = freeSlots[i] ?? Date.now() + 3600_000 * (i + 1);
        await patchItem(user.uid, item.id, {
          status: "queued",
          publishAt,
          updatedAt: Date.now(),
        });
      }

      toast("ok", `Moved ${selected.length} video${selected.length > 1 ? "s" : ""} to Scheduled Queue!`);
      setSelectedDraftIds(new Set());
      setTab("queue");
    } catch (err: any) {
      toast("error", err.message);
    } finally {
      setSchedulingDrafts(false);
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
        title="Videos &amp; Queue"
        subtitle="Manage ready-to-post clips, scheduled uploads, and published videos."
        action={
          <div className="flex items-center gap-2">
            <Link to="/cut">
              <Button variant="secondary" icon={<Scissors className="size-4" />}>
                VideoCut
              </Button>
            </Link>
            {autopilot.config && (
              <Button icon={<RefreshCw className={cx("size-4", autopilot.syncing && "animate-spin")} />} onClick={sync} disabled={autopilot.syncing}>
                Sync
              </Button>
            )}
          </div>
        }
      />

      {/* Tabs */}
      <div className="mb-6 flex border-b border-line">
        <button
          onClick={() => setTab("ready")}
          className={cx(
            "flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-semibold transition",
            tab === "ready"
              ? "border-accent text-accent"
              : "border-transparent text-muted hover:text-fg"
          )}
        >
          <Clapperboard className="size-4" />
          <span>Ready to Post</span>
          <span className="rounded-full bg-accent-soft px-2 py-0.5 text-xs text-accent font-mono">
            {readyItems.length}
          </span>
        </button>

        <button
          onClick={() => setTab("queue")}
          className={cx(
            "flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-semibold transition",
            tab === "queue"
              ? "border-accent text-accent"
              : "border-transparent text-muted hover:text-fg"
          )}
        >
          <ListVideo className="size-4" />
          <span>Scheduled Queue</span>
          <span className="rounded-full bg-line px-2 py-0.5 text-xs text-muted font-mono">
            {waiting.length}
          </span>
        </button>

        <button
          onClick={() => setTab("done")}
          className={cx(
            "flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-semibold transition",
            tab === "done"
              ? "border-accent text-accent"
              : "border-transparent text-muted hover:text-fg"
          )}
        >
          <CalendarClock className="size-4" />
          <span>Published ({done.length})</span>
        </button>
      </div>

      {/* ---------------- Tab 1: Ready to Post ---------------- */}
      {tab === "ready" && (
        <div className="space-y-4">
          {readyItems.length > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-card p-3 sm:px-4">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => selectAllDrafts(selectedDraftIds.size !== readyItems.length)}
                  className="flex items-center gap-2 text-xs font-medium text-muted hover:text-fg transition"
                >
                  {selectedDraftIds.size === readyItems.length ? (
                    <CheckSquare className="size-4 text-accent" />
                  ) : (
                    <Square className="size-4" />
                  )}
                  <span>
                    {selectedDraftIds.size === readyItems.length ? "Deselect all" : "Select all"}
                  </span>
                </button>
                <span className="text-xs text-muted">
                  · {selectedDraftIds.size} of {readyItems.length} selected
                </span>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="primary"
                  size="sm"
                  disabled={selectedDraftIds.size === 0}
                  loading={schedulingDrafts}
                  onClick={sendDraftsToQueue}
                  icon={<CalendarClock className="size-4" />}
                >
                  Send {selectedDraftIds.size > 0 ? selectedDraftIds.size : ""} to Queue
                </Button>
              </div>
            </div>
          )}

          <Card>
            {loading ? (
              <div className="grid place-items-center py-16">
                <Spinner />
              </div>
            ) : readyItems.length === 0 ? (
              <Empty
                icon={<Clapperboard className="size-7" />}
                title="No videos in Ready to Post"
                action={
                  <div className="flex flex-wrap justify-center gap-2">
                    <Link to="/cut">
                      <Button variant="primary" icon={<Scissors className="size-4" />}>
                        Cut with VideoCut
                      </Button>
                    </Link>
                    <Link to="/upload/short">
                      <Button icon={<Smartphone className="size-4" />}>Add Shorts</Button>
                    </Link>
                    <Link to="/upload/video">
                      <Button icon={<Video className="size-4" />}>Add Videos</Button>
                    </Link>
                  </div>
                }
              >
                Videos and cut clips you save land here. You can edit each title &amp; description, review them, and send them to the Queue whenever you are ready.
              </Empty>
            ) : (
              <ul className="divide-y divide-line">
                {readyItems.map((item) => {
                  const isSelected = selectedDraftIds.has(item.id);
                  return (
                    <li
                      key={item.id}
                      className={cx(
                        "flex flex-col gap-3 p-4 sm:flex-row sm:items-center transition",
                        isSelected ? "bg-accent-soft/30" : "hover:bg-card-hover/40"
                      )}
                    >
                      <button
                        type="button"
                        onClick={() => toggleSelectDraft(item.id)}
                        className="self-start pt-1 sm:self-center sm:pt-0"
                      >
                        {isSelected ? (
                          <CheckSquare className="size-5 text-accent" />
                        ) : (
                          <Square className="size-5 text-muted hover:text-fg" />
                        )}
                      </button>

                      <div
                        className={cx(
                          "grid size-11 shrink-0 place-items-center rounded-xl",
                          item.kind === "short" ? "bg-accent-2/10 text-accent-2" : "bg-accent-soft text-accent"
                        )}
                      >
                        {item.kind === "short" ? <Smartphone className="size-5" /> : <Clapperboard className="size-5" />}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="truncate font-medium">{item.title}</span>
                          <StatusBadge status={item.status} />
                        </div>

                        {item.description && (
                          <p className="mt-1 line-clamp-2 text-xs text-muted">{item.description}</p>
                        )}

                        <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
                          {item.file && <span>{item.file.name}</span>}
                          {item.file?.size ? <span>{fmtBytes(item.file.size)}</span> : null}
                          {item.publishAt ? <span>Planned: {fmtDateTime(item.publishAt)}</span> : <span>No scheduled time</span>}
                        </div>
                      </div>

                      <div className="flex shrink-0 gap-2">
                        <Button
                          size="sm"
                          variant="secondary"
                          icon={<Pencil className="size-3.5" />}
                          onClick={() => setEditing(item)}
                          title="Edit title & description"
                        >
                          Edit
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          loading={deleting === item.id}
                          onClick={() => remove(item)}
                          title="Delete"
                          className="hover:text-danger"
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        </div>
      )}

      {/* ---------------- Tab 2: Scheduled Queue ---------------- */}
      {tab === "queue" && (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <Stat label="Waiting in Queue" value={waiting.length} />
            <Stat label="Next to go live" value={next?.publishAt ? fmtDateTime(next.publishAt) : "—"} />
            <Stat label="Size in Drive" value={fmtBytes(waiting.reduce((n, i) => n + (i.file?.size ?? 0), 0))} />
          </div>

          <div className="mb-2">
            {!autopilot.config ? (
              <Alert tone="info" title="Autopilot is not set up" action={<Link to="/settings#autopilot"><Button size="sm" variant="primary">Set up</Button></Link>}>
                With Autopilot you can add 100s of videos and they go out on schedule even when your PC is off.
              </Alert>
            ) : !yt.driveAllowed ? (
              <Alert tone="warn" title="Reconnect to see live status" action={<Button size="sm" variant="primary" onClick={() => yt.connectDrive().catch((e) => toast("error", e.message))}>Connect</Button>}>
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
                    <button onClick={() => setTab("ready")} className="btn btn-primary text-xs">
                      View Ready to Post ({readyItems.length})
                    </button>
                    <Link to="/cut">
                      <Button icon={<Scissors className="size-4" />}>VideoCut Studio</Button>
                    </Link>
                  </div>
                }
              >
                Videos scheduled for upload appear here until they go live on YouTube.
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
                      <div
                        className={cx(
                          "grid size-11 shrink-0 place-items-center rounded-xl",
                          item.kind === "short" ? "bg-accent-2/10 text-accent-2" : "bg-accent-soft text-accent"
                        )}
                      >
                        {item.kind === "short" ? <Smartphone className="size-5" /> : <Clapperboard className="size-5" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="truncate font-medium">{item.title}</span>
                          <StatusBadge status={status} />
                          {onDrive && <Badge><Bot className="size-3" /> Autopilot</Badge>}
                        </div>
                        {item.description && (
                          <p className="mt-1 line-clamp-1 text-xs text-muted">{item.description}</p>
                        )}
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
                          loading={starting.has(item.id)}
                          onClick={() => uploadOne(item)}
                          title="Upload right now from this tab"
                        >
                          {status === "failed" ? "Retry" : "Upload now"}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={!!job || status === "uploading"}
                          onClick={() => setEditing(item)}
                          title="Edit video title & description"
                        >
                          <Pencil className="size-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          loading={deleting === item.id}
                          disabled={!!job || (status === "uploading" && onDrive)}
                          onClick={() => remove(item)}
                          title="Delete"
                          className="hover:text-danger"
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        </div>
      )}

      {/* ---------------- Tab 3: Published ---------------- */}
      {tab === "done" && (
        <Card>
          <CardHeader title="Recently published / scheduled on YouTube" />
          {done.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted">No published videos yet.</div>
          ) : (
            <ul className="divide-y divide-line">
              {done.map((item) => (
                <li key={item.id} className="flex items-center gap-3 px-5 py-3 text-sm">
                  <StatusBadge status={item.status} />
                  <span className="min-w-0 flex-1 truncate font-medium">{item.title}</span>
                  <span className="hidden text-xs text-muted sm:block">
                    {item.status === "scheduled" && item.publishAt ? `goes live ${fmtRelative(item.publishAt)}` : item.uploadedAt ? fmtRelative(item.uploadedAt) : ""}
                  </span>
                  {item.youtubeId && (
                    <a
                      href={`https://studio.youtube.com/video/${item.youtubeId}/edit`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-muted hover:text-fg"
                      title="Open in YouTube Studio"
                    >
                      <ExternalLink className="size-4" />
                    </a>
                  )}
                </li>
              ))}
            </ul>
          )}
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
