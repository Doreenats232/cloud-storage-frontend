/**
 * Client for the terabox-vault-backend HTTP API.
 *
 * Everything that talks to the backend lives in this file, so if your server's
 * routes or response shapes differ, you only need to adjust things here.
 *
 *   GET  /v1/files?dir=/           list a folder            (X-Api-Key)
 *   GET  /v1/download/:fsId        get a fresh download link (X-Api-Key)
 *   POST /v1/upload                multipart upload          (X-Api-Key)  [assumed]
 *   POST /v1/delete                delete by fs_ids          (X-Api-Key)  [assumed]
 *   POST /admin/keys               create an API key         (X-Admin-Token)
 *
 * Response parsing is intentionally tolerant (snake_case or camelCase, nested
 * or flat), because the exact shapes are owned by the backend.
 */
import { extOf, joinPath, kindOf } from "./format";
import { createLimiter } from "./limiter";
import type { Settings, VaultItem } from "./types";

export class VaultError extends Error {
  status: number;
  constructor(message: string, status = 0) {
    super(message);
    this.name = "VaultError";
    this.status = status;
  }
}

type Json = Record<string, unknown>;

function pick(o: Json, keys: string[]): unknown {
  for (const k of keys) {
    const v = o[k];
    if (v !== undefined && v !== null && v !== "") return v;
  }
  return undefined;
}

function toMs(v: unknown): number {
  if (typeof v === "number") return v > 1e12 ? v : v * 1000;
  if (typeof v === "string") {
    const n = Number(v);
    if (!isNaN(n) && n > 0) return n > 1e12 ? n : n * 1000;
    const d = Date.parse(v);
    return isNaN(d) ? 0 : d;
  }
  return 0;
}

function toNumber(v: unknown): number {
  const n = typeof v === "number" ? v : Number(v);
  return isNaN(n) ? 0 : n;
}

/** Turn a raw backend entry into a VaultItem. `parent` is the folder we listed. */
export function normalizeEntry(raw: Json, parent: string): VaultItem | null {
  const idRaw = pick(raw, ["fs_id", "fsId", "fsid", "id"]);
  if (idRaw === undefined) return null;

  let name = pick(raw, ["server_filename", "file_name", "filename", "name", "server_name"]);
  if (typeof name !== "string") {
    const p = pick(raw, ["path"]);
    if (typeof p !== "string") return null;
    name = p.split("/").filter(Boolean).pop() ?? "untitled";
  }
  const nameStr = name as string;

  const isDirRaw = pick(raw, ["isdir", "is_dir", "isDir", "is_directory"]);
  const isDir = isDirRaw === true || isDirRaw === 1 || isDirRaw === "1";

  const category = toNumber(pick(raw, ["category", "type"]));
  const mtime = toMs(
    pick(raw, ["server_mtime", "mtime", "modified_at", "modified", "updated_at", "server_ctime", "ctime", "created_at"])
  );
  const thumbsObj = (raw as Record<string, unknown>).thumbs;
  const fromObj =
    thumbsObj && typeof thumbsObj === "object"
      ? ((thumbsObj as Record<string, unknown>).url2 ??
        (thumbsObj as Record<string, unknown>).url3 ??
        (thumbsObj as Record<string, unknown>).url1)
      : undefined;
  const thumbRaw = pick(raw, ["thumbnail", "thumb", "thumb_url", "thumbnail_url"]) ?? fromObj;

  const rawPath = pick(raw, ["path"]);
  const path = typeof rawPath === "string" && rawPath.startsWith("/") ? rawPath : joinPath(parent, nameStr);
  return {
    id: String(idRaw),
    name: nameStr,
    parent,
    path,
    isDir,
    size: toNumber(pick(raw, ["size", "size_bytes", "file_size", "sizeBytes"])),
    mtime,
    kind: isDir ? "folder" : kindOf(nameStr, category),
    ext: isDir ? "" : extOf(nameStr),
    thumb: typeof thumbRaw === "string" && thumbRaw.startsWith("http") ? thumbRaw : undefined,
  };
}

