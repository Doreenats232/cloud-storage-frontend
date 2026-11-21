import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AlertTriangle, AppWindow, ChevronRight, Film, FolderOpen, Image as ImageIcon, Loader2, Smartphone, Trash2, UploadCloud, Zap, Layers, ShieldCheck, Sparkles, X } from "lucide-react";
import { clearMediaCache } from "./lib/api";
import { downloadItem, downloadMany } from "./lib/actions";
import { breadcrumbs, formatSize, kindOf, sortItems } from "./lib/format";
import { isConfigured, loadSettings, saveSettings } from "./lib/settings";
import type { Settings, View, VaultItem } from "./lib/types";
import { useLibrary } from "./hooks/useLibrary";
import { useUploads } from "./hooks/useUploads";
import { Sidebar, Brand } from "./components/Sidebar";
import { Topbar, type SortMode } from "./components/Topbar";
import { PhotoGrid } from "./components/PhotoGrid";
import { FileList } from "./components/FileList";
import { AppGrid } from "./components/AppGrid";
import { Viewer } from "./components/Viewer";
import { UploadTray } from "./components/UploadTray";
import { SettingsPanel } from "./components/SettingsPanel";
import { EmptyState, GridSkeleton } from "./components/States";
import { cn } from "./utils/cn";

const VIEW_META: Record<View, { title: string }> = {
  photos: { title: "Photos" },
  videos: { title: "Videos" },
  apps: { title: "Apps" },
  files: { title: "Files" },
};

function matchesQuery(it: VaultItem, q: string) {
  return !q || it.name.toLowerCase().includes(q);
}

