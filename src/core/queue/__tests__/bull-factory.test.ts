import { describe, it, expect, jest } from '@jest/globals';

import {
  DEFAULT_JOB_ATTEMPTS,
  INTEGRATION_BACKOFF_STRATEGY,
  attachDeadLetterForwarder,
  buildDefaultJobOptions,
  buildQueueOptions,
  deadLetterQueueName,
  integrationBackoffStrategy,
  queueName,
  type DeadLetterSink,
  type DeadLetterableJob,
  type FailableQueue,
} from '../bull-factory.js';

describe('integrationBackoffStrategy', () => {
  it('should return 1s / 5s / 30s for the first three attempts', () => {
    expect(integrationBackoffStrategy(1)).toBe(1000);
    expect(integrationBackoffStrategy(2)).toBe(5000);
    expect(integrationBackoffStrategy(3)).toBe(30000);
  });

  it('should clamp to the last delay beyond the configured sequence', () => {
    expect(integrationBackoffStrategy(4)).toBe(30000);
    expect(integrationBackoffStrategy(99)).toBe(30000);
  });

  it('should clamp a zero/negative attempt count to the first delay', () => {
    expect(integrationBackoffStrategy(0)).toBe(1000);
  });
});

describe('queue naming', () => {
  it('should compose <module>:<job-type>', () => {
    expect(queueName('whatsapp', 'dispatch')).toBe('whatsapp:dispatch');
  });

  it('should compose the dead-letter queue name', () => {
    expect(deadLetterQueueName('whatsapp')).toBe('whatsapp:dead');
  });
});

describe('buildDefaultJobOptions', () => {
  it('should default to 3 attempts, custom backoff, and retain failed jobs', () => {
    const opts = buildDefaultJobOptions();
    expect(opts.attempts).toBe(DEFAULT_JOB_ATTEMPTS);
    expect(opts.backoff).toEqual({ type: INTEGRATION_BACKOFF_STRATEGY });
    expect(opts.removeOnComplete).toBe(true);
    expect(opts.removeOnFail).toBe(false);
  });

  it('should let overrides win (e.g. non-retryable attempts=1)', () => {
    expect(buildDefaultJobOptions({ attempts: 1 }).attempts).toBe(1);
  });
});

describe('buildQueueOptions', () => {
  it('should wire the backoff strategy, defaults, and pass redis through', () => {
    const redis = 'redis://localhost:6380';
    const opts = buildQueueOptions(redis);
    expect(opts.redis).toBe(redis);
    expect(opts.defaultJobOptions?.attempts).toBe(DEFAULT_JOB_ATTEMPTS);
    expect(opts.settings?.backoffStrategies?.[INTEGRATION_BACKOFF_STRATEGY]).toBe(
      integrationBackoffStrategy,
    );
  });
});

describe('attachDeadLetterForwarder', () => {
  function fakeQueue(): {
    queue: FailableQueue;
    fail: (job: DeadLetterableJob, err: Error) => void;
  } {
    let handler: ((job: DeadLetterableJob, err: Error) => void) | undefined;
    const queue: FailableQueue = {
      name: 'whatsapp:dispatch',
      on: (_event, listener) => {
        handler = listener;
        return queue;
      },
    };
    return {
      queue,
      fail: (job, err) => handler?.(job, err),
    };
  }

  function jobAt(attemptsMade: number, attempts = 3): DeadLetterableJob {
    return { id: 'job-1', name: 'dispatch', data: { x: 1 }, attemptsMade, opts: { attempts } };
  }

  it('should forward to the dead-letter queue once retries are exhausted', () => {
    const add = jest.fn(() => Promise.resolve());
    const sink: DeadLetterSink = { add };
    const { queue, fail } = fakeQueue();
    attachDeadLetterForwarder(queue, sink);

    fail(jobAt(3, 3), new Error('boom'));

    expect(add).toHaveBeenCalledWith({
      originalQueue: 'whatsapp:dispatch',
      jobId: 'job-1',
      name: 'dispatch',
      data: { x: 1 },
      failedReason: 'boom',
    });
  });

  it('should NOT forward while retries remain', () => {
    const add = jest.fn(() => Promise.resolve());
    const sink: DeadLetterSink = { add };
    const { queue, fail } = fakeQueue();
    attachDeadLetterForwarder(queue, sink);

    fail(jobAt(1, 3), new Error('transient'));

    expect(add).not.toHaveBeenCalled();
  });

  it('should prefer the job failedReason over the error message', () => {
    const add = jest.fn(() => Promise.resolve());
    const sink: DeadLetterSink = { add };
    const { queue, fail } = fakeQueue();
    attachDeadLetterForwarder(queue, sink);

    fail({ ...jobAt(3, 3), failedReason: 'persisted reason' }, new Error('boom'));

    expect(add).toHaveBeenCalledWith(expect.objectContaining({ failedReason: 'persisted reason' }));
  });
});
