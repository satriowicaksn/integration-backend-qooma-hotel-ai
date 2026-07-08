// HTTP route for T23-followup integration overview endpoint
// (spec §2.1 row 27). Thin layer: extract tenant → call service → map
// camelCase domain to snake_case wire.
//
// Guard composition mirrors T17-followup (`telegram.routes.ts`): guards
// injected at API bootstrap so this plugin stays auth-agnostic.

import type { FastifyPluginAsync, preHandlerHookHandler } from 'fastify';

import { AuthError } from '@core/errors/app-errors.js';

import type { IntegrationOverviewResponseDto } from './integration-overview.schema.js';
import type { IntegrationOverviewService } from './integration-overview.service.js';
import type {
  ChannelHealthPill,
  ClaudeApiHealthPill,
  HealthOverviewView,
  IntegrationOverview,
  QrOverviewView,
  TelegramOverviewView,
  WhatsappOverviewView,
} from './integration-overview.types.js';

export interface IntegrationOverviewRoutesOptions {
  readonly service: IntegrationOverviewService;
  readonly guards: readonly preHandlerHookHandler[];
}

export const integrationOverviewRoutes: FastifyPluginAsync<IntegrationOverviewRoutesOptions> = (
  fastify,
  opts,
) => {
  const preHandler = [...opts.guards] as preHandlerHookHandler[];

  fastify.get('/api/integrations', { preHandler }, async (req) => {
    const hotelId = requireHotelId(req.hotelId);
    const overview = await opts.service.getForHotel(hotelId);
    return toResponseDto(overview);
  });

  return Promise.resolve();
};

function requireHotelId(candidate: string | undefined): string {
  if (candidate === undefined || candidate === '') {
    throw new AuthError('Tenant scope missing on request');
  }
  return candidate;
}

function toResponseDto(overview: IntegrationOverview): IntegrationOverviewResponseDto {
  return {
    whatsapp: overview.whatsapp === null ? null : toWhatsappWire(overview.whatsapp),
    telegram: overview.telegram === null ? null : toTelegramWire(overview.telegram),
    qr: overview.qr === null ? null : toQrWire(overview.qr),
    health: toHealthWire(overview.health),
  };
}

function toWhatsappWire(view: WhatsappOverviewView): IntegrationOverviewResponseDto['whatsapp'] {
  return {
    bsp: view.bsp,
    phone_number: view.phoneNumber,
    verified_at: view.verifiedAt,
    has_access_token: view.hasAccessToken,
    webhook_url: view.webhookUrl,
  };
}

function toTelegramWire(view: TelegramOverviewView): IntegrationOverviewResponseDto['telegram'] {
  return {
    bot_username: view.botUsername,
    has_bot_token: view.hasBotToken,
    default_chat_id: view.defaultChatId,
    webhook_url: view.webhookUrl,
  };
}

function toQrWire(view: QrOverviewView): IntegrationOverviewResponseDto['qr'] {
  return {
    url: view.url,
    png_url: view.pngUrl,
    generated_at: view.generatedAt,
  };
}

function toHealthWire(view: HealthOverviewView): IntegrationOverviewResponseDto['health'] {
  return {
    whatsapp: toChannelPillWire(view.whatsapp),
    telegram: toChannelPillWire(view.telegram),
    claude_api: toClaudePillWire(view.claudeApi),
  };
}

function toChannelPillWire(
  pill: ChannelHealthPill,
): IntegrationOverviewResponseDto['health']['whatsapp'] {
  return {
    status: pill.status,
    ...(pill.lastMessageAt !== undefined ? { last_message_at: pill.lastMessageAt } : {}),
  };
}

function toClaudePillWire(
  pill: ClaudeApiHealthPill,
): IntegrationOverviewResponseDto['health']['claude_api'] {
  return {
    status: pill.status,
    last_check_at: pill.lastCheckAt,
    ...(pill.uptime30d !== undefined ? { uptime_30d: pill.uptime30d } : {}),
    ...(pill.avgResponseMs !== undefined ? { avg_response_ms: pill.avgResponseMs } : {}),
  };
}
