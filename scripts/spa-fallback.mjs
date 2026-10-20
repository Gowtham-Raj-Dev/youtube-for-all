// GitHub Pages has no SPA rewrites: it serves 404.html for unknown paths.
// Copying index.html there lets deep links like /schedule load the app, which then routes client-side.
import { copyFileSync, writeFileSync } from "node:fs";

copyFileSync("dist/index.html", "dist/404.html");
// Without this file GitHub Pages runs Jekyll, which is pointless here and slows deploys.
writeFileSync("dist/.nojekyll", "");
console.log("spa-fallback: wrote dist/404.html and dist/.nojekyll");
