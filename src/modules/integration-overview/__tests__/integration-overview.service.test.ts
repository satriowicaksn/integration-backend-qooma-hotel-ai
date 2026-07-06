import { describe, expect, it, jest } from '@jest/globals';

import type { Logger } from '@core/logger/logger.js';

import { IntegrationOverviewService } from '../integration-overview.service.js';
import type {
  HealthOverviewView,
  QrOverviewView,
  TelegramOverviewView,
  WhatsappOverviewView,
} from '../integration-overview.types.js';
import type { ChannelHealthReadPort } from '../ports/channel-health-read.port.js';
import type { QrStateReadPort } from '../ports/qr-state-read.port.js';
import type { TelegramConfigReadPort } from '../ports/telegram-config-read.port.js';
import type { WhatsappConfigReadPort } from '../ports/whatsapp-config-read.port.js';

const HOTEL_ID = '11111111-2222-3333-4444-555555555555';
const NOW = new Date('2026-07-07T09:30:00Z');

const WA_VIEW: WhatsappOverviewView = {
  bsp: '1engage',
  phoneNumber: '+6281234567890',
  verifiedAt: '2026-07-01T12:00:00Z',
  hasAccessToken: true,
  webhookUrl: 'https://example.com/wa-webhook',
};

const TELEGRAM_VIEW: TelegramOverviewView = {
  botUsername: 'qooma_demo_bot',
  hasBotToken: true,
  defaultChatId: '-100999',
  webhookUrl: null,
};

const QR_VIEW: QrOverviewView = {
  url: 'https://wa.me/6281234567890',
  pngUrl: 'https://cdn.example.com/qr/hotel-1.png',
  generatedAt: '2026-07-06T22:30:00Z',
};

const HEALTH_VIEW: HealthOverviewView = {
  whatsapp: { status: 'healthy', lastMessageAt: '2026-07-07T09:29:12Z' },
  telegram: { status: 'degraded', lastMessageAt: null },
  claudeApi: {
    status: 'healthy',
    lastCheckAt: '2026-07-07T09:30:00Z',
    uptime30d: 99.7,
  },
};

interface WaMock {
  getForHotel: jest.Mock<WhatsappConfigReadPort['getForHotel']>;
}

interface TelegramMock {
  getForHotel: jest.Mock<TelegramConfigReadPort['getForHotel']>;
}

interface QrMock {
  getForHotel: jest.Mock<QrStateReadPort['getForHotel']>;
}

interface HealthMock {
  getSnapshot: jest.Mock<ChannelHealthReadPort['getSnapshot']>;
}

interface LoggerMock extends Logger {
  info: jest.Mock;
  debug: jest.Mock;
  warn: jest.Mock;
  error: jest.Mock;
}

function buildLogger(): LoggerMock {
  return {
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };
}

function buildService(): {
  service: IntegrationOverviewService;
  wa: WaMock;
  telegram: TelegramMock;
  qr: QrMock;
  health: HealthMock;
  logger: LoggerMock;
} {
  const wa: WaMock = { getForHotel: jest.fn<WhatsappConfigReadPort['getForHotel']>() };
  const telegram: TelegramMock = {
    getForHotel: jest.fn<TelegramConfigReadPort['getForHotel']>(),
  };
  const qr: QrMock = { getForHotel: jest.fn<QrStateReadPort['getForHotel']>() };
  const health: HealthMock = { getSnapshot: jest.fn<ChannelHealthReadPort['getSnapshot']>() };
  const logger = buildLogger();
  const service = new IntegrationOverviewService(
    {
      whatsapp: wa as unknown as WhatsappConfigReadPort,
      telegram: telegram as unknown as TelegramConfigReadPort,
      qr: qr as unknown as QrStateReadPort,
      health: health as unknown as ChannelHealthReadPort,
    },
    logger,
    { now: () => NOW },
  );
  return { service, wa, telegram, qr, health, logger };
}

