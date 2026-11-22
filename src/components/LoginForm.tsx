import { useState } from "react";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { createApiKey, VaultClient, VaultError } from "../lib/api";
import { SettingsPanel } from "./SettingsPanel";
import type { Settings } from "../lib/types";

const DEFAULT_URL = "https://terabox-vault-backend-1.onrender.com";
const inputCls =
  "w-full rounded-xl border border-white/10 bg-black/30 px-3.5 py-3 text-sm text-zinc-100 placeholder:text-zinc-600 transition focus:border-violet-400/60 focus:outline-none focus:ring-4 focus:ring-violet-500/10";

/** Sign in with the vault address + admin password; the app creates its own API key. */
export function LoginForm({ initial, onSave }: { initial: Settings; onSave: (s: Settings) => void }) {
  const [url, setUrl] = useState(initial.baseUrl || DEFAULT_URL);
  const [pw, setPw] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [advanced, setAdvanced] = useState(false);

  const clean = url.trim().replace(/\/+$/, "");

  const signIn = async () => {
    if (!clean || !pw) return;
    setBusy(true);
    setErr(null);
    try {
      const key = await createApiKey(clean, pw.trim(), "vault-app", "main");
      await new VaultClient({ baseUrl: clean, apiKey: key }).list("/");
      onSave({ baseUrl: clean, apiKey: key });
    } catch (e) {
      const status = e instanceof VaultError ? e.status : 0;
      setErr(
        status === 401 || status === 403
          ? "Wrong password."
          : e instanceof Error && e.message
            ? e.message
            : "Couldn't reach the vault. Check the address and your connection."
      );
    } finally {
      setBusy(false);
    }
  };

  if (advanced) {
    return (
      <div>
        <SettingsPanel initial={initial} onSave={onSave} variant="setup" />
        <button onClick={() => setAdvanced(false)} className="mt-4 text-xs text-violet-300 hover:underline">
          ← Back to sign in
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <label className="block">
        <span className="mb-1 block text-xs text-zinc-500">Vault address</span>
        <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://your-vault.onrender.com" autoCapitalize="none" autoCorrect="off" className={inputCls} />
      </label>
      <label className="block">
        <span className="mb-1 block text-xs text-zinc-500">Password</span>
        <div className="relative">
          <input
            type={show ? "text" : "password"}
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && void signIn()}
            placeholder="Your vault admin password"
            className={inputCls + " pr-11"}
          />
          <button onClick={() => setShow((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-200" aria-label="Show password">
            {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
      </label>
      {err && <p className="text-xs text-rose-300">{err}</p>}
      <button
        onClick={() => void signIn()}
        disabled={busy || !clean || !pw}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-violet-500 via-indigo-500 to-cyan-500 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-900/40 transition hover:brightness-110 disabled:opacity-40"
      >
        {busy && <Loader2 className="h-4 w-4 animate-spin" />}
        {busy ? "Signing in… (the vault may be waking up)" : "Sign in"}
      </button>
      <p className="text-[11px] text-zinc-600">Your password isn't saved. The app creates its own key and keeps only that.</p>
      <button onClick={() => setAdvanced(true)} className="text-xs text-violet-300 hover:underline">
        I have an API key instead
      </button>
    </div>
  );
}
