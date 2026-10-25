import { Link } from "react-router";
import { APP_NAME } from "../config";
import { SiteFooter, SiteHeader } from "../components/Site";

const EMAIL = "support@codelove.in";

export default function Contact() {
  return (
    <div className="flex min-h-dvh flex-col pt-16">
      <SiteHeader />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-14 sm:px-6">
        <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">Contact</h1>
        <div className="mt-8 space-y-5 leading-relaxed text-muted [&_b]:text-fg">
          <p>Questions, bugs, feature ideas or a problem with a scheduled upload? We read every message.</p>
          <p>
            <b>Email:</b>{" "}
            <a href={`mailto:${EMAIL}`} className="text-fg underline underline-offset-4">{EMAIL}</a> — please mention {APP_NAME}, your channel name and, for a failed upload, the video title and the time it was scheduled.
          </p>
          <p><b>In the app:</b> signed-in users can message the admin directly from the chat. Private messages are kept so we can follow up.</p>
          <p><b>Data and privacy:</b> to delete your data, use Settings → “Delete all my data”, or email us. The <Link to="/privacy" className="text-fg underline underline-offset-4">Privacy Policy</Link> explains what we store.</p>
          <p><b>Copyright or abuse:</b> if someone is using {APP_NAME} to upload your work or to spam, email us with the YouTube links and we will act quickly.</p>
          <p>We usually reply within 1–2 days. {APP_NAME} is part of CodeLove — codelove.in.</p>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