describe('IntegrationOverviewService.getForHotel — happy path', () => {
  it('should return every subsystem populated when all reads succeed', async () => {
    const { service, wa, telegram, qr, health } = buildService();
    wa.getForHotel.mockResolvedValue(WA_VIEW);
    telegram.getForHotel.mockResolvedValue(TELEGRAM_VIEW);
    qr.getForHotel.mockResolvedValue(QR_VIEW);
    health.getSnapshot.mockResolvedValue(HEALTH_VIEW);

    const result = await service.getForHotel(HOTEL_ID);

    expect(result).toEqual({
      whatsapp: WA_VIEW,
      telegram: TELEGRAM_VIEW,
      qr: QR_VIEW,
      health: HEALTH_VIEW,
    });
    expect(wa.getForHotel).toHaveBeenCalledWith({ hotelId: HOTEL_ID });
    expect(telegram.getForHotel).toHaveBeenCalledWith({ hotelId: HOTEL_ID });
    expect(qr.getForHotel).toHaveBeenCalledWith({ hotelId: HOTEL_ID });
    expect(health.getSnapshot).toHaveBeenCalledWith({ hotelId: HOTEL_ID });
  });

  it('should fire all four reads in parallel (Promise.all discipline)', async () => {
    const { service, wa, telegram, qr, health } = buildService();
    const order: string[] = [];
    const settle = <T>(name: string, value: T): Promise<T> =>
      new Promise((resolve) => {
        setTimeout(() => {
          order.push(name);
          resolve(value);
        }, 10);
      });
    wa.getForHotel.mockReturnValue(settle('wa', WA_VIEW));
    telegram.getForHotel.mockReturnValue(settle('telegram', TELEGRAM_VIEW));
    qr.getForHotel.mockReturnValue(settle('qr', QR_VIEW));
    health.getSnapshot.mockReturnValue(settle('health', HEALTH_VIEW));

    await service.getForHotel(HOTEL_ID);

    // All four should have started before any resolved (parallel).
    expect(wa.getForHotel).toHaveBeenCalledTimes(1);
    expect(telegram.getForHotel).toHaveBeenCalledTimes(1);
    expect(qr.getForHotel).toHaveBeenCalledTimes(1);
    expect(health.getSnapshot).toHaveBeenCalledTimes(1);
    expect(order).toHaveLength(4);
  });
});

describe('IntegrationOverviewService.getForHotel — per-subsystem null handling', () => {
  it('should carry through null WA when the port returns null', async () => {
    const { service, wa, telegram, qr, health } = buildService();
    wa.getForHotel.mockResolvedValue(null);
    telegram.getForHotel.mockResolvedValue(TELEGRAM_VIEW);
    qr.getForHotel.mockResolvedValue(QR_VIEW);
    health.getSnapshot.mockResolvedValue(HEALTH_VIEW);

    const result = await service.getForHotel(HOTEL_ID);

    expect(result.whatsapp).toBeNull();
    expect(result.telegram).toEqual(TELEGRAM_VIEW);
  });

  it('should carry through null Telegram when the port returns null', async () => {
    const { service, wa, telegram, qr, health } = buildService();
    wa.getForHotel.mockResolvedValue(WA_VIEW);
    telegram.getForHotel.mockResolvedValue(null);
    qr.getForHotel.mockResolvedValue(QR_VIEW);
    health.getSnapshot.mockResolvedValue(HEALTH_VIEW);

    const result = await service.getForHotel(HOTEL_ID);

    expect(result.telegram).toBeNull();
  });

  it('should carry through null QR when the port returns null', async () => {
    const { service, wa, telegram, qr, health } = buildService();
    wa.getForHotel.mockResolvedValue(WA_VIEW);
    telegram.getForHotel.mockResolvedValue(TELEGRAM_VIEW);
    qr.getForHotel.mockResolvedValue(null);
    health.getSnapshot.mockResolvedValue(HEALTH_VIEW);

    const result = await service.getForHotel(HOTEL_ID);

    expect(result.qr).toBeNull();
  });
});

