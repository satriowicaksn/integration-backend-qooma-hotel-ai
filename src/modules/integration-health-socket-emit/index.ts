// Barrel — per PM C ACK T25 binding #9: export types + service + port +
// wire schema + DTO + event-name constant + PublishSummary. Internal
// case-conversion helper (`toWirePayload`) stays module-private
// architecturally though re-exported for T25-followup composition tests
// that need the boundary function. All imports use `.js` extensions
// (binding #10; avoid the T22 `.ts` nit).

export type {
  HealthChangedEventPayload,
  HealthChangedEventWirePayload,
  HealthProvider,
  HealthStatus,
  PublishSummary,
} from './integration-health-socket-emit.types.js';

export type { IntegrationHealthChangedEventDto } from './integration-health-socket-emit.schema.js';
export { IntegrationHealthChangedEventSchema } from './integration-health-socket-emit.schema.js';

export {
  HEALTH_CHANGED_EVENT_NAME,
  HealthChangedPublisherService,
  toWirePayload,
} from './integration-health-socket-emit.service.js';

export type { SocketPublisherPort, SocketPublishRequest } from './ports/socket-publisher.port.js';
