/**
 * WA verify-webhook service — orchestrator for the T11 outbound reachability
 * probe. Ctor signature `(configService, pinger, verifyRepo, logger)`:
 *  - `configService: WhatsappConfigService` (from T10) — supplies the current
 *    `webhookUrl` for the hotel; `NotFoundError` propagates as-is when no
 *    `wa_configs` row exists (spec-canonical — GM admin sees "config first").
 *  - `pinger: WebhookPingerPort` — the outbound probe (probe-semantics: never
 *    throws, returns `{ reachable, statusCode? }`).
 *  - `verifyRepo: WhatsappWebhookVerifyRepository` — writes `verified_at` on
 *    success only. Sibling to T10's repo per PM B ACK GAP T11-#2 A.
 *  - `logger: Logger` — direct dep, no ctor helper wrapping.
 *
 * Return shape (`WebhookVerificationDomain`) is rich per PM B ACK GAP T11-#7
 * A: the future T11-followup router maps outcomes to spec §5 AC HTTP
 * responses (`200 { verified, verifiedAt }` on success, `422
 * WEBHOOK_VERIFICATION_FAILED` on any non-verified outcome).
 */

import type { Logger } from '@core/logger/logger.js';

import type { WebhookPingerPort } from './ports/webhook-pinger.port.js';
import type { WhatsappConfigService } from './whatsapp-config.service.js';
import type { WhatsappWebhookVerifyRepository } from './whatsapp-webhook-verify.repository.js';
import type {
  WebhookVerificationDomain,
  WebhookVerificationOutcome,
} from './whatsapp-webhook-verify.types.js';

const LOG_MODULE = 'whatsapp';
const LOG_VERIFY = 'whatsapp_webhook_verify.probe';

export class WhatsappWebhookVerifyService {
  constructor(
    private readonly configService: WhatsappConfigService,
    private readonly pinger: WebhookPingerPort,
    private readonly verifyRepo: WhatsappWebhookVerifyRepository,
    private readonly logger: Logger,
  ) {}

  async verifyForHotel(hotelId: string): Promise<WebhookVerificationDomain> {
    const config = await this.configService.getForHotel(hotelId);

    const probe = await this.pinger.ping({ url: config.webhookUrl });

    if (probe.reachable) {
      const verifiedAt = new Date();
      await this.verifyRepo.markVerified(hotelId, verifiedAt);
      const outcome: WebhookVerificationOutcome = 'verified';
      const result: WebhookVerificationDomain = {
        hotelId,
        verified: true,
        verifiedAt,
        outcome,
        ...(probe.statusCode !== undefined ? { statusCode: probe.statusCode } : {}),
      };
      this.logger.info({
        msg: LOG_VERIFY,
        module: LOG_MODULE,
        hotelId,
        outcome,
        ...(probe.statusCode !== undefined ? { statusCode: probe.statusCode } : {}),
      });
      return result;
    }

    const outcome: WebhookVerificationOutcome =
      probe.statusCode === undefined ? 'unreachable' : 'invalid_response';
    const result: WebhookVerificationDomain = {
      hotelId,
      verified: false,
      verifiedAt: null,
      outcome,
      ...(probe.statusCode !== undefined ? { statusCode: probe.statusCode } : {}),
    };
    this.logger.info({
      msg: LOG_VERIFY,
      module: LOG_MODULE,
      hotelId,
      outcome,
      ...(probe.statusCode !== undefined ? { statusCode: probe.statusCode } : {}),
    });
    return result;
  }
}
