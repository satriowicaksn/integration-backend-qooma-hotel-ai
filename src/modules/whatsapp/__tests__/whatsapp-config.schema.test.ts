import { describe, expect, it } from '@jest/globals';

import {
  WhatsappConfigPutSchema,
  WhatsappConfigResponseSchema,
} from '../whatsapp-config.schema.js';

const validPutInput = {
  bsp: '1engage' as const,
  phoneNumberId: '1234567890',
  phoneNumber: '+6281234567890',
  accessToken: 'plaintext-access-token',
  webhookUrl: 'https://example.com/webhook',
  webhookVerifyToken: 'verify-token-abc',
};

describe('WhatsappConfigPutSchema', () => {
  it('should parse a valid input when all fields are present', () => {
    const parsed = WhatsappConfigPutSchema.parse(validPutInput);
    expect(parsed).toEqual(validPutInput);
  });

  it('should default bsp to 1engage when omitted', () => {
    const { bsp: _bsp, ...withoutBsp } = validPutInput;
    const parsed = WhatsappConfigPutSchema.parse(withoutBsp);
    expect(parsed.bsp).toBe('1engage');
  });

  it('should reject bsp when the vendor is unknown', () => {
    const result = WhatsappConfigPutSchema.safeParse({ ...validPutInput, bsp: 'twilio' });
    expect(result.success).toBe(false);
  });

  it('should reject phoneNumber when it is not E.164 formatted', () => {
    const result = WhatsappConfigPutSchema.safeParse({
      ...validPutInput,
      phoneNumber: '081234567890',
    });
    expect(result.success).toBe(false);
  });

  it('should reject phoneNumberId when it exceeds 80 chars', () => {
    const result = WhatsappConfigPutSchema.safeParse({
      ...validPutInput,
      phoneNumberId: 'x'.repeat(81),
    });
    expect(result.success).toBe(false);
  });

  it('should reject accessToken when it is empty', () => {
    const result = WhatsappConfigPutSchema.safeParse({ ...validPutInput, accessToken: '' });
    expect(result.success).toBe(false);
  });

  it('should reject webhookUrl when it is not a valid URL', () => {
    const result = WhatsappConfigPutSchema.safeParse({ ...validPutInput, webhookUrl: 'not-a-url' });
    expect(result.success).toBe(false);
  });

  it('should reject webhookUrl when it exceeds 500 chars', () => {
    const longPath = 'a'.repeat(500);
    const result = WhatsappConfigPutSchema.safeParse({
      ...validPutInput,
      webhookUrl: `https://example.com/${longPath}`,
    });
    expect(result.success).toBe(false);
  });

  it('should reject webhookVerifyToken when it is empty', () => {
    const result = WhatsappConfigPutSchema.safeParse({
      ...validPutInput,
      webhookVerifyToken: '',
    });
    expect(result.success).toBe(false);
  });

  it('should reject webhookVerifyToken when it exceeds 80 chars', () => {
    const result = WhatsappConfigPutSchema.safeParse({
      ...validPutInput,
      webhookVerifyToken: 'v'.repeat(81),
    });
    expect(result.success).toBe(false);
  });

  it('should reject the payload when phoneNumberId is missing', () => {
    const { phoneNumberId: _pid, ...withoutId } = validPutInput;
    const result = WhatsappConfigPutSchema.safeParse(withoutId);
    expect(result.success).toBe(false);
  });

  it('should reject the payload when an unknown extra field is included', () => {
    const result = WhatsappConfigPutSchema.safeParse({ ...validPutInput, extra: 'nope' });
    expect(result.success).toBe(false);
  });
});

describe('WhatsappConfigResponseSchema', () => {
  const validResponse = {
    hotelId: '00000000-0000-0000-0000-000000000000',
    bsp: '1engage' as const,
    phoneNumberId: '1234567890',
    phoneNumber: '+6281234567890',
    accessToken: '***890',
    webhookUrl: 'https://example.com/webhook',
    webhookVerifyToken: '***abc',
    verifiedAt: null,
    createdAt: new Date('2026-07-04T00:00:00Z'),
    updatedAt: new Date('2026-07-04T00:00:00Z'),
  };

  it('should parse a valid masked response when verifiedAt is null', () => {
    const parsed = WhatsappConfigResponseSchema.parse(validResponse);
    expect(parsed.accessToken).toBe('***890');
    expect(parsed.webhookVerifyToken).toBe('***abc');
    expect(parsed.verifiedAt).toBeNull();
  });

  it('should parse a valid masked response when verifiedAt is a Date', () => {
    const parsed = WhatsappConfigResponseSchema.parse({
      ...validResponse,
      verifiedAt: new Date('2026-07-05T12:00:00Z'),
    });
    expect(parsed.verifiedAt).toBeInstanceOf(Date);
  });

  it('should reject the response when hotelId is not a uuid', () => {
    const result = WhatsappConfigResponseSchema.safeParse({
      ...validResponse,
      hotelId: 'not-uuid',
    });
    expect(result.success).toBe(false);
  });

  it('should reject the response when an unknown extra field is included', () => {
    const result = WhatsappConfigResponseSchema.safeParse({ ...validResponse, extra: 'nope' });
    expect(result.success).toBe(false);
  });
});
