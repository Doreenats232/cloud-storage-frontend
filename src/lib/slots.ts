/** Global cap on simultaneous image downloads, so fast scrolling never floods the vault. */
const MAX = 4;
let active = 0;
interface Job { fn: () => void; dead: boolean; held: boolean }
const queue: Job[] = [];

function pump() {
  while (active < MAX) {
    const j = queue.shift();
    if (!j) return;
    if (j.dead) continue;
    j.held = true;
    active++;
    j.fn();
  }
}

/** Wait for a free slot, then call fn. Returns a function that releases/cancels (safe to call twice). */
export function requestSlot(fn: () => void): () => void {
  const j: Job = { fn, dead: false, held: false };
  queue.push(j);
  pump();
  return () => {
    if (j.dead) return;
    j.dead = true;
    if (j.held) {
      active--;
      pump();
    }
  };
}

/** Small in-memory thumbnails (object URLs) keyed by file id, so scrolling back is instant. */
export const thumbCache = new Map<string, string>();
