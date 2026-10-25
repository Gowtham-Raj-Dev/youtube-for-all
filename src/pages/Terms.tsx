import { Link } from "react-router";
import { APP_NAME } from "../config";
import { SiteFooter, SiteHeader } from "../components/Site";

export default function Terms() {
  return (
    <div className="flex min-h-dvh flex-col pt-16">
      <SiteHeader />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-14 sm:px-6">
        <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">Terms of Service</h1>
        <p className="mt-2 text-sm text-faint">Last updated: October 2026</p>
        <div className="mt-8 space-y-5 leading-relaxed text-muted [&_b]:text-fg">
          <p>{APP_NAME} is a free YouTube automation tool from CodeLove (codelove.in). By signing in or using it you agree to these terms. They are short and meant to be fair.</p>
          <p><b>What the tool does:</b> it helps you upload, schedule and publish videos and Shorts to your own YouTube channel, from your browser or through Autopilot running in your own Google account. You stay in control of your channel and can stop at any time.</p>
          <p><b>Your content:</b> you may only upload videos you own or have the rights to publish. You are responsible for what you upload and for following the YouTube Terms of Service, YouTube Community Guidelines and copyright law. {APP_NAME} does not review your videos.</p>
          <p><b>Google and YouTube:</b> {APP_NAME} uses YouTube API Services. By using it you also agree to the YouTube Terms of Service (youtube.com/t/terms) and the Google Privacy Policy (policies.google.com/privacy). Uploads count against your own YouTube API quota and use your own Google Drive.</p>
          <p><b>Fair use:</b> don't use the tool for spam, misleading content, mass-uploading other people's videos, or anything that breaks YouTube's rules. Don't try to attack, overload or misuse the service or other users' data. We may block accounts that do.</p>
          <p><b>Community chat:</b> be respectful. No spam, scams, hate, adult content or sharing other people's personal details. Chat messages are public to signed-in users and are deleted after 3 hours. We may remove messages or block users who break these rules.</p>
          <p><b>Free, as is:</b> {APP_NAME} is free and provided without warranties. Scheduled uploads can fail or be delayed — for example when your API quota runs out, Google access expires, or YouTube changes its API. Keep your own copies of your videos. As far as the law allows, CodeLove is not liable for missed posts, lost data or any loss from using the tool.</p>
          <p><b>Your data:</b> what we store and how to delete it is in the <Link to="/privacy" className="text-fg underline underline-offset-4">Privacy Policy</Link>. You can delete everything from Settings and revoke Google access at myaccount.google.com/permissions.</p>
          <p><b>Changes:</b> the tool and these terms may change as it grows. The date above shows the latest version, and using the tool after a change means you accept it.</p>
          <p><b>Contact:</b> questions about these terms — see <Link to="/contact" className="text-fg underline underline-offset-4">Contact</Link>.</p>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
