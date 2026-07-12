// Unit tests for T27 AI inbound stub adapter.

import { describe, expect, it, jest } from '@jest/globals';

import type { Logger } from '@core/logger/logger.js';

import { AiInboundStubAdapter } from '../adapters/ai-inbound.stub-adapter.js';
import type { AiInboundInput } from '../whatsapp-webhook-ingest.types.js';

const HOTEL_ID = '11111111-2222-3333-4444-555555555555';
const GUEST_ID = '22222222-3333-4444-5555-666666666666';
const MESSAGE_ID = 'wamid.HBg';
const BODY = 'I would like to check in early tomorrow, please.';

const VALID_INPUT: AiInboundInput = {
  hotelId: HOTEL_ID,
  agentSlug: 'reception',
  sourceId: MESSAGE_ID,
  messages: [{ role: 'user', content: BODY }],
  context: { guestId: GUEST_ID, channel: 'whatsapp', locale: 'id' },
};

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
  it('should resolve with a synthetic AiChatResult without throwing', async () => {
    const adapter = new AiInboundStubAdapter(createLoggerSpy());
    await expect(adapter.inboundWaMessage(VALID_INPUT)).resolves.toMatchObject({
      conversationId: expect.any(String) as string,
      reply: expect.any(String) as string,
      stopReason: 'stub',
    });
  });

  it('should NEVER include raw message content in the log payload (PII floor)', async () => {
    const logger = createLoggerSpy();
    const adapter = new AiInboundStubAdapter(logger);
    await adapter.inboundWaMessage(VALID_INPUT);
    expect(logger.warn).toHaveBeenCalledTimes(1);
    const payload = logger.warn.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(JSON.stringify(payload)).not.toContain(BODY);
    expect(payload['messageCount']).toBe(1);
    expect(payload['msg']).toBe('ai_inbound.stub_invoked');
    expect(payload['ratifyQs']).toBe('Q-B-05');
  });

  it('should include agentSlug and sourceId in the log payload', async () => {
    const logger = createLoggerSpy();
    const adapter = new AiInboundStubAdapter(logger);
    await adapter.inboundWaMessage(VALID_INPUT);
    const payload = logger.warn.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(payload['agentSlug']).toBe('reception');
    expect(payload['sourceId']).toBe(MESSAGE_ID);
  });
});
