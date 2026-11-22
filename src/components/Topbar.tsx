import { useRef, useState } from "react";
import { ArrowDownAZ, Check, Download, FolderPlus, Heart, Loader2, Search, SlidersHorizontal, Trash2, Upload, X, AlertCircle, CheckCircle2 } from "lucide-react";
import { cn } from "../utils/cn";
import { Brand } from "./Sidebar";
import { formatTime } from "../lib/format";
import type { View } from "../lib/types";
import { DATE_OPTIONS, SIZE_OPTIONS, activeFilterCount, DEFAULT_FILTERS, type Filters } from "../lib/filters";

export type SortMode = "newest" | "oldest" | "name" | "size";

interface TopbarProps {
  view: View;
  title: string;
  subtitle: string;
  search: string;
  onSearch: (q: string) => void;
  sort: SortMode;
  onSort: (s: SortMode) => void;
  onUpload: (files: File[]) => void;
  status: "idle" | "scanning" | "ready" | "error" | "unconfigured";
  scanDone: number;
  scanTotal: number;
  lastScanned: number | null;
  error: string | null;
  selectedCount: number;
  onDownloadSelected: () => void;
  onDeleteSelected: () => void;
  onClearSelection: () => void;
  filters: Filters;
  onFilters: (f: Filters) => void;
  typeOpts: { value: Filters["type"]; label: string }[];
  onAddToAlbum?: () => void;
  onFavSelected?: () => void;
}

