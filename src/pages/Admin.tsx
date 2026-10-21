import { Fragment, useEffect, useMemo, useState, type ReactNode } from "react";
import { Navigate } from "react-router";
import { collection, collectionGroup, onSnapshot, Timestamp } from "firebase/firestore";
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  Bot,
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  Clapperboard,
  Crown,
  Download,
  ListVideo,
  MessageCircle,
  Search,
  Smartphone,
  Trophy,
  Users,
  Youtube,
} from "lucide-react";
import { db } from "../lib/firebase";
import { useUser } from "../lib/auth";
import { isAdminUser, useOnline, useThreads } from "../lib/community";
import { STATUS_LABEL, type Item } from "../lib/items";
import { fmtCount, fmtRelative } from "../lib/schedule";
import { useChat } from "../components/Chat";
import { Card, cx, Segmented, Spinner, StatusBadge } from "../components/ui";

type UserDoc = {
  uid: string;
  email: string;
  name: string;
  photo: string;
  channel: { id: string; title: string; handle?: string; thumbnail?: string; subscribers?: number | null; views?: number; videos?: number } | null;
  autopilot: boolean;
  hasClientId: boolean;
  lastLogin: number | null;
  joined: number | null;
};

type AdminItem = Item & { uid: string };

type Row = UserDoc & {
  online: boolean;
  items: AdminItem[];
  total: number;
  success: number;
  uploaded: number;
  scheduled: number;
  queued: number;
  failed: number;
  shorts: number;
  videos: number;
  lastActivity: number | null;
};

const ms = (v: unknown) => (v instanceof Timestamp ? v.toMillis() : typeof v === "string" && v ? Date.parse(v) || null : null);
const isSuccess = (i: Item) => i.status === "uploaded" || i.status === "scheduled";
const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0);

function useAdminData() {
  const [users, setUsers] = useState<UserDoc[] | null>(null);
  const [items, setItems] = useState<AdminItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(
    () =>
      onSnapshot(
        collection(db, "users"),
        (snap) =>
          setUsers(
            snap.docs.map((d) => {
              const x = d.data();
              const ap = x.settings?.autopilot;
              return {
                uid: d.id,
                email: x.email ?? "",
                name: x.name ?? "",
                photo: x.photo ?? "",
                channel: x.channel ?? null,
                autopilot: !!(ap && (ap.scriptId || ap.folderId)),
                hasClientId: !!x.settings?.youtubeClientId,
                lastLogin: ms(x.lastLogin) ?? ms(x.updatedAt),
                joined: ms(x.createdAt),
              };
            }),
          ),
        (e) => setError(e.message),
      ),
    [],
  );

  useEffect(
    () =>
      onSnapshot(
        collectionGroup(db, "items"),
        (snap) => setItems(snap.docs.map((d) => ({ ...(d.data() as Item), id: d.id, uid: d.ref.parent.parent?.id ?? "" }))),
        (e) => setError(e.message),
      ),
    [],
  );

  return { users, items, error };
}

// ---------- Pieces ----------

function Avatar({ src, name, className }: { src?: string; name: string; className?: string }) {
  const [broken, setBroken] = useState(false);
  if (src && !broken) return <img src={src} alt="" referrerPolicy="no-referrer" onError={() => setBroken(true)} className={cx("shrink-0 rounded-full object-cover", className)} />;
  return <span className={cx("grad-bg grid shrink-0 place-items-center rounded-full text-xs font-bold", className)}>{(name || "?")[0]?.toUpperCase()}</span>;
}

