import { describe, expect, it } from '@jest/globals';

import { ParsedVisitSchema, PollErrorSchema } from '../ota-mailbox.schema.js';

const VALID_VISIT = {
  guestName: 'Jane Doe',
  checkInDate: '2026-08-15',
  checkOutDate: '2026-08-20',
  roomNumber: '204',
  bookingSource: 'booking_com' as const,
  externalRef: 'XYZ-1',
};

describe('ParsedVisitSchema', () => {
  it('should parse a valid Booking.com visit', () => {
    const parsed = ParsedVisitSchema.parse(VALID_VISIT);
    expect(parsed.bookingSource).toBe('booking_com');
  });

  it('should parse a valid Agoda visit with null roomNumber + externalRef', () => {
    const parsed = ParsedVisitSchema.parse({
      ...VALID_VISIT,
      bookingSource: 'agoda',
      roomNumber: null,
      externalRef: null,
    });
    expect(parsed.roomNumber).toBeNull();
    expect(parsed.externalRef).toBeNull();
  });

  it('should reject an unsupported bookingSource', () => {
    expect(() => ParsedVisitSchema.parse({ ...VALID_VISIT, bookingSource: 'expedia' })).toThrow();
  });

  it('should reject non-ISO checkInDate', () => {
    expect(() => ParsedVisitSchema.parse({ ...VALID_VISIT, checkInDate: '15/08/2026' })).toThrow();
  });

  it('should reject empty guestName', () => {
    expect(() => ParsedVisitSchema.parse({ ...VALID_VISIT, guestName: '' })).toThrow();
  });

  it('should reject unknown extra fields (strict)', () => {
    expect(() => ParsedVisitSchema.parse({ ...VALID_VISIT, extra: true })).toThrow();
  });
});

describe('PollErrorSchema', () => {
  it('should parse a minimal error record', () => {
    const parsed = PollErrorSchema.parse({
      timestamp: '2026-07-06T18:00:00Z',
      code: 'rpc_error',
      message: 'HC unavailable',
    });
    expect(parsed.code).toBe('rpc_error');
    expect(parsed.mailboxUid).toBeUndefined();
  });

  it('should parse a full error record with mailboxUid + stack', () => {
    const parsed = PollErrorSchema.parse({
      timestamp: '2026-07-06T18:00:00Z',
      code: 'parser_exception',
      message: 'regex threw',
      mailboxUid: 42,
      stack: 'Error: regex threw\n  at ...',
    });
    expect(parsed.mailboxUid).toBe(42);
    expect(parsed.stack).toContain('regex threw');
  });

  it('should reject an unsupported error code', () => {
    expect(() =>
      PollErrorSchema.parse({
        timestamp: '2026-07-06T18:00:00Z',
        code: 'network_kaboom',
        message: 'x',
      }),
    ).toThrow();
  });

  it('should reject negative mailboxUid', () => {
    expect(() =>
      PollErrorSchema.parse({
        timestamp: '2026-07-06T18:00:00Z',
        code: 'unknown',
        message: 'x',
        mailboxUid: -1,
      }),
    ).toThrow();
  });
});
