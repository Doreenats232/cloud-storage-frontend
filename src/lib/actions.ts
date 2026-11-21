import { Capacitor } from "@capacitor/core";
import { Browser } from "@capacitor/browser";
import { type VaultClient } from "./api";
import { createLimiter } from "./limiter";
import type { VaultItem } from "./types";

/** Download one file through the vault (attachment link). */
export async function downloadItem(client: VaultClient, item: VaultItem): Promise<void> {
  const url = client.streamUrl(item.id, item.path, true, item.name);
  if (Capacitor.isNativePlatform()) {
    // System browser handles the attachment download (WebView can't).
    await Browser.open({ url });
    return;
  }
  const a = document.createElement("a");
  a.href = url;
  a.download = item.name;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
}

/** Download many files, 3 at a time. */
export async function downloadMany(
  client: VaultClient,
  items: VaultItem[]
): Promise<{ ok: number; failed: number }> {
  const limit = createLimiter(3);
  let ok = 0;
  let failed = 0;
  await Promise.all(
    items.map((it) =>
      limit(() => downloadItem(client, it)).then(
        () => {
          ok++;
        },
        () => {
          failed++;
        }
      )
    )
  );
  return { ok, failed };
}
