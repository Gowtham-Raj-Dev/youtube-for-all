import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
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

  const saveChannel = useCallback(
    (c: Channel | null) => {
      setChannel(c);
      try {
        if (c) localStorage.setItem(cacheKey, JSON.stringify(c));
        else localStorage.removeItem(cacheKey);
      } catch {
        /* ignore */
      }
    },
    [cacheKey],
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
