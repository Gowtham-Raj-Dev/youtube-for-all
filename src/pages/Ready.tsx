import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router";
import {
  CheckSquare,
  Clapperboard,
  ListVideo,
  Save,
  Scissors,
  Send,
  Smartphone,
  Sparkles,
  Square,
  Trash2,
  Video,
} from "lucide-react";
import { useUser } from "../lib/auth";
import { useSettings } from "../lib/settings";
import { patchItem, removeItem, useItems, type Item } from "../lib/items";
import { getMemoryFile } from "../lib/uploads";
import { nextFreeSlots, fmtBytes, fmtDateTime, toLocalInput, fromLocalInput } from "../lib/schedule";
import { parseTags } from "../lib/meta";
import {
  Button,
  Card,
  cx,
  Field,
  Input,
  PageHeader,
  Spinner,
  Textarea,
  useToast,
} from "../components/ui";

function ReadyCard({
  item,
  selected,
  onToggleSelect,
  onPostSingle,
  onDelete,
}: {
  item: Item;
  selected: boolean;
  onToggleSelect: () => void;
  onPostSingle: (item: Item) => void;
  onDelete: (item: Item) => void;
}) {
  const user = useUser();
  const toast = useToast();
  const [title, setTitle] = useState(item.title);
  const [description, setDescription] = useState(item.description);
  const [tags, setTags] = useState(item.tags.join(", "));
  const [customTime, setCustomTime] = useState(item.publishAt ? toLocalInput(item.publishAt) : "");
  const [isEditingCustomTime, setIsEditingCustomTime] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  const mem = getMemoryFile(item.id);
  const videoUrl = useMemo(() => {
    if (mem?.video) return URL.createObjectURL(mem.video);
    return null;
  }, [mem]);

  const thumbUrl = useMemo(() => {
    if (mem?.thumb) return URL.createObjectURL(mem.thumb);
    return null;
  }, [mem]);

  const isShort = item.kind === "short";
  const hasChanges = title !== item.title || description !== item.description || tags !== item.tags.join(", ") || (customTime ? fromLocalInput(customTime) !== item.publishAt : false);

  const handleSave = async () => {
    if (!title.trim()) {
      toast("error", "Title cannot be empty");
      return;
    }
    setSaving(true);
    try {
      const parsedTags = parseTags(tags);
      const patch: Partial<Item> = {
        title: title.trim(),
        description,
        tags: parsedTags,
        updatedAt: Date.now(),
      };
      if (customTime) {
        patch.publishAt = fromLocalInput(customTime);
      }
      await patchItem(user.uid, item.id, patch);
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 2000);
      toast("ok", `Saved changes for “${title.trim().slice(0, 30)}…”`);
    } catch (e: any) {
      toast("error", e.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className={cx("transition border-2", selected ? "border-accent bg-accent-soft/10" : "border-line hover:border-line-hover")}>
      <div className="p-4 sm:p-5">
        <div className="flex flex-col gap-4 md:flex-row">
          {/* Left: Thumbnail / Video Preview & Selector */}
          <div className="flex flex-col items-start gap-3 sm:w-56 shrink-0">
            <div className="relative w-full aspect-[9/16] max-h-64 sm:max-h-72 rounded-xl overflow-hidden bg-black border border-line flex items-center justify-center group">
              {videoUrl ? (
                <video
                  src={videoUrl}
                  controls
                  preload="metadata"
                  className="w-full h-full object-contain"
                />
              ) : thumbUrl ? (
                <img
                  src={thumbUrl}
                  alt={item.title}
                  className="w-full h-full object-contain"
                />
              ) : (
                <div className="flex flex-col items-center gap-2 text-muted p-4 text-center">
                  {isShort ? <Smartphone className="size-8 opacity-40" /> : <Clapperboard className="size-8 opacity-40" />}
                  <span className="text-xs">{item.file?.name || "Video clip"}</span>
                </div>
              )}

              <span className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-black/80 backdrop-blur text-[11px] font-mono font-medium text-white shadow">
                {isShort ? "9:16 Short" : "Video"}
              </span>

              {item.file?.size ? (
                <span className="absolute bottom-2 right-2 px-1.5 py-0.5 rounded bg-black/80 backdrop-blur text-[10px] font-mono text-zinc-300">
                  {fmtBytes(item.file.size)}
                </span>
              ) : null}
            </div>

            {/* Selection Checkbox */}
            <button
              type="button"
              onClick={onToggleSelect}
              className={cx(
                "w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl border text-xs font-semibold transition",
                selected
                  ? "border-accent bg-accent text-on-accent shadow-sm"
                  : "border-line bg-card hover:bg-card-hover text-muted hover:text-fg"
              )}
            >
              {selected ? <CheckSquare className="size-4" /> : <Square className="size-4" />}
              <span>{selected ? "Selected" : "Select video"}</span>
            </button>
          </div>

          {/* Right: Inline Title, Description, and Tags Editor */}
          <div className="flex-1 space-y-3.5 min-w-0">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold uppercase tracking-wider text-muted">
                  Title <span className="font-mono text-[10px] lowercase text-faint">({title.length}/100)</span>
                </label>
                {hasChanges && (
                  <span className="text-[11px] text-amber-500 font-medium">Unsaved changes</span>
                )}
              </div>
              <Input
                value={title}
                maxLength={100}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Give this clip an engaging title..."
                className="font-medium"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold uppercase tracking-wider text-muted">
                  Description <span className="font-mono text-[10px] lowercase text-faint">({description.length}/5000)</span>
                </label>
              </div>
              <Textarea
                rows={3}
                value={description}
                maxLength={5000}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Add description, timestamps, links, or hashtags..."
                className="text-xs sm:text-sm"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-muted mb-1">
                  Tags <span className="text-faint text-[10px] lowercase">(comma separated)</span>
                </label>
                <Input
                  value={tags}
                  onChange={(e) => setTags(e.target.value)}
                  placeholder="e.g. shorts, viral, comedy"
                  className="text-xs"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-muted">
                    Custom Schedule Time
                  </label>
                  {!isEditingCustomTime && (
                    <button
                      type="button"
                      onClick={() => setIsEditingCustomTime(true)}
                      className="text-[10px] text-accent hover:underline"
                    >
                      {customTime ? "Change" : "+ Set specific time"}
                    </button>
                  )}
                </div>
                {isEditingCustomTime || customTime ? (
                  <Input
                    type="datetime-local"
                    value={customTime}
                    onChange={(e) => setCustomTime(e.target.value)}
                    className="text-xs font-mono"
                  />
                ) : (
                  <div className="text-xs text-muted py-2 px-3 rounded-lg border border-dashed border-line bg-card/50">
                    Will use next free slot from your daily schedule
                  </div>
                )}
              </div>
            </div>

            {/* Bottom Actions Bar */}
            <div className="pt-2 flex flex-wrap items-center justify-between gap-2 border-t border-line">
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant={hasChanges ? "primary" : "secondary"}
                  icon={saving ? <Spinner className="size-3.5" /> : <Save className="size-3.5" />}
                  disabled={saving || !hasChanges}
                  onClick={handleSave}
                >
                  {saving ? "Saving…" : savedSuccess ? "Saved!" : "Save Changes"}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-danger hover:bg-danger/10"
                  icon={<Trash2 className="size-3.5" />}
                  onClick={() => onDelete(item)}
                >
                  Delete
                </Button>
              </div>

              <Button
                size="sm"
                variant="primary"
                icon={<Send className="size-3.5" />}
                onClick={() => onPostSingle(item)}
              >
                Post to Queue
              </Button>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}

export default function ReadyPage() {
  const user = useUser();
  const { settings } = useSettings();
  const { items } = useItems(user.uid);
  const toast = useToast();
  const navigate = useNavigate();

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [templateOpen, setTemplateOpen] = useState(false);
  const [prefix, setPrefix] = useState("");
  const [commonTags, setCommonTags] = useState("");
  const [footerDesc, setFooterDesc] = useState("");

  const readyItems = useMemo(
    () => items.filter((i) => i.status === "draft").sort((a, b) => a.createdAt - b.createdAt),
    [items]
  );

  const selectedCount = selectedIds.size;
  const allSelected = readyItems.length > 0 && selectedCount === readyItems.length;

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = (enable: boolean) => {
    if (enable) setSelectedIds(new Set(readyItems.map((i) => i.id)));
    else setSelectedIds(new Set());
  };

  // Post single video to queue
  const postSingleToQueue = async (item: Item) => {
    setBusy(true);
    try {
      const freeSlots = nextFreeSlots(settings.slots, items, 1);
      const publishAt = item.publishAt || freeSlots[0] || Date.now() + 3600_000;
      await patchItem(user.uid, item.id, {
        status: "queued",
        publishAt,
        updatedAt: Date.now(),
      });
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(item.id);
        return next;
      });
      toast("ok", `“${item.title}” moved to Scheduled Queue for ${fmtDateTime(publishAt)}!`);
    } catch (e: any) {
      toast("error", e.message || "Failed to schedule item");
    } finally {
      setBusy(false);
    }
  };

  // Bulk Post to Queue
  const postSelectedToQueue = async () => {
    const targets = readyItems.filter((i) => selectedIds.has(i.id));
    if (!targets.length) {
      toast("error", "Please select at least one video to post to the queue.");
      return;
    }

    setBusy(true);
    try {
      const freeSlots = nextFreeSlots(settings.slots, items, targets.length);

      for (let i = 0; i < targets.length; i++) {
        const item = targets[i];
        const publishAt = item.publishAt || freeSlots[i] || Date.now() + 3600_000 * (i + 1);
        await patchItem(user.uid, item.id, {
          status: "queued",
          publishAt,
          updatedAt: Date.now(),
        });
      }

      toast("ok", `Successfully posted ${targets.length} video${targets.length > 1 ? "s" : ""} to Scheduled Queue!`);
      setSelectedIds(new Set());
      navigate("/queue");
    } catch (e: any) {
      toast("error", e.message || "Failed to post to queue");
    } finally {
      setBusy(false);
    }
  };

  // Delete single video
  const deleteItem = async (item: Item) => {
    if (!confirm(`Delete “${item.title}”?`)) return;
    try {
      await removeItem(user.uid, item.id);
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(item.id);
        return next;
      });
      toast("ok", "Video deleted.");
    } catch (e: any) {
      toast("error", e.message || "Failed to delete");
    }
  };

  // Delete selected
  const deleteSelected = async () => {
    const targets = readyItems.filter((i) => selectedIds.has(i.id));
    if (!targets.length) return;
    if (!confirm(`Delete all ${targets.length} selected video drafts?`)) return;

    setBusy(true);
    try {
      for (const item of targets) {
        await removeItem(user.uid, item.id);
      }
      setSelectedIds(new Set());
      toast("ok", `Deleted ${targets.length} video drafts.`);
    } catch (e: any) {
      toast("error", e.message || "Failed to delete");
    } finally {
      setBusy(false);
    }
  };

  // Bulk Apply Template
  const applyTemplate = async () => {
    const targets = readyItems.filter((i) => (selectedCount > 0 ? selectedIds.has(i.id) : true));
    if (!targets.length) return;

    setBusy(true);
    try {
      const tagsToAdd = parseTags(commonTags);

      for (let i = 0; i < targets.length; i++) {
        const item = targets[i];
        let newTitle = item.title;
        if (prefix.trim()) {
          newTitle = `${prefix.trim()} ${item.title}`.slice(0, 100);
        }

        let newDesc = item.description;
        if (footerDesc.trim() && !newDesc.includes(footerDesc.trim())) {
          newDesc = newDesc ? `${newDesc}\n\n${footerDesc.trim()}` : footerDesc.trim();
        }

        const mergedTags = Array.from(new Set([...item.tags, ...tagsToAdd]));

        await patchItem(user.uid, item.id, {
          title: newTitle,
          description: newDesc,
          tags: mergedTags,
          updatedAt: Date.now(),
        });
      }

      toast("ok", `Applied template across ${targets.length} video${targets.length > 1 ? "s" : ""}!`);
      setTemplateOpen(false);
    } catch (e: any) {
      toast("error", e.message || "Failed to apply template");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Ready to Post"
        subtitle="Review, edit titles & descriptions, and send your cut videos to the scheduled queue."
        action={
          <div className="flex items-center gap-2">
            <Link to="/cut">
              <Button variant="secondary" icon={<Scissors className="size-4" />}>
                VideoCut Studio
              </Button>
            </Link>
            <Link to="/queue">
              <Button variant="ghost" icon={<ListVideo className="size-4" />}>
                View Queue
              </Button>
            </Link>
          </div>
        }
      />

      {/* Bulk Toolbar */}
      {readyItems.length > 0 && (
        <Card className="border-line bg-card/60 backdrop-blur p-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => selectAll(!allSelected)}
                className="inline-flex items-center gap-2 text-xs font-semibold px-3 py-1.5 rounded-lg border border-line bg-card hover:bg-card-hover transition"
              >
                {allSelected ? <CheckSquare className="size-4 text-accent" /> : <Square className="size-4 text-muted" />}
                <span>{allSelected ? "Deselect All" : "Select All"} ({readyItems.length})</span>
              </button>

              {selectedCount > 0 && (
                <span className="text-xs font-medium text-accent">
                  {selectedCount} video{selectedCount > 1 ? "s" : ""} selected
                </span>
              )}
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <Button
                size="sm"
                variant="secondary"
                icon={<Sparkles className="size-3.5" />}
                onClick={() => setTemplateOpen(!templateOpen)}
              >
                Batch Template
              </Button>

              {selectedCount > 0 && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-danger hover:bg-danger/10"
                  icon={<Trash2 className="size-3.5" />}
                  disabled={busy}
                  onClick={deleteSelected}
                >
                  Delete ({selectedCount})
                </Button>
              )}

              <Button
                size="sm"
                variant="primary"
                icon={busy ? <Spinner className="size-3.5" /> : <Send className="size-3.5" />}
                disabled={busy || selectedCount === 0}
                onClick={postSelectedToQueue}
              >
                Post to Queue ({selectedCount || "0"})
              </Button>
            </div>
          </div>

          {/* Collapsible Batch Template Drawer */}
          {templateOpen && (
            <div className="mt-4 pt-4 border-t border-line space-y-3">
              <div className="text-xs font-semibold uppercase tracking-wider text-muted">
                Batch Metadata Template (Applies to {selectedCount > 0 ? `${selectedCount} selected` : "all"} videos)
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <Field label="Title Prefix (e.g. Part or Ep)">
                  <Input
                    placeholder="e.g. Episode 1 -"
                    value={prefix}
                    onChange={(e) => setPrefix(e.target.value)}
                  />
                </Field>
                <Field label="Common Tags (comma separated)">
                  <Input
                    placeholder="e.g. shorts, viral, codelove"
                    value={commonTags}
                    onChange={(e) => setCommonTags(e.target.value)}
                  />
                </Field>
                <Field label="Append Description Footer">
                  <Input
                    placeholder="e.g. Follow for more! #Shorts"
                    value={footerDesc}
                    onChange={(e) => setFooterDesc(e.target.value)}
                  />
                </Field>
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <Button size="sm" variant="ghost" onClick={() => setTemplateOpen(false)}>
                  Cancel
                </Button>
                <Button size="sm" variant="primary" loading={busy} onClick={applyTemplate}>
                  Apply to {selectedCount > 0 ? `${selectedCount} Selected` : `All ${readyItems.length}`}
                </Button>
              </div>
            </div>
          )}
        </Card>
      )}

      {/* Videos List */}
      {readyItems.length === 0 ? (
        <Card className="p-12 text-center">
          <div className="max-w-md mx-auto space-y-4">
            <div className="grad-bg mx-auto grid size-16 place-items-center rounded-2xl text-on-accent shadow-lg shadow-accent/20">
              <Clapperboard className="size-8" />
            </div>
            <div>
              <h3 className="text-lg font-bold">No videos waiting to be posted</h3>
              <p className="mt-1 text-sm text-muted">
                Cut a long video into 30-second vertical Shorts using VideoCut Studio, or upload videos directly to prepare them for scheduling.
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
              <Link to="/cut">
                <Button variant="primary" icon={<Scissors className="size-4" />}>
                  Open VideoCut Studio
                </Button>
              </Link>
              <Link to="/upload/short">
                <Button variant="secondary" icon={<Smartphone className="size-4" />}>
                  Upload Shorts
                </Button>
              </Link>
              <Link to="/upload/video">
                <Button variant="ghost" icon={<Video className="size-4" />}>
                  Upload Videos
                </Button>
              </Link>
            </div>
          </div>
        </Card>
      ) : (
        <div className="space-y-4">
          {readyItems.map((item) => (
            <ReadyCard
              key={item.id}
              item={item}
              selected={selectedIds.has(item.id)}
              onToggleSelect={() => toggleSelect(item.id)}
              onPostSingle={postSingleToQueue}
              onDelete={deleteItem}
            />
          ))}
        </div>
      )}
    </div>
  );
}
