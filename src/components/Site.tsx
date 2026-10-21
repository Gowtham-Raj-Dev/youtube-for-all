import { useEffect, useState } from "react";
import { Link } from "react-router";
import { ArrowUpRight, Box, Download, Film, Gamepad2, Images, Link2, Menu, Smartphone, X } from "lucide-react";
import { useAuth } from "../lib/auth";
import { HeartButton } from "./HeartButton";
import { Logo, ThemeToggle } from "./Layout";
import { Button, cx } from "./ui";

export const CODELOVE = "https://codelove.in";

export const PLATFORMS = [
  { name: "Downloader", text: "Save videos & photos from social media", href: "https://downloader.codelove.in", icon: Download },
  { name: "Link in Bio", text: "One link for all your profiles", href: "https://linkinbio.codelove.in", icon: Link2 },
  { name: "3D Models", text: "Free 3D models to download", href: "https://models.codelove.in", icon: Box },
  { name: "Video to GIF", text: "Turn any clip into a GIF", href: "https://videotogif.codelove.in", icon: Film },
  { name: "Video to Images", text: "Extract frames from videos", href: "https://videotoimages.codelove.in", icon: Images },
  { name: "Games", text: "Free games in your browser", href: "https://games.codelove.in", icon: Gamepad2 },
  { name: "Java Games", text: "Old Java phone games, free in your browser", href: "https://javaplay.codelove.in", icon: Smartphone },
];

export function CodeLoveLogo({ className }: { className?: string }) {
  return (
    <a href={CODELOVE} target="_blank" rel="noreferrer" className={cx("inline-block", className)} aria-label="CodeLove — codelove.in">
      <img src="brand/codelove-footer-on-dark.png" alt="codelove.in" className="only-dark h-full w-auto" />
      <img src="brand/codelove-footer-on-light.png" alt="codelove.in" className="only-light h-full w-auto" />
    </a>
  );
}

/** The standard CodeLove credit line, shared by every CodeLove site's footer. */
export function MadeBy({ className }: { className?: string }) {
  return (
    <span className={cx("inline-flex flex-wrap items-center justify-center gap-1.5", className)}>
      Built with <HeartButton /> by{" "}
      <a href="https://gowtham.codelove.in" target="_blank" rel="noopener noreferrer" className="font-medium text-fg transition hover:text-accent">
        Gowtham
      </a>
      <span className="hidden text-muted/50 sm:inline">•</span>
      <a href={CODELOVE} target="_blank" rel="noopener noreferrer" className="font-medium text-fg transition hover:text-accent">
        CodeLove
      </a>
    </span>
  );
}

const NAV = [
  ["Features", "/#features"],
  ["How it works", "/#how"],
  ["Autopilot", "/#autopilot"],
  ["FAQ", "/#faq"],
  ["Channels", "/channels"],
];

