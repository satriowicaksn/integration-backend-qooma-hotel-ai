import { describe, expect, it } from '@jest/globals';

import { MetaFailureInputSchema, classifyFailure } from '../whatsapp-outbound-retry.schema.js';

const DISPATCH_ID = '00000000-0000-4000-8000-000000000001';
const HOTEL_ID = '11111111-2222-3333-4444-555555555555';

describe('MetaFailureInputSchema', () => {
  it('should parse a valid minimal input with the 3 required fields', () => {
    const parsed = MetaFailureInputSchema.parse({
      dispatchId: DISPATCH_ID,
      hotelId: HOTEL_ID,
      attemptsMade: 0,
    });
    expect(parsed.attemptsMade).toBe(0);
    expect(parsed.status).toBeUndefined();
  });

  it('should parse a full input with all 5 fields including status and body', () => {
    const parsed = MetaFailureInputSchema.parse({
      dispatchId: DISPATCH_ID,
      hotelId: HOTEL_ID,
      attemptsMade: 1,
      status: 500,
      body: { error: 'internal' },
    });
    expect(parsed.status).toBe(500);
    expect(parsed.body).toEqual({ error: 'internal' });
  });

  it('should reject when dispatchId is not a uuid', () => {
    const result = MetaFailureInputSchema.safeParse({
      dispatchId: 'not-uuid',
      hotelId: HOTEL_ID,
      attemptsMade: 0,
    });
    expect(result.success).toBe(false);
  });

  it('should reject when hotelId is not a uuid', () => {
    const result = MetaFailureInputSchema.safeParse({
      dispatchId: DISPATCH_ID,
      hotelId: 'not-uuid',
      attemptsMade: 0,
    });
    expect(result.success).toBe(false);
  });

  it('should reject when attemptsMade is negative', () => {
    const result = MetaFailureInputSchema.safeParse({
      dispatchId: DISPATCH_ID,
      hotelId: HOTEL_ID,
      attemptsMade: -1,
    });
    expect(result.success).toBe(false);
  });

  it('should reject when attemptsMade exceeds the max cap of 3', () => {
    const result = MetaFailureInputSchema.safeParse({
      dispatchId: DISPATCH_ID,
      hotelId: HOTEL_ID,
      attemptsMade: 4,
    });
    expect(result.success).toBe(false);
  });

  it('should reject when attemptsMade is not an integer', () => {
    const result = MetaFailureInputSchema.safeParse({
      dispatchId: DISPATCH_ID,
      hotelId: HOTEL_ID,
      attemptsMade: 1.5,
    });
    expect(result.success).toBe(false);
  });

  it('should reject when an unknown extra field is included (strict)', () => {
    const result = MetaFailureInputSchema.safeParse({
      dispatchId: DISPATCH_ID,
      hotelId: HOTEL_ID,
      attemptsMade: 0,
      extra: 'nope',
    });
    expect(result.success).toBe(false);
  });

  it('should reject when required fields are missing', () => {
    const result = MetaFailureInputSchema.safeParse({
      dispatchId: DISPATCH_ID,
      attemptsMade: 0,
    });
    expect(result.success).toBe(false);
  });
});

describe('classifyFailure — retryable branch', () => {
  it('should classify undefined status as retryable (network / timeout)', () => {
    expect(classifyFailure({})).toEqual({ retryable: true });
  });

  it('should classify 500 as retryable (server error)', () => {
    expect(classifyFailure({ status: 500 })).toEqual({ retryable: true });
  });

  it('should classify 502 Bad Gateway as retryable (5xx)', () => {
    expect(classifyFailure({ status: 502 })).toEqual({ retryable: true });
  });

  it('should classify 503 Service Unavailable as retryable (5xx)', () => {
    expect(classifyFailure({ status: 503 })).toEqual({ retryable: true });
  });

  it('should classify 504 Gateway Timeout as retryable (5xx)', () => {
    expect(classifyFailure({ status: 504 })).toEqual({ retryable: true });
  });
});

describe('classifyFailure — permanent branch (spec §4.9 + PM ACK T14 GAP #2)', () => {
  it('should classify 429 as permanent with reason=quota_exhausted (Meta rate-limit)', () => {
    expect(classifyFailure({ status: 429 })).toEqual({
      retryable: false,
      reason: 'quota_exhausted',
    });
  });

  it('should classify 401 as permanent with reason=auth_failed', () => {
    expect(classifyFailure({ status: 401 })).toEqual({
      retryable: false,
      reason: 'auth_failed',
    });
  });

  it('should classify 403 as permanent with reason=auth_failed', () => {
    expect(classifyFailure({ status: 403 })).toEqual({
      retryable: false,
      reason: 'auth_failed',
    });
  });

  it('should classify 400 as permanent with reason=bad_request', () => {
    expect(classifyFailure({ status: 400 })).toEqual({
      retryable: false,
      reason: 'bad_request',
    });
  });

  it('should classify 422 as permanent with reason=template_rejected', () => {
    expect(classifyFailure({ status: 422 })).toEqual({
      retryable: false,
      reason: 'template_rejected',
    });
  });

  it('should classify 404 (other 4xx) as permanent with reason=bad_request (conservative default)', () => {
    expect(classifyFailure({ status: 404 })).toEqual({
      retryable: false,
      reason: 'bad_request',
    });
  });

  it('should classify 409 (other 4xx) as permanent with reason=bad_request (conservative default)', () => {
    expect(classifyFailure({ status: 409 })).toEqual({
      retryable: false,
      reason: 'bad_request',
    });
  });
});
