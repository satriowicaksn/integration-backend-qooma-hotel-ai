/**
 * WhatsApp template service — Meta-relay orchestrator.
 *
 * Three flows (spec `04-integration-channels.md §3.1`):
 *  - `submit` — HC → us RPC → we relay to Meta (`/message_templates` POST).
 *  - `resubmit` — HC → us RPC → we relay to Meta (PATCH or DELETE+POST fallback,
 *    strategy owned by adapter).
 *  - `handleMetaStatusUpdate` — router-forwarded status branch (Meta → us) →
 *    we call HC's internal callback (`updateWaTemplateStatus`).
 *
 * Signature verification for the Meta webhook branch lives at the T04 HMAC
 * plugin + T12 router layer — this service is **signature-agnostic** and
 * receives a payload already trusted structurally (still zod-parsed as
 * defense-in-depth at the boundary).
 *
 * Pure-helper imports are DIRECT (ADR-0001 no wrap-on-wrap): `maskTokenForLog`
 * is a `@shared/utils/masking` helper, not a port. The service constructor
 * only injects boundary deps: the BSP-template port, the HC-callback port
 * (type-only — Q-B-02 adapter is T16-followup), and a `Logger`.
 *
 * Q-B-01/02/03 assumption stamps live in the type + schema files; the
 * service itself has no schema-shape dependency beyond what the ports expose.
 */

import { ExternalServiceError, ValidationError } from '@core/errors/app-errors.js';
import type { Logger } from '@core/logger/logger.js';

import { maskTokenForLog } from '@shared/utils/masking.js';

import type { HotelCoreTemplateCallbackPort } from './ports/hotel-core-template-callback.port.js';
import type { WhatsappTemplateManagementPort } from './ports/whatsapp-template-management.port.js';
import {
  HotelCoreResubmitRpcPayloadSchema,
  HotelCoreSubmitRpcPayloadSchema,
  TemplateStatusEventSchema,
} from './whatsapp-template.schema.js';
import type {
  HotelCoreResubmitRpcPayload,
  HotelCoreSubmitRpcPayload,
  TemplateStatusEventDto,
} from './whatsapp-template.schema.js';
import type { TemplateManagementResult } from './whatsapp-template.types.js';

const LOG_MODULE = 'whatsapp';
const LOG_SUBMIT = 'whatsapp_template.submit';
const LOG_RESUBMIT = 'whatsapp_template.resubmit';
const LOG_STATUS_UPDATE = 'whatsapp_template.status_update';

export class WhatsappTemplateService {
  constructor(
    private readonly bspPort: WhatsappTemplateManagementPort,
    private readonly hcCallback: HotelCoreTemplateCallbackPort,
    private readonly logger: Logger,
  ) {}

  async submit(
    hotelId: string,
    payload: HotelCoreSubmitRpcPayload,
  ): Promise<TemplateManagementResult> {
    const parsed = HotelCoreSubmitRpcPayloadSchema.safeParse(payload);
    if (!parsed.success) {
      throw new ValidationError('Invalid submit_wa_template_to_meta payload', {
        issues: parsed.error.issues,
      });
    }
    const input = parsed.data;

    this.logger.info({
      msg: LOG_SUBMIT,
      module: LOG_MODULE,
      hotelId,
      templateId: input.templateId,
      wabaId: input.wabaId,
      name: input.name,
      category: input.category,
      language: input.language,
      componentCount: input.components.length,
      accessToken: maskTokenForLog(input.accessToken),
    });

    return this.bspPort.submitTemplate({
      wabaId: input.wabaId,
      accessToken: input.accessToken,
      name: input.name,
      category: input.category,
      language: input.language,
      components: input.components,
    });
  }

  async resubmit(
    hotelId: string,
    payload: HotelCoreResubmitRpcPayload,
  ): Promise<TemplateManagementResult> {
    const parsed = HotelCoreResubmitRpcPayloadSchema.safeParse(payload);
    if (!parsed.success) {
      throw new ValidationError('Invalid resubmit_wa_template_to_meta payload', {
        issues: parsed.error.issues,
      });
    }
    const input = parsed.data;

    this.logger.info({
      msg: LOG_RESUBMIT,
      module: LOG_MODULE,
      hotelId,
      templateId: input.templateId,
      metaTemplateId: input.metaTemplateId,
      wabaId: input.wabaId,
      name: input.name,
      category: input.category,
      language: input.language,
      componentCount: input.components.length,
      accessToken: maskTokenForLog(input.accessToken),
    });

    return this.bspPort.resubmitTemplate({
      wabaId: input.wabaId,
      accessToken: input.accessToken,
      metaTemplateId: input.metaTemplateId,
      name: input.name,
      category: input.category,
      language: input.language,
      components: input.components,
    });
  }

  async handleMetaStatusUpdate(templateId: string, event: TemplateStatusEventDto): Promise<void> {
    const parsed = TemplateStatusEventSchema.safeParse(event);
    if (!parsed.success) {
      throw new ValidationError('Invalid Meta template status event', {
        issues: parsed.error.issues,
      });
    }
    const parsedEvent = parsed.data;

    this.logger.info({
      msg: LOG_STATUS_UPDATE,
      module: LOG_MODULE,
      hotelId: parsedEvent.hotelId,
      templateId,
      metaTemplateId: parsedEvent.metaTemplateId,
      templateName: parsedEvent.templateName,
      status: parsedEvent.status,
      reason: parsedEvent.reason,
    });

    try {
      await this.hcCallback.updateWaTemplateStatus({
        templateId,
        status: parsedEvent.status,
        metaTemplateId: parsedEvent.metaTemplateId,
        ...(parsedEvent.reason !== undefined ? { reason: parsedEvent.reason } : {}),
      });
    } catch (err) {
      if (err instanceof ExternalServiceError) {
        throw err;
      }
      throw new ExternalServiceError(
        'hotel-core-template-callback',
        'Hotel Core template status callback failed',
        { body: err instanceof Error ? err.message : String(err) },
      );
    }
  }
}
