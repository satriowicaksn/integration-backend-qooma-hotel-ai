// Barrel — per PM C ACK T20 binding #15: export types + service + ports +
// schemas + DTOs. All imports use `.js` extensions (binding #8).

export type {
  AnswerTelegramCallbackInput,
  SendTelegramMessageInput,
  TelegramConfigForDispatch,
  TelegramInlineKeyboardButton,
  TelegramInlineKeyboardMarkup,
  TelegramParseMode,
  TelegramSendResult,
} from './telegram-outbound.types.js';

export type {
  SendTelegramMessageRequestDto,
  SendTelegramMessageResponseDto,
} from './telegram-outbound.schema.js';

export {
  SendTelegramMessageRequestSchema,
  SendTelegramMessageResponseSchema,
  TelegramParseModeEnum,
} from './telegram-outbound.schema.js';

export { TelegramDispatchService } from './telegram-outbound.service.js';
export type { DispatchClock, TelegramDispatchPorts } from './telegram-outbound.service.js';

export type { TelegramConfigReadPort } from './ports/telegram-config-read.port.js';
export type {
  TelegramBotAnswerCallbackInput,
  TelegramBotApiPort,
  TelegramBotSendMessageInput,
  TelegramBotSendMessageResult,
} from './ports/telegram-bot-api.port.js';

export { telegramOutboundRoutes } from './telegram-outbound.routes.js';
export type {
  OtpNotifyHandler,
  OtpNotifyInput,
  TelegramOutboundRoutesOptions,
} from './telegram-outbound.routes.js';