function extractList(data: unknown, depth = 0): Json[] {
  if (depth > 3) return [];
  if (Array.isArray(data)) return data as Json[];
  if (data && typeof data === "object") {
    const o = data as Json;
    for (const k of ["files", "list", "items", "data", "result", "results"]) {
      const v = o[k];
      if (Array.isArray(v)) return v as Json[];
      if (v && typeof v === "object") {
        const inner = extractList(v, depth + 1);
        if (inner.length) return inner;
      }
    }
  }
  return [];
}

async function readError(res: Response): Promise<string> {
  const text = await res.text().catch(() => "");
  try {
    const j = JSON.parse(text) as Json;
    const err = j.error;
    if (typeof err === "string") return err;
    if (err && typeof err === "object" && typeof (err as Json).message === "string") return (err as Json).message as string;
    if (typeof j.message === "string") return j.message;
  } catch {
    /* not JSON */
  }
  return text.slice(0, 200) || `Request failed (HTTP ${res.status})`;
}

class ChunkUnsupported extends Error {}

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) return reject(new DOMException("Canceled", "AbortError"));
    const t = window.setTimeout(resolve, ms);
    signal.addEventListener("abort", () => {
      window.clearTimeout(t);
      reject(new DOMException("Canceled", "AbortError"));
    });
  });
}

function putChunk(url: string, blob: Blob, headers: Record<string, string>, onBytes: (loaded: number) => void, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    for (const [k, v] of Object.entries(headers)) xhr.setRequestHeader(k, v);
    xhr.setRequestHeader("Content-Type", "application/octet-stream");
    xhr.upload.onprogress = (e) => onBytes(e.loaded);
    xhr.onerror = () => reject(new VaultError("Network error while uploading.", 0));
    xhr.ontimeout = () => reject(new VaultError("Upload timed out.", 408));
    xhr.onload = () =>
      xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new VaultError(errorFromBody(xhr.responseText, xhr.status), xhr.status));
    signal.addEventListener("abort", () => {
      xhr.abort();
      reject(new DOMException("Canceled", "AbortError"));
    });
    xhr.send(blob);
  });
}

function errorFromBody(body: string, status: number): string {
  try {
    const j = JSON.parse(body) as Json;
    const err = j.error;
    if (typeof err === "string") return err;
    if (err && typeof err === "object" && typeof (err as Json).message === "string") return (err as Json).message as string;
    if (typeof j.message === "string") return j.message;
  } catch {
    /* ignore */
  }
  return body.slice(0, 200) || `Upload failed (HTTP ${status})`;
}

export class VaultClient {
  private s: Settings;

  constructor(settings: Settings) {
    this.s = settings;
  }

  get scope(): string {
    return `${this.s.baseUrl}|${this.s.apiKey.slice(-6)}`;
  }

  private url(path: string): string {
    return `${this.s.baseUrl}${path}`;
  }

  private authHeaders(): HeadersInit {
    return { "X-Api-Key": this.s.apiKey };
  }

  /** List one folder. */
  async list(dir: string): Promise<VaultItem[]> {
    const res = await fetch(this.url(`/v1/files?dir=${encodeURIComponent(dir)}`), {
      headers: this.authHeaders(),
      cache: "no-store",
    });
    if (!res.ok) throw new VaultError(await readError(res), res.status);
    let data: unknown;
    try {
      data = await res.json();
    } catch {
      throw new VaultError("Vault returned something that isn't JSON. Check the backend URL.");
    }
    return extractList(data)
      .map((r) => normalizeEntry(r, dir))
      .filter((x): x is VaultItem => x !== null);
  }

  /**
   * Media URL that goes THROUGH the vault (/v1/stream). TeraBox's raw links need the
   * logged-in session cookie, so browsers can't open them directly; the vault adds it.
   */
  streamUrl(id: string, path?: string, dl = false, name?: string): string {
    const q = new URLSearchParams();
    if (path) q.set("path", path);
    q.set("key", this.s.apiKey);
    if (dl) {
      q.set("dl", "1");
      if (name) q.set("name", name);
    }
    return this.url(`/v1/stream/${encodeURIComponent(id)}?${q.toString()}`);
  }