function Kpi({ icon, label, value, sub, tone = "accent" }: { icon: ReactNode; label: string; value: ReactNode; sub?: ReactNode; tone?: "accent" | "ok" | "warn" | "danger" | "info" | "gold" }) {
  const tones = {
    accent: "bg-accent-soft text-accent",
    ok: "bg-ok/10 text-ok",
    warn: "bg-warn/10 text-warn",
    danger: "bg-danger/10 text-danger",
    info: "bg-info/10 text-info",
    gold: "bg-amber-400/15 text-amber-400",
  };
  return (
    <Card className="group relative overflow-hidden p-5 transition hover:-translate-y-0.5 hover:border-accent/40">
      <div className="pointer-events-none absolute -top-10 -right-10 size-28 rounded-full bg-accent/5 blur-2xl transition group-hover:bg-accent/15" />
      <div className="relative flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-xs font-medium text-muted">{label}</div>
          <div className="mt-2 text-3xl font-extrabold tracking-tight tabular-nums">{value}</div>
          {sub && <div className="mt-1 text-xs text-faint">{sub}</div>}
        </div>
        <span className={cx("grid size-10 shrink-0 place-items-center rounded-xl", tones[tone])}>{icon}</span>
      </div>
    </Card>
  );
}

/** Successful uploads per day over the last 14 days (one series: no legend; hover shows the day). */
function UploadsChart({ items }: { items: AdminItem[] }) {
  const days = useMemo(() => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    return Array.from({ length: 14 }, (_, i) => {
      const from = new Date(start);
      from.setDate(start.getDate() - 13 + i);
      const to = new Date(from);
      to.setDate(from.getDate() + 1);
      const inDay = items.filter((it) => {
        const t = it.uploadedAt ?? (isSuccess(it) || it.status === "failed" ? it.updatedAt : null);
        return t != null && t >= from.getTime() && t < to.getTime();
      });
      return {
        label: from.toLocaleDateString([], { day: "numeric", month: "short" }),
        short: i === 13 ? "Today" : from.toLocaleDateString([], { weekday: "narrow" }),
        ok: inDay.filter(isSuccess).length,
        failed: inDay.filter((x) => x.status === "failed").length,
      };
    });
  }, [items]);
  const max = Math.max(4, ...days.map((d) => d.ok));
  const total = days.reduce((n, d) => n + d.ok, 0);
  const [hover, setHover] = useState<number | null>(null);
  const h = hover != null ? days[hover] : null;

  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold">Successful uploads</h2>
          <p className="text-sm text-muted">Last 14 days · {fmtCount(total)} on YouTube</p>
        </div>
        <div className="h-10 text-right text-xs">
          {h ? (
            <>
              <div className="font-semibold">{h.label}</div>
              <div className="text-muted">
                {h.ok} uploaded{h.failed ? ` · ${h.failed} failed` : ""}
              </div>
            </>
          ) : (
            <span className="text-faint">Hover a bar</span>
          )}
        </div>
      </div>
      <div className="relative mt-5 h-44">
        {[0.25, 0.5, 0.75, 1].map((f) => (
          <div key={f} className="absolute inset-x-0 border-t border-dashed border-line/70" style={{ bottom: `${f * 100}%` }} />
        ))}
        <div className="relative flex h-full items-end gap-[2px]">
          {days.map((d, i) => (
            <div key={i} className="flex h-full flex-1 cursor-default items-end" onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
              <div
                className={cx("w-full rounded-t-[4px] transition-all", hover === i ? "bg-accent" : "bg-accent/70")}
                style={{ height: `${(d.ok / max) * 100}%`, minHeight: d.ok ? 4 : 0 }}
              />
            </div>
          ))}
        </div>
      </div>
      <div className="mt-2 flex gap-[2px] text-center text-[10px] text-faint">
        {days.map((d, i) => (
          <span key={i} className={cx("flex-1", hover === i && "font-semibold text-fg")}>{d.short}</span>
        ))}
      </div>
    </Card>
  );
}

