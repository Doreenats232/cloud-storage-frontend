import { Heart, Pencil, Plus, Trash2 } from "lucide-react";
import { cn } from "../utils/cn";
import type { Album } from "../hooks/useCollections";

interface Props {
  albums: Album[];
  counts: Record<string, number>;
  favCount: number;
  active: string;
  onSelect: (id: string) => void;
  onNew: () => void;
  onRename: (id: string) => void;
  onDelete: (id: string) => void;
}

const chip = (on: boolean) =>
  cn(
    "flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition",
    on ? "border-violet-400/60 bg-violet-500/20 text-violet-100" : "border-white/10 bg-white/5 text-zinc-300 hover:bg-white/10"
  );

/** Chips row: All · Favorites · your albums · + New album. */
export function AlbumBar({ albums, counts, favCount, active, onSelect, onNew, onRename, onDelete }: Props) {
  const isAlbum = albums.some((a) => a.id === active);
  return (
    <div className="mb-4 space-y-2">
      <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1">
        <button onClick={() => onSelect("all")} className={chip(active === "all")}>
          All
        </button>
        <button onClick={() => onSelect("fav")} className={chip(active === "fav")}>
          <Heart className="h-3.5 w-3.5" /> Favorites <span className="text-zinc-500">{favCount}</span>
        </button>
        {albums.map((a) => (
          <button key={a.id} onClick={() => onSelect(a.id)} className={chip(active === a.id)}>
            {a.name} <span className="text-zinc-500">{counts[a.id] ?? 0}</span>
          </button>
        ))}
        <button onClick={onNew} className={chip(false)}>
          <Plus className="h-3.5 w-3.5" /> New album
        </button>
      </div>
      {isAlbum && (
        <div className="flex items-center gap-2 text-xs">
          <button onClick={() => onRename(active)} className="flex items-center gap-1 rounded-lg px-2 py-1 text-zinc-400 hover:bg-white/10">
            <Pencil className="h-3 w-3" /> Rename
          </button>
          <button onClick={() => onDelete(active)} className="flex items-center gap-1 rounded-lg px-2 py-1 text-rose-300/80 hover:bg-white/10">
            <Trash2 className="h-3 w-3" /> Delete album
          </button>
          <span className="text-zinc-600">Photos stay in your vault</span>
        </div>
      )}
    </div>
  );
}
