import { describe, expect, it } from '@jest/globals';

import {
  HotelCoreResubmitRpcPayloadSchema,
  HotelCoreSubmitRpcPayloadSchema,
  TemplateStatusEventSchema,
  WaTemplateComponentSchema,
} from '../whatsapp-template.schema.js';

const validSubmitPayload = {
  templateId: '00000000-0000-0000-0000-000000000001',
  wabaId: '9876543210',
  accessToken: 'plaintext-access-token',
  name: 'booking_confirmed',
  category: 'UTILITY' as const,
  language: 'en_US',
  components: [
    { type: 'HEADER' as const, format: 'TEXT' as const, text: 'Booking Confirmed' },
    { type: 'BODY' as const, text: 'Hello {{1}}, your booking {{2}} is confirmed.' },
  ],
};

const validResubmitPayload = {
  ...validSubmitPayload,
  metaTemplateId: 'meta_tpl_abc123',
};

const validStatusEvent = {
  hotelId: '00000000-0000-0000-0000-000000000000',
  metaTemplateId: 'meta_tpl_abc123',
  templateName: 'booking_confirmed',
  status: 'APPROVED' as const,
  reason: undefined,
};

describe('WaTemplateComponentSchema', () => {
  it('should parse a BODY component when text is present', () => {
    const parsed = WaTemplateComponentSchema.parse({ type: 'BODY', text: 'Hello world' });
    expect(parsed.type).toBe('BODY');
    expect(parsed.text).toBe('Hello world');
  });

  it('should parse a BUTTONS component when buttons array is provided', () => {
    const parsed = WaTemplateComponentSchema.parse({
      type: 'BUTTONS',
      buttons: [{ type: 'QUICK_REPLY', text: 'Yes' }],
    });
    expect(parsed.buttons).toHaveLength(1);
  });

  it('should reject an unknown component type', () => {
    const result = WaTemplateComponentSchema.safeParse({ type: 'SIDEBAR', text: 'x' });
    expect(result.success).toBe(false);
  });

  it('should reject a component with an unknown extra field', () => {
    const result = WaTemplateComponentSchema.safeParse({ type: 'BODY', text: 'x', extra: 'nope' });
    expect(result.success).toBe(false);
  });
});

describe('HotelCoreSubmitRpcPayloadSchema', () => {
  it('should parse a valid submit payload when all fields match spec bounds', () => {
    const parsed = HotelCoreSubmitRpcPayloadSchema.parse(validSubmitPayload);
    expect(parsed).toEqual(validSubmitPayload);
  });

  it('should reject the payload when templateId is not a uuid', () => {
    const result = HotelCoreSubmitRpcPayloadSchema.safeParse({
      ...validSubmitPayload,
      templateId: 'not-a-uuid',
    });
    expect(result.success).toBe(false);
  });

  it('should reject the payload when category is an unknown vendor value', () => {
    const result = HotelCoreSubmitRpcPayloadSchema.safeParse({
      ...validSubmitPayload,
      category: 'PROMOTIONAL',
    });
    expect(result.success).toBe(false);
  });

  it('should reject the payload when components array is empty', () => {
    const result = HotelCoreSubmitRpcPayloadSchema.safeParse({
      ...validSubmitPayload,
      components: [],
    });
    expect(result.success).toBe(false);
  });

  it('should reject the payload when wabaId exceeds 80 chars', () => {
    const result = HotelCoreSubmitRpcPayloadSchema.safeParse({
      ...validSubmitPayload,
      wabaId: 'w'.repeat(81),
    });
    expect(result.success).toBe(false);
  });

  it('should reject the payload when accessToken is empty', () => {
    const result = HotelCoreSubmitRpcPayloadSchema.safeParse({
      ...validSubmitPayload,
      accessToken: '',
    });
    expect(result.success).toBe(false);
  });

  it('should reject the payload when an unknown extra field is included', () => {
    const result = HotelCoreSubmitRpcPayloadSchema.safeParse({
      ...validSubmitPayload,
      extra: 'nope',
    });
    expect(result.success).toBe(false);
  });
});

describe('HotelCoreResubmitRpcPayloadSchema', () => {
  it('should parse a valid resubmit payload when metaTemplateId is present', () => {
    const parsed = HotelCoreResubmitRpcPayloadSchema.parse(validResubmitPayload);
    expect(parsed.metaTemplateId).toBe('meta_tpl_abc123');
  });

  it('should reject a resubmit payload when metaTemplateId is missing', () => {
    const { metaTemplateId: _drop, ...withoutMeta } = validResubmitPayload;
    const result = HotelCoreResubmitRpcPayloadSchema.safeParse(withoutMeta);
    expect(result.success).toBe(false);
  });

  it('should reject a resubmit payload when metaTemplateId is empty', () => {
    const result = HotelCoreResubmitRpcPayloadSchema.safeParse({
      ...validResubmitPayload,
      metaTemplateId: '',
    });
    expect(result.success).toBe(false);
  });
});

describe('TemplateStatusEventSchema', () => {
  it('should parse a valid status event when reason is omitted', () => {
    const { reason: _drop, ...withoutReason } = validStatusEvent;
    const parsed = TemplateStatusEventSchema.parse(withoutReason);
    expect(parsed.status).toBe('APPROVED');
    expect(parsed.reason).toBeUndefined();
  });

  it('should parse a valid status event when reason is provided', () => {
    const parsed = TemplateStatusEventSchema.parse({
      ...validStatusEvent,
      status: 'REJECTED',
      reason: 'Content violates policy',
    });
    expect(parsed.status).toBe('REJECTED');
    expect(parsed.reason).toBe('Content violates policy');
  });

  it('should reject the event when status is unknown', () => {
    const result = TemplateStatusEventSchema.safeParse({
      ...validStatusEvent,
      status: 'FLAGGED',
    });
    expect(result.success).toBe(false);
  });

  it('should reject the event when hotelId is not a uuid', () => {
    const result = TemplateStatusEventSchema.safeParse({
      ...validStatusEvent,
      hotelId: 'not-uuid',
    });
    expect(result.success).toBe(false);
  });

  it('should reject the event when reason exceeds 500 chars', () => {
    const result = TemplateStatusEventSchema.safeParse({
      ...validStatusEvent,
      status: 'REJECTED',
      reason: 'x'.repeat(501),
    });
    expect(result.success).toBe(false);
  });

  it('should reject the event when an unknown extra field is included', () => {
    const result = TemplateStatusEventSchema.safeParse({ ...validStatusEvent, extra: 'nope' });
    expect(result.success).toBe(false);
  });
});
