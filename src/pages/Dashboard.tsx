import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import {
  ArrowRight,
  ArrowUpRight,
  Bot,
  CalendarClock,
  Check,
  Clapperboard,
  Eye,
  Gauge,
  ListVideo,
  PlaySquare,
  RefreshCw,
  Send,
  Smartphone,
  Users,
  Youtube,
} from "lucide-react";
import { useUser } from "../lib/auth";
import { useSettings } from "../lib/settings";
import { useItems, type Item } from "../lib/items";
import { useYouTube } from "../lib/youtube-context";
import { useAutopilot } from "../lib/autopilot-context";
import { statusTime } from "../lib/autopilot";
import { getRecentUploads, getStoredToken, type RecentUpload } from "../lib/youtube";
import { DAILY_QUOTA, quotaResetLabel, UPLOAD_COST, useQuotaUsed } from "../lib/quota";
import { fmtCount, fmtRelative, fmtTime } from "../lib/schedule";
import { Badge, Button, Card, cx, Progress, StatusBadge, useToast } from "../components/ui";

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

function dayLabel(ms: number) {
  const d = new Date(ms);
  const today = new Date();
  const tomorrow = new Date();
  tomorrow.setDate(today.getDate() + 1);
  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === tomorrow.toDateString()) return "Tomorrow";
  return d.toLocaleDateString([], { weekday: "short", day: "numeric", month: "short" });
}

