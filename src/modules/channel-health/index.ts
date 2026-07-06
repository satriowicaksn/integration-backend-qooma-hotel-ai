// Barrel — per PM C ACK §572: export types + service + repository + port
// interfaces. Debounce internals stay module-private (pure function; T25
// does not need direct access).

export type {
  ChannelHealthDomain,
  DebouncedTransition,
  HealthChangedEvent,
  HealthProvider,
  HealthStatus,
  ProbeResult,
} from './channel-health.types.js';

export type { ClaudeApiHealthDto, HealthResponseDto } from './channel-health.schema.js';

export { ClaudeApiHealthSchema, HealthResponseSchema } from './channel-health.schema.js';

export { ChannelHealthRepository } from './channel-health.repository.js';
export type { ChannelHealthInsertInput } from './channel-health.repository.js';

export { ChannelHealthService, PROVIDER_ORDER, currentStatusOr } from './channel-health.service.js';
export type { ChannelHealthProbes } from './channel-health.service.js';

export type { WhatsappHealthProbePort } from './ports/whatsapp-health-probe.port.js';
export type { TelegramHealthProbePort } from './ports/telegram-health-probe.port.js';
export type { ClaudeApiHealthProbePort } from './ports/claude-api-health-probe.port.js';
