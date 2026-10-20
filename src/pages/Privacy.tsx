import { Link } from "react-router";
import { APP_NAME } from "../config";
import { Logo } from "../components/Layout";

export default function Privacy() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      <Link to="/login"><Logo /></Link>
      <h1 className="mt-10 text-3xl font-bold">Privacy</h1>
      <div className="mt-6 space-y-4 leading-relaxed text-muted [&_b]:text-fg">
        <p>{APP_NAME} is a free tool. Here is exactly what happens with your data.</p>
        <p><b>What we store:</b> your Google sign-in (name, email, photo), your settings (YouTube OAuth Client ID, storage choice, time slots, upload defaults) and the list of videos you queued or scheduled (title, description, tags, times, YouTube video id).</p>
        <p><b>What we never store:</b> your video files, your YouTube access tokens, passwords or client secrets. YouTube access is granted by Google directly to your browser, lasts about one hour and is kept only in that browser tab.</p>
        <p><b>Your files:</b> queued videos are saved either in your own browser or in your own Firebase Storage project. Uploads go straight from your browser to YouTube.</p>
        <p><b>Google user data:</b> the app uses the YouTube Data API only to upload videos you choose, set their details and thumbnails, and show your channel and upload status. It does not share Google user data with anyone.</p>
        <p><b>Deleting:</b> Settings → “Delete all my data” removes everything we store. You can revoke YouTube access at any time at myaccount.google.com/permissions.</p>
      </div>
    </div>
  );
}
