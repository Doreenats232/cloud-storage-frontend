import { memo, useEffect, useRef, useState } from "react";
import { Check, FileWarning, Film, Heart, Play } from "lucide-react";
import type { VaultClient } from "../lib/api";
import { requestSlot, thumbCache } from "../lib/slots";
import { getThumb, putThumb } from "../lib/thumbdb";
import { cn } from "../utils/cn";
import type { VaultItem } from "../lib/types";

interface MediaThumbProps {
  item: VaultItem;
  index: number;
  client: VaultClient;
  selected: boolean;
  selectActive: boolean;
  fav: boolean;
  onFav: (id: string) => void;
  onOpen: (index: number) => void;
  onToggle: (id: string) => void;
}

const THUMB = 360;

/** Download the full image once, shrink it to a small thumbnail and cache that. */
function loadThumb(url: string, id: string, done: (src: string | null) => void): () => void {
  let cancelled = false;
  const attempt = (cors: boolean) => {
    const img = new Image();
    if (cors) img.crossOrigin = "anonymous";
    img.decoding = "async";
    img.onload = () => {
      if (cancelled) return;
      try {
        const r = Math.min(1, THUMB / Math.max(img.naturalWidth, img.naturalHeight));
        const c = document.createElement("canvas");
        c.width = Math.max(1, Math.round(img.naturalWidth * r));
        c.height = Math.max(1, Math.round(img.naturalHeight * r));
        c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
        c.toBlob(
          (b) => {
            if (cancelled) return;
            if (!b) return done(url);
            const u = URL.createObjectURL(b);
            thumbCache.set(id, u);
            void putThumb(id, b);
            done(u);
          },
          "image/jpeg",
          0.72
        );
      } catch {
        done(url);
      }
    };
    img.onerror = () => {
      if (cancelled) return;
      if (cors) attempt(false);
      else done(null);
    };
    img.src = url;
    stop = () => {
      img.onload = null;
      img.onerror = null;
      img.src = "";
    };
  };
  let stop = () => undefined as void;
  attempt(true);
  return () => {
    cancelled = true;
    stop();
  };
}

/** One square tile in the photo/video grid. Videos are a light placeholder (no network). */
function MediaThumbBase({ item, index, client, selected, selectActive, fav, onFav, onOpen, onToggle }: MediaThumbProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [near, setNear] = useState(false);
  const [src, setSrc] = useState<string | null>(() => thumbCache.get(item.id) ?? null);
  const [failed, setFailed] = useState(false);
  const [thumbBad, setThumbBad] = useState(false);
  const isVideo = item.kind === "video";

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") {
      setNear(true);
      return;
    }
    const io = new IntersectionObserver(([e]) => setNear(e.isIntersecting), { rootMargin: "250px" });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (src || failed || !near) return;
    let dead = false;
    let stop: (() => void) | undefined;
    let release: () => void = () => undefined;
    void (async () => {
      // 1) saved on the phone from an earlier visit
      const saved = await getThumb(item.id);
      if (dead) return;
      if (saved) {
        const u = URL.createObjectURL(saved);
        thumbCache.set(item.id, u);
        setSrc(u);
        return;
      }
      // 2) TeraBox's own small thumbnail (photos and video frames), else 3) the file itself (photos only)
      const source = item.thumb && !thumbBad ? item.thumb : !isVideo ? client.streamUrl(item.id, item.path) : null;
      if (!source) return;
      release = requestSlot(() => {
        stop = loadThumb(source, item.id, (s) => {
          if (s) setSrc(s);
          else if (source === item.thumb) setThumbBad(true);
          else setFailed(true);
          release();
        });
      });
    })();
    return () => {
      dead = true;
      stop?.();
      release();
    };
  }, [near, isVideo, src, failed, thumbBad, client, item.id, item.path, item.thumb]);

  return (
    <div
      ref={ref}
      onClick={() => (selectActive ? onToggle(item.id) : onOpen(index))}
      className={cn(
        "group relative aspect-square cursor-pointer overflow-hidden rounded-xl bg-ink-800 ring-1 ring-white/5",
        selected && "ring-2 ring-violet-400"
      )}
    >
      {src ? (
        <img
          src={src}
          alt=""
          decoding="async"
          onError={() => {
            if (src === item.thumb) {
              setThumbBad(true);
              setSrc(null);
            } else setFailed(true);
          }}
          className="absolute inset-0 h-full w-full object-cover"
        />
      ) : isVideo ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-gradient-to-br from-violet-900/40 to-ink-900 text-violet-200/80">
          <Film className="h-8 w-8" />
          <span className="max-w-[85%] truncate text-[10px] text-zinc-400">{item.name}</span>
        </div>
      ) : failed ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-gradient-to-br from-rose-500/10 to-zinc-900 text-rose-300/70">
          <FileWarning className="h-6 w-6" />
          <span className="text-[10px]">Preview failed</span>
        </div>
      ) : (
        <div className="skeleton absolute inset-0" />
      )}

      {isVideo && (
        <div className="pointer-events-none absolute bottom-2 left-2 flex items-center gap-1 rounded-full bg-black/70 px-2 py-0.5 text-[10px] font-semibold text-white">
          <Play className="h-2.5 w-2.5 fill-white" /> Video
        </div>
      )}

      {(fav || selectActive) && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onFav(item.id);
          }}
          aria-label={fav ? "Remove favorite" : "Favorite"}
          className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-black/50"
        >
          <Heart className={cn("h-3.5 w-3.5", fav ? "fill-rose-500 text-rose-500" : "text-white/80")} />
        </button>
      )}

      <button
        onClick={(e) => {
          e.stopPropagation();
          onToggle(item.id);
        }}
        aria-label={selected ? "Deselect" : "Select"}
        className={cn(
          "absolute left-2 top-2 flex h-6 w-6 items-center justify-center rounded-full border-2",
          selected
            ? "border-violet-400 bg-violet-500 text-white opacity-100"
            : "border-white/80 bg-black/50 text-transparent opacity-0 group-hover:opacity-100",
          selectActive && !selected && "opacity-100"
        )}
      >
        <Check className="h-3.5 w-3.5" strokeWidth={3} />
      </button>
    </div>
  );
}

export const MediaThumb = memo(MediaThumbBase);
