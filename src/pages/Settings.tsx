import { useEffect, useState, type ReactNode } from "react";
import { Link, useLocation } from "react-router";
import { collection, deleteDoc, doc, getDocs } from "firebase/firestore";
import { AlertTriangle, BookOpen, Bot, CalendarClock, CheckCircle2, CircleDashed, Database, ExternalLink, Pause, Play, Plus, RefreshCw, ShieldCheck, SlidersHorizontal, Trash2, Wrench, X, XCircle, Youtube } from "lucide-react";
import { db } from "../lib/firebase";
import { signOut, useUser } from "../lib/auth";
import { useSettings, YT_CATEGORIES, type Privacy, type Settings as S } from "../lib/settings";
import { useYouTube } from "../lib/youtube-context";
import { useAutopilot } from "../lib/autopilot-context";
import { getMyChannel, isValidClientId } from "../lib/youtube";
import { checkAutopilot, deployScript, ENABLE_APIS_URL, isReady, openWebApp, SCRIPT_SETTINGS_URL, SCRIPT_VERSION, setupAutopilot, type Check } from "../lib/autopilot";
import { siteOrigin } from "../lib/snippets";
import { fmtSlot, sortSlots, timeZoneName } from "../lib/schedule";
import { Alert, Badge, Button, Card, CardHeader, cx, Field, Input, PageHeader, Select, Textarea, Toggle, useToast } from "../components/ui";
import { CopyBox } from "../components/CopyBox";
import { CODELOVE, PLATFORMS } from "../components/Site";
import { ArrowUpRight, Heart } from "lucide-react";

