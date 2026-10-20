import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Link } from "react-router";
import {
  ArrowLeft,
  Clock,
  Download,
  FileText,
  ImagePlus,
  Inbox,
  Loader2,
  Lock,
  MessageCircle,
  MessagesSquare,
  Paperclip,
  Pin,
  PinOff,
  Search,
  Send,
  ShieldCheck,
  Trash2,
  Users,
  X,
  Youtube,
} from "lucide-react";
import { useUser } from "../lib/auth";
import { useYouTube } from "../lib/youtube-context";
import {
  CHAT_TTL_MS,
  deleteCommunity,
  isAdminUser,
  markThreadRead,
  sendCommunity,
  sendDirect,
  sweepExpired,
  toAttachment,
  useCommunity,
  useNow,
  useOnline,
  usePresenceHeartbeat,
  useThread,
  useThreadMessages,
  useThreads,
  type Attachment,
  type Message,
  type Presence,
  type Thread,
  type ThreadOwner,
} from "../lib/community";
import { fmtBytes, fmtRelative } from "../lib/schedule";
import { cx, useToast } from "./ui";

// ---------- State shared with Layout (docking) and the Admin page (open a thread) ----------

type Tab = "community" | "direct";
type ChatState = {
  /** Pinned: docked as a right column on wide screens (the page narrows to make room). */
  pinned: boolean;
  setPinned: (v: boolean) => void;
  /** Open as an overlay (when not docked). */
  open: boolean;
  setOpen: (v: boolean) => void;
  /** Docked right now (pinned and the screen is wide enough). */
  docked: boolean;
  /** Wide enough to dock at all. */
  wide: boolean;
  tab: Tab;
  setTab: (t: Tab) => void;
  /** Admin: the user thread on screen in the inbox. */
  thread: string | null;
  openThread: (uid: string | null, owner?: ThreadOwner) => void;
  threadOwner: ThreadOwner | null;
};

const ChatContext = createContext<ChatState | null>(null);

function useWide() {
  const q = "(min-width: 1280px)";
  const [wide, setWide] = useState(() => window.matchMedia(q).matches);
  useEffect(() => {
    const m = window.matchMedia(q);
    const on = () => setWide(m.matches);
    m.addEventListener("change", on);
    return () => m.removeEventListener("change", on);
  }, []);
  return wide;
}

const PIN_KEY = "chat_pinned";

export function ChatProvider({ children }: { children: ReactNode }) {
  const [pinned, setPinnedState] = useState(() => {
    try {
      return localStorage.getItem(PIN_KEY) !== "0";
    } catch {
      return true;
    }
  });
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>("community");
  const [thread, setThread] = useState<string | null>(null);
  const [threadOwner, setThreadOwner] = useState<ThreadOwner | null>(null);
  const wide = useWide();
  const docked = pinned && wide;

  const setPinned = useCallback((v: boolean) => {
    setPinnedState(v);
    setOpen(false);
    try {
      localStorage.setItem(PIN_KEY, v ? "1" : "0");
    } catch {
      /* ignore */
    }
  }, []);

  const openThread = useCallback(
    (uid: string | null, owner?: ThreadOwner) => {
      setThread(uid);
      setThreadOwner(owner ?? null);
      if (uid) {
        setTab("direct");
        if (!docked) setOpen(true);
      }
    },
    [docked],
  );

  return (
    <ChatContext.Provider value={{ pinned, setPinned, open, setOpen, docked, wide, tab, setTab, thread, openThread, threadOwner }}>
      {children}
    </ChatContext.Provider>
  );
}

export function useChat() {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error("useChat outside ChatProvider");
  return ctx;
}

// ---------- Small pieces ----------

function Avatar({ src, name, className }: { src?: string; name: string; className?: string }) {
  const [broken, setBroken] = useState(false);
  if (src && !broken)
    return <img src={src} alt="" className={cx("shrink-0 rounded-full object-cover", className)} referrerPolicy="no-referrer" onError={() => setBroken(true)} />;
  return (
    <span className={cx("grad-bg grid shrink-0 place-items-center rounded-full text-xs font-bold", className)}>
      {(name || "?")[0]?.toUpperCase()}
    </span>
  );
}

