import { useCallback, useEffect, useRef, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { Biometric } from "../lib/native";
import { checkPin, hashPin, loadLock, newSalt, recordFail, recordSuccess, saveLock, waitSeconds, type LockConfig } from "../lib/applock";

/** PIN (+ optional fingerprint) lock shown on app open and after time in the background. */
export function useAppLock() {
  const native = Capacitor.isNativePlatform();
  const [cfg, setCfg] = useState<LockConfig>(loadLock);
  const [locked, setLocked] = useState(cfg.enabled);
  const [bioAvailable, setBioAvailable] = useState(false);
  const hiddenAt = useRef(0);

  useEffect(() => {
    if (!native) return;
    void Biometric.available().then((r) => setBioAvailable(r.available)).catch(() => setBioAvailable(false));
  }, [native]);

  // Hide the app in the recent-apps screen and block screenshots while the lock is on.
  useEffect(() => {
    if (native) void Biometric.setSecure({ on: cfg.enabled }).catch(() => undefined);
  }, [native, cfg.enabled]);

  useEffect(() => {
    if (!cfg.enabled) return;
    const onVis = () => {
      if (document.visibilityState === "hidden") hiddenAt.current = Date.now();
      else if (hiddenAt.current && Date.now() - hiddenAt.current >= cfg.delay * 1000) setLocked(true);
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [cfg.enabled, cfg.delay]);

  const update = useCallback((next: LockConfig) => {
    saveLock(next);
    setCfg(next);
  }, []);

  const verifyPin = useCallback(
    async (pin: string): Promise<{ ok: boolean; wait: number }> => {
      const w = waitSeconds();
      if (w > 0) return { ok: false, wait: w };
      if (await checkPin(cfg, pin)) {
        recordSuccess();
        setLocked(false);
        return { ok: true, wait: 0 };
      }
      return { ok: false, wait: recordFail() };
    },
    [cfg]
  );

  const tryBiometric = useCallback(async (): Promise<boolean> => {
    if (!native || !cfg.biometric) return false;
    try {
      const r = await Biometric.authenticate({ title: "Unlock Vault" });
      if (r.ok) {
        recordSuccess();
        setLocked(false);
      }
      return r.ok;
    } catch {
      return false;
    }
  }, [native, cfg.biometric]);

  const turnOn = useCallback(
    async (pin: string, biometric: boolean) => {
      const salt = newSalt();
      update({ ...cfg, enabled: true, salt, hash: await hashPin(pin, salt), len: pin.length, biometric });
    },
    [cfg, update]
  );

  const changePin = useCallback(
    async (pin: string) => {
      const salt = newSalt();
      update({ ...cfg, salt, hash: await hashPin(pin, salt), len: pin.length });
    },
    [cfg, update]
  );

  const turnOff = useCallback(() => {
    update({ ...cfg, enabled: false, hash: "", salt: "", biometric: false });
    setLocked(false);
  }, [cfg, update]);

  return { cfg, locked, bioAvailable, update, verifyPin, tryBiometric, turnOn, changePin, turnOff, lockNow: () => setLocked(true) };
}
