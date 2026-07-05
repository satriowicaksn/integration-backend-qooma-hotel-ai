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
