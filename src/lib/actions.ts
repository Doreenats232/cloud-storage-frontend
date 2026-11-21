import { resolveMediaUrl, type VaultClient } from "./api";
import { createLimiter } from "./limiter";
import type { VaultItem } from "./types";

/** Resolve a fresh link for one file and trigger a browser download. */
export async function downloadItem(client: VaultClient, item: VaultItem): Promise<void> {
  const url = await resolveMediaUrl(client, item.id);
  const a = document.createElement("a");
  a.href = url;
  a.download = item.name;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
}

/** Download many files, resolving links in parallel (3 at a time). */
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
