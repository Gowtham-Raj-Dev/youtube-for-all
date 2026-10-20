import { useEffect, useState, type ReactNode } from "react";
import { Link, useLocation } from "react-router";
import { Bot, ChevronDown, ExternalLink, HelpCircle, Youtube } from "lucide-react";
import { useUser } from "../lib/auth";
import { useSettings } from "../lib/settings";
import { useYouTube } from "../lib/youtube-context";
import { useAutopilot } from "../lib/autopilot-context";
import { ENABLE_APIS_URL, SCRIPT_SETTINGS_URL } from "../lib/autopilot";
import { siteOrigin } from "../lib/snippets";
import { Alert, Badge, Button, Card, Code, cx, PageHeader } from "../components/ui";
import { CopyBox } from "../components/CopyBox";

function Ext({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-medium text-accent hover:underline">
      {children}
      <ExternalLink className="size-3.5" />
    </a>
  );
}

function Step({ n, title, done, children }: { n: number; title: string; done?: boolean; children: ReactNode }) {
  return (
    <li className="relative pb-8 pl-12 last:pb-0">
      <span className="absolute top-9 bottom-0 left-[15px] w-px bg-line" />
      <span className={cx("absolute top-0 left-0 grid size-8 place-items-center rounded-full text-sm font-bold text-white", done ? "bg-ok" : "grad-bg")}>{done ? "✓" : n}</span>
      <h3 className="pt-1 font-semibold">{title}</h3>
      <div className="mt-2 space-y-3 text-sm leading-relaxed text-muted [&_b]:text-fg">{children}</div>
    </li>
  );
}

function Section({ id, icon, title, subtitle, badge, children }: { id: string; icon: ReactNode; title: string; subtitle: string; badge: ReactNode; children: ReactNode }) {
  return (
    <Card>
      <span id={id} className="block scroll-mt-24" />
      <div className="flex items-start gap-4 border-b border-line p-5">
        <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent">{icon}</div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-semibold">{title}</h2>
            {badge}
          </div>
          <p className="mt-0.5 text-sm text-muted">{subtitle}</p>
        </div>
      </div>
      <ol className="p-5 sm:p-6">{children}</ol>
    </Card>
  );
}

