import { APP_NAME } from "../config";
import { SiteFooter, SiteHeader } from "../components/Site";

export default function Privacy() {
  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-14 sm:px-6">
        <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">Privacy</h1>
        <p className="mt-2 text-sm text-faint">Last updated: October 2026</p>
        <div className="mt-8 space-y-5 leading-relaxed text-muted [&_b]:text-fg">
          <p>{APP_NAME} is a free tool from CodeLove (codelove.in). Here is exactly what happens with your data.</p>
          <p><b>What we store:</b> your Google sign-in (name, email, photo), your settings (YouTube OAuth Client ID, Autopilot ids, time slots, upload defaults) and the list of videos you queued or scheduled (title, description, tags, times, YouTube video id).</p>
          <p><b>What we never store:</b> your video files, your Google access tokens, passwords or client secrets. Google access is granted directly to your browser, lasts about one hour and is kept only in that browser tab.</p>
          <p><b>Your files:</b> with Autopilot, videos wait in a folder in your own Google Drive, and a script in your own Google account uploads them to YouTube. The app can only see the Drive files it created. Direct uploads go straight from your browser to YouTube.</p>
          <p><b>Google user data:</b> the app uses Google APIs only to upload videos you choose, set their details and thumbnails, manage your Autopilot folder, sheet and script, and show your channel and upload status. It does not share Google user data with anyone and does not use it for ads.</p>
          <p><b>Deleting:</b> Settings → “Delete all my data” removes everything we store. You can revoke access at any time at myaccount.google.com/permissions.</p>
          <p><b>Contact:</b> codelove.in/contact</p>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
