/** Thumbnails saved on the phone (IndexedDB) so reopening the app shows them instantly. */
const DB = "vault-thumbs";
const STORE = "t";
let dbp: Promise<IDBDatabase | null> | null = null;

function open(): Promise<IDBDatabase | null> {
  if (!dbp) {
    dbp = new Promise((resolve) => {
      try {
        const r = indexedDB.open(DB, 1);
        r.onupgradeneeded = () => r.result.createObjectStore(STORE);
        r.onsuccess = () => resolve(r.result);
        r.onerror = () => resolve(null);
      } catch {
        resolve(null);
      }
    });
  }
  return dbp;
}

export async function getThumb(id: string): Promise<Blob | null> {
  const db = await open();
  if (!db) return null;
  return new Promise((resolve) => {
    try {
      const rq = db.transaction(STORE, "readonly").objectStore(STORE).get(id);
      rq.onsuccess = () => resolve((rq.result as Blob | undefined) ?? null);
      rq.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

export async function putThumb(id: string, blob: Blob): Promise<void> {
  const db = await open();
  if (!db) return;
  try {
    db.transaction(STORE, "readwrite").objectStore(STORE).put(blob, id);
  } catch {
    /* ignore */
  }
}
