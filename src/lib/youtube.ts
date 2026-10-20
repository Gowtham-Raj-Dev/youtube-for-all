// YouTube Data API v3 straight from the browser, with the user's own OAuth Client ID.
// Tokens come from Google Identity Services (token model): no client secret, no server,
// valid for ~1 hour and kept only in this tab's sessionStorage.

import type { Privacy } from "./settings";
import { addQuota } from "./quota";
import { sendResumable } from "./resumable";

export const YT_SCOPES = [
  "https://www.googleapis.com/auth/youtube.upload",
  "https://www.googleapis.com/auth/youtube.readonly",
];
/** Extra scopes for Autopilot: files this app creates in Drive, and installing the Apps Script. */
export const AUTOPILOT_SCOPES = [
  "https://www.googleapis.com/auth/drive.file",
  "https://www.googleapis.com/auth/script.projects",
  "https://www.googleapis.com/auth/script.deployments",
];

const API = "https://www.googleapis.com/youtube/v3";
const UPLOAD_API = "https://www.googleapis.com/upload/youtube/v3";

type TokenResponse = { access_token?: string; expires_in?: number; scope?: string; error?: string; error_description?: string };
type TokenClient = { requestAccessToken: (o?: { prompt?: string; login_hint?: string }) => void };
declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient: (cfg: {
            client_id: string;
            scope: string;
            include_granted_scopes?: boolean;
            callback: (r: TokenResponse) => void;
            error_callback?: (e: { type: string; message?: string }) => void;
          }) => TokenClient;
          revoke: (token: string, done?: () => void) => void;
        };
      };
    };
  }
}

export class YouTubeError extends Error {
  constructor(
    message: string,
    public status = 0,
    public reason = "",
  ) {
    super(message);
  }
}

// ---------- Token ----------

type StoredToken = { token: string; exp: number; scope: string };
const tokenKey = (clientId: string) => `yt_token:${clientId}`;

function readToken(clientId: string): StoredToken | null {
  try {
    const raw = sessionStorage.getItem(tokenKey(clientId));
    if (!raw) return null;
    const t = JSON.parse(raw) as StoredToken;
    // Keep a 2-minute margin so a request never starts with an about-to-expire token.
    return t.exp - Date.now() > 120_000 ? t : null;
  } catch {
    return null;
  }
}

export const getStoredToken = (clientId: string) => readToken(clientId)?.token ?? null;

/** True when the current token includes every scope in `scopes`. */
export function tokenHasScopes(clientId: string, scopes: string[]) {
  const granted = (readToken(clientId)?.scope ?? "").split(" ");
  return scopes.every((s) => granted.includes(s));
}

export function clearStoredToken(clientId: string) {
  try {
    sessionStorage.removeItem(tokenKey(clientId));
  } catch {
    /* ignore */
  }
}

