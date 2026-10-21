// Autopilot = a Drive folder (video files) + a Google Sheet (job list) + an Apps Script bound to
// that sheet which runs every 30 minutes on Google's servers and uploads due videos to YouTube.
// All three live in the user's own Google account and are created/updated by this app.

import codeTemplate from "./autopilot/Code.gs.txt?raw";
import manifestTemplate from "./autopilot/appsscript.json.txt?raw";
import {
  createFolder,
  createScriptDeployment,
  createScriptProject,
  createScriptVersion,
  createSpreadsheet,
  getDriveFile,
  getScriptProject,
  sheetAppend,
  sheetBatchUpdate,
  sheetGet,
  sheetUpdate,
  updateScriptContent,
  updateScriptDeployment,
} from "./google";
import type { Item, ItemStatus } from "./items";

/** Bump when Code.gs.txt or the manifest changes; the app then offers “Update Autopilot”. */
export const SCRIPT_VERSION = 2;
export const DAILY_LIMIT = 6;

export type AutopilotConfig = {
  folderId: string;
  sheetId: string;
  scriptId: string;
  deploymentId: string;
  webAppUrl: string;
  version: number;
};

export const ENABLE_APIS_URL =
  "https://console.cloud.google.com/flows/enableapi?apiid=youtube.googleapis.com,drive.googleapis.com,sheets.googleapis.com,script.googleapis.com";
export const SCRIPT_SETTINGS_URL = "https://script.google.com/home/usersettings";

const COLS = ["id", "kind", "title", "description", "tags", "categoryId", "privacy", "madeForKids", "notify",
  "publishAt", "fileId", "thumbId", "status", "youtubeId", "error", "updatedAt", "session", "offset"] as const;
const LAST_COL = "R"; // 18 columns
const QUEUE_GID = 0;

export type QueueRow = Record<(typeof COLS)[number], string>;

export function isReady(c: Partial<AutopilotConfig> | null | undefined): c is AutopilotConfig {
  return !!(c && c.folderId && c.sheetId && c.scriptId && c.deploymentId && c.webAppUrl);
}

// ---------- Setup & deploy ----------

/**
 * Creates (or finishes creating) the folder, sheet and script. `save` is called after every step
 * so a failure halfway (e.g. Apps Script API off) can be retried without making duplicates.
 */
export async function setupAutopilot(
  token: string,
  existing: Partial<AutopilotConfig> | null,
  keepFiles: boolean,
  save: (c: Partial<AutopilotConfig>) => Promise<void>,
  onStep: (s: string) => void,
): Promise<AutopilotConfig> {
  const c: Partial<AutopilotConfig> = { ...(existing ?? {}) };

  if (c.folderId) {
    const f = await getDriveFile(token, c.folderId).catch(() => null);
    if (!f || f.trashed) Object.assign(c, { folderId: "", sheetId: "", scriptId: "", deploymentId: "", webAppUrl: "" });
  }
  if (!c.folderId) {
    onStep("Creating your Drive folder…");
    c.folderId = await createFolder(token, "UTubeFlow Autopilot");
    await save(c);
  }
  if (!c.sheetId) {
    onStep("Creating the queue sheet…");
    c.sheetId = await createSpreadsheet(token, c.folderId, "UTubeFlow Autopilot data — managed by the app, do not edit");
    await sheetBatchUpdate(token, c.sheetId, [
      { updateSheetProperties: { properties: { sheetId: QUEUE_GID, title: "queue", gridProperties: { frozenRowCount: 1 } }, fields: "title,gridProperties.frozenRowCount" } },
      { addSheet: { properties: { title: "status" } } },
    ]);
    await sheetUpdate(token, c.sheetId, `queue!A1:${LAST_COL}1`, [[...COLS]]);
    await save(c);
  }
  if (!c.scriptId) {
    onStep("Installing the Autopilot script…");
    c.scriptId = await createScriptProject(token, "UTubeFlow Autopilot", c.sheetId);
    await save(c);
  }
  onStep("Deploying…");
  const deployed = await deployScript(token, c as AutopilotConfig, keepFiles);
  Object.assign(c, deployed);
  await save(c);
  return c as AutopilotConfig;
}

