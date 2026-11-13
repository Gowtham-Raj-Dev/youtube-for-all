import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { deleteDoc, doc, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "./firebase";
import { useUser } from "./auth";
import { useSettings } from "./settings";
import { clearStoredToken, getMyChannel, getStoredToken, requestToken, revokeToken, YouTubeError, type Channel } from "./youtube";

type YouTubeState = {
  /** Last known channel (cached, so the dashboard shows it even when the token has expired). */
  channel: Channel | null;
  /** A valid YouTube token exists in this tab. */
  connected: boolean;
  /** A valid Drive/Apps Script token exists in this tab (needed by Autopilot actions). */
  driveAllowed: boolean;
  connecting: boolean;
  error: string | null;
  /** YouTube permission. Interactive: may open Google's popup — call from a click handler. */
  connect: () => Promise<string>;
  /** Drive + Apps Script permission (a separate Google request — they can't be combined with YouTube). */
  connectDrive: () => Promise<string>;
  /** A valid YouTube token, asking for it if needed. */
  ensureToken: () => Promise<string>;
  /** A valid Drive/Apps Script token, asking for it if needed. */
  ensureDriveToken: () => Promise<string>;
  disconnect: () => void;
  refreshChannel: () => Promise<void>;
};

const YouTubeContext = createContext<YouTubeState | null>(null);

export function YouTubeProvider({ children }: { children: ReactNode }) {
  const user = useUser();
  const { settings } = useSettings();
  const clientId = settings.youtubeClientId;
  const cacheKey = `yt_channel:${user.uid}`;

  const [channel, setChannel] = useState<Channel | null>(() => {
    try {
      return JSON.parse(localStorage.getItem(cacheKey) ?? "null");
    } catch {
      return null;
    }
  });
  const [connected, setConnected] = useState(() => !!clientId && !!getStoredToken(clientId, "yt"));
  const [driveAllowed, setDriveAllowed] = useState(() => !!clientId && !!getStoredToken(clientId, "gd"));
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Token expiry: re-check every 30 s so the UI flips to "Reconnect" on time.
  const tick = useCallback(() => {
    setConnected(!!clientId && !!getStoredToken(clientId, "yt"));
    setDriveAllowed(!!clientId && !!getStoredToken(clientId, "gd"));
  }, [clientId]);
  useEffect(() => {
    tick();
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, [tick]);

  // The channel summary also lives on users/{uid}: the admin dashboard lists it.
  // A public copy in channels/{uid} feeds the /channels directory (free promotion for creators).
  const syncChannel = useCallback(
    (c: Channel | null) => {
      const pub = doc(db, "channels", user.uid);
      // Firestore rejects `undefined` values (an older cached channel may miss a field), which used to
      // drop the users/{uid} write silently — the channel showed on /channels but not in Admin.
      const s = c
        ? { id: c.id, title: c.title ?? "", handle: c.handle ?? "", thumbnail: c.thumbnail ?? "", subscribers: c.subscribers ?? null, views: c.views ?? 0, videos: c.videos ?? 0 }
        : null;
      if (s) setDoc(pub, { id: s.id, title: s.title, handle: s.handle, thumbnail: s.thumbnail, subscribers: s.subscribers, videos: s.videos, updatedAt: serverTimestamp() }).catch(() => {});
      else deleteDoc(pub).catch(() => {});
      return setDoc(
        doc(db, "users", user.uid),
        { channel: s, email: user.email ?? "", name: user.displayName ?? "", photo: user.photoURL ?? "" },
        { merge: true },
      ).catch((e) => console.warn("Could not save channel summary", e));
    },
    [user.uid],
  );
  useEffect(() => {
    if (channel) syncChannel(channel);
    // Once per sign-in: a channel cached from before this field existed gets copied up.
  }, [syncChannel]); // eslint-disable-line react-hooks/exhaustive-deps

  const saveChannel = useCallback(
    (c: Channel | null) => {
      setChannel(c);
      syncChannel(c);
      try {
        if (c) localStorage.setItem(cacheKey, JSON.stringify(c));
        else localStorage.removeItem(cacheKey);
      } catch {
        /* ignore */
      }
    },
    [cacheKey, syncChannel],
  );

  const run = useCallback(
    async (fn: () => Promise<string>) => {
      if (!clientId) throw new YouTubeError("Add your OAuth Client ID in Settings → YouTube first.");
      setConnecting(true);
      setError(null);
      try {
        return await fn();
      } catch (e) {
        setError((e as Error).message);
        throw e;
      } finally {
        tick();
        setConnecting(false);
      }
    },
    [clientId, tick],
  );

  const connect = useCallback(
    () =>
      run(async () => {
        const token = await requestToken(clientId, "yt", user.email ?? undefined);
        saveChannel(await getMyChannel(token));
        return token;
      }),
    [run, clientId, user.email, saveChannel],
  );

  const connectDrive = useCallback(() => run(() => requestToken(clientId, "gd", user.email ?? undefined)), [run, clientId, user.email]);

  const ensureToken = useCallback(async () => (clientId && getStoredToken(clientId, "yt")) || connect(), [clientId, connect]);
  const ensureDriveToken = useCallback(async () => (clientId && getStoredToken(clientId, "gd")) || connectDrive(), [clientId, connectDrive]);

  const disconnect = useCallback(() => {
    if (clientId) revokeToken(clientId);
    saveChannel(null);
    tick();
  }, [clientId, saveChannel, tick]);

  const refreshChannel = useCallback(async () => {
    const t = clientId ? getStoredToken(clientId, "yt") : null;
    if (!t) return;
    try {
      saveChannel(await getMyChannel(t));
    } catch (e) {
      if (e instanceof YouTubeError && e.status === 401) {
        clearStoredToken(clientId, "yt");
        tick();
      }
    }
  }, [clientId, saveChannel, tick]);

  // Keep subscribers / views / videos in sync with YouTube: the numbers saved at "Connect" time go
  // stale as the channel grows. Refresh whenever a valid token exists — on load, when the tab is
  // focused again, and every 10 minutes — which also updates the admin list and /channels.
  const lastSync = useRef(0);
  useEffect(() => {
    if (!connected) return;
    const sync = () => {
      if (document.visibilityState !== "visible" || Date.now() - lastSync.current < 5 * 60_000) return;
      lastSync.current = Date.now();
      refreshChannel();
    };
    sync();
    const id = setInterval(sync, 10 * 60_000);
    document.addEventListener("visibilitychange", sync);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", sync);
    };
  }, [connected, refreshChannel]);

  return (
    <YouTubeContext.Provider
      value={{ channel, connected, driveAllowed, connecting, error, connect, connectDrive, ensureToken, ensureDriveToken, disconnect, refreshChannel }}
    >
      {children}
    </YouTubeContext.Provider>
  );
}

export function useYouTube() {
  const ctx = useContext(YouTubeContext);
  if (!ctx) throw new Error("useYouTube outside YouTubeProvider");
  return ctx;
}
