/**
 * Cross-service RPC port — Integration → AI service.
 * Sends a normalized inbound WhatsApp message to AI service
 * POST /internal/ai/chat and returns the agent reply.
 */

import type { AiChatResult, AiInboundInput } from '../whatsapp-webhook-ingest.types.js';

export interface AiInboundMessagePort {
  inboundWaMessage(input: AiInboundInput): Promise<AiChatResult>;
}
