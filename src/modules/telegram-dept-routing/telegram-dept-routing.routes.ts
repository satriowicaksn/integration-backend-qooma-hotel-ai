// HTTP route for T18-followup per-dept Telegram routing write-through
// (spec §2.1 row 30 + §4.10).
//
// Thin layer: `dept_id` from URL param + `hotelId` from JWT (`req.hotelId`
// per Q-C-04 resolution) + zod-validated body → primitive service call →
// map result to snake_case wire. Guard composition mirrors T17/T24-followup:
// injected at api-server bootstrap so this plugin stays auth-agnostic.
//
// The T18 primitive service throws `NotFoundError('department', deptId)`
// for BOTH null-dept AND cross-tenant per spec §4.10 identical-shape
// anti-enumeration; error-handler.plugin translates to canonical 404.

import type { FastifyPluginAsync, preHandlerHookHandler } from 'fastify';

import { AuthError, ValidationError } from '@core/errors/app-errors.js';

import {
  UpdateDepartmentTelegramRoutingRequestSchema,
  type UpdateDepartmentTelegramRoutingResponseDto,
} from './telegram-dept-routing.schema.js';
import type { TelegramDeptRoutingService } from './telegram-dept-routing.service.js';
import type {
  TelegramDeptRoutingResult,
  UpdateDepartmentTelegramRoutingInput,
} from './telegram-dept-routing.types.js';

export interface TelegramDeptRoutingRoutesOptions {
  readonly service: TelegramDeptRoutingService;
  readonly guards: readonly preHandlerHookHandler[];
}

interface DeptParams {
  readonly dept_id: string;
}

export const telegramDeptRoutingRoutes: FastifyPluginAsync<TelegramDeptRoutingRoutesOptions> = (
  fastify,
  opts,
) => {
  const preHandler = [...opts.guards] as preHandlerHookHandler[];

  fastify.put<{ Params: DeptParams }>(
    '/api/integrations/telegram/departments/:dept_id',
    { preHandler },
    async (req) => {
      const hotelId = requireHotelId(req.hotelId);
      const deptId = req.params.dept_id;
      const parsed = UpdateDepartmentTelegramRoutingRequestSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new ValidationError('Invalid dept telegram routing payload', {
          issues: parsed.error.issues,
        });
      }
      const input: UpdateDepartmentTelegramRoutingInput = {
        hotelId,
        deptId,
        ...(parsed.data.telegram_chat_id !== undefined
          ? { telegramChatId: parsed.data.telegram_chat_id }
          : {}),
        ...(parsed.data.supervisor_telegram_id !== undefined
          ? { supervisorTelegramId: parsed.data.supervisor_telegram_id }
          : {}),
      };
      const result = await opts.service.updateRouting(input);
      return toResponseDto(result);
    },
  );

  return Promise.resolve();
};

function requireHotelId(candidate: string | undefined): string {
  if (candidate === undefined || candidate === '') {
    throw new AuthError('Tenant scope missing on request');
  }
  return candidate;
}

/** Pure camelCase-domain → snake_case-wire mapping (PM C ACK T18-fu
 *  binding #9). No logger, no clock, no side effects — clock lives on
 *  the primitive service. */
export function toResponseDto(
  result: TelegramDeptRoutingResult,
): UpdateDepartmentTelegramRoutingResponseDto {
  return {
    updated: result.updated,
    updated_at: result.updatedAt.toISOString(),
  };
}