export async function deployScript(token: string, c: Pick<AutopilotConfig, "sheetId" | "scriptId"> & Partial<AutopilotConfig>, keepFiles: boolean) {
  const code = codeTemplate
    .replace("__SHEET_ID__", c.sheetId)
    .replace("__VERSION__", String(SCRIPT_VERSION))
    .replace("__KEEP_FILES__", String(keepFiles))
    .replace("__DAILY_LIMIT__", String(DAILY_LIMIT));
  const manifest = manifestTemplate.replace("__TZ__", Intl.DateTimeFormat().resolvedOptions().timeZone);
  await updateScriptContent(token, c.scriptId, [
    { name: "appsscript", type: "JSON", source: manifest },
    { name: "Code", type: "SERVER_JS", source: code },
  ]);
  const v = await createScriptVersion(token, c.scriptId, `UTubeFlow Autopilot v${SCRIPT_VERSION}`);
  const d = c.deploymentId
    ? await updateScriptDeployment(token, c.scriptId, c.deploymentId, v, `UTubeFlow Autopilot v${SCRIPT_VERSION}`)
    : await createScriptDeployment(token, c.scriptId, v, `UTubeFlow Autopilot v${SCRIPT_VERSION}`);
  return { deploymentId: d.deploymentId, webAppUrl: d.url, version: SCRIPT_VERSION };
}

/** Opens the script's web app in a new tab: setup (activate), run (run now) or stop (pause). */
export function openWebApp(c: AutopilotConfig, action: "setup" | "run" | "stop") {
  window.open(`${c.webAppUrl}?action=${action}`, "_blank", "noopener");
}

// ---------- Queue rows ----------

export function itemToRow(item: Item): string[] {
  const row: QueueRow = {
    id: item.id,
    kind: item.kind,
    title: item.title,
    description: item.description,
    tags: item.tags.join(","),
    categoryId: item.categoryId,
    privacy: item.privacy,
    madeForKids: item.madeForKids ? "yes" : "no",
    notify: item.notifySubscribers ? "yes" : "no",
    publishAt: item.publishAt ? new Date(item.publishAt).toISOString() : "",
    fileId: item.file?.path ?? "",
    thumbId: item.thumb?.path ?? "",
    status: item.status === "failed" ? "queued" : item.status,
    youtubeId: item.youtubeId ?? "",
    error: "",
    updatedAt: new Date().toISOString(),
    session: "",
    offset: "",
  };
  return COLS.map((k) => row[k]);
}

export async function readQueue(token: string, c: AutopilotConfig): Promise<QueueRow[]> {
  const values = await sheetGet(token, c.sheetId, `queue!A2:${LAST_COL}`);
  return values
    .filter((v) => v[0])
    .map((v) => Object.fromEntries(COLS.map((k, i) => [k, v[i] ?? ""])) as QueueRow);
}

async function findRow(token: string, c: AutopilotConfig, id: string) {
  const ids = await sheetGet(token, c.sheetId, "queue!A:A");
  const i = ids.findIndex((r) => r[0] === id);
  return i < 1 ? -1 : i + 1; // 1-based sheet row; row 1 is the header
}

export async function addQueueRow(token: string, c: AutopilotConfig, item: Item) {
  await sheetAppend(token, c.sheetId, `queue!A1:${LAST_COL}1`, [itemToRow(item)]);
}

/** Rewrites the editable fields of a queued row (keeps session/offset of the script). */
export async function updateQueueRow(token: string, c: AutopilotConfig, item: Item) {
  const n = await findRow(token, c, item.id);
  if (n < 0) return addQueueRow(token, c, item);
  const row = itemToRow(item).slice(0, COLS.indexOf("updatedAt") + 1);
  await sheetUpdate(token, c.sheetId, `queue!A${n}:${String.fromCharCode(64 + row.length)}${n}`, [row]);
}

