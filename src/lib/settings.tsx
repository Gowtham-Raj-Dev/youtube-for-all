import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { doc, onSnapshot, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "./firebase";
import { useUser } from "./auth";

export type Privacy = "public" | "unlisted" | "private";
export type StorageMode = "firebase" | "browser";

/** The user's own Firebase web app config — used only for their own Storage bucket. */
export type UserFirebaseConfig = {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  appId: string;
  messagingSenderId?: string;
};

export type Settings = {
  youtubeClientId: string;
  storageMode: StorageMode;
  userFirebase: UserFirebaseConfig | null;
  /** Daily publish times, "HH:MM" in the browser's local time. */
  slots: string[];
  defaults: {
    privacy: Privacy;
    categoryId: string;
    madeForKids: boolean;
    tags: string;
    descriptionFooter: string;
    addShortsTag: boolean;
    notifySubscribers: boolean;
  };
  keepFilesAfterUpload: boolean;
};

export const DEFAULT_SETTINGS: Settings = {
  youtubeClientId: "",
  storageMode: "browser",
  userFirebase: null,
  slots: ["08:00", "13:00", "18:30"],
  defaults: {
    privacy: "public",
    categoryId: "22",
    madeForKids: false,
    tags: "",
    descriptionFooter: "",
    addShortsTag: true,
    notifySubscribers: true,
  },
  keepFilesAfterUpload: false,
};

type SettingsState = {
  settings: Settings;
  loading: boolean;
  save: (patch: Partial<Settings>) => Promise<void>;
};

const SettingsContext = createContext<SettingsState | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const user = useUser();
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const ref = useMemo(() => doc(db, "users", user.uid), [user.uid]);

  useEffect(
    () =>
      onSnapshot(
        ref,
        (snap) => {
          const data = (snap.data()?.settings ?? {}) as Partial<Settings>;
          setSettings({
            ...DEFAULT_SETTINGS,
            ...data,
            defaults: { ...DEFAULT_SETTINGS.defaults, ...(data.defaults ?? {}) },
          });
          setLoading(false);
        },
        () => setLoading(false),
      ),
    [ref],
  );

  const save = useCallback(
    async (patch: Partial<Settings>) => {
      const next = { ...settings, ...patch };
      setSettings(next);
      await setDoc(
        ref,
        {
          settings: next,
          email: user.email ?? "",
          name: user.displayName ?? "",
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      );
    },
    [ref, settings, user.email, user.displayName],
  );

  return <SettingsContext.Provider value={{ settings, loading, save }}>{children}</SettingsContext.Provider>;
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error("useSettings outside SettingsProvider");
  return ctx;
}

export const YT_CATEGORIES: [string, string][] = [
  ["1", "Film & Animation"],
  ["2", "Autos & Vehicles"],
  ["10", "Music"],
  ["15", "Pets & Animals"],
  ["17", "Sports"],
  ["19", "Travel & Events"],
  ["20", "Gaming"],
  ["22", "People & Blogs"],
  ["23", "Comedy"],
  ["24", "Entertainment"],
  ["25", "News & Politics"],
  ["26", "Howto & Style"],
  ["27", "Education"],
  ["28", "Science & Technology"],
  ["29", "Nonprofits & Activism"],
];