export default function Settings() {
  const loc = useLocation();
  useEffect(() => {
    if (loc.hash) setTimeout(() => document.querySelector(loc.hash)?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
  }, [loc.hash]);

  return (
    <>
      <PageHeader
        title="Settings"
        subtitle="Connect your channel, turn on Autopilot and set your defaults."
        action={<Link to="/guide"><Button icon={<BookOpen className="size-4" />}>Setup guide</Button></Link>}
      />
      <div className="space-y-6">
        <ConnectionCheck />
        <YouTubeSection />
        <AutopilotSection />
        <ScheduleSection />
        <DefaultsSection />
        <DataSection />
        <CreditsSection />
      </div>
    </>
  );
}

// ---------- Check everything ----------

function StateIcon({ state }: { state: Check["state"] | "todo" }) {
  if (state === "ok") return <CheckCircle2 className="size-5 shrink-0 text-ok" />;
  if (state === "warn") return <AlertTriangle className="size-5 shrink-0 text-warn" />;
  if (state === "error") return <XCircle className="size-5 shrink-0 text-danger" />;
  return <CircleDashed className="size-5 shrink-0 text-faint" />;
}

function ConnectionCheck() {
  const { settings } = useSettings();
  const yt = useYouTube();
  const autopilot = useAutopilot();
  const [checks, setChecks] = useState<Check[] | null>(null);
  const [busy, setBusy] = useState(false);

  const run = async () => {
    setBusy(true);
    const out: Check[] = [];
    const add = (c: Check) => {
      out.push(c);
      setChecks([...out]);
    };
    setChecks([]);
    try {
      if (!settings.youtubeClientId) {
        add({ key: "client", label: "OAuth Client ID", state: "error", detail: "Not added yet — see the YouTube section below." });
        return;
      }
      add({ key: "client", label: "OAuth Client ID", state: "ok", detail: "Saved." });
      const cfg = isReady(settings.autopilot) ? settings.autopilot : null;
      let token: string;
      try {
        token = await yt.ensureToken(!!cfg);
        add({ key: "login", label: "Google permission", state: "ok", detail: cfg ? "YouTube + Drive allowed." : "YouTube allowed." });
      } catch (e) {
        add({ key: "login", label: "Google permission", state: "error", detail: (e as Error).message });
        return;
      }
      try {
        const ch = await getMyChannel(token);
        add({ key: "channel", label: "YouTube channel", state: "ok", detail: `${ch.title} — uploads work.` });
      } catch (e) {
        add({ key: "channel", label: "YouTube channel", state: "error", detail: (e as Error).message });
      }
      if (!cfg) {
        add({ key: "autopilot", label: "Autopilot", state: "warn", detail: "Not set up. Without it, the browser tab must stay open while videos upload." });
        return;
      }
      const r = await checkAutopilot(token, cfg);
      autopilot.setStatus(r.status);
      r.checks.forEach(add);
    } finally {
      setBusy(false);
    }
  };

  const allOk = checks && checks.length > 0 && !busy && checks.every((c) => c.state === "ok");

  return (
    <Card className={cx(allOk && "ring-1 ring-ok/40")}>
      <CardHeader
        icon={<ShieldCheck className="size-5" />}
        title="Check connection"
        subtitle="Tests every part — YouTube, Drive, the queue sheet and Autopilot — and tells you what to fix."
        action={
          <Button variant="primary" loading={busy} icon={<RefreshCw className="size-4" />} onClick={run}>
            {checks ? "Check again" : "Check now"}
          </Button>
        }
      />
      {checks && (
        <ul className="divide-y divide-line">
          {checks.map((c) => (
            <li key={c.key} className="flex items-start gap-3 px-5 py-3">
              <StateIcon state={c.state} />
              <div className="min-w-0">
                <div className="text-sm font-medium">{c.label}</div>
                <div className="text-xs break-words text-muted">{c.detail}</div>
              </div>
            </li>
          ))}
          {allOk && <li className="px-5 py-3 text-sm font-medium text-ok">Everything works. 🎉</li>}
        </ul>
      )}
    </Card>
  );
}

// ---------- YouTube ----------

function YouTubeSection() {
  const { settings, save } = useSettings();
  const yt = useYouTube();
  const toast = useToast();
  const [clientId, setClientId] = useState(settings.youtubeClientId);
  const [busy, setBusy] = useState(false);
  useEffect(() => setClientId(settings.youtubeClientId), [settings.youtubeClientId]);

  const dirty = clientId.trim() !== settings.youtubeClientId;
  const valid = isValidClientId(clientId);

  const saveId = async () => {
    setBusy(true);
    try {
      if (settings.youtubeClientId) yt.disconnect();
      await save({ youtubeClientId: clientId.trim() });
      toast("ok", "Client ID saved. Now click “Connect YouTube”.");
    } catch (e) {
      toast("error", (e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <span id="youtube" className="block scroll-mt-24" />
      <CardHeader icon={<Youtube className="size-5" />} title="YouTube" subtitle="Your own Google Cloud OAuth Client ID — your quota, your control." />
      <div className="space-y-5 p-5">
        <div className="flex flex-wrap gap-2">
          <ExtButton href="https://console.cloud.google.com/projectcreate">1 · Create project</ExtButton>
          <ExtButton href={ENABLE_APIS_URL}>2 · Enable APIs</ExtButton>
          <ExtButton href="https://console.cloud.google.com/auth/overview">3 · Consent screen</ExtButton>
          <ExtButton href="https://console.cloud.google.com/auth/audience">4 · Add test user</ExtButton>
          <ExtButton href="https://console.cloud.google.com/auth/clients/create">5 · Create Client ID</ExtButton>
          <Link to="/guide#youtube"><Button size="sm" variant="ghost" icon={<BookOpen className="size-3.5" />}>Step-by-step guide</Button></Link>
        </div>

        <CopyBox label="Authorized JavaScript origin (paste this when creating the Client ID)" value={siteOrigin()} />

        <Field
          label="OAuth Client ID"
          hint={<>Looks like <span className="font-mono">1234567890-abc123.apps.googleusercontent.com</span>.</>}
        >
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input value={clientId} onChange={(e) => setClientId(e.target.value)} placeholder="xxxxxxxx.apps.googleusercontent.com" spellCheck={false} />
            <Button variant={dirty ? "primary" : "secondary"} disabled={!dirty || (!!clientId.trim() && !valid)} loading={busy} onClick={saveId}>
              Save
            </Button>
          </div>
        </Field>
        {clientId && !valid && <Alert tone="warn">That does not look like an OAuth Client ID. Copy the “Client ID” (not the secret, not an API key).</Alert>}

        {settings.youtubeClientId && (
          <div className="flex flex-col gap-4 rounded-xl border border-line bg-bg-soft p-4 sm:flex-row sm:items-center">
            <div className="flex min-w-0 flex-1 items-center gap-3">
              {yt.channel?.thumbnail ? <img src={yt.channel.thumbnail} alt="" className="size-10 rounded-full" referrerPolicy="no-referrer" /> : <Youtube className="size-8 text-accent" />}
              <div className="min-w-0">
                <div className="truncate font-medium">{yt.channel?.title ?? "Not connected"}</div>
                <div className="text-xs text-muted">
                  {yt.connected ? "Connected for this session (about 1 hour, then one click to reconnect)" : yt.channel ? "Session expired — reconnect to upload" : "Connect to link your channel"}
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              {yt.channel && <Button variant="ghost" onClick={yt.disconnect}>Disconnect</Button>}
              {!yt.connected && (
                <Button variant="primary" loading={yt.connecting} icon={<Youtube className="size-4" />} onClick={() => yt.connect().then(() => toast("ok", "YouTube connected!")).catch((e) => toast("error", e.message))}>
                  Connect YouTube
                </Button>
              )}
            </div>
          </div>
        )}
        {yt.error && (
          <Alert tone="error" title="Could not connect">
            {yt.error}
            {/origin|redirect_uri|invalid_client|idpiframe/i.test(yt.error) && " — check that the Authorized JavaScript origin above is added to your Client ID exactly."}
          </Alert>
        )}
      </div>
    </Card>
  );
}

function ExtButton({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noreferrer">
      <Button size="sm" icon={<ExternalLink className="size-3.5" />}>{children}</Button>
    </a>
  );
}

// ---------- Autopilot ----------

function Step({ n, title, state, children }: { n: number; title: string; state: "ok" | "todo" | "warn"; children: ReactNode }) {
  return (
    <li className="flex gap-4 p-5">
      <span className={cx("grid size-8 shrink-0 place-items-center rounded-full text-sm font-bold", state === "ok" ? "bg-ok text-white" : state === "warn" ? "bg-warn text-white" : "bg-bg-soft ring-1 ring-line")}>
        {state === "ok" ? "✓" : n}
      </span>
      <div className="min-w-0 flex-1 space-y-3">
        <h3 className="pt-1 font-semibold">{title}</h3>
        {children}
      </div>
    </li>
  );
}

function AutopilotSection() {
  const { settings, save } = useSettings();
  const yt = useYouTube();
  const autopilot = useAutopilot();
  const toast = useToast();
  const [step, setStep] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const cfg = autopilot.config;
  const running = autopilot.running;
  const outdated = !!cfg && cfg.version < SCRIPT_VERSION;

  const allowDrive = () =>
    yt
      .connect(true)
      .then(() => toast("ok", "Google Drive allowed."))
      .catch((e) => toast("error", e.message));

  const create = async () => {
    setError(null);
    setStep("Starting…");
    try {
      const token = await yt.ensureToken(true);
      await setupAutopilot(token, settings.autopilot, settings.keepFilesAfterUpload, (c) => save({ autopilot: c }), setStep);
      toast("ok", "Autopilot created. Now click “Activate Autopilot”.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setStep(null);
    }
  };

  const update = async () => {
    if (!cfg) return;
    setStep("Updating…");
    try {
      const token = await yt.ensureToken(true);
      const d = await deployScript(token, cfg, settings.keepFilesAfterUpload);
      await save({ autopilot: { ...cfg, ...d } });
      toast("ok", "Autopilot updated.");
    } catch (e) {
      toast("error", (e as Error).message);
    } finally {
      setStep(null);
    }
  };

  const reset = async () => {
    if (!confirm("Remove Autopilot from this app? Click “Pause” first so the script stops running. Your Drive folder stays; queued videos won't be uploaded.")) return;
    await save({ autopilot: null });
  };

  return (
    <Card>
      <span id="autopilot" className="block scroll-mt-24" />
      <CardHeader
        icon={<Bot className="size-5" />}
        title="Autopilot"
        subtitle="Add 100s of videos once. Google uploads each one before its time — your PC can be off. Free, in your own Google account."
        action={running ? <Badge className="bg-ok/10 text-ok">Running</Badge> : cfg ? <Badge className="bg-warn/10 text-warn">Not active</Badge> : <Badge>Off</Badge>}
      />
      {!settings.youtubeClientId ? (
        <div className="p-5">
          <Alert tone="info">Finish the YouTube section first.</Alert>
        </div>
      ) : (
        <ol className="divide-y divide-line">
          <Step n={1} title="Turn on Google APIs (once)" state={cfg ? "ok" : "todo"}>
            <p className="text-sm text-muted">Two clicks in your Google account. Use the same Google account and project as your Client ID.</p>
            <div className="flex flex-wrap gap-2">
              <ExtButton href={ENABLE_APIS_URL}>Enable YouTube, Drive, Sheets & Apps Script APIs</ExtButton>
              <ExtButton href={SCRIPT_SETTINGS_URL}>Turn ON “Google Apps Script API”</ExtButton>
            </div>
          </Step>

          <Step n={2} title="Allow Google Drive" state={yt.driveAllowed ? "ok" : "todo"}>
            <p className="text-sm text-muted">UTubeFlow can only see the files it creates in your Drive — nothing else.</p>
            {!yt.driveAllowed && (
              <Button variant="primary" loading={yt.connecting} onClick={allowDrive}>Allow Google Drive</Button>
            )}
          </Step>

          <Step n={3} title="Create Autopilot" state={cfg ? (outdated ? "warn" : "ok") : "todo"}>
            <p className="text-sm text-muted">Creates a private folder, a queue sheet and the Autopilot script in your Google account — automatically.</p>
            {!cfg ? (
              <Button variant="primary" loading={!!step} disabled={!yt.driveAllowed} onClick={create}>{step ?? "Create Autopilot"}</Button>
            ) : outdated ? (
              <Button variant="primary" loading={!!step} onClick={update}>{step ?? "Update Autopilot"}</Button>
            ) : (
              <p className="text-sm text-ok">Created (v{cfg.version}).</p>
            )}
            {error && (
              <Alert tone="error" title="Setup stopped">
                {error}
                {/Apps Script API/i.test(error) && (
                  <>
                    {" "}
                    <a href={SCRIPT_SETTINGS_URL} target="_blank" rel="noreferrer" className="font-medium text-fg underline">Open Apps Script settings</a>, turn it ON, wait a minute and click Create again.
                  </>
                )}
              </Alert>
            )}
          </Step>

          <Step n={4} title="Activate Autopilot" state={running ? "ok" : "todo"}>
            <div className="text-sm text-muted">
              A Google tab opens. Click <b className="text-fg">Review permissions</b> → pick your account → <b className="text-fg">Advanced</b> →{" "}
              <b className="text-fg">Go to UTubeFlow Autopilot</b> → <b className="text-fg">Allow</b>. You'll see “Autopilot is ON”. Then come back and click Check.
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant={running ? "secondary" : "primary"} disabled={!cfg} icon={<Play className="size-4" />} onClick={() => cfg && openWebApp(cfg, "setup")}>
                {running ? "Activate again" : "Activate Autopilot"}
              </Button>
              <Button disabled={!cfg || !yt.driveAllowed} loading={autopilot.syncing} icon={<RefreshCw className="size-4" />} onClick={() => autopilot.sync().catch((e) => toast("error", e.message))}>
                Check status
              </Button>
            </div>
          </Step>

          {cfg && (
            <li className="flex flex-wrap items-center gap-2 bg-bg-soft/50 px-5 py-4">
              <span className="mr-auto text-xs text-muted">Tools</span>
              <Button size="sm" icon={<Play className="size-3.5" />} onClick={() => openWebApp(cfg, "run")} title="Runs Autopilot once now and shows the result">Run now</Button>
              <Button size="sm" icon={<Wrench className="size-3.5" />} loading={step === "Updating…"} onClick={update} title="Re-install the latest script">Update</Button>
              <Button size="sm" icon={<Pause className="size-3.5" />} onClick={() => openWebApp(cfg, "stop")}>Pause</Button>
              <Button size="sm" variant="danger" icon={<Trash2 className="size-3.5" />} onClick={reset}>Remove</Button>
            </li>
          )}
        </ol>
      )}
    </Card>
  );
}

// ---------- Schedule ----------

function ScheduleSection() {
  const { settings, save } = useSettings();
  const toast = useToast();
  const [slots, setSlots] = useState(settings.slots);
  useEffect(() => setSlots(settings.slots), [settings.slots]);
  const clean = sortSlots(slots);
  const dirty = clean.join() !== sortSlots(settings.slots).join();

  const presets: [string, string[]][] = [
    ["1 / day", ["18:00"]],
    ["2 / day", ["09:00", "18:00"]],
    ["3 / day", ["08:00", "13:00", "18:30"]],
    ["4 / day", ["08:00", "12:00", "16:00", "20:00"]],
  ];

  return (
    <Card>
      <span id="schedule" className="block scroll-mt-24" />
      <CardHeader icon={<CalendarClock className="size-5" />} title="Daily time slots" subtitle={`New videos take the next free slot · ${timeZoneName}`} />
      <div className="space-y-5 p-5">
        <div className="flex flex-wrap gap-2">
          {presets.map(([label, p]) => (
            <Button key={label} size="sm" variant="ghost" className="ring-1 ring-line" onClick={() => setSlots(p)}>{label}</Button>
          ))}
        </div>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {slots.map((s, i) => (
            <div key={i} className="flex items-center gap-2">
              <Input type="time" value={s} onChange={(e) => setSlots(slots.map((x, j) => (j === i ? e.target.value : x)))} />
              <button onClick={() => setSlots(slots.filter((_, j) => j !== i))} className="grid size-10 shrink-0 place-items-center rounded-xl text-faint hover:bg-card-hover hover:text-danger">
                <X className="size-4" />
              </button>
            </div>
          ))}
          <Button variant="ghost" className="h-[42px] border border-dashed border-line" icon={<Plus className="size-4" />} onClick={() => setSlots([...slots, "12:00"])}>
            Add time
          </Button>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-1.5">
            {clean.map((s) => (
              <Badge key={s}>{fmtSlot(s)}</Badge>
            ))}
          </div>
          <Button variant="primary" disabled={!dirty} onClick={() => save({ slots: clean }).then(() => toast("ok", "Time slots saved."))}>Save slots</Button>
        </div>
        <p className="text-xs text-faint">YouTube's free API quota allows about 6 uploads a day, so up to 6 slots a day. 3/day = 100 videos in about a month.</p>
      </div>
    </Card>
  );
}

// ---------- Defaults ----------

function DefaultsSection() {
  const { settings, save } = useSettings();
  const toast = useToast();
  const [d, setD] = useState(settings.defaults);
  useEffect(() => setD(settings.defaults), [settings.defaults]);
  const set = <K extends keyof S["defaults"]>(k: K, v: S["defaults"][K]) => setD({ ...d, [k]: v });
  const dirty = JSON.stringify(d) !== JSON.stringify(settings.defaults);

  return (
    <Card>
      <span id="defaults" className="block scroll-mt-24" />
      <CardHeader icon={<SlidersHorizontal className="size-5" />} title="Upload defaults" subtitle="Pre-filled on every upload. You can still change them per video." />
      <div className="space-y-5 p-5">
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Visibility for “Publish now”">
            <Select value={d.privacy} onChange={(e) => set("privacy", e.target.value as Privacy)}>
              <option value="public">Public</option>
              <option value="unlisted">Unlisted</option>
              <option value="private">Private</option>
            </Select>
          </Field>
          <Field label="Category">
            <Select value={d.categoryId} onChange={(e) => set("categoryId", e.target.value)}>
              {YT_CATEGORIES.map(([id, name]) => (
                <option key={id} value={id}>{name}</option>
              ))}
            </Select>
          </Field>
        </div>
        <Field label="Default tags" hint="Comma separated.">
          <Input value={d.tags} onChange={(e) => set("tags", e.target.value)} placeholder="tamil, comedy" />
        </Field>
        <Field label="Description footer" hint="Added to the end of every description — links, hashtags, credits." counter={`${d.descriptionFooter.length}/1000`}>
          <Textarea rows={4} maxLength={1000} value={d.descriptionFooter} onChange={(e) => set("descriptionFooter", e.target.value)} placeholder={"Subscribe for more! 🔔\nInstagram: @yourname"} />
        </Field>
        <div className="space-y-4">
          <Toggle checked={d.addShortsTag} onChange={(v) => set("addShortsTag", v)} label="Add #Shorts to Shorts" hint="Appended to the description when missing." />
          <Toggle checked={d.notifySubscribers} onChange={(v) => set("notifySubscribers", v)} label="Notify subscribers" />
          <Toggle checked={d.madeForKids} onChange={(v) => set("madeForKids", v)} label="Made for kids" />
        </div>
        <div className="flex justify-end">
          <Button variant="primary" disabled={!dirty} onClick={() => save({ defaults: d }).then(() => toast("ok", "Defaults saved."))}>Save defaults</Button>
        </div>
      </div>
    </Card>
  );
}

// ---------- Credits ----------

function CreditsSection() {
  return (
    <Card>
      <span id="credits" className="block scroll-mt-24" />
      <CardHeader icon={<Heart className="size-5" />} title="Credits" subtitle="Who makes UTubeFlow." />
      <div className="space-y-5 p-5">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex items-center gap-4 rounded-xl border border-line bg-bg-soft p-4">
            <span className="grad-bg grid size-12 shrink-0 place-items-center rounded-full text-lg font-extrabold">G</span>
            <span className="min-w-0 flex-1">
              <span className="block text-xs text-muted">Made with ♥ by</span>
              <span className="block text-lg font-bold">Gowtham</span>
            </span>
          </div>
          <a href={CODELOVE} target="_blank" rel="noreferrer" className="group flex items-center gap-4 rounded-xl border border-line bg-bg-soft p-4 transition hover:border-accent/40">
            <span className="min-w-0 flex-1">
              <span className="mb-2 block text-xs text-muted">A product of</span>
              <span className="block h-9">
                <img src="/brand/codelove-footer-on-dark.png" alt="codelove.in" className="only-dark h-full w-auto" />
                <img src="/brand/codelove-footer-on-light.png" alt="codelove.in" className="only-light h-full w-auto" />
              </span>
            </span>
            <ArrowUpRight className="size-4 text-faint transition group-hover:text-accent" />
          </a>
        </div>
        <div>
          <div className="mb-2 text-xs font-semibold tracking-wider text-faint uppercase">More free platforms from CodeLove</div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {PLATFORMS.map(({ name, text, href, icon: Icon }) => (
              <a key={name} href={href} target="_blank" rel="noreferrer" className="group flex items-center gap-3 rounded-xl border border-line p-3 transition hover:border-accent/40">
                <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-accent-soft text-accent">
                  <Icon className="size-4.5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold">{name}</span>
                  <span className="block truncate text-xs text-muted">{text}</span>
                </span>
              </a>
            ))}
          </div>
        </div>
        <p className="text-xs text-faint">UTubeFlow is free and not affiliated with YouTube or Google.</p>
      </div>
    </Card>
  );
}

// ---------- Data ----------

function DataSection() {
  const user = useUser();
  const { settings, save } = useSettings();
  const yt = useYouTube();
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  const setKeep = async (v: boolean) => {
    await save({ keepFilesAfterUpload: v });
    const cfg = isReady(settings.autopilot) ? settings.autopilot : null;
    if (!cfg) return;
    try {
      const token = await yt.ensureToken(true);
      const d = await deployScript(token, cfg, v);
      await save({ keepFilesAfterUpload: v, autopilot: { ...cfg, ...d } });
      toast("ok", "Autopilot updated.");
    } catch (e) {
      toast("error", `Saved, but Autopilot was not updated: ${(e as Error).message}`);
    }
  };

  const deleteAll = async () => {
    if (!confirm("Delete all your data from this app? Your queue list, history and settings are removed. Videos already on YouTube stay there. Pause Autopilot first if it is on.")) return;
    setBusy(true);
    try {
      const snap = await getDocs(collection(db, "users", user.uid, "items"));
      for (const d of snap.docs) await deleteDoc(d.ref);
      await deleteDoc(doc(db, "users", user.uid));
      try {
        localStorage.clear();
      } catch {
        /* ignore */
      }
      await signOut();
    } catch (e) {
      toast("error", (e as Error).message);
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardHeader icon={<Database className="size-5" />} title="Data & account" />
      <div className="space-y-5 p-5">
        <Toggle
          checked={settings.keepFilesAfterUpload}
          onChange={setKeep}
          label="Keep video files in Drive after upload"
          hint="Off (recommended): Autopilot moves a file to Drive's trash once it is on YouTube, so your free 15 GB stays free."
        />
        <div className="flex flex-wrap gap-2 border-t border-line pt-5">
          <Button onClick={() => signOut()}>Sign out</Button>
          <Button variant="danger" loading={busy} icon={<Trash2 className="size-4" />} onClick={deleteAll}>Delete all my data</Button>
        </div>
      </div>
    </Card>
  );
}
