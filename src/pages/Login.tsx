import { useState } from "react";
import { Link, Navigate, useLocation } from "react-router";
import { ArrowLeft, Bot, CalendarClock, Layers, ShieldCheck } from "lucide-react";
import { signInWithGoogle, useAuth } from "../lib/auth";
import { Logo, ThemeToggle } from "../components/Layout";
import { CodeLoveLogo } from "../components/Site";
import { Alert, Spinner } from "../components/ui";

const POINTS = [
  { icon: Layers, text: "Bulk upload 100 videos & Shorts at once" },
  { icon: CalendarClock, text: "Daily time slots, filled automatically" },
  { icon: Bot, text: "Autopilot posts on time — even with your PC off" },
  { icon: ShieldCheck, text: "Your own YouTube API and Google Drive" },
];

function GoogleIcon() {
  return (
    <svg viewBox="0 0 48 48" className="size-5">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.1 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.1 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}

export default function Login() {
  const { user, loading } = useAuth();
  const loc = useLocation();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (loading)
    return (
      <div className="grid h-dvh place-items-center">
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
    <div className="flex h-dvh overflow-hidden">
      {/* Brand panel (large screens) */}
      <aside className="relative hidden w-[46%] max-w-2xl flex-col justify-between overflow-hidden bg-[#05100c] p-10 text-white lg:flex xl:p-14">
        <div className="pointer-events-none absolute -top-32 -left-32 size-[30rem] rounded-full bg-[#34d399]/20 blur-3xl" />
        <div className="pointer-events-none absolute -right-40 -bottom-40 size-[30rem] rounded-full bg-[#059669]/25 blur-3xl" />
        <Link to="/" className="relative flex items-center gap-2.5">
          <img src="/favicon.svg" alt="" className="size-9" />
          <span className="text-lg font-extrabold">
            UTube<span className="bg-gradient-to-r from-[#6ee7b7] to-[#34d399] bg-clip-text text-transparent">Flow</span>
          </span>
        </Link>

        <div className="relative">
          <h1 className="text-4xl leading-tight font-extrabold tracking-tight xl:text-5xl">
            Your channel,
            <br />
            <span className="bg-gradient-to-r from-[#6ee7b7] to-[#10b981] bg-clip-text text-transparent">on autopilot.</span>
          </h1>
          <p className="mt-4 max-w-md text-white/65">Add your videos once. UTubeFlow publishes them on time, every day — free.</p>
          <ul className="mt-8 space-y-3.5">
            {POINTS.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-3 text-sm text-white/85">
                <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-white/10">
                  <Icon className="size-4" />
                </span>
                {text}
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-xs text-white/45">Free for every creator · Not affiliated with YouTube or Google</p>
      </aside>

      {/* Sign-in */}
      <main className="relative flex min-w-0 flex-1 flex-col">
        <div className="pointer-events-none absolute -top-24 right-0 size-80 rounded-full bg-accent/10 blur-3xl lg:hidden" />
        <div className="relative flex items-center justify-between px-5 py-4 sm:px-8">
          <Link to="/" className="flex items-center gap-1.5 text-sm text-muted transition hover:text-fg">
            <ArrowLeft className="size-4" /> Home
          </Link>
          <ThemeToggle />
        </div>

        <div className="relative flex flex-1 items-center justify-center px-5 sm:px-8">
          <div className="w-full max-w-sm">
            <Logo className="mb-6 lg:hidden" />
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">Welcome 👋</h2>
            <p className="mt-2 text-sm text-muted">Sign in with Google to open your dashboard. New here? The same button creates your free account.</p>

            <button
              onClick={signIn}
              disabled={busy}
              className="mt-7 flex h-12 w-full items-center justify-center gap-3 rounded-xl border border-line bg-white font-medium text-[#1f1f1f] shadow-sm transition hover:shadow-lg disabled:opacity-60"
            >
              {busy ? <Spinner className="text-[#1f1f1f]" /> : <GoogleIcon />}
              Continue with Google
            </button>

            {error && (
              <div className="mt-4">
                <Alert tone="error">{error}</Alert>
              </div>
            )}

            <div className="mt-7 rounded-xl border border-line bg-bg-soft p-4">
              <p className="text-xs font-semibold text-fg">After signing in</p>
              <ol className="mt-2 space-y-1.5 text-xs text-muted">
                <li>1. Connect your YouTube channel (guided, ~8 min)</li>
                <li>2. Turn on Autopilot</li>
                <li>3. Drop your videos and pick Schedule</li>
              </ol>
            </div>
          </div>
        </div>

        <div className="relative flex items-center justify-between gap-4 px-5 py-4 text-xs text-faint sm:px-8">
          <Link to="/privacy" className="hover:text-fg">Privacy</Link>
          <span className="flex items-center gap-2">
            A product of <CodeLoveLogo className="h-6" />
          </span>
        </div>
      </main>
    </div>
  );
}
