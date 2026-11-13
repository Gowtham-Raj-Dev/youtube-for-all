// Online presence, admin profile fields and the public creator directory (all in the owner's Firestore).
// Rules: firestore.rules.
import { useEffect, useState } from "react";
import type { User } from "firebase/auth";
import { collection, deleteDoc, doc, getCountFromServer, limit, onSnapshot, orderBy, query, serverTimestamp, setDoc, Timestamp, where } from "firebase/firestore";
import { db } from "./firebase";

/** Accounts that see the Admin panel. Keep in sync with isAdmin() in firestore.rules. */
export const ADMIN_EMAILS = ["codelove.in@gmail.com", "raj685810@gmail.com"];
export const isAdminUser = (u: Pick<User, "email" | "emailVerified"> | null | undefined) => !!u && !!u.email && ADMIN_EMAILS.includes(u.email) && u.emailVerified;

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

/** A clock that ticks every `every` ms, for "online" checks. */
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
