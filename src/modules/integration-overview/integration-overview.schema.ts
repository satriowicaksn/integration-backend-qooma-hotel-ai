// zod schema for T23 integration overview response.
//
// **Wire contract** (PM C ACK T23 binding #4/#6/#7): snake_case field
// names per API-contract convention; per-subsystem nullable except health
// (binding #3 — always present, synthetic-down snapshot on read-fail per
// binding #11); top-level `.strict()` to reject unknown top-level keys so
// FE typos surface at contract boundary.
//
// **Field-shape starting point** (Q-C-11 open, PM C ACK §1258 binding #7)
// — the FE MSW handlers are authoritative but live in a separate repo.
// Refactor to matching FE shape at T23-followup is a 1-file change.

import { z } from 'zod';

const HealthPillStatusEnum = z.enum(['healthy', 'degraded', 'down']);

const WaOverviewSchema = z
  .object({
    bsp: z.string(),
    phone_number: z.string(),
    phone_number_id: z.string(),
    verified_at: z.string().nullable(),
    has_access_token: z.boolean(),
    webhook_url: z.string().nullable(),
    webhook_verify_token: z.string().nullable(),
    waba_id: z.string().nullable().optional(),
  })
  .strict();

const TelegramOverviewSchema = z
  .object({
    bot_username: z.string(),
    has_bot_token: z.boolean(),
    default_chat_id: z.string().nullable(),
    webhook_url: z.string().nullable(),
  })
  .strict();

const QrOverviewSchema = z
  .object({
    url: z.string(),
    png_url: z.string(),
    generated_at: z.string(),
  })
  .strict();

const ChannelHealthPillSchema = z
  .object({
    status: HealthPillStatusEnum,
    last_message_at: z.string().nullable().optional(),
  })
  .strict();

const ClaudeApiHealthPillSchema = z
  .object({
    status: HealthPillStatusEnum,
    last_check_at: z.string(),
    uptime_30d: z.number().min(0).max(100).optional(),
    avg_response_ms: z.number().nonnegative().optional(),
  })
  .strict();

const HealthOverviewSchema = z
  .object({
    whatsapp: ChannelHealthPillSchema,
    telegram: ChannelHealthPillSchema,
    claude_api: ClaudeApiHealthPillSchema,
  })
  .strict();

export const IntegrationOverviewResponseSchema = z
  .object({
    whatsapp: WaOverviewSchema.nullable(),
    telegram: TelegramOverviewSchema.nullable(),
    qr: QrOverviewSchema.nullable(),
    health: HealthOverviewSchema,
  })
  .strict();

export type IntegrationOverviewResponseDto = z.infer<typeof IntegrationOverviewResponseSchema>;