describe('IntegrationOverviewService.getForHotel — per-subsystem failure resilience (binding #9/#10)', () => {
  it('should null the WA field and log a structured warn when the WA port throws', async () => {
    const { service, wa, telegram, qr, health, logger } = buildService();
    wa.getForHotel.mockRejectedValue(new Error('WA down'));
    telegram.getForHotel.mockResolvedValue(TELEGRAM_VIEW);
    qr.getForHotel.mockResolvedValue(QR_VIEW);
    health.getSnapshot.mockResolvedValue(HEALTH_VIEW);

    const result = await service.getForHotel(HOTEL_ID);

    expect(result.whatsapp).toBeNull();
    expect(result.telegram).toEqual(TELEGRAM_VIEW);
    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({
        msg: 'integration_overview.subsystem_read_failed',
        subsystem: 'whatsapp',
        hotelId: HOTEL_ID,
      }),
    );
    const logged = logger.warn.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(JSON.stringify(logged)).not.toContain('WA down');
  });

  it('should null the Telegram field when its port throws', async () => {
    const { service, wa, telegram, qr, health } = buildService();
    wa.getForHotel.mockResolvedValue(WA_VIEW);
    telegram.getForHotel.mockRejectedValue(new Error('boom'));
    qr.getForHotel.mockResolvedValue(QR_VIEW);
    health.getSnapshot.mockResolvedValue(HEALTH_VIEW);

    const result = await service.getForHotel(HOTEL_ID);

    expect(result.telegram).toBeNull();
  });

  it('should null the QR field when its port throws', async () => {
    const { service, wa, telegram, qr, health } = buildService();
    wa.getForHotel.mockResolvedValue(WA_VIEW);
    telegram.getForHotel.mockResolvedValue(TELEGRAM_VIEW);
    qr.getForHotel.mockRejectedValue(new Error('boom'));
    health.getSnapshot.mockResolvedValue(HEALTH_VIEW);

    const result = await service.getForHotel(HOTEL_ID);

    expect(result.qr).toBeNull();
  });

  it('should return a synthetic-down health snapshot when the health port throws (binding #11)', async () => {
    const { service, wa, telegram, qr, health, logger } = buildService();
    wa.getForHotel.mockResolvedValue(WA_VIEW);
    telegram.getForHotel.mockResolvedValue(TELEGRAM_VIEW);
    qr.getForHotel.mockResolvedValue(QR_VIEW);
    health.getSnapshot.mockRejectedValue(new Error('probe worker crashed'));

    const result = await service.getForHotel(HOTEL_ID);

    expect(result.health).toEqual({
      whatsapp: { status: 'down' },
      telegram: { status: 'down' },
      claudeApi: { status: 'down', lastCheckAt: NOW.toISOString() },
    });
    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({
        msg: 'integration_overview.subsystem_read_failed',
        subsystem: 'health',
      }),
    );
  });

  it('should surface a named error class as the errCode in the log line', async () => {
    class WaTimeout extends Error {
      override name = 'WaTimeout';
    }
    const { service, wa, telegram, qr, health, logger } = buildService();
    wa.getForHotel.mockRejectedValue(new WaTimeout('read timeout'));
    telegram.getForHotel.mockResolvedValue(TELEGRAM_VIEW);
    qr.getForHotel.mockResolvedValue(QR_VIEW);
    health.getSnapshot.mockResolvedValue(HEALTH_VIEW);

    await service.getForHotel(HOTEL_ID);

    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({ subsystem: 'whatsapp', errCode: 'WaTimeout' }),
    );
  });

  it('should keep all other subsystems intact when a single one throws (aggregate does not reject)', async () => {
    const { service, wa, telegram, qr, health } = buildService();
    wa.getForHotel.mockRejectedValue(new Error('a'));
    telegram.getForHotel.mockRejectedValue(new Error('b'));
    qr.getForHotel.mockResolvedValue(QR_VIEW);
    health.getSnapshot.mockResolvedValue(HEALTH_VIEW);

    const result = await service.getForHotel(HOTEL_ID);

    expect(result.whatsapp).toBeNull();
    expect(result.telegram).toBeNull();
    expect(result.qr).toEqual(QR_VIEW);
    expect(result.health).toEqual(HEALTH_VIEW);
  });
});