function Faq({ q, children }: { q: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-line last:border-0">
      <button onClick={() => setOpen(!open)} className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left text-sm font-medium">
        {q}
        <ChevronDown className={cx("size-4 shrink-0 text-muted transition", open && "rotate-180")} />
      </button>
      {open && <div className="space-y-2 px-5 pb-4 text-sm leading-relaxed text-muted [&_b]:text-fg">{children}</div>}
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

  return (
    <>
      <PageHeader title="Setup guide" subtitle="About 10 minutes, once. Everything is free and stays in your own Google account." />

      <div className="mb-6">
        <Alert tone="info" title="Why your own Google project?">
          Every Google Cloud project gets a free daily YouTube quota. Using your own means your uploads never share a limit with anyone, and only you control your channel.
        </Alert>
      </div>

      <div className="space-y-6">
        <Section id="youtube" icon={<Youtube className="size-5" />} title="Part 1 · Connect YouTube" subtitle="Required for uploading and scheduling." badge={<Badge className="bg-accent-soft text-accent">Required · ~8 min</Badge>}>
          <Step n={1} title="Create a Google Cloud project">
            <p>
              Open <Ext href="https://console.cloud.google.com/projectcreate">Google Cloud → New project</Ext> signed in with the <b>Google account that owns your YouTube channel</b>.
            </p>
            <p>Name it anything, e.g. <Code>My YouTube Uploader</Code> → <b>Create</b>. Make sure the new project is selected in the top bar.</p>
          </Step>

          <Step n={2} title="Enable the APIs">
            <p>
              Open <Ext href={ENABLE_APIS_URL}>this link</Ext> → check the project name → <b>Next</b> → <b>Enable</b>. It turns on YouTube, Drive, Sheets and Apps Script APIs in one go (the last three are for Autopilot).
            </p>
          </Step>

          <Step n={3} title="Set up the consent screen">
            <p>
              Open <Ext href="https://console.cloud.google.com/auth/overview">Google Auth Platform</Ext> → <b>Get started</b>.
            </p>
            <ul className="list-disc space-y-1 pl-5">
              <li><b>App name</b>: anything, e.g. <Code>My Uploader</Code>. <b>Support email</b>: your Gmail.</li>
              <li><b>Audience</b>: <b>External</b>. <b>Contact email</b>: your Gmail → agree → <b>Create</b>.</li>
            </ul>
            <p>
              Then <Ext href="https://console.cloud.google.com/auth/audience">Audience</Ext> → <b>Test users</b> → <b>Add users</b> → <Code>{email || "your Gmail"}</Code> → <b>Save</b>.
            </p>
            <Alert tone="warn">Leave the status as <b>Testing</b>. You don't need Google's verification — only you use this app.</Alert>
          </Step>

          <Step n={4} title="Create the OAuth Client ID">
            <p>
              Open <Ext href="https://console.cloud.google.com/auth/clients/create">Clients → Create client</Ext>. <b>Application type</b>: <b>Web application</b>.
            </p>
            <p>Under <b>Authorized JavaScript origins</b> → <b>Add URI</b> → paste exactly:</p>
            <CopyBox value={siteOrigin()} />
            <p>
              Leave redirect URIs empty → <b>Create</b> → copy the <b>Client ID</b> (ends with <Code>.apps.googleusercontent.com</Code>). You don't need the client secret — never share it.
            </p>
            <p className="text-xs text-faint">A new origin can take up to 5 minutes to start working.</p>
          </Step>

          <Step n={5} title="Paste it and connect" done={!!settings.youtubeClientId && !!yt.channel}>
            <p>
              <Link to="/settings#youtube" className="font-medium text-accent hover:underline">Settings → YouTube</Link> → paste → <b>Save</b> → <b>Connect YouTube</b>.
            </p>
            <ul className="list-disc space-y-1 pl-5">
              <li>Pick your account. For a <b>Brand Account</b> channel, pick the channel itself.</li>
              <li>On <b>“Google hasn't verified this app”</b> click <b>Continue</b> — it's your own app.</li>
              <li>Tick every permission → <b>Continue</b>.</li>
            </ul>
            {settings.youtubeClientId && yt.channel ? (
              <Alert tone="ok">Connected to <b>{yt.channel.title}</b>.</Alert>
            ) : (
              <Link to="/settings#youtube"><Button variant="primary">Go to Settings</Button></Link>
            )}
          </Step>
        </Section>

        <Section
          id="autopilot"
          icon={<Bot className="size-5" />}
          title="Part 2 · Autopilot"
          subtitle="Add many videos once; Google uploads each one on schedule even when your PC is off. Free — uses your Google Drive (15 GB) and Apps Script."
          badge={<Badge>Recommended · ~3 min</Badge>}
        >
          <Step n={1} title="Turn on the Apps Script API for your account">
            <p>
              Open <Ext href={SCRIPT_SETTINGS_URL}>Apps Script settings</Ext> and switch <b>Google Apps Script API</b> to <b>On</b>. (The APIs from Part 1, Step 2 must also be enabled.)
            </p>
          </Step>
          <Step n={2} title="Allow Google Drive" done={yt.driveAllowed}>
            <p>
              <Link to="/settings#autopilot" className="font-medium text-accent hover:underline">Settings → Autopilot</Link> → <b>Allow Google Drive</b>. UTubeFlow can only see files it creates.
            </p>
          </Step>
          <Step n={3} title="Create Autopilot" done={!!autopilot.config}>
            <p>
              Click <b>Create Autopilot</b>. The app makes a private folder, a queue sheet and the Autopilot script in your account. You never need to open them — everything is managed from UTubeFlow.
            </p>
          </Step>
          <Step n={4} title="Activate" done={autopilot.running}>
            <p>Click <b>Activate Autopilot</b>. In the Google tab that opens:</p>
            <ul className="list-disc space-y-1 pl-5">
              <li><b>Review permissions</b> → pick your account.</li>
              <li><b>“Google hasn't verified this app”</b> → <b>Advanced</b> → <b>Go to UTubeFlow Autopilot (unsafe)</b>. It's your own script.</li>
              <li><b>Allow</b>. You'll see <b>“Autopilot is ON”</b> with green ticks.</li>
            </ul>
          </Step>
          <Step n={5} title="Check connection">
            <p>
              Back in <Link to="/settings" className="font-medium text-accent hover:underline">Settings</Link>, click <b>Check now</b> at the top. Every line should be green. Then upload Shorts with <b>Schedule</b> — they go to Autopilot automatically.
            </p>
          </Step>
        </Section>

        <Card>
          <span id="faq" className="block scroll-mt-24" />
          <div className="flex items-center gap-3 border-b border-line p-5">
            <HelpCircle className="size-5 text-accent" />
            <h2 className="text-lg font-semibold">Problems & questions</h2>
          </div>
          <Faq q="“Error 400: redirect_uri_mismatch” or “origin not allowed”">
            <p>The Authorized JavaScript origin is missing or different. It must be exactly <Code>{siteOrigin()}</Code> — no slash at the end. Wait 5 minutes after saving.</p>
          </Faq>
          <Faq q="“Access blocked: app has not completed the Google verification process”">
            <p>Your Gmail is not in <b>Test users</b>. Add it in <Ext href="https://console.cloud.google.com/auth/audience">Audience → Test users</Ext>.</p>
          </Faq>
          <Faq q="“User has not enabled the Apps Script API”">
            <p>Turn it on at <Ext href={SCRIPT_SETTINGS_URL}>script.google.com/home/usersettings</Ext>, wait a minute, then click <b>Create Autopilot</b> again. It continues where it stopped.</p>
          </Faq>
          <Faq q="How many videos per day?">
            <p>
              The free YouTube quota is about <b>6 uploads a day</b>. Autopilot respects this: add 100 videos with 3 slots a day and they go out over about a month, all by themselves. The quota resets at midnight Pacific time (12:30 PM IST in summer, 1:30 PM IST in winter).
            </p>
          </Faq>
          <Faq q="When does Autopilot upload a video?">
            <p>It checks every 30 minutes and uploads each video up to a day before its time as a scheduled (private) video. YouTube then makes it public at the exact time you set.</p>
          </Faq>
          <Faq q="Do I need to keep the browser open?">
            <p>
              Only while your files are being <b>saved to Drive</b> after you click “Add to Autopilot”. After that, close everything. Without Autopilot, keep the tab open until the upload finishes.
            </p>
          </Faq>
          <Faq q="My uploaded video got locked as private">
            <p>
              YouTube can restrict videos uploaded through API projects that haven't been audited. If it happens, submit the free <Ext href="https://support.google.com/youtube/contact/yt_api_form">YouTube API Services audit form</Ext>.
            </p>
          </Faq>
          <Faq q="Custom thumbnail failed">
            <p>Custom thumbnails need a phone-verified channel: <Ext href="https://www.youtube.com/verify">youtube.com/verify</Ext>.</p>
          </Faq>
          <Faq q="Is my channel safe? What do you store?">
            <p>
              We store only your sign-in, settings and the list of your videos (titles, times). Video files stay in your Drive. YouTube access lives in your browser for 1 hour and in your own Autopilot script. Remove access any time at{" "}
              <Ext href="https://myaccount.google.com/permissions">Google Account → Third-party access</Ext>.
            </p>
          </Faq>
        </Card>
      </div>
    </>
  );
}
