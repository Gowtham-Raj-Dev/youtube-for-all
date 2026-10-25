import { Link } from "react-router";
import { APP_NAME } from "../config";
import { SiteFooter, SiteHeader } from "../components/Site";

export default function About() {
  return (
    <div className="flex min-h-dvh flex-col pt-16">
      <SiteHeader />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-14 sm:px-6">
        <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">About {APP_NAME}</h1>
        <div className="mt-8 space-y-5 leading-relaxed text-muted [&_b]:text-fg">
          <p>{APP_NAME} is a free YouTube automation tool made by Gowtham at CodeLove (codelove.in). It exists because posting every day is the hardest part of growing a channel — and most schedulers that do it well cost money every month.</p>
          <p><b>What it does:</b> you upload a batch of videos and Shorts once, pick your daily time slots, and {APP_NAME} publishes them on schedule. With Autopilot, the videos wait in your own Google Drive and a script in your own Google account posts them — so uploads keep going even when your computer is off.</p>
          <p><b>Why it's free:</b> {APP_NAME} doesn't run expensive servers for you. It uses your own free YouTube API quota and your own Google Drive, so there are no plans, no payments and no credit card. Your videos never pass through our servers.</p>
          <p><b>Who it's for:</b> Shorts creators, small channels, educators, gamers, and anyone who wants a steady posting schedule without paying for a scheduler.</p>
          <p><b>Part of CodeLove:</b> CodeLove makes free web tools, apps and games for creators, students and developers — including Free 3D Models, Free 3D Games, Link in Bio, Video to GIF, Video to Images and Free Java Games. Explore them all at codelove.in.</p>
          <p>
            New here? Read the{" "}
            <Link to="/login" className="text-fg underline underline-offset-4">sign-in page</Link> to get started, or see how we treat your data in the{" "}
            <Link to="/privacy" className="text-fg underline underline-offset-4">Privacy Policy</Link>.
          </p>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
