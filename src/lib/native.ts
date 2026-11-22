import { registerPlugin } from "@capacitor/core";

export interface DownloaderPlugin {
  start(o: { url: string; name: string }): Promise<{ id: number }>;
  status(o: { id: number }): Promise<{ status: string; downloaded: number; total: number }>;
  cancel(o: { id: number }): Promise<void>;
}

/** Android DownloadManager bridge (only exists inside the APK). */
export const Downloader = registerPlugin<DownloaderPlugin>("Downloader");

export interface BackupStatus {
  enabled: boolean;
  permission: boolean;
  running: boolean;
  current: string;
  done: number;
  total: number;
  uploaded: number;
  failed: number;
  lastRun: number;
  lastError: string;
  pending: number;
}

export interface BackupPlugin {
  ensurePermission(): Promise<{ granted: boolean }>;
  configure(o: {
    enabled: boolean;
    wifiOnly: boolean;
    cameraOnly: boolean;
    baseUrl: string;
    apiKey: string;
    dir: string;
  }): Promise<void>;
  runNow(o: { force?: boolean; all?: boolean }): Promise<void>;
  status(): Promise<BackupStatus>;
}

/** Photo auto-backup engine (native: scans the gallery and uploads in the background). */
export const Backup = registerPlugin<BackupPlugin>("Backup");

export interface BiometricPlugin {
  available(): Promise<{ available: boolean }>;
  authenticate(o: { title?: string }): Promise<{ ok: boolean; error?: string }>;
  setSecure(o: { on: boolean }): Promise<void>;
}

/** Fingerprint prompt + screenshot/recents protection (Android app only). */
export const Biometric = registerPlugin<BiometricPlugin>("Biometric");