/** Fixed, glassy top bar for the public pages. Pages add `pt-16` (its height) themselves. */
export function SiteHeader() {
  const { user } = useAuth();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 8);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);

  return (
    <header className={cx("fixed inset-x-0 top-0 z-50 transition-all duration-300", scrolled || open ? "glass border-b border-line shadow-lg shadow-black/5" : "border-b border-transparent")}>
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link to="/" className="shrink-0">
          <Logo />
        </Link>
        <nav className="hidden items-center gap-1 rounded-full border border-line bg-card/60 p-1 md:flex">
          {NAV.map(([label, href]) => (
            <Link key={href} to={href} className="rounded-full px-4 py-1.5 text-sm text-muted transition hover:bg-card-hover hover:text-fg">
              {label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          {user ? (
            <Link to="/dashboard"><Button variant="primary" size="sm">Dashboard</Button></Link>
          ) : (
            <>
              <Link to="/login" className="hidden sm:block"><Button variant="ghost" size="sm">Sign in</Button></Link>
              <Link to="/login"><Button variant="primary" size="sm">Start free</Button></Link>
            </>
          )}
          <button onClick={() => setOpen(!open)} className="grid size-9 place-items-center rounded-xl text-muted md:hidden" aria-label="Menu">
            {open ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>
      </div>
      {open && (
        <nav className="border-t border-line px-4 py-2 md:hidden">
          {NAV.map(([label, href]) => (
            <Link key={href} to={href} onClick={() => setOpen(false)} className="block rounded-lg px-2 py-3 text-sm text-muted hover:text-fg">
              {label}
            </Link>
          ))}
        </nav>
      )}
    </header>
  );
}

export function SiteFooter() {
  const year = new Date().getFullYear();
  return (
    <footer className="border-t border-line bg-bg-soft/60">
      <div className="mx-auto max-w-6xl px-4 pt-14 pb-8 sm:px-6">
        <div className="grid gap-10 lg:grid-cols-[1.3fr_1fr_1fr]">
          <div>
            <Logo />
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-muted">
              Free YouTube automation for every creator. Bulk upload, schedule and let Autopilot post on time — from your own Google account.
            </p>
          </div>
          <div>
            <h3 className="text-xs font-semibold tracking-wider text-faint uppercase">Product</h3>
            <ul className="mt-4 space-y-2.5 text-sm">
              <li><Link to="/#features" className="text-muted hover:text-fg">Features</Link></li>
              <li><Link to="/#autopilot" className="text-muted hover:text-fg">Autopilot</Link></li>
              <li><Link to="/#faq" className="text-muted hover:text-fg">FAQ</Link></li>
              <li><Link to="/channels" className="text-muted hover:text-fg">Creator channels</Link></li>
              <li><Link to="/login" className="text-muted hover:text-fg">Sign in</Link></li>
            </ul>
          </div>
          <div>
            <h3 className="text-xs font-semibold tracking-wider text-faint uppercase">Legal & help</h3>
            <ul className="mt-4 space-y-2.5 text-sm">
              <li><Link to="/privacy" className="text-muted hover:text-fg">Privacy</Link></li>
              <li><a href={`${CODELOVE}/legal/terms`} target="_blank" rel="noreferrer" className="text-muted hover:text-fg">Terms</a></li>
              <li><a href={`${CODELOVE}/contact`} target="_blank" rel="noreferrer" className="text-muted hover:text-fg">Contact</a></li>
            </ul>
          </div>
        </div>

        <div className="mt-12">
          <h3 className="text-xs font-semibold tracking-wider text-faint uppercase">More free platforms</h3>
          {/* Flex, not grid, so a short last row sits centered. */}
          <ul className="mt-4 flex flex-wrap justify-center gap-3">
            {PLATFORMS.map(({ name, text, href, icon: Icon }) => (
              <li key={name} className="w-full sm:w-[calc((100%-0.75rem)/2)] lg:w-[calc((100%-1.5rem)/3)]">
                <a href={href} target="_blank" rel="noreferrer" className="group flex items-center gap-3 rounded-xl border border-line bg-card p-3 transition hover:-translate-y-0.5 hover:border-accent/40">
                  <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-accent-soft text-accent">
                    <Icon className="size-4.5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold">{name}</span>
                    <span className="block truncate text-xs text-muted">{text}</span>
                  </span>
                  <ArrowUpRight className="size-4 shrink-0 text-faint transition group-hover:text-accent" />
                </a>
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-12 flex flex-col-reverse items-center justify-between gap-4 border-t border-line pt-6 sm:flex-row">
          <span className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-xs text-faint">
            <span>© {year} UTubeFlow</span>
            <span>·</span>
            <MadeBy />
            <span className="hidden sm:inline">· Not affiliated with YouTube or Google</span>
          </span>
          <span className="flex items-center gap-2.5 text-xs text-faint">
            A product of <CodeLoveLogo className="h-7" />
          </span>
        </div>
      </div>
    </footer>
  );
}
