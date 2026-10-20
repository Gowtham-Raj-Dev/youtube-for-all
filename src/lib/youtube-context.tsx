import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { useUser } from "./auth";
import { useSettings } from "./settings";
import {
  AUTOPILOT_SCOPES,
  clearStoredToken,
  getMyChannel,
  getStoredToken,
  requestToken,
  revokeToken,
  tokenHasScopes,
  YouTubeError,
  YT_SCOPES,
  type Channel,
} from "./youtube";

type YouTubeState = {
  /** Last known channel (cached, so the dashboard shows it even when the token has expired). */
  channel: Channel | null;
  connected: boolean;
  /** The current token also covers Drive + Apps Script (needed by Autopilot). */
  driveAllowed: boolean;
  connecting: boolean;
  error: string | null;
  /** Interactive: may open Google's popup. Call from a click handler. */
  connect: (withDrive?: boolean) => Promise<string>;
  /** A valid token (with Drive scopes if asked), connecting if needed. */
  ensureToken: (needDrive?: boolean) => Promise<string>;
  disconnect: () => void;
  refreshChannel: () => Promise<void>;
};

const YouTubeContext = createContext<YouTubeState | null>(null);

export function YouTubeProvider({ children }: { children: ReactNode }) {
  const user = useUser();
  const { settings } = useSettings();
  const clientId = settings.youtubeClientId;
  const wantsDrive = !!settings.autopilot;
  const cacheKey = `yt_channel:${user.uid}`;

  const [channel, setChannel] = useState<Channel | null>(() => {
    try {
      return JSON.parse(localStorage.getItem(cacheKey) ?? "null");
    } catch {
      return null;
    }
  });
  const [connected, setConnected] = useState(() => !!clientId && !!getStoredToken(clientId));
  const [driveAllowed, setDriveAllowed] = useState(() => !!clientId && tokenHasScopes(clientId, AUTOPILOT_SCOPES));
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Token expiry: re-check every 30 s so the UI flips to "Reconnect" on time.
  const tick = useCallback(() => {
    setConnected(!!clientId && !!getStoredToken(clientId));
    setDriveAllowed(!!clientId && !!getStoredToken(clientId) && tokenHasScopes(clientId, AUTOPILOT_SCOPES));
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

  const connect = useCallback(
    async (withDrive = wantsDrive) => {
      if (!clientId) throw new YouTubeError("Add your OAuth Client ID in Settings → YouTube first.");
      setConnecting(true);
      setError(null);
      try {
        const scopes = withDrive ? [...YT_SCOPES, ...AUTOPILOT_SCOPES] : YT_SCOPES;
        const token = await requestToken(clientId, scopes, user.email ?? undefined);
        saveChannel(await getMyChannel(token));
        tick();
        return token;
      } catch (e) {
        setError((e as Error).message);
        tick();
        throw e;
      } finally {
        setConnecting(false);
      }
    },
    [clientId, user.email, saveChannel, wantsDrive, tick],
  );

  const ensureToken = useCallback(
    async (needDrive = false) => {
      const t = clientId ? getStoredToken(clientId) : null;
      if (t && (!needDrive || tokenHasScopes(clientId, AUTOPILOT_SCOPES))) return t;
      return connect(needDrive || wantsDrive);
    },
    [clientId, connect, wantsDrive],
  );

  const disconnect = useCallback(() => {
    if (clientId) revokeToken(clientId);
    saveChannel(null);
    tick();
  }, [clientId, saveChannel, tick]);

  const refreshChannel = useCallback(async () => {
    const t = clientId ? getStoredToken(clientId) : null;
    if (!t) return;
    try {
      saveChannel(await getMyChannel(t));
    } catch (e) {
      if (e instanceof YouTubeError && e.status === 401) {
        clearStoredToken(clientId);
        tick();
      }
    }
  }, [clientId, saveChannel, tick]);

  return (
    <YouTubeContext.Provider value={{ channel, connected, driveAllowed, connecting, error, connect, ensureToken, disconnect, refreshChannel }}>
      {children}
    </YouTubeContext.Provider>
  );
}

export function useYouTube() {
  const ctx = useContext(YouTubeContext);
  if (!ctx) throw new Error("useYouTube outside YouTubeProvider");
  return ctx;
}
