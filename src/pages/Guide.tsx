import { useEffect, useState, type ReactNode } from "react";
import { Link, useLocation } from "react-router";
import { AlertTriangle, Bot, Check, ChevronDown, ExternalLink, HelpCircle, ShieldCheck, Youtube } from "lucide-react";
import { useUser } from "../lib/auth";
import { useSettings } from "../lib/settings";
import { useYouTube } from "../lib/youtube-context";
import { useAutopilot } from "../lib/autopilot-context";
import { ENABLE_APIS_URL, SCRIPT_SETTINGS_URL } from "../lib/autopilot";
import { siteOrigin } from "../lib/snippets";
import { Alert, Badge, Button, Card, Code, cx, PageHeader } from "../components/ui";
import { CopyBox } from "../components/CopyBox";

const LINKS = {
  newProject: "https://console.cloud.google.com/projectcreate",
  consent: "https://console.cloud.google.com/auth/overview",
  audience: "https://console.cloud.google.com/auth/audience",
  newClient: "https://console.cloud.google.com/auth/clients/create",
  clients: "https://console.cloud.google.com/auth/clients",
  auditForm: "https://support.google.com/youtube/contact/yt_api_form",
  verify: "https://www.youtube.com/verify",
  permissions: "https://myaccount.google.com/permissions",
};

function Open({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noreferrer" className="inline-block">
      <Button size="sm" variant="primary" icon={<ExternalLink className="size-3.5" />}>{children}</Button>
    </a>
  );
}

function Ext({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-medium text-accent hover:underline">
      {children}
      <ExternalLink className="size-3.5" />
    </a>
  );
}

/** One big step: number, title, short "why", then numbered clicks. */
function Step({ n, title, why, done, children }: { n: number; title: string; why?: string; done?: boolean; children: ReactNode }) {
  return (
    <li className="relative pb-10 pl-14 last:pb-0">
      <span className="absolute top-11 bottom-0 left-[19px] w-px bg-line" />
      <span className={cx("absolute top-0 left-0 grid size-10 place-items-center rounded-full text-base font-bold", done ? "bg-ok text-white" : "grad-bg")}>
        {done ? <Check className="size-5" /> : n}
      </span>
      <div className="flex flex-wrap items-center gap-2 pt-1.5">
        <h3 className="text-lg font-bold">{title}</h3>
        {done && <Badge className="bg-ok/10 text-ok">Done</Badge>}
      </div>
      {why && <p className="mt-1 text-sm text-muted">{why}</p>}
      <div className="mt-4 space-y-4 text-sm leading-relaxed text-muted [&_b]:text-fg">{children}</div>
    </li>
  );
}

/** Numbered clicks inside a step. `start` continues numbering after a copy box. */
function Clicks({ start = 1, children }: { start?: number; children: ReactNode[] | ReactNode }) {
  const list = Array.isArray(children) ? children : [children];
  return (
    <ol className="space-y-2.5 rounded-xl border border-line bg-bg-soft p-4">
      {list.map((c, i) => (
        <li key={i} className="flex gap-3">
          <span className="grid size-6 shrink-0 place-items-center rounded-full bg-card text-xs font-bold text-accent ring-1 ring-line">{start + i}</span>
          <div className="min-w-0 flex-1 pt-0.5">{c}</div>
        </li>
      ))}
    </ol>
  );
}

function Done({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-start gap-2 rounded-lg bg-ok/5 px-3 py-2 text-xs text-ok ring-1 ring-ok/20">
      <Check className="mt-0.5 size-3.5 shrink-0" />
      <span>{children}</span>
    </div>
  );
}

