import { describe, expect, it } from '@jest/globals';

import { IntegrationHealthChangedEventSchema } from '../integration-health-socket-emit.schema.js';

const VALID = {
  hotel_id: '11111111-2222-3333-4444-555555555555',
  provider: 'whatsapp' as const,
  previous_status: 'healthy' as const,
  new_status: 'degraded' as const,
  checked_at: '2026-07-07T11:30:00Z',
};

describe('IntegrationHealthChangedEventSchema', () => {
  it('should parse a well-formed wire payload with all fields snake_case', () => {
    const parsed = IntegrationHealthChangedEventSchema.parse(VALID);
    expect(parsed).toEqual(VALID);
  });

  it('should accept null previous_status for a first-ever probe transition', () => {
    const parsed = IntegrationHealthChangedEventSchema.parse({ ...VALID, previous_status: null });
    expect(parsed.previous_status).toBeNull();
  });

  it('should reject an unsupported provider', () => {
    expect(() =>
      IntegrationHealthChangedEventSchema.parse({ ...VALID, provider: 'expedia' }),
    ).toThrow();
  });

  it('should reject an unsupported new_status', () => {
    expect(() =>
      IntegrationHealthChangedEventSchema.parse({ ...VALID, new_status: 'yellow' }),
    ).toThrow();
  });

  it('should reject an unknown top-level key (binding #8 strict)', () => {
    expect(() => IntegrationHealthChangedEventSchema.parse({ ...VALID, evil: true })).toThrow();
  });

  it('should reject a camelCase input shape (contract is snake_case)', () => {
    expect(() =>
      IntegrationHealthChangedEventSchema.parse({
        hotelId: VALID.hotel_id,
        provider: VALID.provider,
        previousStatus: VALID.previous_status,
        newStatus: VALID.new_status,
        checkedAt: VALID.checked_at,
      }),
    ).toThrow();
  });
});
