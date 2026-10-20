import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router";
import { collection, deleteDoc, doc, getDocs } from "firebase/firestore";
import { BookOpen, CalendarClock, Database, HardDrive, Monitor, Plus, SlidersHorizontal, Trash2, Youtube, X } from "lucide-react";
import { db } from "../lib/firebase";
import { signOut, useUser } from "../lib/auth";
import { useSettings, YT_CATEGORIES, type Privacy, type Settings as S, type StorageMode } from "../lib/settings";
import { useYouTube } from "../lib/youtube-context";
import { isValidClientId } from "../lib/youtube";
import { parseFirebaseConfig, testUserStorage, userStorageUser } from "../lib/userFirebase";
import { corsCommand, siteOrigin, storageRules } from "../lib/snippets";
import { fmtSlot, sortSlots, timeZoneName } from "../lib/schedule";
import { dropFile } from "../lib/files";
import type { Item } from "../lib/items";
import { Alert, Badge, Button, Card, CardHeader, Field, Input, PageHeader, Segmented, Select, Textarea, Toggle, useToast } from "../components/ui";
import { CopyBox } from "../components/CopyBox";

export default function Settings() {
  const loc = useLocation();
  useEffect(() => {
    if (loc.hash) document.querySelector(loc.hash)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [loc.hash]);

  return (
    <>
      <PageHeader
        title="Settings"
        subtitle="Connect your channel and storage, and set your defaults."
        action={<Link to="/guide"><Button icon={<BookOpen className="size-4" />}>Setup guide</Button></Link>}
      />
      <div className="space-y-6">
        <YouTubeSection />
        <StorageSection />
        <ScheduleSection />
        <DefaultsSection />
        <DataSection />
      </div>
    </>
  );
}

function YouTubeSection() {
  const { settings, save } = useSettings();
  const yt = useYouTube();
  const toast = useToast();
  const [clientId, setClientId] = useState(settings.youtubeClientId);
  const [busy, setBusy] = useState(false);
  useEffect(() => setClientId(settings.youtubeClientId), [settings.youtubeClientId]);

  const dirty = clientId.trim() !== settings.youtubeClientId;
  const valid = isValidClientId(clientId);

  const saveAndConnect = async () => {
    setBusy(true);
    try {
      if (dirty) {
        if (settings.youtubeClientId) yt.disconnect();
        await save({ youtubeClientId: clientId.trim() });
        toast("ok", "Client ID saved. Now click “Connect YouTube”.");
      }
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
        <Field
          label="OAuth Client ID"
          hint={
            <>
              Looks like <span className="font-mono">1234567890-abc123.apps.googleusercontent.com</span>. Not sure how to get it?{" "}
              <Link to="/guide" className="font-medium text-fg underline">Follow the guide</Link>.
            </>
          }
        >
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input value={clientId} onChange={(e) => setClientId(e.target.value)} placeholder="xxxxxxxx.apps.googleusercontent.com" spellCheck={false} />
            <Button variant={dirty ? "primary" : "secondary"} disabled={!dirty || (!!clientId.trim() && !valid)} loading={busy} onClick={saveAndConnect}>
              Save
            </Button>
          </div>
        </Field>
        {clientId && !valid && <Alert tone="warn">That does not look like an OAuth Client ID. Copy the “Client ID” (not the secret, not an API key).</Alert>}

        <CopyBox label="Authorized JavaScript origin (paste this in Google Cloud)" value={siteOrigin()} />

        {settings.youtubeClientId && (
          <div className="flex flex-col gap-4 rounded-xl border border-line bg-bg-soft p-4 sm:flex-row sm:items-center">
            <div className="flex min-w-0 flex-1 items-center gap-3">
              {yt.channel?.thumbnail ? (
                <img src={yt.channel.thumbnail} alt="" className="size-10 rounded-full" referrerPolicy="no-referrer" />
              ) : (
                <Youtube className="size-8 text-accent" />
              )}
              <div className="min-w-0">
                <div className="truncate font-medium">{yt.channel?.title ?? "Not connected"}</div>
                <div className="text-xs text-muted">
                  {yt.connected ? "Connected for this session (about 1 hour, then one click to reconnect)" : yt.channel ? "Session expired — reconnect to upload" : "Connect to link your channel"}
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              {yt.channel && (
                <Button variant="ghost" onClick={yt.disconnect}>Disconnect</Button>
              )}
              {!yt.connected && (
                <Button variant="primary" loading={yt.connecting} icon={<Youtube className="size-4" />} onClick={() => yt.connect().then(() => toast("ok", "YouTube connected!")).catch((e) => toast("error", e.message))}>
                  Connect YouTube
                </Button>
              )}
            </div>
          </div>
        )}
        {yt.error && <Alert tone="error" title="Could not connect">{yt.error}{/origin|redirect_uri|invalid_client|idpiframe/i.test(yt.error) && " — check that the Authorized JavaScript origin above is added to your Client ID exactly."}</Alert>}
      </div>
    </Card>
  );
}

function StorageSection() {
  const user = useUser();
  const { settings, save } = useSettings();
  const toast = useToast();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState<"save" | "test" | null>(null);
  const [email, setEmail] = useState(user.email ?? "");
  const [storageUser, setStorageUser] = useState<string | null>(null);
  const cfg = settings.userFirebase;

  useEffect(() => {
    if (cfg) userStorageUser(cfg).then((u) => setStorageUser(u?.email ?? null)).catch(() => setStorageUser(null));
  }, [cfg]);

  const setMode = async (m: StorageMode) => {
    await save({ storageMode: m });
  };

  const saveConfig = async () => {
    setBusy("save");
    try {
      const c = parseFirebaseConfig(text);
      await save({ userFirebase: c, storageMode: "firebase" });
      setText("");
      toast("ok", `Saved config for “${c.projectId}”. Now click “Sign in & test”.`);
    } catch (e) {
      toast("error", (e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const test = async () => {
    if (!cfg) return;
    setBusy("test");
    try {
      await testUserStorage(cfg, email);
      const u = await userStorageUser(cfg);
      setStorageUser(u?.email ?? null);
      toast("ok", "Your Firebase Storage works — upload, read and delete all passed.");
    } catch (e) {
      toast("error", (e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <Card>
      <span id="storage" className="block scroll-mt-24" />
      <CardHeader icon={<HardDrive className="size-5" />} title="Queue storage" subtitle="Where queued videos wait before going to YouTube. Always yours — never on our servers." />
      <div className="space-y-5 p-5">
        <Segmented<StorageMode>
          value={settings.storageMode}
          onChange={setMode}
          options={[
            { value: "browser", label: "This browser", icon: <Monitor className="size-4" /> },
            { value: "firebase", label: "My Firebase Storage", icon: <HardDrive className="size-4" /> },
          ]}
        />

        {settings.storageMode === "browser" ? (
          <Alert tone="info" title="No setup needed">
            Files are kept inside this browser on this computer. Clearing browser data deletes them, and other devices can't see them. Videos you upload or schedule directly don't need storage at all.
          </Alert>
        ) : (
          <>
            <Alert tone="info" title="Uses your own Firebase project">
              Files go to your bucket and use your storage quota. New Firebase Storage buckets need the Blaze plan (card on file); the free allowance still applies and queued files are deleted after upload.{" "}
              <Link to="/guide#storage" className="font-medium text-fg underline">Storage guide</Link>
            </Alert>

            {cfg && (
              <div className="flex flex-col gap-3 rounded-xl border border-line bg-bg-soft p-4 sm:flex-row sm:items-center">
                <Database className="size-6 shrink-0 text-accent" />
                <div className="min-w-0 flex-1">
                  <div className="font-medium">{cfg.projectId}</div>
                  <div className="truncate text-xs text-muted">
                    {cfg.storageBucket} · {storageUser ? `signed in as ${storageUser}` : "not signed in yet"}
                  </div>
                </div>
                <Button variant="primary" loading={busy === "test"} onClick={test}>Sign in & test</Button>
              </div>
            )}

            <Field label={cfg ? "Replace Firebase config" : "Paste your Firebase web config"} hint="Firebase console → Project settings → Your apps → Web app → SDK setup and configuration → Config. Paste the whole block.">
              <Textarea
                rows={7}
                className="font-mono text-xs"
                value={text}
                onChange={(e) => setText(e.target.value)}
                spellCheck={false}
                placeholder={`const firebaseConfig = {\n  apiKey: "AIza...",\n  authDomain: "my-project.firebaseapp.com",\n  projectId: "my-project",\n  storageBucket: "my-project.firebasestorage.app",\n  messagingSenderId: "...",\n  appId: "1:...:web:..."\n};`}
              />
            </Field>
            <div className="flex justify-end">
              <Button variant="primary" disabled={!text.trim()} loading={busy === "save"} onClick={saveConfig}>Save config</Button>
            </div>

            <div className="space-y-4 border-t border-line pt-5">
              <Field label="Your Gmail for the Storage rules" hint="The Google account you'll sign in with on “Sign in & test”.">
                <Input value={email} onChange={(e) => setEmail(e.target.value)} />
              </Field>
              <CopyBox block label="Storage rules → paste in Firebase console → Storage → Rules → Publish" value={storageRules(email)} />
              <CopyBox block label="CORS → run once in Google Cloud Shell (lets this site read your files)" value={corsCommand(cfg?.storageBucket ?? "")} />
              <CopyBox label="Add this domain in Firebase → Authentication → Settings → Authorized domains" value={window.location.hostname} />
            </div>
          </>
        )}
      </div>
    </Card>
  );
}

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
      <CardHeader icon={<CalendarClock className="size-5" />} title="Daily time slots" subtitle={`“Next free slot” and “Upload all” use these times · ${timeZoneName}`} />
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
        <p className="text-xs text-faint">Tip: YouTube allows about 6 uploads a day on the free API quota, so 3–4 slots a day is a good maximum.</p>
      </div>
    </Card>
  );
}

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
          <Field label="Visibility for “Upload now”">
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

function DataSection() {
  const user = useUser();
  const { settings, save } = useSettings();
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  const deleteAll = async () => {
    if (!confirm("Delete all your data from this app? Your queue, history and settings are removed. Videos already on YouTube stay there.")) return;
    setBusy(true);
    try {
      const snap = await getDocs(collection(db, "users", user.uid, "items"));
      for (const d of snap.docs) {
        const it = d.data() as Item;
        await dropFile(settings, it.file);
        await dropFile(settings, it.thumb);
        await deleteDoc(d.ref);
      }
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
          onChange={(v) => save({ keepFilesAfterUpload: v })}
          label="Keep queue files after upload"
          hint="Off (recommended): the file is deleted from your storage once it is on YouTube, so storage stays free."
        />
        <div className="flex flex-wrap gap-2 border-t border-line pt-5">
          <Button onClick={() => signOut()}>Sign out</Button>
          <Button variant="danger" loading={busy} icon={<Trash2 className="size-4" />} onClick={deleteAll}>Delete all my data</Button>
        </div>
      </div>
    </Card>
  );
}
