import { useEffect, useRef, useState } from "react";
import { resolveMediaUrl, type VaultClient } from "../lib/api";

/** Reports whether an element has scrolled near the viewport (one-way latch). */
export function useInView<T extends Element>(rootMargin = "400px") {
  const ref = useRef<T | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || visible) return;
    if (typeof IntersectionObserver === "undefined") {
      setVisible(true);
      return;
    }
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          io.disconnect();
        }
      },
      { rootMargin }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [visible, rootMargin]);

  return [ref, visible] as const;
}

/** Lazily resolves a viewable URL for a file id once it's needed. */
export function useMediaUrl(client: VaultClient, id: string, enabled: boolean) {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    resolveMediaUrl(client, id)
      .then((u) => alive && setUrl(u))
      .catch((e: unknown) => alive && setError(e instanceof Error ? e.message : "Failed to load"));
    return () => {
      alive = false;
    };
  }, [client, id, enabled]);

  return { url, error };
}
