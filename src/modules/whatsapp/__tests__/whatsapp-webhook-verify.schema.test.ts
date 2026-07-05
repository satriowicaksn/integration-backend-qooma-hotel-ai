import { describe, expect, it } from '@jest/globals';

import { WhatsappVerifyWebhookResponseSchema } from '../whatsapp-webhook-verify.schema.js';

const validVerified = {
  hotelId: '00000000-0000-0000-0000-000000000000',
  verified: true,
  verifiedAt: new Date('2026-07-05T14:25:00Z'),
  outcome: 'verified' as const,
  statusCode: 200,
};

const validUnreachable = {
  hotelId: '00000000-0000-0000-0000-000000000000',
  verified: false,
  verifiedAt: null,
  outcome: 'unreachable' as const,
};

describe('WhatsappVerifyWebhookResponseSchema', () => {
  it('should parse the verified branch when reachable + statusCode present', () => {
    const parsed = WhatsappVerifyWebhookResponseSchema.parse(validVerified);
    expect(parsed.verified).toBe(true);
    expect(parsed.verifiedAt).toBeInstanceOf(Date);
    expect(parsed.outcome).toBe('verified');
    expect(parsed.statusCode).toBe(200);
  });

  it('should parse the unreachable branch when verifiedAt is null and statusCode omitted', () => {
    const parsed = WhatsappVerifyWebhookResponseSchema.parse(validUnreachable);
    expect(parsed.verified).toBe(false);
    expect(parsed.verifiedAt).toBeNull();
    expect(parsed.outcome).toBe('unreachable');
    expect(parsed.statusCode).toBeUndefined();
  });

  it('should parse the invalid_response branch when hotel returned non-2xx', () => {
    const parsed = WhatsappVerifyWebhookResponseSchema.parse({
      hotelId: '00000000-0000-0000-0000-000000000000',
      verified: false,
      verifiedAt: null,
      outcome: 'invalid_response',
      statusCode: 404,
      reason: 'Endpoint returned 404',
    });
    expect(parsed.outcome).toBe('invalid_response');
    expect(parsed.statusCode).toBe(404);
    expect(parsed.reason).toBe('Endpoint returned 404');
  });

  it('should reject the response when hotelId is not a uuid', () => {
    const result = WhatsappVerifyWebhookResponseSchema.safeParse({
      ...validVerified,
      hotelId: 'not-uuid',
    });
    expect(result.success).toBe(false);
  });

  it('should reject the response when outcome is unknown', () => {
    const result = WhatsappVerifyWebhookResponseSchema.safeParse({
      ...validVerified,
      outcome: 'succeeded',
    });
    expect(result.success).toBe(false);
  });

  it('should reject the response when verifiedAt is not a Date instance', () => {
    const result = WhatsappVerifyWebhookResponseSchema.safeParse({
      ...validVerified,
      verifiedAt: '2026-07-05T14:25:00Z',
    });
    expect(result.success).toBe(false);
  });

  it('should reject the response when statusCode is negative', () => {
    const result = WhatsappVerifyWebhookResponseSchema.safeParse({
      ...validVerified,
      statusCode: -1,
    });
    expect(result.success).toBe(false);
  });

  it('should reject the response when reason exceeds 500 chars', () => {
    const result = WhatsappVerifyWebhookResponseSchema.safeParse({
      ...validVerified,
      reason: 'x'.repeat(501),
    });
    expect(result.success).toBe(false);
  });

  it('should reject the response when an unknown extra field is included', () => {
    const result = WhatsappVerifyWebhookResponseSchema.safeParse({
      ...validVerified,
      extra: 'nope',
    });
    expect(result.success).toBe(false);
  });
});
