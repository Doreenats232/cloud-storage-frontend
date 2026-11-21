import { useMemo } from "react";
import type { VaultClient } from "../lib/api";
import { dateGroupLabel } from "../lib/format";
import type { VaultItem } from "../lib/types";
import { MediaThumb } from "./MediaThumb";

interface PhotoGridProps {
  items: VaultItem[];
  client: VaultClient;
  selected: Set<string>;
  onOpen: (index: number) => void;
  onToggle: (id: string) => void;
}

/** Google-Photos-style grid: date sections over a tight, responsive tile grid. */
export function PhotoGrid({ items, client, selected, onOpen, onToggle }: PhotoGridProps) {
  const groups = useMemo(() => {
    const out: { label: string; entries: { item: VaultItem; index: number }[] }[] = [];
    const byLabel = new Map<string, (typeof out)[number]>();
    items.forEach((item, index) => {
      const label = dateGroupLabel(item.mtime);
      let g = byLabel.get(label);
      if (!g) {
        g = { label, entries: [] };
        byLabel.set(label, g);
        out.push(g);
      }
      g.entries.push({ item, index });
    });
    return out;
  }, [items]);

  const selectActive = selected.size > 0;

  return (
    <div className="space-y-8 pb-28 md:pb-10">
      {groups.map((g) => (
        <section key={g.label} className="photo-section">
          <header className="mb-3 flex items-baseline gap-3 px-1">
            <h3 className="text-sm font-semibold tracking-tight text-zinc-200">{g.label}</h3>
            <span className="text-xs text-zinc-600">{g.entries.length}</span>
            <div className="h-px flex-1 bg-gradient-to-r from-white/10 to-transparent" />
          </header>
          <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 md:grid-cols-4 md:gap-2 xl:grid-cols-6 2xl:grid-cols-7">
            {g.entries.map(({ item, index }) => (
              <MediaThumb
                key={item.id}
                item={item}
                index={index}
                client={client}
                selected={selected.has(item.id)}
                selectActive={selectActive}
                onOpen={onOpen}
                onToggle={onToggle}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
