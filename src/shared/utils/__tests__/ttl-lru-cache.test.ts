import { describe, it, expect } from '@jest/globals';

import { createTtlLruCache } from '../ttl-lru-cache.js';

function makeClock(start = 1000): { now: () => number; advance: (ms: number) => void } {
  let t = start;
  return { now: () => t, advance: (ms: number) => (t += ms) };
}

describe('createTtlLruCache', () => {
  it('should return a stored value on a cache hit within ttl', () => {
    const cache = createTtlLruCache<string>({ maxSize: 10, ttlMs: 100, now: () => 1000 });
    cache.set('a', 'x');
    expect(cache.get('a')).toBe('x');
    expect(cache.has('a')).toBe(true);
  });

  it('should return undefined on a miss for an absent key', () => {
    const cache = createTtlLruCache<string>({ maxSize: 10, ttlMs: 100, now: () => 1000 });
    expect(cache.get('nope')).toBeUndefined();
    expect(cache.has('nope')).toBe(false);
  });

  it('should evict an entry once its ttl has elapsed', () => {
    const clock = makeClock(1000);
    const cache = createTtlLruCache<string>({ maxSize: 10, ttlMs: 100, now: clock.now });
    cache.set('a', 'x');
    clock.advance(99);
    expect(cache.get('a')).toBe('x'); // still valid at t=1099 (expiresAt=1100)
    clock.advance(1);
    expect(cache.get('a')).toBeUndefined(); // expired at t=1100 (expiresAt <= now)
    expect(cache.size()).toBe(0);
  });

  it('should report has=false and evict for an expired entry', () => {
    const clock = makeClock(1000);
    const cache = createTtlLruCache<string>({ maxSize: 10, ttlMs: 100, now: clock.now });
    cache.set('a', 'x');
    clock.advance(100);
    expect(cache.has('a')).toBe(false);
    expect(cache.size()).toBe(0);
  });

  it('should evict the least-recently-used entry over maxSize', () => {
    const cache = createTtlLruCache<string>({ maxSize: 2, ttlMs: 1000, now: () => 1000 });
    cache.set('a', '1');
    cache.set('b', '2');
    cache.set('c', '3'); // 'a' is oldest → evicted
    expect(cache.get('a')).toBeUndefined();
    expect(cache.get('b')).toBe('2');
    expect(cache.get('c')).toBe('3');
    expect(cache.size()).toBe(2);
  });

  it('should refresh recency on get so the touched entry survives eviction', () => {
    const cache = createTtlLruCache<string>({ maxSize: 2, ttlMs: 1000, now: () => 1000 });
    cache.set('a', '1');
    cache.set('b', '2');
    expect(cache.get('a')).toBe('1'); // 'a' now newest, 'b' oldest
    cache.set('c', '3'); // 'b' evicted, not 'a'
    expect(cache.get('a')).toBe('1');
    expect(cache.get('b')).toBeUndefined();
    expect(cache.get('c')).toBe('3');
  });

  it('should support delete and clear', () => {
    const cache = createTtlLruCache<string>({ maxSize: 10, ttlMs: 100, now: () => 1000 });
    cache.set('a', '1');
    cache.set('b', '2');
    cache.delete('a');
    expect(cache.get('a')).toBeUndefined();
    expect(cache.size()).toBe(1);
    cache.clear();
    expect(cache.size()).toBe(0);
  });
});
