/**
 * Domain types for the T14 WhatsApp outbound retry primitive (spec `MVP §4.9`
 * L106 + `04 §7 L340-346`).
 *
 * T14 is the CLASSIFIER + PRODUCER on top of T07 Bull-factory infrastructure.
 * Spec constants `RETRY_BACKOFF_DELAYS_MS = [1000, 5000, 30000]` and
 * `DEFAULT_JOB_ATTEMPTS = 3` are baked into T07 (`src/core/queue/bull-factory.ts`)
 * and consumed at T14-followup adapter wiring; the primitive is Bull-agnostic
 * (see `ports/retry-queue.port.ts` type-only surface).
 *
 * **Auth-agnostic**: T14 primitive is called by the T13-followup RPC receiver
 * or the T14-followup worker; both handle auth at their respective layer
 * (T09 plugin at router, or worker context). Extends T12/T13/T15 precedent
 * to retry-producer context.
 *
 * **Discriminated union outcome** (T15 + T13 precedent extended). Consumers
 * narrow on `kind`; TypeScript proves per-variant field access without any
 * `as X` cast.
 */

/**
 * `exhausted` = attempt cap reached (spec §4.9 "After exhaustion → status:
 * 'failed'"). Other variants map from Meta HTTP status per PM ACK T14 GAP #2
 * classification table.
 */
export type PermanentFailReason =
  | 'auth_failed'
  | 'template_rejected'
  | 'quota_exhausted'
  | 'bad_request'
  | 'exhausted';

/** Retry classification result — pure function output. */
export type RetryClassification =
  | { readonly retryable: true }
  | { readonly retryable: false; readonly reason: PermanentFailReason };

/**
 * Bull job payload — **MINIMAL** per T07 factory docstring "job data carries
 * minimal context (ids + correlation id) — processors hydrate from the DB".
 * No phone / body / template / accessToken here; processor reads from
 * `outbound_dispatch_queue` row via `dispatchId`.
 */
export interface RetryJobData {
  readonly dispatchId: string;
  readonly hotelId: string;
  readonly attemptNumber: number;
}

/**
 * Discriminated union outcome — 2 variants per PM ACK binding #7:
 *  - `scheduled` — retryable + under cap; Bull job enqueued
 *  - `permanent` — either classifier said permanent OR attempt cap reached
 */
export type RetryScheduleOutcome =
  | { readonly kind: 'scheduled'; readonly attemptNumber: number; readonly jobId: string }
  | { readonly kind: 'permanent'; readonly reason: PermanentFailReason };

/**
 * Persisted error payload written to `outbound_dispatch_queue.last_error` on
 * permanent failure. Includes classification reason for observability.
 */
export interface PermanentFailPersistenceInput {
  readonly reason: PermanentFailReason;
  readonly status?: number | undefined;
  readonly body?: unknown;
}
