/**
 * WhatsApp outbound dispatch service — 6-step orchestrator per spec §3.1
 * (config lookup → DND check → quota reserve → persist → Meta send → quota
 * commit/rollback + mark).
 *
 * Ctor is **5 deps** per PM B ACK binding condition #6:
 * `(repo, bspPort, quotaPort, dndPort, logger)`. NO `WhatsappConfigService`
 * (T10) dependency — the repo's `findConfigForDispatch` performs the
 * cross-table read + decrypt internally (T15 cross-table precedent).
 *
 * **Auth-agnostic**: the T09 internal-RPC-auth plugin (`X-Internal-Secret`
 * header) guards the INBOUND RPC route at router-layer preHandler
 * (T13-followup wiring); this service consumes an already-authorized RPC
 * payload. Extends T12 signature-agnostic + T15 receiver-only precedents to
 * the RPC receiver context.
 *
 * **Quota two-phase discipline**: `checkAndReserve` returns `reservationId`;
 * on Meta success → `commit(reservationId)` records actual send; on Meta
 * failure → `rollback(reservationId)` releases reservation. Matches spec
 * §4.5 wording "meter reflects only actually-sent messages". Rollback
 * failure is worker-tolerant (logged, does not throw) — mirrors T12/T15
 * worker discipline.
 *
 * **Fail-early persist** (per binding condition #10): DND/quota rejects
 * return `{kind: 'rejected_dnd' | 'quota_exhausted'}` WITHOUT touching
 * `outbound_dispatch_queue`. The row lands only after both DND + quota
 * pass. This preserves audit-trail semantics for actual dispatch attempts
 * and defers the queue-vs-drop decision on rejects to T14.
 *
 * Returns rich `OutboundDispatchOutcome` (discriminated union — T15
 * precedent, no `as string`). Throws ONLY: (a) `ValidationError` on schema
 * fail, (b) `NotFoundError` propagated when `findConfigForDispatch` returns
 * null. External service failures (BSP, quotaPort, dndPort, mark*, rollback)
 * NEVER throw — worker discipline.
 */

import { NotFoundError, ValidationError } from '@core/errors/app-errors.js';
import type { Logger } from '@core/logger/logger.js';

import { maskWaPhone } from '@shared/utils/masking.js';

import type { HotelCoreDndPort } from './ports/hotel-core-dnd.port.js';
import type { HotelCoreQuotaPort } from './ports/hotel-core-quota.port.js';
import type { WhatsappBspPort } from './ports/whatsapp-bsp.port.js';
import type { WhatsappOutboundDispatchRepository } from './whatsapp-outbound-dispatch.repository.js';
import { OutboundDispatchRequestSchema } from './whatsapp-outbound-dispatch.schema.js';
import type { OutboundDispatchRequestDto } from './whatsapp-outbound-dispatch.schema.js';
import type {
  OutboundDispatchConfig,
  OutboundDispatchOutcome,
} from './whatsapp-outbound-dispatch.types.js';

const PROVIDER = 'whatsapp';
const RESOURCE_WA_CONFIG = 'wa_config';
const LOG_MODULE = 'whatsapp';
const LOG_DISPATCH = 'whatsapp_outbound_dispatch.attempt';
const LOG_REJECTED_DND = 'whatsapp_outbound_dispatch.rejected_dnd';
const LOG_QUOTA_EXHAUSTED = 'whatsapp_outbound_dispatch.quota_exhausted';
const LOG_META_FAILED = 'whatsapp_outbound_dispatch.meta_failed';
const LOG_DISPATCHED = 'whatsapp_outbound_dispatch.dispatched';

interface FailurePayload {
  readonly message: string;
  readonly status?: number;
  readonly body?: string;
}

function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}

function extractMetaFailure(err: unknown): { status?: number; body?: string } {
  if (
    typeof err === 'object' &&
    err !== null &&
    'upstream' in err &&
    typeof (err as { upstream?: unknown }).upstream === 'object' &&
    (err as { upstream?: unknown }).upstream !== null
  ) {
    const upstream = (err as { upstream: { status?: unknown; body?: unknown } }).upstream;
    const out: { status?: number; body?: string } = {};
    if (typeof upstream.status === 'number') {
      out.status = upstream.status;
    }
    if ('body' in upstream && upstream.body !== undefined) {
      out.body = typeof upstream.body === 'string' ? upstream.body : JSON.stringify(upstream.body);
    }
    return out;
  }
  return {};
}

export class WhatsappOutboundDispatchService {
  constructor(
    private readonly repo: WhatsappOutboundDispatchRepository,
    private readonly bspPort: WhatsappBspPort,
    private readonly quotaPort: HotelCoreQuotaPort,
    private readonly dndPort: HotelCoreDndPort,
    private readonly logger: Logger,
  ) {}

