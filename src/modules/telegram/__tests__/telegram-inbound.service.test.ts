import { describe, expect, it, jest } from '@jest/globals';

import type { Logger } from '@core/logger/logger.js';

import type { StaffLookupPort } from '../ports/staff-lookup.port.js';
import type { TicketActionPort } from '../ports/ticket-action.port.js';
import { HELP_TEXT } from '../telegram-inbound.commands.js';
import type { TelegramUpdate } from '../telegram-inbound.schema.js';
import { TelegramInboundService } from '../telegram-inbound.service.js';
import type { StaffIdentity } from '../telegram-inbound.types.js';

const HOTEL_ID = '11111111-2222-3333-4444-555555555555';
const STAFF_TELEGRAM_ID = 87654321;
const STAFF: StaffIdentity = {
  staffId: 'staff-uuid-1',
  hotelId: HOTEL_ID,
  deptId: 'dept-uuid-1',
  role: 'staff',
};

interface StaffLookupMock {
  lookupByTelegramUserId: jest.Mock<StaffLookupPort['lookupByTelegramUserId']>;
}

interface TicketActionMock {
  take: jest.Mock<TicketActionPort['take']>;
  release: jest.Mock<TicketActionPort['release']>;
  markDone: jest.Mock<TicketActionPort['markDone']>;
}

interface LoggerMock extends Logger {
  info: jest.Mock;
  debug: jest.Mock;
  warn: jest.Mock;
  error: jest.Mock;
}

function buildLoggerMock(): LoggerMock {
  return {
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };
}

function buildService(): {
  service: TelegramInboundService;
  staffLookup: StaffLookupMock;
  ticketAction: TicketActionMock;
  logger: LoggerMock;
} {
  const staffLookup: StaffLookupMock = {
    lookupByTelegramUserId: jest.fn<StaffLookupPort['lookupByTelegramUserId']>(),
  };
  const ticketAction: TicketActionMock = {
    take: jest.fn<TicketActionPort['take']>(),
    release: jest.fn<TicketActionPort['release']>(),
    markDone: jest.fn<TicketActionPort['markDone']>(),
  };
  const logger = buildLoggerMock();
  const service = new TelegramInboundService(
    staffLookup as unknown as StaffLookupPort,
    ticketAction as unknown as TicketActionPort,
    logger,
  );
  return { service, staffLookup, ticketAction, logger };
}

function buildUpdate(
  text: string | undefined,
  overrides: Partial<TelegramUpdate> = {},
): TelegramUpdate {
  return {
    update_id: 1,
    message: {
      message_id: 1,
      date: 1,
      chat: { id: -1001 },
      from: { id: STAFF_TELEGRAM_ID },
      ...(text === undefined ? {} : { text }),
    },
    ...overrides,
  };
}

describe('TelegramInboundService.handleUpdate — guards', () => {
  it('should ignore update with no message', async () => {
    const { service } = buildService();
    const result = await service.handleUpdate(HOTEL_ID, { update_id: 1 });
    expect(result).toEqual({ kind: 'ignored', reason: 'no_message' });
  });

  it('should ignore update with no sender (from missing)', async () => {
    const { service } = buildService();
    const result = await service.handleUpdate(HOTEL_ID, {
      update_id: 1,
      message: { message_id: 1, date: 1, chat: { id: -1 }, text: '/take 1' },
    });
    expect(result).toEqual({ kind: 'ignored', reason: 'no_sender' });
  });

  it('should ignore update with no text', async () => {
    const { service } = buildService();
    const result = await service.handleUpdate(HOTEL_ID, buildUpdate(undefined));
    expect(result).toEqual({ kind: 'ignored', reason: 'no_text' });
  });

  it('should ignore whitespace-only text', async () => {
    const { service } = buildService();
    const result = await service.handleUpdate(HOTEL_ID, buildUpdate('   '));
    expect(result).toEqual({ kind: 'ignored', reason: 'no_text' });
  });
});

describe('TelegramInboundService.handleUpdate — staff identification', () => {
  it('should silent-ignore when staff not recognized (anti-enumeration)', async () => {
    const { service, staffLookup, ticketAction, logger } = buildService();
    staffLookup.lookupByTelegramUserId.mockResolvedValue(null);

    const result = await service.handleUpdate(HOTEL_ID, buildUpdate('/take 1234'));

    expect(result).toEqual({ kind: 'ignored', reason: 'staff_not_recognized' });
    expect(ticketAction.take).not.toHaveBeenCalled();
    expect(ticketAction.release).not.toHaveBeenCalled();
    expect(ticketAction.markDone).not.toHaveBeenCalled();
    expect(logger.info).toHaveBeenCalledWith(
      expect.objectContaining({
        msg: 'telegram_inbound.ignored',
        reason: 'staff_not_recognized',
      }),
    );
    const logged = logger.info.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(JSON.stringify(logged)).not.toContain(String(STAFF_TELEGRAM_ID));
    expect(logged['telegramUserIdSuffix']).toBe(String(STAFF_TELEGRAM_ID).slice(-4));
  });

  it('should call staff lookup with hotelId + telegramUserId as string', async () => {
    const { service, staffLookup, ticketAction } = buildService();
    staffLookup.lookupByTelegramUserId.mockResolvedValue(STAFF);
    ticketAction.take.mockResolvedValue({ status: 'ok' });

    await service.handleUpdate(HOTEL_ID, buildUpdate('/take 1234'));

    expect(staffLookup.lookupByTelegramUserId).toHaveBeenCalledWith({
      hotelId: HOTEL_ID,
      telegramUserId: String(STAFF_TELEGRAM_ID),
    });
  });
});

