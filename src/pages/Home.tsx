import { useEffect, useState, type ReactNode } from "react";
import { Link, useLocation } from "react-router";
import {
  ArrowRight,
  Bot,
  CalendarClock,
  Check,
  CheckCircle2,
  ChevronDown,
  Clapperboard,
  CloudUpload,
  FileSpreadsheet,
  FolderLock,
  HardDrive,
  KeyRound,
  Layers,
  MonitorOff,
  Play,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Youtube,
  Zap,
} from "lucide-react";
import { useAuth } from "../lib/auth";
import { useReveal } from "../lib/useReveal";
import { SiteFooter, SiteHeader } from "../components/Site";
import { Button, cx } from "../components/ui";

function PrimaryCta({ label = "Start free — no card" }: { label?: string }) {
  const { user } = useAuth();
  return (
    <Link to={user ? "/dashboard" : "/login"}>
      <Button variant="primary" size="lg" className="px-7" icon={<ArrowRight className="size-4.5" />}>
        {user ? "Open dashboard" : label}
      </Button>
    </Link>
  );
}

function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-line bg-card px-3 py-1 text-xs font-semibold text-accent">
      {children}
    </span>
  );
}

function SectionTitle({ eyebrow, title, children }: { eyebrow: string; title: ReactNode; children?: ReactNode }) {
  return (
    <div className="reveal mx-auto max-w-2xl text-center">
      <Eyebrow>{eyebrow}</Eyebrow>
      <h2 className="mt-4 text-3xl font-extrabold tracking-tight sm:text-5xl">{title}</h2>
      {children && <p className="mt-4 text-lg text-muted">{children}</p>}
    </div>
  );
}

// ---------- Hero visual ----------

function HeroVisual() {
  const rows = [
    { t: "Today · 6:30 PM", title: "Office boss vs Monday", kind: "short", state: "Scheduled" },
    { t: "Tomorrow · 8:00 AM", title: "Amma's phone call logic", kind: "short", state: "Scheduled" },
    { t: "Tomorrow · 1:00 PM", title: "Full episode — A day in the life", kind: "video", state: "Queued" },
    { t: "Tomorrow · 6:30 PM", title: "When the Wi-Fi goes down", kind: "short", state: "Queued" },
  ];
  return (
    <div className="relative mx-auto w-full max-w-lg lg:max-w-none">
      <div className="absolute -inset-10 rounded-full bg-gradient-to-tr from-accent/30 via-accent-2/20 to-transparent blur-3xl" />

      {/* Main app card */}
      <div className="relative rounded-2xl border border-line bg-card/95 shadow-2xl shadow-black/30 backdrop-blur">
        <div className="flex items-center gap-2 border-b border-line px-4 py-3">
          <span className="size-2.5 rounded-full bg-[#ff5f57]" />
          <span className="size-2.5 rounded-full bg-[#febc2e]" />
          <span className="size-2.5 rounded-full bg-[#28c840]" />
          <span className="ml-3 flex-1 truncate rounded-md bg-bg-soft px-3 py-1 text-center text-[11px] text-faint">utubeflow.codelove.in/queue</span>
        </div>
        <div className="space-y-3 p-4 sm:p-5">
          <div className="flex items-center gap-3 rounded-xl border border-ok/25 bg-ok/5 p-3">
            <span className="relative grid size-9 place-items-center rounded-lg bg-ok/15 text-ok">
              <Bot className="size-5" />
              <span className="absolute -top-0.5 -right-0.5 size-2.5 animate-ping rounded-full bg-ok" />
              <span className="absolute -top-0.5 -right-0.5 size-2.5 rounded-full bg-ok ring-2 ring-card" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold">Autopilot is running</div>
              <div className="text-xs text-muted">Last run 4 min ago · your PC can be off</div>
            </div>
            <span className="rounded-full bg-ok/15 px-2.5 py-0.5 text-[11px] font-bold text-ok">ON</span>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center">
            {[
              ["96", "Queued"],
              ["3 / day", "Slots"],
              ["32 days", "Planned"],
            ].map(([v, l]) => (
              <div key={l} className="rounded-xl border border-line bg-bg-soft px-2 py-2.5">
                <div className="text-base font-extrabold">{v}</div>
                <div className="text-[10px] text-muted">{l}</div>
              </div>
            ))}
          </div>
          <ul className="divide-y divide-line rounded-xl border border-line">
            {rows.map((r) => (
              <li key={r.title} className="flex items-center gap-3 px-3 py-2.5">
                <span className={cx("grid size-7 shrink-0 place-items-center rounded-lg", r.kind === "short" ? "bg-accent-2/15 text-accent-2" : "bg-accent-soft text-accent")}>
                  {r.kind === "short" ? <Smartphone className="size-3.5" /> : <Clapperboard className="size-3.5" />}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-xs font-medium">{r.title}</div>
                  <div className="text-[10px] text-faint">{r.t}</div>
                </div>
                <span className={cx("rounded-full px-2 py-0.5 text-[10px] font-semibold", r.state === "Scheduled" ? "bg-accent-2/15 text-accent-2" : "bg-info/10 text-info")}>{r.state}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Floating Short preview */}
      <div className="animate-float absolute -top-10 -right-3 hidden w-24 sm:block lg:-right-14 xl:-right-20">
        <div className="relative aspect-[9/16] overflow-hidden rounded-2xl border-4 border-card bg-gradient-to-br from-[#6ee7b7] via-accent to-accent-2 shadow-2xl shadow-black/40">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_25%,rgba(255,255,255,.35),transparent_45%)]" />
          <div className="absolute inset-0 grid place-items-center">
            <span className="grid size-10 place-items-center rounded-full bg-white/25 backdrop-blur">
              <Play className="size-4 fill-white text-white" />
            </span>
          </div>
          <div className="absolute inset-x-2 bottom-2 space-y-1">
            <div className="h-1.5 w-4/5 rounded bg-white/70" />
            <div className="h-1.5 w-1/2 rounded bg-white/50" />
          </div>
          <span className="absolute top-2 left-2 rounded bg-black/40 px-1.5 py-0.5 text-[8px] font-bold text-white">SHORTS</span>
        </div>
      </div>

      {/* Floating toast */}
      <div className="animate-float-slow absolute -bottom-6 -left-3 flex items-center gap-3 rounded-xl border border-line bg-card px-4 py-3 shadow-2xl shadow-black/30 sm:-left-8">
        <CheckCircle2 className="size-5 text-ok" />
        <div>
          <div className="text-xs font-semibold">Published on YouTube</div>
          <div className="text-[10px] text-muted">Today, 8:00 AM · while you slept</div>
        </div>
      </div>
    </div>
  );
}

