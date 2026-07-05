import { describe, expect, it } from '@jest/globals';

import {
  WhatsappInboundEnvelopeSchema,
  WhatsappInboundIngestResponseSchema,
  extractInboundMessages,
} from '../whatsapp-webhook-ingest.schema.js';

const HOTEL_UUID = '00000000-0000-4000-8000-000000000000';

const singleMessageEnvelope = {
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
            contacts: [{ wa_id: '628123456789', profile: { name: 'Nanak' } }],
            messages: [
              {
                id: 'wamid.hello1',
                from: '628123456789',
                timestamp: '1728000000',
                type: 'text',
                text: { body: 'Halo, ada kamar kosong?' },
              },
            ],
          },
        },
      ],
    },
  ],
};

const receiptOnlyEnvelope = {
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
            statuses: [{ id: 'wamid.status1', status: 'delivered' }],
          },
        },
      ],
    },
  ],
};

const multiMessageEnvelope = {
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
            contacts: [
              { wa_id: '628123456789', profile: { name: 'Nanak' } },
              { wa_id: '628999888777' },
            ],
            messages: [
              {
                id: 'wamid.a',
                from: '628123456789',
                timestamp: '1728000000',
                type: 'text',
                text: { body: 'Halo' },
              },
              {
                id: 'wamid.b',
                from: '628999888777',
                timestamp: '1728000001',
                type: 'image',
              },
            ],
          },
        },
      ],
    },
  ],
};

describe('WhatsappInboundEnvelopeSchema', () => {
  it('should parse a single-message envelope when Meta shape is well-formed', () => {
    const parsed = WhatsappInboundEnvelopeSchema.parse(singleMessageEnvelope);
    expect(parsed.entry).toHaveLength(1);
    expect(parsed.entry[0]?.changes[0]?.value.messages?.[0]?.id).toBe('wamid.hello1');
  });

  it('should parse a status-only envelope (delivery receipt branch)', () => {
    const parsed = WhatsappInboundEnvelopeSchema.parse(receiptOnlyEnvelope);
    expect(parsed.entry[0]?.changes[0]?.value.messages).toBeUndefined();
    expect(parsed.entry[0]?.changes[0]?.value.statuses).toHaveLength(1);
  });

  it('should reject an envelope whose object marker is not whatsapp_business_account', () => {
    const result = WhatsappInboundEnvelopeSchema.safeParse({
      ...singleMessageEnvelope,
      object: 'other',
    });
    expect(result.success).toBe(false);
  });

  it('should reject an envelope whose entry array is empty', () => {
    const result = WhatsappInboundEnvelopeSchema.safeParse({
      object: 'whatsapp_business_account',
      entry: [],
    });
    expect(result.success).toBe(false);
  });

  it('should reject an envelope whose messaging_product is not whatsapp', () => {
    const bad = {
      ...singleMessageEnvelope,
      entry: [
        {
          ...(singleMessageEnvelope.entry[0] as { id: string }),
          changes: [
            {
              field: 'messages',
              value: {
                messaging_product: 'instagram',
                metadata: {
                  display_phone_number: '1',
                  phone_number_id: '1',
                },
              },
            },
          ],
        },
      ],
    };
    const result = WhatsappInboundEnvelopeSchema.safeParse(bad);
    expect(result.success).toBe(false);
  });

  it('should pass-through additional unknown top-level fields on the envelope (spec-drift tolerance)', () => {
    const parsed = WhatsappInboundEnvelopeSchema.parse({
      ...singleMessageEnvelope,
      unknownFutureField: 'safe-to-ignore',
    });
    expect(parsed.entry[0]?.changes[0]?.value.messages?.[0]?.id).toBe('wamid.hello1');
  });
});

describe('extractInboundMessages', () => {
  it('should return a single normalized message with the profile name populated when contacts include it', () => {
    const parsed = WhatsappInboundEnvelopeSchema.parse(singleMessageEnvelope);
    const messages = extractInboundMessages(parsed);
    expect(messages).toHaveLength(1);
    expect(messages[0]?.messageId).toBe('wamid.hello1');
    expect(messages[0]?.waPhone).toBe('628123456789');
    expect(messages[0]?.body).toBe('Halo, ada kamar kosong?');
    expect(messages[0]?.profileName).toBe('Nanak');
  });

  it('should return an empty array for a receipt-only envelope (T15 branch)', () => {
    const parsed = WhatsappInboundEnvelopeSchema.parse(receiptOnlyEnvelope);
    expect(extractInboundMessages(parsed)).toEqual([]);
  });

  it('should normalize multiple messages and populate profileName only when the contact provided one', () => {
    const parsed = WhatsappInboundEnvelopeSchema.parse(multiMessageEnvelope);
    const messages = extractInboundMessages(parsed);
    expect(messages).toHaveLength(2);
    expect(messages[0]?.profileName).toBe('Nanak');
    expect(messages[1]?.profileName).toBeUndefined();
  });

  it('should return an empty string body when the message type is non-text (no text.body)', () => {
    const parsed = WhatsappInboundEnvelopeSchema.parse(multiMessageEnvelope);
    const messages = extractInboundMessages(parsed);
    expect(messages[1]?.body).toBe('');
  });
});

describe('WhatsappInboundIngestResponseSchema', () => {
  it('should parse a valid sync-leg response with eventId and isDuplicate=false', () => {
    const parsed = WhatsappInboundIngestResponseSchema.parse({
      eventId: HOTEL_UUID,
      isDuplicate: false,
    });
    expect(parsed.isDuplicate).toBe(false);
  });

  it('should reject a response missing isDuplicate', () => {
    const result = WhatsappInboundIngestResponseSchema.safeParse({ eventId: HOTEL_UUID });
    expect(result.success).toBe(false);
  });

  it('should reject a response with an unknown extra field', () => {
    const result = WhatsappInboundIngestResponseSchema.safeParse({
      eventId: HOTEL_UUID,
      isDuplicate: false,
      extra: 'nope',
    });
    expect(result.success).toBe(false);
  });
});
