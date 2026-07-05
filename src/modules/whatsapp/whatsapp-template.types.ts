/**
 * Domain types for the WhatsApp template Meta-relay primitive (spec §2.4 +
 * §3.1). This module represents template SUBMISSION / RESUBMISSION / STATUS
 * CALLBACK — distinct from T06's message dispatch (`/messages` surface).
 *
 * Assumption stamps (refactor targets when Q-B-01/02/03 resolve):
 * - **Q-B-01 assumption A**: `wabaId` arrives per-call in port input; no
 *   `wa_configs.waba_id` column yet. If PO ratifies schema-add, adapter's
 *   `SubmitTemplateInput.wabaId` moves to a `wa_configs` read at wiring time.
 * - **Q-B-03 assumption A**: HC → us RPC payload carries the full template
 *   definition (`{ templateId, name, category, language, components[],
 *   wabaId, accessToken }`); we do NOT round-trip HC to fetch. If PO ratifies
 *   template_id-only, `HotelCoreSubmitRpcPayload` shrinks + a new `getWaTemplate`
 *   RPC dependency lands.
 * - **Q-B-02 assumption A**: HC callback contract stubbed as TYPE-ONLY port
 *   in `hotel-core-template-callback.port.ts`; adapter deferred to T16-followup.
 */

export type WaTemplateCategory = 'MARKETING' | 'UTILITY' | 'AUTHENTICATION';

export type WaTemplateStatus = 'IN_REVIEW' | 'APPROVED' | 'REJECTED' | 'PAUSED' | 'DISABLED';

export type WaTemplateComponentType = 'HEADER' | 'BODY' | 'FOOTER' | 'BUTTONS';

export interface WaTemplateComponent {
  readonly type: WaTemplateComponentType;
  readonly text?: string | undefined;
  readonly format?: 'TEXT' | 'IMAGE' | 'VIDEO' | 'DOCUMENT' | undefined;
  readonly buttons?: ReadonlyArray<{ readonly type: string; readonly text: string }> | undefined;
}

export interface SubmitTemplateInput {
  readonly wabaId: string;
  readonly accessToken: string;
  readonly name: string;
  readonly category: WaTemplateCategory;
  readonly language: string;
  readonly components: ReadonlyArray<WaTemplateComponent>;
}

export interface ResubmitTemplateInput extends SubmitTemplateInput {
  readonly metaTemplateId: string;
}

export interface TemplateManagementResult {
  readonly metaTemplateId: string;
  readonly status: WaTemplateStatus;
}

/**
 * Router-forwarded template status event branch — signature verification lives
 * at the T04/T12 router-layer plane; this payload arrives already trusted
 * (structural zod parse still runs as defense-in-depth).
 */
export interface TemplateStatusEvent {
  readonly hotelId: string;
  readonly metaTemplateId: string;
  readonly templateName: string;
  readonly status: WaTemplateStatus;
  readonly reason?: string;
}

/**
 * HC callback payload — shape service passes into
 * `HotelCoreTemplateCallbackPort.updateWaTemplateStatus`. Uses `templateId`
 * (HC-side identifier the router will resolve via `templateName` → HC lookup,
 * or HC embeds it in the Meta template metadata pre-submit — resolution
 * pattern is Q-B-02 territory).
 */
export interface HotelCoreCallbackPayload {
  readonly templateId: string;
  readonly status: WaTemplateStatus;
  readonly metaTemplateId: string;
  readonly reason?: string;
}
