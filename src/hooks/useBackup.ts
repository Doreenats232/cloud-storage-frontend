import { useCallback, useEffect, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { Backup, type BackupStatus } from "../lib/native";
import type { Settings } from "../lib/types";

interface BackupConfig {
  enabled: boolean;
  wifiOnly: boolean;
  cameraOnly: boolean;
}
const KEY = "vault.backup.v1";

function load(): BackupConfig {
  try {
    const p = JSON.parse(localStorage.getItem(KEY) || "{}") as Partial<BackupConfig>;
    return { enabled: !!p.enabled, wifiOnly: p.wifiOnly ?? true, cameraOnly: p.cameraOnly ?? true };
  } catch {
    return { enabled: false, wifiOnly: true, cameraOnly: true };
  }
}

/** Auto backup of new camera photos/videos (Android app only). */
export function useBackup(settings: Settings) {
  const native = Capacitor.isNativePlatform();
  const [cfg, setCfg] = useState<BackupConfig>(load);
  const [status, setStatus] = useState<BackupStatus | null>(null);
  const [denied, setDenied] = useState(false);

  const refresh = useCallback(async () => {
    if (!native) return;
    try {
      setStatus(await Backup.status());
    } catch {
      /* plugin missing */
    }
  }, [native]);

  // Keep the native side in sync with the connection + switches.
  useEffect(() => {
    if (!native || !settings.apiKey || !settings.baseUrl) return;
    void Backup.configure({ ...cfg, baseUrl: settings.baseUrl, apiKey: settings.apiKey, dir: "/Photos" })
      .then(refresh)
      .catch(() => undefined);
  }, [native, cfg, settings.baseUrl, settings.apiKey, refresh]);

  // Scan when the app opens, comes back to the front, and every few minutes while open.
  useEffect(() => {
    if (!native || !cfg.enabled || !settings.apiKey) return;
    const go = () => void Backup.runNow({ force: false }).catch(() => undefined);
    const t = window.setTimeout(go, 1500);
    const onVis = () => document.visibilityState === "visible" && go();
    document.addEventListener("visibilitychange", onVis);
    const h = window.setInterval(go, 5 * 60_000);
    return () => {
      window.clearTimeout(t);
      window.clearInterval(h);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [native, cfg.enabled, settings.apiKey]);

  // Live status while backup is on.
  useEffect(() => {
    if (!native || !cfg.enabled) return;
    void refresh();
    const h = window.setInterval(() => void refresh(), 3000);
    return () => window.clearInterval(h);
  }, [native, cfg.enabled, refresh]);

  const update = useCallback((p: Partial<BackupConfig>) => {
    setCfg((c) => {
      const n = { ...c, ...p };
      try {
        localStorage.setItem(KEY, JSON.stringify(n));
      } catch {
        /* ignore */
      }
      return n;
    });
  }, []);

  const setEnabled = useCallback(
    async (on: boolean) => {
      if (on) {
        const r = await Backup.ensurePermission().catch(() => ({ granted: false }));
        setDenied(!r.granted);
        if (!r.granted) return;
      }
      update({ enabled: on });
    },
    [update]
  );

  const backupNow = useCallback(async () => {
    await Backup.runNow({ force: true });
    void refresh();
  }, [refresh]);

  const backupAll = useCallback(async () => {
    const r = await Backup.ensurePermission().catch(() => ({ granted: false }));
    setDenied(!r.granted);
    if (!r.granted) return;
    await Backup.runNow({ force: true, all: true });
    void refresh();
  }, [refresh]);

  return { native, cfg, status, denied, update, setEnabled, backupNow, backupAll, refresh };
}
