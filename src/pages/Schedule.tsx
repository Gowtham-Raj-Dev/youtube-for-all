import { useMemo, useState } from "react";
import { Link } from "react-router";
import { CalendarClock, Clapperboard, ExternalLink, Plus, RefreshCw, Settings2, Smartphone } from "lucide-react";
import { useUser } from "../lib/auth";
import { useSettings } from "../lib/settings";
import { patchItem, useItems, type Item } from "../lib/items";
import { useYouTube } from "../lib/youtube-context";
import { getVideoStatuses } from "../lib/youtube";
import { fmtSlot, fmtTime, slotDate, sortSlots, timeZoneName } from "../lib/schedule";
import { Badge, Button, Card, cx, PageHeader, Segmented, StatusBadge, useToast } from "../components/ui";

type Row = { time: number; item: Item | null };

export default function Schedule() {
  const user = useUser();
  const { settings } = useSettings();
  const yt = useYouTube();
  const { items } = useItems(user.uid);
  const toast = useToast();
  const [days, setDays] = useState<"7" | "14" | "30">("7");
  const [syncing, setSyncing] = useState(false);
  const slots = sortSlots(settings.slots);

  const agenda = useMemo(() => {
    const planned = items.filter((i) => i.publishAt && (i.status === "scheduled" || i.status === "queued" || i.status === "uploading" || i.status === "failed"));
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const out: { day: Date; rows: Row[] }[] = [];
    for (let d = 0; d < Number(days); d++) {
      const day = new Date(start);
      day.setDate(start.getDate() + d);
      const end = new Date(day);
      end.setDate(day.getDate() + 1);
      const dayItems = planned.filter((i) => i.publishAt! >= day.getTime() && i.publishAt! < end.getTime());
      const used = new Set<string>();
      const rows: Row[] = slots.map((s) => {
        const t = slotDate(day, s).getTime();
        const it = dayItems.find((i) => !used.has(i.id) && Math.abs(i.publishAt! - t) < 60_000);
        if (it) used.add(it.id);
        return { time: t, item: it ?? null };
      });
      for (const i of dayItems) if (!used.has(i.id)) rows.push({ time: i.publishAt!, item: i });
      rows.sort((a, b) => a.time - b.time);
      out.push({ day, rows: rows.filter((r) => r.item || r.time > Date.now()) });
    }
    return out;
  }, [items, slots, days]);

  const booked = agenda.reduce((n, d) => n + d.rows.filter((r) => r.item).length, 0);
  const free = agenda.reduce((n, d) => n + d.rows.filter((r) => !r.item).length, 0);

  const sync = async () => {
    const tracked = items.filter((i) => i.youtubeId && (i.status === "scheduled" || i.status === "uploaded"));
    if (!tracked.length) return toast("info", "Nothing to sync yet.");
    setSyncing(true);
    try {
      const token = await yt.ensureToken();
      const statuses = await getVideoStatuses(token, tracked.map((i) => i.youtubeId!));
      const byId = new Map(statuses.map((s) => [s.id, s]));
      let changed = 0;
      for (const it of tracked) {
        const s = byId.get(it.youtubeId!);
        if (!s) {
          await patchItem(user.uid, it.id, { status: "failed", error: "This video was deleted on YouTube." });
          changed++;
        } else if (s.uploadStatus === "rejected" || s.uploadStatus === "failed") {
          await patchItem(user.uid, it.id, { status: "failed", error: `YouTube ${s.uploadStatus} it: ${s.rejectionReason ?? s.failureReason ?? "unknown"}` });
          changed++;
        } else if (it.status === "scheduled" && (!s.publishAt || s.privacy === "public")) {
          await patchItem(user.uid, it.id, { status: "uploaded", privacy: s.privacy, publishAt: it.publishAt });
          changed++;
        } else if (it.status === "scheduled" && s.publishAt && new Date(s.publishAt).getTime() !== it.publishAt) {
          await patchItem(user.uid, it.id, { publishAt: new Date(s.publishAt).getTime() });
          changed++;
        }
      }
      toast("ok", changed ? `Synced — ${changed} update${changed > 1 ? "s" : ""} from YouTube.` : "Everything matches YouTube.");
    } catch (e) {
      toast("error", (e as Error).message);
    } finally {
      setSyncing(false);
    }
  };

  return (
    <>
      <PageHeader
        title="Schedule"
        subtitle={`Your publishing calendar · times in ${timeZoneName}`}
        action={
          <div className="flex gap-2">
            <Button icon={<RefreshCw className={cx("size-4", syncing && "animate-spin")} />} onClick={sync} disabled={syncing || !settings.youtubeClientId}>
              Sync with YouTube
            </Button>
            <Link to="/upload/short">
              <Button variant="primary" icon={<Plus className="size-4" />}>Add</Button>
            </Link>
          </div>
        }
      />

      <div className="mb-6 grid gap-3 lg:grid-cols-[1fr_auto]">
        <Card className="flex flex-wrap items-center gap-3 px-4 py-3.5">
          <CalendarClock className="size-5 text-accent" />
          <span className="text-sm text-muted">Daily slots:</span>
          {slots.length ? (
            slots.map((s) => (
              <Badge key={s} className="bg-bg-soft px-2.5 py-1 text-fg ring-1 ring-line">{fmtSlot(s)}</Badge>
            ))
          ) : (
            <span className="text-sm text-warn">none — add some</span>
          )}
          <Link to="/settings#schedule" className="ml-auto">
            <Button size="sm" variant="ghost" icon={<Settings2 className="size-4" />}>Edit slots</Button>
          </Link>
        </Card>
        <div className="w-full lg:w-72">
          <Segmented<"7" | "14" | "30">
            value={days}
            onChange={setDays}
            options={[
              { value: "7", label: "7 days" },
              { value: "14", label: "14 days" },
              { value: "30", label: "30 days" },
            ]}
          />
        </div>
      </div>

      <p className="mb-4 text-sm text-muted">
        <b className="text-fg">{booked}</b> booked · <b className="text-fg">{free}</b> free slots in the next {days} days
      </p>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {agenda.map(({ day, rows }) => {
          const today = new Date().toDateString() === day.toDateString();
          return (
            <Card key={day.toISOString()} className={cx(today && "ring-1 ring-accent/40")}>
              <div className="flex items-center justify-between border-b border-line px-4 py-3">
                <div>
                  <div className="text-sm font-semibold">{day.toLocaleDateString([], { weekday: "long" })}</div>
                  <div className="text-xs text-muted">{day.toLocaleDateString([], { day: "numeric", month: "long" })}</div>
                </div>
                {today && <Badge className="grad-bg text-on-accent">Today</Badge>}
              </div>
              {rows.length === 0 ? (
                <p className="px-4 py-6 text-center text-sm text-faint">No slots left today</p>
              ) : (
                <ul className="divide-y divide-line">
                  {rows.map(({ time, item }) => (
                    <li key={`${time}-${item?.id ?? "free"}`} className="flex items-center gap-3 px-4 py-2.5">
                      <span className="w-16 shrink-0 text-xs font-medium tabular-nums text-muted">{fmtTime(time)}</span>
                      {item ? (
                        <>
                          {item.kind === "short" ? <Smartphone className="size-4 shrink-0 text-accent-2" /> : <Clapperboard className="size-4 shrink-0 text-accent" />}
                          <span className="min-w-0 flex-1 truncate text-sm">{item.title}</span>
                          <StatusBadge status={item.status} />
                          {item.youtubeId && (
                            <a href={`https://studio.youtube.com/video/${item.youtubeId}/edit`} target="_blank" rel="noreferrer" className="text-faint hover:text-fg">
                              <ExternalLink className="size-3.5" />
                            </a>
                          )}
                        </>
                      ) : (
                        <span className="flex-1 text-sm text-faint italic">Free slot</span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          );
        })}
      </div>

      <p className="mt-6 text-xs text-faint">
        Scheduled videos are already on YouTube as private and go public by themselves. To change a time after upload, open the video in YouTube Studio.
      </p>
    </>
  );
}
