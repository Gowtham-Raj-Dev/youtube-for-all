// Demo mode, for recording tutorial videos with a script (Playwright) — DEV SERVER ONLY.
// Turned on by localStorage["utf-demo"] = JSON while running `npm run dev`. In a production build
// import.meta.env.DEV is false, so DEMO is always null and nothing here changes how the app works.
//
// What it does:
// - `settings`: merged over the user's saved settings (e.g. a Client ID, so the app counts as set up).
// - Firestore writes resolve as soon as they are applied locally (the recording runs with Firestore's
//   network blocked, where a write's promise would otherwise wait for the server forever).

export type Demo = { settings?: Record<string, unknown> };

export const DEMO: Demo | null = import.meta.env.DEV
  ? (() => {
      try {
        return JSON.parse(localStorage.getItem("utf-demo") ?? "null");
      } catch {
        return null;
      }
    })()
  : null;

/** In demo mode: don't wait for the server ack (the write is already in the local cache). */
export function settle<T>(p: Promise<T>): Promise<T | void> {
  if (!DEMO) return p;
  p.catch(() => {});
  return Promise.resolve();
}
