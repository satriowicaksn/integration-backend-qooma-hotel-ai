import { describe, expect, it } from '@jest/globals';

import {
  QrRegenerateRequestSchema,
  QrRegenerateResponseSchema,
} from '../qr-provisioning.schema.js';

describe('QrRegenerateRequestSchema', () => {
  it('should accept an empty object (greetingText optional)', () => {
    expect(QrRegenerateRequestSchema.parse({})).toEqual({});
  });

  it('should accept a short greetingText', () => {
    expect(QrRegenerateRequestSchema.parse({ greetingText: 'Halo' })).toEqual({
      greetingText: 'Halo',
    });
  });

  it('should reject a greetingText longer than 400 chars', () => {
    const overlong = 'x'.repeat(401);
    expect(() => QrRegenerateRequestSchema.parse({ greetingText: overlong })).toThrow();
  });

  it('should reject unknown fields (strict)', () => {
    expect(() => QrRegenerateRequestSchema.parse({ evil: true })).toThrow();
  });
});

describe('QrRegenerateResponseSchema', () => {
  const BASE = {
    url: 'https://wa.me/6281234567890',
    png_url: 'https://cdn.example.com/qr/hotel-1.png',
    generated_at: '2026-07-06T22:30:00Z',
  };

  it('should parse a well-formed response and coerce generated_at to Date', () => {
    const parsed = QrRegenerateResponseSchema.parse(BASE);
    expect(parsed.url).toBe(BASE.url);
    expect(parsed.png_url).toBe(BASE.png_url);
    expect(parsed.generated_at).toBeInstanceOf(Date);
  });

  it('should reject a non-URL wa.me link', () => {
    expect(() => QrRegenerateResponseSchema.parse({ ...BASE, url: 'not-a-url' })).toThrow();
  });

  it('should reject a non-URL png_url', () => {
    expect(() => QrRegenerateResponseSchema.parse({ ...BASE, png_url: 'not a url' })).toThrow();
  });
});
