import { useCallback, useEffect, useState } from "react";
import { uid } from "../lib/limiter";

export interface Album {
  id: string;
  name: string;
  ids: string[];
}
const FKEY = "vault.fav.v1";
const AKEY = "vault.albums.v1";

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
function write(key: string, v: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(v));
  } catch {
    /* ignore */
  }
}

/** Favorites + albums, saved on this device. */
export function useCollections() {
  const [favs, setFavs] = useState<Set<string>>(() => new Set(read<string[]>(FKEY, [])));
  const [albums, setAlbums] = useState<Album[]>(() => read<Album[]>(AKEY, []));

  useEffect(() => write(FKEY, Array.from(favs)), [favs]);
  useEffect(() => write(AKEY, albums), [albums]);

  const toggleFav = useCallback((id: string) => {
    setFavs((p) => {
      const n = new Set(p);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }, []);

  const setFavMany = useCallback((ids: string[], on: boolean) => {
    setFavs((p) => {
      const n = new Set(p);
      for (const id of ids) {
        if (on) n.add(id);
        else n.delete(id);
      }
      return n;
    });
  }, []);

  const createAlbum = useCallback((name: string, ids: string[] = []) => {
    const id = uid();
    setAlbums((a) => [...a, { id, name: name.trim() || "Untitled", ids }]);
    return id;
  }, []);

  const addToAlbum = useCallback((albumId: string, ids: string[]) => {
    setAlbums((a) => a.map((al) => (al.id === albumId ? { ...al, ids: Array.from(new Set([...al.ids, ...ids])) } : al)));
  }, []);

  const removeFromAlbum = useCallback((albumId: string, ids: string[]) => {
    const drop = new Set(ids);
    setAlbums((a) => a.map((al) => (al.id === albumId ? { ...al, ids: al.ids.filter((i) => !drop.has(i)) } : al)));
  }, []);

  const renameAlbum = useCallback((albumId: string, name: string) => {
    setAlbums((a) => a.map((al) => (al.id === albumId ? { ...al, name: name.trim() || al.name } : al)));
  }, []);

  const deleteAlbum = useCallback((albumId: string) => {
    setAlbums((a) => a.filter((al) => al.id !== albumId));
  }, []);

  return { favs, albums, toggleFav, setFavMany, createAlbum, addToAlbum, removeFromAlbum, renameAlbum, deleteAlbum };
}
