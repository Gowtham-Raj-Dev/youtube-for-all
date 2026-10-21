import { useMemo, useState } from "react";
import { Link } from "react-router";
import { ArrowUpRight, Megaphone, Search, Users, Youtube } from "lucide-react";
import { useAuth } from "../lib/auth";
import { channelUrl, creatorsLabel, fmtCount, useCreatorStats, usePublicChannels, type PublicChannel } from "../lib/community";
import { SiteFooter, SiteHeader } from "../components/Site";
import { Button, Spinner } from "../components/ui";


function ChannelThumb({ c }: { c: PublicChannel }) {
  const [broken, setBroken] = useState(false);
  if (c.thumbnail && !broken)
    return <img src={c.thumbnail} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setBroken(true)} className="size-16 rounded-full object-cover ring-2 ring-line" />;
  return <span className="grad-bg grid size-16 place-items-center rounded-full text-xl font-extrabold text-on-accent">{(c.title || "?")[0]?.toUpperCase()}</span>;
}

function ChannelCard({ c }: { c: PublicChannel }) {
  return (
    <a
      href={channelUrl(c)}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex flex-col items-center rounded-3xl border border-line bg-card p-5 text-center transition hover:-translate-y-1 hover:border-accent/40 hover:shadow-xl hover:shadow-accent/10"
    >
      <ChannelThumb c={c} />
      <h3 className="mt-3 line-clamp-1 w-full font-bold">{c.title}</h3>
      {c.handle && <p className="line-clamp-1 w-full text-xs text-muted">{c.handle.startsWith("@") ? c.handle : `@${c.handle}`}</p>}
      <div className="mt-3 flex gap-4 text-xs text-muted">
        <span>
          <b className="text-fg tabular-nums">{c.subscribers == null ? "—" : fmtCount(c.subscribers)}</b> subs
        </span>
        <span>
          <b className="text-fg tabular-nums">{fmtCount(c.videos)}</b> videos
        </span>
      </div>
      <span className="mt-4 inline-flex h-9 items-center gap-1.5 rounded-xl bg-[#ff0000]/10 px-4 text-xs font-semibold text-[#ff4d4d] transition group-hover:bg-[#ff0000] group-hover:text-white">
        <Youtube className="size-4" /> Visit channel <ArrowUpRight className="size-3.5" />
      </span>
    </a>
  );
}

export default function Channels() {
  const { user } = useAuth();
  const { channels, loading } = usePublicChannels();
  const stats = useCreatorStats();
  const [q, setQ] = useState("");
  const shown = useMemo(() => {
    const s = q.trim().toLowerCase();
    return s ? channels.filter((c) => `${c.title} ${c.handle}`.toLowerCase().includes(s)) : channels;
  }, [channels, q]);

  return (
    <div className="min-h-dvh pt-16">
      <SiteHeader />

      <section className="relative overflow-hidden border-b border-line">
        <div className="grid-bg pointer-events-none absolute inset-0" />
        <div className="pointer-events-none absolute -top-32 left-1/2 size-[30rem] -translate-x-1/2 rounded-full bg-accent/15 blur-3xl" />
        <div className="relative mx-auto max-w-6xl px-4 py-16 text-center sm:px-6 sm:py-20">
          <span className="inline-flex items-center gap-2 rounded-full border border-line bg-card px-3 py-1 text-xs font-semibold text-accent">
            <Megaphone className="size-3.5" /> Free promotion
          </span>
          <h1 className="mt-4 text-4xl font-extrabold tracking-tight sm:text-5xl">
            Creators on <span className="grad-text">UTubeFlow</span>
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-lg text-muted">Real YouTube channels that post on autopilot with UTubeFlow. Tap any channel to watch and subscribe.</p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <span className="flex items-center gap-2 rounded-2xl border border-line bg-card px-4 py-2.5 text-sm">
              <Users className="size-4 text-accent" /> <b className="tabular-nums">{creatorsLabel(stats.creators)}</b> creators
            </span>
            <span className="flex items-center gap-2 rounded-2xl border border-line bg-card px-4 py-2.5 text-sm">
              <Youtube className="size-4 text-[#ff4d4d]" /> <b className="tabular-nums">{loading ? "…" : channels.length}</b> channels connected
            </span>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <label className="mx-auto flex max-w-md items-center gap-2 rounded-2xl border border-line bg-card px-4 focus-within:border-accent/50">
          <Search className="size-4 text-faint" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search channels…" className="h-11 flex-1 bg-transparent text-sm outline-none placeholder:text-faint" />
        </label>

        {loading ? (
          <div className="grid place-items-center py-24">
            <Spinner className="size-7" />
          </div>
        ) : shown.length === 0 ? (
          <div className="py-20 text-center">
            <Youtube className="mx-auto size-10 text-faint" />
            <p className="mt-3 font-semibold">{q ? "No channel matches that." : "No channels yet — be the first."}</p>
          </div>
        ) : (
          <ul className="mt-10 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {shown.map((c) => (
              <li key={c.uid}>
                <ChannelCard c={c} />
              </li>
            ))}
          </ul>
        )}

        <div className="mt-16 rounded-3xl border border-line bg-card p-8 text-center">
          <h2 className="text-2xl font-extrabold">Want your channel here?</h2>
          <p className="mx-auto mt-2 max-w-md text-muted">Sign in and connect your YouTube channel. It shows up on this page automatically — free.</p>
          <Link to={user ? "/settings#youtube" : "/login"} className="mt-6 inline-block">
            <Button variant="primary" size="lg">{user ? "Connect my channel" : "Start free"}</Button>
          </Link>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