function Section({ id, icon, title, subtitle, badge, children }: { id: string; icon: ReactNode; title: string; subtitle: string; badge: ReactNode; children: ReactNode }) {
  return (
    <Card>
      <span id={id} className="block scroll-mt-24" />
      <div className="flex items-start gap-4 border-b border-line p-5 sm:p-6">
        <div className="grid size-12 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent">{icon}</div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-xl font-bold">{title}</h2>
            {badge}
          </div>
          <p className="mt-1 text-sm text-muted">{subtitle}</p>
        </div>
      </div>
      <ol className="p-5 sm:p-8">{children}</ol>
    </Card>
  );
}

function Problem({ error, children }: { error: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-line last:border-0">
      <button onClick={() => setOpen(!open)} className="flex w-full items-start justify-between gap-4 px-5 py-4 text-left">
        <span className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warn" />
          <span className="font-mono text-[13px] font-medium">{error}</span>
        </span>
        <ChevronDown className={cx("mt-0.5 size-4 shrink-0 text-muted transition", open && "rotate-180")} />
      </button>
      {open && <div className="space-y-2 px-5 pb-5 pl-12 text-sm leading-relaxed text-muted [&_b]:text-fg">{children}</div>}
    </div>
  );
}

export default function Guide() {
  const user = useUser();
  const { settings } = useSettings();
  const yt = useYouTube();
  const autopilot = useAutopilot();
  const loc = useLocation();
  useEffect(() => {
    if (loc.hash) setTimeout(() => document.querySelector(loc.hash)?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
  }, [loc.hash]);

  const email = user.email ?? "";
  const origin = siteOrigin();
  const progress = [
    { label: "Client ID saved", done: !!settings.youtubeClientId },
    { label: "YouTube connected", done: !!yt.channel },
    { label: "Autopilot created", done: !!autopilot.config },
    { label: "Autopilot running", done: autopilot.running },
  ];

  return (
    <>
      <PageHeader title="Setup guide" subtitle="Follow the steps in order. About 10 minutes, once. Everything stays free and in your own Google account." />

      {/* Progress */}
      <Card className="mb-6 p-5">
        <div className="mb-3 text-sm font-semibold">Your progress</div>
        <div className="grid gap-2 sm:grid-cols-4">
          {progress.map((p) => (
            <div key={p.label} className={cx("flex items-center gap-2 rounded-xl border px-3 py-2.5 text-sm", p.done ? "border-ok/30 bg-ok/5 text-ok" : "border-line text-muted")}>
              <span className={cx("grid size-5 place-items-center rounded-full", p.done ? "bg-ok text-white" : "ring-1 ring-line")}>{p.done && <Check className="size-3" />}</span>
              {p.label}
            </div>
          ))}
        </div>
      </Card>

      <div className="mb-6">
        <Alert tone="info" title="Before you start">
          Use the <b>same Google account</b> everywhere — the one that owns your YouTube channel. You're signed in here as <b>{email}</b>. Open every link in the browser where that account is signed in.
        </Alert>
      </div>

      <div className="space-y-6">
        {/* ---------------- Part 1 ---------------- */}
        <Section
          id="youtube"
          icon={<Youtube className="size-6" />}
          title="Part 1 · Connect YouTube"
          subtitle="Create your own free Google Cloud project and a key (Client ID) that lets UTubeFlow upload to your channel."
          badge={<Badge className="bg-accent-soft text-accent">Required · ~8 min</Badge>}
        >
          <Step n={1} title="Create a Google Cloud project" why="A free “container” for your API settings. You make it once.">
            <Clicks>
              <>Click <b>Open</b> below. Sign in with your YouTube account if Google asks.</>
              <>First time on Google Cloud? Tick the <b>Terms of Service</b> box and click <b>Agree and continue</b>.</>
              <><b>Project name</b>: type anything, e.g. <Code>My YouTube</Code>. Leave <b>Location</b> as it is.</>
              <>Click <b>Create</b> and wait ~10 seconds for the bell notification.</>
              <>Click <b>Select project</b> in the notification (or pick it from the project list at the top-left).</>
            </Clicks>
            <Open href={LINKS.newProject}>Open: New project</Open>
            <Done>Done when the top bar of Google Cloud shows your new project's name.</Done>
          </Step>

          <Step n={2} title="Turn on the APIs" why="Switches on YouTube (uploads) plus Drive, Sheets and Apps Script (for Autopilot) — all four in one go.">
            <Clicks>
              <>Click <b>Open</b> below.</>
              <>Check that the project at the top is the one from Step 1. Click <b>Next</b>.</>
              <>Click <b>Enable</b> and wait until it finishes.</>
            </Clicks>
            <Open href={ENABLE_APIS_URL}>Open: Enable APIs</Open>
            <Done>Done when you land on the “APIs &amp; Services” page without errors.</Done>
          </Step>

          <Step n={3} title="Set up the consent screen" why="The small screen Google shows when you allow access. Only you will see it.">
            <Clicks>
              <>Click <b>Open</b> below, then <b>Get started</b>.</>
              <><b>App name</b>: anything, e.g. <Code>My YouTube</Code>. <b>User support email</b>: choose your Gmail. Click <b>Next</b>.</>
              <><b>Audience</b>: select <b>External</b>. Click <b>Next</b>.</>
              <><b>Contact information</b>: type your Gmail. Click <b>Next</b>.</>
              <>Tick <b>I agree to the Google API Services: User Data Policy</b>, click <b>Continue</b>, then <b>Create</b>.</>
            </Clicks>
            <Open href={LINKS.consent}>Open: Consent screen</Open>
          </Step>

          <Step n={4} title="Add yourself as a Test user — don't skip!" why="Your app stays in “Testing” mode, so Google only lets in the people on this list.">
            <div className="rounded-xl border border-danger/30 bg-danger/5 p-4">
              <div className="flex items-center gap-2 font-semibold text-danger">
                <AlertTriangle className="size-4" /> Skip this and you'll see:
              </div>
              <p className="mt-1.5 font-mono text-xs text-muted">Access blocked: … has not completed the Google verification process · Error 403: access_denied</p>
            </div>
            <Clicks>
              <>Click <b>Open</b> below (the <b>Audience</b> page). Make sure your project is selected at the top.</>
              <>Scroll to <b>Test users</b> and click <b>+ Add users</b>.</>
              <>Paste your Gmail (copy it from the box below) and click <b>Save</b>.</>
            </Clicks>
            <CopyBox value={email} />
            <Clicks start={4}>
              <>Leave <b>Publishing status</b> as <b>Testing</b>. Do <b>not</b> click “Publish app” — you don't need Google's review for your own use.</>
            </Clicks>
            <Open href={LINKS.audience}>Open: Audience → Test users</Open>
            <Done>Done when your Gmail appears in the Test users list.</Done>
          </Step>

          <Step n={5} title="Create the OAuth Client ID" why="The key UTubeFlow uses to ask Google for permission. The Client ID isn't secret; the client secret is — and you don't need it.">
            <Clicks>
              <>Click <b>Open</b> below.</>
              <><b>Application type</b>: choose <b>Web application</b>. <b>Name</b>: anything.</>
              <>Under <b>Authorized JavaScript origins</b> click <b>+ Add URI</b> and paste exactly this (no slash at the end):</>
            </Clicks>
            <CopyBox value={origin} />
            <Clicks start={4}>
              <>Leave <b>Authorized redirect URIs</b> empty. Click <b>Create</b>.</>
              <>A box shows your <b>Client ID</b> (ends with <Code>.apps.googleusercontent.com</Code>). Click the copy icon next to it.</>
            </Clicks>
            <Open href={LINKS.newClient}>Open: Create Client ID</Open>
            <p className="text-xs text-faint">
              Lost it? It's always listed on the <Ext href={LINKS.clients}>Clients page</Ext>. A new origin can take up to 5 minutes to start working.
            </p>
          </Step>

          <Step n={6} title="Paste it in UTubeFlow and connect" done={!!settings.youtubeClientId && !!yt.channel}>
            <Clicks>
              <>Go to <Link to="/settings#youtube" className="font-medium text-accent hover:underline">Settings → YouTube</Link>, paste the Client ID, click <b>Save</b>.</>
              <>Click <b>Connect YouTube</b>. A Google window opens.</>
              <>Choose <b>{email || "your account"}</b>. If your channel is a <b>Brand Account</b>, pick the channel itself.</>
              <>You'll see <b>“Google hasn't verified this app”</b> — normal, it's your own app. Click <b>Continue</b>.</>
              <><b>Tick every checkbox</b> (manage YouTube videos, view your account) and click <b>Continue</b>.</>
            </Clicks>
            {settings.youtubeClientId && yt.channel ? (
              <Alert tone="ok">Connected to <b>{yt.channel.title}</b>. Part 1 is done!</Alert>
            ) : (
              <Link to="/settings#youtube" className="inline-block"><Button variant="primary">Go to Settings → YouTube</Button></Link>
            )}
          </Step>
        </Section>

        {/* ---------------- Part 2 ---------------- */}
        <Section
          id="autopilot"
          icon={<Bot className="size-6" />}
          title="Part 2 · Turn on Autopilot"
          subtitle="Lets Google upload your scheduled videos even when your PC is off. Uses your free Google Drive (15 GB) and Apps Script."
          badge={<Badge>Recommended · ~3 min</Badge>}
        >
          <Step n={1} title="Allow Apps Script for your account" why="A one-time switch in your Google account that lets UTubeFlow install the Autopilot script.">
            <Clicks>
              <>Click <b>Open</b> below.</>
              <>Find <b>Google Apps Script API</b> and switch it <b>On</b>.</>
            </Clicks>
            <Open href={SCRIPT_SETTINGS_URL}>Open: Apps Script settings</Open>
          </Step>

          <Step n={2} title="Allow Google Drive" done={yt.driveAllowed}>
            <Clicks>
              <>Go to <Link to="/settings#autopilot" className="font-medium text-accent hover:underline">Settings → Autopilot</Link> and click <b>Allow Google Drive</b>.</>
              <>In the Google window: pick your account → <b>Continue</b> → <b>tick every checkbox</b> → <b>Continue</b>.</>
            </Clicks>
            <p className="text-xs text-faint">UTubeFlow can only see the files it creates in your Drive — never your other files.</p>
          </Step>

          <Step n={3} title="Create Autopilot" done={!!autopilot.config}>
            <Clicks>
              <>In <b>Settings → Autopilot</b>, click <b>Create Autopilot</b>.</>
              <>Wait ~10 seconds. UTubeFlow makes a private folder, a queue sheet and the Autopilot script in your Google account.</>
            </Clicks>
            <p className="text-xs text-faint">
              You never need to open the folder or sheet — everything is managed here. If it stops with “Apps Script API”, redo Step 1, wait a minute and click Create again; it continues where it stopped.
            </p>
          </Step>

          <Step n={4} title="Activate Autopilot" done={autopilot.running}>
            <Clicks>
              <>Click <b>Activate Autopilot</b>. A new Google tab opens.</>
              <>Click <b>Review permissions</b> and pick your account.</>
              <>On <b>“Google hasn't verified this app”</b> click <b>Advanced</b>, then <b>Go to UTubeFlow Autopilot (unsafe)</b>. It's your own script in your own account.</>
              <>Click <b>Allow</b>. You'll see <b>“Autopilot is ON”</b> with green ticks. Close that tab.</>
            </Clicks>
          </Step>

          <Step n={5} title="Check everything" done={autopilot.running && !!yt.channel}>
            <Clicks>
              <>Open <Link to="/settings" className="font-medium text-accent hover:underline">Settings</Link> and click <b>Check now</b> at the top.</>
              <>Every line should be green. A red line tells you exactly what to fix.</>
              <>Go to <Link to="/upload/short" className="font-medium text-accent hover:underline">Upload Shorts</Link>, pick videos, choose <b>Schedule</b> → <b>Add to Autopilot</b>. Done!</>
            </Clicks>
          </Step>
        </Section>

        {/* ---------------- Problems ---------------- */}
        <Card>
          <span id="faq" className="block scroll-mt-24" />
          <div className="flex items-center gap-3 border-b border-line p-5">
            <HelpCircle className="size-5 text-accent" />
            <div>
              <h2 className="text-lg font-semibold">Errors &amp; fixes</h2>
              <p className="text-sm text-muted">Find the message you see, then follow the fix.</p>
            </div>
          </div>
          <Problem error="Access blocked: … has not completed the Google verification process (Error 403: access_denied)">
            <p>
              Your Gmail is not in the <b>Test users</b> list. Do <b>Part 1 → Step 4</b>: add <b>{email}</b>, click Save, wait a minute and connect again.
            </p>
            <p>Also check that you picked the <b>same account</b> in the Google window.</p>
          </Problem>
          <Problem error="Error 400: redirect_uri_mismatch / origin_mismatch / Not a valid origin">
            <p>
              The <b>Authorized JavaScript origin</b> on your Client ID is missing or different. It must be exactly <Code>{origin}</Code> — no slash at the end. Fix it on the{" "}
              <Ext href={LINKS.clients}>Clients page</Ext>, Save, wait 5 minutes.
            </p>
          </Problem>
          <Problem error="Some permissions were not allowed">
            <p>On Google's screen some checkboxes were left empty. Click Connect again and <b>tick every box</b>.</p>
          </Problem>
          <Problem error="YouTube Data API v3 / Google Drive API … is not enabled (has not been used in project)">
            <p>Redo <b>Part 1 → Step 2</b> (Enable APIs) with the right project selected, then wait 2 minutes.</p>
          </Problem>
          <Problem error="User has not enabled the Apps Script API">
            <p>Turn it on at <Ext href={SCRIPT_SETTINGS_URL}>Apps Script settings</Ext> (Part 2 → Step 1), wait a minute, then click <b>Create Autopilot</b> again.</p>
          </Problem>
          <Problem error="This Google account has no YouTube channel">
            <p>You picked a Google account without a channel. Connect again and choose the account (or Brand Account) that owns your channel.</p>
          </Problem>
          <Problem error="The browser blocked the Google popup">
            <p>Allow popups for this site (icon at the right of the address bar), then click the button again.</p>
          </Problem>
          <Problem error="Your YouTube API daily quota is used up">
            <p>The free quota allows about <b>6 uploads a day</b>. It resets at midnight Pacific time (12:30 PM IST in summer, 1:30 PM IST in winter). Autopilot continues by itself after the reset.</p>
          </Problem>
          <Problem error="Video uploaded but locked as private">
            <p>YouTube can restrict uploads from API projects that haven't been audited. Submit the free <Ext href={LINKS.auditForm}>YouTube API audit form</Ext> for your project.</p>
          </Problem>
          <Problem error="Video uploaded, but the thumbnail was not set">
            <p>Custom thumbnails need a phone-verified channel: <Ext href={LINKS.verify}>youtube.com/verify</Ext>.</p>
          </Problem>
        </Card>

        <Card className="p-5">
          <div className="flex items-start gap-3">
            <ShieldCheck className="mt-0.5 size-5 shrink-0 text-accent" />
            <p className="text-sm leading-relaxed text-muted [&_b]:text-fg">
              <b>Is my channel safe?</b> UTubeFlow stores only your sign-in, settings and your video list. Video files stay in your Drive. You can remove access at any time at{" "}
              <Ext href={LINKS.permissions}>Google Account → Third-party access</Ext>.
            </p>
          </div>
        </Card>
      </div>
    </>
  );
}
