import { useState, type ReactNode } from "react";
import { Link } from "react-router";
import {
  ArrowRight,
  Bot,
  CalendarClock,
  Check,
  ChevronDown,
  Clapperboard,
  CloudUpload,
  FolderLock,
  Gauge,
  HardDrive,
  KeyRound,
  Layers,
  MonitorOff,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Youtube,
} from "lucide-react";
import { useAuth } from "../lib/auth";
import { SiteFooter, SiteHeader } from "../components/Site";
import { Button, cx } from "../components/ui";

function Cta({ size = "lg" }: { size?: "md" | "lg" }) {
  const { user } = useAuth();
  return user ? (
    <Link to="/dashboard"><Button variant="primary" size={size} icon={<ArrowRight className="size-4.5" />}>Open dashboard</Button></Link>
  ) : (
    <Link to="/login"><Button variant="primary" size={size} icon={<ArrowRight className="size-4.5" />}>Get started — it's free</Button></Link>
  );
}

function SectionTitle({ eyebrow, title, children }: { eyebrow: string; title: ReactNode; children?: ReactNode }) {
  return (
    <div className="mx-auto max-w-2xl text-center">
      <p className="text-sm font-semibold tracking-wide text-accent">{eyebrow}</p>
      <h2 className="mt-2 text-3xl font-extrabold tracking-tight sm:text-4xl">{title}</h2>
      {children && <p className="mt-4 text-lg text-muted">{children}</p>}
    </div>
  );
}