// ---------- Feature visuals ----------

function BulkVisual() {
  return (
    <div className="mt-6 space-y-2">
      {["episode-01.mp4", "episode-02.mp4", "episode-03.mp4", "episode-04.mp4"].map((f, i) => (
        <div key={f} className="flex items-center gap-3 rounded-lg border border-line bg-bg-soft px-3 py-2 text-xs" style={{ opacity: 1 - i * 0.18 }}>
          <span className="w-4 text-faint">{i + 1}</span>
          <span className="flex-1 truncate font-medium">{f}</span>
          <span className="text-faint">{["Mon 8 AM", "Mon 1 PM", "Mon 6:30 PM", "Tue 8 AM"][i]}</span>
        </div>
      ))}
      <div className="pt-1 text-center text-xs font-medium text-accent">+ 96 more, scheduled automatically</div>
    </div>
  );
}

function SlotsVisual() {
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  return (
    <div className="mt-6 grid grid-cols-7 gap-1.5">
      {days.map((d, i) => (
        <div key={d} className="text-center">
          <div className="mb-1.5 text-[10px] text-faint">{d}</div>
          {[0, 1, 2].map((s) => (
            <div key={s} className={cx("mb-1 h-5 rounded", (i * 3 + s) % 5 === 4 ? "border border-dashed border-line" : s === 1 ? "bg-accent-2/70" : "bg-accent/70")} />
          ))}
        </div>
      ))}
    </div>
  );
}

function AutopilotVisual() {
  return (
    <div className="mt-6 flex items-center justify-between gap-2 text-center">
      {[
        [HardDrive, "Drive"],
        [Bot, "Autopilot"],
        [Youtube, "YouTube"],
      ].map(([Icon, label], i) => {
        const I = Icon as typeof Bot;
        return (
          <div key={label as string} className="contents">
            <div className="flex flex-col items-center gap-1.5">
              <span className={cx("grid size-12 place-items-center rounded-2xl", i === 1 ? "grad-bg text-on-accent shadow-lg shadow-accent/30" : "border border-line bg-bg-soft text-muted")}>
                <I className="size-5" />
              </span>
              <span className="text-[11px] text-muted">{label as string}</span>
            </div>
            {i < 2 && <div className="mb-5 h-px flex-1 bg-gradient-to-r from-accent to-accent-2" />}
          </div>
        );
      })}
    </div>
  );
}

