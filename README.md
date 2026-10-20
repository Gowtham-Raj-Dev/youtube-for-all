# UTubeFlow — free YouTube automation for everyone

A frontend-only app (Vite + React + Tailwind) for **utubeflow.codelove.in**, hosted on GitHub Pages. A product of [CodeLove](https://codelove.in).

- **Owner's Firebase project** (`for-all-cd03b`): Google login + small Firestore documents (settings, video list). No video files, no tokens.
- **Each user's Google Cloud project**: their own OAuth Client ID → the browser talks to YouTube, Drive, Sheets and Apps Script with the user's own quota.
- **Autopilot** (in each user's own Google account): a Drive folder for video files, a "queue" Google Sheet, and a sheet-bound Apps Script that runs every 30 minutes and uploads due videos to YouTube with `publishAt`. The app creates and updates all three through the Apps Script API — users never open them. Script source: [src/lib/autopilot/Code.gs.txt](src/lib/autopilot/Code.gs.txt) (bump `SCRIPT_VERSION` in [src/lib/autopilot.ts](src/lib/autopilot.ts) when it changes).
- **Direct uploads** (no Autopilot) go straight from the browser to YouTube; scheduling uses YouTube's own `publishAt`.

Pages: Home, Login, Dashboard, Upload Shorts, Upload Videos, Queue, Schedule, Settings (with “Check connection”), Setup Guide, Privacy.

## One-time setup (owner)

1. **Firebase**: Authentication → Sign-in method → **Google** → Enable; Authentication → Settings → Authorized domains → add `utubeflow.codelove.in`. Firestore rules: `npm run deploy:rules`.
2. **GitHub Pages**: repo Settings → Pages → Source: **GitHub Actions**. Every push to `main` deploys ([.github/workflows/deploy.yml](.github/workflows/deploy.yml)).
3. **Domain**: DNS for codelove.in → `CNAME  utubeflow  →  gowtham-raj-dev.github.io`. GitHub → Settings → Pages → Custom domain → `utubeflow.codelove.in` → **Enforce HTTPS**. ([public/CNAME](public/CNAME) is included.)

## Develop

```
npm install
npm run dev        # http://localhost:5173
npm run build      # dist/ with 404.html SPA fallback + .nojekyll
```

To test Google flows locally, add `http://localhost:5173` as an Authorized JavaScript origin on your own OAuth client.

## Notes

- The Google token in the browser lasts ~1 hour (Google Identity Services token model; no client secret in the browser). Autopilot keeps working without it.
- Free YouTube quota: 10,000 units/day per project; one upload = 1,600 → about 6 uploads/day. Autopilot caps itself at 6/day.
- Videos from unaudited API projects can get locked as private by YouTube; the Guide's FAQ points users to the audit form.
