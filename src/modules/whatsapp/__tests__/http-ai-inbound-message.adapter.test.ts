/**
 * Unit tests for HttpAiInboundMessageAdapter.
 *
 * Stubs axios with jest to avoid real HTTP calls. Verifies:
 * - HMAC headers (X-Service-Name, X-Service-Signature format)
 * - Payload snake_case mapping
 * - 200 → AiChatResult parsing
 * - 5xx retry logic (max 2 retries) with non-retryable 502 AI_PROVIDER_ERROR
 * - ExternalServiceError thrown on final failure
 */

import { createHmac } from 'node:crypto';

import { describe, expect, it, jest, beforeEach } from '@jest/globals';
import axios from 'axios';
import type { AxiosInstance } from 'axios';

import { ExternalServiceError } from '@core/errors/app-errors.js';
import type { Logger } from '@core/logger/logger.js';

import { HttpAiInboundMessageAdapter } from '../adapters/http-ai-inbound-message.adapter.js';
import type { AiInboundInput } from '../whatsapp-webhook-ingest.types.js';

jest.mock('axios');

const mockedAxios = axios as jest.Mocked<typeof axios>;

const CONFIG = {
  baseUrl: 'http://localhost:3000',
  hmacSecret: 'test-secret-at-least-32-chars-long-abc',
};

const VALID_INPUT: AiInboundInput = {
  hotelId: '11111111-2222-3333-4444-555555555555',
  agentSlug: 'reception',
  sourceId: 'wamid.abc123',
  messages: [{ role: 'user', content: 'Halo, jam berapa breakfast?' }],
  context: { guestId: 'guest-uuid-1', channel: 'whatsapp', locale: 'id' },
};

function createLoggerSpy(): Logger {
  return { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() };
}

function makeAxiosInstance(postFn: jest.MockedFunction<AxiosInstance['post']>): AxiosInstance {
  return { post: postFn } as unknown as AxiosInstance;
}

