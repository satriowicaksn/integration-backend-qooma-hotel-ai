/**
 * Cross-service RPC port — Integration → AI service, dispatches a normalized
 * inbound WhatsApp message for classification / handover (spec §3.1 L116
 * `inbound_wa_message`; §3.2 L311 "opaque, RPC only, no DB FK").
 *
 * **TYPE-ONLY** in this primitive per PM B ACK GAP T12-#4 → Q-B-05: the
 * concrete HTTP adapter (`http-ai-inbound-message.adapter.ts`) is deferred to
 * **T12-followup** and lands only after (a) Q-B-05 ratifies the AI endpoint
 * contract (URL / path / request payload / response contract — spec §3.2
 * confirms fire-and-forget void return) AND (b) Q-C-02 wires `AI_BASE_URL` +
 * `INTERNAL_SECRET` into `core/config/env.ts`. Unit tests inject a
 * jest test-double.
 */

import type { AiInboundInput } from '../whatsapp-webhook-ingest.types.js';

export interface AiInboundMessagePort {
  inboundWaMessage(input: AiInboundInput): Promise<void>;
}
