import { describe, expect, it } from '@jest/globals';

import {
  WhatsappDeliveryStatusesEnvelopeSchema,
  extractStatuses,
} from '../whatsapp-delivery-receipts.schema.js';

const singleStatusEnvelope = {
  object: 'whatsapp_business_account' as const,
  entry: [
    {
      id: 'entry-1',
      changes: [
        {
          field: 'messages',
          value: {
            messaging_product: 'whatsapp' as const,
            metadata: {
              display_phone_number: '15551234567',
              phone_number_id: 'phone-123',
            },
            statuses: [
              {
                id: 'wamid.abc123',
                status: 'delivered' as const,
                timestamp: '1728000000',
                recipient_id: '628123456789',
              },
            ],
          },
        },
      ],
    },
  ],
};

const messagesOnlyEnvelope = {
  object: 'whatsapp_business_account' as const,
  entry: [
    {
      id: 'entry-2',
      changes: [
        {
          field: 'messages',
          value: {
            messaging_product: 'whatsapp' as const,
            metadata: {
              display_phone_number: '15551234567',
              phone_number_id: 'phone-123',
            },
            messages: [{ id: 'wamid.msg1', from: '628999888777' }],
          },
        },
      ],
    },
  ],
};

const multiStatusProgressionEnvelope = {
  object: 'whatsapp_business_account' as const,
  entry: [
    {
      id: 'entry-1',
      changes: [
        {
          field: 'messages',
          value: {
            messaging_product: 'whatsapp' as const,
            metadata: {
              display_phone_number: '15551234567',
              phone_number_id: 'phone-123',
            },
            statuses: [
              { id: 'wamid.abc', status: 'sent' as const, timestamp: '1728000000' },
              {
                id: 'wamid.abc',
                status: 'delivered' as const,
                timestamp: '1728000001',
                recipient_id: '628123456789',
              },
              {
                id: 'wamid.abc',
                status: 'read' as const,
                timestamp: '1728000002',
                recipient_id: '628123456789',
              },
            ],
          },
        },
      ],
    },
  ],
};

describe('WhatsappDeliveryStatusesEnvelopeSchema', () => {
  it('should parse a single-status envelope when the Meta shape is well-formed', () => {
    const parsed = WhatsappDeliveryStatusesEnvelopeSchema.parse(singleStatusEnvelope);
    expect(parsed.entry[0]?.changes[0]?.value.statuses?.[0]?.id).toBe('wamid.abc123');
  });

  it('should parse a messages-only envelope (T12 branch — statuses absent)', () => {
    const parsed = WhatsappDeliveryStatusesEnvelopeSchema.parse(messagesOnlyEnvelope);
    expect(parsed.entry[0]?.changes[0]?.value.statuses).toBeUndefined();
    expect(parsed.entry[0]?.changes[0]?.value.messages).toHaveLength(1);
  });

  it('should reject an envelope whose object marker is wrong', () => {
    const result = WhatsappDeliveryStatusesEnvelopeSchema.safeParse({
      ...singleStatusEnvelope,
      object: 'other',
    });
    expect(result.success).toBe(false);
  });

  it('should reject an envelope whose entry array is empty', () => {
    const result = WhatsappDeliveryStatusesEnvelopeSchema.safeParse({
      object: 'whatsapp_business_account',
      entry: [],
    });
    expect(result.success).toBe(false);
  });

  it('should reject an envelope whose messaging_product is not whatsapp', () => {
    const bad = {
      ...singleStatusEnvelope,
      entry: [
        {
          id: 'entry-1',
          changes: [
            {
              field: 'messages',
              value: {
                messaging_product: 'instagram',
                metadata: { display_phone_number: '1', phone_number_id: '1' },
              },
            },
          ],
        },
      ],
    };
    const result = WhatsappDeliveryStatusesEnvelopeSchema.safeParse(bad);
    expect(result.success).toBe(false);
  });

  it('should reject a status entry whose status value is not in the CHECK enum', () => {
    const bad = {
      ...singleStatusEnvelope,
      entry: [
        {
          id: 'entry-1',
          changes: [
            {
              field: 'messages',
              value: {
                messaging_product: 'whatsapp' as const,
                metadata: { display_phone_number: '1', phone_number_id: '1' },
                statuses: [{ id: 'wamid.x', status: 'FLAGGED', timestamp: '1728000000' }],
              },
            },
          ],
        },
      ],
    };
    const result = WhatsappDeliveryStatusesEnvelopeSchema.safeParse(bad);
    expect(result.success).toBe(false);
  });

  it('should reject a status entry whose externalId exceeds 80 chars (DDL VARCHAR bound)', () => {
    const bad = {
      ...singleStatusEnvelope,
      entry: [
        {
          id: 'entry-1',
          changes: [
            {
              field: 'messages',
              value: {
                messaging_product: 'whatsapp' as const,
                metadata: { display_phone_number: '1', phone_number_id: '1' },
                statuses: [{ id: 'x'.repeat(81), status: 'delivered', timestamp: '1728000000' }],
              },
            },
          ],
        },
      ],
    };
    const result = WhatsappDeliveryStatusesEnvelopeSchema.safeParse(bad);
    expect(result.success).toBe(false);
  });
});

describe('extractStatuses', () => {
  it('should return a single normalized entry with recipientId populated when Meta provides it', () => {
    const parsed = WhatsappDeliveryStatusesEnvelopeSchema.parse(singleStatusEnvelope);
    const out = extractStatuses(parsed);
    expect(out).toHaveLength(1);
    expect(out[0]?.externalId).toBe('wamid.abc123');
    expect(out[0]?.status).toBe('delivered');
    expect(out[0]?.recipientId).toBe('628123456789');
  });

  it('should return an empty array for a messages-only envelope (T12 branch)', () => {
    const parsed = WhatsappDeliveryStatusesEnvelopeSchema.parse(messagesOnlyEnvelope);
    expect(extractStatuses(parsed)).toEqual([]);
  });

  it('should return three entries for a sent→delivered→read progression of the same externalId', () => {
    const parsed = WhatsappDeliveryStatusesEnvelopeSchema.parse(multiStatusProgressionEnvelope);
    const out = extractStatuses(parsed);
    expect(out).toHaveLength(3);
    expect(out.map((e) => e.status)).toEqual(['sent', 'delivered', 'read']);
    expect(new Set(out.map((e) => e.externalId))).toEqual(new Set(['wamid.abc']));
  });

  it('should omit recipientId when Meta did not send it (sent branch typically has no recipient_id)', () => {
    const parsed = WhatsappDeliveryStatusesEnvelopeSchema.parse(multiStatusProgressionEnvelope);
    const out = extractStatuses(parsed);
    expect(out[0]?.recipientId).toBeUndefined();
    expect(out[1]?.recipientId).toBe('628123456789');
  });
});