function Leaderboard({ rows }: { rows: Row[] }) {
  const top = [...rows].filter((r) => r.success > 0).sort((a, b) => b.success - a.success).slice(0, 6);
  const max = top[0]?.success ?? 1;
  const medals = ["from-amber-300 to-amber-500", "from-slate-200 to-slate-400", "from-orange-300 to-orange-600"];
  return (
    <Card className="p-5">
      <div className="flex items-center gap-2">
        <Trophy className="size-5 text-amber-400" />
        <h2 className="font-semibold">Top creators</h2>
      </div>
      <p className="text-sm text-muted">Most videos published</p>
      {top.length === 0 ? (
        <p className="mt-8 text-center text-sm text-faint">No uploads yet.</p>
      ) : (
        <ol className="mt-4 space-y-3">
          {top.map((r, i) => (
            <li key={r.uid} className="flex items-center gap-3">
              <span className={cx("grid size-6 shrink-0 place-items-center rounded-full text-[11px] font-extrabold", i < 3 ? `bg-gradient-to-br text-black ${medals[i]}` : "bg-card-hover text-muted")}>{i + 1}</span>
              <Avatar src={r.channel?.thumbnail || r.photo} name={r.name} className="size-8" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2 text-sm">
                  <span className="truncate font-medium">{r.channel?.title || r.name || r.email}</span>
                  <span className="shrink-0 font-bold tabular-nums">{r.success}</span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-card-hover">
                  <div className="grad-bg h-full rounded-full" style={{ width: `${(r.success / max) * 100}%` }} />
                </div>
              </div>
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}

function UserDetail({ row }: { row: Row }) {
  const chat = useChat();
  const me = useUser();
  const items = [...row.items].sort((a, b) => (b.uploadedAt ?? b.updatedAt) - (a.uploadedAt ?? a.updatedAt));
  return (
    <div className="border-t border-line bg-bg-soft/60 p-4 sm:p-5">
      <div className="grid gap-4 lg:grid-cols-[18rem_1fr]">
        <div className="space-y-3">
          <div className="rounded-2xl border border-line bg-card p-4">
            <div className="text-[10px] font-semibold tracking-wider text-faint uppercase">Channel</div>
            {row.channel ? (
              <a href={`https://www.youtube.com/channel/${row.channel.id}`} target="_blank" rel="noreferrer" className="mt-3 flex items-center gap-3 hover:opacity-90">
                <Avatar src={row.channel.thumbnail} name={row.channel.title} className="size-11" />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1 truncate font-semibold">{row.channel.title} <ArrowUpRight className="size-3.5 text-faint" /></span>
                  <span className="block truncate text-xs text-muted">{row.channel.handle}</span>
                </span>
              </a>
            ) : (
              <p className="mt-2 text-sm text-muted">Not connected yet{row.hasClientId ? " (Client ID added)" : ""}.</p>
            )}
            {row.channel && (
              <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                {[
                  ["Subs", row.channel.subscribers],
                  ["Views", row.channel.views],
                  ["Videos", row.channel.videos],
                ].map(([l, v]) => (
                  <div key={l as string} className="rounded-xl bg-bg-soft px-1 py-2">
                    <div className="text-sm font-bold tabular-nums">{v == null ? "—" : fmtCount(v as number)}</div>
                    <div className="text-[10px] text-muted">{l as string}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="rounded-2xl border border-line bg-card p-4 text-sm">
            <dl className="space-y-2">
              {[
                ["Email", row.email || "—"],
                ["Joined", row.joined ? new Date(row.joined).toLocaleDateString() : "—"],
                ["Last seen", row.online ? "Online now" : row.lastLogin ? fmtRelative(row.lastLogin) : "—"],
                ["Autopilot", row.autopilot ? "Set up" : "Not set up"],
                ["Shorts / videos", `${row.shorts} / ${row.videos}`],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-3">
                  <dt className="text-muted">{k}</dt>
                  <dd className="truncate text-right font-medium">{v}</dd>
                </div>
              ))}
            </dl>
            {row.uid === me.uid ? (
              <div className="mt-4 flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-dashed border-line text-sm text-faint">
                <MessageCircle className="size-4" /> This is you
              </div>
            ) : (
              <button
                onClick={() => chat.openThread(row.uid, { name: row.name, email: row.email, photo: row.photo, channel: row.channel?.title ?? null })}
                className="grad-bg mt-4 flex h-10 w-full items-center justify-center gap-2 rounded-xl text-sm font-semibold shadow-lg shadow-accent/25 transition hover:brightness-110"
              >
                <MessageCircle className="size-4" /> Message privately
              </button>
            )}
          </div>
        </div>

        <div className="min-w-0 rounded-2xl border border-line bg-card">
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <span className="text-sm font-semibold">Videos ({row.total})</span>
            <span className="text-xs text-muted">{pct(row.success, row.total)}% success</span>
          </div>
          {items.length === 0 ? (
            <p className="p-6 text-center text-sm text-faint">No videos yet.</p>
          ) : (
            <ul className="max-h-96 divide-y divide-line overflow-y-auto">
              {items.map((it) => (
                <li key={it.id} className="flex items-center gap-3 px-4 py-2.5">
                  <span className={cx("grid size-8 shrink-0 place-items-center rounded-lg", it.kind === "short" ? "bg-accent-2/15 text-accent-2" : "bg-accent-soft text-accent")}>
                    {it.kind === "short" ? <Smartphone className="size-4" /> : <Clapperboard className="size-4" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{it.title || "(untitled)"}</span>
                    <span className="block truncate text-[11px] text-faint">
                      {it.uploadedAt ? `Uploaded ${new Date(it.uploadedAt).toLocaleString()}` : it.publishAt ? `Planned ${new Date(it.publishAt).toLocaleString()}` : `Added ${new Date(it.createdAt).toLocaleString()}`}
                      {it.error && it.status === "failed" ? ` · ${it.error}` : ""}
                    </span>
                  </span>
                  <StatusBadge status={it.status} />
                  {it.youtubeId ? (
                    <a href={`https://youtu.be/${it.youtubeId}`} target="_blank" rel="noreferrer" className="grid size-8 shrink-0 place-items-center rounded-lg text-muted hover:bg-card-hover hover:text-[#ff4d4d]" title="Open on YouTube">
                      <Youtube className="size-4" />
                    </a>
                  ) : (
                    <span className="size-8 shrink-0" />
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

type Filter = "all" | "online" | "channel" | "failed";
type Sort = "success" | "recent" | "joined";

function exportCsv(rows: Row[]) {
  const head = ["Name", "Email", "Channel", "Subscribers", "Autopilot", "Videos", "Successful", "Uploaded", "Scheduled", "Queued", "Failed", "Joined", "Last seen"];
  const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const lines = rows.map((r) =>
    [r.name, r.email, r.channel?.title ?? "", r.channel?.subscribers ?? "", r.autopilot ? "yes" : "no", r.total, r.success, r.uploaded, r.scheduled, r.queued, r.failed, r.joined ? new Date(r.joined).toISOString() : "", r.lastLogin ? new Date(r.lastLogin).toISOString() : ""]
      .map(esc)
      .join(","),
  );
  const url = URL.createObjectURL(new Blob([[head.map(esc).join(","), ...lines].join("\n")], { type: "text/csv" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `utubeflow-users-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ---------- Page ----------

export default function Admin() {
  const user = useUser();
  if (!isAdminUser(user)) return <Navigate to="/dashboard" replace />;
  return <AdminDashboard />;
}

function AdminDashboard() {
  const { users, items, error } = useAdminData();
  const online = useOnline();
  const threads = useThreads(true);
  const chat = useChat();
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [sort, setSort] = useState<Sort>("success");
  const [openRow, setOpenRow] = useState<string | null>(null);

  const rows: Row[] = useMemo(() => {
    if (!users || !items) return [];
    const onlineIds = new Set(online.map((p) => p.uid));
    const byUser = new Map<string, AdminItem[]>();
    for (const it of items) byUser.set(it.uid, [...(byUser.get(it.uid) ?? []), it]);
    return users.map((u) => {
      const list = byUser.get(u.uid) ?? [];
      const count = (s: Item["status"]) => list.filter((i) => i.status === s).length;
      const last = Math.max(0, ...list.map((i) => i.uploadedAt ?? i.updatedAt ?? 0));
      return {
        ...u,
        online: onlineIds.has(u.uid),
        items: list,
        total: list.length,
        success: list.filter(isSuccess).length,
        uploaded: count("uploaded"),
        scheduled: count("scheduled"),
        queued: count("queued") + count("uploading"),
        failed: count("failed"),
        shorts: list.filter((i) => i.kind === "short").length,
        videos: list.filter((i) => i.kind === "video").length,
        lastActivity: last || null,
      };
    });
  }, [users, items, online]);

  const shown = useMemo(() => {
    const s = q.trim().toLowerCase();
    return rows
      .filter((r) => (filter === "online" ? r.online : filter === "channel" ? !!r.channel : filter === "failed" ? r.failed > 0 : true))
      .filter((r) => !s || `${r.name} ${r.email} ${r.channel?.title ?? ""} ${r.channel?.handle ?? ""}`.toLowerCase().includes(s))
      .sort((a, b) =>
        sort === "success"
          ? b.success - a.success || b.total - a.total
          : sort === "recent"
            ? Number(b.online) - Number(a.online) || (b.lastLogin ?? 0) - (a.lastLogin ?? 0)
            : (b.joined ?? 0) - (a.joined ?? 0),
      );
  }, [rows, q, filter, sort]);

  if (error)
    return (
      <Card className="p-6">
        <div className="flex items-start gap-3 text-danger">
          <AlertTriangle className="mt-0.5 size-5 shrink-0" />
          <div>
            <p className="font-semibold">Could not load admin data</p>
            <p className="mt-1 text-sm text-muted">{error}</p>
            <p className="mt-2 text-sm text-muted">Deploy the latest Firestore rules: <code>npm run deploy:rules</code></p>
          </div>
        </div>
      </Card>
    );

  if (!users || !items)
    return (
      <div className="grid min-h-[50vh] place-items-center">
        <Spinner className="size-7" />
      </div>
    );

  const all = items;
  const success = all.filter(isSuccess).length;
  const failed = all.filter((i) => i.status === "failed").length;
  const queued = all.filter((i) => i.status === "queued" || i.status === "uploading").length;
  const channels = rows.filter((r) => r.channel).length;
  const autopilots = rows.filter((r) => r.autopilot).length;
  const active7 = rows.filter((r) => r.online || (r.lastLogin && Date.now() - r.lastLogin < 7 * 86400_000)).length;
  const unread = threads.reduce((n, t) => n + t.unreadAdmin, 0);

  return (
    <div className="space-y-6">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-3xl border border-amber-400/20 p-6 sm:p-8">
        <div className="absolute inset-0 bg-gradient-to-br from-amber-400/15 via-fuchsia-500/10 to-accent/15" />
        <div className="grid-bg pointer-events-none absolute inset-0 opacity-60" />
        <div className="animate-blob pointer-events-none absolute -top-24 -right-16 size-72 rounded-full bg-fuchsia-500/20 blur-3xl" />
        <div className="relative flex flex-wrap items-end justify-between gap-6">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-400/40 bg-amber-400/10 px-3 py-1 text-xs font-bold text-amber-400">
              <Crown className="size-3.5" /> Owner only
            </span>
            <h1 className="mt-4 text-3xl font-extrabold tracking-tight sm:text-4xl">
              Admin <span className="bg-gradient-to-r from-amber-300 via-fuchsia-400 to-accent bg-clip-text text-transparent">control room</span>
            </h1>
            <p className="mt-2 max-w-xl text-sm text-muted">Every creator, channel and upload on UTubeFlow — live.</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <div className="flex items-center gap-3 rounded-2xl border border-ok/30 bg-ok/10 px-4 py-3">
              <span className="relative flex size-3">
                <span className="absolute inset-0 animate-ping rounded-full bg-ok opacity-60" />
                <span className="relative size-3 rounded-full bg-ok" />
              </span>
              <div>
                <div className="text-2xl leading-none font-extrabold tabular-nums">{online.length}</div>
                <div className="text-[11px] text-ok">online now</div>
              </div>
            </div>
            <button
              onClick={() => {
                chat.setTab("direct");
                chat.openThread(null);
                if (!chat.docked) chat.setOpen(true);
              }}
              className="flex items-center gap-3 rounded-2xl border border-line bg-card/80 px-4 py-3 text-left transition hover:border-accent/40"
            >
              <MessageCircle className="size-6 text-accent" />
              <div>
                <div className="text-2xl leading-none font-extrabold tabular-nums">{unread}</div>
                <div className="text-[11px] text-muted">unread messages</div>
              </div>
            </button>
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi icon={<Users className="size-5" />} label="Total users" value={fmtCount(rows.length)} sub={`${active7} active in the last 7 days`} />
        <Kpi icon={<Youtube className="size-5" />} label="Channels connected" value={fmtCount(channels)} sub={`${pct(channels, rows.length)}% of users`} tone="danger" />
        <Kpi icon={<CheckCircle2 className="size-5" />} label="Successful uploads" value={fmtCount(success)} sub={`${pct(success, success + failed)}% success rate`} tone="ok" />
        <Kpi icon={<Bot className="size-5" />} label="Autopilot set up" value={fmtCount(autopilots)} sub={`${pct(autopilots, channels)}% of channels`} tone="gold" />
        <Kpi icon={<ListVideo className="size-5" />} label="Total videos" value={fmtCount(all.length)} sub={`${all.filter((i) => i.kind === "short").length} Shorts · ${all.filter((i) => i.kind === "video").length} videos`} tone="info" />
        <Kpi icon={<CalendarClock className="size-5" />} label="Scheduled on YouTube" value={fmtCount(all.filter((i) => i.status === "scheduled").length)} sub="Waiting to go public" />
        <Kpi icon={<Activity className="size-5" />} label="In queue" value={fmtCount(queued)} sub="Waiting for Autopilot / upload" tone="warn" />
        <Kpi icon={<AlertTriangle className="size-5" />} label="Failed" value={fmtCount(failed)} sub={`${rows.filter((r) => r.failed > 0).length} users affected`} tone="danger" />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
        <UploadsChart items={all} />
        <Leaderboard rows={rows} />
      </div>

      {/* Users */}
      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line p-4 sm:p-5">
          <div>
            <h2 className="font-semibold">Creators</h2>
            <p className="text-sm text-muted">{shown.length} of {rows.length} · click a row for every video</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-2 rounded-xl border border-line bg-bg-soft px-3 focus-within:border-accent/50">
              <Search className="size-4 text-faint" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name, email, channel…" className="h-9 w-44 bg-transparent text-sm outline-none placeholder:text-faint" />
            </label>
            <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} className="h-9 rounded-xl border border-line bg-bg-soft px-3 text-sm outline-none">
              <option value="success">Most uploads</option>
              <option value="recent">Recently active</option>
              <option value="joined">Newest</option>
            </select>
            <button onClick={() => exportCsv(shown)} className="flex h-9 items-center gap-1.5 rounded-xl border border-line bg-bg-soft px-3 text-sm text-muted transition hover:text-fg" title="Download as CSV">
              <Download className="size-4" /> CSV
            </button>
          </div>
        </div>
        <div className="border-b border-line px-4 py-3 sm:px-5">
          <Segmented<Filter>
            value={filter}
            onChange={setFilter}
            options={[
              { value: "all", label: `All (${rows.length})` },
              { value: "online", label: `Online (${rows.filter((r) => r.online).length})` },
              { value: "channel", label: `Connected (${channels})` },
              { value: "failed", label: `Has failures (${rows.filter((r) => r.failed > 0).length})` },
            ]}
          />
        </div>

        <div className="hidden grid-cols-[minmax(0,2.2fr)_minmax(0,1.6fr)_repeat(4,minmax(0,0.7fr))_minmax(0,1.1fr)_2rem] gap-3 border-b border-line bg-bg-soft/60 px-5 py-2.5 text-[10px] font-semibold tracking-wider text-faint uppercase lg:grid">
          <span>Creator</span>
          <span>Channel</span>
          <span className="text-right">Videos</span>
          <span className="text-right">Success</span>
          <span className="text-right">Queue</span>
          <span className="text-right">Failed</span>
          <span>Last seen</span>
          <span />
        </div>

        {shown.length === 0 ? (
          <p className="p-10 text-center text-sm text-faint">No users match.</p>
        ) : (
          <ul className="divide-y divide-line">
            {shown.map((r) => {
              const open = openRow === r.uid;
              return (
                <Fragment key={r.uid}>
                  <li>
                    <button
                      onClick={() => setOpenRow(open ? null : r.uid)}
                      className={cx(
                        "grid w-full grid-cols-[1fr_auto] items-center gap-3 px-4 py-3.5 text-left transition hover:bg-card-hover sm:px-5 lg:grid-cols-[minmax(0,2.2fr)_minmax(0,1.6fr)_repeat(4,minmax(0,0.7fr))_minmax(0,1.1fr)_2rem]",
                        open && "bg-card-hover",
                      )}
                    >
                      <span className="flex min-w-0 items-center gap-3">
                        <span className="relative">
                          <Avatar src={r.photo} name={r.name || r.email} className="size-10" />
                          {r.online && <span className="absolute -right-0.5 -bottom-0.5 size-3 rounded-full bg-ok ring-2 ring-card" />}
                        </span>
                        <span className="min-w-0">
                          <span className="flex items-center gap-1.5 truncate text-sm font-semibold">
                            {r.name || r.email.split("@")[0] || "Unknown"}
                            {r.autopilot && <Bot className="size-3.5 shrink-0 text-accent" aria-label="Autopilot set up" />}
                          </span>
                          <span className="block truncate text-xs text-muted">{r.email}</span>
                          <span className="mt-1 flex gap-2 text-[11px] lg:hidden">
                            <span className="text-ok">{r.success} ok</span>
                            {r.queued > 0 && <span className="text-warn">{r.queued} queued</span>}
                            {r.failed > 0 && <span className="text-danger">{r.failed} failed</span>}
                            {r.channel && <span className="truncate text-faint">· {r.channel.title}</span>}
                          </span>
                        </span>
                      </span>
                      <span className="hidden min-w-0 items-center gap-2 lg:flex">
                        {r.channel ? (
                          <>
                            <Avatar src={r.channel.thumbnail} name={r.channel.title} className="size-7" />
                            <span className="min-w-0">
                              <span className="block truncate text-sm">{r.channel.title}</span>
                              {r.channel.subscribers != null && <span className="block text-[11px] text-faint">{fmtCount(r.channel.subscribers)} subscribers</span>}
                            </span>
                          </>
                        ) : (
                          <span className="text-xs text-faint">Not connected</span>
                        )}
                      </span>
                      <span className="hidden text-right text-sm font-semibold tabular-nums lg:block">{r.total}</span>
                      <span className="hidden text-right lg:block">
                        <span className="text-sm font-semibold text-ok tabular-nums">{r.success}</span>
                        {r.total > 0 && <span className="block text-[10px] text-faint">{pct(r.success, r.total)}%</span>}
                      </span>
                      <span className={cx("hidden text-right text-sm tabular-nums lg:block", r.queued ? "text-warn" : "text-faint")}>{r.queued}</span>
                      <span className={cx("hidden text-right text-sm tabular-nums lg:block", r.failed ? "font-semibold text-danger" : "text-faint")}>{r.failed}</span>
                      <span className="hidden text-xs lg:block">
                        {r.online ? <span className="font-semibold text-ok">Online now</span> : <span className="text-muted">{r.lastLogin ? fmtRelative(r.lastLogin) : "—"}</span>}
                      </span>
                      <ChevronDown className={cx("size-4 text-faint transition", open && "rotate-180 text-accent")} />
                    </button>
                    {open && <UserDetail row={r} />}
                  </li>
                </Fragment>
              );
            })}
          </ul>
        )}
      </Card>

      <p className="text-center text-xs text-faint">
        Counts come from each user's video list ({Object.values(STATUS_LABEL).join(" · ")}). Videos a user deleted from their list are not counted.
      </p>
    </div>
  );
}
