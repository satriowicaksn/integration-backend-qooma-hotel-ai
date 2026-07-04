/**
 * Bull queue factory + retry/backoff/DLQ helpers.
 *
 * Queue naming: `<module>:<job-type>` (e.g. `whatsapp:dispatch`); dead-letter
 * queue: `<module>:dead`. Job data carries minimal context (ids + correlation
 * id) — processors hydrate from the DB.
 *
 * Retry: custom backoff of 1s/5s/30s (spec 04 §7 / MVP §4.9), `attempts` = 3 by
 * default and per-job configurable. Bull 4.x has no native DLQ, so failed jobs
 * are forwarded to a dead-letter queue on retry exhaustion.
 *
 * Redis connection is INJECTED (built from config at the entrypoint), never
 * constructed here — keeps the pure helpers unit-testable with no open Redis
 * handles.
 */

import Bull from 'bull';

/** Inter-attempt backoff delays in ms; index = (attemptsMade - 1). */
export const RETRY_BACKOFF_DELAYS_MS: readonly number[] = [1000, 5000, 30000];
export const DEFAULT_JOB_ATTEMPTS = 3;
export const INTEGRATION_BACKOFF_STRATEGY = 'integration';

/** Bull custom backoff strategy: 1s → 5s → 30s, clamped to the last delay. */
export function integrationBackoffStrategy(attemptsMade: number): number {
  const index = Math.max(0, attemptsMade - 1);
  const last = RETRY_BACKOFF_DELAYS_MS[RETRY_BACKOFF_DELAYS_MS.length - 1] ?? 0;
  return RETRY_BACKOFF_DELAYS_MS[index] ?? last;
}

export function queueName(module: string, jobType: string): string {
  return `${module}:${jobType}`;
}

export function deadLetterQueueName(module: string): string {
  return `${module}:dead`;
}

export function buildDefaultJobOptions(overrides: Bull.JobOptions = {}): Bull.JobOptions {
  return {
    attempts: DEFAULT_JOB_ATTEMPTS,
    backoff: { type: INTEGRATION_BACKOFF_STRATEGY },
    removeOnComplete: true,
    // Keep failed jobs so the dead-letter forwarder can inspect them.
    removeOnFail: false,
    ...overrides,
  };
}

export function buildQueueOptions(
  redis: Bull.QueueOptions['redis'],
  jobOverrides?: Bull.JobOptions,
): Bull.QueueOptions {
  return {
    redis,
    defaultJobOptions: buildDefaultJobOptions(jobOverrides),
    settings: {
      backoffStrategies: {
        [INTEGRATION_BACKOFF_STRATEGY]: integrationBackoffStrategy,
      },
    },
  };
}

export interface CreateQueueParams {
  name: string;
  redis: Bull.QueueOptions['redis'];
  jobOptions?: Bull.JobOptions;
}

/** Thin Bull instantiation — the connection is injected (integration-wired). */
export function createQueue<T>(params: CreateQueueParams): Bull.Queue<T> {
  return new Bull<T>(params.name, buildQueueOptions(params.redis, params.jobOptions));
}

// --- Dead-letter forwarding (Bull 4.x has no native DLQ) --------------------

export interface DeadLetterSink {
  add(data: unknown): Promise<unknown>;
}

export interface DeadLetterableJob {
  id: Bull.JobId;
  name: string;
  data: unknown;
  attemptsMade: number;
  failedReason?: string;
  opts: { attempts?: number };
}

export interface FailableQueue {
  readonly name: string;
  on(event: 'failed', listener: (job: DeadLetterableJob, err: Error) => void): unknown;
}

/**
 * Forward a job to the dead-letter queue once its retries are exhausted
 * (`attemptsMade >= attempts`). Attach once per source queue.
 */
export function attachDeadLetterForwarder(queue: FailableQueue, deadLetter: DeadLetterSink): void {
  queue.on('failed', (job, err) => {
    const maxAttempts = job.opts.attempts ?? DEFAULT_JOB_ATTEMPTS;
    if (job.attemptsMade < maxAttempts) return;
    void deadLetter.add({
      originalQueue: queue.name,
      jobId: job.id,
      name: job.name,
      data: job.data,
      failedReason: job.failedReason ?? err.message,
    });
  });
}

// --- Worker + scheduler helpers (thin Bull wrappers, integration-wired) -----

/** Register a processor; pass `config.WORKER_CONCURRENCY_DEFAULT` as concurrency. */
export function registerProcessor<T>(
  queue: Bull.Queue<T>,
  jobName: string,
  concurrency: number,
  processor: Bull.ProcessPromiseFunction<T>,
): Promise<void> {
  return queue.process(jobName, concurrency, processor);
}

/** Schedule a repeatable (cron) job. */
export function scheduleRepeatable<T>(
  queue: Bull.Queue<T>,
  jobName: string,
  data: T,
  cron: string,
): Promise<Bull.Job<T>> {
  return queue.add(jobName, data, { repeat: { cron } });
}