const SMALL_FEATURES = [
  { icon: Smartphone, title: "Shorts-ready", text: "Checks shape and length and adds #Shorts. Long videos get custom thumbnails." },
  { icon: KeyRound, title: "Your own API", text: "Your Google project, your quota. Never shared with other users." },
  { icon: ShieldCheck, title: "Health check", text: "One button tests YouTube, Drive and Autopilot, and says what to fix." },
];

const STEPS = [
  { icon: Youtube, title: "Connect your channel", text: "Create a free Google Cloud project and paste your Client ID. Every step has a direct link." },
  { icon: Bot, title: "Turn on Autopilot", text: "Allow Drive, click Create, then Activate. UTubeFlow sets everything up in your account." },
  { icon: CloudUpload, title: "Drop your videos", text: "Pick your Shorts or videos, choose Schedule, click Add. Done — they go live on time." },
];

const FAQ: [string, string][] = [
  ["Is it really free?", "Yes. No plans, no payments. It runs on your own free Google account: the YouTube API quota, 15 GB of Google Drive and Apps Script are free from Google."],
  ["Does my computer need to stay on?", "No. Videos wait in your Google Drive, and a script in your own Google account uploads them on time. Keep the tab open only while files are being copied to Drive."],
  ["How many videos can I schedule?", "As many as fit in your Drive. YouTube's free quota allows about 6 uploads a day, so 100 videos at 3 a day go out over about a month — automatically."],
  ["Is my channel safe?", "You approve access yourself with Google. UTubeFlow can only see the Drive files it creates, and never stores your videos or passwords. You can remove access any time."],
  ["Why my own Google Cloud project?", "Each project gets its own free daily YouTube quota. With your own, you never share limits with anyone and only you control your channel."],
  ["Do I need coding skills?", "Not at all. Every step has a button or link that opens the right page, and “Check connection” explains anything that needs fixing in plain words."],
];

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={cx("rounded-2xl border bg-card transition", open ? "border-accent/40" : "border-line")}>
      <button onClick={() => setOpen(!open)} className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left font-semibold">
        {q}
        <ChevronDown className={cx("size-5 shrink-0 text-muted transition", open && "rotate-180 text-accent")} />
      </button>
      {open && <p className="px-5 pb-5 text-sm leading-relaxed text-muted">{a}</p>}
    </div>
  );
}

