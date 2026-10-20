// Drive, Sheets and Apps Script REST calls used by Autopilot. All run with the user's own token
// and only touch files this app created (drive.file scope).

import { parseError, chunkError, YouTubeError } from "./youtube";
import { sendResumable } from "./resumable";

const DRIVE = "https://www.googleapis.com/drive/v3";
const DRIVE_UP = "https://www.googleapis.com/upload/drive/v3";
const SHEETS = "https://sheets.googleapis.com/v4/spreadsheets";
const SCRIPT = "https://script.googleapis.com/v1";

async function call<T>(token: string, url: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(init.body && typeof init.body === "string" ? { "Content-Type": "application/json; charset=UTF-8" } : {}),
      ...(init.headers ?? {}),
    },
  });
  if (!res.ok) throw await parseError(res);
  const text = await res.text();
  return (text ? JSON.parse(text) : {}) as T;
}

// ---------- Drive ----------

export async function createFolder(token: string, name: string): Promise<string> {
  const r = await call<{ id: string }>(token, `${DRIVE}/files?fields=id`, {
    method: "POST",
    body: JSON.stringify({ name, mimeType: "application/vnd.google-apps.folder" }),
  });
  return r.id;
}

export async function getDriveFile(token: string, id: string) {
  return call<{ id: string; name: string; trashed: boolean }>(token, `${DRIVE}/files/${id}?fields=id,name,trashed`);
}

export async function trashDriveFile(token: string, id: string) {
  await call(token, `${DRIVE}/files/${id}`, { method: "PATCH", body: JSON.stringify({ trashed: true }) }).catch(() => {});
}

/** Resumable upload into `folderId`. Returns the Drive file id. */
export async function uploadToDrive(
  token: string,
  folderId: string,
  file: Blob,
  name: string,
  onProgress: (f: number) => void,
  signal?: AbortSignal,
): Promise<string> {
  const type = file.type || "application/octet-stream";
  const init = await fetch(`${DRIVE_UP}/files?uploadType=resumable&fields=id`, {
    method: "POST",
    signal,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json; charset=UTF-8",
      "X-Upload-Content-Type": type,
      "X-Upload-Content-Length": String(file.size),
    },
    body: JSON.stringify({ name, parents: [folderId] }),
  });
  if (!init.ok) throw await parseError(init);
  const location = init.headers.get("Location");
  if (!location) throw new YouTubeError("Google Drive did not return an upload address. Try again.");
  const text = await sendResumable(location, token, file, type, onProgress, chunkError, signal);
  return JSON.parse(text).id as string;
}

export async function downloadFromDrive(token: string, id: string): Promise<Blob> {
  const res = await fetch(`${DRIVE}/files/${id}?alt=media`, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw await parseError(res);
  return res.blob();
}

// ---------- Sheets ----------

export async function createSpreadsheet(token: string, folderId: string, name: string): Promise<string> {
  const r = await call<{ id: string }>(token, `${DRIVE}/files?fields=id`, {
    method: "POST",
    body: JSON.stringify({ name, parents: [folderId], mimeType: "application/vnd.google-apps.spreadsheet" }),
  });
  return r.id;
}

export function sheetBatchUpdate(token: string, id: string, requests: unknown[]) {
  return call(token, `${SHEETS}/${id}:batchUpdate`, { method: "POST", body: JSON.stringify({ requests }) });
}

export async function sheetGet(token: string, id: string, range: string): Promise<string[][]> {
  const r = await call<{ values?: string[][] }>(
    token,
    `${SHEETS}/${id}/values/${encodeURIComponent(range)}?valueRenderOption=UNFORMATTED_VALUE`,
  );
  return (r.values ?? []).map((row) => row.map((v) => (v == null ? "" : String(v))));
}

export function sheetUpdate(token: string, id: string, range: string, values: (string | number)[][]) {
  return call(token, `${SHEETS}/${id}/values/${encodeURIComponent(range)}?valueInputOption=RAW`, {
    method: "PUT",
    body: JSON.stringify({ range, values }),
  });
}

export function sheetAppend(token: string, id: string, range: string, values: (string | number)[][]) {
  return call(
    token,
    `${SHEETS}/${id}/values/${encodeURIComponent(range)}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`,
    { method: "POST", body: JSON.stringify({ values }) },
  );
}

// ---------- Apps Script ----------

export type ScriptFile = { name: string; type: "SERVER_JS" | "JSON"; source: string };

export async function createScriptProject(token: string, title: string, parentId: string): Promise<string> {
  const r = await call<{ scriptId: string }>(token, `${SCRIPT}/projects`, {
    method: "POST",
    body: JSON.stringify({ title, parentId }),
  });
  return r.scriptId;
}

export function getScriptProject(token: string, scriptId: string) {
  return call<{ scriptId: string; title: string }>(token, `${SCRIPT}/projects/${scriptId}`);
}

export function updateScriptContent(token: string, scriptId: string, files: ScriptFile[]) {
  return call(token, `${SCRIPT}/projects/${scriptId}/content`, { method: "PUT", body: JSON.stringify({ files }) });
}

export async function createScriptVersion(token: string, scriptId: string, description: string): Promise<number> {
  const r = await call<{ versionNumber: number }>(token, `${SCRIPT}/projects/${scriptId}/versions`, {
    method: "POST",
    body: JSON.stringify({ description }),
  });
  return r.versionNumber;
}

type Deployment = { deploymentId: string; entryPoints?: { entryPointType: string; webApp?: { url: string } }[] };

function webAppUrl(d: Deployment) {
  const url = d.entryPoints?.find((e) => e.entryPointType === "WEB_APP")?.webApp?.url;
  if (!url) throw new YouTubeError("Apps Script did not return a web app address.");
  return url;
}

export async function createScriptDeployment(token: string, scriptId: string, versionNumber: number, description: string) {
  const d = await call<Deployment>(token, `${SCRIPT}/projects/${scriptId}/deployments`, {
    method: "POST",
    body: JSON.stringify({ versionNumber, manifestFileName: "appsscript", description }),
  });
  return { deploymentId: d.deploymentId, url: webAppUrl(d) };
}

export async function updateScriptDeployment(token: string, scriptId: string, deploymentId: string, versionNumber: number, description: string) {
  const d = await call<Deployment>(token, `${SCRIPT}/projects/${scriptId}/deployments/${deploymentId}`, {
    method: "PUT",
    body: JSON.stringify({ deploymentConfig: { versionNumber, manifestFileName: "appsscript", description } }),
  });
  return { deploymentId: d.deploymentId, url: webAppUrl(d) };
}
