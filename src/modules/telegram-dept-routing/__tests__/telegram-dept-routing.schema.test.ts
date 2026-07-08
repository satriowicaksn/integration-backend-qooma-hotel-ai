import { describe, expect, it } from '@jest/globals';

import {
  UpdateDepartmentTelegramRoutingRequestSchema,
  UpdateDepartmentTelegramRoutingResponseSchema,
} from '../telegram-dept-routing.schema.js';

describe('UpdateDepartmentTelegramRoutingRequestSchema', () => {
  it('should accept a body with both routing fields set', () => {
    const parsed = UpdateDepartmentTelegramRoutingRequestSchema.parse({
      telegram_chat_id: '-1001234567890',
      supervisor_telegram_id: '987654321',
    });
    expect(parsed).toEqual({
      telegram_chat_id: '-1001234567890',
      supervisor_telegram_id: '987654321',
    });
  });

  it('should accept a body with only telegram_chat_id', () => {
    const parsed = UpdateDepartmentTelegramRoutingRequestSchema.parse({
      telegram_chat_id: '-1001234567890',
    });
    expect(parsed.telegram_chat_id).toBe('-1001234567890');
    expect(parsed.supervisor_telegram_id).toBeUndefined();
  });

  it('should accept a body with only supervisor_telegram_id', () => {
    const parsed = UpdateDepartmentTelegramRoutingRequestSchema.parse({
      supervisor_telegram_id: '987654321',
    });
    expect(parsed.supervisor_telegram_id).toBe('987654321');
    expect(parsed.telegram_chat_id).toBeUndefined();
  });

  it('should reject an empty body (both fields undefined) at .refine boundary', () => {
    expect(() => UpdateDepartmentTelegramRoutingRequestSchema.parse({})).toThrow(/at least one/i);
  });

  it('should reject an oversized routing id (>64 chars)', () => {
    expect(() =>
      UpdateDepartmentTelegramRoutingRequestSchema.parse({
        telegram_chat_id: 'x'.repeat(65),
      }),
    ).toThrow();
  });

  it('should reject an unknown top-level key (.strict())', () => {
    expect(() =>
      UpdateDepartmentTelegramRoutingRequestSchema.parse({
        telegram_chat_id: '-1001234567890',
        gm_telegram_id: '111',
      }),
    ).toThrow();
  });

  it('should reject an empty-string routing id (min 1)', () => {
    expect(() =>
      UpdateDepartmentTelegramRoutingRequestSchema.parse({
        telegram_chat_id: '',
      }),
    ).toThrow();
  });
});

describe('UpdateDepartmentTelegramRoutingResponseSchema', () => {
  it('should accept a well-formed response', () => {
    const parsed = UpdateDepartmentTelegramRoutingResponseSchema.parse({
      updated: true,
      updated_at: '2026-07-08T09:30:00.000Z',
    });
    expect(parsed).toEqual({ updated: true, updated_at: '2026-07-08T09:30:00.000Z' });
  });

  it('should reject a response where `updated` is not literal true', () => {
    expect(() =>
      UpdateDepartmentTelegramRoutingResponseSchema.parse({
        updated: false,
        updated_at: '2026-07-08T09:30:00.000Z',
      }),
    ).toThrow();
  });
});