describe('HttpAiInboundMessageAdapter', () => {
  let postMock: jest.MockedFunction<AxiosInstance['post']>;

  beforeEach(() => {
    postMock = jest.fn();
    mockedAxios.create.mockReturnValue(makeAxiosInstance(postMock));
  });

  it('should return AiChatResult on 200 response', async () => {
    postMock.mockResolvedValueOnce({
      status: 200,
      data: {
        conversation_id: 'conv-abc',
        reply: 'Breakfast selesai jam 10:30.',
        stop_reason: 'end_turn',
      },
    });

    const adapter = new HttpAiInboundMessageAdapter(CONFIG, createLoggerSpy());
    const result = await adapter.inboundWaMessage(VALID_INPUT);

    expect(result).toEqual({
      conversationId: 'conv-abc',
      reply: 'Breakfast selesai jam 10:30.',
      stopReason: 'end_turn',
    });
  });

  it('should POST to /internal/ai/chat with correct URL', async () => {
    postMock.mockResolvedValueOnce({
      status: 200,
      data: { conversation_id: 'c', reply: 'r', stop_reason: 'end_turn' },
    });

    const adapter = new HttpAiInboundMessageAdapter(CONFIG, createLoggerSpy());
    await adapter.inboundWaMessage(VALID_INPUT);

    const [calledUrl] = postMock.mock.calls[0] as [string, ...unknown[]];
    expect(calledUrl).toBe('http://localhost:3000/internal/ai/chat');
  });

  it('should set X-Service-Name: integration and valid sha256 X-Service-Signature', async () => {
    postMock.mockResolvedValueOnce({
      status: 200,
      data: { conversation_id: 'c', reply: 'r', stop_reason: 'end_turn' },
    });

    const adapter = new HttpAiInboundMessageAdapter(CONFIG, createLoggerSpy());
    await adapter.inboundWaMessage(VALID_INPUT);

    const [, rawBody, opts] = postMock.mock.calls[0] as [
      string,
      string,
      { headers: Record<string, string> },
    ];
    const { headers } = opts;

    expect(headers['x-service-name']).toBe('integration');
    const expectedSig = `sha256=${createHmac('sha256', CONFIG.hmacSecret).update(Buffer.from(rawBody, 'utf8')).digest('hex')}`;
    expect(headers['x-service-signature']).toBe(expectedSig);
  });

  it('should map AiInboundInput to snake_case JSON payload', async () => {
    postMock.mockResolvedValueOnce({
      status: 200,
      data: { conversation_id: 'c', reply: 'r', stop_reason: 'end_turn' },
    });

    const adapter = new HttpAiInboundMessageAdapter(CONFIG, createLoggerSpy());
    await adapter.inboundWaMessage(VALID_INPUT);

    const [, rawBody] = postMock.mock.calls[0] as [string, string, unknown];
    const parsed = JSON.parse(rawBody) as Record<string, unknown>;
    expect(parsed).toMatchObject({
      hotel_id: VALID_INPUT.hotelId,
      agent_slug: VALID_INPUT.agentSlug,
      source_id: VALID_INPUT.sourceId,
      messages: VALID_INPUT.messages,
      context: {
        guest_id: VALID_INPUT.context.guestId,
        channel: 'whatsapp',
        locale: 'id',
      },
    });
  });

  it('should retry on 503 and succeed on second attempt', async () => {
    postMock
      .mockResolvedValueOnce({
        status: 503,
        data: { error: { code: 'INTERNAL_ERROR', message: 'overload' } },
      })
      .mockResolvedValueOnce({
        status: 200,
        data: { conversation_id: 'c', reply: 'r', stop_reason: 'end_turn' },
      });

    const adapter = new HttpAiInboundMessageAdapter(CONFIG, createLoggerSpy());
    const result = await adapter.inboundWaMessage(VALID_INPUT);

    expect(result.reply).toBe('r');
    expect(postMock).toHaveBeenCalledTimes(2);
  });

  it('should throw ExternalServiceError after exhausting all retries on persistent 500', async () => {
    postMock.mockResolvedValue({
      status: 500,
      data: { error: { code: 'INTERNAL_ERROR', message: 'crash' } },
    });

    const adapter = new HttpAiInboundMessageAdapter(CONFIG, createLoggerSpy());
    await expect(adapter.inboundWaMessage(VALID_INPUT)).rejects.toBeInstanceOf(
      ExternalServiceError,
    );
    expect(postMock).toHaveBeenCalledTimes(3);
  });

  it('should NOT retry on 502 AI_PROVIDER_ERROR (non-retryable input error)', async () => {
    postMock.mockResolvedValue({
      status: 502,
      data: { error: { code: 'AI_PROVIDER_ERROR', message: 'invalid model' } },
    });

    const adapter = new HttpAiInboundMessageAdapter(CONFIG, createLoggerSpy());
    await expect(adapter.inboundWaMessage(VALID_INPUT)).rejects.toBeInstanceOf(
      ExternalServiceError,
    );
    expect(postMock).toHaveBeenCalledTimes(1);
  });

  it('should NOT retry on 401 (auth error, 4xx)', async () => {
    postMock.mockResolvedValue({
      status: 401,
      data: { error: { code: 'AI_AUTH_FAILED', message: 'signature mismatch' } },
    });

    const adapter = new HttpAiInboundMessageAdapter(CONFIG, createLoggerSpy());
    await expect(adapter.inboundWaMessage(VALID_INPUT)).rejects.toBeInstanceOf(
      ExternalServiceError,
    );
    expect(postMock).toHaveBeenCalledTimes(1);
  });

  it('should throw ExternalServiceError with upstream code on failure', async () => {
    postMock.mockResolvedValue({
      status: 504,
      data: { error: { code: 'AI_PROVIDER_TIMEOUT', message: 'moonshot timeout' } },
    });

    const adapter = new HttpAiInboundMessageAdapter(CONFIG, createLoggerSpy());
    const err = await adapter.inboundWaMessage(VALID_INPUT).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ExternalServiceError);
    expect((err as ExternalServiceError).message).toContain('AI_PROVIDER_TIMEOUT');
  });
});
