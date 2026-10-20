import { useCallback, useState, type ReactNode } from "react";
import { Check, ChevronDown, ExternalLink, Undo2 } from "lucide-react";
import { useSettings } from "../lib/settings";
import { Button, cx } from "./ui";

/** Manual "I've done this" ticks, saved in the user's settings so they sync across devices. */
export function useSetupTicks() {
  const { settings, save } = useSettings();
  const done = settings.setupDone ?? [];
  const isTicked = useCallback((key: string) => done.includes(key), [done]);
  const setTicked = useCallback(
    (key: string, on: boolean) => save({ setupDone: on ? [...new Set([...done, key])] : done.filter((k) => k !== key) }),
    [done, save],
  );
  return { isTicked, setTicked };
}

/** Numbered clicks inside a step. `start` continues the numbering after a copy box. */
export function Clicks({ start = 1, children }: { start?: number; children: ReactNode[] | ReactNode }) {
  const list = (Array.isArray(children) ? children : [children]).filter(Boolean);
  return (
    <ol className="space-y-2.5 rounded-xl border border-line bg-bg-soft p-4 text-sm leading-relaxed text-muted [&_b]:text-fg">
      {list.map((c, i) => (
        <li key={i} className="flex gap-3">
          <span className="grid size-6 shrink-0 place-items-center rounded-full bg-card text-xs font-bold text-accent ring-1 ring-line">{start + i}</span>
          <div className="min-w-0 flex-1 pt-0.5">{c}</div>
        </li>
      ))}
    </ol>
  );
}

export function OpenLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noreferrer" className="inline-block">
      <Button size="sm" variant="primary" icon={<ExternalLink className="size-3.5" />}>{children}</Button>
    </a>
  );
}

/**
 * A collapsible setup step. `done` decides the tick; with `onTick` the user can mark it done
 * (or undo) by hand. Steps start open while not done, so the next thing to do is always visible.
 */
export function StepCard({
  n,
  title,
  why,
  done,
  current,
  onTick,
  autoNote,
  children,
}: {
  n: number;
  title: string;
  why?: string;
  done: boolean;
  /** The first unfinished step — highlighted. */
  current?: boolean;
  onTick?: (on: boolean) => void;
  /** Shown instead of the tick button for steps the app detects itself. */
  autoNote?: string;
  children: ReactNode;
}) {
  const [openOverride, setOpenOverride] = useState<boolean | null>(null);
  const open = openOverride ?? (!!current && !done);

  return (
    <li className={cx("rounded-2xl border transition", current ? "border-accent/50 bg-accent-soft/40 shadow-lg shadow-accent/5" : done ? "border-ok/25 bg-ok/[0.03]" : "border-line")}>
      <button type="button" onClick={() => setOpenOverride(!open)} className="flex w-full items-center gap-3 px-4 py-3.5 text-left sm:px-5">
        <span className={cx("grid size-8 shrink-0 place-items-center rounded-full text-sm font-bold", done ? "bg-ok text-white" : current ? "grad-bg" : "bg-bg-soft text-muted ring-1 ring-line")}>
          {done ? <Check className="size-4.5" /> : n}
        </span>
        <span className="min-w-0 flex-1">
          <span className={cx("block font-semibold", done && "text-muted")}>{title}</span>
          {current && !done && <span className="block text-xs font-medium text-accent">Do this now</span>}
        </span>
        {done && <span className="hidden rounded-full bg-ok/10 px-2.5 py-0.5 text-xs font-semibold text-ok sm:inline">Done</span>}
        <ChevronDown className={cx("size-4.5 shrink-0 text-muted transition", open && "rotate-180")} />
      </button>

      {open && (
        <div className="space-y-4 border-t border-line px-4 pt-4 pb-5 sm:px-5 sm:pl-16">
          {why && <p className="text-sm text-muted">{why}</p>}
          {children}
          <div className="flex flex-wrap items-center gap-3 border-t border-dashed border-line pt-4">
            {onTick ? (
              done ? (
                <>
                  <span className="flex items-center gap-1.5 text-sm font-medium text-ok">
                    <Check className="size-4" /> Marked as done
                  </span>
                  <Button size="sm" variant="ghost" icon={<Undo2 className="size-3.5" />} onClick={() => onTick(false)}>Undo</Button>
                </>
              ) : (
                <Button
                  size="sm"
                  className="border-ok/40 text-ok hover:bg-ok/10"
                  icon={<Check className="size-4" />}
                  onClick={() => {
                    onTick(true);
                    setOpenOverride(false);
                  }}
                >
                  I've done this step
                </Button>
              )
            ) : (
              <span className={cx("flex items-center gap-1.5 text-xs", done ? "text-ok" : "text-faint")}>
                {done && <Check className="size-3.5" />}
                {done ? "Completed" : autoNote ?? "Ticks itself when finished"}
              </span>
            )}
          </div>
        </div>
      )}
    </li>
  );
}
