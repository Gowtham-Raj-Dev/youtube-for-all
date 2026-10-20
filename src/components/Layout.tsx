import { useEffect, useRef, useState } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router";
import {
  BookOpen,
  Bot,
  CalendarClock,
  ChevronDown,
  Clapperboard,
  Home,
  LayoutDashboard,
  ListVideo,
  LogOut,
  Menu,
  Moon,
  Plus,
  Settings as SettingsIcon,
  Smartphone,
  Sun,
  X,
  Youtube,
} from "lucide-react";
import { APP_NAME } from "../config";
import { signOut, useUser } from "../lib/auth";
import { useYouTube } from "../lib/youtube-context";
import { useAutopilot } from "../lib/autopilot-context";
import { useUploads } from "../lib/uploads";
import { useItems } from "../lib/items";
import { useSettings } from "../lib/settings";
import { cx, Progress } from "./ui";

type NavItem = { to: string; label: string; short: string; icon: typeof Home; badge?: boolean };

const GROUPS: { title: string; items: NavItem[] }[] = [
  { title: "Overview", items: [{ to: "/dashboard", label: "Dashboard", short: "Home", icon: LayoutDashboard }] },
  {
    title: "Create",
    items: [
      { to: "/upload/short", label: "Upload Shorts", short: "Shorts", icon: Smartphone },
      { to: "/upload/video", label: "Upload Videos", short: "Videos", icon: Clapperboard },
    ],
  },
  {
    title: "Manage",
    items: [
      { to: "/queue", label: "Queue", short: "Queue", icon: ListVideo, badge: true },
      { to: "/schedule", label: "Schedule", short: "Schedule", icon: CalendarClock },
    ],
  },
  {
    title: "Account",
    items: [
      { to: "/settings", label: "Settings", short: "Settings", icon: SettingsIcon },
      { to: "/guide", label: "Setup Guide", short: "Guide", icon: BookOpen },
    ],
  },
];
const ALL = GROUPS.flatMap((g) => g.items);
const MOBILE_TABS = ["/dashboard", "/upload/short", "/queue", "/schedule", "/settings"].map((to) => ALL.find((n) => n.to === to)!);

export function Logo({ className }: { className?: string }) {
  return (
    <div className={cx("flex items-center gap-2.5", className)}>
      <img src="favicon.svg" alt="" className="size-9 rounded-xl shadow-lg shadow-accent/30" />
      <span className="text-lg font-extrabold tracking-tight" aria-label={APP_NAME}>
        UTube<span className="grad-text">Flow</span>
      </span>
    </div>
  );
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<string>(() => document.documentElement.dataset.theme ?? "");
  const isDark = theme ? theme === "dark" : !window.matchMedia("(prefers-color-scheme: light)").matches;
  const flip = () => {
    const next = isDark ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem("theme", next);
    } catch {
      /* ignore */
    }
    setTheme(next);
  };
  return (
    <button onClick={flip} className="grid size-9 place-items-center rounded-xl text-muted transition hover:bg-card-hover hover:text-fg" title="Toggle theme">
      {isDark ? <Sun className="size-4.5" /> : <Moon className="size-4.5" />}
    </button>
  );
}

function StatusChips() {
  const yt = useYouTube();
  const autopilot = useAutopilot();
  const { settings } = useSettings();
  return (
    <div className="flex items-center gap-2">
      {settings.youtubeClientId ? (
        <button
          onClick={() => !yt.connected && yt.connect().catch(() => {})}
          className={cx(
            "hidden items-center gap-2 rounded-full border py-1 pr-3 pl-1 text-xs font-medium transition sm:flex",
            yt.connected ? "border-line bg-card" : "border-accent/40 bg-accent-soft text-accent hover:brightness-110",
          )}
          title={yt.connected ? "YouTube connected" : "Click to connect YouTube"}
        >
          {yt.channel?.thumbnail ? (
            <img src={yt.channel.thumbnail} alt="" className="size-6 rounded-full" referrerPolicy="no-referrer" />
          ) : (
            <span className="grid size-6 place-items-center rounded-full bg-accent-soft text-accent">
              <Youtube className="size-3.5" />
            </span>
          )}
          <span className="max-w-32 truncate">{yt.connected ? yt.channel?.title ?? "Connected" : yt.connecting ? "Connecting…" : "Connect YouTube"}</span>
          <span className={cx("size-2 rounded-full", yt.connected ? "bg-ok" : "bg-accent")} />
        </button>
      ) : (
        <Link to="/settings#youtube" className="hidden items-center gap-1.5 rounded-full border border-warn/40 bg-warn/10 px-3 py-1.5 text-xs font-medium text-warn sm:flex">
          <Youtube className="size-3.5" /> Set up YouTube
        </Link>
      )}
      <Link
        to="/settings#autopilot"
        className={cx(
          "hidden items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium md:flex",
          autopilot.running ? "border-ok/30 bg-ok/10 text-ok" : "border-line bg-card text-muted",
        )}
      >
        <Bot className="size-3.5" />
        Autopilot {autopilot.running ? "on" : autopilot.config ? "paused" : "off"}
      </Link>
    </div>
  );
}

