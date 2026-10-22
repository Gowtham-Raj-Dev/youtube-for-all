import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router";
import { collection, deleteDoc, doc, getDocs } from "firebase/firestore";
import { AlertTriangle, BookOpen, Bot, CalendarClock, CheckCircle2, CircleDashed, Database, Pause, Play, Plus, RefreshCw, ShieldCheck, SlidersHorizontal, Trash2, Wrench, X, XCircle, Youtube } from "lucide-react";
import { db } from "../lib/firebase";
import { signOut, useUser } from "../lib/auth";
import { useSettings, type Privacy, type Settings as S } from "../lib/settings";
import { useYouTube } from "../lib/youtube-context";
import { useAutopilot } from "../lib/autopilot-context";
import { getMyChannel, isValidClientId } from "../lib/youtube";
import { checkAutopilot, deployScript, ENABLE_APIS_URL, isReady, openWebApp, SCRIPT_SETTINGS_URL, SCRIPT_VERSION, setupAutopilot, type Check } from "../lib/autopilot";
import { siteOrigin } from "../lib/snippets";
import { fmtSlot, sortSlots, timeZoneName } from "../lib/schedule";
import { Alert, Badge, Button, Card, CardHeader, Code, cx, Field, Input, PageHeader, Progress, Dropdown, Textarea, Toggle, useToast } from "../components/ui";
import { CATEGORY_OPTIONS, PRIVACY_OPTIONS } from "../components/options";
import { CopyBox } from "../components/CopyBox";
import { Clicks, OpenLink, StepCard, useSetupTicks } from "../components/Steps";
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
        token = await yt.ensureToken();
        add({ key: "login", label: "YouTube permission", state: "ok", detail: "Allowed." });
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
      // A second Google popup right after the first would be blocked, so only use an existing Drive token.
      const driveToken = yt.driveAllowed ? await yt.ensureDriveToken() : null;
      if (!driveToken) {
        add({ key: "drive", label: "Drive permission", state: "error", detail: "Not allowed in this session — click “Allow Google Drive” in the Autopilot section, then check again." });
        return;
      }
      add({ key: "drive", label: "Drive permission", state: "ok", detail: "Allowed." });
      const r = await checkAutopilot(driveToken, cfg);
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
  const user = useUser();
  const { settings, save } = useSettings();
  const { isTicked, setTicked } = useSetupTicks();
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

  const email = user.email ?? "";
  const haveId = !!settings.youtubeClientId;
  const connected = !!yt.channel;
  // Manual ticks, plus what the app can infer: a saved Client ID means the Cloud steps were done,
  // a connected channel means the APIs and the test user are fine too.
  const done = [
    isTicked("yt-project") || haveId,
    isTicked("yt-apis") || connected,
    isTicked("yt-consent") || haveId,
    isTicked("yt-testuser") || connected,
    isTicked("yt-client") || haveId,
    haveId,
    connected,
  ];
  const current = done.findIndex((d) => !d);
  const count = done.filter(Boolean).length;
  const tick = (key: string) => (on: boolean) => setTicked(key, on).catch((e) => toast("error", (e as Error).message));

  return (
    <Card>
      <span id="youtube" className="block scroll-mt-24" />
      <CardHeader
        icon={<Youtube className="size-5" />}
        title="YouTube setup"
        subtitle="7 steps, about 8 minutes, once. Tick each step when you finish it."
        action={<Link to="/guide#youtube"><Button size="sm" variant="ghost" icon={<BookOpen className="size-3.5" />}>Full guide</Button></Link>}
      />
      <div className="space-y-4 p-5">
        <div>
          <div className="mb-1.5 flex justify-between text-xs">
            <span className="font-medium">{count === 7 ? "All done — YouTube is connected 🎉" : `${count} of 7 done`}</span>
            <span className="text-faint">Signed in as {email}</span>
          </div>
          <Progress value={count / 7} />
        </div>

        <ol className="space-y-3">
          <StepCard n={1} title="Create a Google Cloud project" done={done[0]} current={current === 0} onTick={haveId ? undefined : tick("yt-project")} why="A free container for your API settings. Use the Google account that owns your YouTube channel.">
            <Clicks>
              <>Click <b>Open</b>. First time? Tick the Terms box → <b>Agree and continue</b>.</>
              <><b>Project name</b>: anything, e.g. <Code>My YouTube</Code> → <b>Create</b>.</>
              <>Wait ~10 s, then click <b>Select project</b> in the notification.</>
            </Clicks>
            <OpenLink href="https://console.cloud.google.com/projectcreate">Open: New project</OpenLink>
          </StepCard>

          <StepCard n={2} title="Turn on the APIs" done={done[1]} current={current === 1} onTick={connected ? undefined : tick("yt-apis")} why="YouTube for uploads, plus Drive, Sheets and Apps Script for Autopilot — all four at once.">
            <Clicks>
              <>Click <b>Open</b>. Check your project is selected at the top → <b>Next</b>.</>
              <>Click <b>Enable</b> and wait until it finishes.</>
            </Clicks>
            <OpenLink href={ENABLE_APIS_URL}>Open: Enable APIs</OpenLink>
          </StepCard>

          <StepCard n={3} title="Set up the consent screen" done={done[2]} current={current === 2} onTick={haveId ? undefined : tick("yt-consent")}>
            <Clicks>
              <>Click <b>Open</b> → <b>Get started</b>.</>
              <><b>App name</b>: anything. <b>User support email</b>: your Gmail → <b>Next</b>.</>
              <><b>Audience</b>: <b>External</b> → <b>Next</b>.</>
              <><b>Contact information</b>: your Gmail → <b>Next</b>.</>
              <>Tick <b>I agree…</b> → <b>Continue</b> → <b>Create</b>.</>
            </Clicks>
            <OpenLink href="https://console.cloud.google.com/auth/overview">Open: Consent screen</OpenLink>
          </StepCard>

          <StepCard n={4} title="Add your Gmail as a Test user" done={done[3]} current={current === 3} onTick={connected ? undefined : tick("yt-testuser")}>
            <div className="rounded-xl border border-danger/30 bg-danger/5 p-3.5 text-xs text-muted">
              <b className="text-danger">Must do.</b> Without it Google shows <span className="font-mono">“Access blocked: … has not completed the Google verification process (Error 403: access_denied)”</span>.
            </div>
            <Clicks>
              <>Click <b>Open</b> (the <b>Audience</b> page). Check your project is selected.</>
              <>Under <b>Test users</b> click <b>+ Add users</b>.</>
              <>Paste this Gmail and click <b>Save</b>:</>
            </Clicks>
            <CopyBox value={email} />
            <Clicks start={4}>
              <>Keep <b>Publishing status</b> as <b>Testing</b> — don't click “Publish app”.</>
            </Clicks>
            <OpenLink href="https://console.cloud.google.com/auth/audience">Open: Test users</OpenLink>
          </StepCard>

          <StepCard n={5} title="Create the OAuth Client ID" done={done[4]} current={current === 4} onTick={haveId ? undefined : tick("yt-client")}>
            <Clicks>
              <>Click <b>Open</b>. <b>Application type</b>: <b>Web application</b>. Name: anything.</>
              <>Under <b>Authorized JavaScript origins</b> → <b>+ Add URI</b> → paste exactly this:</>
            </Clicks>
            <CopyBox value={siteOrigin()} />
            <Clicks start={3}>
              <>Leave redirect URIs empty → <b>Create</b>.</>
              <>Copy the <b>Client ID</b> it shows (ends with <Code>.apps.googleusercontent.com</Code>). You don't need the secret.</>
            </Clicks>
            <OpenLink href="https://console.cloud.google.com/auth/clients/create">Open: Create Client ID</OpenLink>
          </StepCard>

          <StepCard n={6} title="Paste your Client ID" done={done[5]} current={current === 5} autoNote="Ticks itself when you click Save">
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input value={clientId} onChange={(e) => setClientId(e.target.value)} placeholder="1234567890-abc123.apps.googleusercontent.com" spellCheck={false} />
              <Button variant={dirty ? "primary" : "secondary"} disabled={!dirty || (!!clientId.trim() && !valid)} loading={busy} onClick={saveId}>
                Save
              </Button>
            </div>
            {clientId && !valid && <Alert tone="warn">That does not look like an OAuth Client ID. Copy the “Client ID” (not the secret, not an API key).</Alert>}
          </StepCard>

          <StepCard n={7} title="Connect your YouTube channel" done={done[6]} current={current === 6} autoNote="Ticks itself when your channel is connected">
            {!haveId ? (
              <p className="text-sm text-muted">Finish step 6 first.</p>
            ) : (
              <>
                <Clicks>
                  <>Click <b>Connect YouTube</b> and choose <b>{email}</b> (or your Brand Account channel).</>
                  <>On <b>“Google hasn't verified this app”</b> click <b>Continue</b> — it's your own app.</>
                  <><b>Tick every checkbox</b> → <b>Continue</b>.</>
                </Clicks>
                <div className="flex flex-col gap-4 rounded-xl border border-line bg-bg-soft p-4 sm:flex-row sm:items-center">
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    {yt.channel?.thumbnail ? <img src={yt.channel.thumbnail} alt="" className="size-10 rounded-full" referrerPolicy="no-referrer" /> : <Youtube className="size-8 text-accent" />}
                    <div className="min-w-0">
                      <div className="truncate font-medium">{yt.channel?.title ?? "Not connected yet"}</div>
                      <div className="text-xs text-muted">
                        {yt.connected ? "Connected for this session (about 1 hour, then one click to reconnect)" : yt.channel ? "Session expired — reconnect to upload" : "Click Connect to link your channel"}
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
              </>
            )}
            {yt.error && (
              <Alert tone="error" title="Could not connect">
                {yt.error}
                {/origin|redirect_uri|invalid_client|idpiframe/i.test(yt.error) && " — check step 5: the Authorized JavaScript origin must match exactly."}
                {/closed/i.test(yt.error) && " If Google said “Access blocked”, do step 4 (Test user)."}
              </Alert>
            )}
          </StepCard>
        </ol>
      </div>
    </Card>
  );
}


