import type { Kind, VaultItem } from "./types";

const IMAGE_EXT = new Set(["jpg", "jpeg", "png", "gif", "webp", "heic", "heif", "bmp", "avif", "tif", "tiff", "svg"]);
const VIDEO_EXT = new Set(["mp4", "mkv", "mov", "avi", "webm", "m4v", "3gp", "flv", "wmv", "ts"]);
const AUDIO_EXT = new Set(["mp3", "wav", "flac", "aac", "m4a", "ogg", "opus", "wma"]);
const APP_EXT = new Set(["apk", "xapk", "apks", "aab", "exe", "msi", "dmg", "pkg", "ipa", "appimage", "deb", "rpm", "jar", "bat", "sh"]);
const ARCHIVE_EXT = new Set(["zip", "rar", "7z", "tar", "gz", "tgz", "bz2", "xz", "iso"]);
const DOC_EXT = new Set(["pdf", "doc", "docx", "txt", "md", "rtf", "xls", "xlsx", "csv", "ppt", "pptx", "odt", "epub", "json", "html", "xml"]);

export function extOf(name: string): string {
  const i = name.lastIndexOf(".");
  return i > 0 ? name.slice(i + 1).toLowerCase() : "";
}

/** Map a file name (and optional TeraBox numeric category) to a Kind */
export function kindOf(name: string, category?: number): Kind {
  const ext = extOf(name);
  if (IMAGE_EXT.has(ext)) return "image";
  if (VIDEO_EXT.has(ext)) return "video";
  if (AUDIO_EXT.has(ext)) return "audio";
  if (APP_EXT.has(ext)) return "app";
  if (ARCHIVE_EXT.has(ext)) return "archive";
  if (DOC_EXT.has(ext)) return "doc";
  switch (category) {
    case 1: return "video";
    case 2: return "audio";
    case 3: return "image";
    case 4: return "doc";
    case 5: return "app";
    default: return "other";
  }
}

export function formatSize(bytes: number): string {
  if (!bytes || bytes < 0 || !isFinite(bytes)) return "—";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let v = bytes;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v >= 100 || i === 0 ? v.toFixed(0) : v.toFixed(1)} ${units[i]}`;
}

export function formatDate(ms: number): string {
  if (!ms) return "Unknown date";
  return new Date(ms).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

export function formatTime(ms: number): string {
  if (!ms) return "";
  return new Date(ms).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

/** Google Photos style section labels */
export function dateGroupLabel(ms: number): string {
  if (!ms) return "Unknown date";
  const d = new Date(ms);
  const now = new Date();
  const startOf = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diffDays = Math.round((startOf(now) - startOf(d)) / 86_400_000);
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays > 0 && diffDays < 7) return d.toLocaleDateString(undefined, { weekday: "long" });
  if (d.getFullYear() === now.getFullYear()) {
    return d.toLocaleDateString(undefined, { month: "long", day: "numeric" });
  }
  return d.toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

export function parentOf(path: string): string {
  const trimmed = path.replace(/\/+$/, "");
  const i = trimmed.lastIndexOf("/");
  if (i <= 0) return "/";
  return trimmed.slice(0, i);
}

export function joinPath(dir: string, name: string): string {
  const d = dir.replace(/\/+$/, "");
  return `${d}/${name}`.replace(/\/{2,}/g, "/");
}

export function breadcrumbs(dir: string): { label: string; path: string }[] {
  const parts = dir.split("/").filter(Boolean);
  const out = [{ label: "Vault", path: "/" }];
  let acc = "";
  for (const p of parts) {
    acc += `/${p}`;
    out.push({ label: p, path: acc });
  }
  return out;
}

export function sortItems(items: VaultItem[], mode: "newest" | "oldest" | "name" | "size"): VaultItem[] {
  const arr = [...items];
  switch (mode) {
    case "newest": return arr.sort((a, b) => b.mtime - a.mtime);
    case "oldest": return arr.sort((a, b) => a.mtime - b.mtime);
    case "name": return arr.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
    case "size": return arr.sort((a, b) => b.size - a.size);
  }
}
