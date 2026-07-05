import { describe, expect, it } from '@jest/globals';

import { OutboundDispatchRequestSchema } from '../whatsapp-outbound-dispatch.schema.js';

const HOTEL_ID = '00000000-0000-4000-8000-000000000001';
const GUEST_ID = '00000000-0000-4000-8000-000000000002';

const textOnlyRequest = {
  hotelId: HOTEL_ID,
  guestId: GUEST_ID,
  recipientPhone: '628123456789',
  body: 'Halo, welcome!',
};

const templateOnlyRequest = {
  hotelId: HOTEL_ID,
  guestId: GUEST_ID,
  recipientPhone: '628123456789',
  template: {
    name: 'welcome_template',
    languageCode: 'id',
    variables: ['Nanak', 'Room 101'],
  },
};

describe('OutboundDispatchRequestSchema', () => {
  it('should parse a body-only request when all base fields are valid', () => {
    const parsed = OutboundDispatchRequestSchema.parse(textOnlyRequest);
    expect('body' in parsed).toBe(true);
    if ('body' in parsed) {
      expect(parsed.body).toBe('Halo, welcome!');
    }
    expect('template' in parsed).toBe(false);
  });

  it('should parse a template-only request when the template shape is valid', () => {
    const parsed = OutboundDispatchRequestSchema.parse(templateOnlyRequest);
    expect('template' in parsed).toBe(true);
    if ('template' in parsed) {
      expect(parsed.template.name).toBe('welcome_template');
    }
    expect('body' in parsed).toBe(false);
  });

  it('should parse a template request without variables', () => {
    const parsed = OutboundDispatchRequestSchema.parse({
      hotelId: HOTEL_ID,
      guestId: GUEST_ID,
      recipientPhone: '628123456789',
      template: { name: 'ping', languageCode: 'en' },
    });
    expect('template' in parsed).toBe(true);
    if ('template' in parsed) {
      expect(parsed.template.variables).toBeUndefined();
    }
  });

  it('should reject a request with BOTH body and template (mutually exclusive)', () => {
    const result = OutboundDispatchRequestSchema.safeParse({
      ...textOnlyRequest,
      template: { name: 'x', languageCode: 'id' },
    });
    expect(result.success).toBe(false);
  });

  it('should reject a request with NEITHER body nor template', () => {
    const result = OutboundDispatchRequestSchema.safeParse({
      hotelId: HOTEL_ID,
      guestId: GUEST_ID,
      recipientPhone: '628123456789',
    });
    expect(result.success).toBe(false);
  });

  it('should reject a request whose hotelId is not a uuid', () => {
    const result = OutboundDispatchRequestSchema.safeParse({
      ...textOnlyRequest,
      hotelId: 'not-uuid',
    });
    expect(result.success).toBe(false);
  });

  it('should reject a request whose guestId is not a uuid', () => {
    const result = OutboundDispatchRequestSchema.safeParse({
      ...textOnlyRequest,
      guestId: 'not-uuid',
    });
    expect(result.success).toBe(false);
  });

  it('should reject a request whose recipientPhone exceeds 32 chars', () => {
    const result = OutboundDispatchRequestSchema.safeParse({
      ...textOnlyRequest,
      recipientPhone: '6'.repeat(33),
    });
    expect(result.success).toBe(false);
  });

  it('should reject an empty body string (min 1)', () => {
    const result = OutboundDispatchRequestSchema.safeParse({
      ...textOnlyRequest,
      body: '',
    });
    expect(result.success).toBe(false);
  });

  it('should reject a body exceeding 4096 chars', () => {
    const result = OutboundDispatchRequestSchema.safeParse({
      ...textOnlyRequest,
      body: 'x'.repeat(4097),
    });
    expect(result.success).toBe(false);
  });

  it('should reject an unknown extra field on the request envelope', () => {
    const result = OutboundDispatchRequestSchema.safeParse({
      ...textOnlyRequest,
      extra: 'nope',
    });
    expect(result.success).toBe(false);
  });

  it('should reject a template with an unknown extra field', () => {
    const result = OutboundDispatchRequestSchema.safeParse({
      hotelId: HOTEL_ID,
      guestId: GUEST_ID,
      recipientPhone: '628123456789',
      template: { name: 'x', languageCode: 'id', extra: 'nope' },
    });
    expect(result.success).toBe(false);
  });
});
