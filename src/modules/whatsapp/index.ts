export type {
  BspCredentials,
  BspSendResult,
  SendTemplateInput,
  SendTextInput,
  WhatsappBspPort,
} from './ports/whatsapp-bsp.port.js';

export { WhatsappConfigRepository } from './whatsapp-config.repository.js';
export { WhatsappConfigService } from './whatsapp-config.service.js';
export { WhatsappConfigPutSchema, WhatsappConfigResponseSchema } from './whatsapp-config.schema.js';
export type { WhatsappConfigPutDto, WhatsappConfigResponseDto } from './whatsapp-config.schema.js';
export type {
  WhatsappBspVendor,
  WhatsappConfigDomain,
  WhatsappConfigPersistenceInput,
  WhatsappConfigUpsertInput,
} from './whatsapp-config.types.js';

export type { HotelCoreTemplateCallbackPort } from './ports/hotel-core-template-callback.port.js';
export type { WhatsappTemplateManagementPort } from './ports/whatsapp-template-management.port.js';
export { WhatsappTemplateService } from './whatsapp-template.service.js';
export {
  HotelCoreResubmitRpcPayloadSchema,
  HotelCoreSubmitRpcPayloadSchema,
  TemplateStatusEventSchema,
  WaTemplateComponentSchema,
} from './whatsapp-template.schema.js';
export type {
  HotelCoreResubmitRpcPayload,
  HotelCoreSubmitRpcPayload,
  TemplateStatusEventDto,
} from './whatsapp-template.schema.js';
export type {
  HotelCoreCallbackPayload,
  ResubmitTemplateInput,
  SubmitTemplateInput,
  TemplateManagementResult,
  TemplateStatusEvent,
  WaTemplateCategory,
  WaTemplateComponent,
  WaTemplateComponentType,
  WaTemplateStatus,
} from './whatsapp-template.types.js';

export type { WebhookPingerPort } from './ports/webhook-pinger.port.js';
export { WhatsappWebhookVerifyRepository } from './whatsapp-webhook-verify.repository.js';
export { WhatsappVerifyWebhookResponseSchema } from './whatsapp-webhook-verify.schema.js';
export type { WhatsappVerifyWebhookResponseDto } from './whatsapp-webhook-verify.schema.js';
export { WhatsappWebhookVerifyService } from './whatsapp-webhook-verify.service.js';
export type {
  WebhookPingerInput,
  WebhookPingerResult,
  WebhookVerificationDomain,
  WebhookVerificationOutcome,
} from './whatsapp-webhook-verify.types.js';

export type { AiInboundMessagePort } from './ports/ai-inbound-message.port.js';
export type { HotelCoreGuestUpsertPort } from './ports/hotel-core-guest-upsert.port.js';
export { WhatsappInboundIngestService } from './whatsapp-inbound-ingest.service.js';
export { WhatsappWebhookEventsRepository } from './whatsapp-webhook-events.repository.js';
export {
  WhatsappInboundEnvelopeSchema,
  WhatsappInboundIngestResponseSchema,
  extractInboundMessages,
} from './whatsapp-webhook-ingest.schema.js';
export type {
  WhatsappInboundEnvelopeDto,
  WhatsappInboundIngestResponseDto,
} from './whatsapp-webhook-ingest.schema.js';
export type {
  AiInboundInput,
  GuestUpsertInput,
  GuestUpsertResult,
  IngestOutcome,
  WebhookEventPersistenceInput,
  WebhookEventProvider,
  WhatsappInboundMessage,
} from './whatsapp-webhook-ingest.types.js';

export { WhatsappDeliveryReceiptsRepository } from './whatsapp-delivery-receipts.repository.js';
export {
  WhatsappDeliveryStatusesEnvelopeSchema,
  extractStatuses,
} from './whatsapp-delivery-receipts.schema.js';
export type { WhatsappDeliveryStatusesEnvelopeDto } from './whatsapp-delivery-receipts.schema.js';
export { WhatsappDeliveryReceiptsService } from './whatsapp-delivery-receipts.service.js';
export type {
  DeliveryReceiptIngestOutcome,
  DeliveryReceiptPersistenceInput,
  DeliveryReceiptStatus,
  WhatsappDeliveryReceiptsIngestResult,
  WhatsappStatusEntry,
} from './whatsapp-delivery-receipts.types.js';

export type { HotelCoreDndPort } from './ports/hotel-core-dnd.port.js';
export type { HotelCoreQuotaPort } from './ports/hotel-core-quota.port.js';
export { WhatsappOutboundDispatchRepository } from './whatsapp-outbound-dispatch.repository.js';
export { OutboundDispatchRequestSchema } from './whatsapp-outbound-dispatch.schema.js';
export type { OutboundDispatchRequestDto } from './whatsapp-outbound-dispatch.schema.js';
export { WhatsappOutboundDispatchService } from './whatsapp-outbound-dispatch.service.js';
export type {
  DndCheckResult,
  OutboundDispatchConfig,
  OutboundDispatchOutcome,
  OutboundDispatchPersistenceInput,
  OutboundDispatchProvider,
  OutboundDispatchRequest,
  OutboundDispatchStatus,
  OutboundDispatchTemplate,
  QuotaCheckResult,
} from './whatsapp-outbound-dispatch.types.js';
