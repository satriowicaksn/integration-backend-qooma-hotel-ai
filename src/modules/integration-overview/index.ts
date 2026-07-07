// Barrel — per PM C ACK T23 binding #12: export types + service + reader-port
// interfaces + response DTO/schema. Internal composition helpers stay
// module-private. All imports use `.js` extensions (binding #16 — avoid the
// T22 `.ts` nit).

export type {
  ChannelHealthPill,
  ClaudeApiHealthPill,
  HealthOverviewView,
  HealthPillStatus,
  IntegrationOverview,
  OverviewSubsystem,
  QrOverviewView,
  TelegramOverviewView,
  WhatsappOverviewView,
} from './integration-overview.types.js';

export type { IntegrationOverviewResponseDto } from './integration-overview.schema.js';
export { IntegrationOverviewResponseSchema } from './integration-overview.schema.js';

export { IntegrationOverviewService } from './integration-overview.service.js';
export type { IntegrationOverviewPorts, OverviewClock } from './integration-overview.service.js';

export type { WhatsappConfigReadPort } from './ports/whatsapp-config-read.port.js';
export type { TelegramConfigReadPort } from './ports/telegram-config-read.port.js';
export type { QrStateReadPort } from './ports/qr-state-read.port.js';
export type { ChannelHealthReadPort } from './ports/channel-health-read.port.js';