  async resolveUrl(id: string, path?: string): Promise<string> {
    return this.streamUrl(id, path);
  }

  /** Upload a file with progress reporting (XHR, since fetch has no upload progress). */
  upload(file: File, dir: string, onProgress: (p: number) => void, signal?: AbortSignal): Promise<VaultItem> {
    return new Promise<VaultItem>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      signal?.addEventListener("abort", () => {
        xhr.abort();
        reject(new DOMException("Canceled", "AbortError"));
      });
      xhr.open("POST", this.url("/v1/upload"));
      xhr.setRequestHeader("X-Api-Key", this.s.apiKey);
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) onProgress(e.loaded / e.total);
      };
      xhr.onerror = () => reject(new VaultError("Network error while uploading. Is the backend reachable?"));
      xhr.onload = () => {
        if (xhr.status < 200 || xhr.status >= 300) {
          reject(new VaultError(errorFromBody(xhr.responseText, xhr.status), xhr.status));
          return;
        }
        let data: unknown = {};
        try {
          data = JSON.parse(xhr.responseText);
        } catch {
          /* empty body is fine */
        }
        const raw = ((data as Json).file ?? (data as Json).data ?? data) as Json;
        const item = normalizeEntry({ server_filename: file.name, size: file.size, ...raw }, dir);
        if (!item) {
          reject(new VaultError("Upload finished but the vault didn't return a file id."));
          return;
        }
        resolve(item);
      };

      const fd = new FormData();
      fd.append("file", file, file.name);
      fd.append("dir", dir);
      fd.append("path", joinPath(dir, file.name));
      xhr.send(fd);
    });
  }

  /**
   * Resumable-style upload for big files: 4 MB chunks, each retried on network blips,
   * then the vault pushes the assembled file to TeraBox (we poll until it's done).
   * Falls back to the plain single-request upload on vaults without /v1/fs/uploads.
   */
  async uploadSmart(
    file: File,
    dir: string,
    onProgress: (p: number) => void,
    onPhase: (phase: "uploading" | "processing") => void,
    signal: AbortSignal
  ): Promise<VaultItem> {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        return await this.uploadChunked(file, dir, onProgress, onPhase, signal);
      } catch (e) {
        if (e instanceof ChunkUnsupported) return this.upload(file, dir, onProgress, signal);
        const lost = e instanceof VaultError && /session not found/i.test(e.message);
        if (lost && attempt === 0) {
          onProgress(0);
          continue; // server restarted mid-upload: start the file over once
        }
        throw e;
      }
    }
    throw new VaultError("Upload failed");
  }

  private async uploadChunked(
    file: File,
    dir: string,
    onProgress: (p: number) => void,
    onPhase: (phase: "uploading" | "processing") => void,
    signal: AbortSignal
  ): Promise<VaultItem> {
    if (file.size === 0) throw new ChunkUnsupported();
    const key = { "X-Api-Key": this.s.apiKey };
    const init = await fetch(this.url("/v1/fs/uploads"), {
      method: "POST",
      headers: { ...key, "Content-Type": "application/json" },
      body: JSON.stringify({ filename: file.name, size: file.size, dir }),
      signal,
    });
    if (init.status === 404 || init.status === 405) throw new ChunkUnsupported();
    if (!init.ok) throw new VaultError(errorFromBody(await init.text(), init.status), init.status);
    const { uploadId, chunkSize, totalChunks } = (await init.json()) as { uploadId: string; chunkSize: number; totalChunks: number };

    onPhase("uploading");
    let sent = 0;
    for (let i = 0; i < totalChunks; i++) {
      const blob = file.slice(i * chunkSize, Math.min(file.size, (i + 1) * chunkSize));
      for (let attempt = 1; ; attempt++) {
        try {
          await putChunk(this.url(`/v1/fs/uploads/${uploadId}/${i}`), blob, key, (b) => onProgress(Math.min(0.99, (sent + b) / file.size)), signal);
          break;
        } catch (e) {
          const status = e instanceof VaultError ? e.status : 0;
          const retryable = status === 0 || status === 408 || status === 429 || status >= 500;
          if (!retryable || attempt >= 4 || signal.aborted) throw e;
          await sleep(1000 * 2 ** (attempt - 1), signal);
        }
      }
      sent += blob.size;
      onProgress(Math.min(0.99, sent / file.size));
    }

    onPhase("processing");
    const done = await fetch(this.url(`/v1/fs/uploads/${uploadId}/complete`), { method: "POST", headers: key, signal });
    if (!done.ok) throw new VaultError(errorFromBody(await done.text(), done.status), done.status);

    const deadline = Date.now() + 40 * 60_000;
    while (Date.now() < deadline) {
      await sleep(2000, signal);
      const r = await fetch(this.url(`/v1/fs/uploads/${uploadId}`), { headers: key, signal });
      if (!r.ok) throw new VaultError(errorFromBody(await r.text(), r.status), r.status);
      const st = (await r.json()) as { state: string; fsId?: string; path?: string; error?: string };
      if (st.state === "error") throw new VaultError(st.error || "TeraBox rejected the upload");
      if (st.state === "done") {
        const item = normalizeEntry({ fs_id: st.fsId ?? st.path ?? uploadId, path: st.path, server_filename: file.name, size: file.size, isdir: 0 }, dir);
        if (!item) throw new VaultError("Upload finished but the vault didn't return a file id.");
        return item;
      }
    }
    throw new VaultError("Upload is taking too long. Check the vault dashboard.");
  }

  /** Short-lived public link (max 24 h) that anyone can open without the API key. */
  async signLink(path: string, ttl: number, dl = false): Promise<string> {
    const res = await fetch(this.url("/v1/fs/sign"), {
      method: "POST",
      headers: { "X-Api-Key": this.s.apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({ path, ttl, dl }),
    });
    if (!res.ok) throw new VaultError(await readError(res), res.status);
    const data = (await res.json()) as { url?: string };
    if (!data.url) throw new VaultError("The vault didn't return a link.");
    return data.url;
  }

  /** Delete files by fs_id. */
  async remove(ids: string[]): Promise<void> {
    const res = await fetch(this.url("/v1/delete"), {
      method: "POST",
      headers: { ...this.authHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({ fs_ids: ids }),
    });
    if (!res.ok) throw new VaultError(await readError(res), res.status);
  }
}

/** Create an API key using the admin token (same as the backend dashboard does). */
export async function createApiKey(
  baseUrl: string,
  adminToken: string,
  name: string,
  accountLabel: string
): Promise<string> {
  const res = await fetch(`${baseUrl.replace(/\/+$/, "")}/admin/keys`, {
    method: "POST",
    headers: { "X-Admin-Token": adminToken, "Content-Type": "application/json" },
    body: JSON.stringify({ name, account_label: accountLabel }),
  });
  if (!res.ok) throw new VaultError(await readError(res), res.status);
  const data = (await res.json()) as Json;
  const key = pick(data, ["key", "api_key", "apiKey"]);
  if (typeof key !== "string") throw new VaultError("Backend did not return a key.");
  return key;
}

/* ------------------------------------------------------------------ */
/* Shared media-URL cache + limiter                                    */
/* ------------------------------------------------------------------ */

const TTL_MS = 15 * 60_000;
const urlCache = new Map<string, { url: string; exp: number }>();
const inflight = new Map<string, Promise<string>>();
/** Max simultaneous download-link requests — keeps thumbnail grids snappy without flooding. */
const resolveLimit = createLimiter(6);

export function resolveMediaUrl(client: VaultClient, id: string, path?: string): Promise<string> {
  const key = `${client.scope}|${id}`;
  const hit = urlCache.get(key);
  if (hit && hit.exp > Date.now()) return Promise.resolve(hit.url);

  const pending = inflight.get(key);
  if (pending) return pending;

  const p = resolveLimit(() => client.resolveUrl(id, path)).then(
    (url) => {
      urlCache.set(key, { url, exp: Date.now() + TTL_MS });
      inflight.delete(key);
      return url;
    },
    (err: unknown) => {
      inflight.delete(key);
      throw err;
    }
  );
  inflight.set(key, p);
  return p;
}

export function clearMediaCache(): void {
  urlCache.clear();
}
