/**
 * WhatsApp outbound retry service — CLASSIFIER + PRODUCER on top of T07 Bull
 * factory. Consumes T13's `meta_failed` outcome shape (via caller-provided
 * 5-field input) and either enqueues a retry job or marks permanent-fail.
 *
 * Ctor is **3 deps** per PM B ACK binding condition #5:
 * `(repo, retryQueuePort, logger)`. No Bull/bullmq/ioredis dependency — the
 * `RetryQueuePort` abstracts the queue runtime; T14-followup wires the
 * adapter that wraps T07's `createQueue` factory.
 *
 * **T07 infrastructure consumed**: `RETRY_BACKOFF_DELAYS_MS = [1000, 5000,
 * 30000]` + `DEFAULT_JOB_ATTEMPTS = 3` baked in T07 factory match spec §4.9
 * verbatim. T14 primitive is producer + classifier only; Bull auto-retry
 * semantics + DLQ pattern from T07 execute at T14-followup adapter wiring.
 *
 * **Auth-agnostic**: T14 primitive is called by the T13-followup RPC
 * receiver or the T14-followup worker; both handle auth at their respective
 * layer (T09 plugin at router, or worker context). Extends T12/T13/T15
 * precedent to retry-producer context.
 *
 * **Attempt-cap discipline**: even a `retryable` classification returns
 * `{kind: 'permanent', reason: 'exhausted'}` when `attemptsMade + 1 >= 3`
 * (spec §4.9 hard cap). Cap check happens INSIDE the service, not the
 * classifier — the classifier only inspects the error surface (status/body),
 * cap is a state check.
 *
 * **Worker discipline**: external failures (queue enqueue, repo write) are
 * logged + swallowed; service returns a rich outcome and never throws for
 * boundary errors. Sole throw path: `ValidationError` on schema parse fail.
 * Extends T11 probe + T12/T13/T15 async patterns.
 *
 * **PII floor**: Bull job payload is MINIMAL (`dispatchId + hotelId +
 * attemptNumber` per T07 factory mandate — processor hydrates from DB).
 * Service logs the same minimal shape; no plaintext token, phone, or body.
 */

import { ValidationError } from '@core/errors/app-errors.js';
import type { Logger } from '@core/logger/logger.js';

import type { RetryQueuePort } from './ports/retry-queue.port.js';
import type { WhatsappOutboundRetryRepository } from './whatsapp-outbound-retry.repository.js';
import { MetaFailureInputSchema, classifyFailure } from './whatsapp-outbound-retry.schema.js';
import type {
  PermanentFailReason,
  RetryClassification,
  RetryScheduleOutcome,
} from './whatsapp-outbound-retry.types.js';

const MAX_ATTEMPTS = 3;
const LOG_MODULE = 'whatsapp';
const LOG_ATTEMPT = 'whatsapp_outbound_retry.attempt';
const LOG_SCHEDULED = 'whatsapp_outbound_retry.scheduled';
const LOG_PERMANENT = 'whatsapp_outbound_retry.permanent';
const LOG_ENQUEUE_FAIL = 'whatsapp_outbound_retry.enqueue_failed';
const LOG_MARK_RETRY_FAIL = 'whatsapp_outbound_retry.mark_retry_failed';
const LOG_MARK_PERMANENT_FAIL = 'whatsapp_outbound_retry.mark_permanent_failed';

function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}

export class WhatsappOutboundRetryService {
  constructor(
    private readonly repo: WhatsappOutboundRetryRepository,
    private readonly retryQueuePort: RetryQueuePort,
    private readonly logger: Logger,
  ) {}

  async scheduleRetryFromMetaFailure(input: unknown): Promise<RetryScheduleOutcome> {
    const parsed = MetaFailureInputSchema.safeParse(input);
    if (!parsed.success) {
      throw new ValidationError('Invalid meta failure input for retry', {
        issues: parsed.error.issues,
      });
    }
    const { dispatchId, hotelId, attemptsMade, status, body } = parsed.data;

    this.logger.info({
      msg: LOG_ATTEMPT,
      module: LOG_MODULE,
      dispatchId,
      hotelId,
      attemptsMade,
      hasStatus: status !== undefined,
    });

    const classification: RetryClassification = classifyFailure({ status, body });

    if (!classification.retryable) {
      return this.markPermanent(dispatchId, hotelId, classification.reason, status, body);
    }

    if (attemptsMade + 1 >= MAX_ATTEMPTS) {
      return this.markPermanent(dispatchId, hotelId, 'exhausted', status, body);
    }

    const attemptNumber = attemptsMade + 1;
    return this.enqueueScheduled(dispatchId, hotelId, attemptNumber, status, body);
  }

  private async markPermanent(
    dispatchId: string,
    hotelId: string,
    reason: PermanentFailReason,
    status: number | undefined,
    body: unknown,
  ): Promise<RetryScheduleOutcome> {
    try {
      await this.repo.markPermanentFail(dispatchId, {
        reason,
        ...(status !== undefined ? { status } : {}),
        ...(body !== undefined ? { body } : {}),
      });
    } catch (err) {
      this.logger.error({
        msg: LOG_MARK_PERMANENT_FAIL,
        module: LOG_MODULE,
        dispatchId,
        hotelId,
        error: errorMessage(err),
      });
    }

    this.logger.info({
      msg: LOG_PERMANENT,
      module: LOG_MODULE,
      dispatchId,
      hotelId,
      reason,
    });

    return { kind: 'permanent', reason };
  }

  private async enqueueScheduled(
    dispatchId: string,
    hotelId: string,
    attemptNumber: number,
    status: number | undefined,
    body: unknown,
  ): Promise<RetryScheduleOutcome> {
    let jobId: string;
    try {
      const enqueued = await this.retryQueuePort.enqueueRetry({
        dispatchId,
        hotelId,
        attemptNumber,
      });
      jobId = enqueued.jobId;
    } catch (err) {
      this.logger.error({
        msg: LOG_ENQUEUE_FAIL,
        module: LOG_MODULE,
        dispatchId,
        hotelId,
        attemptNumber,
        error: errorMessage(err),
      });
      return this.markPermanent(dispatchId, hotelId, 'exhausted', status, body);
    }

    try {
      await this.repo.markRetryScheduled(dispatchId, attemptNumber);
    } catch (err) {
      this.logger.error({
        msg: LOG_MARK_RETRY_FAIL,
        module: LOG_MODULE,
        dispatchId,
        hotelId,
        attemptNumber,
        error: errorMessage(err),
      });
    }

    this.logger.info({
      msg: LOG_SCHEDULED,
      module: LOG_MODULE,
      dispatchId,
      hotelId,
      attemptNumber,
      jobId,
    });

    return { kind: 'scheduled', attemptNumber, jobId };
  }
}
