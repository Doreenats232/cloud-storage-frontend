import { AppWindow, Cloud, FolderOpen, Image as ImageIcon, Film, RefreshCw, Settings, Sparkles } from "lucide-react";
import { cn } from "../utils/cn";
import { formatSize } from "../lib/format";
import type { View } from "../lib/types";

interface SidebarProps {
  view: View;
  onView: (v: View) => void;
  counts: Record<View, number>;
  totalBytes: number;
  totalFiles: number;
  busy: boolean;
  onRefresh: () => void;
  onSettings: () => void;
}

const NAV: { id: View; label: string; icon: typeof ImageIcon }[] = [
  { id: "photos", label: "Photos", icon: ImageIcon },
  { id: "videos", label: "Videos", icon: Film },
  { id: "apps", label: "Apps", icon: AppWindow },
  { id: "files", label: "Files", icon: FolderOpen },
];

export function Brand() {
  return (
    <div className="flex items-center gap-3">
      <div className="gradient-ring relative flex h-10 w-10 items-center justify-center rounded-2xl shadow-lg shadow-violet-900/40">
        <Cloud className="h-5 w-5 text-white" strokeWidth={2.4} />
        <Sparkles className="absolute -right-1 -top-1 h-3.5 w-3.5 text-cyan-300" />
      </div>
      <div className="leading-tight">
        <div className="brand-text text-lg font-extrabold tracking-tight">Vault</div>
        <div className="text-[11px] font-medium text-zinc-500">Your TeraBox, beautifully</div>
      </div>
    </div>
  );
}

export function Sidebar({ view, onView, counts, totalBytes, totalFiles, busy, onRefresh, onSettings }: SidebarProps) {
  return (
    <>
      {/* Desktop sidebar */}
      <aside className="glass-strong hidden h-full w-64 shrink-0 flex-col gap-6 border-r border-white/5 p-5 md:flex">
        <Brand />

        <nav className="flex flex-col gap-1">
          {NAV.map((n) => {
            const active = view === n.id;
            return (
              <button
                key={n.id}
                onClick={() => onView(n.id)}
                className={cn(
                  "group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition",
                  active
                    ? "bg-white/[0.08] text-white shadow-inner shadow-white/5"
                    : "text-zinc-400 hover:bg-white/[0.04] hover:text-zinc-100"
                )}
              >
                {active && <span className="gradient-ring absolute left-0 top-2 h-[calc(100%-16px)] w-1 rounded-r-full" />}
                <n.icon className={cn("h-[18px] w-[18px]", active ? "text-violet-300" : "text-zinc-500 group-hover:text-zinc-300")} />
                <span className="flex-1 text-left">{n.label}</span>
                <span className="rounded-md bg-white/5 px-2 py-0.5 text-[11px] font-semibold tabular-nums text-zinc-400">
                  {counts[n.id]}
                </span>
              </button>
            );
          })}
        </nav>

        <div className="mt-auto space-y-3">
          <div className="rounded-2xl border border-white/5 bg-gradient-to-br from-violet-500/10 via-indigo-500/5 to-cyan-400/10 p-4">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">Vault contents</div>
            <div className="mt-1 text-2xl font-bold tabular-nums text-white">{formatSize(totalBytes)}</div>
            <div className="text-xs text-zinc-400">{totalFiles.toLocaleString()} items indexed</div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={onRefresh}
              disabled={busy}
              className="flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 text-sm text-zinc-200 transition hover:bg-white/[0.07] disabled:opacity-50"
            >
              <RefreshCw className={cn("h-4 w-4", busy && "spin-slow")} /> Sync
            </button>
            <button
              onClick={onSettings}
              className="flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 text-sm text-zinc-200 transition hover:bg-white/[0.07]"
            >
              <Settings className="h-4 w-4" /> Setup
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile bottom bar */}
      <nav className="glass-strong fixed inset-x-3 bottom-3 z-30 flex items-center justify-around rounded-2xl p-1.5 pb-[calc(0.375rem+env(safe-area-inset-bottom))] md:hidden">
        {NAV.map((n) => {
          const active = view === n.id;
          return (
            <button
              key={n.id}
              onClick={() => onView(n.id)}
              className={cn(
                "flex flex-1 flex-col items-center gap-0.5 rounded-xl py-2 text-[11px] font-medium transition",
                active ? "bg-white/[0.08] text-white" : "text-zinc-500"
              )}
            >
              <n.icon className={cn("h-5 w-5", active && "text-violet-300")} />
              {n.label}
            </button>
          );
        })}
        <button onClick={onSettings} className="flex flex-1 flex-col items-center gap-0.5 rounded-xl py-2 text-[11px] font-medium text-zinc-500">
          <Settings className="h-5 w-5" />
          Setup
        </button>
      </nav>
    </>
  );
}
