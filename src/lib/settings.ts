import type { Settings } from "./types";

const KEY = "vault.settings.v1";

export const EMPTY_SETTINGS: Settings = { baseUrl: "", apiKey: "" };

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return EMPTY_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<Settings>;
    return {
      baseUrl: (parsed.baseUrl ?? "").trim().replace(/\/+$/, ""),
      apiKey: (parsed.apiKey ?? "").trim(),
    };
  } catch {
    return EMPTY_SETTINGS;
  }
}

export function saveSettings(s: Settings): void {
  localStorage.setItem(
    KEY,
    JSON.stringify({ baseUrl: s.baseUrl.trim().replace(/\/+$/, ""), apiKey: s.apiKey.trim() })
  );
}

export function isConfigured(s: Settings): boolean {
  return Boolean(s.baseUrl && s.apiKey);
}
