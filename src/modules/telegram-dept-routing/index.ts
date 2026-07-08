// Barrel — types + service + ports + schemas + DTOs. `.js` extensions.

export type {
  DepartmentTenancy,
  TelegramDeptRoutingResult,
  UpdateDepartmentTelegramRoutingInput,
} from './telegram-dept-routing.types.js';

export type {
  UpdateDepartmentTelegramRoutingRequestDto,
  UpdateDepartmentTelegramRoutingResponseDto,
} from './telegram-dept-routing.schema.js';

export {
  UpdateDepartmentTelegramRoutingRequestSchema,
  UpdateDepartmentTelegramRoutingResponseSchema,
} from './telegram-dept-routing.schema.js';

export { TelegramDeptRoutingService } from './telegram-dept-routing.service.js';
export type { RoutingClock, TelegramDeptRoutingPorts } from './telegram-dept-routing.service.js';

export type { DepartmentTelegramReadPort } from './ports/department-telegram-read.port.js';
export type {
  DepartmentTelegramWritePort,
  DepartmentTelegramWriteResult,
} from './ports/department-telegram-write.port.js';
