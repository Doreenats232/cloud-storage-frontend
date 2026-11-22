import { useMemo, useState } from "react";
import { Copy, Trash2 } from "lucide-react";
import { formatSize } from "../lib/format";
import type { Kind, VaultItem } from "../lib/types";

const KINDS: { kind: Kind; label: string; color: string }[] = [
  { kind: "image", label: "Photos", color: "#8b5cf6" },
  { kind: "video", label: "Videos", color: "#ec4899" },
  { kind: "audio", label: "Audio", color: "#10b981" },
  { kind: "app", label: "Apps", color: "#0ea5e9" },
  { kind: "doc", label: "Documents", color: "#f59e0b" },
  { kind: "archive", label: "Archives", color: "#f97316" },
  { kind: "other", label: "Other", color: "#71717a" },
];

/** "photo (1).jpg", "photo-copy.jpg" and "photo.jpg" count as the same name. */
function normName(n: string): string {
  return n
    .toLowerCase()
    .replace(/\s*\(\d+\)(?=\.[^.]+$|$)/, "")
    .replace(/[-_ ]copy(?=\.[^.]+$|$)/, "");
}

interface Props {
  items: VaultItem[];
  onDelete: (items: VaultItem[]) => void;
}

export function StorageReport({ items, onDelete }: Props) {
  const [showAll, setShowAll] = useState(false);

  const data = useMemo(() => {
    const files = items.filter((it) => !it.isDir);
    const total = files.reduce((a, f) => a + f.size, 0);
    const byKind = KINDS.map((k) => {
      const list = files.filter((f) => (f.kind === "folder" ? "other" : f.kind) === k.kind);
      return { ...k, bytes: list.reduce((a, f) => a + f.size, 0), count: list.length };
    }).filter((k) => k.count > 0);
    const largest = [...files].sort((a, b) => b.size - a.size).slice(0, 10);

    const groups = new Map<string, VaultItem[]>();
    for (const f of files) {
      if (f.size < 1024) continue;
      const key = `${f.size}|${normName(f.name)}`;
      const g = groups.get(key);
      if (g) g.push(f);
      else groups.set(key, [f]);
    }
    const dupes = Array.from(groups.values())
      .filter((g) => g.length > 1)
      .map((g) => {
        const sorted = [...g].sort((a, b) => a.mtime - b.mtime);
        return { files: sorted, wasted: sorted[0].size * (sorted.length - 1) };
      })
      .sort((a, b) => b.wasted - a.wasted);
    return { files, total, byKind, largest, dupes, wasted: dupes.reduce((a, d) => a + d.wasted, 0) };
  }, [items]);

  const shown = showAll ? data.dupes : data.dupes.slice(0, 8);

  return (
    <div className="space-y-6">
      <section>
        <p className="text-3xl font-extrabold text-white">{formatSize(data.total)}</p>
        <p className="text-xs text-zinc-500">{data.files.length} files in your vault</p>
        <div className="mt-3 flex h-3 overflow-hidden rounded-full bg-white/5">
          {data.byKind.map((k) => (
            <div key={k.kind} style={{ width: `${data.total ? (k.bytes / data.total) * 100 : 0}%`, background: k.color }} title={k.label} />
          ))}
        </div>
        <ul className="mt-3 space-y-1.5">
          {data.byKind.map((k) => (
            <li key={k.kind} className="flex items-center gap-2 text-sm">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: k.color }} />
              <span className="flex-1 text-zinc-200">{k.label}</span>
              <span className="text-xs text-zinc-500">{k.count} files</span>
              <span className="w-20 text-right tabular-nums text-zinc-300">{formatSize(k.bytes)}</span>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <div className="mb-2 flex items-center gap-2">
          <Copy className="h-4 w-4 text-violet-300" />
          <h3 className="text-sm font-semibold text-white">Duplicates</h3>
        </div>
        {data.dupes.length === 0 ? (
          <p className="text-sm text-zinc-500">No duplicates found (same name and size).</p>
        ) : (
          <>
            <p className="mb-3 text-xs text-zinc-400">
              {data.dupes.length} sets · you could free <span className="font-semibold text-emerald-300">{formatSize(data.wasted)}</span>
            </p>
            <ul className="space-y-3">
              {shown.map((d, i) => (
                <li key={i} className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                  <div className="mb-2 flex items-center gap-2">
                    <p className="min-w-0 flex-1 truncate text-sm font-medium text-zinc-100">{d.files[0].name}</p>
                    <span className="text-xs text-zinc-500">
                      {d.files.length} × {formatSize(d.files[0].size)}
                    </span>
                  </div>
                  <ul className="space-y-1">
                    {d.files.map((f, j) => (
                      <li key={f.id} className="flex items-center gap-2 text-xs">
                        <span className={j === 0 ? "text-emerald-300" : "text-zinc-500"}>{j === 0 ? "keep" : "copy"}</span>
                        <span className="min-w-0 flex-1 truncate text-zinc-400">{f.path}</span>
                        <button onClick={() => onDelete([f])} className="rounded-md p-1 text-zinc-500 hover:bg-white/10 hover:text-rose-300" title="Delete this one">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </li>
                    ))}
                  </ul>
                  <button
                    onClick={() => onDelete(d.files.slice(1))}
                    className="mt-2 rounded-lg bg-rose-500/15 px-3 py-1.5 text-xs font-semibold text-rose-200 hover:bg-rose-500/25"
                  >
                    Delete {d.files.length - 1} extra {d.files.length - 1 > 1 ? "copies" : "copy"} (keeps the oldest)
                  </button>
                </li>
              ))}
            </ul>
            {data.dupes.length > 8 && (
              <button onClick={() => setShowAll((v) => !v)} className="mt-3 text-xs text-violet-300 hover:underline">
                {showAll ? "Show fewer" : `Show all ${data.dupes.length}`}
              </button>
            )}
          </>
        )}
      </section>

      <section>
        <h3 className="mb-2 text-sm font-semibold text-white">Largest files</h3>
        <ul className="space-y-1.5">
          {data.largest.map((f) => (
            <li key={f.id} className="flex items-center gap-2 text-sm">
              <span className="min-w-0 flex-1 truncate text-zinc-300">{f.name}</span>
              <span className="tabular-nums text-xs text-zinc-400">{formatSize(f.size)}</span>
              <button onClick={() => onDelete([f])} className="rounded-md p-1 text-zinc-500 hover:bg-white/10 hover:text-rose-300" title="Delete">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
