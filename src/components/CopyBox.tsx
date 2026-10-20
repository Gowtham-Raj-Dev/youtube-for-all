import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { cx } from "./ui";

/** Read-only value with a copy button. `block` shows multi-line code. */
export function CopyBox({ value, block, label }: { value: string; block?: boolean; label?: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = value;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };
  return (
    <div className="group relative">
      {label && <div className="mb-1 text-xs font-medium text-muted">{label}</div>}
      <div className={cx("relative rounded-xl border border-line bg-bg-soft", block ? "p-3.5 pr-12" : "flex items-center py-2.5 pr-12 pl-3.5")}>
        {block ? (
          <pre className="overflow-x-auto font-mono text-xs leading-relaxed whitespace-pre">{value}</pre>
        ) : (
          <code className="truncate font-mono text-sm">{value}</code>
        )}
        <button
          type="button"
          onClick={copy}
          className={cx("absolute right-2 grid size-8 place-items-center rounded-lg text-muted transition hover:bg-card hover:text-fg", block ? "top-2" : "top-1/2 -translate-y-1/2")}
          title="Copy"
        >
          {copied ? <Check className="size-4 text-ok" /> : <Copy className="size-4" />}
        </button>
      </div>
    </div>
  );
}
