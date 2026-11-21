import { Archive, AppWindow, Check, Download, File as FileIcon, FileText, Folder, Film, Image as ImageIcon, Music, Trash2 } from "lucide-react";
import { cn } from "../utils/cn";
import { formatDate, formatSize } from "../lib/format";
import type { Kind, VaultItem } from "../lib/types";

const KIND_ICON: Record<Kind, typeof FileIcon> = {
  folder: Folder,
  image: ImageIcon,
  video: Film,
  audio: Music,
  app: AppWindow,
  doc: FileText,
  archive: Archive,
  other: FileIcon,
};

const KIND_TINT: Record<Kind, string> = {
  folder: "from-amber-400/30 to-orange-500/20 text-amber-300",
  image: "from-pink-400/30 to-rose-500/20 text-pink-300",
  video: "from-violet-400/30 to-fuchsia-500/20 text-violet-300",
  audio: "from-emerald-400/30 to-teal-500/20 text-emerald-300",
  app: "from-sky-400/30 to-indigo-500/20 text-sky-300",
  doc: "from-blue-400/30 to-cyan-500/20 text-blue-300",
  archive: "from-yellow-400/30 to-amber-500/20 text-yellow-300",
  other: "from-zinc-400/25 to-zinc-600/20 text-zinc-300",
};

interface FileListProps {
  items: VaultItem[];
  selected: Set<string>;
  onOpenFolder: (path: string) => void;
  onOpenFile: (item: VaultItem) => void;
  onToggle: (id: string) => void;
  onDownload: (item: VaultItem) => void;
  onDelete: (item: VaultItem) => void;
}

export function FileList({ items, selected, onOpenFolder, onOpenFile, onToggle, onDownload, onDelete }: FileListProps) {
  return (
    <div className="glass overflow-hidden rounded-2xl">
      <div className="hidden grid-cols-[20px_1fr_110px_150px_96px] gap-4 border-b border-white/5 px-5 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-zinc-500 md:grid">
        <span />
        <span>Name</span>
        <span>Size</span>
        <span>Modified</span>
        <span className="text-right">Actions</span>
      </div>
      <ul className="divide-y divide-white/5">
        {items.map((item, i) => {
          const Icon = KIND_ICON[item.kind];
          const isSel = selected.has(item.id);
          return (
            <li
              key={item.id}
              className={cn("group fade-up flex items-center gap-3 px-4 py-2.5 transition hover:bg-white/[0.03] md:grid md:grid-cols-[20px_1fr_110px_150px_96px] md:gap-4 md:px-5", isSel && "bg-violet-500/10")}
              style={{ animationDelay: `${Math.min(i, 15) * 18}ms` }}
            >
              <button
                onClick={() => onToggle(item.id)}
                aria-label="Select"
                className={cn(
                  "flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition",
                  isSel ? "border-violet-400 bg-violet-500 text-white" : "border-white/15 text-transparent hover:border-white/40"
                )}
              >
                <Check className="h-3 w-3" strokeWidth={3} />
              </button>

              <button
                onClick={() => (item.isDir ? onOpenFolder(item.path) : onOpenFile(item))}
                className="flex min-w-0 flex-1 items-center gap-3 text-left"
              >
                <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br", KIND_TINT[item.kind])}>
                  <Icon className="h-4 w-4" />
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium text-zinc-100 group-hover:text-white">{item.name}</span>
                  <span className="block truncate text-xs text-zinc-500 md:hidden">
                    {item.isDir ? "Folder" : formatSize(item.size)} · {formatDate(item.mtime)}
                  </span>
                </span>
              </button>

              <span className="hidden text-sm tabular-nums text-zinc-400 md:block">{item.isDir ? "—" : formatSize(item.size)}</span>
              <span className="hidden text-sm text-zinc-400 md:block">{formatDate(item.mtime)}</span>

              <div className="flex shrink-0 items-center justify-end gap-1 opacity-100 transition md:opacity-0 md:group-hover:opacity-100">
                {!item.isDir && (
                  <button
                    onClick={() => onDownload(item)}
                    title="Download"
                    className="rounded-lg p-2 text-zinc-400 hover:bg-white/10 hover:text-white"
                  >
                    <Download className="h-4 w-4" />
                  </button>
                )}
                <button
                  onClick={() => onDelete(item)}
                  title="Delete"
                  className="rounded-lg p-2 text-zinc-400 hover:bg-rose-500/15 hover:text-rose-300"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
