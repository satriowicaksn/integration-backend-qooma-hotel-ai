// zod schema for the WIRE shape of the `integration:health_changed`
// event (spec §5 row 321). Freezes the contract early per PM C ACK
// T25 binding #8 (`.strict()` top-level). Field names are snake_case
// per API-contract convention (matches slot-B T10 + T22 `png_url` etc.).
//
// **NOT the input shape**: the service accepts camelCase input
// (`HealthChangedEventPayload`) and converts internally before invoking
// `SocketPublisherPort.publish`. See PM C ACK T25 binding #2 for the
// case-conversion discipline.

import { z } from 'zod';

const HealthStatusEnum = z.enum(['healthy', 'degraded', 'down']);
const HealthProviderEnum = z.enum(['whatsapp', 'telegram', 'claude_api']);

export const IntegrationHealthChangedEventSchema = z
  .object({
    hotel_id: z.string(),
    provider: HealthProviderEnum,
    previous_status: HealthStatusEnum.nullable(),
    new_status: HealthStatusEnum,
    checked_at: z.string(),
  })
  .strict();

export type IntegrationHealthChangedEventDto = z.infer<typeof IntegrationHealthChangedEventSchema>;
