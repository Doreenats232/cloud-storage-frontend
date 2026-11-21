import { useState } from "react";
import { AlertCircle, CheckCircle2, ChevronDown, ChevronUp, DownloadCloud, Loader2, RotateCw, X } from "lucide-react";
import { formatSize } from "../lib/format";
import type { DownloadTask } from "../hooks/useDownloads";

interface Props {
  tasks: DownloadTask[];
  onRetry: (id: string) => void;
  onRemove: (id: string) => void;
  onClear: () => void;
}

export function DownloadTray({ tasks, onRetry, onRemove, onClear }: Props) {
  const [open, setOpen] = useState(true);
  if (tasks.length === 0) return null;
  const active = tasks.filter((t) => t.status === "starting" || t.status === "running" || t.status === "paused").length;
  const done = tasks.filter((t) => t.status === "done").length;
  const failed = tasks.filter((t) => t.status === "error").length;

  return (
    <div className="glass-strong pop w-full overflow-hidden rounded-2xl shadow-2xl shadow-black/50">
      <div className="flex items-center gap-3 border-b border-white/5 px-4 py-3">
        <div className="gradient-ring flex h-8 w-8 items-center justify-center rounded-xl">
          {active > 0 ? <Loader2 className="h-4 w-4 animate-spin text-white" /> : <DownloadCloud className="h-4 w-4 text-white" />}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-white">
            {active > 0 ? `Downloading ${active} file${active > 1 ? "s" : ""}` : "Downloads finished"}
          </p>
          <p className="text-xs text-zinc-400">
            {done} saved{failed ? ` · ${failed} failed` : ""} · Downloads folder
          </p>
        </div>
        <button onClick={() => setOpen((o) => !o)} className="rounded-lg p-1.5 text-zinc-400 hover:bg-white/10">
          {open ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
        </button>
        <button onClick={onClear} className="rounded-lg p-1.5 text-zinc-400 hover:bg-white/10" title="Clear finished">
          <X className="h-4 w-4" />
        </button>
      </div>

      {open && (
        <ul className="scroll-thin max-h-64 divide-y divide-white/5 overflow-y-auto">
          {tasks.map((t) => {
            const pct = t.size > 0 ? Math.min(100, Math.round((t.downloaded / t.size) * 100)) : 0;
            return (
              <li key={t.id} className="px-4 py-2.5">
                <div className="flex items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-zinc-100">{t.name}</p>
                    <p className="truncate text-[11px] text-zinc-500">
                      {t.status === "done"
                        ? `${formatSize(t.size)} · saved to Downloads`
                        : t.status === "paused"
                          ? "Waiting for connection…"
                          : t.status === "starting"
                            ? "Starting…"
                            : t.status === "error"
                              ? t.error
                              : `${formatSize(t.downloaded)} of ${formatSize(t.size)}`}
                    </p>
                  </div>
                  {t.status === "done" && <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />}
                  {t.status === "error" && (
                    <button onClick={() => onRetry(t.id)} className="rounded-lg p-1.5 text-rose-300 hover:bg-white/10" title="Retry">
                      <RotateCw className="h-4 w-4" />
                    </button>
                  )}
                  {(t.status === "running" || t.status === "paused") && (
                    <span className="text-[11px] tabular-nums text-violet-300">{pct}%</span>
                  )}
                  {t.status === "error" && <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />}
                  <button onClick={() => onRemove(t.id)} className="rounded-lg p-1.5 text-zinc-500 hover:bg-white/10" title="Remove">
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
                {(t.status === "running" || t.status === "paused") && (
                  <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/5">
                    <div className="gradient-ring h-full rounded-full transition-all" style={{ width: `${pct}%` }} />
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
