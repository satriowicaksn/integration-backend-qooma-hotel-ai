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
