import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { useUser } from "./auth";
import { useSettings } from "./settings";
import {
  clearStoredToken,
  getMyChannel,
  getStoredToken,
  requestToken,
  revokeToken,
  YouTubeError,
  type Channel,
} from "./youtube";

type YouTubeState = {
  /** Last known channel (cached, so the dashboard shows it even when the token has expired). */
  channel: Channel | null;
  connected: boolean;
  connecting: boolean;
  error: string | null;
  /** Interactive: may open Google's popup. Call from a click handler. */
  connect: () => Promise<string>;
  /** A valid token, connecting if needed. */
  ensureToken: () => Promise<string>;
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
  const [connected, setConnected] = useState(() => !!clientId && !!getStoredToken(clientId));
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Token expiry: re-check every 30 s so the UI flips to "Reconnect" on time.
  useEffect(() => {
    const tick = () => setConnected(!!clientId && !!getStoredToken(clientId));
    tick();
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, [clientId]);

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

  const connect = useCallback(async () => {
    if (!clientId) throw new YouTubeError("Add your OAuth Client ID in Settings → YouTube first.");
    setConnecting(true);
    setError(null);
    try {
      const token = await requestToken(clientId, user.email ?? undefined);
      saveChannel(await getMyChannel(token));
      setConnected(true);
      return token;
    } catch (e) {
      setError((e as Error).message);
      throw e;
    } finally {
      setConnecting(false);
    }
  }, [clientId, user.email, saveChannel]);

  const ensureToken = useCallback(async () => {
    const t = clientId ? getStoredToken(clientId) : null;
    return t ?? connect();
  }, [clientId, connect]);

  const disconnect = useCallback(() => {
    if (clientId) revokeToken(clientId);
    saveChannel(null);
    setConnected(false);
  }, [clientId, saveChannel]);

  const refreshChannel = useCallback(async () => {
    const t = clientId ? getStoredToken(clientId) : null;
    if (!t) return;
    try {
      saveChannel(await getMyChannel(t));
    } catch (e) {
      if (e instanceof YouTubeError && e.status === 401) {
        clearStoredToken(clientId);
        setConnected(false);
      }
    }
  }, [clientId, saveChannel]);

  return (
    <YouTubeContext.Provider
      value={{ channel, connected, connecting, error, connect, ensureToken, disconnect, refreshChannel }}
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
