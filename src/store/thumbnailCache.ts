/**
 * LRU cache for image thumbnails with max 200 entries.
 * Keys are derived from the first portion of the base64 source to avoid
 * hashing multi-MB strings. Not persisted — thumbnails regenerate cheaply.
 */

// R9.3: LRU (Least Recently Used) cache implementation with max 200 entries
class LRUCache<T> {
  private cache: Map<string, T>;
  private accessOrder: string[];
  private readonly maxSize: number;

  constructor(maxSize: number = 200) {
    this.cache = new Map();
    this.accessOrder = [];
    this.maxSize = maxSize;
  }

  get(key: string): T | undefined {
    if (!this.cache.has(key)) {
      return undefined;
    }

    // Move key to end (most recently used)
    this.accessOrder = this.accessOrder.filter((k) => k !== key);
    this.accessOrder.push(key);

    return this.cache.get(key);
  }

  set(key: string, value: T): void {
    // If key exists, remove old position first
    if (this.cache.has(key)) {
      this.accessOrder = this.accessOrder.filter((k) => k !== key);
    }

    // Add to cache
    this.cache.set(key, value);
    this.accessOrder.push(key);

    // Evict least recently used if over capacity
    if (this.cache.size > this.maxSize) {
      const lruKey = this.accessOrder.shift();
      if (lruKey) {
        this.cache.delete(lruKey);
      }
    }
  }

  has(key: string): boolean {
    return this.cache.has(key);
  }

  delete(key: string): void {
    this.cache.delete(key);
    this.accessOrder = this.accessOrder.filter((k) => k !== key);
  }

  clear(): void {
    this.cache.clear();
    this.accessOrder = [];
  }

  get size(): number {
    return this.cache.size;
  }
}

const cache = new LRUCache<string>(200);
const pending = new Map<string, Promise<string>>();

function cacheKey(src: string): string {
  // Sample from multiple positions + length to create a collision-resistant key
  // without hashing the entire multi-MB string.
  const len = src.length;
  const mid = len >>> 1;
  return `${len}:${src.slice(30, 90)}:${src.slice(mid, mid + 60)}:${src.slice(-60)}`;
}

export function getThumbnail(src: string): string | undefined {
  return cache.get(cacheKey(src));
}

export function setThumbnail(src: string, thumbnail: string): void {
  cache.set(cacheKey(src), thumbnail);
}

export function getPending(src: string): Promise<string> | undefined {
  return pending.get(cacheKey(src));
}

export function setPending(src: string, promise: Promise<string>): void {
  pending.set(cacheKey(src), promise);
}

export function removePending(src: string): void {
  pending.delete(cacheKey(src));
}