export async function setRowStatus(token: string, c: AutopilotConfig, id: string, status: ItemStatus, youtubeId = "", error = "") {
  const n = await findRow(token, c, id);
  if (n < 0) return;
  await sheetUpdate(token, c.sheetId, `queue!M${n}:P${n}`, [[status, youtubeId, error, new Date().toISOString()]]);
}

export async function deleteQueueRow(token: string, c: AutopilotConfig, id: string) {
  const n = await findRow(token, c, id);
  if (n < 0) return;
  await sheetBatchUpdate(token, c.sheetId, [
    { deleteDimension: { range: { sheetId: QUEUE_GID, dimension: "ROWS", startIndex: n - 1, endIndex: n } } },
  ]);
}

export type AutopilotStatus = {
  version?: string;
  trigger?: string;
  channel?: string;
  lastRun?: string;
  lastResult?: string;
  lastCheck?: string;
};

export async function readStatus(token: string, c: AutopilotConfig): Promise<AutopilotStatus> {
  const values = await sheetGet(token, c.sheetId, "status!A1:B30");
  return Object.fromEntries(values.filter((r) => r[0]).map((r) => [r[0], r[1] ?? ""]));
}

/** The script stores times as epoch ms. */
export function statusTime(v: string | undefined) {
  if (!v) return null;
  const n = /^\d+$/.test(v) ? Number(v) : Date.parse(v);
  return Number.isFinite(n) ? n : null;
}

/** Is the 30-minute trigger alive? (allow one missed run) */
export function isRunning(s: AutopilotStatus | null) {
  if (!s || s.trigger !== "on") return false;
  const last = statusTime(s.lastRun) ?? statusTime(s.lastCheck);
  return last !== null && Date.now() - last < 70 * 60_000;
}

// ---------- Connection check ----------

export type Check = { key: string; label: string; state: "ok" | "warn" | "error"; detail: string };

export async function checkAutopilot(token: string, c: AutopilotConfig): Promise<{ checks: Check[]; status: AutopilotStatus | null }> {
  const checks: Check[] = [];
  const add = (key: string, label: string, state: Check["state"], detail: string) => checks.push({ key, label, state, detail });

  try {
    const f = await getDriveFile(token, c.folderId);
    add("folder", "Drive folder", f.trashed ? "error" : "ok", f.trashed ? "The folder is in Drive's trash — restore it or set up again." : "Video files are saved here.");
  } catch (e) {
    add("folder", "Drive folder", "error", (e as Error).message);
  }

  let status: AutopilotStatus | null = null;
  try {
    status = await readStatus(token, c);
    add("sheet", "Queue sheet", "ok", "Reads and writes work.");
  } catch (e) {
    add("sheet", "Queue sheet", "error", (e as Error).message);
  }

  try {
    await getScriptProject(token, c.scriptId);
    add("script", "Autopilot script", "ok", `Installed (v${c.version}).`);
  } catch (e) {
    add("script", "Autopilot script", "error", (e as Error).message);
  }

  if (status) {
    if (!status.lastCheck && !status.lastRun) add("active", "Activated", "error", "Not activated yet — click “Activate Autopilot” and allow access.");
    else if (status.trigger !== "on") add("active", "Activated", "error", "Autopilot is paused — click “Activate Autopilot”.");
    else if (!isRunning(status)) add("active", "Activated", "warn", "No run in the last hour. Click “Activate Autopilot” again to restart it.");
    else {
      const last = statusTime(status.lastRun) ?? statusTime(status.lastCheck)!;
      add("active", "Activated", "ok", `Runs every 30 min · last run ${new Date(last).toLocaleString()}${status.lastResult ? ` · ${status.lastResult}` : ""}`);
    }

    if (status.channel) add("channel", "YouTube from Autopilot", "ok", `Uploads go to “${status.channel}”.`);
    else if (status.lastCheck) add("channel", "YouTube from Autopilot", "error", "Autopilot could not see a YouTube channel. Activate again with the account that owns the channel.");

    if (Number(status.version || 0) < SCRIPT_VERSION) add("version", "Script version", "warn", "An update is available — click “Update Autopilot”.");
  }
  return { checks, status };
}