function OnlineStack({ people }: { people: Presence[] }) {
  return (
    <div className="flex -space-x-2">
      {people.slice(0, 4).map((p) => (
        <span key={p.uid} title={p.channel ? `${p.name} · ${p.channel}` : p.name} className="relative">
          <Avatar src={p.photo} name={p.name} className="size-6 ring-2 ring-bg-soft" />
        </span>
      ))}
      {people.length > 4 && (
        <span className="grid size-6 place-items-center rounded-full bg-card text-[10px] font-bold text-muted ring-2 ring-bg-soft">+{people.length - 4}</span>
      )}
    </div>
  );
}

function clock(ms: number) {
  return new Date(ms).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function leftLabel(msLeft: number) {
  const m = Math.max(1, Math.round(msLeft / 60_000));
  return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`;
}

/** Plain text with clickable links. */
function RichText({ text }: { text: string }) {
  const parts = text.split(/(https?:\/\/[^\s]+)/g);
  return (
    <>
      {parts.map((p, i) =>
        /^https?:\/\//.test(p) ? (
          <a key={i} href={p} target="_blank" rel="noreferrer noopener" className="break-all underline underline-offset-2">
            {p}
          </a>
        ) : (
          <span key={i}>{p}</span>
        ),
      )}
    </>
  );
}

function Lightbox({ file, onClose }: { file: Attachment; onClose: () => void }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-[70] grid place-items-center bg-black/85 p-4 backdrop-blur-sm" onClick={onClose}>
      <img src={file.data} alt={file.name} className="max-h-[85vh] max-w-full rounded-xl shadow-2xl" onClick={(e) => e.stopPropagation()} />
      <div className="absolute top-4 right-4 flex gap-2">
        <a href={file.data} download={file.name} onClick={(e) => e.stopPropagation()} className="grid size-10 place-items-center rounded-full bg-white/10 text-white hover:bg-white/20" title="Download">
          <Download className="size-5" />
        </a>
        <button onClick={onClose} className="grid size-10 place-items-center rounded-full bg-white/10 text-white hover:bg-white/20" title="Close">
          <X className="size-5" />
        </button>
      </div>
    </div>
  );
}

function FileView({ file, mine }: { file: Attachment; mine: boolean }) {
  const [zoom, setZoom] = useState(false);
  if (file.type.startsWith("image/"))
    return (
      <>
        <button onClick={() => setZoom(true)} className="block overflow-hidden rounded-xl" title="Open">
          <img
            src={file.data}
            alt={file.name}
            className="max-h-64 w-full object-cover"
            style={file.w && file.h ? { aspectRatio: `${file.w} / ${file.h}` } : undefined}
          />
        </button>
        {zoom && <Lightbox file={file} onClose={() => setZoom(false)} />}
      </>
    );
  return (
    <a
      href={file.data}
      download={file.name}
      className={cx("flex items-center gap-3 rounded-xl px-3 py-2.5 transition", mine ? "bg-black/15 hover:bg-black/25" : "bg-bg-soft hover:bg-card-hover")}
    >
      <span className={cx("grid size-9 shrink-0 place-items-center rounded-lg", mine ? "bg-black/20" : "bg-accent-soft text-accent")}>
        <FileText className="size-4.5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">{file.name}</span>
        <span className={cx("block text-[11px]", mine ? "opacity-75" : "text-muted")}>{fmtBytes(file.size)}</span>
      </span>
      <Download className="size-4 shrink-0 opacity-70" />
    </a>
  );
}

// ---------- Messages ----------

function MessageList({
  messages,
  meId,
  loading,
  canDelete,
  onDelete,
  expires,
  empty,
}: {
  messages: Message[];
  meId: string;
  loading: boolean;
  canDelete?: (m: Message) => boolean;
  onDelete?: (m: Message) => void;
  expires?: boolean;
  empty: ReactNode;
}) {
  const end = useRef<HTMLDivElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const stick = useRef(true);
  const now = useNow(60_000);

  useEffect(() => {
    if (stick.current) end.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);

  if (loading)
    return (
      <div className="grid flex-1 place-items-center">
        <Loader2 className="size-6 animate-spin text-accent" />
      </div>
    );

  return (
    <div
      ref={box}
      onScroll={() => {
        const el = box.current!;
        stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
      }}
      className="min-h-0 flex-1 overflow-y-auto px-3 py-4"
    >
      {messages.length === 0 ? (
        <div className="grid h-full place-items-center px-6 text-center">{empty}</div>
      ) : (
        <ul className="space-y-1">
          {messages.map((m, i) => {
            const prev = messages[i - 1];
            const mine = m.uid === meId;
            const grouped = prev && prev.uid === m.uid && m.createdAt - prev.createdAt < 5 * 60_000;
            const newDay = !prev || new Date(prev.createdAt).toDateString() !== new Date(m.createdAt).toDateString();
            return (
              <li key={m.id}>
                {newDay && (
                  <div className="my-3 flex items-center gap-3 text-[10px] font-semibold tracking-wider text-faint uppercase">
                    <span className="h-px flex-1 bg-line" />
                    {new Date(m.createdAt).toDateString() === new Date().toDateString() ? "Today" : new Date(m.createdAt).toLocaleDateString([], { day: "numeric", month: "short" })}
                    <span className="h-px flex-1 bg-line" />
                  </div>
                )}
                <div className={cx("group flex gap-2", mine ? "flex-row-reverse" : "", grouped ? "mt-0.5" : "mt-3")}>
                  <div className="w-8 shrink-0">{!mine && !grouped && <Avatar src={m.photo} name={m.name} className="size-8" />}</div>
                  <div className={cx("flex min-w-0 max-w-[80%] flex-col", mine ? "items-end" : "items-start")}>
                    {!grouped && !mine && (
                      <div className="mb-1 flex max-w-full items-center gap-1.5 px-1 text-[11px]">
                        <span className="truncate font-semibold text-fg">{m.name}</span>
                        {m.admin && (
                          <span className="grad-bg inline-flex shrink-0 items-center gap-0.5 rounded-full px-1.5 py-px text-[9px] font-bold tracking-wide uppercase">
                            <ShieldCheck className="size-2.5" /> Admin
                          </span>
                        )}
                        {m.channel && !m.admin && (
                          <span className="flex min-w-0 items-center gap-0.5 truncate text-faint">
                            <Youtube className="size-3 shrink-0 text-[#ff4d4d]" />
                            <span className="truncate">{m.channel}</span>
                          </span>
                        )}
                      </div>
                    )}
                    <div className="flex items-end gap-1.5">
                      {mine && canDelete?.(m) && (
                        <button onClick={() => onDelete?.(m)} className="mb-1 hidden size-6 place-items-center rounded-md text-faint group-hover:grid hover:bg-danger/10 hover:text-danger" title="Delete">
                          <Trash2 className="size-3.5" />
                        </button>
                      )}
                      <div
                        className={cx(
                          "min-w-0 overflow-hidden rounded-2xl text-sm leading-relaxed break-words whitespace-pre-wrap",
                          m.file && !m.text ? "p-1" : "px-3.5 py-2",
                          mine
                            ? "grad-bg rounded-br-md shadow-md shadow-accent/15"
                            : m.admin
                              ? "rounded-bl-md border border-accent/40 bg-accent-soft text-fg"
                              : "rounded-bl-md border border-line bg-card text-fg",
                          m.pending && "opacity-70",
                        )}
                        title={`${new Date(m.createdAt).toLocaleString()}${expires ? ` · disappears in ${leftLabel(m.createdAt + CHAT_TTL_MS - now)}` : ""}`}
                      >
                        {m.file && <div className={cx(m.text && "-mx-2 -mt-0.5 mb-2")}><FileView file={m.file} mine={mine} /></div>}
                        {m.text && <RichText text={m.text} />}
                      </div>
                      {!mine && canDelete?.(m) && (
                        <button onClick={() => onDelete?.(m)} className="mb-1 hidden size-6 place-items-center rounded-md text-faint group-hover:grid hover:bg-danger/10 hover:text-danger" title="Delete">
                          <Trash2 className="size-3.5" />
                        </button>
                      )}
                    </div>
                    {(!messages[i + 1] || messages[i + 1].uid !== m.uid || messages[i + 1].createdAt - m.createdAt >= 5 * 60_000) && (
                      <span className="mt-1 px-1 text-[10px] text-faint">{m.pending ? "Sending…" : clock(m.createdAt)}</span>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <div ref={end} />
    </div>
  );
}

// ---------- Composer ----------

function Composer({ onSend, placeholder }: { onSend: (text: string, file: Attachment | null) => Promise<void>; placeholder: string }) {
  const toast = useToast();
  const [text, setText] = useState("");
  const [file, setFile] = useState<Attachment | null>(null);
  const [reading, setReading] = useState(false);
  const [sending, setSending] = useState(false);
  const [drag, setDrag] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const area = useRef<HTMLTextAreaElement>(null);

  const attach = async (f: File | undefined | null) => {
    if (!f) return;
    setReading(true);
    try {
      setFile(await toAttachment(f));
      area.current?.focus();
    } catch (e) {
      toast("error", (e as Error).message);
    } finally {
      setReading(false);
    }
  };

  const grow = () => {
    const el = area.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 140)}px`;
  };

  const send = async () => {
    const t = text.trim();
    if ((!t && !file) || sending) return;
    setSending(true);
    try {
      await onSend(t.slice(0, 2000), file);
      setText("");
      setFile(null);
      requestAnimationFrame(grow);
    } catch (e) {
      toast("error", `Not sent: ${(e as Error).message}`);
    } finally {
      setSending(false);
    }
  };

  return (
    <div
      className={cx("relative border-t border-line bg-bg-soft/80 p-3", drag && "ring-2 ring-accent ring-inset")}
      onDragOver={(e) => {
        e.preventDefault();
        setDrag(true);
      }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDrag(false);
        attach(e.dataTransfer.files[0]);
      }}
    >
      {(file || reading) && (
        <div className="mb-2 flex items-center gap-2.5 rounded-xl border border-line bg-card p-2">
          {reading ? (
            <Loader2 className="m-2 size-5 animate-spin text-accent" />
          ) : file!.type.startsWith("image/") ? (
            <img src={file!.data} alt="" className="size-12 rounded-lg object-cover" />
          ) : (
            <span className="grid size-12 place-items-center rounded-lg bg-accent-soft text-accent">
              <FileText className="size-5" />
            </span>
          )}
          <span className="min-w-0 flex-1 text-xs">
            <span className="block truncate font-medium">{reading ? "Preparing…" : file!.name}</span>
            {file && <span className="text-faint">{fmtBytes(file.size)}</span>}
          </span>
          {file && (
            <button onClick={() => setFile(null)} className="grid size-7 place-items-center rounded-lg text-muted hover:bg-card-hover hover:text-fg" title="Remove">
              <X className="size-4" />
            </button>
          )}
        </div>
      )}
      <div className="flex items-end gap-2 rounded-2xl border border-line bg-card p-1.5 focus-within:border-accent/50">
        <button onClick={() => input.current?.click()} className="grid size-9 shrink-0 place-items-center rounded-xl text-muted transition hover:bg-card-hover hover:text-accent" title="Attach a file or screenshot">
          <Paperclip className="size-4.5" />
        </button>
        <input
          ref={input}
          type="file"
          className="hidden"
          onChange={(e) => {
            attach(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
        <textarea
          ref={area}
          rows={1}
          value={text}
          maxLength={2000}
          placeholder={placeholder}
          onChange={(e) => {
            setText(e.target.value);
            grow();
          }}
          onPaste={(e) => {
            const f = [...e.clipboardData.files][0];
            if (f) {
              e.preventDefault();
              attach(f);
            }
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              send();
            }
          }}
          className="max-h-36 min-h-9 flex-1 resize-none bg-transparent py-2 text-sm outline-none placeholder:text-faint"
        />
        <button
          onClick={send}
          disabled={(!text.trim() && !file) || sending || reading}
          className="grad-bg grid size-9 shrink-0 place-items-center rounded-xl shadow-md shadow-accent/25 transition hover:brightness-110 disabled:opacity-40 disabled:shadow-none"
          title="Send (Enter)"
        >
          {sending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
        </button>
      </div>
      <div className="mt-1.5 flex items-center justify-between px-1 text-[10px] text-faint">
        <span className="flex items-center gap-1">
          <ImagePlus className="size-3" /> Paste or drop screenshots
        </span>
        <span>Shift + Enter for a new line</span>
      </div>
    </div>
  );
}

// ---------- Tabs ----------

function CommunityTab() {
  const user = useUser();
  const yt = useYouTube();
  const toast = useToast();
  const admin = isAdminUser(user);
  const { messages, loading } = useCommunity();
  const canPost = admin || !!yt.channel;

  useEffect(() => {
    sweepExpired().catch(() => {});
  }, []);

  return (
    <>
      <div className="flex items-center gap-2 border-b border-line bg-warn/5 px-4 py-2 text-[11px] text-muted">
        <Clock className="size-3.5 shrink-0 text-warn" />
        Messages disappear 3 hours after they are sent.
      </div>
      <MessageList
        messages={messages}
        meId={user.uid}
        loading={loading}
        expires
        canDelete={(m) => admin || m.uid === user.uid}
        onDelete={(m) => confirm("Delete this message for everyone?") && deleteCommunity(m.id).catch((e) => toast("error", (e as Error).message))}
        empty={
          <div>
            <span className="grad-bg mx-auto grid size-14 place-items-center rounded-2xl shadow-lg shadow-accent/25">
              <MessagesSquare className="size-6" />
            </span>
            <p className="mt-4 font-semibold">Say hi to other creators</p>
            <p className="mt-1 text-xs text-muted">Share tips, ask questions, post screenshots. It all clears after 3 hours.</p>
          </div>
        }
      />
      {canPost ? (
        <Composer placeholder="Message the community…" onSend={(t, f) => sendCommunity(user, yt.channel?.title ?? null, t, f).then(() => {})} />
      ) : (
        <div className="border-t border-line bg-bg-soft/80 p-4 text-center">
          <p className="text-sm font-semibold">Connect your channel to chat</p>
          <p className="mt-1 text-xs text-muted">Only creators with a connected YouTube channel can post here.</p>
          <Link to="/settings#youtube" className="grad-bg mt-3 inline-flex h-9 items-center gap-2 rounded-xl px-4 text-sm font-semibold shadow-lg shadow-accent/25">
            <Youtube className="size-4" /> Connect YouTube
          </Link>
        </div>
      )}
    </>
  );
}

function ThreadView({ uid, header, owner }: { uid: string; header?: ReactNode; owner?: ThreadOwner }) {
  const user = useUser();
  const yt = useYouTube();
  const admin = isAdminUser(user);
  const who = admin && uid !== user.uid ? "admin" : "user";
  const { messages, loading } = useThreadMessages(uid);
  const thread = useThread(uid);
  const unread = who === "admin" ? thread?.unreadAdmin : thread?.unreadUser;

  useEffect(() => {
    if (unread && document.visibilityState === "visible") markThreadRead(uid, who);
  }, [unread, uid, who, messages.length]);

  return (
    <>
      {header}
      <div className="flex items-center gap-2 border-b border-line bg-accent-soft px-4 py-2 text-[11px] text-muted">
        <Lock className="size-3.5 shrink-0 text-accent" />
        {who === "admin" ? "Private thread with this user. It is kept." : "Private chat with the UTubeFlow admin. Messages here are kept."}
      </div>
      <MessageList
        messages={messages}
        meId={who}
        loading={loading}
        empty={
          <div>
            <span className="grad-bg mx-auto grid size-14 place-items-center rounded-2xl shadow-lg shadow-accent/25">
              <ShieldCheck className="size-6" />
            </span>
            <p className="mt-4 font-semibold">{who === "admin" ? "Start the conversation" : "Need help? Ask the admin"}</p>
            <p className="mt-1 text-xs text-muted">{who === "admin" ? "Your message goes straight to this user's chat." : "Problems with setup, uploads or Autopilot — send a message or a screenshot. Only the admin can see it."}</p>
          </div>
        }
      />
      <Composer
        placeholder={who === "admin" ? "Reply privately…" : "Message the admin…"}
        onSend={(t, f) => sendDirect(user, uid, t, f, who === "admin" ? owner : { email: user.email ?? "", channel: yt.channel?.title ?? null })}
      />
    </>
  );
}

function InboxTab({ threads }: { threads: Thread[] }) {
  const chat = useChat();
  const [q, setQ] = useState("");
  const shown = useMemo(() => {
    const s = q.trim().toLowerCase();
    return s ? threads.filter((t) => `${t.name} ${t.email} ${t.channel ?? ""}`.toLowerCase().includes(s)) : threads;
  }, [threads, q]);

  if (chat.thread) {
    const t = threads.find((x) => x.uid === chat.thread);
    const owner = chat.threadOwner ?? (t ? { name: t.name, email: t.email, photo: t.photo, channel: t.channel } : undefined);
    return (
      <ThreadView
        key={chat.thread}
        uid={chat.thread}
        owner={owner}
        header={
          <div className="flex items-center gap-2.5 border-b border-line px-3 py-2.5">
            <button onClick={() => chat.openThread(null)} className="grid size-8 place-items-center rounded-lg text-muted hover:bg-card-hover hover:text-fg" title="Back to inbox">
              <ArrowLeft className="size-4.5" />
            </button>
            <Avatar src={owner?.photo} name={owner?.name ?? "?"} className="size-8" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold">{owner?.name || owner?.email || "User"}</span>
              <span className="block truncate text-[11px] text-muted">{owner?.channel ? `${owner.channel} · ` : ""}{owner?.email}</span>
            </span>
          </div>
        }
      />
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="border-b border-line p-3">
        <label className="flex items-center gap-2 rounded-xl border border-line bg-card px-3 focus-within:border-accent/50">
          <Search className="size-4 text-faint" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search people…" className="h-9 flex-1 bg-transparent text-sm outline-none placeholder:text-faint" />
        </label>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        {shown.length === 0 ? (
          <div className="grid h-full place-items-center px-6 text-center">
            <div>
              <Inbox className="mx-auto size-8 text-faint" />
              <p className="mt-3 text-sm font-semibold">No messages yet</p>
              <p className="mt-1 text-xs text-muted">When a user messages you, the thread shows up here.</p>
            </div>
          </div>
        ) : (
          shown.map((t) => (
            <button
              key={t.uid}
              onClick={() => chat.openThread(t.uid)}
              className={cx("flex w-full items-center gap-3 rounded-xl p-2.5 text-left transition hover:bg-card-hover", t.unreadAdmin > 0 && "bg-accent-soft")}
            >
              <Avatar src={t.photo} name={t.name} className="size-10" />
              <span className="min-w-0 flex-1">
                <span className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm font-semibold">{t.name || t.email}</span>
                  <span className="shrink-0 text-[10px] text-faint">{fmtRelative(t.lastAt)}</span>
                </span>
                <span className="flex items-center justify-between gap-2">
                  <span className={cx("truncate text-xs", t.unreadAdmin ? "font-medium text-fg" : "text-muted")}>
                    {t.lastFrom === "admin" && "You: "}
                    {t.lastText}
                  </span>
                  {t.unreadAdmin > 0 && <span className="grad-bg shrink-0 rounded-full px-1.5 text-[10px] font-bold">{t.unreadAdmin}</span>}
                </span>
              </span>
            </button>
          ))
        )}
      </div>
    </div>
  );
}

// ---------- Panel ----------

function useUnread() {
  const user = useUser();
  const admin = isAdminUser(user);
  const threads = useThreads(admin);
  const mine = useThread(admin ? null : user.uid);
  return { threads, unread: admin ? threads.reduce((n, t) => n + t.unreadAdmin, 0) : (mine?.unreadUser ?? 0) };
}

function Panel({ online, threads, unread }: { online: Presence[]; threads: Thread[]; unread: number }) {
  const user = useUser();
  const chat = useChat();
  const admin = isAdminUser(user);
  const [showOnline, setShowOnline] = useState(false);

  return (
    <div className="flex h-full min-h-0 flex-col bg-bg-soft">
      {/* Header */}
      <div className="relative overflow-hidden border-b border-line px-4 pt-4 pb-3">
        <div className="pointer-events-none absolute -top-16 -right-10 size-40 rounded-full bg-accent/20 blur-3xl" />
        <div className="relative flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="grad-bg grid size-9 shrink-0 place-items-center rounded-xl shadow-lg shadow-accent/30">
              <MessageCircle className="size-4.5" />
            </span>
            <div className="min-w-0">
              <div className="truncate text-sm font-bold">Creator Chat</div>
              <button onClick={() => setShowOnline(!showOnline)} className="flex items-center gap-1.5 text-[11px] font-medium text-ok" title="Who's online">
                <span className="relative flex size-2">
                  <span className="absolute inset-0 animate-ping rounded-full bg-ok opacity-60" />
                  <span className="relative size-2 rounded-full bg-ok" />
                </span>
                {online.length} online
              </button>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <OnlineStack people={online} />
            {chat.wide && (
            <button
              onClick={() => chat.setPinned(!chat.docked)}
              className="ml-1 grid size-8 place-items-center rounded-lg text-muted transition hover:bg-card-hover hover:text-fg"
              title={chat.docked ? "Unpin — give the page full width" : "Pin to the side"}
            >
              {chat.docked ? <PinOff className="size-4" /> : <Pin className="size-4" />}
            </button>
            )}
            {!chat.docked && (
              <button onClick={() => chat.setOpen(false)} className="grid size-8 place-items-center rounded-lg text-muted transition hover:bg-card-hover hover:text-fg" title="Close">
                <X className="size-4.5" />
              </button>
            )}
          </div>
        </div>

        {showOnline && (
          <div className="relative mt-3 max-h-48 overflow-y-auto rounded-xl border border-line bg-card p-1.5">
            {online.length === 0 ? (
              <p className="p-2 text-xs text-muted">Nobody else right now.</p>
            ) : (
              online.map((p) => (
                <div key={p.uid} className="flex items-center gap-2.5 rounded-lg px-2 py-1.5">
                  <span className="relative">
                    <Avatar src={p.photo} name={p.name} className="size-7" />
                    <span className="absolute -right-0.5 -bottom-0.5 size-2.5 rounded-full bg-ok ring-2 ring-card" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs font-semibold">{p.name}{p.uid === user.uid && <span className="font-normal text-faint"> (you)</span>}</span>
                    {p.channel && <span className="block truncate text-[10px] text-muted">{p.channel}</span>}
                  </span>
                </div>
              ))
            )}
          </div>
        )}

        {/* Tabs */}
        <div className="relative mt-3 grid grid-cols-2 gap-1 rounded-xl border border-line bg-card p-1">
          {(
            [
              ["community", "Community", Users],
              ["direct", admin ? "Inbox" : "Admin", admin ? Inbox : ShieldCheck],
            ] as const
          ).map(([key, label, Icon]) => (
            <button
              key={key}
              onClick={() => chat.setTab(key)}
              className={cx(
                "flex h-8 items-center justify-center gap-1.5 rounded-lg text-xs font-semibold transition",
                chat.tab === key ? "grad-bg shadow-md shadow-accent/20" : "text-muted hover:text-fg",
              )}
            >
              <Icon className="size-3.5" />
              {label}
              {key === "direct" && unread > 0 && (
                <span className={cx("rounded-full px-1.5 text-[10px] font-bold", chat.tab === key ? "bg-black/20" : "bg-danger text-white")}>{unread}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {chat.tab === "community" ? <CommunityTab /> : admin ? <InboxTab threads={threads} /> : <ThreadView uid={user.uid} />}
    </div>
  );
}

/** The chat: a docked right column when pinned on wide screens, otherwise a launcher + overlay. */
export function ChatDock() {
  const user = useUser();
  const yt = useYouTube();
  const chat = useChat();
  usePresenceHeartbeat(user, yt.channel?.title ?? null);
  const online = useOnline();
  const { threads, unread } = useUnread();

  if (chat.docked)
    return (
      <aside className="fixed inset-y-0 right-0 z-30 flex w-88 flex-col border-l border-line">
        <Panel online={online} threads={threads} unread={unread} />
      </aside>
    );

  return (
    <>
      {!chat.open && (
        <button
          onClick={() => chat.setOpen(true)}
          className="grad-bg fixed right-4 bottom-20 z-40 flex h-13 items-center gap-2.5 rounded-full pr-5 pl-4 font-semibold shadow-2xl shadow-accent/40 transition hover:scale-[1.03] lg:bottom-6"
          title="Open chat"
        >
          <MessageCircle className="size-5" />
          <span className="text-sm">Chat</span>
          <span className="flex items-center gap-1 rounded-full bg-black/20 px-2 py-0.5 text-[11px]">
            <span className="size-1.5 rounded-full bg-white" />
            {online.length}
          </span>
          {unread > 0 && <span className="absolute -top-1.5 -right-1 grid min-w-5 place-items-center rounded-full bg-danger px-1 text-[11px] font-bold text-white ring-2 ring-bg">{unread}</span>}
        </button>
      )}
      {chat.open && (
        <div className="fixed inset-0 z-[60]">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => chat.setOpen(false)} />
          <div className="absolute inset-y-0 right-0 flex w-[min(24rem,100vw)] flex-col border-l border-line shadow-2xl shadow-black/50">
            <Panel online={online} threads={threads} unread={unread} />
          </div>
        </div>
      )}
    </>
  );
}
