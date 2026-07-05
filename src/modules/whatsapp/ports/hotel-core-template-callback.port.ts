/**
 * Cross-service callback port — Integration → Hotel Core, for template status
 * transitions surfaced by Meta (`template:approved` / `template:rejected`
 * webhook branch handled by `WhatsappTemplateService.handleMetaStatusUpdate`).
 *
 * **TYPE-ONLY** in this primitive per PM B ACK GAP T16-#5 → Q-B-02: the
 * concrete HTTP adapter (`http-hotel-core-callback.adapter.ts`) is deferred to
 * **T16-followup** and lands only after (a) Q-B-02 ratifies the HC endpoint
 * contract (URL, path, payload, response shape) AND (b) Q-C-02 wires
 * `HC_BASE_URL` + `INTERNAL_SECRET` into `core/config/env.ts` + `api.ts`
 * bootstrap. The service consumes this port abstractly; unit tests inject a
 * test-double.
 */

import type { HotelCoreCallbackPayload } from '../whatsapp-template.types.js';

export interface HotelCoreTemplateCallbackPort {
  updateWaTemplateStatus(payload: HotelCoreCallbackPayload): Promise<void>;
}
