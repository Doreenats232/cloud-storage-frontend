import { useState, type ReactNode } from "react";
import { Check, Copy, Eye, EyeOff, KeyRound, Link2, Loader2, Plug, Sparkles, X, ShieldCheck, ExternalLink } from "lucide-react";
import { createApiKey, VaultClient } from "../lib/api";
import { cn } from "../utils/cn";
import type { Settings } from "../lib/types";

interface SettingsPanelProps {
  initial: Settings;
  onSave: (s: Settings) => void;
  onCancel?: () => void;
  variant?: "modal" | "setup";
}

const inputCls =
  "w-full rounded-xl border border-white/10 bg-black/30 px-3.5 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-600 transition focus:border-violet-400/60 focus:outline-none focus:ring-4 focus:ring-violet-500/10";

/** Connection settings + admin helper to mint an API key. Used in the setup screen and as a modal. */
export function SettingsPanel({ initial, onSave, onCancel, variant = "modal" }: SettingsPanelProps) {
  const [baseUrl, setBaseUrl] = useState(initial.baseUrl);
  const [apiKey, setApiKey] = useState(initial.apiKey);
  const [showKey, setShowKey] = useState(false);

  const [testState, setTestState] = useState<{ status: "idle" | "loading" | "ok" | "error"; msg?: string }>({ status: "idle" });

  const [adminToken, setAdminToken] = useState("");
  const [keyName, setKeyName] = useState("vault-web");
  const [label, setLabel] = useState("main");
  const [minting, setMinting] = useState(false);
  const [mintError, setMintError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const cleanUrl = baseUrl.trim().replace(/\/+$/, "");

  const test = async () => {
    setTestState({ status: "loading" });
    try {
      const client = new VaultClient({ baseUrl: cleanUrl, apiKey: apiKey.trim() });
      const items = await client.list("/");
      setTestState({ status: "ok", msg: `Connected · ${items.length} item${items.length === 1 ? "" : "s"} at root` });
    } catch (e) {
      setTestState({ status: "error", msg: e instanceof Error ? e.message : "Connection failed" });
    }
  };

  const mint = async () => {
    setMinting(true);
    setMintError(null);
    try {
      const key = await createApiKey(cleanUrl, adminToken.trim(), keyName.trim() || "vault-web", label.trim() || "main");
      setApiKey(key);
      setShowKey(true);
      setAdminToken("");
    } catch (e) {
      setMintError(e instanceof Error ? e.message : "Could not create key");
    } finally {
      setMinting(false);
    }
  };

  const copy = async () => {
    await navigator.clipboard.writeText(apiKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 1400);
  };

  const canSave = cleanUrl.length > 0 && apiKey.trim().length > 0;

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <Field label="Backend URL" hint="Your terabox-vault-backend deployment">
          <div className="relative">
            <Link2 className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
            <input
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              placeholder="https://your-vault.onrender.com"
              className={cn(inputCls, "pl-10")}
              spellCheck={false}
            />
          </div>
        </Field>

        <Field label="API key" hint="Sent as X-Api-Key. Stored only in this browser.">
          <div className="relative">
            <KeyRound className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
            <input
              type={showKey ? "text" : "password"}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="tbx_..."
              className={cn(inputCls, "pl-10 pr-20 font-mono text-[13px]")}
              spellCheck={false}
              autoComplete="off"
            />
            <div className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-1">
              <button type="button" onClick={() => setShowKey((s) => !s)} className="rounded-lg p-1.5 text-zinc-500 hover:bg-white/10 hover:text-zinc-200">
                {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
              {apiKey && (
                <button type="button" onClick={copy} className="rounded-lg p-1.5 text-zinc-500 hover:bg-white/10 hover:text-zinc-200">
                  {copied ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
                </button>
              )}
            </div>
          </div>
        </Field>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={test}
            disabled={!cleanUrl || !apiKey || testState.status === "loading"}
            className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-zinc-100 transition hover:bg-white/10 disabled:opacity-40"
          >
            {testState.status === "loading" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plug className="h-4 w-4" />}
            Test connection
          </button>
          {testState.status === "ok" && (
            <span className="flex items-center gap-1.5 text-sm text-emerald-300">
              <ShieldCheck className="h-4 w-4" /> {testState.msg}
            </span>
          )}
          {testState.status === "error" && <span className="text-sm text-rose-300">{testState.msg}</span>}
        </div>
      </div>

      {/* Admin helper */}
      <details className="group rounded-2xl border border-white/10 bg-white/[0.02] p-4 open:bg-white/[0.03]">
        <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-semibold text-zinc-200">
          <Sparkles className="h-4 w-4 text-violet-300" />
          Create an API key from here
          <span className="ml-auto text-xs font-normal text-zinc-500 group-open:hidden">optional</span>
        </summary>
        <div className="mt-4 space-y-3">
          <p className="text-xs leading-relaxed text-zinc-500">
            Uses your backend's <span className="font-mono text-zinc-400">ADMIN_TOKEN</span> once, to call{" "}
            <span className="font-mono text-zinc-400">POST /admin/keys</span>. The admin token is never saved.
          </p>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Admin token">
              <input type="password" value={adminToken} onChange={(e) => setAdminToken(e.target.value)} className={inputCls} autoComplete="off" />
            </Field>
            <Field label="Key name">
              <input value={keyName} onChange={(e) => setKeyName(e.target.value)} className={inputCls} />
            </Field>
            <Field label="Account label">
              <input value={label} onChange={(e) => setLabel(e.target.value)} className={inputCls} />
            </Field>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={mint}
              disabled={!cleanUrl || !adminToken.trim() || minting}
              className="flex items-center gap-2 rounded-xl bg-white/10 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/20 disabled:opacity-40"
            >
              {minting ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
              Generate key
            </button>
            {mintError && <span className="text-sm text-rose-300">{mintError}</span>}
            {!mintError && apiKey && <span className="text-xs text-emerald-300/90">Key generated and filled in above.</span>}
          </div>
          <a href={cleanUrl || "#"} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-violet-300 hover:text-violet-200">
            Open your backend dashboard <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      </details>

      <div className="flex items-center justify-end gap-2 pt-2">
        {variant === "modal" && onCancel && (
          <button onClick={onCancel} className="flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm text-zinc-400 hover:bg-white/5 hover:text-zinc-100">
            <X className="h-4 w-4" /> Cancel
          </button>
        )}
        <button
          onClick={() => onSave({ baseUrl: cleanUrl, apiKey: apiKey.trim() })}
          disabled={!canSave}
          className="rounded-xl bg-gradient-to-br from-violet-500 via-indigo-500 to-cyan-500 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-indigo-900/40 transition hover:brightness-110 active:scale-[0.98] disabled:opacity-40"
        >
          {variant === "setup" ? "Open my vault" : "Save changes"}
        </button>
      </div>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="flex items-baseline gap-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">{label}</span>
        {hint && <span className="truncate text-[11px] text-zinc-600">{hint}</span>}
      </span>
      {children}
    </label>
  );
}
