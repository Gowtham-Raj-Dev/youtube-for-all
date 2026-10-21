// Community chat, online presence and private admin threads (all in the owner's Firestore).
// Rules: firestore.rules. Attachments are stored inline as data: URLs, so they stay small.
import { useEffect, useState } from "react";
import type { User } from "firebase/auth";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getCountFromServer,
  getDocs,
  increment,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
  type DocumentData,
  type QueryDocumentSnapshot,
} from "firebase/firestore";
import { db } from "./firebase";

export const ADMIN_EMAIL = "codelove.in@gmail.com";
export const isAdminUser = (u: Pick<User, "email" | "emailVerified"> | null | undefined) => !!u && u.email === ADMIN_EMAIL && u.emailVerified;

/** Community messages disappear after this long. */
export const CHAT_TTL_MS = 3 * 3600_000;
/** Someone counts as online if their tab checked in within this window. */
export const ONLINE_MS = 150_000;
const HEARTBEAT_MS = 60_000;

const ms = (v: unknown) => (v instanceof Timestamp ? v.toMillis() : null);

// ---------- Presence ----------

export type Presence = { uid: string; name: string; photo: string; channel: string | null; lastSeen: number };

/** Keeps presence/{uid} fresh while this tab is visible. */
export function usePresenceHeartbeat(user: User, channel: string | null) {
  useEffect(() => {
    const ref = doc(db, "presence", user.uid);
    const beat = () => {
      if (document.visibilityState !== "visible") return;
      setDoc(ref, { name: user.displayName ?? user.email?.split("@")[0] ?? "Creator", photo: user.photoURL ?? "", channel, lastSeen: serverTimestamp() }).catch(() => {});
    };
    beat();
    const id = setInterval(beat, HEARTBEAT_MS);
    document.addEventListener("visibilitychange", beat);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", beat);
    };
  }, [user.uid, user.displayName, user.email, user.photoURL, channel]);
}

/** A clock that ticks every `every` ms, for "online" / "expires in" checks. */
export function useNow(every = 30_000) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), every);
    return () => clearInterval(id);
  }, [every]);
  return now;
}

/** Everyone whose tab checked in recently, newest first. */
export function useOnline() {
  const [list, setList] = useState<Presence[]>([]);
  const [anchor, setAnchor] = useState(() => Date.now());
  // Re-anchor the query every 5 minutes so it doesn't keep matching people who left long ago.
  useEffect(() => {
    const id = setInterval(() => setAnchor(Date.now()), 5 * 60_000);
    return () => clearInterval(id);
  }, []);
  useEffect(
    () =>
      onSnapshot(
        query(collection(db, "presence"), where("lastSeen", ">", Timestamp.fromMillis(anchor - 10 * 60_000)), orderBy("lastSeen", "desc"), limit(300)),
        (snap) =>
          setList(
            snap.docs.map((d) => {
              const x = d.data({ serverTimestamps: "estimate" });
              return { uid: d.id, name: x.name, photo: x.photo, channel: x.channel ?? null, lastSeen: ms(x.lastSeen) ?? Date.now() };
            }),
          ),
        () => setList([]),
      ),
    [anchor],
  );
  const now = useNow();
  return list.filter((p) => now - p.lastSeen < ONLINE_MS);
}

export async function clearPresence(uid: string) {
  await deleteDoc(doc(db, "presence", uid)).catch(() => {});
}

// ---------- Attachments ----------

export type Attachment = { name: string; type: string; size: number; data: string; w?: number; h?: number };

const MAX_DATA = 900_000; // characters of data: URL (Firestore's 1 MiB document cap, minus the rest)
export const MAX_FILE_BYTES = 650_000;

function readAsDataURL(file: Blob) {
  return new Promise<string>((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result as string);
    r.onerror = () => rej(r.error);
    r.readAsDataURL(file);
  });
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((res, rej) => {
    const img = new Image();
    img.onload = () => res(img);
    img.onerror = () => rej(new Error("Could not read this image."));
    img.src = src;
  });
}

/** Images (screenshots…) are scaled down and re-encoded to fit; other files must be under ~650 KB. */
export async function toAttachment(file: File): Promise<Attachment> {
  const name = file.name || "screenshot.png";
  if (file.type.startsWith("image/") && file.type !== "image/gif" && file.type !== "image/svg+xml") {
    const src = await readAsDataURL(file);
    const img = await loadImage(src);
    for (const [maxSide, quality] of [[1920, 0.85], [1600, 0.8], [1280, 0.75], [1024, 0.7], [800, 0.65]] as const) {
      const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      canvas.getContext("2d")!.drawImage(img, 0, 0, w, h);
      const data = canvas.toDataURL("image/webp", quality);
      const type = data.startsWith("data:image/webp") ? "image/webp" : "image/png";
      if (data.length < MAX_DATA) return { name: name.replace(/\.\w+$/, "") + (type === "image/webp" ? ".webp" : ".png"), type, size: Math.round(data.length * 0.75), data, w, h };
    }
    throw new Error("This image is too large to send.");
  }
  if (file.size > MAX_FILE_BYTES) throw new Error(`Files can be up to ${Math.round(MAX_FILE_BYTES / 1000)} KB (images are shrunk automatically).`);
  return { name, type: file.type || "application/octet-stream", size: file.size, data: await readAsDataURL(file) };
}

