/**
 * HTTP adapter — Integration → AI service POST /internal/ai/chat.
 *
 * Auth: HMAC-SHA256 per AI service spec §2 (X-Service-Name + X-Service-Signature).
 * Timeout: 35s (AI service BE timeout 30s + 5s buffer per spec §9).
 * Retry: max 2× (250ms → 750ms) for 5xx, EXCEPT 502 AI_PROVIDER_ERROR
 *        which signals a provider-side input error and won't resolve on retry.
 */

import { createHmac } from 'node:crypto';

import axios from 'axios';

import { ExternalServiceError } from '@core/errors/app-errors.js';
import type { Logger } from '@core/logger/logger.js';

import type { AiInboundMessagePort } from '../ports/ai-inbound-message.port.js';
import type { AiChatResult, AiInboundInput } from '../whatsapp-webhook-ingest.types.js';

const AI_TIMEOUT_MS = 35_000;
const SERVICE_NAME = 'integration';
const RETRY_DELAYS_MS = [250, 750] as const;
const AI_PROVIDER_ERROR_CODE = 'AI_PROVIDER_ERROR';

interface AiChatResponseBody {
  conversation_id: string;
  reply: string;
  stop_reason: string;
}

interface AiErrorBody {
  error?: { code?: string; message?: string };
}

export interface HttpAiAdapterConfig {
  readonly baseUrl: string;
  readonly hmacSecret: string;
}

function buildHmacHeaders(secret: string, rawBody: string): Record<string, string> {
  const sig = `sha256=${createHmac('sha256', secret).update(Buffer.from(rawBody, 'utf8')).digest('hex')}`;
  return {
    'content-type': 'application/json',
    'x-service-name': SERVICE_NAME,
    'x-service-signature': sig,
  };
}

function isRetryable(status: number, body: AiErrorBody): boolean {
  if (status < 500) return false;
  if (status === 502 && body.error?.code === AI_PROVIDER_ERROR_CODE) return false;
  return true;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class HttpAiInboundMessageAdapter implements AiInboundMessagePort {
  private readonly http = axios.create({ timeout: AI_TIMEOUT_MS, validateStatus: () => true });

  constructor(
    private readonly config: HttpAiAdapterConfig,
    private readonly logger: Logger,
  ) {}

  async inboundWaMessage(input: AiInboundInput): Promise<AiChatResult> {
    const payload = {
      hotel_id: input.hotelId,
      agent_slug: input.agentSlug,
      source_id: input.sourceId,
      messages: input.messages,
      context: {
        guest_id: input.context.guestId,
        channel: input.context.channel,
        locale: input.context.locale,
      },
    };
    const rawBody = JSON.stringify(payload);
    const headers = buildHmacHeaders(this.config.hmacSecret, rawBody);
    const url = `${this.config.baseUrl}/internal/ai/chat`;

    let lastStatus = 0;
    let lastBody: AiErrorBody = {};

    for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
      const start = Date.now();
      const res = await this.http.post<AiChatResponseBody | AiErrorBody>(url, rawBody, { headers });
      const latencyMs = Date.now() - start;
      lastStatus = res.status;
      lastBody = res.data as AiErrorBody;

      this.logger.info({
        msg: 'ai_inbound.http_call',
        module: 'whatsapp',
        hotelId: input.hotelId,
        agentSlug: input.agentSlug,
        status: res.status,
        latency_ms: latencyMs,
        attempt: attempt + 1,
      });

      if (res.status === 200) {
        const data = res.data as AiChatResponseBody;
        return {
          conversationId: data.conversation_id,
          reply: data.reply,
          stopReason: data.stop_reason,
        };
      }

      if (!isRetryable(res.status, lastBody) || attempt === RETRY_DELAYS_MS.length) break;

      const delay = RETRY_DELAYS_MS[attempt];
      if (delay !== undefined) await sleep(delay);
    }

    const code = lastBody.error?.code ?? 'UNKNOWN';
    const msg = lastBody.error?.message ?? `HTTP ${lastStatus}`;
    throw new ExternalServiceError('ai-service', `[${code}] ${msg}`, {
      status: lastStatus,
      body: lastBody,
    });
  }
}
