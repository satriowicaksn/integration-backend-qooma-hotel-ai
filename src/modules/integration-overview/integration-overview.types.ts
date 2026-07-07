// Domain types for T23 integration overview aggregator (spec §2.1 row 27).
// Wire types (IntegrationOverviewResponseSchema) live in
// integration-overview.schema.ts (zod, source of truth).
//
// Per PM C ACK T23 binding #7 (recommended overview view fields —
// starting point until Q-C-11 FE contract lands): narrow status-oriented
// views only. Full config views live behind their own routes
// (`GET /api/integrations/whatsapp`, `/telegram`).

export type HealthPillStatus = 'healthy' | 'degraded' | 'down';

export interface WhatsappOverviewView {
  readonly bsp: string;
  readonly phoneNumber: string;
  readonly verifiedAt: string | null;
  readonly hasAccessToken: boolean;
  readonly webhookUrl: string | null;
}

export interface TelegramOverviewView {
  readonly botUsername: string;
  readonly hasBotToken: boolean;
  readonly defaultChatId: string | null;
  readonly webhookUrl: string | null;
}

export interface QrOverviewView {
  readonly url: string;
  readonly pngUrl: string;
  readonly generatedAt: string;
}

export interface ChannelHealthPill {
  readonly status: HealthPillStatus;
  readonly lastMessageAt?: string | null;
}

export interface ClaudeApiHealthPill {
  readonly status: HealthPillStatus;
  readonly lastCheckAt: string;
  readonly uptime30d?: number;
  readonly avgResponseMs?: number;
}

export interface HealthOverviewView {
  readonly whatsapp: ChannelHealthPill;
  readonly telegram: ChannelHealthPill;
  readonly claudeApi: ClaudeApiHealthPill;
}

/** Aggregated view returned by `IntegrationOverviewService.getForHotel`.
 *  Per PM C ACK binding #4: `null` (not `undefined`) for un-configured
 *  subsystems, so FE consumers can distinguish "not configured" from
 *  "field missing due to API bug". Health is never null (binding #3 +
 *  #11 synthetic-down fallback). */
export interface IntegrationOverview {
  readonly whatsapp: WhatsappOverviewView | null;
  readonly telegram: TelegramOverviewView | null;
  readonly qr: QrOverviewView | null;
  readonly health: HealthOverviewView;
}

export type OverviewSubsystem = 'whatsapp' | 'telegram' | 'qr' | 'health';
