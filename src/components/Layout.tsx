import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router";
import {
  BookOpen,
  CalendarClock,
  Clapperboard,
  LayoutDashboard,
  ListVideo,
  LogOut,
  Menu,
  Moon,
  Settings as SettingsIcon,
  Smartphone,
  Sun,
  X,
  Youtube,
} from "lucide-react";
import { APP_NAME } from "../config";
import { signOut, useUser } from "../lib/auth";
import { useYouTube } from "../lib/youtube-context";
import { useUploads } from "../lib/uploads";
import { useItems } from "../lib/items";
import { useSettings } from "../lib/settings";
import { cx, Progress } from "./ui";

const NAV = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/upload/video", label: "Upload Video", icon: Clapperboard },
  { to: "/upload/short", label: "Upload Short", icon: Smartphone },
  { to: "/queue", label: "Queue", icon: ListVideo, badge: true },
  { to: "/schedule", label: "Schedule", icon: CalendarClock },
  { to: "/settings", label: "Settings", icon: SettingsIcon },
  { to: "/guide", label: "Setup Guide", icon: BookOpen },
];

export function Logo({ className }: { className?: string }) {
  return (
    <div className={cx("flex items-center gap-2.5", className)}>
      <div className="grad-bg grid size-9 place-items-center rounded-xl shadow-lg shadow-accent/30">
        <svg viewBox="0 0 24 24" className="size-4 fill-white">
          <path d="M8 5v14l11-7z" />
        </svg>
      </div>
      <span className="text-lg font-bold tracking-tight">{APP_NAME}</span>
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

function YouTubePill() {
  const yt = useYouTube();
  const { settings } = useSettings();
  if (!settings.youtubeClientId)
    return (
      <NavLink to="/settings" className="flex items-center gap-2 rounded-xl border border-warn/30 bg-warn/5 px-3 py-2 text-xs text-warn">
        <Youtube className="size-4" /> Set up YouTube
      </NavLink>
    );
  return (
    <button
      onClick={() => !yt.connected && yt.connect().catch(() => {})}
      className={cx(
        "flex w-full items-center gap-2.5 rounded-xl border px-3 py-2 text-left text-xs transition",
        yt.connected ? "border-line bg-bg-soft" : "border-accent/30 bg-accent-soft hover:brightness-110",
      )}
    >
      {yt.channel?.thumbnail ? (
        <img src={yt.channel.thumbnail} alt="" className="size-7 rounded-full" referrerPolicy="no-referrer" />
      ) : (
        <Youtube className="size-5 text-accent" />
      )}
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium text-fg">{yt.channel?.title ?? "YouTube"}</span>
        <span className={cx("flex items-center gap-1", yt.connected ? "text-ok" : "text-accent")}>
          <span className={cx("size-1.5 rounded-full", yt.connected ? "bg-ok" : "bg-accent")} />
          {yt.connecting ? "Connecting…" : yt.connected ? "Connected" : "Click to connect"}
        </span>
      </span>
    </button>
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
  const queued = items.filter((i) => i.status === "queued" || i.status === "failed").length;
  const [open, setOpen] = useState(false);
  const loc = useLocation();
  useEffect(() => setOpen(false), [loc.pathname]);

  const nav = (
    <nav className="space-y-1">
      {NAV.map(({ to, label, icon: Icon, badge }) => (
        <NavLink
          key={to}
          to={to}
          className={({ isActive }) =>
            cx(
              "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition",
              isActive ? "bg-accent-soft text-fg" : "text-muted hover:bg-card-hover hover:text-fg",
            )
          }
        >
          {({ isActive }) => (
            <>
              <Icon className={cx("size-4.5", isActive && "text-accent")} />
              <span className="flex-1">{label}</span>
              {badge && queued > 0 && <span className="grad-bg rounded-full px-2 py-0.5 text-[11px] font-semibold text-white">{queued}</span>}
            </>
          )}
        </NavLink>
      ))}
    </nav>
  );

  const footer = (
    <div className="space-y-3">
      <YouTubePill />
      <div className="flex items-center gap-2.5 rounded-xl px-1">
        {user.photoURL ? (
          <img src={user.photoURL} alt="" className="size-8 rounded-full" referrerPolicy="no-referrer" />
        ) : (
          <div className="grad-bg grid size-8 place-items-center rounded-full text-sm font-semibold text-white">{(user.displayName ?? user.email ?? "?")[0]}</div>
        )}
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium">{user.displayName ?? "You"}</div>
          <div className="truncate text-xs text-faint">{user.email}</div>
        </div>
        <ThemeToggle />
        <button onClick={() => signOut()} className="grid size-9 place-items-center rounded-xl text-muted transition hover:bg-card-hover hover:text-danger" title="Sign out">
          <LogOut className="size-4.5" />
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-dvh lg:pl-68">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 hidden w-68 flex-col justify-between border-r border-line bg-bg-soft/60 p-4 backdrop-blur lg:flex">
        <div>
          <Logo className="mb-8 px-2 pt-2" />
          {nav}
        </div>
        {footer}
      </aside>

      {/* Mobile top bar */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-line bg-bg/85 px-4 py-3 backdrop-blur lg:hidden">
        <Logo />
        <button onClick={() => setOpen(true)} className="grid size-10 place-items-center rounded-xl border border-line bg-card" aria-label="Menu">
          <Menu className="size-5" />
        </button>
      </header>

      {/* Mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/60" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 right-0 flex w-[min(20rem,85vw)] flex-col justify-between bg-bg-soft p-4">
            <div>
              <div className="mb-6 flex items-center justify-between">
                <Logo />
                <button onClick={() => setOpen(false)} className="grid size-9 place-items-center rounded-xl text-muted">
                  <X className="size-5" />
                </button>
              </div>
              {nav}
            </div>
            {footer}
          </div>
        </div>
      )}

      <main className="mx-auto w-full max-w-6xl px-4 py-6 pb-28 sm:px-6 lg:px-10 lg:py-10">
        <Outlet />
      </main>

      {/* Mobile bottom nav */}
      <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-line bg-bg/90 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
        {NAV.slice(0, 5).map(({ to, label, icon: Icon, badge }) => (
          <NavLink key={to} to={to} className={({ isActive }) => cx("relative flex flex-col items-center gap-1 py-2.5 text-[10px] font-medium", isActive ? "text-accent" : "text-muted")}>
            <Icon className="size-5" />
            {label.replace("Upload ", "")}
            {badge && queued > 0 && <span className="grad-bg absolute top-1.5 right-[calc(50%-18px)] rounded-full px-1.5 text-[9px] font-semibold text-white">{queued}</span>}
          </NavLink>
        ))}
      </nav>

      <UploadsDock />
    </div>
  );
}
