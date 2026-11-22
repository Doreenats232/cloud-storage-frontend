import { useEffect, useState } from "react";
import { Delete, Fingerprint, Lock } from "lucide-react";
import { waitSeconds } from "../lib/applock";

interface Props {
  len: number;
  showBiometric: boolean;
  onPin: (pin: string) => Promise<{ ok: boolean; wait: number }>;
  onBiometric: () => Promise<boolean>;
}

export function LockScreen({ len, showBiometric, onPin, onBiometric }: Props) {
  const [pin, setPin] = useState("");
  const [shake, setShake] = useState(false);
  const [wait, setWait] = useState(waitSeconds());

  useEffect(() => {
    if (showBiometric) void onBiometric();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (wait <= 0) return;
    const h = window.setInterval(() => setWait(waitSeconds()), 1000);
    return () => window.clearInterval(h);
  }, [wait]);

  const press = async (d: string) => {
    if (wait > 0) return;
    const next = (pin + d).slice(0, len);
    setPin(next);
    if (next.length === len) {
      const r = await onPin(next);
      if (!r.ok) {
        setShake(true);
        setWait(r.wait);
        window.setTimeout(() => setShake(false), 400);
        setPin("");
      }
    }
  };

  const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9"];
  return (
    <div className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-ink-950 px-6">
      <div className="gradient-ring mb-5 flex h-14 w-14 items-center justify-center rounded-2xl">
        <Lock className="h-6 w-6 text-white" />
      </div>
      <h1 className="text-lg font-semibold text-white">Vault is locked</h1>
      <p className="mb-6 mt-1 h-4 text-xs text-rose-300">{wait > 0 ? `Too many tries. Wait ${wait}s` : ""}</p>

      <div className={`mb-8 flex gap-3 ${shake ? "animate-pulse" : ""}`}>
        {Array.from({ length: len }).map((_, i) => (
          <span key={i} className={`h-3.5 w-3.5 rounded-full border ${i < pin.length ? "border-violet-400 bg-violet-400" : "border-white/30"}`} />
        ))}
      </div>

      <div className="grid w-64 grid-cols-3 gap-3">
        {keys.map((k) => (
          <button key={k} onClick={() => void press(k)} className="h-16 rounded-2xl bg-white/5 text-xl font-medium text-white active:bg-white/15">
            {k}
          </button>
        ))}
        <button
          onClick={() => void onBiometric()}
          disabled={!showBiometric}
          className="flex h-16 items-center justify-center rounded-2xl text-violet-300 active:bg-white/15 disabled:opacity-0"
          aria-label="Use fingerprint"
        >
          <Fingerprint className="h-7 w-7" />
        </button>
        <button onClick={() => void press("0")} className="h-16 rounded-2xl bg-white/5 text-xl font-medium text-white active:bg-white/15">
          0
        </button>
        <button onClick={() => setPin((p) => p.slice(0, -1))} className="flex h-16 items-center justify-center rounded-2xl text-zinc-400 active:bg-white/15" aria-label="Delete">
          <Delete className="h-6 w-6" />
        </button>
      </div>
    </div>
  );
}
