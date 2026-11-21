import { AppWindow, Check, Download, Trash2 } from "lucide-react";
import { cn } from "../utils/cn";
import { formatDate, formatSize } from "../lib/format";
import type { VaultItem } from "../lib/types";

const ACCENTS: Record<string, string> = {
  apk: "from-emerald-500 to-teal-600",
  xapk: "from-emerald-500 to-teal-600",
  apks: "from-emerald-500 to-teal-600",
  aab: "from-emerald-500 to-teal-600",
  exe: "from-sky-500 to-blue-700",
  msi: "from-blue-500 to-indigo-700",
  dmg: "from-zinc-400 to-zinc-600",
  pkg: "from-zinc-400 to-zinc-600",
  ipa: "from-pink-500 to-rose-600",
  appimage: "from-amber-400 to-orange-600",
  deb: "from-amber-400 to-orange-600",
  rpm: "from-amber-400 to-orange-600",
  jar: "from-red-500 to-orange-500",
};

interface AppGridProps {
  items: VaultItem[];
  selected: Set<string>;
  onToggle: (id: string) => void;
  onDownload: (item: VaultItem) => void;
  onDelete: (item: VaultItem) => void;
}

/** Cards for installers and packages (APK, EXE, DMG, ...). */
export function AppGrid({ items, selected, onToggle, onDownload, onDelete }: AppGridProps) {
  return (
    <div className="grid grid-cols-1 gap-4 pb-28 sm:grid-cols-2 md:pb-10 xl:grid-cols-3 2xl:grid-cols-4">
      {items.map((item, i) => {
        const accent = ACCENTS[item.ext] ?? "from-violet-500 to-fuchsia-600";
        const isSel = selected.has(item.id);
        return (
          <article
            key={item.id}
            onClick={() => onToggle(item.id)}
            className={cn(
              "glass group fade-up relative cursor-pointer overflow-hidden rounded-2xl p-4 transition duration-300 hover:-translate-y-1 hover:shadow-2xl hover:shadow-black/40",
              isSel && "ring-2 ring-violet-400"
            )}
            style={{ animationDelay: `${Math.min(i, 12) * 30}ms` }}
          >
            <div className={cn("pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-gradient-to-br opacity-20 blur-2xl transition duration-500 group-hover:opacity-40", accent)} />

            <div className="relative flex items-start gap-4">
              <div className={cn("flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-2xl bg-gradient-to-br text-white shadow-lg shadow-black/30", accent)}>
                <AppWindow className="h-5 w-5" />
                <span className="mt-0.5 text-[10px] font-bold uppercase tracking-wide">{item.ext || "app"}</span>
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="truncate text-sm font-semibold text-white" title={item.name}>
                  {item.name}
                </h3>
                <p className="mt-1 text-xs text-zinc-400">
                  {formatSize(item.size)} · {formatDate(item.mtime)}
                </p>
              </div>
              <span
                className={cn(
                  "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition",
                  isSel ? "border-violet-400 bg-violet-500 text-white" : "border-white/15 text-transparent group-hover:border-white/40"
                )}
              >
                <Check className="h-3 w-3" strokeWidth={3} />
              </span>
            </div>

            <div className="relative mt-4 flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
              <button
                onClick={() => onDownload(item)}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-white/10 px-3 py-2 text-sm font-semibold text-white transition hover:bg-white/20 active:scale-[0.98]"
              >
                <Download className="h-4 w-4" /> Download
              </button>
              <button
                onClick={() => onDelete(item)}
                className="rounded-xl bg-white/5 p-2 text-zinc-400 transition hover:bg-rose-500/15 hover:text-rose-300"
                title="Delete"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </article>
        );
      })}
    </div>
  );
}
