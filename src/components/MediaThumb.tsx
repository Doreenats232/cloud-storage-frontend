import { useState } from "react";
import { Check, FileWarning, Play } from "lucide-react";
import type { VaultClient } from "../lib/api";
import { useInView, useMediaUrl } from "../hooks/useMedia";
import { cn } from "../utils/cn";
import type { VaultItem } from "../lib/types";

interface MediaThumbProps {
  item: VaultItem;
  client: VaultClient;
  selected: boolean;
  selectActive: boolean;
  onOpen: () => void;
  onToggle: () => void;
}

/** One square tile in the photo/video grid. Only fetches its URL once it scrolls into view. */
export function MediaThumb({ item, client, selected, selectActive, onOpen, onToggle }: MediaThumbProps) {
  const [ref, visible] = useInView<HTMLDivElement>("500px");
  const { url: resolved, error } = useMediaUrl(client, item.id, visible);
  const url = item.thumb ?? resolved;
  const [loaded, setLoaded] = useState(false);
  const isVideo = item.kind === "video";

  return (
    <div
      ref={ref}
      onClick={() => (selectActive ? onToggle() : onOpen())}
      className={cn(
        "group tile-shine relative aspect-square cursor-pointer overflow-hidden rounded-xl bg-ink-800 ring-1 ring-white/5 transition duration-300",
        "hover:-translate-y-0.5 hover:shadow-xl hover:shadow-violet-950/40 hover:ring-white/15",
        selected && "ring-2 ring-violet-400 shadow-lg shadow-violet-900/40"
      )}
    >
      {/* Placeholder while loading */}
      {!loaded && !error && <div className="skeleton absolute inset-0" />}

      {url && !isVideo && (
        <img
          src={url}
          alt={item.name}
          loading="lazy"
          decoding="async"
          onLoad={() => setLoaded(true)}
          onError={() => setLoaded(true)}
          className={cn(
            "absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-105",
            loaded ? "opacity-100" : "opacity-0"
          )}
        />
      )}

      {url && isVideo && (
        <video
          src={`${url}#t=0.1`}
          preload="metadata"
          muted
          playsInline
          onLoadedData={() => setLoaded(true)}
          onError={() => setLoaded(true)}
          className={cn(
            "absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-105",
            loaded ? "opacity-100" : "opacity-0"
          )}
        />
      )}

      {error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-gradient-to-br from-rose-500/10 to-zinc-900 text-rose-300/70">
          <FileWarning className="h-6 w-6" />
          <span className="text-[10px]">Preview failed</span>
        </div>
      )}

      {/* Gradient + name on hover */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent p-2 opacity-0 transition duration-300 group-hover:opacity-100">
        <p className="truncate text-[11px] font-medium text-white drop-shadow">{item.name}</p>
      </div>

      {isVideo && (
        <div className="pointer-events-none absolute bottom-2 left-2 flex items-center gap-1 rounded-full bg-black/55 px-2 py-0.5 text-[10px] font-semibold text-white backdrop-blur">
          <Play className="h-2.5 w-2.5 fill-white" /> Video
        </div>
      )}

      {/* Selection checkbox */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onToggle();
        }}
        aria-label={selected ? "Deselect" : "Select"}
        className={cn(
          "absolute left-2 top-2 flex h-6 w-6 items-center justify-center rounded-full border-2 transition",
          selected
            ? "border-violet-400 bg-violet-500 text-white opacity-100"
            : "border-white/80 bg-black/30 text-transparent opacity-0 backdrop-blur group-hover:opacity-100",
          selectActive && !selected && "opacity-100"
        )}
      >
        <Check className="h-3.5 w-3.5" strokeWidth={3} />
      </button>
    </div>
  );
}