// ---------- Messages ----------

export type Message = {
  id: string;
  uid: string;
  name: string;
  photo: string;
  channel: string | null;
  admin: boolean;
  text: string;
  file: Attachment | null;
  /** ms; an estimate while the server timestamp is pending. */
  createdAt: number;
  pending: boolean;
};

/** Community messages carry the sender uid; thread messages only "user" | "admin" (used as their id). */
function toMessage(d: QueryDocumentSnapshot<DocumentData>): Message {
  const x = d.data({ serverTimestamps: "estimate" });
  return {
    id: d.id,
    uid: x.uid ?? x.from ?? "",
    name: x.name ?? "",
    photo: x.photo ?? "",
    channel: x.channel ?? null,
    admin: x.admin ?? x.from === "admin",
    text: x.text ?? "",
    file: x.file ?? null,
    createdAt: ms(x.createdAt) ?? Date.now(),
    pending: d.metadata.hasPendingWrites,
  };
}

const profile = (user: User) => ({ name: user.displayName ?? user.email?.split("@")[0] ?? "Creator", photo: user.photoURL ?? "" });

/** Community messages from the last 3 hours, oldest first. */
export function useCommunity() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(
    () =>
      onSnapshot(
        query(collection(db, "chat"), orderBy("createdAt", "desc"), limit(200)),
        { includeMetadataChanges: true },
        (snap) => {
          setMessages(snap.docs.map((d) => toMessage(d)).reverse());
          setLoading(false);
        },
        () => setLoading(false),
      ),
    [],
  );
  const now = useNow();
  return { messages: messages.filter((m) => now - m.createdAt < CHAT_TTL_MS), loading };
}

export function sendCommunity(user: User, channel: string | null, text: string, file: Attachment | null) {
  return addDoc(collection(db, "chat"), { uid: user.uid, ...profile(user), channel, admin: isAdminUser(user), text, file, createdAt: serverTimestamp() });
}

export const deleteCommunity = (id: string) => deleteDoc(doc(db, "chat", id));

/** Deletes community messages older than 3 hours (the rules allow anyone signed in to). */
export async function sweepExpired() {
  const snap = await getDocs(query(collection(db, "chat"), where("createdAt", "<", Timestamp.fromMillis(Date.now() - CHAT_TTL_MS - 5 * 60_000)) /* margin for a fast local clock: one too-new doc fails the whole batch */, limit(200)));
  if (snap.empty) return;
  const batch = writeBatch(db);
  snap.docs.forEach((d) => batch.delete(d.ref));
  await batch.commit();
}

// ---------- Private admin threads ----------

export type Thread = {
  uid: string;
  name: string;
  email: string;
  photo: string;
  channel: string | null;
  lastText: string;
  lastFrom: "user" | "admin";
  lastAt: number;
  unreadAdmin: number;
  unreadUser: number;
};

function toThread(id: string, x: DocumentData): Thread {
  return {
    uid: id,
    name: x.name ?? "",
    email: x.email ?? "",
    photo: x.photo ?? "",
    channel: x.channel ?? null,
    lastText: x.lastText ?? "",
    lastFrom: x.lastFrom ?? "user",
    lastAt: ms(x.lastAt) ?? Date.now(),
    unreadAdmin: x.unreadAdmin ?? 0,
    unreadUser: x.unreadUser ?? 0,
  };
}

/** One user's thread summary (null until they send their first message). */
export function useThread(uid: string | null) {
  const [thread, setThread] = useState<Thread | null>(null);
  useEffect(() => {
    if (!uid) return setThread(null);
    return onSnapshot(
      doc(db, "dms", uid),
      (d) => setThread(d.exists() ? toThread(d.id, d.data({ serverTimestamps: "estimate" })) : null),
      () => setThread(null),
    );
  }, [uid]);
  return thread;
}

/** Admin inbox: every thread, latest first. */
export function useThreads(enabled: boolean) {
  const [threads, setThreads] = useState<Thread[]>([]);
  useEffect(() => {
    if (!enabled) return;
    return onSnapshot(
      query(collection(db, "dms"), orderBy("lastAt", "desc"), limit(300)),
      (snap) => setThreads(snap.docs.map((d) => toThread(d.id, d.data({ serverTimestamps: "estimate" })))),
      () => setThreads([]),
    );
  }, [enabled]);
  return threads;
}

