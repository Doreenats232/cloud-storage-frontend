import { useCallback, useEffect, useRef, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { Loader2, Maximize, Minimize, Pause, Play } from "lucide-react";

const SPEEDS = [1, 1.25, 1.5, 2, 0.75];
const posKey = (id: string) => `vault.pos.v1.${id}`;

function fmt(t: number): string {
  if (!isFinite(t) || t < 0) t = 0;
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const s = Math.floor(t % 60);
  return (h ? `${h}:${String(m).padStart(2, "0")}` : String(m)) + `:${String(s).padStart(2, "0")}`;
}

interface Props {
  src: string;
  id: string;
}

/** Custom player: seek bar, ±10s (also double-tap), speed, fullscreen, resumes where you stopped. */
export function VideoPlayer({ src, id }: Props) {
  const box = useRef<HTMLDivElement>(null);
  const vid = useRef<HTMLVideoElement>(null);
  const hideT = useRef<number | undefined>(undefined);
  const lastSave = useRef(0);
  const lastTap = useRef(0);
  const [playing, setPlaying] = useState(false);
  const [cur, setCur] = useState(0);
  const [dur, setDur] = useState(0);
  const [buf, setBuf] = useState(0);
  const [waiting, setWaiting] = useState(true);
  const [speed, setSpeed] = useState(1);
  const [show, setShow] = useState(true);
  const [full, setFull] = useState(false);
  const [err, setErr] = useState(false);
  const [fake, setFake] = useState(false);
  const [resumed, setResumed] = useState<number | null>(null);
  const scrubbing = useRef(false);

  const wake = useCallback(() => {
    setShow(true);
    window.clearTimeout(hideT.current);
    hideT.current = window.setTimeout(() => {
      if (vid.current && !vid.current.paused) setShow(false);
    }, 3000);
  }, []);

  useEffect(() => () => window.clearTimeout(hideT.current), []);
  useEffect(() => {
    const on = () => setFull(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", on);
    return () => document.removeEventListener("fullscreenchange", on);
  }, []);

  const toggle = () => {
    const v = vid.current;
    if (!v) return;
    if (v.paused) void v.play().catch(() => setPlaying(false));
    else v.pause();
  };
  const skip = (d: number) => {
    const v = vid.current;
    if (!v) return;
    v.currentTime = Math.max(0, Math.min(v.duration || 0, v.currentTime + d));
    setCur(v.currentTime);
  };
  const fullscreen = () => {
    const el = box.current;
    if (!el) return;
    // Android WebView can't do element fullscreen, so there we just fill the screen.
    if (Capacitor.isNativePlatform() || !el.requestFullscreen) setFake((f) => !f);
    else if (document.fullscreenElement) void document.exitFullscreen();
    else void el.requestFullscreen().catch(() => undefined);
  };

  const onTap = (e: React.MouseEvent) => {
    const now = Date.now();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    if (now - lastTap.current < 280 && (x < 0.35 || x > 0.65)) {
      skip(x < 0.5 ? -10 : 10);
      wake();
    } else {
      setShow((s) => {
        if (!s) wake();
        return !s;
      });
    }
    lastTap.current = now;
  };

  return (
    <div ref={box} className={`flex items-center justify-center overflow-hidden bg-black ${fake ? "fixed inset-0 z-[80]" : "relative h-full w-full rounded-2xl"}`}>
      <video
        ref={vid}
        src={src}
        autoPlay
        playsInline
        preload="auto"
        onClick={onTap}
        className="h-full w-full object-contain"
        onLoadedMetadata={(e) => {
          const v = e.currentTarget;
          setDur(v.duration);
          try {
            const saved = Number(localStorage.getItem(posKey(id)) || 0);
            if (saved > 5 && saved < v.duration - 5) {
              v.currentTime = saved;
              setResumed(saved);
              window.setTimeout(() => setResumed(null), 3000);
            }
          } catch {
            /* ignore */
          }
        }}
        onTimeUpdate={(e) => {
          const v = e.currentTarget;
          if (!scrubbing.current) setCur(v.currentTime);
          if (v.buffered.length) setBuf(v.buffered.end(v.buffered.length - 1));
          const now = Date.now();
          if (now - lastSave.current > 2000) {
            lastSave.current = now;
            try {
              localStorage.setItem(posKey(id), String(v.currentTime));
            } catch {
              /* ignore */
            }
          }
        }}
        onPlay={() => {
          setPlaying(true);
          wake();
        }}
        onPause={() => {
          setPlaying(false);
          setShow(true);
        }}
        onWaiting={() => setWaiting(true)}
        onPlaying={() => setWaiting(false)}
        onCanPlay={() => setWaiting(false)}
        onEnded={() => {
          try {
            localStorage.removeItem(posKey(id));
          } catch {
            /* ignore */
          }
        }}
        onError={() => setErr(true)}
      />

      {waiting && !err && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <Loader2 className="h-10 w-10 animate-spin text-white/80" />
        </div>
      )}

      {err && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/70 px-6 text-center text-sm text-rose-300">
          Couldn&apos;t play this video. Try Download.
        </div>
      )}

      {resumed !== null && (
        <div className="pointer-events-none absolute left-1/2 top-4 -translate-x-1/2 rounded-full bg-black/70 px-3 py-1 text-xs text-white">
          Resumed from {fmt(resumed)}
        </div>
      )}

      {!playing && !waiting && !err && (
        <button
          onClick={toggle}
          aria-label="Play"
          className="absolute flex h-16 w-16 items-center justify-center rounded-full bg-white/20 text-white"
        >
          <Play className="h-8 w-8 fill-white" />
        </button>
      )}

      <div
        className={`absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 to-transparent px-3 pb-3 pt-10 transition-opacity duration-200 ${
          show ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      >
        <div className="relative mb-2 h-6">
          <div className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-white/20" />
          <div
            className="absolute left-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-white/35"
            style={{ width: `${dur ? (buf / dur) * 100 : 0}%` }}
          />
          <div
            className="absolute left-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-violet-400"
            style={{ width: `${dur ? (cur / dur) * 100 : 0}%` }}
          />
          <input
            type="range"
            min={0}
            max={dur || 0}
            step={0.1}
            value={cur}
            aria-label="Seek"
            onChange={(e) => {
              scrubbing.current = true;
              setCur(Number(e.target.value));
              wake();
            }}
            onPointerUp={(e) => {
              if (vid.current) vid.current.currentTime = Number((e.target as HTMLInputElement).value);
              scrubbing.current = false;
            }}
            onKeyUp={(e) => {
              if (vid.current) vid.current.currentTime = Number((e.target as HTMLInputElement).value);
              scrubbing.current = false;
            }}
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          />
        </div>
        <div className="flex items-center gap-2 text-xs text-white">
          <button onClick={toggle} aria-label={playing ? "Pause" : "Play"} className="rounded-lg p-2 hover:bg-white/10">
            {playing ? <Pause className="h-5 w-5 fill-white" /> : <Play className="h-5 w-5 fill-white" />}
          </button>
          <button onClick={() => skip(-10)} className="rounded-lg px-2 py-1.5 font-semibold hover:bg-white/10">
            −10
          </button>
          <button onClick={() => skip(10)} className="rounded-lg px-2 py-1.5 font-semibold hover:bg-white/10">
            +10
          </button>
          <span className="tabular-nums text-zinc-300">
            {fmt(cur)} / {fmt(dur)}
          </span>
          <div className="flex-1" />
          <button
            onClick={() => {
              const n = SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length];
              setSpeed(n);
              if (vid.current) vid.current.playbackRate = n;
            }}
            className="rounded-lg px-2 py-1.5 font-semibold tabular-nums hover:bg-white/10"
          >
            {speed}x
          </button>
          <button onClick={fullscreen} aria-label="Fullscreen" className="rounded-lg p-2 hover:bg-white/10">
            {full || fake ? <Minimize className="h-5 w-5" /> : <Maximize className="h-5 w-5" />}
          </button>
        </div>
      </div>
    </div>
  );
}