/** A small, static picture of the app — shows what Autopilot looks like without a screenshot. */
function HeroMockup() {
  const rows = [
    { t: "Today · 6:30 PM", title: "Office boss vs Monday 😂", kind: "short", state: "Scheduled" },
    { t: "Tomorrow · 8:00 AM", title: "Amma's phone call logic", kind: "short", state: "Scheduled" },
    { t: "Tomorrow · 1:00 PM", title: "Full episode — Day in the life", kind: "video", state: "In queue" },
    { t: "Tomorrow · 6:30 PM", title: "When Wi-Fi goes down", kind: "short", state: "In queue" },
  ];
  return (
    <div className="relative">
      <div className="absolute -inset-6 rounded-[2rem] bg-gradient-to-br from-accent/25 to-accent-2/25 blur-3xl" />
      <div className="relative overflow-hidden rounded-2xl border border-line bg-card shadow-2xl shadow-black/30">
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="size-2.5 rounded-full bg-[#ff5f57]" />
            <span className="size-2.5 rounded-full bg-[#febc2e]" />
            <span className="size-2.5 rounded-full bg-[#28c840]" />
          </div>
          <span className="text-[11px] text-faint">youtube.codelove.in/queue</span>
          <span className="w-10" />
        </div>
        <div className="space-y-4 p-4 sm:p-5">
          <div className="flex items-center gap-3 rounded-xl border border-ok/25 bg-ok/5 p-3">
            <span className="relative grid size-9 place-items-center rounded-lg bg-ok/15 text-ok">
              <Bot className="size-5" />
              <span className="absolute -top-0.5 -right-0.5 size-2.5 animate-pulse rounded-full bg-ok ring-2 ring-card" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold">Autopilot is running</div>
              <div className="text-xs text-muted">Last run 4 min ago · PC can be off</div>
            </div>
            <span className="rounded-full bg-ok/15 px-2 py-0.5 text-[11px] font-medium text-ok">ON</span>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center">
            {[
              ["96", "In queue"],
              ["3/day", "Slots"],
              ["32 days", "Planned"],
            ].map(([v, l]) => (
              <div key={l} className="rounded-xl border border-line bg-bg-soft px-2 py-2.5">
                <div className="text-base font-bold">{v}</div>
                <div className="text-[10px] text-muted">{l}</div>
              </div>
            ))}
          </div>
          <ul className="divide-y divide-line rounded-xl border border-line">
            {rows.map((r) => (
              <li key={r.title} className="flex items-center gap-3 px-3 py-2.5">
                {r.kind === "short" ? <Smartphone className="size-4 shrink-0 text-accent-2" /> : <Clapperboard className="size-4 shrink-0 text-accent" />}
                <div className="min-w-0 flex-1">
                  <div className="truncate text-xs font-medium">{r.title}</div>
                  <div className="text-[10px] text-faint">{r.t}</div>
                </div>
                <span className={cx("rounded-full px-2 py-0.5 text-[10px] font-medium", r.state === "Scheduled" ? "bg-accent-2/10 text-accent-2" : "bg-info/10 text-info")}>{r.state}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

const FEATURES = [
  { icon: Layers, title: "Bulk upload", text: "Select 1 or 100 videos at once. Titles come from file names and you can edit them in a list before adding." },
  { icon: Bot, title: "Autopilot", text: "Google's servers upload each video before its time. Close the tab, switch off your PC — it still goes live." },
  { icon: CalendarClock, title: "Smart time slots", text: "Set daily slots like 8 AM, 1 PM, 6:30 PM. Every new video takes the next free slot automatically." },
  { icon: Smartphone, title: "Made for Shorts", text: "Checks shape and length, adds #Shorts for you, and handles long videos with custom thumbnails too." },
  { icon: KeyRound, title: "Your own API & Drive", text: "Runs on your own Google project and your own Drive. Your quota is yours; your files never touch our servers." },
  { icon: ShieldCheck, title: "One-click health check", text: "“Check connection” tests YouTube, Drive and Autopilot and tells you exactly what to fix." },
];

const STEPS = [
  { icon: Youtube, title: "Connect your channel", text: "Create a free Google Cloud project and paste your Client ID. The guide gives you a direct link for every click. ~8 minutes." },
  { icon: Bot, title: "Turn on Autopilot", text: "Allow Google Drive, click Create and Activate. TubeFlow sets up the folder, queue and script in your account for you." },
  { icon: CloudUpload, title: "Drop your videos", text: "Pick your Shorts or videos, choose Schedule and click Add. That's it — they go live one by one, on time." },
];

const FAQ: [string, ReactNode][] = [
  ["Is it really free?", "Yes. TubeFlow has no plans or payments. It runs on your own free Google account: the YouTube API quota, 15 GB of Google Drive and Apps Script are all free from Google."],
  ["Does my computer need to stay on?", "No. With Autopilot, your videos wait in your Google Drive and a script in your own Google account uploads them on time. Keep the tab open only while files are being copied to Drive."],
  ["How many videos can I schedule?", "As many as fit in your Drive. YouTube's free API quota allows about 6 uploads a day, so 100 videos at 3 per day are published over about a month — automatically."],
  ["Is my channel safe?", "You sign in with Google and approve access yourself. TubeFlow can only see the Drive files it creates. We never store your videos, passwords or long-term keys, and you can remove access at any time from your Google Account."],
  ["Why do I need my own Google Cloud project?", "Each project gets its own free daily YouTube quota. With your own project you never share limits with other users, and only you control the connection to your channel."],
  ["Do I need coding skills?", "No. Every step has a button or a link that opens the right page. If something's off, “Check connection” tells you in plain words."],
];

function FaqItem({ q, a }: { q: string; a: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-2xl border border-line bg-card">
      <button onClick={() => setOpen(!open)} className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left font-medium">
        {q}
        <ChevronDown className={cx("size-5 shrink-0 text-muted transition", open && "rotate-180")} />
      </button>
      {open && <p className="px-5 pb-5 text-sm leading-relaxed text-muted">{a}</p>}
    </div>
  );
}

export default function Home() {
  return (
    <div className="min-h-dvh overflow-x-hidden">
      <SiteHeader />

      {/* Hero */}
      <section className="relative">
        <div className="grid-bg pointer-events-none absolute inset-0" />
        <div className="pointer-events-none absolute -top-40 left-1/2 h-[30rem] w-[60rem] -translate-x-1/2 rounded-full bg-accent/10 blur-3xl" />
        <div className="relative mx-auto grid max-w-6xl items-center gap-14 px-4 pt-14 pb-20 sm:px-6 lg:grid-cols-[1.1fr_1fr] lg:pt-20 lg:pb-28">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-line bg-card px-3 py-1 text-xs font-medium text-muted">
              <Sparkles className="size-3.5 text-accent" /> Free YouTube automation · by CodeLove
            </span>
            <h1 className="mt-6 text-4xl leading-[1.05] font-extrabold tracking-tight sm:text-6xl">
              Schedule 100 videos.
              <br />
              <span className="grad-text">Then switch off your PC.</span>
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted">
              TubeFlow uploads your YouTube videos and Shorts on autopilot. Add them in bulk, pick your daily times, and Google publishes each one right on schedule — free, using your own account.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Cta />
              <a href="#how"><Button size="lg" variant="ghost">See how it works</Button></a>
            </div>
            <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted">
              {["No credit card", "No server, no install", "Works for Shorts & long videos"].map((t) => (
                <li key={t} className="flex items-center gap-1.5">
                  <Check className="size-4 text-ok" /> {t}
                </li>
              ))}
            </ul>
          </div>
          <HeroMockup />
        </div>
      </section>

      {/* Numbers */}
      <section className="border-y border-line bg-bg-soft/50">
        <div className="mx-auto grid max-w-6xl grid-cols-2 gap-6 px-4 py-10 sm:px-6 lg:grid-cols-4">
          {[
            ["₹0", "to use — forever", Gauge],
            ["100+", "videos in one go", Layers],
            ["24/7", "Autopilot, PC off", MonitorOff],
            ["15 GB", "free Google Drive space", HardDrive],
          ].map(([value, label, Icon]) => {
            const I = Icon as typeof Gauge;
            return (
              <div key={label as string} className="flex items-center gap-4">
                <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent">
                  <I className="size-5" />
                </span>
                <div>
                  <div className="text-2xl font-extrabold">{value as string}</div>
                  <div className="text-sm text-muted">{label as string}</div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Features */}
      <section id="features" className="scroll-mt-20 py-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <SectionTitle eyebrow="Features" title="Everything you need to post every day">
            Built for creators who make content in batches and want it to go out on its own.
          </SectionTitle>
          <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map(({ icon: Icon, title, text }) => (
              <div key={title} className="group rounded-2xl border border-line bg-card p-6 transition hover:-translate-y-0.5 hover:border-accent/40 hover:shadow-xl hover:shadow-black/10">
                <span className="grid size-11 place-items-center rounded-xl bg-accent-soft text-accent transition group-hover:scale-110">
                  <Icon className="size-5" />
                </span>
                <h3 className="mt-5 text-lg font-semibold">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">{text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="scroll-mt-20 border-y border-line bg-bg-soft/50 py-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <SectionTitle eyebrow="How it works" title="Set up once. Post forever.">
            About 10 minutes the first time. After that it's just: pick videos, click Add.
          </SectionTitle>
          <ol className="mt-14 grid gap-6 lg:grid-cols-3">
            {STEPS.map(({ icon: Icon, title, text }, i) => (
              <li key={title} className="relative rounded-2xl border border-line bg-card p-6">
                <span className="grad-bg absolute -top-4 left-6 grid size-8 place-items-center rounded-full text-sm font-bold text-white shadow-lg shadow-accent/30">{i + 1}</span>
                <Icon className="mt-2 size-7 text-accent" />
                <h3 className="mt-4 text-lg font-semibold">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">{text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Autopilot explained */}
      <section id="autopilot" className="scroll-mt-20 py-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <SectionTitle eyebrow="Autopilot" title="Where do my videos go?">
            Everything happens inside your own Google account. TubeFlow is just the control panel.
          </SectionTitle>
          <div className="mt-14 grid items-stretch gap-4 lg:grid-cols-[1fr_auto_1fr_auto_1fr_auto_1fr]">
            {[
              { icon: CloudUpload, title: "You add videos", text: "In TubeFlow, pick files and times. Titles, tags and descriptions are saved with them." },
              { icon: FolderLock, title: "Your Google Drive", text: "Files wait in a private folder. TubeFlow can only see the files it created." },
              { icon: Bot, title: "Your Autopilot", text: "A script in your account checks every 30 min and uploads videos due within a day." },
              { icon: Youtube, title: "YouTube", text: "Each video is booked as scheduled. YouTube makes it public at the exact time." },
            ].map(({ icon: Icon, title, text }, i, all) => (
              <div key={title} className="contents">
                <div className="rounded-2xl border border-line bg-card p-5">
                  <span className={cx("grid size-10 place-items-center rounded-xl", i === all.length - 1 ? "bg-[#ff0000]/10 text-[#ff3b3b]" : "bg-accent-soft text-accent")}>
                    <Icon className="size-5" />
                  </span>
                  <h3 className="mt-4 font-semibold">{title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted">{text}</p>
                </div>
                {i < all.length - 1 && (
                  <div className="grid place-items-center text-faint">
                    <ArrowRight className="size-5 rotate-90 lg:rotate-0" />
                  </div>
                )}
              </div>
            ))}
          </div>
          <div className="mx-auto mt-10 grid max-w-4xl gap-4 sm:grid-cols-3">
            {[
              ["Your quota", "Uploads use your own free YouTube API quota (~6 a day)."],
              ["Your storage", "Files live in your Drive and are removed after upload."],
              ["Your control", "Pause or remove Autopilot any time from Settings."],
            ].map(([t, d]) => (
              <div key={t} className="flex gap-3 rounded-xl bg-bg-soft p-4">
                <Check className="mt-0.5 size-4.5 shrink-0 text-ok" />
                <div>
                  <div className="text-sm font-semibold">{t}</div>
                  <div className="text-xs text-muted">{d}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="scroll-mt-20 border-t border-line bg-bg-soft/50 py-24">
        <div className="mx-auto max-w-3xl px-4 sm:px-6">
          <SectionTitle eyebrow="FAQ" title="Questions, answered" />
          <div className="mt-12 space-y-3">
            {FAQ.map(([q, a]) => (
              <FaqItem key={q} q={q} a={a} />
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="px-4 py-24 sm:px-6">
        <div className="relative mx-auto max-w-5xl overflow-hidden rounded-3xl px-6 py-16 text-center sm:px-12">
          <div className="grad-bg absolute inset-0" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.25),transparent_50%)]" />
          <div className="relative">
            <h2 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl">Make it once. Let it post itself.</h2>
            <p className="mx-auto mt-4 max-w-xl text-lg text-white/85">Join creators who batch their content and let TubeFlow handle the daily uploads.</p>
            <div className="mt-8 flex justify-center">
              <Link to="/login">
                <button className="inline-flex h-12 items-center gap-2 rounded-xl bg-white px-6 font-semibold text-[#15151d] shadow-xl transition hover:scale-[1.02]">
                  Start free <ArrowRight className="size-4.5" />
                </button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
