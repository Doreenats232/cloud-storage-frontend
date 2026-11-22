import type { VaultItem, View } from "./types";

export interface Filters {
  type: "all" | "image" | "video" | "audio" | "doc" | "archive" | "other";
  date: "any" | "today" | "week" | "month" | "year";
  size: "any" | "small" | "medium" | "large" | "huge";
}
export const DEFAULT_FILTERS: Filters = { type: "all", date: "any", size: "any" };

export const DATE_OPTIONS: { value: Filters["date"]; label: string }[] = [
  { value: "any", label: "Any time" },
  { value: "today", label: "Today" },
  { value: "week", label: "Past 7 days" },
  { value: "month", label: "Past 30 days" },
  { value: "year", label: "Past year" },
];
export const SIZE_OPTIONS: { value: Filters["size"]; label: string }[] = [
  { value: "any", label: "Any size" },
  { value: "small", label: "Under 1 MB" },
  { value: "medium", label: "1 – 10 MB" },
  { value: "large", label: "10 – 100 MB" },
  { value: "huge", label: "Over 100 MB" },
];

export function typeOptions(view: View): { value: Filters["type"]; label: string }[] {
  if (view === "photos") return [{ value: "all", label: "All" }, { value: "image", label: "Photos" }, { value: "video", label: "Videos" }];
  if (view === "files")
    return [
      { value: "all", label: "All" },
      { value: "image", label: "Photos" },
      { value: "video", label: "Videos" },
      { value: "audio", label: "Audio" },
      { value: "doc", label: "Documents" },
      { value: "archive", label: "Archives" },
      { value: "other", label: "Other" },
    ];
  return [];
}

export function activeFilterCount(f: Filters): number {
  return (f.type !== "all" ? 1 : 0) + (f.date !== "any" ? 1 : 0) + (f.size !== "any" ? 1 : 0);
}

const MB = 1024 * 1024;
const DAY = 86_400_000;

/** Type/date/size filters. Folders are never filtered out. */
export function applyFilters(items: VaultItem[], f: Filters): VaultItem[] {
  if (activeFilterCount(f) === 0) return items;
  const now = Date.now();
  const startOfToday = new Date().setHours(0, 0, 0, 0);
  const since = f.date === "today" ? startOfToday : f.date === "week" ? now - 7 * DAY : f.date === "month" ? now - 30 * DAY : f.date === "year" ? now - 365 * DAY : 0;
  return items.filter((it) => {
    if (it.isDir) return true;
    if (f.type !== "all") {
      const k = it.kind === "app" ? "other" : it.kind;
      if (k !== f.type) return false;
    }
    if (since && it.mtime < since) return false;
    if (f.size === "small" && it.size >= MB) return false;
    if (f.size === "medium" && (it.size < MB || it.size >= 10 * MB)) return false;
    if (f.size === "large" && (it.size < 10 * MB || it.size >= 100 * MB)) return false;
    if (f.size === "huge" && it.size < 100 * MB) return false;
    return true;
  });
}
