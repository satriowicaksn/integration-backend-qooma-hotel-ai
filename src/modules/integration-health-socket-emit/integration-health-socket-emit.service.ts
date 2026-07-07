// Publisher bridge: consumes camelCase `HealthChangedEventPayload[]`
// (T24's contract) and publishes each as an `integration:health_changed`
// event via `SocketPublisherPort`. Case-conversion (input camelCase →
// wire snake_case) is encapsulated here per PM C ACK T25 binding #2 so
// the T24 caller (`runProbesForHotel`) can pipe its output directly
// without shape awareness.
//
// Resilience (binding #5): per-event `try/catch`; on failure → warn log
// + increment `failures` counter; aggregate never throws. Return value
// surfaces `{ published, failures, errorCodes }` for cron observability.
//
// Transition-only filtering (binding #17) is the caller's contract —
// T24 already filters at debounce.ts. The service publishes every
// event provided, without re-deriving `didTransition`.

import type { Logger } from '@core/logger/logger.js';

import type {
  HealthChangedEventPayload,
  HealthChangedEventWirePayload,
  PublishSummary,
} from './integration-health-socket-emit.types.js';
import type { SocketPublisherPort } from './ports/socket-publisher.port.js';

/** Canonical event name per spec §5 row 321 + PM C ACK T25 binding #7. */
export const HEALTH_CHANGED_EVENT_NAME = 'integration:health_changed';

export class HealthChangedPublisherService {
  constructor(
    private readonly publisher: SocketPublisherPort,
    private readonly logger: Logger,
  ) {}

  async publishAll(events: readonly HealthChangedEventPayload[]): Promise<PublishSummary> {
    let published = 0;
    let failures = 0;
    const errorCodes: string[] = [];
    for (const event of events) {
      const wire = toWirePayload(event);
      try {
        await this.publisher.publish({ event: HEALTH_CHANGED_EVENT_NAME, payload: wire });
        published += 1;
      } catch (err) {
        failures += 1;
        const errCode = extractCode(err);
        errorCodes.push(errCode);
        this.logger.warn({
          msg: 'integration_health_socket_emit.publish_failed',
          module: 'integration-health-socket-emit',
          hotelId: event.hotelId,
          provider: event.provider,
          newStatus: event.newStatus,
          errCode,
        });
      }
    }
    return { published, failures, errorCodes };
  }
}

/** camelCase input → snake_case wire payload (PM C ACK T25 binding #2). */
export function toWirePayload(input: HealthChangedEventPayload): HealthChangedEventWirePayload {
  return {
    hotel_id: input.hotelId,
    provider: input.provider,
    previous_status: input.previousStatus,
    new_status: input.newStatus,
    checked_at: input.checkedAt.toISOString(),
  };
}

/** Surfaces the class name (via `.name`) for named error subclasses;
 *  plain `Error` → `'unknown'`. Only `err.name` reaches the log —
 *  never `err.message` or stack (binding #6 defense-in-depth). */
function extractCode(err: unknown): string {
  if (err instanceof Error && err.name !== 'Error') {
    return err.name;
  }
  return 'unknown';
}
