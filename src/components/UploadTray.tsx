import { useState } from "react";
import { AlertCircle, CheckCircle2, ChevronDown, ChevronUp, Loader2, RotateCw, UploadCloud, X } from "lucide-react";
import { cn } from "../utils/cn";
import { formatSize } from "../lib/format";
import type { UploadTask } from "../lib/types";

interface UploadTrayProps {
  tasks: UploadTask[];
  onClear: () => void;
  onRetry: (id: string) => void;
  onCancel: (id: string) => void;
}

export function UploadTray({ tasks, onClear, onRetry, onCancel }: UploadTrayProps) {
  const [open, setOpen] = useState(true);
  if (tasks.length === 0) return null;

  const active = tasks.filter((t) => t.status === "queued" || t.status === "uploading" || t.status === "processing").length;
  const done = tasks.filter((t) => t.status === "done").length;
  const failed = tasks.filter((t) => t.status === "error").length;
  const overall = tasks.reduce((acc, t) => acc + (t.status === "done" ? 1 : t.status === "uploading" ? t.progress : t.status === "processing" ? 0.99 : 0), 0) / tasks.length;

  return (
    <div className="glass-strong pop w-full overflow-hidden rounded-2xl shadow-2xl shadow-black/50">
      <div className="flex items-center gap-3 border-b border-white/5 px-4 py-3">
        <div className="gradient-ring flex h-8 w-8 items-center justify-center rounded-xl">
          {active > 0 ? <Loader2 className="h-4 w-4 animate-spin text-white" /> : <UploadCloud className="h-4 w-4 text-white" />}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-white">
            {active > 0 ? `Uploading ${active} file${active > 1 ? "s" : ""}` : "Uploads complete"}
          </p>
          <p className="text-xs text-zinc-400">
            {done} done{failed ? ` · ${failed} failed` : ""} · {tasks.length} total
          </p>
        </div>
        <button onClick={() => setOpen((o) => !o)} className="rounded-lg p-1.5 text-zinc-400 hover:bg-white/10">
          {open ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
        </button>
        <button onClick={onClear} className="rounded-lg p-1.5 text-zinc-400 hover:bg-white/10" title="Clear finished">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="h-1 bg-white/5">
        <div className="gradient-ring h-full transition-all duration-500" style={{ width: `${Math.round(overall * 100)}%` }} />
      </div>

      {open && (
        <ul className="scroll-thin max-h-72 divide-y divide-white/5 overflow-y-auto">
          {tasks.map((t) => (
            <li key={t.id} className="px-4 py-2.5">
              <div className="flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-zinc-100">{t.name}</p>
                  <p className="truncate text-[11px] text-zinc-500">
                    {formatSize(t.size)} → {t.dir}
                  </p>
                </div>
                {t.status === "done" && <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />}
                {t.status === "error" && (
                  <button onClick={() => onRetry(t.id)} className="rounded-lg p-1.5 text-rose-300 hover:bg-white/10" title="Retry">
                    <RotateCw className="h-4 w-4" />
                  </button>
                )}
                {t.status === "error" && <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />}
                {t.status === "processing" && <span className="text-[11px] text-amber-300">saving to TeraBox…</span>}
                {(t.status === "uploading" || t.status === "queued") && (
                  <span className={cn("text-[11px] tabular-nums", t.status === "uploading" ? "text-violet-300" : "text-zinc-500")}>
                    {t.status === "uploading" ? `${Math.round(t.progress * 100)}%` : "queued"}
                  </span>
                )}
                {t.status !== "done" && (
                  <button onClick={() => onCancel(t.id)} className="rounded-lg p-1.5 text-zinc-500 hover:bg-white/10" title="Cancel">
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
              {(t.status === "uploading" || t.status === "processing") && (
                <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/5">
                  <div className="gradient-ring h-full rounded-full transition-all" style={{ width: `${Math.round((t.status === "processing" ? 1 : t.progress) * 100)}%` }} />
                </div>
              )}
              {t.status === "error" && t.error && <p className="mt-1 text-[11px] text-rose-300/90">{t.error}</p>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