export default function Home() {
  useReveal();
  const { hash } = useLocation();
  useEffect(() => {
    if (hash) setTimeout(() => document.querySelector(hash)?.scrollIntoView({ behavior: "smooth", block: "start" }), 30);
  }, [hash]);

  return (
    <div className="min-h-dvh pt-16">
      <SiteHeader />

      {/* ---------- Hero ---------- */}
      <section className="relative overflow-hidden">
        <div className="grid-bg pointer-events-none absolute inset-0" />
        <div className="animate-blob pointer-events-none absolute -top-32 -left-32 size-[28rem] rounded-full bg-accent/20 blur-3xl" />
        <div className="animate-blob pointer-events-none absolute top-20 -right-40 size-[30rem] rounded-full bg-accent-2/20 blur-3xl [animation-delay:-6s]" />

        <div className="relative mx-auto grid max-w-6xl items-center gap-16 px-4 pt-14 pb-24 sm:px-6 lg:grid-cols-[1.05fr_1fr] lg:pt-20 lg:pb-32">
          <div className="fade-up">
            <Link to="/login" className="group inline-flex items-center gap-2 rounded-full border border-line bg-card/80 py-1 pr-3 pl-1 text-xs font-medium text-muted backdrop-blur transition hover:border-accent/40">
              <span className="grad-bg rounded-full px-2 py-0.5 text-[10px] font-bold text-on-accent">NEW</span>
              Autopilot — post even with your PC off
              <ArrowRight className="size-3.5 transition group-hover:translate-x-0.5" />
            </Link>
            <h1 className="mt-6 text-[2.75rem] leading-[1.02] font-extrabold tracking-tight sm:text-6xl lg:text-7xl">
              Upload once.
              <br />
              <span className="grad-text-anim">Post every day.</span>
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted">
              UTubeFlow schedules your YouTube videos and Shorts in bulk and publishes them on time — automatically, from your own Google account. Free for every creator.
            </p>
            <div className="mt-9 flex flex-wrap items-center gap-3">
              <PrimaryCta />
              <Link to="/#how">
                <Button size="lg" variant="secondary" icon={<Play className="size-4" />}>How it works</Button>
              </Link>
            </div>
            <ul className="mt-9 flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted">
              {["100% free", "No server, no install", "Shorts & long videos"].map((t) => (
                <li key={t} className="flex items-center gap-1.5">
                  <span className="grid size-4.5 place-items-center rounded-full bg-ok/15">
                    <Check className="size-3 text-ok" />
                  </span>
                  {t}
                </li>
              ))}
            </ul>
          </div>
          <div className="fade-up [animation-delay:.15s]">
            <HeroVisual />
          </div>
        </div>
      </section>

      {/* ---------- Works with ---------- */}
      <section className="border-y border-line bg-bg-soft/60">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-x-10 gap-y-4 px-4 py-7 sm:px-6">
          <span className="text-xs font-semibold tracking-wider text-faint uppercase">Works with</span>
          {[
            [Youtube, "YouTube"],
            [Smartphone, "YouTube Shorts"],
            [HardDrive, "Google Drive"],
            [FileSpreadsheet, "Google Sheets"],
            [Zap, "Apps Script"],
          ].map(([Icon, name]) => {
            const I = Icon as typeof Youtube;
            return (
              <span key={name as string} className="flex items-center gap-2 text-sm font-semibold text-muted">
                <I className="size-5" /> {name as string}
              </span>
            );
          })}
        </div>
      </section>

      {/* ---------- Features (bento) ---------- */}
      <section id="features" className="scroll-mt-20 py-24 sm:py-32">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <SectionTitle eyebrow="Features" title={<>Everything to post <span className="grad-text">every single day</span></>}>
            Made for creators who shoot in batches and want their content to go out on its own.
          </SectionTitle>

          <div className="mt-16 grid gap-5 lg:grid-cols-3">
            <div className="reveal rounded-3xl border border-line bg-card p-7 lg:row-span-2">
              <span className="grid size-11 place-items-center rounded-xl bg-accent-soft text-accent">
                <Layers className="size-5" />
              </span>
              <h3 className="mt-5 text-xl font-bold">Bulk upload 100 videos</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">Select a whole folder of Shorts. Titles come from file names; edit them in a list, then add them all with one click.</p>
              <BulkVisual />
            </div>
            <div className="reveal rounded-3xl border border-line bg-card p-7 lg:col-span-2">
              <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
                <div className="sm:w-1/2">
                  <span className="grad-bg grid size-11 place-items-center rounded-xl text-on-accent">
                    <Bot className="size-5" />
                  </span>
                  <h3 className="mt-5 text-xl font-bold">Autopilot — PC off, still posting</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted">Google's servers upload each video before its time. Close the tab, shut down your laptop — it still goes live.</p>
                </div>
                <div className="sm:w-1/2">
                  <AutopilotVisual />
                </div>
              </div>
            </div>
            <div className="reveal rounded-3xl border border-line bg-card p-7 lg:col-span-2">
              <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
                <div className="sm:w-1/2">
                  <span className="grid size-11 place-items-center rounded-xl bg-accent-2/15 text-accent-2">
                    <CalendarClock className="size-5" />
                  </span>
                  <h3 className="mt-5 text-xl font-bold">Smart daily time slots</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted">Pick your best times — 8 AM, 1 PM, 6:30 PM. Every new video takes the next free slot, no calendar juggling.</p>
                </div>
                <div className="sm:w-1/2">
                  <SlotsVisual />
                </div>
              </div>
            </div>
          </div>

          <div className="mt-5 grid gap-5 sm:grid-cols-3">
            {SMALL_FEATURES.map(({ icon: Icon, title, text }) => (
              <div key={title} className="reveal rounded-3xl border border-line bg-card p-6 transition hover:-translate-y-1 hover:border-accent/40">
                <Icon className="size-6 text-accent" />
                <h3 className="mt-4 font-bold">{title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted">{text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- How it works ---------- */}
      <section id="how" className="relative scroll-mt-20 overflow-hidden border-y border-line bg-bg-soft/60 py-24 sm:py-32">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <SectionTitle eyebrow="How it works" title="Set up once. Post forever.">
            About 10 minutes the first time. After that: pick videos, click Add.
          </SectionTitle>
          <ol className="relative mt-16 grid gap-6 lg:grid-cols-3">
            <div className="absolute top-7 right-[16%] left-[16%] hidden h-px bg-gradient-to-r from-accent via-accent-2 to-accent lg:block" />
            {STEPS.map(({ icon: Icon, title, text }, i) => (
              <li key={title} className="reveal relative text-center" style={{ transitionDelay: `${i * 120}ms` }}>
                <span className="grad-bg relative mx-auto grid size-14 place-items-center rounded-2xl text-on-accent shadow-xl shadow-accent/30">
                  <Icon className="size-6" />
                  <span className="absolute -top-2 -right-2 grid size-6 place-items-center rounded-full border-2 border-bg-soft bg-card text-xs font-bold text-fg">{i + 1}</span>
                </span>
                <h3 className="mt-6 text-lg font-bold">{title}</h3>
                <p className="mx-auto mt-2 max-w-xs text-sm leading-relaxed text-muted">{text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ---------- Autopilot explained ---------- */}
      <section id="autopilot" className="scroll-mt-20 py-24 sm:py-32">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <SectionTitle eyebrow="Your data, your account" title="Where do my videos go?">
            Everything happens inside your own Google account. UTubeFlow is just the control panel.
          </SectionTitle>
          <div className="mt-16 grid items-stretch gap-3 lg:grid-cols-[1fr_auto_1fr_auto_1fr_auto_1fr]">
            {[
              { icon: CloudUpload, title: "You add videos", text: "Pick files and times in UTubeFlow. Titles, tags and descriptions travel with them." },
              { icon: FolderLock, title: "Your Google Drive", text: "Files wait in a private folder. UTubeFlow can only see files it created." },
              { icon: Bot, title: "Your Autopilot", text: "A script in your account checks every 30 min and uploads videos due within a day." },
              { icon: Youtube, title: "YouTube", text: "Each video is booked as scheduled. YouTube makes it public at the exact time." },
            ].map(({ icon: Icon, title, text }, i, all) => (
              <div key={title} className="contents">
                <div className="reveal rounded-3xl border border-line bg-card p-6" style={{ transitionDelay: `${i * 100}ms` }}>
                  <span className={cx("grid size-11 place-items-center rounded-xl", i === all.length - 1 ? "bg-[#ff0000]/10 text-[#ff3b3b]" : i === 2 ? "grad-bg text-on-accent" : "bg-accent-soft text-accent")}>
                    <Icon className="size-5" />
                  </span>
                  <h3 className="mt-4 font-bold">{title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted">{text}</p>
                </div>
                {i < all.length - 1 && (
                  <div className="grid place-items-center text-accent">
                    <ArrowRight className="size-5 rotate-90 lg:rotate-0" />
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="reveal mt-12 grid gap-4 rounded-3xl border border-line bg-card p-6 sm:grid-cols-4 sm:p-8">
            {[
              [Sparkles, "₹0", "forever"],
              [Layers, "100+", "videos at once"],
              [MonitorOff, "24/7", "with your PC off"],
              [HardDrive, "15 GB", "free Drive space"],
            ].map(([Icon, v, l]) => {
              const I = Icon as typeof Bot;
              return (
                <div key={l as string} className="flex items-center gap-3 sm:flex-col sm:text-center">
                  <I className="size-6 text-accent" />
                  <div>
                    <div className="text-3xl font-extrabold">{v as string}</div>
                    <div className="text-sm text-muted">{l as string}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ---------- FAQ ---------- */}
      <section id="faq" className="scroll-mt-20 border-t border-line bg-bg-soft/60 py-24 sm:py-32">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <SectionTitle eyebrow="FAQ" title="Questions, answered" />
          <div className="reveal mt-14 grid gap-3 lg:grid-cols-2">
            {FAQ.map(([q, a]) => (
              <FaqItem key={q} q={q} a={a} />
            ))}
          </div>
        </div>
      </section>

      {/* ---------- Final CTA ---------- */}
      <section className="px-4 py-24 sm:px-6">
        <div className="reveal relative mx-auto max-w-5xl overflow-hidden rounded-[2rem] px-6 py-16 text-center sm:px-12 sm:py-20">
          <div className="grad-bg absolute inset-0" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(255,255,255,0.3),transparent_45%),radial-gradient(circle_at_90%_90%,rgba(0,0,0,0.25),transparent_50%)]" />
          <div className="relative">
            <img src="favicon.svg" alt="" className="mx-auto size-16 rounded-2xl shadow-2xl ring-4 ring-white/20" />
            <h2 className="mt-6 text-3xl font-extrabold tracking-tight text-on-accent sm:text-5xl">Make it once. Let it post itself.</h2>
            <p className="mx-auto mt-4 max-w-xl text-lg text-on-accent/80">Batch your content on the weekend, and let UTubeFlow handle the daily uploads.</p>
            <Link to="/login" className="mt-9 inline-flex h-13 items-center gap-2 rounded-xl bg-[#04140e] px-7 font-bold text-white shadow-xl transition hover:scale-[1.03]">
              Start free <ArrowRight className="size-4.5" />
            </Link>
          </div>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
