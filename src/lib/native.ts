import { registerPlugin } from "@capacitor/core";

export interface DownloaderPlugin {
  start(o: { url: string; name: string }): Promise<{ id: number }>;
  status(o: { id: number }): Promise<{ status: string; downloaded: number; total: number }>;
  cancel(o: { id: number }): Promise<void>;
}

/** Android DownloadManager bridge (only exists inside the APK). */
export const Downloader = registerPlugin<DownloaderPlugin>("Downloader");
