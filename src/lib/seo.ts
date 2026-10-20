import { useEffect } from "react";
import { useLocation } from "react-router";
import seo from "../seo-pages.json";

type Page = { title: string; description: string };
const PAGES = seo.public as Record<string, Page>;
const APP_TITLE = "UTubeFlow — Free YouTube Automation";

function setAttr(selector: string, attr: string, value: string | null) {
  const el = document.head.querySelector(selector);
  if (!el) return;
  if (value === null) el.removeAttribute(attr);
  else el.setAttribute(attr, value);
}

/** Keeps title/description/canonical/robots right on client-side navigation (the build writes them per page too). */
export function useSeo() {
  const { pathname } = useLocation();
  useEffect(() => {
    const page = PAGES[pathname];
    document.title = page?.title ?? APP_TITLE;
    setAttr('meta[name="robots"]', "content", page ? "index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1" : "noindex, follow");
    if (!page) return;
    const url = seo.site + pathname;
    setAttr('link[rel="canonical"]', "href", url);
    setAttr('meta[name="description"]', "content", page.description);
    setAttr('meta[property="og:url"]', "content", url);
    setAttr('meta[property="og:title"]', "content", page.title);
    setAttr('meta[property="og:description"]', "content", page.description);
  }, [pathname]);
}
