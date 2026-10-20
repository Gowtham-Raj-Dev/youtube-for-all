import { useEffect, useState } from "react";
import { Link } from "react-router";
import { ArrowUpRight, Box, Download, Film, Gamepad2, Heart, Images, Link2, Menu, X } from "lucide-react";
import { useAuth } from "../lib/auth";
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
];

export function CodeLoveLogo({ className }: { className?: string }) {
  return (
    <a href={CODELOVE} target="_blank" rel="noreferrer" className={cx("inline-block", className)} aria-label="CodeLove — codelove.in">
      <img src="/brand/codelove-footer-on-dark.png" alt="codelove.in — Web | Apps | Games | More" className="only-dark h-full w-auto" />
      <img src="/brand/codelove-footer-on-light.png" alt="codelove.in — Web | Apps | Games | More" className="only-light h-full w-auto" />
    </a>
  );
}

const NAV = [
  ["Features", "#features"],
  ["How it works", "#how"],
  ["Autopilot", "#autopilot"],
  ["FAQ", "#faq"],
];

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

  const cta = user ? (
    <Link to="/dashboard"><Button variant="primary" size="sm">Open dashboard</Button></Link>
  ) : (
    <>
      <Link to="/login" className="hidden sm:block"><Button variant="ghost" size="sm">Sign in</Button></Link>
      <Link to="/login"><Button variant="primary" size="sm">Get started free</Button></Link>
    </>
  );

  return (
    <header className={cx("sticky top-0 z-40 transition", scrolled ? "border-b border-line bg-bg/80 backdrop-blur-lg" : "border-b border-transparent")}>
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link to="/" className="flex items-center gap-2">
          <Logo />
          <span className="hidden rounded-full border border-line px-2 py-0.5 text-[10px] font-medium text-muted sm:inline">by CodeLove</span>
        </Link>
        <nav className="hidden items-center gap-1 md:flex">
          {NAV.map(([label, href]) => (
            <a key={href} href={href} className="rounded-lg px-3 py-2 text-sm text-muted transition hover:text-fg">{label}</a>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          {cta}
          <button onClick={() => setOpen(!open)} className="grid size-9 place-items-center rounded-xl text-muted md:hidden" aria-label="Menu">
            {open ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>
      </div>
      {open && (
        <nav className="border-t border-line bg-bg px-4 py-2 md:hidden">
          {NAV.map(([label, href]) => (
            <a key={href} href={href} onClick={() => setOpen(false)} className="block rounded-lg px-2 py-3 text-sm text-muted hover:text-fg">{label}</a>
          ))}
        </nav>
      )}
    </header>
  );
}

export function SiteFooter() {
  const year = new Date().getFullYear();
  return (
    <footer className="border-t border-line bg-bg-soft/50">
      <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
        <div className="grid gap-12 lg:grid-cols-[1.4fr_1fr]">
          <div>
            <CodeLoveLogo className="h-11" />
            <p className="mt-5 max-w-md text-sm leading-relaxed text-muted">
              TubeFlow is a free tool from <b className="text-fg">CodeLove</b> — we build free web apps, tools and games for creators and developers.
            </p>
            <a href={CODELOVE} target="_blank" rel="noreferrer" className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-accent hover:underline">
              Visit codelove.in <ArrowUpRight className="size-4" />
            </a>
          </div>

          <div className="grid grid-cols-2 gap-10">
            <div>
              <h3 className="text-xs font-semibold tracking-wider text-faint uppercase">TubeFlow</h3>
              <ul className="mt-4 space-y-2.5 text-sm">
                <li><a href="/#features" className="text-muted hover:text-fg">Features</a></li>
                <li><a href="/#autopilot" className="text-muted hover:text-fg">Autopilot</a></li>
                <li><a href="/#faq" className="text-muted hover:text-fg">FAQ</a></li>
                <li><Link to="/login" className="text-muted hover:text-fg">Sign in</Link></li>
                <li><Link to="/privacy" className="text-muted hover:text-fg">Privacy</Link></li>
              </ul>
            </div>
            <div>
              <h3 className="text-xs font-semibold tracking-wider text-faint uppercase">Company</h3>
              <ul className="mt-4 space-y-2.5 text-sm">
                <li><a href={`${CODELOVE}/about`} target="_blank" rel="noreferrer" className="text-muted hover:text-fg">About</a></li>
                <li><a href={`${CODELOVE}/blog`} target="_blank" rel="noreferrer" className="text-muted hover:text-fg">Blog</a></li>
                <li><a href={`${CODELOVE}/learn`} target="_blank" rel="noreferrer" className="text-muted hover:text-fg">Learn</a></li>
                <li><a href={`${CODELOVE}/contact`} target="_blank" rel="noreferrer" className="text-muted hover:text-fg">Contact</a></li>
                <li><a href={`${CODELOVE}/legal/terms`} target="_blank" rel="noreferrer" className="text-muted hover:text-fg">Terms</a></li>
              </ul>
            </div>
          </div>
        </div>

        <div className="mt-14">
          <h3 className="text-xs font-semibold tracking-wider text-faint uppercase">More free platforms from CodeLove</h3>
          <ul className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {PLATFORMS.map(({ name, text, href, icon: Icon }) => (
              <li key={name}>
                <a href={href} target="_blank" rel="noreferrer" className="group flex items-center gap-3 rounded-xl border border-line bg-card p-3.5 transition hover:-translate-y-0.5 hover:border-accent/40">
                  <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-accent-soft text-accent">
                    <Icon className="size-5" />
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

        <div className="mt-12 flex flex-col items-center justify-between gap-3 border-t border-line pt-6 text-xs text-faint sm:flex-row">
          <span>© {year} CodeLove. All rights reserved.</span>
          <span className="flex items-center gap-1">
            Made with <Heart className="size-3.5 fill-accent text-accent" /> in India · Not affiliated with YouTube or Google
          </span>
        </div>
      </div>
    </footer>
  );
}
