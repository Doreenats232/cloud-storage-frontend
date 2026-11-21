import { useCallback, useRef, useState } from "react";
import { VaultClient } from "../lib/api";
import { createLimiter, uid } from "../lib/limiter";
import type { Settings, UploadTask, VaultItem } from "../lib/types";

/** How many files upload at the same time. */
const UPLOAD_CONCURRENCY = 2;

interface QueuedFile {
  file: File;
  dir: string;
}

/**
 * Upload queue: chunked + auto-retrying uploads, per-file progress,
 * with cancel and manual retry.
 */
export function useUploads(settings: Settings, onUploaded: (items: VaultItem[]) => void) {
  const [tasks, setTasks] = useState<UploadTask[]>([]);
  const limitRef = useRef(createLimiter(UPLOAD_CONCURRENCY));
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const onUploadedRef = useRef(onUploaded);
  onUploadedRef.current = onUploaded;
  const filesRef = useRef(new Map<string, QueuedFile>());
  const abortRef = useRef(new Map<string, AbortController>());

  const patch = useCallback((id: string, p: Partial<UploadTask>) => {
    setTasks((ts) => ts.map((t) => (t.id === id ? { ...t, ...p } : t)));
  }, []);

  const run = useCallback(
    async (id: string) => {
      const q = filesRef.current.get(id);
      if (!q) return; // canceled while queued
      const ac = new AbortController();
      abortRef.current.set(id, ac);
      const client = new VaultClient(settingsRef.current);
      patch(id, { status: "uploading", progress: 0, error: undefined });
      try {
        const item = await client.uploadSmart(
          q.file,
          q.dir,
          (p) => patch(id, { progress: p }),
          (phase) => patch(id, { status: phase }),
          ac.signal
        );
        patch(id, { status: "done", progress: 1 });
        onUploadedRef.current([item]);
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        patch(id, { status: "error", error: err instanceof Error ? err.message : "Upload failed" });
      } finally {
        abortRef.current.delete(id);
      }
    },
    [patch]
  );

  const enqueue = useCallback(
    (files: QueuedFile[]) => {
      if (files.length === 0) return;
      const entries = files.map((f) => {
        const id = uid();
        filesRef.current.set(id, f);
        const task: UploadTask = { id, name: f.file.name, size: f.file.size, dir: f.dir, progress: 0, status: "queued" };
        return task;
      });
      setTasks((ts) => [...entries.map((e) => e), ...ts]);
      for (const e of entries) void limitRef.current(() => run(e.id));
    },
    [run]
  );

  const retry = useCallback(
    (id: string) => {
      patch(id, { status: "queued", progress: 0, error: undefined });
      void limitRef.current(() => run(id));
    },
    [patch, run]
  );

  const cancel = useCallback((id: string) => {
    abortRef.current.get(id)?.abort();
    filesRef.current.delete(id);
    setTasks((ts) => ts.filter((t) => t.id !== id));
  }, []);

  const clearFinished = useCallback(() => {
    setTasks((ts) => {
      for (const t of ts) if (t.status === "done" || t.status === "error") filesRef.current.delete(t.id);
      return ts.filter((t) => t.status === "queued" || t.status === "uploading" || t.status === "processing");
    });
  }, []);

  const activeCount = tasks.filter((t) => t.status === "queued" || t.status === "uploading" || t.status === "processing").length;

  return { tasks, enqueue, retry, cancel, clearFinished, activeCount };
}
