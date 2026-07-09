// Unit tests for T27 AI inbound stub adapter.

import { describe, expect, it, jest } from '@jest/globals';

import type { Logger } from '@core/logger/logger.js';

import { AiInboundStubAdapter } from '../adapters/ai-inbound.stub-adapter.js';

const HOTEL_ID = '11111111-2222-3333-4444-555555555555';
const GUEST_ID = '22222222-3333-4444-5555-666666666666';
const MESSAGE_ID = 'wamid.HBg';
const BODY = 'I would like to check in early tomorrow, please.';

function createLoggerSpy(): Logger & {
  info: jest.Mock;
  debug: jest.Mock;
  warn: jest.Mock;
  error: jest.Mock;
} {
  return {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };
}

describe('AiInboundStubAdapter', () => {
  it('should resolve void without throwing when invoked with a valid input', async () => {
    const adapter = new AiInboundStubAdapter(createLoggerSpy());
    await expect(
      adapter.inboundWaMessage({
        hotelId: HOTEL_ID,
        guestId: GUEST_ID,
        messageId: MESSAGE_ID,
        body: BODY,
      }),
    ).resolves.toBeUndefined();
  });

  it('should NEVER include the raw body in the log payload (PII floor)', async () => {
    const logger = createLoggerSpy();
    const adapter = new AiInboundStubAdapter(logger);
    await adapter.inboundWaMessage({
      hotelId: HOTEL_ID,
      guestId: GUEST_ID,
      messageId: MESSAGE_ID,
      body: BODY,
    });
    expect(logger.warn).toHaveBeenCalledTimes(1);
    const payload = logger.warn.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(JSON.stringify(payload)).not.toContain(BODY);
    expect(payload['bodyLength']).toBe(BODY.length);
    expect(payload['msg']).toBe('ai_inbound.stub_invoked');
    expect(payload['ratifyQs']).toBe('Q-B-05');
  });
});
