import { useCallback, useRef, useState } from "react";
import { VaultClient } from "../lib/api";
import { createLimiter, uid } from "../lib/limiter";
import type { Settings, UploadTask, VaultItem } from "../lib/types";

/** How many files upload at the same time. */
const UPLOAD_CONCURRENCY = 3;

interface QueuedFile {
  file: File;
  dir: string;
}

/**
 * Concurrent upload queue with per-file progress.
 * Up to UPLOAD_CONCURRENCY files stream to the vault in parallel.
 */
export function useUploads(settings: Settings, onUploaded: (items: VaultItem[]) => void) {
  const [tasks, setTasks] = useState<UploadTask[]>([]);
  const limitRef = useRef(createLimiter(UPLOAD_CONCURRENCY));
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const onUploadedRef = useRef(onUploaded);
  onUploadedRef.current = onUploaded;

  const patch = useCallback((id: string, p: Partial<UploadTask>) => {
    setTasks((ts) => ts.map((t) => (t.id === id ? { ...t, ...p } : t)));
  }, []);

  const enqueue = useCallback(
    (files: QueuedFile[]) => {
      if (files.length === 0) return;
      const client = new VaultClient(settingsRef.current);
      const entries = files.map((f) => ({
        id: uid(),
        file: f.file,
        dir: f.dir,
        task: {
          id: "",
          name: f.file.name,
          size: f.file.size,
          dir: f.dir,
          progress: 0,
          status: "queued" as const,
        } satisfies UploadTask,
      }));
      entries.forEach((e) => (e.task.id = e.id));
      setTasks((ts) => [...entries.map((e) => e.task), ...ts]);

      for (const e of entries) {
        void limitRef.current(async () => {
          patch(e.id, { status: "uploading" });
          try {
            const item = await client.upload(e.file, e.dir, (p) => patch(e.id, { progress: p }));
            patch(e.id, { status: "done", progress: 1 });
            onUploadedRef.current([item]);
          } catch (err) {
            patch(e.id, {
              status: "error",
              error: err instanceof Error ? err.message : "Upload failed",
            });
          }
        });
      }
    },
    [patch]
  );

  const clearFinished = useCallback(() => {
    setTasks((ts) => ts.filter((t) => t.status === "queued" || t.status === "uploading"));
  }, []);

  const activeCount = tasks.filter((t) => t.status === "queued" || t.status === "uploading").length;

  return { tasks, enqueue, clearFinished, activeCount };
}