export function Topbar(p: TopbarProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const mediaRef = useRef<HTMLInputElement>(null);
  const [menu, setMenu] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const nFilters = activeFilterCount(p.filters);

  const statusNode = (() => {
    if (p.status === "unconfigured") return null;
    if (p.status === "scanning")
      return (
        <span className="flex items-center gap-2 text-xs text-zinc-400">
          <Loader2 className="h-3.5 w-3.5 animate-spin text-violet-300" />
          Indexing {p.scanDone}/{Math.max(p.scanTotal, p.scanDone)} folders
        </span>
      );
    if (p.status === "error")
      return (
        <span className="flex items-center gap-2 text-xs text-rose-300">
          <AlertCircle className="h-3.5 w-3.5" /> {p.error ?? "Sync failed"}
        </span>
      );
    if (p.status === "ready")
      return (
        <span className="flex items-center gap-2 text-xs text-emerald-300/80">
          <CheckCircle2 className="h-3.5 w-3.5" />
          Synced{p.lastScanned ? ` · ${formatTime(p.lastScanned)}` : ""}
        </span>
      );
    return null;
  })();

  return (
    <header className="sticky top-0 z-20 border-b border-white/5 bg-ink-950/95">
      <div className="flex flex-col gap-3 px-4 py-3 md:px-6 md:py-4">
        <div className="flex items-center gap-3">
          <div className="md:hidden">
            <Brand />
          </div>
          <div className="hidden min-w-0 md:block">
            <h1 className="truncate text-xl font-bold tracking-tight text-white">{p.title}</h1>
            <p className="truncate text-xs text-zinc-500">{p.subtitle}</p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <div className="hidden lg:block">{statusNode}</div>
            <div className="relative">
              <button
                onClick={() => setMenu((m) => !m)}
                disabled={p.status === "unconfigured"}
                className="group relative flex items-center gap-2 overflow-hidden rounded-xl bg-gradient-to-br from-violet-500 via-indigo-500 to-cyan-500 px-3.5 py-2 text-sm font-semibold text-white shadow-lg shadow-indigo-900/40 transition hover:brightness-110 active:scale-[0.98] disabled:opacity-40"
              >
                <Upload className="h-4 w-4" />
                <span className="hidden sm:inline">Upload</span>
              </button>
              {menu && (
                <>
                  <button aria-label="Close menu" className="fixed inset-0 z-30 cursor-default" onClick={() => setMenu(false)} />
                  <div className="glass-strong pop absolute right-0 top-full z-40 mt-2 w-48 overflow-hidden rounded-xl py-1 text-sm shadow-2xl shadow-black/50">
                    <button
                      onClick={() => {
                        setMenu(false);
                        mediaRef.current?.click();
                      }}
                      className="block w-full px-4 py-2.5 text-left text-zinc-100 hover:bg-white/10"
                    >
                      Photos &amp; videos
                    </button>
                    <button
                      onClick={() => {
                        setMenu(false);
                        inputRef.current?.click();
                      }}
                      className="block w-full px-4 py-2.5 text-left text-zinc-100 hover:bg-white/10"
                    >
                      Any file
                    </button>
                  </div>
                </>
              )}
            </div>
            <input
              ref={mediaRef}
              type="file"
              multiple
              accept="image/*,video/*"
              className="hidden"
              onChange={(e) => {
                const files = Array.from(e.target.files ?? []);
                if (files.length) p.onUpload(files);
                e.target.value = "";
              }}
            />
            <input
              ref={inputRef}
              type="file"
              multiple
              className="hidden"
              onChange={(e) => {
                const files = Array.from(e.target.files ?? []);
                if (files.length) p.onUpload(files);
                e.target.value = "";
              }}
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <label className="glass relative flex min-w-0 flex-1 items-center rounded-xl px-3 py-2 md:max-w-md">
            <Search className="mr-2 h-4 w-4 shrink-0 text-zinc-500" />
            <input
              value={p.search}
              onChange={(e) => p.onSearch(e.target.value)}
              placeholder={`Search ${p.title.toLowerCase()}…`}
              className="w-full bg-transparent text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none"
            />
            {p.search && (
              <button onClick={() => p.onSearch("")} className="text-zinc-500 hover:text-zinc-200">
                <X className="h-4 w-4" />
              </button>
            )}
          </label>

          <div className="glass flex items-center gap-1 rounded-xl px-2 py-1.5">
            <ArrowDownAZ className="h-4 w-4 text-zinc-500" />
            <select
              value={p.sort}
              onChange={(e) => p.onSort(e.target.value as SortMode)}
              className="cursor-pointer bg-transparent py-0.5 pr-1 text-sm text-zinc-200 focus:outline-none [&>option]:bg-ink-850"
            >
              <option value="newest">Newest</option>
              <option value="oldest">Oldest</option>
              <option value="name">Name</option>
              <option value="size">Largest</option>
            </select>
          </div>

          <button
            onClick={() => setShowFilters((v) => !v)}
            className={cn("glass relative flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm text-zinc-200", showFilters && "ring-1 ring-violet-400/50")}
            aria-label="Filters"
          >
            <SlidersHorizontal className="h-4 w-4 text-zinc-400" />
            <span className="hidden sm:inline">Filters</span>
            {nFilters > 0 && <span className="rounded-full bg-violet-500 px-1.5 text-[10px] font-bold text-white">{nFilters}</span>}
          </button>

          <div className="lg:hidden">{statusNode}</div>
        </div>

        {showFilters && (
          <div className="pop flex flex-wrap items-center gap-2">
            {p.typeOpts.length > 0 && (
              <FilterSelect label="Type" value={p.filters.type} options={p.typeOpts} onChange={(v) => p.onFilters({ ...p.filters, type: v as Filters["type"] })} />
            )}
            <FilterSelect label="Date" value={p.filters.date} options={DATE_OPTIONS} onChange={(v) => p.onFilters({ ...p.filters, date: v as Filters["date"] })} />
            <FilterSelect label="Size" value={p.filters.size} options={SIZE_OPTIONS} onChange={(v) => p.onFilters({ ...p.filters, size: v as Filters["size"] })} />
            {nFilters > 0 && (
              <button onClick={() => p.onFilters(DEFAULT_FILTERS)} className="rounded-lg px-2 py-1.5 text-xs text-violet-200 hover:bg-white/10">
                Reset
              </button>
            )}
          </div>
        )}

        {p.selectedCount > 0 && (
          <div className="pop fade-up flex items-center gap-2 rounded-xl border border-violet-400/20 bg-violet-500/10 px-3 py-2">
            <button onClick={p.onClearSelection} className="rounded-lg p-1 text-violet-200 hover:bg-white/10">
              <X className="h-4 w-4" />
            </button>
            <span className="text-sm font-medium text-violet-100">{p.selectedCount} selected</span>
            <div className="ml-auto flex items-center gap-2">
              {p.onFavSelected && (
                <button onClick={p.onFavSelected} className="flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/20" aria-label="Favorite">
                  <Heart className="h-3.5 w-3.5" />
                </button>
              )}
              {p.onAddToAlbum && (
                <button onClick={p.onAddToAlbum} className="flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/20">
                  <FolderPlus className="h-3.5 w-3.5" /> Album
                </button>
              )}
              <button
                onClick={p.onDownloadSelected}
                className={cn("flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/20")}
              >
                <Download className="h-3.5 w-3.5" /> Download
              </button>
              <button
                onClick={p.onDeleteSelected}
                className="flex items-center gap-1.5 rounded-lg bg-rose-500/20 px-3 py-1.5 text-xs font-semibold text-rose-200 hover:bg-rose-500/30"
              >
                <Trash2 className="h-3.5 w-3.5" /> Delete
              </button>
              <button
                onClick={p.onClearSelection}
                className="hidden items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs text-violet-200 hover:bg-white/10 sm:flex"
              >
                <Check className="h-3.5 w-3.5" /> Done
              </button>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}

function FilterSelect({ label, value, options, onChange }: { label: string; value: string; options: { value: string; label: string }[]; onChange: (v: string) => void }) {
  return (
    <label className="glass flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-xs">
      <span className="text-zinc-500">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="cursor-pointer bg-transparent py-0.5 text-xs text-zinc-100 focus:outline-none [&>option]:bg-ink-850"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
