/**
 * BSP-level port for WhatsApp template CRUD against Meta's
 * `/{waba_id}/message_templates` surface — distinct from T06's message
 * dispatch surface (`/messages` at `whatsapp-bsp.port.ts`). Kept as a separate
 * port per single-responsibility (GAP T16-#3 A): Meta MAY expose different
 * auth scopes or rate limits per surface; SRP preserves T06 byte-for-byte and
 * makes future BSP swap targeted.
 *
 * Q-B-01 assumption A stamp: `wabaId` enters per-call via
 * `SubmitTemplateInput.wabaId` — no `wa_configs.waba_id_enc` column yet.
 * Refactor site when the schema-add lands (analogous to Q-A-04 `app_secret`).
 */

import type {
  ResubmitTemplateInput,
  SubmitTemplateInput,
  TemplateManagementResult,
} from '../whatsapp-template.types.js';

export interface WhatsappTemplateManagementPort {
  submitTemplate(input: SubmitTemplateInput): Promise<TemplateManagementResult>;
  resubmitTemplate(input: ResubmitTemplateInput): Promise<TemplateManagementResult>;
}
