/**
 * zod schema + pure classifier for the T14 outbound-retry input.
 *
 * The input carries all context in ONE payload per PM ACK 5-field
 * clarification: `{ dispatchId, hotelId, attemptsMade, status?, body? }`.
 * Caller (T13-followup RPC receiver / T14-followup worker) sources fields:
 * - `dispatchId` + `status?` + `body?` from T13 `meta_failed` outcome
 * - `hotelId` from RPC tenant context
 * - `attemptsMade` from Bull `job.attemptsMade` at retry time (`0` at initial
 *   dispatch failure)
 *
 * `classifyFailure` is a pure function on top of the schema-validated input.
 * Multi-factor decision (status + spec-aligned reason) doesn't cleanly
 * discriminate at zod input level — extends T13 pattern philosophy: use
 * z.union at type level where shape discriminates cleanly; use pure
 * functions where multi-factor decisions live (PM ACK GAP T14-#7 A).
 */

import { z } from 'zod';

import type { PermanentFailReason, RetryClassification } from './whatsapp-outbound-retry.types.js';

const MAX_ATTEMPTS = 3;

export const MetaFailureInputSchema = z
  .object({
    dispatchId: z.string().uuid(),
    hotelId: z.string().uuid(),
    attemptsMade: z.number().int().min(0).max(MAX_ATTEMPTS),
    status: z.number().int().optional(),
    body: z.unknown().optional(),
  })
  .strict();

export type MetaFailureInputDto = z.infer<typeof MetaFailureInputSchema>;

/**
 * Classify a Meta failure as retryable vs permanent per spec §4.9 wording +
 * PM ACK T14 GAP #2 status-code table:
 *  - `undefined` status → retryable (network / timeout)
 *  - 5xx (500-599) → retryable (server-side transient)
 *  - 429 → **permanent (quota_exhausted)** — spec §4.9 lists "quota" as a
 *    permanent failure category; Meta's rate-limit resets per hour/day and
 *    1s+5s+30s backoff won't recover. **This is a defensible judgment call**
 *    per PM ACK T14 H17 rationale (surfaces the quota issue to human
 *    operator faster than burning silent retries against Meta's wall).
 *    Future T14-followup can add `Retry-After` header respect for granular
 *    recovery.
 *  - 401 / 403 → permanent (auth_failed — misconfigured token, no benefit
 *    from retry)
 *  - 400 → permanent (bad_request — malformed payload)
 *  - 422 → permanent (template_rejected — spec §4.9 explicit "template-not-
 *    approved" category)
 *  - other 4xx → permanent (bad_request — conservative default matching
 *    standard REST retry pattern of 5xx-only)
 */
export function classifyFailure(input: {
  readonly status?: number | undefined;
  readonly body?: unknown;
}): RetryClassification {
  const { status } = input;
  if (status === undefined) {
    return { retryable: true };
  }
  if (status >= 500 && status < 600) {
    return { retryable: true };
  }
  const reason: PermanentFailReason = permanentReasonForStatus(status);
  return { retryable: false, reason };
}

function permanentReasonForStatus(status: number): PermanentFailReason {
  if (status === 429) return 'quota_exhausted';
  if (status === 401 || status === 403) return 'auth_failed';
  if (status === 422) return 'template_rejected';
  if (status === 400) return 'bad_request';
  return 'bad_request';
}
