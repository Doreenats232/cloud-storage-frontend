import { useState } from "react";
import { Lock } from "lucide-react";
import { Switch } from "./BackupCard";
import type { useAppLock } from "../hooks/useAppLock";

type L = ReturnType<typeof useAppLock>;
const pinInput =
  "w-full rounded-xl border border-white/10 bg-black/30 px-3.5 py-2.5 text-center text-lg tracking-[0.5em] text-zinc-100 placeholder:tracking-normal placeholder:text-sm placeholder:text-zinc-600 focus:border-violet-400/60 focus:outline-none";
const btn = "rounded-xl bg-white/10 px-3 py-2 text-xs font-semibold text-white hover:bg-white/15 disabled:opacity-40";
const digits = (v: string) => v.replace(/\D/g, "").slice(0, 6);

const DELAYS = [
  { v: 0, l: "Immediately" },
  { v: 60, l: "After 1 minute" },
  { v: 300, l: "After 5 minutes" },
  { v: 900, l: "After 15 minutes" },
];

export function LockCard({ lock }: { lock: L }) {
  const [mode, setMode] = useState<"idle" | "new" | "change" | "off">("idle");
  const [cur, setCur] = useState("");
  const [a, setA] = useState("");
  const [b, setB] = useState("");
  const [bio, setBio] = useState(true);
  const [err, setErr] = useState("");

  const reset = () => {
    setMode("idle");
    setCur("");
    setA("");
    setB("");
    setErr("");
  };

  const checkCurrent = async () => {
    const r = await lock.verifyPin(cur);
    if (!r.ok) setErr(r.wait ? `Too many tries. Wait ${r.wait}s` : "Wrong PIN");
    return r.ok;
  };
  const validNew = () => {
    if (a.length < 4) return setErr("Use 4 to 6 digits"), false;
    if (a !== b) return setErr("PINs don't match"), false;
    return true;
  };

  return (
    <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <div className="mb-2 flex items-center gap-2">
        <Lock className="h-4 w-4 text-violet-300" />
        <h3 className="text-sm font-semibold text-white">App lock</h3>
      </div>

      {!lock.cfg.enabled && mode === "idle" && (
        <>
          <p className="mb-3 text-xs text-zinc-500">Ask for a PIN (or fingerprint) when the app opens. Also hides the app in recent apps.</p>
          <button onClick={() => setMode("new")} className={btn}>
            Turn on app lock
          </button>
        </>
      )}

      {mode === "new" && (
        <div className="space-y-2">
          <input autoFocus type="password" inputMode="numeric" value={a} onChange={(e) => setA(digits(e.target.value))} placeholder="Choose a 4–6 digit PIN" className={pinInput} />
          <input type="password" inputMode="numeric" value={b} onChange={(e) => setB(digits(e.target.value))} placeholder="Repeat PIN" className={pinInput} />
          {lock.bioAvailable && <Switch on={bio} onChange={setBio} label="Unlock with fingerprint" />}
          {err && <p className="text-xs text-rose-300">{err}</p>}
          <p className="text-[11px] text-zinc-500">There's no PIN reset. If you forget it, clear the app's data (you'll sign in again).</p>
          <div className="flex gap-2">
            <button
              className={btn}
              onClick={async () => {
                if (!validNew()) return;
                await lock.turnOn(a, bio && lock.bioAvailable);
                reset();
              }}
            >
              Turn on
            </button>
            <button className="px-3 py-2 text-xs text-zinc-400" onClick={reset}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {lock.cfg.enabled && mode === "idle" && (
        <>
          {lock.bioAvailable && <Switch on={lock.cfg.biometric} onChange={(v) => lock.update({ ...lock.cfg, biometric: v })} label="Unlock with fingerprint" />}
          <label className="flex items-center justify-between gap-3 py-2 text-sm text-zinc-100">
            Lock
            <select
              value={lock.cfg.delay}
              onChange={(e) => lock.update({ ...lock.cfg, delay: Number(e.target.value) })}
              className="rounded-lg bg-black/30 px-2 py-1.5 text-xs text-zinc-100 focus:outline-none [&>option]:bg-ink-850"
            >
              {DELAYS.map((d) => (
                <option key={d.v} value={d.v}>
                  {d.l}
                </option>
              ))}
            </select>
          </label>
          <div className="mt-1 flex flex-wrap gap-2">
            <button className={btn} onClick={() => setMode("change")}>
              Change PIN
            </button>
            <button className={btn} onClick={lock.lockNow}>
              Lock now
            </button>
            <button className={btn} onClick={() => setMode("off")}>
              Turn off
            </button>
          </div>
        </>
      )}

      {mode === "change" && (
        <div className="space-y-2">
          <input autoFocus type="password" inputMode="numeric" value={cur} onChange={(e) => setCur(digits(e.target.value))} placeholder="Current PIN" className={pinInput} />
          <input type="password" inputMode="numeric" value={a} onChange={(e) => setA(digits(e.target.value))} placeholder="New PIN" className={pinInput} />
          <input type="password" inputMode="numeric" value={b} onChange={(e) => setB(digits(e.target.value))} placeholder="Repeat new PIN" className={pinInput} />
          {err && <p className="text-xs text-rose-300">{err}</p>}
          <div className="flex gap-2">
            <button
              className={btn}
              onClick={async () => {
                if (!validNew() || !(await checkCurrent())) return;
                await lock.changePin(a);
                reset();
              }}
            >
              Save PIN
            </button>
            <button className="px-3 py-2 text-xs text-zinc-400" onClick={reset}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {mode === "off" && (
        <div className="space-y-2">
          <input autoFocus type="password" inputMode="numeric" value={cur} onChange={(e) => setCur(digits(e.target.value))} placeholder="Enter PIN to turn off" className={pinInput} />
          {err && <p className="text-xs text-rose-300">{err}</p>}
          <div className="flex gap-2">
            <button
              className={btn}
              onClick={async () => {
                if (!(await checkCurrent())) return;
                lock.turnOff();
                reset();
              }}
            >
              Turn off
            </button>
            <button className="px-3 py-2 text-xs text-zinc-400" onClick={reset}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
