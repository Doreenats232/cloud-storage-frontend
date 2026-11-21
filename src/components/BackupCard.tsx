import { CloudUpload } from "lucide-react";
import { cn } from "../utils/cn";
import type { useBackup } from "../hooks/useBackup";

type B = ReturnType<typeof useBackup>;

function Switch({ on, onChange, label, hint }: { on: boolean; onChange: (v: boolean) => void; label: string; hint?: string }) {
  return (
    <button onClick={() => onChange(!on)} className="flex w-full items-center gap-3 rounded-xl px-1 py-2 text-left">
      <div className="min-w-0 flex-1">
        <p className="text-sm text-zinc-100">{label}</p>
        {hint && <p className="text-[11px] text-zinc-500">{hint}</p>}
      </div>
      <span className={cn("relative h-6 w-11 shrink-0 rounded-full transition", on ? "bg-violet-500" : "bg-white/15")}>
        <span className={cn("absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all", on ? "left-[22px]" : "left-0.5")} />
      </span>
    </button>
  );
}

function ago(ms: number): string {
  if (!ms) return "never";
  const s = Math.floor((Date.now() - ms) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  return `${Math.floor(s / 86400)} d ago`;
}

export function BackupCard({ b }: { b: B }) {
  if (!b.native) return null;
  const s = b.status;
  return (
    <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <div className="mb-2 flex items-center gap-2">
        <CloudUpload className="h-4 w-4 text-violet-300" />
        <h3 className="text-sm font-semibold text-white">Auto backup</h3>
      </div>
      <Switch on={b.cfg.enabled} onChange={(v) => void b.setEnabled(v)} label="Back up new photos &amp; videos" hint="Runs in the background about every 30 min" />
      <Switch on={b.cfg.wifiOnly} onChange={(v) => b.update({ wifiOnly: v })} label="Wi‑Fi only" hint="Saves your mobile data" />
      <Switch on={b.cfg.cameraOnly} onChange={(v) => b.update({ cameraOnly: v })} label="Camera folder only" hint="Skips screenshots and downloads" />
      {b.denied && <p className="mt-1 text-xs text-rose-300">Photo access was denied. Allow it in Android Settings → Apps → Cloud Storage → Permissions.</p>}

      {b.cfg.enabled && s && (
        <p className="mt-2 text-xs text-zinc-400">
          {s.running ? `Backing up ${Math.min(s.done + 1, s.total)} of ${s.total}…` : `${s.pending} waiting`} · {s.uploaded} backed up
          {s.failed ? ` · ${s.failed} skipped` : ""} · last check {ago(s.lastRun)}
          {s.lastError ? <span className="block text-rose-300/90">{s.lastError}</span> : null}
        </p>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          onClick={() => void b.backupNow()}
          disabled={!b.cfg.enabled}
          className="rounded-xl bg-white/10 px-3 py-2 text-xs font-semibold text-white hover:bg-white/15 disabled:opacity-40"
        >
          Back up now
        </button>
        <button
          onClick={() => void b.backupAll()}
          className="rounded-xl bg-white/10 px-3 py-2 text-xs font-semibold text-white hover:bg-white/15"
          title="Uploads every photo and video already on this phone"
        >
          Back up all existing
        </button>
      </div>
    </div>
  );
}
