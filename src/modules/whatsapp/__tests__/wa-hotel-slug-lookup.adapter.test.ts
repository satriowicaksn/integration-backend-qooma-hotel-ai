// Unit tests for T27 WA slug-lookup adapter.
// Mirrors T19-fu src/modules/telegram/__tests__/hotel-slug-lookup.adapter.test.ts
// verbatim so the two providers' env-map fail-fast semantics stay aligned.

import { describe, expect, it } from '@jest/globals';

import { EnvWaHotelSlugLookup } from '../adapters/wa-hotel-slug-lookup.adapter.js';

const HOTEL_ID = '11111111-2222-3333-4444-555555555555';
const OTHER_ID = '22222222-2222-3333-4444-555555555555';

describe('EnvWaHotelSlugLookup.lookup', () => {
  it('should return the hotel_id for a slug present in the map', async () => {
    const adapter = new EnvWaHotelSlugLookup(JSON.stringify({ 'my-hotel': HOTEL_ID }));

    const result = await adapter.lookup('my-hotel');

    expect(result).toBe(HOTEL_ID);
  });

  it('should return null for a slug not present in the map', async () => {
    const adapter = new EnvWaHotelSlugLookup(JSON.stringify({ 'my-hotel': HOTEL_ID }));

    const result = await adapter.lookup('unknown-slug');

    expect(result).toBeNull();
  });

  it('should treat an empty string as an empty map (every slug 404s)', async () => {
    const adapter = new EnvWaHotelSlugLookup('');

    const result = await adapter.lookup('my-hotel');

    expect(result).toBeNull();
  });

  it('should handle multiple slugs in the same map', async () => {
    const adapter = new EnvWaHotelSlugLookup(
      JSON.stringify({ 'hotel-a': HOTEL_ID, 'hotel-b': OTHER_ID }),
    );

    expect(await adapter.lookup('hotel-a')).toBe(HOTEL_ID);
    expect(await adapter.lookup('hotel-b')).toBe(OTHER_ID);
  });

  it('should throw when the JSON is not an object (e.g. array)', () => {
    expect(() => new EnvWaHotelSlugLookup('["not","an","object"]')).toThrow(TypeError);
  });

  it('should throw when a value is not a non-empty string', () => {
    expect(() => new EnvWaHotelSlugLookup(JSON.stringify({ slug: 42 }))).toThrow(TypeError);
    expect(() => new EnvWaHotelSlugLookup(JSON.stringify({ slug: '' }))).toThrow(TypeError);
  });
});
