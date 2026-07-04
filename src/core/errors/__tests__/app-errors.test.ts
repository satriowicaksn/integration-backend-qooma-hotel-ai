import { describe, it, expect } from '@jest/globals';

import {
  AppError,
  ChannelDegradedError,
  DndBlockError,
  OutboundQuotaError,
  TelegramConfigInvalidError,
  ThirdPartyUnreachableError,
  WaConfigInvalidError,
  WebhookVerificationError,
} from '../app-errors.js';

type ErrCtor = new (message: string, details?: Record<string, unknown>) => AppError;

const CATALOG: Array<{ Ctor: ErrCtor; status: number; code: string }> = [
  { Ctor: WebhookVerificationError, status: 422, code: 'WEBHOOK_VERIFICATION_FAILED' },
  { Ctor: WaConfigInvalidError, status: 422, code: 'WA_CONFIG_INVALID' },
  { Ctor: TelegramConfigInvalidError, status: 422, code: 'TELEGRAM_CONFIG_INVALID' },
  { Ctor: DndBlockError, status: 422, code: 'DND_BLOCK' },
  { Ctor: OutboundQuotaError, status: 429, code: 'RATE_LIMIT' },
  { Ctor: ThirdPartyUnreachableError, status: 502, code: 'THIRD_PARTY_UNREACHABLE' },
  { Ctor: ChannelDegradedError, status: 503, code: 'CHANNEL_DEGRADED' },
];

describe('Integration error catalog (spec §9)', () => {
  CATALOG.forEach(({ Ctor, status, code }) => {
    describe(Ctor.name, () => {
      it(`should carry ${status} / ${code} and be an AppError`, () => {
        const err = new Ctor('boom');
        expect(err).toBeInstanceOf(AppError);
        expect(err.statusCode).toBe(status);
        expect(err.code).toBe(code);
        expect(err.message).toBe('boom');
      });

      it('should serialize to the canonical code/message/details shape', () => {
        const err = new Ctor('boom', { field: 'x' });
        expect(err.toJson()).toEqual({ code, message: 'boom', details: { field: 'x' } });
      });
    });
  });
});