// ---------- Autopilot ----------

function AutopilotSection() {
  const { settings, save } = useSettings();
  const yt = useYouTube();
  const autopilot = useAutopilot();
  const toast = useToast();
  const { isTicked, setTicked } = useSetupTicks();
  const [step, setStep] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const cfg = autopilot.config;
  const running = autopilot.running;
  const outdated = !!cfg && cfg.version < SCRIPT_VERSION;

  const allowDrive = () =>
    yt
      .connectDrive()
      .then(() => toast("ok", "Google Drive allowed."))
      .catch((e) => toast("error", e.message));

  const create = async () => {
    setError(null);
    setStep("Starting…");
    try {
      const token = await yt.ensureDriveToken();
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
      const token = await yt.ensureDriveToken();
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
    autopilot.setStatus(null);
  };

  const done = [isTicked("ap-script") || !!cfg, yt.driveAllowed || !!cfg, !!cfg && !outdated, running];
  const current = done.findIndex((d) => !d);
  const count = done.filter(Boolean).length;

  return (
    <Card>
      <span id="autopilot" className="block scroll-mt-24" />
      <CardHeader
        icon={<Bot className="size-5" />}
        title="Autopilot setup"
        subtitle="Add 100s of videos once. Google uploads each one before its time — your PC can be off. Free, in your own Google account."
        action={running ? <Badge className="bg-ok/10 text-ok">Running</Badge> : cfg ? <Badge className="bg-warn/10 text-warn">Not active</Badge> : <Badge>Off</Badge>}
      />
      {!settings.youtubeClientId ? (
        <div className="p-5">
          <Alert tone="info">Finish the YouTube setup above first.</Alert>
        </div>
      ) : (
        <div className="space-y-4 p-5">
          <div>
            <div className="mb-1.5 text-xs font-medium">{count === 4 ? "Autopilot is running 🎉" : `${count} of 4 done`}</div>
            <Progress value={count / 4} />
          </div>
          <ol className="space-y-3">
            <StepCard
              n={1}
              title="Turn on the Apps Script API"
              done={done[0]}
              current={current === 0}
              onTick={cfg ? undefined : (on) => setTicked("ap-script", on).catch((e) => toast("error", (e as Error).message))}
              why="A one-time switch in your Google account. It lets UTubeFlow install the Autopilot script for you."
            >
              <Clicks>
                <>Click <b>Open</b> (signed in with your YouTube account).</>
                <>Find <b>Google Apps Script API</b> and switch it <b>On</b>.</>
              </Clicks>
              <OpenLink href={SCRIPT_SETTINGS_URL}>Open: Apps Script settings</OpenLink>
              <p className="text-xs text-faint">
                Also needed: Drive, Sheets and Apps Script APIs in your Cloud project — YouTube setup step 2 already turned them on. Not sure? <a href={ENABLE_APIS_URL} target="_blank" rel="noreferrer" className="text-accent hover:underline">Enable them again</a>.
              </p>
            </StepCard>

            <StepCard n={2} title="Allow Google Drive" done={done[1]} current={current === 1} autoNote="Ticks itself when Google says yes">
              <Clicks>
                <>Click <b>Allow Google Drive</b>. A Google window opens.</>
                <>Pick your account → <b>Continue</b> → <b>tick every checkbox</b> → <b>Continue</b>.</>
              </Clicks>
              <p className="text-xs text-faint">This is a separate permission from YouTube (Google doesn't allow both in one window). UTubeFlow can only see the files it creates in your Drive.</p>
              {!yt.driveAllowed && (
                <Button variant="primary" loading={yt.connecting} onClick={allowDrive}>Allow Google Drive</Button>
              )}
            </StepCard>

            <StepCard n={3} title={outdated ? "Update Autopilot" : "Create Autopilot"} done={done[2]} current={current === 2} autoNote="Ticks itself when it's created">
              <p className="text-sm text-muted">Makes a private folder, a queue sheet and the Autopilot script in your Google account — automatically, in about 10 seconds. You never need to open them.</p>
              {!cfg ? (
                <Button variant="primary" loading={!!step} onClick={create}>{step ?? "Create Autopilot"}</Button>
              ) : outdated ? (
                <Button variant="primary" loading={!!step} onClick={update}>{step ?? "Update Autopilot"}</Button>
              ) : null}
              {error && (
                <Alert tone="error" title="Setup stopped">
                  {error}
                  {/Apps Script API/i.test(error) && " Do step 1 (switch it On), wait a minute and click Create again — it continues where it stopped."}
                </Alert>
              )}
            </StepCard>

            <StepCard n={4} title="Activate Autopilot" done={done[3]} current={current === 3} autoNote="Ticks itself once Autopilot reports in — click Check status">
              <Clicks>
                <>Click <b>Activate Autopilot</b>. A new Google tab opens.</>
                <>Click <b>Review permissions</b> → pick your account.</>
                <>On <b>“Google hasn't verified this app”</b> click <b>Advanced</b> → <b>Go to UTubeFlow Autopilot (unsafe)</b>. It's your own script.</>
                <>Click <b>Allow</b>. You'll see <b>“Autopilot is ON”</b>. Close that tab and click <b>Check status</b> here.</>
              </Clicks>
              <div className="flex flex-wrap gap-2">
                <Button variant={running ? "secondary" : "primary"} disabled={!cfg} icon={<Play className="size-4" />} onClick={() => cfg && openWebApp(cfg, "setup")}>
                  {running ? "Activate again" : "Activate Autopilot"}
                </Button>
                <Button disabled={!cfg} loading={autopilot.syncing} icon={<RefreshCw className="size-4" />} onClick={async () => {
                  try {
                    await yt.ensureDriveToken();
                    await autopilot.sync();
                  } catch (e) {
                    toast("error", (e as Error).message);
                  }
                }}>
                  Check status
                </Button>
              </div>
            </StepCard>
          </ol>

          {cfg && (
            <div className="flex flex-wrap items-center gap-2 rounded-xl border border-line bg-bg-soft/50 px-4 py-3">
              <span className="mr-auto text-xs text-muted">Tools</span>
              <Button size="sm" icon={<Play className="size-3.5" />} onClick={() => openWebApp(cfg, "run")} title="Runs Autopilot once now and shows the result">Run now</Button>
              <Button size="sm" icon={<Wrench className="size-3.5" />} loading={step === "Updating…"} onClick={update} title="Re-install the latest script">Update</Button>
              <Button size="sm" icon={<Pause className="size-3.5" />} onClick={() => { openWebApp(cfg, "stop"); autopilot.setStatus({ ...autopilot.status, trigger: "off" }); }}>Pause</Button>
              <Button size="sm" variant="danger" icon={<Trash2 className="size-3.5" />} onClick={reset}>Remove</Button>
            </div>
          )}
        </div>
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
            <Dropdown<Privacy> value={d.privacy} onChange={(v) => set("privacy", v)} options={PRIVACY_OPTIONS} />
          </Field>
          <Field label="Category">
            <Dropdown value={d.categoryId} onChange={(v) => set("categoryId", v)} options={CATEGORY_OPTIONS} />
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
                <img src="brand/codelove-footer-on-dark.png" alt="codelove.in" className="only-dark h-full w-auto" />
                <img src="brand/codelove-footer-on-light.png" alt="codelove.in" className="only-light h-full w-auto" />
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
      const token = await yt.ensureDriveToken();
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
