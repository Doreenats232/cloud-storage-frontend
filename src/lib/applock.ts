export interface LockConfig {
  enabled: boolean;
  salt: string;
  hash: string;
  len: number;
  biometric: boolean;
  /** seconds in the background before the app locks again */
  delay: number;
}
const KEY = "vault.lock.v1";
const ATT = "vault.lock.att";

export const EMPTY_LOCK: LockConfig = { enabled: false, salt: "", hash: "", len: 4, biometric: false, delay: 60 };

export function loadLock(): LockConfig {
  try {
    return { ...EMPTY_LOCK, ...(JSON.parse(localStorage.getItem(KEY) || "{}") as Partial<LockConfig>) };
  } catch {
    return EMPTY_LOCK;
  }
}
export function saveLock(c: LockConfig) {
  try {
    localStorage.setItem(KEY, JSON.stringify(c));
  } catch {
    /* ignore */
  }
}

const hex = (b: ArrayBuffer) => Array.from(new Uint8Array(b)).map((x) => x.toString(16).padStart(2, "0")).join("");

export async function hashPin(pin: string, salt: string): Promise<string> {
  const enc = new TextEncoder();
  const base = await crypto.subtle.importKey("raw", enc.encode(pin), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", salt: enc.encode(salt), iterations: 100_000, hash: "SHA-256" }, base, 256);
  return hex(bits);
}

export function newSalt(): string {
  return hex(crypto.getRandomValues(new Uint8Array(16)).buffer);
}

export async function checkPin(c: LockConfig, pin: string): Promise<boolean> {
  return (await hashPin(pin, c.salt)) === c.hash;
}

/* wrong-PIN throttling: 5 free tries, then 30 s, 60 s, 120 s … (max 10 min) */
interface Att {
  n: number;
  until: number;
}
function att(): Att {
  try {
    return JSON.parse(localStorage.getItem(ATT) || '{"n":0,"until":0}') as Att;
  } catch {
    return { n: 0, until: 0 };
  }
}
export function waitSeconds(): number {
  return Math.max(0, Math.ceil((att().until - Date.now()) / 1000));
}
export function recordFail(): number {
  const a = att();
  a.n += 1;
  if (a.n >= 5) a.until = Date.now() + Math.min(600, 30 * 2 ** (a.n - 5)) * 1000;
  localStorage.setItem(ATT, JSON.stringify(a));
  return waitSeconds();
}
export function recordSuccess() {
  localStorage.removeItem(ATT);
}
