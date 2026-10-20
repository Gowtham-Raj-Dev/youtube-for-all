// A local estimate of YouTube API units used today. Google's quota day runs on Pacific time,
// so the counter resets at Pacific midnight. Only counts calls made from this browser.

import { useSyncExternalStore } from "react";

export const DAILY_QUOTA = 10_000;
export const UPLOAD_COST = 1600;

function pacificDay() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Los_Angeles" }).format(new Date());
}

const key = () => `yt_quota:${pacificDay()}`;
const listeners = new Set<() => void>();

export function getQuotaUsed(): number {
  try {
    return Number(localStorage.getItem(key()) ?? 0);
  } catch {
    return 0;
  }
}

export function addQuota(units: number) {
  try {
    localStorage.setItem(key(), String(getQuotaUsed() + units));
  } catch {
    /* storage blocked — the estimate just stays at 0 */
  }
  listeners.forEach((l) => l());
}

export function useQuotaUsed() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    getQuotaUsed,
  );
}

/** When the quota resets, shown in the viewer's local time. */
export function quotaResetLabel() {
  const now = new Date();
  const pt = new Date(now.toLocaleString("en-US", { timeZone: "America/Los_Angeles" }));
  const msToMidnight =
    (24 * 3600 - (pt.getHours() * 3600 + pt.getMinutes() * 60 + pt.getSeconds())) * 1000;
  return new Date(now.getTime() + msToMidnight).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}
