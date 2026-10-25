import { APP_NAME } from "../config";
import { SiteFooter, SiteHeader } from "../components/Site";

export default function Privacy() {
  return (
    <div className="flex min-h-dvh flex-col pt-16">
      <SiteHeader />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-14 sm:px-6">
        <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">Privacy Policy</h1>
        <p className="mt-2 text-sm text-faint">Last updated: October 2026</p>
        <div className="mt-8 space-y-5 leading-relaxed text-muted [&_b]:text-fg">
          <p>{APP_NAME} is a free tool from CodeLove (codelove.in). Here is exactly what happens with your data.</p>
          <p><b>What we store:</b> your Google sign-in (name, email, photo), your settings (YouTube OAuth Client ID, Autopilot ids, time slots, upload defaults) and the list of videos you queued or scheduled (title, description, tags, times, YouTube video id).</p>
          <p><b>What we never store:</b> your video files, your Google access tokens, passwords or client secrets. Google access is granted directly to your browser, lasts about one hour and is kept only in that browser tab.</p>
          <p><b>Your files:</b> with Autopilot, videos wait in a folder in your own Google Drive, and a script in your own Google account uploads them to YouTube. The app can only see the Drive files it created. Direct uploads go straight from your browser to YouTube.</p>
          <p><b>Google user data:</b> the app uses Google APIs only to upload videos you choose, set their details and thumbnails, manage your Autopilot folder, sheet and script, and show your channel and upload status. It does not share Google user data with anyone and does not use it for ads.</p>
          <p><b>Chat:</b> messages and files you post in the community chat are visible to other signed-in users, with your name, photo and channel name, and are deleted 3 hours after they are sent. Private messages between you and the admin are kept so support can follow up. While the app is open, other users can see that you are online.</p>
          <p><b>Admin:</b> the site owner can see each account's name, email, connected channel and the list of videos queued or uploaded through the app, to run and support the service.</p>
          <p><b>Analytics:</b> the site uses Google Analytics to count visits (pages viewed, device, browser and rough location). It sets cookies for this and is not used to identify you. You can opt out with Google's browser add-on at tools.google.com/dlpage/gaoptout.</p>
          <p><b>Advertising:</b> we use or may use Google AdSense to show ads. Third-party vendors, including Google, use cookies to serve ads based on your prior visits to this website or other websites. Google's use of advertising cookies enables it and its partners to serve ads to you based on your visits to this site and/or other sites on the Internet. You can opt out of personalized advertising at adssettings.google.com, and of some third-party vendors' cookies at aboutads.info. Your Google user data from YouTube or Drive is never used for ads.</p>
          <p><b>Deleting:</b> Settings → “Delete all my data” removes everything we store. You can revoke access at any time at myaccount.google.com/permissions.</p>
          <p><b>Contact:</b> codelove.in/contact</p>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