export function useThreadMessages(uid: string | null) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!uid) return;
    setLoading(true);
    return onSnapshot(
      query(collection(db, "dms", uid, "messages"), orderBy("createdAt", "desc"), limit(300)),
      { includeMetadataChanges: true },
      (snap) => {
        setMessages(snap.docs.map((d) => toMessage(d)).reverse());
        setLoading(false);
      },
      () => setLoading(false),
    );
  }, [uid]);
  return { messages, loading };
}

/**
 * Sends into dms/{threadUid}. `user` is the sender: the thread's owner, or the admin replying.
 * `owner` describes the thread's user for the admin's inbox (their own profile when they send;
 * the admin passes it when starting a thread from the dashboard).
 */
export type ThreadOwner = { name?: string; email: string; photo?: string; channel: string | null };
export async function sendDirect(user: User, threadUid: string, text: string, file: Attachment | null, owner?: ThreadOwner) {
  const fromAdmin = isAdminUser(user) && user.uid !== threadUid;
  await addDoc(collection(db, "dms", threadUid, "messages"), { from: fromAdmin ? "admin" : "user", ...profile(user), text, file, createdAt: serverTimestamp() });
  const preview = text || (file ? (file.type.startsWith("image/") ? "📷 Photo" : `📎 ${file.name}`) : "");
  await setDoc(
    doc(db, "dms", threadUid),
    {
      uid: threadUid,
      ...(fromAdmin
        ? owner
          ? { name: owner.name ?? "", photo: owner.photo ?? "", email: owner.email, channel: owner.channel }
          : {}
        : { ...profile(user), email: owner?.email ?? user.email ?? "", channel: owner?.channel ?? null }),
      lastText: preview.slice(0, 140),
      lastFrom: fromAdmin ? "admin" : "user",
      lastAt: serverTimestamp(),
      ...(fromAdmin ? { unreadUser: increment(1) } : { unreadAdmin: increment(1) }),
    },
    { merge: true },
  );
}

export function markThreadRead(uid: string, who: "admin" | "user") {
  return updateDoc(doc(db, "dms", uid), who === "admin" ? { unreadAdmin: 0 } : { unreadUser: 0 }).catch(() => {});
}

// ---------- Profile fields the admin dashboard reads ----------

export function saveProfile(user: User) {
  // members/{uid} holds nothing but the join date; it is public so the home page can count creators.
  const joined = Date.parse(user.metadata.creationTime ?? "");
  setDoc(doc(db, "members", user.uid), { joinedAt: Timestamp.fromMillis(Number.isFinite(joined) ? joined : Date.now()) }).catch(() => {});
  return setDoc(
    doc(db, "users", user.uid),
    { email: user.email ?? "", name: user.displayName ?? "", photo: user.photoURL ?? "", lastLogin: serverTimestamp(), createdAt: user.metadata.creationTime ?? "" },
    { merge: true },
  ).catch(() => {});
}

// ---------- Public creator directory (home page count + /channels) ----------

export type PublicChannel = { uid: string; id: string; title: string; handle: string; thumbnail: string; subscribers: number | null; videos: number };

export const channelUrl = (c: Pick<PublicChannel, "id" | "handle">) =>
  c.handle ? `https://www.youtube.com/${c.handle.startsWith("@") ? c.handle : `@${c.handle}`}` : `https://www.youtube.com/channel/${c.id}`;

/** Shown until the real number passes it. */
export const MIN_CREATORS = 10;

export const fmtCount = (n: number) => Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(n);

/** "10+" until there are more real creators than that. */
export const creatorsLabel = (n: number | null) => (n == null || n < MIN_CREATORS ? `${MIN_CREATORS}+` : fmtCount(n));

/** Creators who signed up and channels they connected. Counts are re-fetched every minute. */
export function useCreatorStats() {
  const [stats, setStats] = useState<{ creators: number | null; channels: number | null }>({ creators: null, channels: null });
  useEffect(() => {
    let alive = true;
    const load = () =>
      Promise.all([getCountFromServer(collection(db, "members")), getCountFromServer(collection(db, "channels"))])
        .then(([m, c]) => alive && setStats({ creators: m.data().count, channels: c.data().count }))
        .catch(() => {});
    load();
    const id = setInterval(load, 60_000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);
  return stats;
}

/** Every connected channel, biggest first, live. */
export function usePublicChannels() {
  const [channels, setChannels] = useState<PublicChannel[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(
    () =>
      onSnapshot(
        query(collection(db, "channels"), limit(500)),
        (snap) => {
          setChannels(
            snap.docs
              .map((d) => {
                const x = d.data();
                return { uid: d.id, id: x.id, title: x.title ?? "", handle: x.handle ?? "", thumbnail: x.thumbnail ?? "", subscribers: x.subscribers ?? null, videos: x.videos ?? 0 };
              })
              .sort((a, b) => (b.subscribers ?? -1) - (a.subscribers ?? -1)),
          );
          setLoading(false);
        },
        () => setLoading(false),
      ),
    [],
  );
  return { channels, loading };
}