async function waitForGis(): Promise<NonNullable<Window["google"]>> {
  for (let i = 0; i < 100; i++) {
    if (window.google?.accounts?.oauth2) return window.google;
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new YouTubeError("Google sign-in script did not load. Check your internet or ad-blocker and reload.");
}

export function isValidClientId(id: string) {
  return /^[0-9]+-[a-z0-9]+\.apps\.googleusercontent\.com$/.test(id.trim());
}

/** Opens Google's consent popup (or reuses the grant silently) and returns an access token. */
export async function requestToken(clientId: string, scopes: string[], loginHint?: string): Promise<string> {
  if (!isValidClientId(clientId)) throw new YouTubeError("The OAuth Client ID looks wrong. It should end with .apps.googleusercontent.com");
  const google = await waitForGis();
  return new Promise((resolve, reject) => {
    const client = google.accounts.oauth2.initTokenClient({
      client_id: clientId.trim(),
      scope: scopes.join(" "),
      include_granted_scopes: true,
      callback: (r) => {
        if (r.error || !r.access_token) {
          reject(new YouTubeError(r.error_description || r.error || "Google did not return a token."));
          return;
        }
        const granted = (r.scope ?? "").split(" ");
        const missing = scopes.filter((s) => !granted.includes(s));
        try {
          sessionStorage.setItem(
            tokenKey(clientId),
            JSON.stringify({ token: r.access_token, exp: Date.now() + (r.expires_in ?? 3599) * 1000, scope: r.scope ?? "" }),
          );
        } catch {
          /* private mode: token still works for this call */
        }
        if (missing.length) {
          reject(new YouTubeError("Some permissions were not allowed. Click connect again and tick every box on Google's screen.", 0, "scopesMissing"));
          return;
        }
        resolve(r.access_token);
      },
      error_callback: (e) =>
        reject(
          new YouTubeError(
            e.type === "popup_closed"
              ? "The Google window was closed before finishing."
              : e.type === "popup_failed_to_open"
                ? "The browser blocked the Google popup. Allow popups for this site and try again."
                : e.message || "Google sign-in failed.",
          ),
        ),
    });
    client.requestAccessToken({ prompt: "", login_hint: loginHint });
  });
}

export function revokeToken(clientId: string) {
  const token = getStoredToken(clientId);
  clearStoredToken(clientId);
  if (token) window.google?.accounts.oauth2.revoke(token);
}

// ---------- Errors ----------

export async function parseError(res: Response): Promise<YouTubeError> {
  let message = `Google API error ${res.status}`;
  let reason = "";
  try {
    const body = await res.json();
    reason = body?.error?.errors?.[0]?.reason ?? body?.error?.status ?? "";
    message = body?.error?.message ?? message;
  } catch {
    /* not JSON */
  }
  return friendlyError(res.status, reason, message);
}

const ENABLE_APIS = "https://console.cloud.google.com/flows/enableapi?apiid=youtube.googleapis.com,drive.googleapis.com,sheets.googleapis.com,script.googleapis.com";

export function friendlyError(status: number, reason: string, message: string) {
  if (reason === "quotaExceeded" || reason === "dailyLimitExceeded")
    return new YouTubeError("Your YouTube API daily quota is used up. It resets at midnight Pacific time (12:30–1:30 PM IST).", status, reason);
  if (reason === "uploadLimitExceeded")
    return new YouTubeError("YouTube's daily upload limit for this channel is reached. Try again tomorrow.", status, reason);
  if (reason === "youtubeSignupRequired")
    return new YouTubeError("This Google account has no YouTube channel yet. Create one on youtube.com first.", status, reason);
  if (/User has not enabled the Apps Script API/i.test(message))
    return new YouTubeError("Apps Script API is off in your Google account. Turn it on at script.google.com/home/usersettings, wait 1 minute, then try again.", status, "scriptApiOff");
  if (reason === "accessNotConfigured" || reason === "SERVICE_DISABLED" || /has not been used in project|is disabled/i.test(message)) {
    const api = /drive/i.test(message) ? "Google Drive API" : /sheets/i.test(message) ? "Google Sheets API" : /script/i.test(message) ? "Apps Script API" : "YouTube Data API v3";
    return new YouTubeError(`${api} is not enabled in your Google Cloud project. Enable it (Settings → Autopilot, step 1: ${ENABLE_APIS}) and wait 2 minutes.`, status, "apiDisabled");
  }
  if (status === 401) return new YouTubeError("Your Google session expired. Click “Connect” again.", status, "authExpired");
  if (status === 403 && /insufficient|scope/i.test(message))
    return new YouTubeError("Google Drive permission is missing. Click “Allow Google Drive” in Settings and tick every box.", status, "scopesMissing");
  return new YouTubeError(message.replace(/<[^>]+>/g, ""), status, reason);
}

// ---------- Plain API calls ----------

async function get<T>(token: string, path: string, params: Record<string, string>, units = 1): Promise<T> {
  const res = await fetch(`${API}/${path}?${new URLSearchParams(params)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw await parseError(res);
  addQuota(units);
  return res.json();
}

export type Channel = {
  id: string;
  title: string;
  handle: string;
  thumbnail: string;
  subscribers: number | null;
  views: number;
  videos: number;
  uploadsPlaylist: string;
};

export async function getMyChannel(token: string): Promise<Channel> {
  const r = await get<{ items?: any[] }>(token, "channels", {
    part: "snippet,statistics,contentDetails",
    mine: "true",
  });
  const c = r.items?.[0];
  if (!c) throw new YouTubeError("This Google account has no YouTube channel. Create one on youtube.com, then connect again.");
  return {
    id: c.id,
    title: c.snippet.title,
    handle: c.snippet.customUrl ?? "",
    thumbnail: c.snippet.thumbnails?.default?.url ?? "",
    subscribers: c.statistics.hiddenSubscriberCount ? null : Number(c.statistics.subscriberCount ?? 0),
    views: Number(c.statistics.viewCount ?? 0),
    videos: Number(c.statistics.videoCount ?? 0),
    uploadsPlaylist: c.contentDetails?.relatedPlaylists?.uploads ?? "",
  };
}

export type VideoStatus = {
  id: string;
  privacy: Privacy;
  publishAt: string | null;
  uploadStatus: string;
  failureReason: string | null;
  rejectionReason: string | null;
  views: number;
};

/** Current state on YouTube for up to 50 ids per call (1 unit per call). */
export async function getVideoStatuses(token: string, ids: string[]): Promise<VideoStatus[]> {
  const out: VideoStatus[] = [];
  for (let i = 0; i < ids.length; i += 50) {
    const r = await get<{ items?: any[] }>(token, "videos", {
      part: "status,statistics",
      id: ids.slice(i, i + 50).join(","),
    });
    for (const v of r.items ?? [])
      out.push({
        id: v.id,
        privacy: v.status.privacyStatus,
        publishAt: v.status.publishAt ?? null,
        uploadStatus: v.status.uploadStatus,
        failureReason: v.status.failureReason ?? null,
        rejectionReason: v.status.rejectionReason ?? null,
        views: Number(v.statistics?.viewCount ?? 0),
      });
  }
  return out;
}

export type RecentUpload = { id: string; title: string; thumbnail: string; publishedAt: string; privacy: string };

export async function getRecentUploads(token: string, uploadsPlaylist: string, max = 8): Promise<RecentUpload[]> {
  if (!uploadsPlaylist) return [];
  const r = await get<{ items?: any[] }>(token, "playlistItems", {
    part: "snippet,status",
    playlistId: uploadsPlaylist,
    maxResults: String(max),
  });
  return (r.items ?? []).map((p) => ({
    id: p.snippet.resourceId.videoId,
    title: p.snippet.title,
    thumbnail: p.snippet.thumbnails?.medium?.url ?? p.snippet.thumbnails?.default?.url ?? "",
    publishedAt: p.snippet.publishedAt,
    privacy: p.status?.privacyStatus ?? "",
  }));
}

// ---------- Upload ----------

export type UploadMeta = {
  title: string;
  description: string;
  tags: string[];
  categoryId: string;
  privacy: Privacy;
  madeForKids: boolean;
  notifySubscribers: boolean;
  /** When set, the video is uploaded private and YouTube publishes it at this time. */
  publishAt: number | null;
};

/** videos.insert (1600 units) via a resumable session. Returns the new video id. */
export async function uploadVideo(
  token: string,
  file: Blob,
  meta: UploadMeta,
  onProgress: (fraction: number) => void,
  signal?: AbortSignal,
): Promise<string> {
  const scheduled = meta.publishAt !== null && meta.publishAt > Date.now();
  const body = {
    snippet: { title: meta.title, description: meta.description, tags: meta.tags, categoryId: meta.categoryId },
    status: {
      privacyStatus: scheduled ? "private" : meta.privacy,
      ...(scheduled ? { publishAt: new Date(meta.publishAt!).toISOString() } : {}),
      selfDeclaredMadeForKids: meta.madeForKids,
      embeddable: true,
    },
  };
  const type = file.type || "video/*";
  const init = await fetch(
    `${UPLOAD_API}/videos?${new URLSearchParams({ uploadType: "resumable", part: "snippet,status", notifySubscribers: String(meta.notifySubscribers) })}`,
    {
      method: "POST",
      signal,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json; charset=UTF-8",
        "X-Upload-Content-Type": type,
        "X-Upload-Content-Length": String(file.size),
      },
      body: JSON.stringify(body),
    },
  );
  if (!init.ok) throw await parseError(init);
  const location = init.headers.get("Location");
  if (!location) throw new YouTubeError("YouTube did not return an upload address. Try again.");
  addQuota(1600);

  const text = await sendResumable(location, token, file, type, onProgress, chunkError, signal);
  return JSON.parse(text).id as string;
}

export function chunkError(res: { status: number; body: string }) {
  let reason = "";
  let message = `Upload failed (${res.status})`;
  try {
    const j = JSON.parse(res.body);
    reason = j?.error?.errors?.[0]?.reason ?? "";
    message = j?.error?.message ?? message;
  } catch {
    /* ignore */
  }
  return friendlyError(res.status, reason, message);
}

/** thumbnails.set (50 units). Needs a phone-verified channel; JPG/PNG under 2 MB. */
export async function setThumbnail(token: string, videoId: string, image: Blob) {
  const res = await fetch(`${UPLOAD_API}/thumbnails/set?${new URLSearchParams({ videoId, uploadType: "media" })}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": image.type || "image/jpeg" },
    body: image,
  });
  if (!res.ok) throw await parseError(res);
  addQuota(50);
}