/** Videos going live per day for the next 7 days. */
function WeekChart({ items }: { items: Item[] }) {
  const days = useMemo(() => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    return Array.from({ length: 7 }, (_, i) => {
      const from = new Date(start);
      from.setDate(start.getDate() + i);
      const to = new Date(from);
      to.setDate(from.getDate() + 1);
      const inDay = items.filter((it) => it.publishAt && it.publishAt >= from.getTime() && it.publishAt < to.getTime() && ["queued", "scheduled", "uploading"].includes(it.status));
      return { label: i === 0 ? "Today" : from.toLocaleDateString([], { weekday: "short" }), shorts: inDay.filter((x) => x.kind === "short").length, videos: inDay.filter((x) => x.kind === "video").length };
    });
  }, [items]);
  const max = Math.max(3, ...days.map((d) => d.shorts + d.videos));
  const total = days.reduce((n, d) => n + d.shorts + d.videos, 0);

  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold">Next 7 days</h2>
          <p className="text-sm text-muted">{total ? `${total} video${total > 1 ? "s" : ""} going live` : "Nothing planned yet"}</p>
        </div>
        <div className="flex items-center gap-3 text-xs text-muted">
          <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-accent-2" /> Shorts</span>
          <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-accent" /> Videos</span>
        </div>
      </div>
      <div className="mt-6 flex h-40 items-end gap-2 sm:gap-3">
        {days.map((d) => {
          const n = d.shorts + d.videos;
          return (
            <div key={d.label} className="group flex h-full flex-1 flex-col items-center justify-end gap-2">
              <span className={cx("text-xs font-semibold tabular-nums", n ? "text-fg" : "text-faint")}>{n}</span>
              <div className="flex w-full max-w-10 flex-col-reverse overflow-hidden rounded-lg bg-bg-soft" style={{ height: `${Math.max(6, (n / max) * 100)}%` }}>
                {n > 0 && (
                  <>
                    <div className="bg-accent-2 transition-all group-hover:brightness-110" style={{ height: `${(d.shorts / n) * 100}%` }} />
                    <div className="bg-accent transition-all group-hover:brightness-110" style={{ height: `${(d.videos / n) * 100}%` }} />
                  </>
                )}
              </div>
              <span className={cx("text-[11px]", d.label === "Today" ? "font-semibold text-accent" : "text-muted")}>{d.label}</span>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

export default function Dashboard() {
  const user = useUser();
  const { settings } = useSettings();
  const yt = useYouTube();
  const autopilot = useAutopilot();
  const { items } = useItems(user.uid);
  const quotaUsed = useQuotaUsed();
  const toast = useToast();
  const [recent, setRecent] = useState<RecentUpload[] | null>(null);

  const now = Date.now();
  const upcoming = items
    .filter((i) => i.publishAt && i.publishAt > now && (i.status === "scheduled" || i.status === "queued"))
    .sort((a, b) => a.publishAt! - b.publishAt!);
  const queued = items.filter((i) => i.status === "queued").length;
  const failed = items.filter((i) => i.status === "failed").length;
  const scheduled = items.filter((i) => i.status === "scheduled" && i.publishAt && i.publishAt > now).length;
  const sentThisWeek = items.filter((i) => i.uploadedAt && i.uploadedAt > now - 7 * 86400_000).length;
  const plannedUntil = upcoming.length ? upcoming[upcoming.length - 1].publishAt! : null;
  const quotaLeft = Math.max(0, Math.floor((DAILY_QUOTA - quotaUsed) / UPLOAD_COST));
  const lastRun = statusTime(autopilot.status?.lastRun);

  useEffect(() => {
    const token = settings.youtubeClientId ? getStoredToken(settings.youtubeClientId) : null;
    if (!token || !yt.channel?.uploadsPlaylist) return;
    getRecentUploads(token, yt.channel.uploadsPlaylist, 6).then(setRecent).catch(() => setRecent(null));
  }, [yt.connected, yt.channel?.uploadsPlaylist, settings.youtubeClientId]);

  const steps = [
    { done: !!settings.youtubeClientId, label: "Add your OAuth Client ID", to: "/settings#youtube" },
    { done: !!yt.channel, label: "Connect your YouTube channel", to: "/settings#youtube" },
    { done: !!autopilot.config, label: "Create Autopilot", to: "/settings#autopilot" },
    { done: autopilot.running, label: "Activate Autopilot", to: "/settings#autopilot" },
  ];
  const doneSteps = steps.filter((s) => s.done).length;
  const firstName = (user.displayName ?? "").split(" ")[0] || "there";

  // Group the upcoming list by day for the timeline.
  const timeline = upcoming.slice(0, 8).reduce<{ day: string; list: Item[] }[]>((acc, it) => {
    const day = dayLabel(it.publishAt!);
    const last = acc[acc.length - 1];
    if (last?.day === day) last.list.push(it);
    else acc.push({ day, list: [it] });
    return acc;
  }, []);

  return (
    <div className="space-y-6">
      {/* Welcome */}
      <section className="relative overflow-hidden rounded-3xl border border-line bg-card p-6 sm:p-8">
        <div className="pointer-events-none absolute -top-24 -right-24 size-72 rounded-full bg-accent/15 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 left-1/3 size-72 rounded-full bg-accent-2/15 blur-3xl" />
        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm text-muted">{greeting()},</p>
            <h1 className="mt-1 text-3xl font-extrabold tracking-tight sm:text-4xl">{firstName} 👋</h1>
            <p className="mt-2 max-w-lg text-muted">
              {plannedUntil
                ? <>Your channel is planned until <b className="text-fg">{dayLabel(plannedUntil)}</b>. {autopilot.running ? "Autopilot is taking care of it." : "Keep Autopilot on to post with your PC off."}</>
                : "Add a few Shorts and let UTubeFlow post them on schedule."}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:flex">
            <Link to="/upload/short">
              <Button variant="primary" size="lg" className="w-full" icon={<Smartphone className="size-4.5" />}>Upload Shorts</Button>
            </Link>
            <Link to="/upload/video">
              <Button size="lg" className="w-full" icon={<Clapperboard className="size-4.5" />}>Upload Videos</Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Setup progress */}
      {doneSteps < steps.length && (
        <Card className="p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-semibold">Finish setup · {doneSteps}/{steps.length}</h2>
              <p className="text-sm text-muted">About 10 minutes, once. Every step has a direct link.</p>
            </div>
            <Link to="/guide"><Button size="sm" icon={<ArrowRight className="size-4" />}>Open guide</Button></Link>
          </div>
          <Progress value={doneSteps / steps.length} className="mt-4" />
          <ol className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {steps.map((s, i) => (
              <li key={s.label}>
                <Link to={s.to} className={cx("flex items-center gap-2.5 rounded-xl border px-3 py-2.5 text-sm transition", s.done ? "border-line text-faint" : "border-line bg-bg-soft hover:border-accent/40")}>
                  <span className={cx("grid size-6 shrink-0 place-items-center rounded-full text-xs font-bold", s.done ? "bg-ok/15 text-ok" : "grad-bg text-on-accent")}>
                    {s.done ? <Check className="size-3.5" /> : i + 1}
                  </span>
                  <span className={cx("truncate", s.done && "line-through")}>{s.label}</span>
                </Link>
              </li>
            ))}
          </ol>
        </Card>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { icon: CalendarClock, label: "Scheduled on YouTube", value: scheduled, to: "/schedule", tone: "text-accent-2 bg-accent-2/15" },
          { icon: ListVideo, label: "Waiting in queue", value: queued, to: "/queue", tone: "text-info bg-info/15", note: failed ? `${failed} need attention` : undefined },
          { icon: Send, label: "Sent this week", value: sentThisWeek, to: "/queue", tone: "text-ok bg-ok/15" },
          { icon: Gauge, label: "Uploads left today", value: quotaLeft, to: "/settings", tone: "text-accent bg-accent-soft", note: `quota resets ${quotaResetLabel()}` },
        ].map(({ icon: Icon, label, value, to, tone, note }) => (
          <Link key={label} to={to}>
            <Card className="h-full p-4 transition hover:-translate-y-0.5 hover:border-accent/40 sm:p-5">
              <span className={cx("grid size-10 place-items-center rounded-xl", tone)}>
                <Icon className="size-5" />
              </span>
              <div className="mt-4 text-3xl font-extrabold tabular-nums">{value}</div>
              <div className="mt-0.5 text-sm text-muted">{label}</div>
              {note && <div className={cx("mt-1 text-[11px]", label.startsWith("Waiting") ? "text-danger" : "text-faint")}>{note}</div>}
            </Card>
          </Link>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <div className="space-y-6">
          <WeekChart items={items} />

          {/* Timeline */}
          <Card>
            <div className="flex items-center justify-between border-b border-line px-5 py-4">
              <h2 className="font-semibold">Coming up</h2>
              <Link to="/schedule" className="flex items-center gap-1 text-sm text-muted hover:text-fg">
                Calendar <ArrowRight className="size-3.5" />
              </Link>
            </div>
            {timeline.length === 0 ? (
              <div className="flex flex-col items-center px-6 py-12 text-center">
                <span className="grid size-12 place-items-center rounded-2xl bg-accent-soft text-accent">
                  <CalendarClock className="size-6" />
                </span>
                <p className="mt-3 font-medium">Nothing scheduled yet</p>
                <p className="mt-1 text-sm text-muted">Upload with “Schedule” and it shows up here.</p>
                <Link to="/upload/short" className="mt-4"><Button size="sm" variant="primary">Schedule Shorts</Button></Link>
              </div>
            ) : (
              <div className="px-5 py-4">
                {timeline.map(({ day, list }) => (
                  <div key={day} className="mb-4 last:mb-0">
                    <div className="mb-2 text-xs font-semibold tracking-wide text-faint uppercase">{day}</div>
                    <ul className="space-y-2">
                      {list.map((i) => (
                        <li key={i.id} className="flex items-center gap-3 rounded-xl border border-line bg-bg-soft px-3 py-2.5">
                          <span className="w-16 shrink-0 text-xs font-semibold tabular-nums">{fmtTime(i.publishAt!)}</span>
                          <span className={cx("grid size-7 shrink-0 place-items-center rounded-lg", i.kind === "short" ? "bg-accent-2/15 text-accent-2" : "bg-accent-soft text-accent")}>
                            {i.kind === "short" ? <Smartphone className="size-3.5" /> : <Clapperboard className="size-3.5" />}
                          </span>
                          <span className="min-w-0 flex-1 truncate text-sm">{i.title}</span>
                          <StatusBadge status={i.status} />
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        <div className="space-y-6">
          {/* Channel */}
          <Card className="overflow-hidden">
            <div className="grad-bg h-16" />
            <div className="-mt-8 px-5 pb-5">
              {yt.channel?.thumbnail ? (
                <img src={yt.channel.thumbnail} alt="" className="size-16 rounded-2xl border-4 border-card" referrerPolicy="no-referrer" />
              ) : (
                <span className="grid size-16 place-items-center rounded-2xl border-4 border-card bg-bg-soft text-accent">
                  <Youtube className="size-7" />
                </span>
              )}
              <div className="mt-3 flex items-center gap-2">
                <h2 className="truncate text-lg font-bold">{yt.channel?.title ?? "No channel yet"}</h2>
                {yt.channel && <Badge className={yt.connected ? "bg-ok/10 text-ok" : "bg-warn/10 text-warn"}>{yt.connected ? "Live" : "Reconnect"}</Badge>}
              </div>
              <p className="truncate text-sm text-muted">{yt.channel?.handle || (settings.youtubeClientId ? "Connect to load your channel" : "Add your Client ID in Settings")}</p>
              {yt.channel && (
                <div className="mt-4 grid grid-cols-3 gap-2">
                  {[
                    [Users, yt.channel.subscribers === null ? "—" : fmtCount(yt.channel.subscribers), "Subs"],
                    [Eye, fmtCount(yt.channel.views), "Views"],
                    [PlaySquare, fmtCount(yt.channel.videos), "Videos"],
                  ].map(([Icon, v, l]) => {
                    const I = Icon as typeof Users;
                    return (
                      <div key={l as string} className="rounded-xl bg-bg-soft px-2 py-2.5 text-center">
                        <I className="mx-auto size-4 text-muted" />
                        <div className="mt-1 font-bold tabular-nums">{v as string}</div>
                        <div className="text-[10px] text-faint">{l as string}</div>
                      </div>
                    );
                  })}
                </div>
              )}
              <div className="mt-4 flex gap-2">
                {!settings.youtubeClientId ? (
                  <Link to="/settings#youtube" className="flex-1"><Button variant="primary" className="w-full">Set up</Button></Link>
                ) : yt.connected ? (
                  <>
                    <Button className="flex-1" icon={<RefreshCw className="size-4" />} onClick={() => yt.refreshChannel()}>Refresh</Button>
                    {yt.channel && (
                      <a href={`https://studio.youtube.com/channel/${yt.channel.id}`} target="_blank" rel="noreferrer" className="flex-1">
                        <Button className="w-full" icon={<ArrowUpRight className="size-4" />}>Studio</Button>
                      </a>
                    )}
                  </>
                ) : (
                  <Button variant="primary" className="flex-1" loading={yt.connecting} icon={<Youtube className="size-4" />} onClick={() => yt.connect().catch((e) => toast("error", e.message))}>
                    {yt.channel ? "Reconnect" : "Connect YouTube"}
                  </Button>
                )}
              </div>
            </div>
          </Card>

          {/* Autopilot */}
          <Card className={cx("p-5", autopilot.running && "ring-1 ring-ok/30")}>
            <div className="flex items-center gap-3">
              <span className={cx("relative grid size-11 place-items-center rounded-xl", autopilot.running ? "bg-ok/15 text-ok" : "bg-bg-soft text-muted")}>
                <Bot className="size-5.5" />
                {autopilot.running && <span className="absolute -top-0.5 -right-0.5 size-2.5 rounded-full bg-ok ring-2 ring-card" />}
              </span>
              <div className="min-w-0 flex-1">
                <h2 className="font-semibold">Autopilot</h2>
                <p className={cx("text-sm", autopilot.running ? "text-ok" : "text-muted")}>
                  {autopilot.running ? "Running — your PC can be off" : autopilot.config ? "Created but not active" : "Not set up yet"}
                </p>
              </div>
            </div>
            {autopilot.running && (
              <div className="mt-4 space-y-1.5 rounded-xl bg-bg-soft p-3 text-xs text-muted">
                {lastRun && <div>Last run: <b className="text-fg">{fmtRelative(lastRun)}</b></div>}
                {autopilot.status?.lastResult && <div>Result: <b className="text-fg">{autopilot.status.lastResult}</b></div>}
                {autopilot.status?.channel && <div>Posting to: <b className="text-fg">{autopilot.status.channel}</b></div>}
              </div>
            )}
            {!autopilot.running && (
              <Link to="/settings#autopilot" className="mt-4 block">
                <Button variant="primary" className="w-full" icon={<Bot className="size-4" />}>{autopilot.config ? "Activate Autopilot" : "Set up Autopilot"}</Button>
              </Link>
            )}
          </Card>

          {/* Quota */}
          <Card className="p-5">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">API quota today</h2>
              <span className="text-xs text-faint">resets {quotaResetLabel()}</span>
            </div>
            <div className="mt-3 flex items-baseline gap-1.5">
              <span className="text-2xl font-extrabold tabular-nums">{quotaUsed.toLocaleString()}</span>
              <span className="text-sm text-faint">/ {DAILY_QUOTA.toLocaleString()} units</span>
            </div>
            <Progress value={quotaUsed / DAILY_QUOTA} className="mt-3" />
            <p className="mt-2 text-xs text-muted">Browser uploads only · Autopilot keeps its own count (max 6/day).</p>
          </Card>
        </div>
      </div>

      {/* Latest on channel */}
      {recent && recent.length > 0 && (
        <Card>
          <div className="flex items-center justify-between border-b border-line px-5 py-4">
            <h2 className="font-semibold">Latest on your channel</h2>
            {yt.channel && (
              <a href={`https://studio.youtube.com/channel/${yt.channel.id}/videos`} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-sm text-muted hover:text-fg">
                YouTube Studio <ArrowUpRight className="size-3.5" />
              </a>
            )}
          </div>
          <ul className="grid grid-cols-2 gap-4 p-5 sm:grid-cols-3 lg:grid-cols-6">
            {recent.map((v) => (
              <li key={v.id}>
                <a href={`https://studio.youtube.com/video/${v.id}/edit`} target="_blank" rel="noreferrer" className="group block">
                  <div className="relative overflow-hidden rounded-xl">
                    <img src={v.thumbnail} alt="" className="aspect-video w-full object-cover transition duration-300 group-hover:scale-105" referrerPolicy="no-referrer" />
                    {v.privacy && v.privacy !== "public" && <span className="absolute top-1.5 left-1.5 rounded bg-black/70 px-1.5 py-0.5 text-[10px] text-white capitalize">{v.privacy}</span>}
                  </div>
                  <div className="mt-2 line-clamp-2 text-xs font-medium">{v.title}</div>
                  <div className="text-[10px] text-faint">{fmtRelative(Date.parse(v.publishedAt))}</div>
                </a>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
