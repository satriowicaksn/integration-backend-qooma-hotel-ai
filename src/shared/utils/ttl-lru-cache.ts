export interface TtlLruCacheOptions {
  maxSize: number;
  ttlMs: number;
  now?: () => number;
}

export interface TtlLruCache<V> {
  get(key: string): V | undefined;
  has(key: string): boolean;
  set(key: string, value: V): void;
  delete(key: string): void;
  clear(): void;
  size(): number;
}

interface CacheEntry<V> {
  value: V;
  expiresAt: number;
}

export function createTtlLruCache<V>(opts: TtlLruCacheOptions): TtlLruCache<V> {
  const { maxSize, ttlMs } = opts;
  const clock = opts.now ?? Date.now;
  const store = new Map<string, CacheEntry<V>>();

  function evictOverflow(): void {
    while (store.size > maxSize) {
      const oldest = store.keys().next().value;
      if (oldest === undefined) break;
      store.delete(oldest);
    }
  }

  function isExpired(entry: CacheEntry<V>): boolean {
    return entry.expiresAt <= clock();
  }

  return {
    get(key: string): V | undefined {
      const entry = store.get(key);
      if (entry === undefined) return undefined;
      if (isExpired(entry)) {
        store.delete(key);
        return undefined;
      }

      store.delete(key);
      store.set(key, entry);
      return entry.value;
    },

    has(key: string): boolean {
      const entry = store.get(key);
      if (entry === undefined) return false;
      if (isExpired(entry)) {
        store.delete(key);
        return false;
      }
      return true;
    },

    set(key: string, value: V): void {
      store.delete(key);
      store.set(key, { value, expiresAt: clock() + ttlMs });
      evictOverflow();
    },

    delete(key: string): void {
      store.delete(key);
    },

    clear(): void {
      store.clear();
    },

    size(): number {
      return store.size;
    },
  };
}
