/**
 * Bull-agnostic retry queue port — TYPE-ONLY in this primitive per PM B ACK
 * GAP T14-#9 A. The T14-followup adapter wraps `Bull.Queue.add(jobName, data,
 * opts)` using T07 factory (`src/core/queue/bull-factory.ts`) with baked-in
 * `attempts: 3` + `integrationBackoffStrategy` (1s / 5s / 30s per spec §4.9)
 * defaults. Primitive never imports `Bull` / `bullmq` / `ioredis` — that's a
 * PM ACK binding condition #2 drift-scan rule.
 *
 * Zero cross-service Q escalations for T14 — no `Q-B-##` stamps needed on
 * this port (contrast T12/T13/T16 HC ports which carry Q-B-04/05/08/09
 * stamps).
 */

import type { RetryJobData } from '../whatsapp-outbound-retry.types.js';

export interface RetryQueuePort {
  enqueueRetry(input: RetryJobData): Promise<{ jobId: string }>;
}
