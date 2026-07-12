// STUB adapter for the `AiInboundMessagePort` (Q-B-05 parked).
// Per-invocation loud warn + synthetic AiChatResult. Replace with
// HttpAiInboundMessageAdapter once AI_BASE_URL + INTEGRATION_TO_AI_HMAC_SECRET
// are provisioned.

import type { Logger } from '@core/logger/logger.js';

import type { AiInboundMessagePort } from '../ports/ai-inbound-message.port.js';
import type { AiChatResult, AiInboundInput } from '../whatsapp-webhook-ingest.types.js';

const LOG_MODULE = 'whatsapp';
const LOG_MSG = 'ai_inbound.stub_invoked';
const STUB_CONVERSATION_ID = '00000000-0000-0000-0000-000000000000';
const STUB_REPLY = '[STUB] AI reply not available — AI_BASE_URL not configured';

export class AiInboundStubAdapter implements AiInboundMessagePort {
  constructor(private readonly logger: Logger) {}

  inboundWaMessage(input: AiInboundInput): Promise<AiChatResult> {
    this.logger.warn({
      msg: LOG_MSG,
      module: LOG_MODULE,
      hcAdapters: 'STUB',
      ratifyQs: 'Q-B-05',
      hotelId: input.hotelId,
      agentSlug: input.agentSlug,
      sourceId: input.sourceId,
      messageCount: input.messages.length,
    });
    return Promise.resolve({
      conversationId: STUB_CONVERSATION_ID,
      reply: STUB_REPLY,
      stopReason: 'stub',
    });
  }
}
