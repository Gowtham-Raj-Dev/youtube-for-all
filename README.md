# TubeFlow — free YouTube automation for everyone

A frontend-only app (Vite + React + Tailwind) for **youtube.codelove.in**, hosted on GitHub Pages.

- **Your Firebase project** (owner): Google login + small Firestore documents (settings, queue/schedule list). No video files, no tokens.
- **Each user's Google Cloud project**: their own OAuth Client ID → the browser uploads straight to YouTube with their own quota.
- **Each user's storage**: queued files go to *their* Firebase Storage, or stay in their browser (IndexedDB).
- **Scheduling** uses YouTube's own `publishAt`: the video is uploaded as private and YouTube publishes it on time, so no server is needed.

Pages: Dashboard, Upload Video, Upload Short, Queue, Schedule, Settings, Setup Guide, Privacy.

## One-time setup (owner)

1. **Firebase project** (a new one, separate from ShortFlow):
   - Authentication → Sign-in method → **Google** → Enable.
   - Authentication → Settings → Authorized domains → add `youtube.codelove.in`.
   - Firestore Database → Create (production mode).
   - Project settings → Your apps → Web → copy the config into [src/config.ts](src/config.ts).
2. **Firestore rules**: put the project id in `.firebaserc` (or run `firebase use --add`), then `npm run deploy:rules`.
3. **GitHub**: push this folder as the repo root → Settings → Pages → Source: **GitHub Actions**. Every push to `main` deploys ([.github/workflows/deploy.yml](.github/workflows/deploy.yml)).
4. **Domain**: in the DNS for codelove.in add `CNAME  youtube  →  <github-username>.github.io`. Then in GitHub → Settings → Pages → Custom domain → `youtube.codelove.in` → tick **Enforce HTTPS** once it's available. ([public/CNAME](public/CNAME) is already included.)

## Develop

```
npm install
npm run dev        # http://localhost:5173 (add "localhost" to Firebase Authorized domains — it is there by default)
npm run build      # dist/ with 404.html SPA fallback + .nojekyll
```

To test YouTube locally, add `http://localhost:5173` as an Authorized JavaScript origin on your own OAuth client.

## Notes

- The YouTube token lasts ~1 hour (Google Identity Services token model, no client secret in the browser). Users click "Connect" again after that.
- Free quota is 10,000 units/day per user project; one upload = 1,600 units, so about 6 uploads/day.
- Videos from unaudited API projects can get locked as private by YouTube. The Guide's FAQ points users to the audit form.
