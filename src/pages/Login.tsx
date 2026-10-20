import { useState } from "react";
import { Link, Navigate, useLocation } from "react-router";
import { CalendarClock, HardDrive, KeyRound, ListVideo, ShieldCheck, Smartphone } from "lucide-react";
import { signInWithGoogle, useAuth } from "../lib/auth";
import { Logo, ThemeToggle } from "../components/Layout";
import { Alert, Spinner } from "../components/ui";

const FEATURES = [
  { icon: Smartphone, title: "Videos & Shorts", text: "Upload long videos and Shorts with title, tags, thumbnail and more." },
  { icon: CalendarClock, title: "Auto schedule", text: "Pick daily time slots. YouTube publishes on time — even with your laptop off." },
  { icon: ListVideo, title: "Queue", text: "Keep a stack of ready videos and push them to the next free slots in one click." },
  { icon: KeyRound, title: "Your own API", text: "Uses your own YouTube API project, so your quota is yours alone." },
  { icon: HardDrive, title: "Your own storage", text: "Queue files stay in your Firebase Storage or your browser. Never on our side." },
  { icon: ShieldCheck, title: "100% free", text: "No subscription, no card. Open the site, sign in, follow the guide." },
];

export default function Login() {
  const { user, loading } = useAuth();
  const loc = useLocation();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (loading)
    return (
      <div className="grid min-h-dvh place-items-center">
        <Spinner className="size-7" />
      </div>
    );
  if (user) return <Navigate to={(loc.state as { from?: string } | null)?.from ?? "/dashboard"} replace />;

  const signIn = async () => {
    setBusy(true);
    setError(null);
    try {
      await signInWithGoogle();
    } catch (e) {
      const code = (e as { code?: string }).code;
      if (code !== "auth/popup-closed-by-user" && code !== "auth/cancelled-popup-request")
        setError(code === "auth/popup-blocked" ? "Your browser blocked the sign-in popup. Allow popups for this site." : (e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="relative min-h-dvh overflow-hidden">
      <div className="pointer-events-none absolute -top-40 -left-40 size-[36rem] rounded-full bg-accent/15 blur-3xl" />
      <div className="pointer-events-none absolute -right-40 -bottom-40 size-[36rem] rounded-full bg-accent-2/15 blur-3xl" />

      <header className="relative mx-auto flex max-w-6xl items-center justify-between px-4 py-5 sm:px-6">
        <Logo />
        <ThemeToggle />
      </header>

      <main className="relative mx-auto grid max-w-6xl items-center gap-12 px-4 pt-6 pb-16 sm:px-6 lg:grid-cols-[1.2fr_1fr] lg:pt-14">
        <section>
          <span className="inline-flex items-center gap-2 rounded-full border border-line bg-card px-3 py-1 text-xs font-medium text-muted">
            <span className="size-1.5 rounded-full bg-ok" /> Free for every creator
          </span>
          <h1 className="mt-5 text-4xl leading-[1.1] font-extrabold tracking-tight sm:text-5xl">
            Automate your <span className="grad-text">YouTube channel</span> — for free.
          </h1>
          <p className="mt-4 max-w-xl text-lg text-muted">
            Upload, schedule and queue videos and Shorts from one clean dashboard. Connect your own channel in about 10 minutes with our step-by-step guide.
          </p>

          <div className="mt-10 grid gap-4 sm:grid-cols-2">
            {FEATURES.map(({ icon: Icon, title, text }) => (
              <div key={title} className="flex gap-3">
                <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent">
                  <Icon className="size-5" />
                </div>
                <div>
                  <div className="font-semibold">{title}</div>
                  <div className="text-sm text-muted">{text}</div>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-3xl border border-line bg-card/80 p-6 shadow-2xl shadow-black/20 backdrop-blur sm:p-8">
          <h2 className="text-2xl font-bold">Get started</h2>
          <p className="mt-1 text-sm text-muted">Sign in with Google. Then connect your YouTube channel from Settings.</p>

          <button
            onClick={signIn}
            disabled={busy}
            className="mt-6 flex h-12 w-full items-center justify-center gap-3 rounded-xl border border-line bg-white font-medium text-[#1f1f1f] transition hover:shadow-lg disabled:opacity-60"
          >
            {busy ? (
              <Spinner className="text-[#1f1f1f]" />
            ) : (
              <svg viewBox="0 0 48 48" className="size-5">
                <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.1 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
                <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.1 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
                <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
                <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
              </svg>
            )}
            Continue with Google
          </button>

          {error && (
            <div className="mt-4">
              <Alert tone="error">{error}</Alert>
            </div>
          )}

          <ol className="mt-8 space-y-3 text-sm">
            {["Sign in with Google", "Create your free YouTube API key (guided, ~10 min)", "Upload or schedule your first video"].map((s, i) => (
              <li key={s} className="flex items-center gap-3">
                <span className="grid size-6 shrink-0 place-items-center rounded-full bg-bg-soft text-xs font-semibold ring-1 ring-line">{i + 1}</span>
                <span className="text-muted">{s}</span>
              </li>
            ))}
          </ol>

          <p className="mt-8 text-xs text-faint">
            We store only your login and settings. Your YouTube access stays in your browser.{" "}
            <Link to="/privacy" className="underline hover:text-fg">
              Privacy
            </Link>
          </p>
        </section>
      </main>
    </div>
  );
}