function UserMenu() {
  const user = useUser();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const close = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);
  const initial = (user.displayName ?? user.email ?? "?")[0]?.toUpperCase();
  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen(!open)} className="flex items-center gap-1.5 rounded-full p-0.5 pr-1.5 transition hover:bg-card-hover">
        {user.photoURL ? (
          <img src={user.photoURL} alt="" className="size-8 rounded-full ring-2 ring-line" referrerPolicy="no-referrer" />
        ) : (
          <span className="grad-bg grid size-8 place-items-center rounded-full text-sm font-bold text-on-accent">{initial}</span>
        )}
        <ChevronDown className="size-3.5 text-muted" />
      </button>
      {open && (
        <div className="absolute top-11 right-0 z-50 w-64 overflow-hidden rounded-2xl border border-line bg-card shadow-2xl shadow-black/30">
          <div className="border-b border-line px-4 py-3">
            <div className="truncate text-sm font-semibold">{user.displayName ?? "You"}</div>
            <div className="truncate text-xs text-muted">{user.email}</div>
          </div>
          <div className="p-1.5 text-sm">
            <Link to="/settings" onClick={() => setOpen(false)} className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-muted hover:bg-card-hover hover:text-fg">
              <SettingsIcon className="size-4" /> Settings
            </Link>
            <Link to="/" onClick={() => setOpen(false)} className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-muted hover:bg-card-hover hover:text-fg">
              <Home className="size-4" /> Home page
            </Link>
            <button onClick={() => signOut()} className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-danger hover:bg-danger/10">
              <LogOut className="size-4" /> Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function UploadsDock() {
  const { jobs, cancel } = useUploads();
  const list = Object.values(jobs);
  if (!list.length) return null;
  return (
    <div className="fixed right-4 bottom-20 z-40 w-[min(22rem,calc(100vw-2rem))] rounded-2xl border border-line bg-card p-4 shadow-2xl shadow-black/30 lg:bottom-6">
      <div className="mb-3 flex items-center justify-between text-sm font-semibold">
        <span>Uploading {list.length} video{list.length > 1 ? "s" : ""}</span>
        <span className="text-xs font-normal text-muted">Keep this tab open</span>
      </div>
      <div className="space-y-3">
        {list.map((j) => (
          <div key={j.itemId}>
            <div className="mb-1.5 flex items-center justify-between gap-2 text-xs">
              <span className="truncate">{j.title}</span>
              <span className="flex shrink-0 items-center gap-2 tabular-nums text-muted">
                {j.phase === "preparing" ? "Preparing…" : j.phase === "thumbnail" ? "Thumbnail…" : `${Math.round(j.progress * 100)}%`}
                <button onClick={() => cancel(j.itemId)} className="hover:text-danger" title="Cancel">
                  <X className="size-3.5" />
                </button>
              </span>
            </div>
            <Progress value={j.phase === "uploading" ? j.progress : j.phase === "thumbnail" ? 1 : 0.02} />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Layout() {
  const user = useUser();
  const { items } = useItems(user.uid);
  const autopilot = useAutopilot();
  const queued = items.filter((i) => i.status === "queued" || i.status === "failed").length;
  const [open, setOpen] = useState(false);
  const loc = useLocation();
  useEffect(() => {
    setOpen(false);
    window.scrollTo(0, 0);
  }, [loc.pathname]);
  const current = ALL.find((n) => loc.pathname.startsWith(n.to));

  const nav = (
    <nav className="space-y-5">
      {GROUPS.map((g) => (
        <div key={g.title}>
          <div className="mb-1.5 px-3 text-[10px] font-semibold tracking-wider text-faint uppercase">{g.title}</div>
          <div className="space-y-0.5">
            {g.items.map(({ to, label, icon: Icon, badge }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  cx(
                    "group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition",
                    isActive ? "bg-accent-soft text-fg" : "text-muted hover:bg-card-hover hover:text-fg",
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    {isActive && <span className="grad-bg absolute top-2 bottom-2 left-0 w-1 rounded-r-full" />}
                    <Icon className={cx("size-4.5", isActive && "text-accent")} />
                    <span className="flex-1">{label}</span>
                    {badge && queued > 0 && <span className="grad-bg rounded-full px-2 py-0.5 text-[11px] font-semibold text-on-accent">{queued}</span>}
                  </>
                )}
              </NavLink>
            ))}
          </div>
        </div>
      ))}
    </nav>
  );

  const sidebar = (
    <>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <Link to="/dashboard">
          <Logo className="mb-6 px-2 pt-1" />
        </Link>
        <Link
          to="/upload/short"
          className="grad-bg mb-6 flex h-11 items-center justify-center gap-2 rounded-xl text-sm font-semibold text-on-accent shadow-lg shadow-accent/25 transition hover:brightness-110"
        >
          <Plus className="size-4.5" /> New upload
        </Link>
        {nav}
      </div>
      <div className="space-y-3 pt-4">
        <Link
          to="/settings#autopilot"
          className={cx("flex items-center gap-3 rounded-xl border p-3 transition", autopilot.running ? "border-ok/25 bg-ok/5" : "border-line bg-card hover:border-accent/40")}
        >
          <span className={cx("grid size-8 place-items-center rounded-lg", autopilot.running ? "bg-ok/15 text-ok" : "bg-bg-soft text-muted")}>
            <Bot className="size-4.5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-xs font-semibold">Autopilot</span>
            <span className={cx("block text-[11px]", autopilot.running ? "text-ok" : "text-muted")}>
              {autopilot.running ? "Running · PC can be off" : autopilot.config ? "Not active — fix it" : "Off — set it up"}
            </span>
          </span>
        </Link>
      </div>
    </>
  );

  return (
    <div className="min-h-dvh lg:pl-68">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-68 flex-col border-r border-line bg-bg-soft/70 p-4 backdrop-blur lg:flex">{sidebar}</aside>

      {/* Top bar (fixed on every screen size) */}
      <header className="glass sticky top-0 z-30 border-b border-line">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6 lg:px-10">
          <div className="flex min-w-0 items-center gap-3">
            <Link to="/dashboard" className="lg:hidden">
              <img src="favicon.svg" alt={APP_NAME} className="size-9 rounded-xl" />
            </Link>
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold lg:text-base">{current?.label ?? "UTubeFlow"}</div>
              <div className="hidden text-xs text-faint sm:block">{new Date().toLocaleDateString([], { weekday: "long", day: "numeric", month: "long" })}</div>
            </div>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2">
            <StatusChips />
            <ThemeToggle />
            <UserMenu />
            <button onClick={() => setOpen(true)} className="grid size-9 place-items-center rounded-xl text-muted lg:hidden" aria-label="Menu">
              <Menu className="size-5" />
            </button>
          </div>
        </div>
      </header>

      {/* Mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 right-0 flex w-[min(20rem,85vw)] flex-col bg-bg-soft p-4">
            <button onClick={() => setOpen(false)} className="absolute top-4 right-4 grid size-9 place-items-center rounded-xl text-muted">
              <X className="size-5" />
            </button>
            {sidebar}
          </div>
        </div>
      )}

      <main className="mx-auto w-full max-w-6xl px-4 py-6 pb-28 sm:px-6 lg:px-10 lg:py-8 lg:pb-12">
        <Outlet />
      </main>

      {/* Mobile bottom nav */}
      <nav className="glass fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-line pb-[env(safe-area-inset-bottom)] lg:hidden">
        {MOBILE_TABS.map(({ to, short, icon: Icon, badge }) => (
          <NavLink key={to} to={to} className={({ isActive }) => cx("relative flex flex-col items-center gap-1 py-2.5 text-[10px] font-medium", isActive ? "text-accent" : "text-muted")}>
            <Icon className="size-5" />
            {short}
            {badge && queued > 0 && <span className="grad-bg absolute top-1.5 right-[calc(50%-18px)] rounded-full px-1.5 text-[9px] font-semibold text-on-accent">{queued}</span>}
          </NavLink>
        ))}
      </nav>

      <UploadsDock />
    </div>
  );
}
