export type Kind = "image" | "video" | "audio" | "app" | "doc" | "archive" | "other" | "folder";

export type View = "photos" | "videos" | "apps" | "files";

export interface VaultItem {
  /** TeraBox fs_id, used for download / delete */
  id: string;
  name: string;
  /** Directory the item lives in, e.g. "/" or "/Photos/2025" */
  parent: string;
  /** Full path, e.g. "/Photos/2025/cat.jpg" */
  path: string;
  isDir: boolean;
  size: number;
  /** Modified time in ms since epoch (0 if unknown) */
  mtime: number;
  kind: Kind;
  ext: string;
  /** Optional thumbnail URL provided directly by the backend */
  thumb?: string;
}

export interface Settings {
  baseUrl: string;
  apiKey: string;
}

export interface UploadTask {
  id: string;
  name: string;
  size: number;
  dir: string;
  progress: number; // 0..1
  status: "queued" | "uploading" | "processing" | "done" | "error";
  error?: string;
}