  async dispatchMessage(request: unknown): Promise<OutboundDispatchOutcome> {
    const parsed = OutboundDispatchRequestSchema.safeParse(request);
    if (!parsed.success) {
      throw new ValidationError('Invalid outbound dispatch request', {
        issues: parsed.error.issues,
      });
    }
    const req = parsed.data;

    this.logger.info({
      msg: LOG_DISPATCH,
      module: LOG_MODULE,
      hotelId: req.hotelId,
      guestId: req.guestId,
      recipientPhone: maskWaPhone(req.recipientPhone),
      mode: 'template' in req ? 'template' : 'text',
    });

    const config = await this.repo.findConfigForDispatch(req.hotelId);
    if (config === null) {
      throw new NotFoundError(RESOURCE_WA_CONFIG, req.hotelId);
    }

    const dndResult = await this.dndPort.isDndForRecipient(req.hotelId, req.recipientPhone);
    if (dndResult.blocked && !dndResult.vvipExempt) {
      const reason = 'dnd_window_active';
      this.logger.info({
        msg: LOG_REJECTED_DND,
        module: LOG_MODULE,
        hotelId: req.hotelId,
        guestId: req.guestId,
        recipientPhone: maskWaPhone(req.recipientPhone),
        reason,
      });
      return { kind: 'rejected_dnd', reason };
    }

    const quotaResult = await this.quotaPort.checkAndReserve(req.hotelId, 1);
    if (!quotaResult.reserved) {
      this.logger.info({
        msg: LOG_QUOTA_EXHAUSTED,
        module: LOG_MODULE,
        hotelId: req.hotelId,
        guestId: req.guestId,
        reason: quotaResult.reason,
      });
      return { kind: 'quota_exhausted', reason: quotaResult.reason };
    }
    const reservationId = quotaResult.reservationId;

    const dispatch = await this.repo.persistPending(
      'template' in req
        ? {
            hotelId: req.hotelId,
            guestId: req.guestId,
            provider: PROVIDER,
            templateName: req.template.name,
            ...(req.template.variables !== undefined ? { variables: req.template.variables } : {}),
          }
        : {
            hotelId: req.hotelId,
            guestId: req.guestId,
            provider: PROVIDER,
            body: req.body,
          },
    );

    return this.sendAndFinalize(req, config, dispatch.id, reservationId);
  }

  private async sendAndFinalize(
    req: OutboundDispatchRequestDto,
    config: OutboundDispatchConfig,
    dispatchId: string,
    reservationId: string,
  ): Promise<OutboundDispatchOutcome> {
    const credentials = {
      phoneNumberId: config.phoneNumberId,
      accessToken: config.accessTokenPlaintext,
    };
    try {
      const bspResult =
        'template' in req
          ? await this.bspPort.sendTemplate({
              credentials,
              to: req.recipientPhone,
              templateName: req.template.name,
              languageCode: req.template.languageCode,
              ...(req.template.variables !== undefined
                ? { variables: Array.from(req.template.variables) }
                : {}),
            })
          : await this.bspPort.sendText({
              credentials,
              to: req.recipientPhone,
              body: req.body,
            });

      await this.markSentSafely(dispatchId, bspResult.messageId);
      await this.commitQuotaSafely(reservationId);

      this.logger.info({
        msg: LOG_DISPATCHED,
        module: LOG_MODULE,
        hotelId: req.hotelId,
        guestId: req.guestId,
        dispatchId,
        externalId: bspResult.messageId,
      });

      return { kind: 'dispatched', dispatchId, externalId: bspResult.messageId };
    } catch (err) {
      const failure = extractMetaFailure(err);
      const failurePayload: FailurePayload = {
        message: errorMessage(err),
        ...(failure.status !== undefined ? { status: failure.status } : {}),
        ...(failure.body !== undefined ? { body: failure.body } : {}),
      };
      await this.markFailedSafely(dispatchId, failurePayload);
      await this.rollbackQuotaSafely(reservationId);

      this.logger.warn({
        msg: LOG_META_FAILED,
        module: LOG_MODULE,
        hotelId: req.hotelId,
        guestId: req.guestId,
        dispatchId,
        error: errorMessage(err),
        ...(failure.status !== undefined ? { status: failure.status } : {}),
      });

      const outcome: OutboundDispatchOutcome = {
        kind: 'meta_failed',
        dispatchId,
        ...(failure.status !== undefined ? { status: failure.status } : {}),
        ...(failure.body !== undefined ? { body: failure.body } : {}),
      };
      return outcome;
    }
  }

  private async markSentSafely(dispatchId: string, externalId: string): Promise<void> {
    try {
      await this.repo.markSent(dispatchId, externalId, new Date());
    } catch (err) {
      this.logger.error({
        msg: 'whatsapp_outbound_dispatch.mark_sent_failed',
        module: LOG_MODULE,
        dispatchId,
        error: errorMessage(err),
      });
    }
  }

  private async markFailedSafely(dispatchId: string, payload: FailurePayload): Promise<void> {
    try {
      await this.repo.markFailed(dispatchId, { ...payload });
    } catch (err) {
      this.logger.error({
        msg: 'whatsapp_outbound_dispatch.mark_failed_failed',
        module: LOG_MODULE,
        dispatchId,
        error: errorMessage(err),
      });
    }
  }

  private async commitQuotaSafely(reservationId: string): Promise<void> {
    try {
      await this.quotaPort.commit(reservationId);
    } catch (err) {
      this.logger.error({
        msg: 'whatsapp_outbound_dispatch.commit_failed',
        module: LOG_MODULE,
        reservationId,
        error: errorMessage(err),
      });
    }
  }

  private async rollbackQuotaSafely(reservationId: string): Promise<void> {
    try {
      await this.quotaPort.rollback(reservationId);
    } catch (err) {
      this.logger.error({
        msg: 'whatsapp_outbound_dispatch.rollback_failed',
        module: LOG_MODULE,
        reservationId,
        error: errorMessage(err),
      });
    }
  }
}