describe('TelegramInboundService.handleUpdate — command dispatch', () => {
  it('should dispatch /take to TicketActionPort.take and reply on ok', async () => {
    const { service, staffLookup, ticketAction } = buildService();
    staffLookup.lookupByTelegramUserId.mockResolvedValue(STAFF);
    ticketAction.take.mockResolvedValue({ status: 'ok' });

    const result = await service.handleUpdate(HOTEL_ID, buildUpdate('/take 1234'));

    expect(ticketAction.take).toHaveBeenCalledWith({
      hotelId: STAFF.hotelId,
      ticketId: '1234',
      staffId: STAFF.staffId,
    });
    expect(result).toEqual({ kind: 'reply', text: 'Ticket 1234 assigned to you.' });
  });

  it('should dispatch /release to TicketActionPort.release', async () => {
    const { service, staffLookup, ticketAction } = buildService();
    staffLookup.lookupByTelegramUserId.mockResolvedValue(STAFF);
    ticketAction.release.mockResolvedValue({ status: 'ok' });

    const result = await service.handleUpdate(HOTEL_ID, buildUpdate('/release 42'));

    expect(ticketAction.release).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ kind: 'reply', text: 'Ticket 42 released.' });
  });

  it('should dispatch /done to TicketActionPort.markDone', async () => {
    const { service, staffLookup, ticketAction } = buildService();
    staffLookup.lookupByTelegramUserId.mockResolvedValue(STAFF);
    ticketAction.markDone.mockResolvedValue({ status: 'ok' });

    const result = await service.handleUpdate(HOTEL_ID, buildUpdate('/done 42'));

    expect(ticketAction.markDone).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ kind: 'reply', text: 'Ticket 42 marked as done.' });
  });

  it('should reply with not-found text on ticket action not_found outcome', async () => {
    const { service, staffLookup, ticketAction } = buildService();
    staffLookup.lookupByTelegramUserId.mockResolvedValue(STAFF);
    ticketAction.take.mockResolvedValue({ status: 'not_found' });

    const result = await service.handleUpdate(HOTEL_ID, buildUpdate('/take 9999'));

    expect(result).toEqual({ kind: 'reply', text: 'Ticket 9999 not found.' });
  });

  it('should reply with forbidden text on ticket action forbidden outcome', async () => {
    const { service, staffLookup, ticketAction } = buildService();
    staffLookup.lookupByTelegramUserId.mockResolvedValue(STAFF);
    ticketAction.release.mockResolvedValue({ status: 'forbidden' });

    const result = await service.handleUpdate(HOTEL_ID, buildUpdate('/release 42'));

    expect(result).toEqual({
      kind: 'reply',
      text: 'You are not allowed to release ticket 42.',
    });
  });

  it('should reply with HELP_TEXT for recognized staff sending /help', async () => {
    const { service, staffLookup, ticketAction } = buildService();
    staffLookup.lookupByTelegramUserId.mockResolvedValue(STAFF);

    const result = await service.handleUpdate(HOTEL_ID, buildUpdate('/help'));

    expect(result).toEqual({ kind: 'reply', text: HELP_TEXT });
    expect(ticketAction.take).not.toHaveBeenCalled();
  });

  it('should reply with HELP_TEXT for recognized staff sending unknown command', async () => {
    const { service, staffLookup, ticketAction } = buildService();
    staffLookup.lookupByTelegramUserId.mockResolvedValue(STAFF);

    const result = await service.handleUpdate(HOTEL_ID, buildUpdate('/mystery 42'));

    expect(result).toEqual({ kind: 'reply', text: HELP_TEXT });
    expect(ticketAction.take).not.toHaveBeenCalled();
    expect(ticketAction.release).not.toHaveBeenCalled();
    expect(ticketAction.markDone).not.toHaveBeenCalled();
  });

  it('should reply with HELP_TEXT for /take without ticket id (parses as unknown)', async () => {
    const { service, staffLookup, ticketAction } = buildService();
    staffLookup.lookupByTelegramUserId.mockResolvedValue(STAFF);

    const result = await service.handleUpdate(HOTEL_ID, buildUpdate('/take'));

    expect(result).toEqual({ kind: 'reply', text: HELP_TEXT });
    expect(ticketAction.take).not.toHaveBeenCalled();
  });

  it('should log dispatch line with staffId + command kind', async () => {
    const { service, staffLookup, ticketAction, logger } = buildService();
    staffLookup.lookupByTelegramUserId.mockResolvedValue(STAFF);
    ticketAction.take.mockResolvedValue({ status: 'ok' });

    await service.handleUpdate(HOTEL_ID, buildUpdate('/take 1234'));

    expect(logger.info).toHaveBeenCalledWith(
      expect.objectContaining({
        msg: 'telegram_inbound.dispatch',
        module: 'telegram',
        hotelId: HOTEL_ID,
        staffId: STAFF.staffId,
        command: 'take',
      }),
    );
  });
});
