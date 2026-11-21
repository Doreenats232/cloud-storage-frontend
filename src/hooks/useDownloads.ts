import { useCallback, useEffect, useRef, useState } from "react";
import { Capacitor } from "@capacitor/core";
import type { VaultClient } from "../lib/api";
import { downloadItem } from "../lib/actions";
import { uid } from "../lib/limiter";
import { Downloader } from "../lib/native";
import type { VaultItem } from "../lib/types";

export interface DownloadTask {
  id: string;
  nativeId?: number;
  item: VaultItem;
  name: string;
  size: number;
  downloaded: number;
  status: "starting" | "running" | "paused" | "done" | "error";
  error?: string;
}

const safeName = (n: string) => n.replace(/[\\/:*?"<>|]/g, "_");

/** Downloads through Android's DownloadManager: real progress here + a system notification. */
export function useDownloads(client: VaultClient, onError: (msg: string) => void) {
  const [tasks, setTasks] = useState<DownloadTask[]>([]);
  const tasksRef = useRef<DownloadTask[]>([]);
  tasksRef.current = tasks;
  const native = Capacitor.isNativePlatform();

  const patch = useCallback((id: string, p: Partial<DownloadTask>) => {
    setTasks((ts) => ts.map((t) => (t.id === id ? { ...t, ...p } : t)));
  }, []);

  const startOne = useCallback(
    async (item: VaultItem, existing?: string) => {
      const id = existing ?? uid();
      if (existing) patch(id, { status: "starting", error: undefined, downloaded: 0 });
      else
        setTasks((ts) => [{ id, item, name: item.name, size: item.size, downloaded: 0, status: "starting" }, ...ts]);
      try {
        const url = client.streamUrl(item.id, item.path, true, item.name);
        const r = await Downloader.start({ url, name: safeName(item.name) });
        patch(id, { nativeId: r.id, status: "running" });
      } catch (e) {
        patch(id, { status: "error", error: e instanceof Error ? e.message : "Could not start download" });
      }
    },
    [client, patch]
  );

  const start = useCallback(
    (items: VaultItem[]) => {
      if (!native) {
        for (const it of items) void downloadItem(client, it).catch((e) => onError(e instanceof Error ? e.message : "Download failed"));
        return;
      }
      for (const it of items) void startOne(it);
    },
    [native, client, startOne, onError]
  );

  const retry = useCallback(
    (id: string) => {
      const t = tasksRef.current.find((x) => x.id === id);
      if (t) void startOne(t.item, id);
    },
    [startOne]
  );

  const remove = useCallback((id: string) => {
    const t = tasksRef.current.find((x) => x.id === id);
    if (t?.nativeId !== undefined && (t.status === "running" || t.status === "paused")) {
      void Downloader.cancel({ id: t.nativeId }).catch(() => undefined);
    }
    setTasks((ts) => ts.filter((x) => x.id !== id));
  }, []);

  const clearFinished = useCallback(() => {
    setTasks((ts) => ts.filter((t) => t.status === "starting" || t.status === "running" || t.status === "paused"));
  }, []);

  const active = tasks.some((t) => t.nativeId !== undefined && (t.status === "running" || t.status === "paused"));
  useEffect(() => {
    if (!active) return;
    const tick = async () => {
      for (const t of tasksRef.current) {
        if (t.nativeId === undefined || (t.status !== "running" && t.status !== "paused")) continue;
        try {
          const s = await Downloader.status({ id: t.nativeId });
          if (s.status === "successful") patch(t.id, { status: "done", downloaded: t.size || s.downloaded });
          else if (s.status === "failed") patch(t.id, { status: "error", error: "Download failed. Check your connection and retry." });
          else if (s.status === "missing") patch(t.id, { status: "error", error: "Download was removed." });
          else
            patch(t.id, {
              status: s.status === "paused" ? "paused" : "running",
              downloaded: s.downloaded,
              size: s.total > 0 ? s.total : t.size,
            });
        } catch {
          /* try again next tick */
        }
      }
    };
    const h = window.setInterval(() => void tick(), 1000);
    return () => window.clearInterval(h);
  }, [active, patch]);

  return { tasks, start, retry, remove, clearFinished };
}
