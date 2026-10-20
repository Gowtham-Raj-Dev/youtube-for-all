import { useEffect, useState, type ReactNode } from "react";
import { Link, useLocation } from "react-router";
import { ChevronDown, ExternalLink, HardDrive, HelpCircle, Youtube } from "lucide-react";
import { useUser } from "../lib/auth";
import { useSettings } from "../lib/settings";
import { useYouTube } from "../lib/youtube-context";
import { corsCommand, siteOrigin, storageRules } from "../lib/snippets";
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
      <span className={cx("absolute top-0 left-0 grid size-8 place-items-center rounded-full text-sm font-bold", done ? "bg-ok text-white" : "grad-bg text-white")}>
        {done ? "✓" : n}
      </span>
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
  const loc = useLocation();
  useEffect(() => {
    if (loc.hash) document.querySelector(loc.hash)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [loc.hash]);

  const email = user.email ?? "";

  return (
    <>
      <PageHeader title="Setup guide" subtitle="Connect your own YouTube API in about 10 minutes. Do it once — it's free." />

      <div className="mb-6">
        <Alert tone="info" title="Why your own API?">
          Every Google Cloud project gets a free daily YouTube quota. Using your own project means your uploads never share a limit with anyone else, and only you control access to your channel.
        </Alert>
      </div>

      <div className="space-y-6">
        <Section id="youtube" icon={<Youtube className="size-5" />} title="Part 1 · YouTube API" subtitle="Required for uploading and scheduling." badge={<Badge className="bg-accent-soft text-accent">Required · ~10 min</Badge>}>
          <Step n={1} title="Create a Google Cloud project">
            <p>
              Open <Ext href="https://console.cloud.google.com/projectcreate">Google Cloud → New project</Ext> while signed in with the <b>same Google account that owns your YouTube channel</b>.
            </p>
            <p>
              Project name: anything, e.g. <Code>My YouTube Uploader</Code> → <b>Create</b>. Wait a few seconds, then make sure the new project is selected in the top bar.
            </p>
          </Step>

          <Step n={2} title="Enable YouTube Data API v3">
            <p>
              Open <Ext href="https://console.cloud.google.com/apis/library/youtube.googleapis.com">YouTube Data API v3</Ext> and click <b>Enable</b>.
            </p>
          </Step>

          <Step n={3} title="Set up the OAuth consent screen">
            <p>
              Open <Ext href="https://console.cloud.google.com/auth/overview">Google Auth Platform</Ext> → <b>Get started</b>.
            </p>
            <ul className="list-disc space-y-1 pl-5">
              <li><b>App name</b>: anything, e.g. <Code>My Uploader</Code>. <b>Support email</b>: your Gmail.</li>
              <li><b>Audience</b>: <b>External</b>.</li>
              <li><b>Contact email</b>: your Gmail → agree to the policy → <b>Create</b>.</li>
            </ul>
            <p>
              Then open <Ext href="https://console.cloud.google.com/auth/audience">Audience</Ext> → under <b>Test users</b> click <b>Add users</b> → add <Code>{email || "your Gmail"}</Code> → <b>Save</b>.
            </p>
            <Alert tone="warn">Leave the publishing status as <b>Testing</b>. You don't need Google's app verification because only you use this app.</Alert>
          </Step>

          <Step n={4} title="Create the OAuth Client ID">
            <p>
              Open <Ext href="https://console.cloud.google.com/auth/clients/create">Clients → Create client</Ext>.
            </p>
            <ul className="list-disc space-y-1 pl-5">
              <li><b>Application type</b>: <b>Web application</b>. Name: anything.</li>
              <li>
                Under <b>Authorized JavaScript origins</b> click <b>Add URI</b> and paste exactly:
              </li>
            </ul>
            <CopyBox value={siteOrigin()} />
            <p>
              Leave <b>Authorized redirect URIs</b> empty → <b>Create</b>. Copy the <b>Client ID</b> (ends with <Code>.apps.googleusercontent.com</Code>). You don't need the client secret — never share it.
            </p>
            <p className="text-xs text-faint">A new origin can take up to 5 minutes to start working.</p>
          </Step>

          <Step n={5} title="Paste it here and connect" done={!!settings.youtubeClientId && !!yt.channel}>
            <p>
              Go to <Link to="/settings#youtube" className="font-medium text-accent hover:underline">Settings → YouTube</Link>, paste the Client ID → <b>Save</b> → <b>Connect YouTube</b>.
            </p>
            <ul className="list-disc space-y-1 pl-5">
              <li>Pick your Google account. If your channel is a <b>Brand Account</b>, pick the channel itself in the list.</li>
              <li>You'll see <b>“Google hasn't verified this app”</b> — that's your own app, so click <b>Continue</b>.</li>
              <li>Allow both permissions (manage/upload videos and view your account) → <b>Continue</b>.</li>
            </ul>
            {settings.youtubeClientId && yt.channel ? (
              <Alert tone="ok">Connected to <b>{yt.channel.title}</b>. You're ready to upload!</Alert>
            ) : (
              <Link to="/settings#youtube"><Button variant="primary">Go to Settings</Button></Link>
            )}
          </Step>
        </Section>

        <Section
          id="storage"
          icon={<HardDrive className="size-5" />}
          title="Part 2 · Your Firebase Storage"
          subtitle="Optional. Only for the Queue across devices. Without it, queued files stay in this browser."
          badge={<Badge>Optional · ~10 min</Badge>}
        >
          <Step n={1} title="Create a Firebase project">
            <p>
              Open the <Ext href="https://console.firebase.google.com/">Firebase console</Ext> → <b>Create a project</b>. You can pick the Google Cloud project from Part 1 so everything stays in one place. Google Analytics is not needed.
            </p>
          </Step>
          <Step n={2} title="Upgrade to the Blaze plan">
            <p>
              Storage on new projects needs the <b>Blaze (pay as you go)</b> plan — click <b>Upgrade</b> at the bottom-left and add a card. The free allowance (about <b>5 GB stored</b>) still applies, and this app deletes queued files after upload, so most people pay nothing.
            </p>
            <Alert tone="info">Tip: set a budget alert (e.g. ₹100 / $1) while upgrading so you get an email long before any charge.</Alert>
          </Step>
          <Step n={3} title="Turn on Storage">
            <p>
              <b>Build → Storage → Get started</b>. Choose a <b>US</b> location (e.g. <Code>us-central1</Code> — the free allowance only applies to US regions) and <b>production mode</b>.
            </p>
          </Step>
          <Step n={4} title="Paste these Storage rules">
            <p>
              In <b>Storage → Rules</b>, replace everything with this and click <b>Publish</b>. Only your Gmail can read or write:
            </p>
            <CopyBox block value={storageRules(email)} />
          </Step>
          <Step n={5} title="Allow this site to read your files (CORS)">
            <p>
              Open <Ext href="https://console.cloud.google.com/?cloudshell=true">Google Cloud Shell</Ext> (same project), paste this and press Enter. Replace the bucket name if yours is different (Storage page shows it, without <Code>gs://</Code>).
            </p>
            <CopyBox block value={corsCommand(settings.userFirebase?.storageBucket ?? "")} />
          </Step>
          <Step n={6} title="Turn on Google sign-in for your project">
            <p>
              <b>Build → Authentication → Get started → Sign-in method → Google → Enable → Save</b>.
            </p>
            <p>
              Then <b>Authentication → Settings → Authorized domains → Add domain</b>:
            </p>
            <CopyBox value={window.location.hostname} />
          </Step>
          <Step n={7} title="Copy your web config and test" done={!!settings.userFirebase}>
            <p>
              <b>Project settings</b> (gear icon) → <b>Your apps</b> → click <b>&lt;/&gt;</b> (Web) → register any nickname → copy the whole <Code>firebaseConfig</Code> block.
            </p>
            <p>
              Paste it in <Link to="/settings#storage" className="font-medium text-accent hover:underline">Settings → Queue storage</Link> → <b>Save config</b> → <b>Sign in & test</b>. All three checks (upload, read, delete) should pass.
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
            <p>The Authorized JavaScript origin is missing or different. It must be exactly <Code>{siteOrigin()}</Code> — no slash at the end. After saving, wait 5 minutes and try again.</p>
          </Faq>
          <Faq q="“Access blocked: app has not completed the Google verification process”">
            <p>Your Gmail is not in <b>Test users</b>. Add it in <Ext href="https://console.cloud.google.com/auth/audience">Audience → Test users</Ext> (Part 1, Step 3).</p>
          </Faq>
          <Faq q="How many videos can I upload per day?">
            <p>The free quota is <b>10,000 units a day</b>; one upload costs <b>1,600</b>, so about <b>6 uploads a day</b>. It resets at midnight Pacific time (12:30 PM IST in summer, 1:30 PM IST in winter). For more, request a quota increase from Google.</p>
          </Faq>
          <Faq q="My uploaded video got locked as private">
            <p>
              YouTube can restrict videos uploaded from API projects that haven't passed its audit. If that happens, submit the free <Ext href="https://support.google.com/youtube/contact/yt_api_form">YouTube API Services audit form</Ext> for your project. Until then, schedule videos as usual and check them in YouTube Studio.
            </p>
          </Faq>
          <Faq q="Why do I have to click “Connect” again every hour?">
            <p>For safety this app keeps no long-term key — Google gives the browser a 1-hour pass. After it expires, one click reconnects. Scheduled videos are already on YouTube and publish on time without you.</p>
          </Faq>
          <Faq q="Do I need to keep my computer on for scheduled videos?">
            <p>No. With <b>Schedule</b>, the video is uploaded right away as private and YouTube itself makes it public at the chosen time. Only keep the tab open <b>while it uploads</b>.</p>
          </Faq>
          <Faq q="Custom thumbnail failed">
            <p>Custom thumbnails need a phone-verified channel. Verify at <Ext href="https://www.youtube.com/verify">youtube.com/verify</Ext>, then set the thumbnail in YouTube Studio.</p>
          </Faq>
          <Faq q="Is my channel safe? What do you store?">
            <p>
              We store only your sign-in, settings and the list of videos you queued or scheduled. Your YouTube access stays in your browser for 1 hour, and video files stay in your own storage. You can remove access any time at <Ext href="https://myaccount.google.com/permissions">Google Account → Third-party access</Ext>.
            </p>
          </Faq>
        </Card>
      </div>
    </>
  );
}
