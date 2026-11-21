import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { VaultClient } from "../lib/api";
import { createLimiter } from "../lib/limiter";
import type { Settings, VaultItem } from "../lib/types";

const MAX_FOLDERS = 2000;
const MAX_ITEMS = 25000;
/** Parallel folder listings during a scan. */
const SCAN_CONCURRENCY = 5;

export type LibraryStatus = "idle" | "scanning" | "ready" | "error";

/**
 * Builds a full index of the vault by walking every folder in parallel.
 * Once indexed, Photos / Videos / Apps / Files are all just filters over it,
 * so switching between views is instant. Each new scan supersedes the last.
 */
export function useLibrary(settings: Settings, enabled: boolean) {
  const [items, setItems] = useState<VaultItem[]>([]);
  const [status, setStatus] = useState<LibraryStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [lastScanned, setLastScanned] = useState<number | null>(null);

  const mapRef = useRef<Map<string, VaultItem>>(new Map());
  const genRef = useRef(0);

  const client = useMemo(
    () => new VaultClient(settings),
    // Only rebuild when the actual connection details change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [settings.baseUrl, settings.apiKey]
  );

  const flushNow = useCallback(() => {
    setItems(Array.from(mapRef.current.values()));
  }, []);

  const scan = useCallback(async () => {
    if (!enabled) return;
    const gen = ++genRef.current;
    const alive = () => gen === genRef.current;
    const limit = createLimiter(SCAN_CONCURRENCY);
    const seen = new Set<string>(["/"]);
    const next = new Map<string, VaultItem>();
    mapRef.current = next;
    let foldersDone = 0;
    let failedFolders = 0;
    let flushTimer: number | null = null;

    const scheduleFlush = () => {
      if (flushTimer !== null) return;
      flushTimer = window.setTimeout(() => {
        flushTimer = null;
        if (!alive()) return;
        flushNow();
        setProgress({ done: foldersDone, total: seen.size });
      }, 250);
    };

    const walk = async (dir: string, isRoot: boolean): Promise<void> => {
      const children: Promise<void>[] = [];
      try {
        const entries = await limit(() => client.list(dir));
        if (!alive()) return;
        for (const e of entries) {
          if (next.size >= MAX_ITEMS) break;
          next.set(e.id, e);
          if (e.isDir && !seen.has(e.path) && seen.size < MAX_FOLDERS) {
            seen.add(e.path);
            children.push(walk(e.path, false));
          }
        }
      } catch (err) {
        if (isRoot) throw err;
        failedFolders++;
      } finally {
        foldersDone++;
        scheduleFlush();
      }
      await Promise.all(children);
    };

    setStatus("scanning");
    setError(null);
    setProgress({ done: 0, total: 1 });

    try {
      await walk("/", true);
      if (!alive()) return;
      if (flushTimer !== null) window.clearTimeout(flushTimer);
      flushNow();
      setProgress({ done: foldersDone, total: seen.size });
      setLastScanned(Date.now());
      setStatus("ready");
      if (failedFolders > 0) setError(`${failedFolders} folder(s) could not be read.`);
    } catch (err) {
      if (!alive()) return;
      setError(err instanceof Error ? err.message : "Could not reach the vault.");
      setStatus("error");
    }
  }, [client, enabled, flushNow]);

  useEffect(() => {
    if (!enabled) {
      genRef.current++;
      setStatus("idle");
      setItems([]);
      mapRef.current = new Map();
      return;
    }
    void scan();
    return () => {
      // Invalidate any in-flight scan when settings change or we unmount.
      genRef.current++;
    };
  }, [enabled, scan]);

  /** Add items without a full rescan (e.g. right after an upload). */
  const addItems = useCallback(
    (newItems: VaultItem[]) => {
      for (const it of newItems) mapRef.current.set(it.id, it);
      flushNow();
    },
    [flushNow]
  );

  /** Remove items locally after a successful delete. */
  const removeItems = useCallback(
    (ids: string[]) => {
      for (const id of ids) mapRef.current.delete(id);
      flushNow();
    },
    [flushNow]
  );

  return {
    client,
    items,
    status,
    error,
    progress,
    lastScanned,
    refresh: scan,
    addItems,
    removeItems,
  };
}