export default function App() {
  const [settings, setSettings] = useState<Settings>(() => loadSettings());
  const configured = isConfigured(settings);

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [view, setView] = useState<View>("photos");
  const [dir, setDir] = useState("/");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortMode>("newest");
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  const [confirm, setConfirm] = useState<VaultItem[] | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [toast, setToast] = useState<{ msg: string; tone: "ok" | "err" } | null>(null);
  const [dragging, setDragging] = useState(false);

  const library = useLibrary(settings, configured);
  const { items } = library;
  const uploads = useUploads(settings, library.addItems);

  const notify = useCallback((msg: string, tone: "ok" | "err" = "ok") => setToast({ msg, tone }), []);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 3400);
    return () => window.clearTimeout(t);
  }, [toast]);

  // Reset transient UI when switching views.
  useEffect(() => {
    setSelected(new Set());
    setViewerIndex(null);
  }, [view]);

  useEffect(() => {
    setSelected(new Set());
  }, [dir]);

  const q = search.trim().toLowerCase();

  const totals = useMemo(() => {
    let bytes = 0;
    let files = 0;
    for (const it of items) {
      if (it.isDir) continue;
      bytes += it.size;
      files++;
    }
    return { bytes, files };
  }, [items]);

  const photos = useMemo(
    () => sortItems(items.filter((it) => (it.kind === "image" || it.kind === "video") && matchesQuery(it, q)), sort),
    [items, q, sort]
  );
  const videos = useMemo(() => photos.filter((it) => it.kind === "video"), [photos]);
  const apps = useMemo(
    () => sortItems(items.filter((it) => !it.isDir && it.kind === "app" && matchesQuery(it, q)), sort),
    [items, q, sort]
  );
  const fileEntries = useMemo(() => {
    if (q) return sortItems(items.filter((it) => matchesQuery(it, q)), sort);
    const children = items.filter((it) => it.parent === dir);
    const folders = sortItems(children.filter((it) => it.isDir), "name");
    const files = sortItems(children.filter((it) => !it.isDir), sort);
    return [...folders, ...files];
  }, [items, dir, q, sort]);

  const counts: Record<View, number> = useMemo(
    () => ({
      photos: items.filter((it) => it.kind === "image" || it.kind === "video").length,
      videos: items.filter((it) => it.kind === "video").length,
      apps: items.filter((it) => !it.isDir && it.kind === "app").length,
      files: items.filter((it) => !it.isDir && it.kind !== "image" && it.kind !== "video" && it.kind !== "app").length,
    }),
    [items]
  );

  const mediaList = view === "videos" ? videos : photos;
  const viewerItem = viewerIndex !== null ? mediaList[viewerIndex] : undefined;

  const selectedItems = useMemo(() => items.filter((it) => selected.has(it.id)), [items, selected]);

  const openViewer = useCallback((i: number) => setViewerIndex(i), []);
  const toggleSelect = useCallback((id: string) => {
    setSelected((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }, []);

  /* ---------------- Uploads ---------------- */

  const uploadDirFor = (file: File) => {
    if (view === "files") return dir;
    const k = kindOf(file.name);
    if (k === "image" || k === "video") return "/Photos";
    if (k === "app") return "/Apps";
    return "/Files";
  };

  const handleUpload = (files: File[]) => {
    if (!configured) {
      notify("Connect your vault first", "err");
      setSettingsOpen(true);
      return;
    }
    if (files.length === 0) return;
    uploads.enqueue(files.map((file) => ({ file, dir: uploadDirFor(file) })));
    notify(`Uploading ${files.length} file${files.length > 1 ? "s" : ""}`);
  };

  // Keep latest handler reachable from the global drop listener.
  const uploadRef = useRef(handleUpload);
  uploadRef.current = handleUpload;

  useEffect(() => {
    let depth = 0;
    const hasFiles = (e: DragEvent) => Array.from(e.dataTransfer?.types ?? []).includes("Files");
    const onEnter = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      depth++;
      setDragging(true);
    };
    const onLeave = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      depth = Math.max(0, depth - 1);
      if (depth === 0) setDragging(false);
    };
    const onOver = (e: DragEvent) => {
      if (hasFiles(e)) e.preventDefault();
    };
    const onDrop = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      depth = 0;
      setDragging(false);
      uploadRef.current(Array.from(e.dataTransfer?.files ?? []));
    };
    window.addEventListener("dragenter", onEnter);
    window.addEventListener("dragleave", onLeave);
    window.addEventListener("dragover", onOver);
    window.addEventListener("drop", onDrop);
    return () => {
      window.removeEventListener("dragenter", onEnter);
      window.removeEventListener("dragleave", onLeave);
      window.removeEventListener("dragover", onOver);
      window.removeEventListener("drop", onDrop);
    };
  }, []);

  /* ---------------- Download / delete ---------------- */

  const doDownload = useCallback(
    async (item: VaultItem) => {
      try {
        await downloadItem(library.client, item);
      } catch (e) {
        notify(e instanceof Error ? e.message : "Download failed", "err");
      }
    },
    [library.client, notify]
  );

  const doDownloadSelected = async () => {
    const files = selectedItems.filter((it) => !it.isDir);
    if (files.length === 0) return notify("Select files to download (folders can't be downloaded)", "err");
    notify(`Preparing ${files.length} download${files.length > 1 ? "s" : ""}…`);
    const r = await downloadMany(library.client, files);
    notify(r.failed ? `${r.ok} downloaded, ${r.failed} failed` : `Downloaded ${r.ok} file${r.ok > 1 ? "s" : ""}`, r.failed ? "err" : "ok");
  };

  const doDelete = async () => {
    if (!confirm) return;
    setDeleting(true);
    const ids = confirm.map((i) => i.id);
    try {
      await library.client.remove(ids);
      library.removeItems(ids);
      setSelected((prev) => {
        const n = new Set(prev);
        ids.forEach((id) => n.delete(id));
        return n;
      });
      setViewerIndex(null);
      notify(`Deleted ${ids.length} item${ids.length > 1 ? "s" : ""}`);
    } catch (e) {
      notify(e instanceof Error ? e.message : "Delete failed", "err");
    } finally {
      setDeleting(false);
      setConfirm(null);
    }
  };

  const requestDelete = (list: VaultItem[]) => setConfirm(list);

  const saveSettingsHandler = (s: Settings) => {
    saveSettings(s);
    clearMediaCache();
    setSettings(s);
    setSettingsOpen(false);
    notify("Connected to your vault");
  };

  /* ---------------- Header copy ---------------- */

  const headerSubtitle = (() => {
    if (view === "files") {
      if (q) return `${fileEntries.length} results`;
      return `${fileEntries.length} in ${dir === "/" ? "Vault root" : dir}`;
    }
    const list = view === "photos" ? photos : view === "videos" ? videos : apps;
    const bytes = list.reduce((a, b) => a + (b.isDir ? 0 : b.size), 0);
    return `${list.length.toLocaleString()} item${list.length === 1 ? "" : "s"} · ${formatSize(bytes)}`;
  })();

  const topbarStatus: "idle" | "scanning" | "ready" | "error" | "unconfigured" = !configured
    ? "unconfigured"
    : library.status;

  /* ---------------- Content ---------------- */

  const renderContent = () => {
    if (!configured) return <ConnectScreen initial={settings} onSave={saveSettingsHandler} />;

    if (library.status === "error" && items.length === 0) {
      return (
        <EmptyState
          icon={AlertTriangle}
          title="Can't reach your vault"
          body={library.error ?? "Check the backend URL and API key in Setup."}
          action={
            <div className="flex gap-2">
              <button onClick={() => library.refresh()} className="rounded-xl bg-white/10 px-4 py-2 text-sm font-semibold text-white hover:bg-white/20">
                Try again
              </button>
              <button onClick={() => setSettingsOpen(true)} className="rounded-xl px-4 py-2 text-sm text-zinc-400 hover:bg-white/5">
                Open setup
              </button>
            </div>
          }
        />
      );
    }

    if (library.status === "scanning" && items.length === 0) {
      return (
        <div className="space-y-6">
          <div className="flex items-center gap-3 text-sm text-zinc-400">
            <Loader2 className="h-4 w-4 animate-spin text-violet-300" />
            Indexing your vault in parallel… {library.progress.done}/{Math.max(library.progress.total, library.progress.done)} folders
          </div>
          <GridSkeleton />
        </div>
      );
    }

    if (view === "photos" || view === "videos") {
      if (mediaList.length === 0) {
        return (
          <EmptyState
            icon={view === "photos" ? ImageIcon : Film}
            title={q ? "No matches" : view === "photos" ? "No photos yet" : "No videos yet"}
            body={q ? `Nothing matches "${search}".` : "Drop images or videos anywhere on this page to start building your library."}
          />
        );
      }
      return (
        <PhotoGrid
          items={mediaList}
          client={library.client}
          selected={selected}
          onOpen={openViewer}
          onToggle={toggleSelect}
        />
      );
    }

    if (view === "apps") {
      if (apps.length === 0) {
        return (
          <EmptyState
            icon={AppWindow}
            title={q ? "No matching apps" : "No apps yet"}
            body="APKs, EXEs, DMGs, IPAs and other installers show up here. Upload one and it's ready to download anywhere."
          />
        );
      }
      return <AppGrid items={apps} selected={selected} onToggle={toggleSelect} onDownload={doDownload} onDelete={(it) => requestDelete([it])} />;
    }

    // Files
    return (
      <div className="space-y-4 pb-28 md:pb-10">
        {!q && (
          <nav className="flex flex-wrap items-center gap-1 text-sm">
            {breadcrumbs(dir).map((b, i, arr) => (
              <span key={b.path} className="flex items-center gap-1">
                <button
                  onClick={() => setDir(b.path)}
                  className={cn(
                    "rounded-lg px-2 py-1 transition",
                    i === arr.length - 1 ? "font-semibold text-white" : "text-zinc-400 hover:bg-white/5 hover:text-zinc-100"
                  )}
                >
                  {i === 0 ? <FolderOpen className="inline h-4 w-4" /> : b.label}
                </button>
                {i < arr.length - 1 && <ChevronRight className="h-3.5 w-3.5 text-zinc-600" />}
              </span>
            ))}
          </nav>
        )}
        {fileEntries.length === 0 ? (
          <EmptyState
            icon={FolderOpen}
            title={q ? "No matches" : "This folder is empty"}
            body={q ? `Nothing matches "${search}".` : "Upload files here or drop them anywhere on the page."}
          />
        ) : (
          <FileList
            items={fileEntries}
            selected={selected}
            onOpenFolder={(p) => setDir(p)}
            onOpenFile={(it) => {
              const idx = photos.findIndex((p) => p.id === it.id);
              if (idx >= 0) {
                setView(it.kind === "video" ? "videos" : "photos");
                setViewerIndex(it.kind === "video" ? videos.findIndex((v) => v.id === it.id) : idx);
              } else {
                void doDownload(it);
              }
            }}
            onToggle={toggleSelect}
            onDownload={doDownload}
            onDelete={(it) => requestDelete([it])}
          />
        )}
      </div>
    );
  };

  return (
    <div className="ambient flex h-dvh w-full overflow-hidden text-zinc-100">
      <Sidebar
        view={view}
        onView={setView}
        counts={counts}
        totalBytes={totals.bytes}
        totalFiles={totals.files}
        busy={library.status === "scanning"}
        onRefresh={() => (configured ? library.refresh() : setSettingsOpen(true))}
        onSettings={() => setSettingsOpen(true)}
      />

      <main className="relative flex min-w-0 flex-1 flex-col">
        <Topbar
          view={view}
          title={VIEW_META[view].title}
          subtitle={headerSubtitle}
          search={search}
          onSearch={setSearch}
          sort={sort}
          onSort={setSort}
          onUpload={handleUpload}
          status={topbarStatus}
          scanDone={library.progress.done}
          scanTotal={library.progress.total}
          lastScanned={library.lastScanned}
          error={library.error}
          selectedCount={selected.size}
          onDownloadSelected={doDownloadSelected}
          onDeleteSelected={() => requestDelete(selectedItems)}
          onClearSelection={() => setSelected(new Set())}
        />

        <div className="scroll-thin flex-1 overflow-y-auto px-4 py-5 md:px-6 md:py-6">{renderContent()}</div>
      </main>

      {viewerItem && viewerIndex !== null && (
        <Viewer
          items={mediaList}
          index={viewerIndex}
          client={library.client}
          onClose={() => setViewerIndex(null)}
          onNavigate={(i) => setViewerIndex(i)}
          onDownload={doDownload}
          onDelete={(it) => requestDelete([it])}
        />
      )}

      <UploadTray tasks={uploads.tasks} onClear={uploads.clearFinished} />

      {/* Drag & drop overlay */}
      {dragging && configured && (
        <div className="pointer-events-none fixed inset-0 z-[70] flex items-center justify-center bg-ink-950/95">
          <div className="pop rounded-3xl border-2 border-dashed border-violet-400/60 bg-violet-500/10 px-12 py-10 text-center">
            <UploadCloud className="mx-auto mb-3 h-12 w-12 text-violet-300" />
            <p className="text-lg font-semibold text-white">Drop to upload</p>
            <p className="text-sm text-zinc-400">Photos go to /Photos, apps to /Apps, everything else to /Files</p>
          </div>
        </div>
      )}

      {/* Settings modal */}
      {settingsOpen && (
        <Modal onClose={() => setSettingsOpen(false)} title="Setup" subtitle="Connect your terabox-vault-backend">
          <SettingsPanel initial={settings} onSave={saveSettingsHandler} onCancel={() => setSettingsOpen(false)} />
        </Modal>
      )}

      {/* Delete confirmation */}
      {confirm && (
        <Modal
          onClose={() => !deleting && setConfirm(null)}
          title={`Delete ${confirm.length} item${confirm.length > 1 ? "s" : ""}?`}
          subtitle="This removes them from your TeraBox vault."
          zIndex="z-[80]"
          narrow
        >
          <ul className="scroll-thin mb-5 max-h-40 space-y-1 overflow-y-auto rounded-xl bg-black/30 p-3 text-sm text-zinc-300">
            {confirm.slice(0, 50).map((it) => (
              <li key={it.id} className="truncate">
                • {it.name}
              </li>
            ))}
            {confirm.length > 50 && <li className="text-zinc-500">…and {confirm.length - 50} more</li>}
          </ul>
          <div className="flex justify-end gap-2">
            <button onClick={() => setConfirm(null)} disabled={deleting} className="rounded-xl px-4 py-2.5 text-sm text-zinc-400 hover:bg-white/5">
              Cancel
            </button>
            <button
              onClick={doDelete}
              disabled={deleting}
              className="flex items-center gap-2 rounded-xl bg-rose-500 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-rose-900/30 hover:bg-rose-400 disabled:opacity-60"
            >
              {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              Delete
            </button>
          </div>
        </Modal>
      )}

      {/* Toast */}
      {toast && (
        <div className="pop fixed left-1/2 top-4 z-[90] -translate-x-1/2">
          <div
            className={cn(
              "glass-strong flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium shadow-2xl",
              toast.tone === "err" ? "text-rose-200" : "text-zinc-100"
            )}
          >
            <span className={cn("h-2 w-2 rounded-full", toast.tone === "err" ? "bg-rose-400" : "bg-emerald-400")} />
            {toast.msg}
          </div>
        </div>
      )}
    </div>
  );
}

