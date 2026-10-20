import type { Item } from "./items";

/** YouTube needs publishAt a little in the future; keep a margin for the upload itself. */
export const MIN_LEAD_MS = 15 * 60 * 1000;

export function slotDate(day: Date, hhmm: string) {
  const [h, m] = hhmm.split(":").map(Number);
  const d = new Date(day);
  d.setHours(h, m, 0, 0);
  return d;
}

export function sortSlots(slots: string[]) {
  return [...new Set(slots.filter((s) => /^\d{2}:\d{2}$/.test(s)))].sort();
}

/** Times already taken by scheduled or queued items (rounded to the minute). */
export function bookedTimes(items: Item[], exceptId?: string) {
  const s = new Set<number>();
  for (const it of items)
    if (it.id !== exceptId && it.publishAt && (it.status === "scheduled" || it.status === "queued" || it.status === "uploading"))
      s.add(Math.floor(it.publishAt / 60000));
  return s;
}

/** The next free daily slot after `after` (default: now + lead time), up to 90 days ahead. */
export function nextFreeSlot(slots: string[], items: Item[], after = Date.now() + MIN_LEAD_MS, taken = bookedTimes(items)) {
  const sorted = sortSlots(slots);
  if (!sorted.length) return null;
  const day = new Date(after);
  day.setHours(0, 0, 0, 0);
  for (let i = 0; i < 90; i++) {
    for (const s of sorted) {
      const t = slotDate(day, s).getTime();
      if (t >= after && !taken.has(Math.floor(t / 60000))) return t;
    }
    day.setDate(day.getDate() + 1);
  }
  return null;
}

/** `n` consecutive free slots — used by “Schedule all” in the queue. */
export function nextFreeSlots(slots: string[], items: Item[], n: number) {
  const taken = bookedTimes(items);
  const out: number[] = [];
  let after = Date.now() + MIN_LEAD_MS;
  for (let i = 0; i < n; i++) {
    const t = nextFreeSlot(slots, items, after, taken);
    if (t === null) break;
    out.push(t);
    taken.add(Math.floor(t / 60000));
    after = t + 60000;
  }
  return out;
}

// ---------- formatting ----------

export function toLocalInput(ms: number) {
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function fromLocalInput(v: string) {
  const t = new Date(v).getTime();
  return Number.isNaN(t) ? null : t;
}

export function fmtDateTime(ms: number) {
  return new Date(ms).toLocaleString([], { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
}

export function fmtTime(ms: number) {
  return new Date(ms).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

export function fmtSlot(hhmm: string) {
  return fmtTime(slotDate(new Date(), hhmm).getTime());
}

export function fmtRelative(ms: number) {
  const diff = ms - Date.now();
  const abs = Math.abs(diff);
  const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });
  if (abs < 3600_000) return rtf.format(Math.round(diff / 60_000), "minute");
  if (abs < 86400_000) return rtf.format(Math.round(diff / 3600_000), "hour");
  return rtf.format(Math.round(diff / 86400_000), "day");
}

export function fmtBytes(n: number) {
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  if (n < 1024 ** 3) return `${(n / 1024 ** 2).toFixed(1)} MB`;
  return `${(n / 1024 ** 3).toFixed(2)} GB`;
}

export function fmtCount(n: number) {
  return new Intl.NumberFormat(undefined, { notation: "compact", maximumFractionDigits: 1 }).format(n);
}

export const timeZoneName = Intl.DateTimeFormat().resolvedOptions().timeZone;
