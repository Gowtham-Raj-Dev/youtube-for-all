// Post-build SEO + GitHub Pages fallback.
// - One static HTML file per public page (index.html, login.html, privacy.html) with its own
//   title/description/canonical/og tags and crawlable copy, from src/seo-pages.json.
//   GitHub Pages serves /privacy from privacy.html, so these get a real 200 instead of the 404 page.
// - 404.html: copy of the app for deep links like /schedule (client-side routing), marked noindex.
// - sitemap.xml with build-time lastmod.
import { readFileSync, writeFileSync } from "node:fs";

const seo = JSON.parse(readFileSync("src/seo-pages.json", "utf8"));
const template = readFileSync("dist/index.html", "utf8");
const lastmod = new Date().toISOString();

const esc = (s) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function setMeta(html, attr, key, value) {
  const re = new RegExp(`(<meta ${attr}="${key}" content=")[^"]*(")`);
  if (!re.test(html)) throw new Error(`spa-fallback: <meta ${attr}="${key}"> not found in dist/index.html`);
  return html.replace(re, `$1${esc(value)}$2`);
}

function seoBlock(page) {
  const links = Object.entries(seo.public)
    .map(([path, p]) => `<a href="${path}">${esc(p.h1.split(" — ")[0])}</a>`)
    .join(" · ");
  return `<main class="seo-copy" style="max-width:720px;margin:0 auto;padding:96px 16px;font-family:Inter,system-ui,sans-serif;color:#9fb3ab">
      <h1>${esc(page.h1)}</h1>
      <p>${esc(page.body)}</p>
      <p>${links} · <a href="https://codelove.in">CodeLove</a></p>
    </main>`;
}

function render(path, page) {
  const url = seo.site + path;
  let html = template
    .replace(/<title>[^<]*<\/title>/, `<title>${esc(page.title)}</title>`)
    .replace(/(<link rel="canonical" href=")[^"]*(")/, `$1${url}$2`)
    .replace(/<!--seo:start-->[\s\S]*?<!--seo:end-->/, seoBlock(page));
  html = setMeta(html, "name", "description", page.description);
  html = setMeta(html, "property", "og:title", page.title);
  html = setMeta(html, "property", "og:description", page.description);
  html = setMeta(html, "property", "og:url", url);
  html = setMeta(html, "name", "twitter:title", page.title);
  html = setMeta(html, "name", "twitter:description", page.description);
  // The FAQ structured data belongs to the home page only (that's where the FAQ is).
  if (path !== "/") html = html.replace(/<!--faq:start-->[\s\S]*?<!--faq:end-->/, "");
  return html;
}

const files = [];
for (const [path, page] of Object.entries(seo.public)) {
  const file = path === "/" ? "dist/index.html" : `dist${path}.html`;
  writeFileSync(file, render(path, page));
  files.push(file);
}

// App pages (dashboard, queue…) load through 404.html. They need sign-in, so keep them out of search.
const fallback = template
  .replace(/<meta name="robots" content="[^"]*"/, '<meta name="robots" content="noindex, follow"')
  .replace(/\s*<link rel="canonical"[^>]*>/, "")
  .replace(/<!--faq:start-->[\s\S]*?<!--faq:end-->/, "")
  .replace(/<!--seo:start-->[\s\S]*?<!--seo:end-->/, "");
writeFileSync("dist/404.html", fallback);

const urls = Object.keys(seo.public)
  .map((path) => `  <url>\n    <loc>${seo.site}${path}</loc>\n    <lastmod>${lastmod}</lastmod>\n    <changefreq>daily</changefreq>\n    <priority>1.0</priority>\n  </url>`)
  .join("\n");
writeFileSync(
  "dist/sitemap.xml",
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`,
);

// Without this file GitHub Pages runs Jekyll, which is pointless here and slows deploys.
writeFileSync("dist/.nojekyll", "");
console.log(`spa-fallback: wrote ${files.join(", ")}, dist/404.html, dist/sitemap.xml, dist/.nojekyll`);