function Modal({
  title,
  subtitle,
  children,
  onClose,
  zIndex = "z-[60]",
  narrow = false,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  onClose: () => void;
  zIndex?: string;
  narrow?: boolean;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className={cn("fixed inset-0 flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-4", zIndex)} onMouseDown={onClose}>
      <div
        onMouseDown={(e) => e.stopPropagation()}
        className={cn(
          "glass-strong pop scroll-thin max-h-[92dvh] w-full overflow-y-auto rounded-t-3xl p-6 shadow-2xl shadow-black/60 sm:rounded-3xl",
          narrow ? "sm:max-w-md" : "sm:max-w-2xl"
        )}
      >
        <div className="mb-5 flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-bold tracking-tight text-white">{title}</h2>
            {subtitle && <p className="mt-0.5 text-sm text-zinc-500">{subtitle}</p>}
          </div>
          <button onClick={onClose} className="rounded-xl p-2 text-zinc-400 hover:bg-white/10 hover:text-white" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function ConnectScreen({ initial, onSave }: { initial: Settings; onSave: (s: Settings) => void }) {
  const features = [
    { icon: ImageIcon, title: "Google Photos feel", text: "Date-grouped grid, lazy thumbnails and a full-screen viewer." },
    { icon: Zap, title: "Parallel everything", text: "Folders scanned, previews loaded and files uploaded concurrently." },
    { icon: AppWindow, title: "Apps & installers", text: "APK, EXE, DMG and IPA files get their own library." },
    { icon: Layers, title: "Files, organized", text: "Browse folders, search, multi-select, bulk download and delete." },
  ];
  return (
    <div className="mx-auto grid min-h-full max-w-5xl items-center gap-8 py-6 lg:grid-cols-[1.1fr_1fr]">
      <div className="fade-up space-y-6">
        <div className="space-y-4">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-zinc-300">
            <Sparkles className="h-3.5 w-3.5 text-violet-300" /> One place for everything you store
          </div>
          <h1 className="text-4xl font-extrabold leading-[1.1] tracking-tight text-white md:text-5xl">
            Your <span className="brand-text">TeraBox vault</span>, reimagined.
          </h1>
          <p className="max-w-lg text-base leading-relaxed text-zinc-400">
            Connect your terabox-vault-backend and browse your photos, videos, apps and files like a modern cloud gallery.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {features.map((f) => (
            <div key={f.title} className="glass rounded-2xl p-4">
              <f.icon className="mb-2 h-5 w-5 text-violet-300" />
              <p className="text-sm font-semibold text-white">{f.title}</p>
              <p className="mt-0.5 text-xs leading-relaxed text-zinc-500">{f.text}</p>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-4 text-xs text-zinc-600">
          <span className="flex items-center gap-1.5">
            <ShieldCheck className="h-3.5 w-3.5" /> Key stays in this browser
          </span>
          <span className="flex items-center gap-1.5">
            <Smartphone className="h-3.5 w-3.5" /> Works on mobile
          </span>
        </div>
      </div>

      <div className="glass-strong fade-up rounded-3xl p-6 md:p-8" style={{ animationDelay: "120ms" }}>
        <div className="mb-6 flex items-center gap-3">
          <Brand />
        </div>
        <h2 className="mb-1 text-xl font-bold text-white">Connect your vault</h2>
        <p className="mb-6 text-sm text-zinc-500">Paste your backend URL and an API key to get started.</p>
        <SettingsPanel initial={initial} onSave={onSave} variant="setup" />
      </div>
    </div>
  );
}
