// Unit tests for the T28 dispatch wire schema (ADR-0009 boundary).
// Verifies strict + XOR body/template refinement.

import { describe, expect, it } from '@jest/globals';

import { DispatchRequestSchema } from '../whatsapp-dispatch.schema.js';

const HOTEL_ID = '11111111-2222-3333-4444-555555555555';
const GUEST_ID = '22222222-3333-4444-5555-666666666666';

const baseText = {
  hotel_id: HOTEL_ID,
  guest_id: GUEST_ID,
  to_wa_phone: '+6281234567890',
  body: 'hello',
};

const baseTemplate = {
  hotel_id: HOTEL_ID,
  guest_id: GUEST_ID,
  to_wa_phone: '+6281234567890',
  template: {
    name: 'booking_confirmation',
    language_code: 'en',
    variables: ['Satrio'],
  },
};

describe('DispatchRequestSchema — text branch', () => {
  it('should parse a minimal text send when only required fields are present', () => {
    const parsed = DispatchRequestSchema.parse(baseText);
    expect(parsed.hotel_id).toBe(HOTEL_ID);
  });

  it('should accept optional wa_config_id + correlation_id fields', () => {
    const parsed = DispatchRequestSchema.parse({
      ...baseText,
      wa_config_id: HOTEL_ID,
      correlation_id: 'corr-1',
    });
    expect('body' in parsed).toBe(true);
  });

  it('should reject a text send when body is empty', () => {
    const result = DispatchRequestSchema.safeParse({ ...baseText, body: '' });
    expect(result.success).toBe(false);
  });

  it('should reject a text send when hotel_id is not a uuid', () => {
    const result = DispatchRequestSchema.safeParse({ ...baseText, hotel_id: 'not-uuid' });
    expect(result.success).toBe(false);
  });

  it('should reject a text send when an unknown extra field is present', () => {
    const result = DispatchRequestSchema.safeParse({ ...baseText, extra: 'nope' });
    expect(result.success).toBe(false);
  });
});

describe('DispatchRequestSchema — template branch', () => {
  it('should parse a minimal template send when required fields are present', () => {
    const parsed = DispatchRequestSchema.parse(baseTemplate);
    expect('template' in parsed).toBe(true);
  });

  it('should reject a template send when the template name is empty', () => {
    const result = DispatchRequestSchema.safeParse({
      ...baseTemplate,
      template: { ...baseTemplate.template, name: '' },
    });
    expect(result.success).toBe(false);
  });
});

describe('DispatchRequestSchema — XOR refinement', () => {
  it('should reject a payload when both body AND template are present', () => {
    const result = DispatchRequestSchema.safeParse({
      ...baseText,
      template: baseTemplate.template,
    });
    expect(result.success).toBe(false);
  });

  it('should reject a payload when neither body NOR template is present', () => {
    const { body: _body, ...noBody } = baseText;
    const result = DispatchRequestSchema.safeParse(noBody);
    expect(result.success).toBe(false);
  });
});
