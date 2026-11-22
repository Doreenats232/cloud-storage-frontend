import { useEffect, useRef } from "react";

interface Props {
  src: string;
  alt: string;
  onLoad: () => void;
  loaded: boolean;
  onSwipe: (dir: -1 | 1) => void;
  onClose: () => void;
}

const MAX_SCALE = 6;

/** Pinch to zoom, drag to pan, double-tap to zoom, swipe left/right to browse, swipe down to close. */
export function ZoomableImage({ src, alt, onLoad, loaded, onSwipe, onClose }: Props) {
  const box = useRef<HTMLDivElement>(null);
  const img = useRef<HTMLImageElement>(null);
  const st = useRef({ s: 1, x: 0, y: 0 });
  const ptrs = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<{ d: number; s: number } | null>(null);
  const drag = useRef({ sx: 0, sy: 0, moved: 0 });
  const lastTap = useRef({ t: 0, x: 0, y: 0 });
  const swipe = useRef({ dx: 0, dy: 0 });

  const apply = (anim = false) => {
    const el = img.current;
    if (!el) return;
    const { s, x, y } = st.current;
    el.style.transition = anim ? "transform 0.2s ease" : "none";
    el.style.transform = `translate3d(${x}px, ${y}px, 0) scale(${s})`;
  };
  const clamp = () => {
    const b = box.current?.getBoundingClientRect();
    const s = st.current;
    if (!b) return;
    if (s.s <= 1) {
      s.x = swipe.current.dx;
      s.y = swipe.current.dy;
      return;
    }
    const mx = (b.width * (s.s - 1)) / 2;
    const my = (b.height * (s.s - 1)) / 2;
    s.x = Math.max(-mx, Math.min(mx, s.x));
    s.y = Math.max(-my, Math.min(my, s.y));
  };
  const reset = () => {
    st.current = { s: 1, x: 0, y: 0 };
    swipe.current = { dx: 0, dy: 0 };
    apply(true);
  };

  useEffect(() => {
    st.current = { s: 1, x: 0, y: 0 };
    swipe.current = { dx: 0, dy: 0 };
    apply();
  }, [src]);

  // Mouse wheel zoom (desktop)
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const s = st.current;
      s.s = Math.max(1, Math.min(MAX_SCALE, s.s * (e.deltaY < 0 ? 1.15 : 1 / 1.15)));
      clamp();
      apply();
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  const dist = () => {
    const [a, b] = Array.from(ptrs.current.values());
    return Math.hypot(a.x - b.x, a.y - b.y);
  };

  const onDown = (e: React.PointerEvent) => {
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    ptrs.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (ptrs.current.size === 2) pinch.current = { d: dist(), s: st.current.s };
    drag.current = { sx: e.clientX, sy: e.clientY, moved: 0 };
  };

  const onMove = (e: React.PointerEvent) => {
    const p = ptrs.current.get(e.pointerId);
    if (!p) return;
    const dx = e.clientX - p.x;
    const dy = e.clientY - p.y;
    p.x = e.clientX;
    p.y = e.clientY;
    drag.current.moved += Math.abs(dx) + Math.abs(dy);
    const s = st.current;

    if (ptrs.current.size >= 2 && pinch.current) {
      s.s = Math.max(1, Math.min(MAX_SCALE, (pinch.current.s * dist()) / pinch.current.d));
      clamp();
      apply();
      return;
    }
    if (s.s > 1) {
      s.x += dx;
      s.y += dy;
      clamp();
    } else {
      swipe.current.dx += dx;
      swipe.current.dy += dy;
      clamp();
    }
    apply();
  };

  const onUp = (e: React.PointerEvent) => {
    ptrs.current.delete(e.pointerId);
    if (ptrs.current.size > 0) return;
    pinch.current = null;
    const s = st.current;

    const tapped = drag.current.moved < 8;
    if (tapped) {
      const now = Date.now();
      const lt = lastTap.current;
      if (now - lt.t < 300 && Math.hypot(e.clientX - lt.x, e.clientY - lt.y) < 40) {
        // double tap: zoom in at the tap point, or back out
        const b = box.current?.getBoundingClientRect();
        if (s.s > 1) {
          reset();
        } else if (b) {
          const target = 2.5;
          const cx = e.clientX - (b.left + b.width / 2);
          const cy = e.clientY - (b.top + b.height / 2);
          s.s = target;
          s.x = -cx * (target - 1);
          s.y = -cy * (target - 1);
          clamp();
          apply(true);
        }
        lastTap.current = { t: 0, x: 0, y: 0 };
        return;
      }
      lastTap.current = { t: now, x: e.clientX, y: e.clientY };
    }

    if (s.s <= 1.02) {
      const { dx, dy } = swipe.current;
      if (Math.abs(dx) > 70 && Math.abs(dx) > Math.abs(dy)) {
        reset();
        onSwipe(dx < 0 ? 1 : -1);
        return;
      }
      if (dy > 110 && Math.abs(dy) > Math.abs(dx)) {
        onClose();
        return;
      }
      reset();
    }
  };

  return (
    <div
      ref={box}
      className="flex h-full w-full touch-none items-center justify-center overflow-hidden"
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={onUp}
    >
      <img
        ref={img}
        key={src}
        src={src}
        alt={alt}
        onLoad={onLoad}
        draggable={false}
        className={`max-h-full max-w-full select-none object-contain will-change-transform ${loaded ? "opacity-100" : "opacity-0"}`}
        style={{ transition: "opacity 0.4s" }}
      />
    </div>
  );
}
