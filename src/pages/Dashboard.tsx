import { useEffect, useState } from "react";
import { Link } from "react-router";
import { ArrowRight, Bot, CalendarClock, Check, Clapperboard, Eye, Gauge, ListVideo, PlaySquare, RefreshCw, Smartphone, Users, Youtube } from "lucide-react";
import { useUser } from "../lib/auth";
import { useSettings } from "../lib/settings";
import { useItems } from "../lib/items";
import { useYouTube } from "../lib/youtube-context";
import { useAutopilot } from "../lib/autopilot-context";
import { statusTime } from "../lib/autopilot";
import { getRecentUploads, getStoredToken, type RecentUpload } from "../lib/youtube";
import { DAILY_QUOTA, quotaResetLabel, UPLOAD_COST, useQuotaUsed } from "../lib/quota";
import { fmtCount, fmtDateTime, fmtRelative } from "../lib/schedule";
import { Badge, Button, Card, CardHeader, cx, Empty, Progress, StatusBadge, useToast } from "../components/ui";

export default function Dashboard() {
  const user = useUser();
  const { settings } = useSettings();
  const yt = useYouTube();
  const autopilot = useAutopilot();
  const { items } = useItems(user.uid);
  const quotaUsed = useQuotaUsed();
  const toast = useToast();
  const [recent, setRecent] = useState<RecentUpload[] | null>(null);

  const upcoming = items
    .filter((i) => i.publishAt && i.publishAt > Date.now() && (i.status === "scheduled" || i.status === "queued"))
    .sort((a, b) => a.publishAt! - b.publishAt!);
  const queued = items.filter((i) => i.status === "queued" || i.status === "failed").length;
  const scheduled = items.filter((i) => i.status === "scheduled" && i.publishAt && i.publishAt > Date.now()).length;
  const weekAgo = Date.now() - 7 * 86400_000;
  const sentThisWeek = items.filter((i) => i.uploadedAt && i.uploadedAt > weekAgo).length;

  useEffect(() => {
    const token = settings.youtubeClientId ? getStoredToken(settings.youtubeClientId) : null;
    if (!token || !yt.channel?.uploadsPlaylist) return;
    getRecentUploads(token, yt.channel.uploadsPlaylist, 6).then(setRecent).catch(() => setRecent(null));
  }, [yt.connected, yt.channel?.uploadsPlaylist, settings.youtubeClientId]);

  const steps = [
    { done: true, label: "Sign in", to: "" },
    { done: !!settings.youtubeClientId, label: "Add your YouTube OAuth Client ID", to: "/settings#youtube" },
    { done: !!yt.channel, label: "Connect your YouTube channel", to: "/settings#youtube" },
    { done: !!autopilot.config, label: "Turn on Autopilot (PC can be off)", to: "/settings#autopilot" },
  ];
  const setupDone = steps.every((s) => s.done);
  const firstName = (user.displayName ?? "").split(" ")[0] || "there";

  return (
    <>
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-muted">{new Date().toLocaleDateString([], { weekday: "long", day: "numeric", month: "long" })}</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">Hi, {firstName} 👋</h1>
        </div>
        <div className="flex gap-2">
          <Link to="/upload/video"><Button icon={<Clapperboard className="size-4" />}>Video</Button></Link>
          <Link to="/upload/short"><Button variant="primary" icon={<Smartphone className="size-4" />}>Short</Button></Link>
        </div>
      </div>

      {!setupDone && (
        <Card className="mb-6 overflow-hidden">
          <div className="grad-bg h-1" />
          <div className="p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-semibold">Finish setting up</h2>
                <p className="text-sm text-muted">A few minutes, once. The guide walks you through every click.</p>
              </div>
              <Link to="/guide"><Button variant="primary" icon={<ArrowRight className="size-4" />}>Open setup guide</Button></Link>
            </div>
            <ol className="mt-5 grid gap-2 sm:grid-cols-2">
              {steps.map((s, i) => (
                <li key={s.label}>
                  <Link to={s.to || "#"} className={cx("flex items-center gap-3 rounded-xl border px-3.5 py-3 text-sm transition", s.done ? "border-line text-muted" : "border-line bg-bg-soft hover:border-accent/40")}>
                    <span className={cx("grid size-6 shrink-0 place-items-center rounded-full text-xs font-semibold", s.done ? "bg-ok/15 text-ok" : "bg-card ring-1 ring-line")}>
                      {s.done ? <Check className="size-3.5" /> : i + 1}
                    </span>
                    <span className={cx(s.done && "line-through")}>{s.label}</span>
                  </Link>
                </li>
              ))}
            </ol>
          </div>
        </Card>
      )}

      {/* Channel */}
      <Card className="mb-6">
        <div className="flex flex-col gap-5 p-5 sm:flex-row sm:items-center">
          <div className="flex min-w-0 flex-1 items-center gap-4">
            {yt.channel?.thumbnail ? (
              <img src={yt.channel.thumbnail} alt="" className="size-14 rounded-full ring-2 ring-line" referrerPolicy="no-referrer" />
            ) : (
              <div className="grid size-14 place-items-center rounded-full bg-accent-soft text-accent">
                <Youtube className="size-7" />
              </div>
            )}
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="truncate text-lg font-semibold">{yt.channel?.title ?? "No channel connected"}</h2>
                {yt.channel && (
                  <Badge className={yt.connected ? "bg-ok/10 text-ok" : "bg-warn/10 text-warn"}>{yt.connected ? "Connected" : "Session expired"}</Badge>
                )}
              </div>
              <p className="truncate text-sm text-muted">
                {yt.channel ? yt.channel.handle || "Your YouTube channel" : settings.youtubeClientId ? "Click connect to link your channel." : "Add your OAuth Client ID first."}
              </p>
            </div>
          </div>
          {yt.channel && (
            <div className="grid grid-cols-3 gap-6 sm:gap-8">
              <Metric icon={<Users className="size-4" />} label="Subscribers" value={yt.channel.subscribers === null ? "Hidden" : fmtCount(yt.channel.subscribers)} />
              <Metric icon={<Eye className="size-4" />} label="Views" value={fmtCount(yt.channel.views)} />
              <Metric icon={<PlaySquare className="size-4" />} label="Videos" value={fmtCount(yt.channel.videos)} />
            </div>
          )}
          <div className="flex gap-2">
            {settings.youtubeClientId ? (
              yt.connected ? (
                <Button variant="ghost" icon={<RefreshCw className="size-4" />} onClick={() => yt.refreshChannel()}>Refresh</Button>
              ) : (
                <Button variant="primary" loading={yt.connecting} icon={<Youtube className="size-4" />} onClick={() => yt.connect().catch((e) => toast("error", e.message))}>
                  {yt.channel ? "Reconnect" : "Connect YouTube"}
                </Button>
              )
            ) : (
              <Link to="/guide"><Button variant="primary">Set up</Button></Link>
            )}
          </div>
        </div>
      </Card>

      {/* Stats */}
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile icon={<CalendarClock className="size-5" />} label="Scheduled" value={scheduled} to="/schedule" />
        <StatTile icon={<ListVideo className="size-5" />} label="In queue" value={queued} to="/queue" />
        <Link to="/settings#autopilot">
          <Card className="h-full p-4 transition hover:border-accent/40">
            <div className="flex items-center gap-2 text-sm text-muted">
              <Bot className="size-5 text-accent" /> Autopilot
            </div>
            <div className={cx("mt-2 text-2xl font-bold", autopilot.running ? "text-ok" : autopilot.config ? "text-warn" : "text-faint")}>
              {autopilot.running ? "Running" : autopilot.config ? (autopilot.status ? "Not active" : "Set up") : "Off"}
            </div>
            <p className="mt-1 text-[11px] text-faint">
              {autopilot.running && statusTime(autopilot.status?.lastRun)
                ? `last run ${fmtRelative(statusTime(autopilot.status?.lastRun)!)} · ${sentThisWeek} sent this week`
                : `${sentThisWeek} sent this week`}
            </p>
          </Card>
        </Link>
        <Card className="p-4">
          <div className="flex items-center gap-2 text-sm text-muted">
            <Gauge className="size-5 text-accent" /> API quota today
          </div>
          <div className="mt-2 text-2xl font-bold tabular-nums">
            {quotaUsed.toLocaleString()}
            <span className="text-sm font-normal text-faint"> / {DAILY_QUOTA.toLocaleString()}</span>
          </div>
          <Progress value={quotaUsed / DAILY_QUOTA} className="mt-2" />
          <p className="mt-1.5 text-[11px] text-faint">
            ≈ {Math.max(0, Math.floor((DAILY_QUOTA - quotaUsed) / UPLOAD_COST))} uploads left · resets {quotaResetLabel()}
          </p>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Coming up" action={<Link to="/schedule" className="text-sm text-muted hover:text-fg">View all</Link>} />
          {upcoming.length === 0 ? (
            <Empty icon={<CalendarClock className="size-6" />} title="Nothing scheduled">
              Upload a video with <b>Schedule</b> and it shows up here.
            </Empty>
          ) : (
            <ul className="divide-y divide-line">
              {upcoming.slice(0, 6).map((i) => (
                <li key={i.id} className="flex items-center gap-3 px-5 py-3">
                  {i.kind === "short" ? <Smartphone className="size-4 shrink-0 text-accent-2" /> : <Clapperboard className="size-4 shrink-0 text-accent" />}
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{i.title}</div>
                    <div className="text-xs text-muted">
                      {fmtDateTime(i.publishAt!)} · {fmtRelative(i.publishAt!)}
                    </div>
                  </div>
                  <StatusBadge status={i.status} />
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <CardHeader
            title="Latest on your channel"
            action={
              yt.channel && (
                <a href={`https://studio.youtube.com/channel/${yt.channel.id}/videos`} target="_blank" rel="noreferrer" className="text-sm text-muted hover:text-fg">
                  YouTube Studio
                </a>
              )
            }
          />
          {!recent || recent.length === 0 ? (
            <Empty icon={<PlaySquare className="size-6" />} title={yt.connected ? "No uploads yet" : "Connect to see your latest uploads"} />
          ) : (
            <ul className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-3">
              {recent.map((v) => (
                <li key={v.id}>
                  <a href={`https://studio.youtube.com/video/${v.id}/edit`} target="_blank" rel="noreferrer" className="group block">
                    <div className="relative overflow-hidden rounded-lg">
                      <img src={v.thumbnail} alt="" className="aspect-video w-full object-cover transition group-hover:scale-105" referrerPolicy="no-referrer" />
                      {v.privacy && v.privacy !== "public" && (
                        <span className="absolute top-1.5 left-1.5 rounded bg-black/70 px-1.5 py-0.5 text-[10px] text-white capitalize">{v.privacy}</span>
                      )}
                    </div>
                    <div className="mt-1.5 line-clamp-2 text-xs font-medium">{v.title}</div>
                  </a>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div>
      <div className="flex items-center gap-1.5 text-xs text-muted">
        {icon}
        {label}
      </div>
      <div className="mt-0.5 text-lg font-semibold tabular-nums">{value}</div>
    </div>
  );
}

function StatTile({ icon, label, value, to }: { icon: React.ReactNode; label: string; value: number; to?: string }) {
  const body = (
    <Card className={cx("h-full p-4 transition", to && "hover:border-accent/40")}>
      <div className="flex items-center gap-2 text-sm text-muted">
        <span className="text-accent">{icon}</span>
        {label}
      </div>
      <div className="mt-2 text-3xl font-bold tabular-nums">{value}</div>
    </Card>
  );
  return to ? <Link to={to}>{body}</Link> : body;
}
