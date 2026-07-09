// Resolves the per-hotel secret compared against Meta's
// `X-Hub-Signature-256` HMAC on the T27 inbound webhook.
//
// **Q-A-04 parked** — MVP §4.2 says use `webhook_verify_token` as the
// shared secret; the "real" answer (app-secret HMAC vs verify-token HMAC)
// is deferred to a future ADR. This adapter reads the persisted
// verify-token verbatim (no decrypt — it is not stored encrypted; it is
// a hostname-visible verification value per Meta's HTTP GET challenge).
//
// The secret is read at call-time and kept in a single stack frame;
// NEVER cached, logged, or echoed.

import { NotFoundError } from '@core/errors/app-errors.js';

import type { WhatsappConfigRepository } from '../whatsapp-config.repository.js';

export class WhatsappWebhookSecretResolver {
  constructor(private readonly repo: WhatsappConfigRepository) {}

  async resolveSecret(input: { hotelId: string }): Promise<string> {
    const row = await this.repo.findByHotelId(input.hotelId);
    if (row === null) {
      throw new NotFoundError('wa_config', input.hotelId);
    }
    return row.webhookVerifyToken;
  }
}
