import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Download, Loader2, Share2, Trash2, X, FileWarning } from "lucide-react";
import { Capacitor } from "@capacitor/core";
import { Share } from "@capacitor/share";
import { resolveMediaUrl, type VaultClient } from "../lib/api";
import { useMediaUrl } from "../hooks/useMedia";
import { VideoPlayer } from "./VideoPlayer";
import { formatDate, formatSize } from "../lib/format";
import type { VaultItem } from "../lib/types";

interface ViewerProps {
  items: VaultItem[];
  index: number;
  client: VaultClient;
  onClose: () => void;
  onNavigate: (index: number) => void;
  onDownload: (item: VaultItem) => void;
  onDelete: (item: VaultItem) => void;
}

export function Viewer({ items, index, client, onClose, onNavigate, onDownload, onDelete }: ViewerProps) {
  const item = items[index];
  const { url, error } = useMediaUrl(client, item.id, true, item.path);
  const [loaded, setLoaded] = useState(false);
  const [shareMenu, setShareMenu] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  // Keyboard controls + scroll lock
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight" && index < items.length - 1) onNavigate(index + 1);
      if (e.key === "ArrowLeft" && index > 0) onNavigate(index - 1);
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [index, items.length, onClose, onNavigate]);

  // Warm up the neighbours so the next/previous photo appears instantly.
  useEffect(() => {
    for (const j of [index + 1, index + 2, index - 1]) {
      const n = items[j];
      if (n && n.kind !== "folder") resolveMediaUrl(client, n.id, n.path).catch(() => undefined);
    }
  }, [index, items, client]);

  useEffect(() => setLoaded(false), [item.id]);

  const share = async (hours: number) => {
    setShareMenu(false);
    setNote("Making link…");
    try {
      const link = await client.signLink(item.path, hours * 3600);
      if (Capacitor.isNativePlatform()) {
        await Share.share({ title: item.name, text: `${item.name} (link works for ${hours} h)`, url: link, dialogTitle: "Share link" });
        setNote(null);
      } else if (navigator.share) {
        await navigator.share({ title: item.name, url: link });
        setNote(null);
      } else {
        await navigator.clipboard.writeText(link);
        setNote("Link copied");
      }
    } catch (e) {
      if (e instanceof Error && /cancel|abort/i.test(e.name + e.message)) setNote(null);
      else setNote(e instanceof Error ? e.message : "Could not share");
    }
    window.setTimeout(() => setNote(null), 2500);
  };

  return (
    <div className="pop fixed inset-0 z-50 flex flex-col bg-black/90">
      {/* Top bar */}
      <div className="flex items-center gap-3 px-4 py-3 md:px-6">
        <button onClick={onClose} className="rounded-xl bg-white/10 p-2 text-white transition hover:bg-white/20" aria-label="Close">
          <X className="h-5 w-5" />
        </button>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-white">{item.name}</p>
          <p className="truncate text-xs text-zinc-400">
            {formatDate(item.mtime)} · {formatSize(item.size)} · {index + 1} / {items.length}
          </p>
        </div>
        <div className="relative">
          <button
            onClick={() => setShareMenu((m) => !m)}
            className="flex items-center gap-2 rounded-xl bg-white/10 px-3 py-2 text-sm font-medium text-white transition hover:bg-white/20"
            aria-label="Share"
          >
            <Share2 className="h-4 w-4" /> <span className="hidden sm:inline">Share</span>
          </button>
          {shareMenu && (
            <>
              <button aria-label="Close" className="fixed inset-0 z-10 cursor-default" onClick={() => setShareMenu(false)} />
              <div className="glass-strong pop absolute right-0 top-full z-20 mt-2 w-44 overflow-hidden rounded-xl py-1 text-sm shadow-2xl shadow-black/60">
                <p className="px-4 pb-1 pt-2 text-[11px] uppercase tracking-wide text-zinc-500">Link works for</p>
                {[1, 6, 24].map((h) => (
                  <button key={h} onClick={() => void share(h)} className="block w-full px-4 py-2.5 text-left text-zinc-100 hover:bg-white/10">
                    {h === 24 ? "24 hours" : h === 1 ? "1 hour" : `${h} hours`}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
        <button
          onClick={() => onDownload(item)}
          className="flex items-center gap-2 rounded-xl bg-white/10 px-3 py-2 text-sm font-medium text-white transition hover:bg-white/20"
        >
          <Download className="h-4 w-4" /> <span className="hidden sm:inline">Download</span>
        </button>
        <button
          onClick={() => onDelete(item)}
          className="rounded-xl bg-rose-500/15 p-2 text-rose-300 transition hover:bg-rose-500/30"
          aria-label="Delete"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      {/* Stage */}
      <div className="relative flex min-h-0 flex-1 items-center justify-center px-14 md:px-20">
        {index > 0 && (
          <button
            onClick={() => onNavigate(index - 1)}
            className="absolute left-3 top-1/2 z-10 -translate-y-1/2 rounded-full bg-white/10 p-3 text-white transition hover:scale-105 hover:bg-white/20"
            aria-label="Previous"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
        )}
        {index < items.length - 1 && (
          <button
            onClick={() => onNavigate(index + 1)}
            className="absolute right-3 top-1/2 z-10 -translate-y-1/2 rounded-full bg-white/10 p-3 text-white transition hover:scale-105 hover:bg-white/20"
            aria-label="Next"
          >
            <ChevronRight className="h-6 w-6" />
          </button>
        )}

        {!url && !error && (
          <div className="flex flex-col items-center gap-3 text-zinc-400">
            <Loader2 className="h-8 w-8 animate-spin text-violet-300" />
            <span className="text-sm">Loading {item.kind === "video" ? "video" : "photo"}…</span>
          </div>
        )}

        {error && (
          <div className="flex flex-col items-center gap-3 text-center text-rose-300">
            <FileWarning className="h-10 w-10" />
            <p className="max-w-sm text-sm">{error}</p>
            <button onClick={() => onDownload(item)} className="rounded-lg bg-white/10 px-3 py-1.5 text-xs text-white hover:bg-white/20">
              Try download instead
            </button>
          </div>
        )}

        {url && item.kind === "video" && <VideoPlayer key={url} src={url} id={item.id} />}

        {url && item.kind !== "video" && (
          <img
            key={url}
            src={url}
            alt={item.name}
            onLoad={() => setLoaded(true)}
            className={`max-h-full max-w-full select-none rounded-2xl object-contain shadow-2xl shadow-black/60 transition duration-500 ${loaded ? "opacity-100 scale-100" : "scale-[0.98] opacity-0"}`}
            draggable={false}
          />
        )}
      </div>

      {note && (
        <div className="pointer-events-none absolute bottom-14 left-1/2 -translate-x-1/2 rounded-full bg-black/80 px-4 py-2 text-xs text-white">{note}</div>
      )}
      <div className="pb-4 text-center text-[11px] text-zinc-600">← → to browse · Esc to close</div>
    </div>
  );
}
