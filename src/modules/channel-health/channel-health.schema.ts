// zod schemas for T24 channel-health primitive.
//
// `HealthResponseSchema` mirrors the spec §2.2 payload for the FE badge poll
// (`GET /api/integrations/health`, 60s cadence). The route landing (T24-
// followup) composes this from the latest `ChannelHealthSnapshot` per
// provider — this file describes the wire shape only.
//
// NOTE — `last_message_at` composition (PM C ACK §566, binding condition #1):
// The response includes a `last_message_at` field per WA + Telegram provider
// that is NOT stored on `channel_health_snapshots`. The T24-followup route
// layer composes it at read time from `MAX(outbound_dispatch_queue.sent_at)`
// / `MAX(webhook_events.received_at)` per provider. It is intentionally
// omitted from the snapshot record + from the probe payload here — a route-
// layer concern only.

import { z } from 'zod';

const HealthStatusEnum = z.enum(['healthy', 'degraded', 'down']);

export const ClaudeApiHealthSchema = z.object({
  status: HealthStatusEnum,
  last_check_at: z.string(),
  uptime_30d: z.number().min(0).max(100).optional(),
  avg_response_ms: z.number().nonnegative().optional(),
});

const ChannelHealthSchema = z.object({
  status: HealthStatusEnum,
  last_message_at: z.string().nullable().optional(),
});

export const HealthResponseSchema = z.object({
  claude_api: ClaudeApiHealthSchema,
  whatsapp: ChannelHealthSchema,
  telegram: ChannelHealthSchema,
});

export type HealthResponseDto = z.infer<typeof HealthResponseSchema>;
export type ClaudeApiHealthDto = z.infer<typeof ClaudeApiHealthSchema>;
