import { CloudUpload } from "lucide-react";
import type { BackupStatus } from "../lib/native";

export function BackupTray({ status }: { status: BackupStatus | null }) {
  if (!status || !status.running || status.total === 0) return null;
  const pct = Math.round((status.done / status.total) * 100);
  return (
    <div className="glass-strong pop w-full overflow-hidden rounded-2xl px-4 py-3 shadow-2xl shadow-black/50">
      <div className="flex items-center gap-3">
        <div className="gradient-ring flex h-8 w-8 items-center justify-center rounded-xl">
          <CloudUpload className="h-4 w-4 text-white" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-white">
            Backing up photos · {Math.min(status.done + 1, status.total)}/{status.total}
          </p>
          <p className="truncate text-[11px] text-zinc-500">{status.current}</p>
        </div>
      </div>
      <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/5">
        <div className="gradient-ring h-full rounded-full transition-all" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
