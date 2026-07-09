// STUB adapter for the T12 `AiInboundMessagePort` (Q-B-05 parked).
// Per-invocation loud warn + no-op. Same T19-fu discipline.
//
// Replace with a real AI RPC adapter once Q-B-05 ratifies the endpoint
// contract.

import type { Logger } from '@core/logger/logger.js';

import type { AiInboundMessagePort } from '../ports/ai-inbound-message.port.js';
import type { AiInboundInput } from '../whatsapp-webhook-ingest.types.js';

const LOG_MODULE = 'whatsapp';
const LOG_MSG = 'ai_inbound.stub_invoked';

export class AiInboundStubAdapter implements AiInboundMessagePort {
  constructor(private readonly logger: Logger) {}

  inboundWaMessage(input: AiInboundInput): Promise<void> {
    this.logger.warn({
      msg: LOG_MSG,
      module: LOG_MODULE,
      hcAdapters: 'STUB',
      ratifyQs: 'Q-B-05',
      hotelId: input.hotelId,
      guestId: input.guestId,
      messageId: input.messageId,
      bodyLength: input.body.length,
    });
    return Promise.resolve();
  }
}
