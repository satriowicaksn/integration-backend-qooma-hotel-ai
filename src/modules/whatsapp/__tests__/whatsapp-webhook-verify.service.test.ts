/**
 * `WhatsappWebhookVerifyService` unit tests. All 3 boundaries mocked at
 * class-shape level (T10 config service, verify repo, pinger port). No
 * Prisma / no crypto / no env-key seeding needed at this layer (T11 has no
 * plaintext secrets in-flow — webhook_url is public per spec).
 */

import { describe, expect, it, jest } from '@jest/globals';

import { NotFoundError } from '@core/errors/app-errors.js';
import type { Logger } from '@core/logger/logger.js';

import type { WebhookPingerPort } from '../ports/webhook-pinger.port.js';
import type { WhatsappConfigService } from '../whatsapp-config.service.js';
import type { WhatsappConfigDomain } from '../whatsapp-config.types.js';
import type { WhatsappWebhookVerifyRepository } from '../whatsapp-webhook-verify.repository.js';
import { WhatsappWebhookVerifyService } from '../whatsapp-webhook-verify.service.js';

const HOTEL_ID = '11111111-2222-3333-4444-555555555555';
const WEBHOOK_URL = 'https://hotel.example.com/webhook/whatsapp/abc';

const sampleConfig: WhatsappConfigDomain = {
  hotelId: HOTEL_ID,
  bsp: '1engage',
  phoneNumberId: '1234567890',
  phoneNumber: '+6281234567890',
  accessToken: '***890',
  webhookUrl: WEBHOOK_URL,
  webhookVerifyToken: '***abc',
  verifiedAt: null,
  createdAt: new Date('2026-07-04T00:00:00Z'),
  updatedAt: new Date('2026-07-04T00:00:00Z'),
};

interface ConfigServiceDouble {
  getForHotel: jest.Mock;
}
interface PingerDouble {
  ping: jest.Mock;
}
interface RepoDouble {
  markVerified: jest.Mock;
}

function createConfigServiceDouble(): {
  service: WhatsappConfigService;
  double: ConfigServiceDouble;
} {
  const double: ConfigServiceDouble = { getForHotel: jest.fn() };
  return { service: double as unknown as WhatsappConfigService, double };
}
function createPingerDouble(): { port: WebhookPingerPort; double: PingerDouble } {
  const double: PingerDouble = { ping: jest.fn() };
  return { port: double as unknown as WebhookPingerPort, double };
}
function createRepoDouble(): {
  repo: WhatsappWebhookVerifyRepository;
  double: RepoDouble;
} {
  const double: RepoDouble = { markVerified: jest.fn() };
  return { repo: double as unknown as WhatsappWebhookVerifyRepository, double };
}
function createLoggerSpy(): Logger & {
  info: jest.Mock;
  debug: jest.Mock;
  warn: jest.Mock;
  error: jest.Mock;
} {
  return {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };
}

describe('WhatsappWebhookVerifyService.verifyForHotel — reachable branch', () => {
  it('should mark the config verified and return verified=true with statusCode when the probe is reachable', async () => {
    const { service: configService, double: configDouble } = createConfigServiceDouble();
    const { port: pinger, double: pingerDouble } = createPingerDouble();
    const { repo, double: repoDouble } = createRepoDouble();
    configDouble.getForHotel.mockResolvedValue(sampleConfig);
    pingerDouble.ping.mockResolvedValue({ reachable: true, statusCode: 200 });
    repoDouble.markVerified.mockResolvedValue({});
    const service = new WhatsappWebhookVerifyService(
      configService,
      pinger,
      repo,
      createLoggerSpy(),
    );

    const result = await service.verifyForHotel(HOTEL_ID);

    expect(result.verified).toBe(true);
    expect(result.outcome).toBe('verified');
    expect(result.statusCode).toBe(200);
    expect(result.verifiedAt).toBeInstanceOf(Date);
    expect(result.hotelId).toBe(HOTEL_ID);
  });

  it('should call markVerified with the hotelId and a Date object (not a string) when reachable', async () => {
    const { service: configService, double: configDouble } = createConfigServiceDouble();
    const { port: pinger, double: pingerDouble } = createPingerDouble();
    const { repo, double: repoDouble } = createRepoDouble();
    configDouble.getForHotel.mockResolvedValue(sampleConfig);
    pingerDouble.ping.mockResolvedValue({ reachable: true, statusCode: 200 });
    repoDouble.markVerified.mockResolvedValue({});
    const service = new WhatsappWebhookVerifyService(
      configService,
      pinger,
      repo,
      createLoggerSpy(),
    );

    await service.verifyForHotel(HOTEL_ID);

    expect(repoDouble.markVerified).toHaveBeenCalledTimes(1);
    const [passedHotelId, passedTimestamp] = repoDouble.markVerified.mock.calls[0] as [
      string,
      unknown,
    ];
    expect(passedHotelId).toBe(HOTEL_ID);
    expect(passedTimestamp).toBeInstanceOf(Date);
  });

  it('should ping the URL returned by the config service', async () => {
    const { service: configService, double: configDouble } = createConfigServiceDouble();
    const { port: pinger, double: pingerDouble } = createPingerDouble();
    const { repo, double: repoDouble } = createRepoDouble();
    configDouble.getForHotel.mockResolvedValue(sampleConfig);
    pingerDouble.ping.mockResolvedValue({ reachable: true, statusCode: 200 });
    repoDouble.markVerified.mockResolvedValue({});
    const service = new WhatsappWebhookVerifyService(
      configService,
      pinger,
      repo,
      createLoggerSpy(),
    );

    await service.verifyForHotel(HOTEL_ID);

    expect(pingerDouble.ping).toHaveBeenCalledWith({ url: WEBHOOK_URL });
  });

  it('should omit statusCode from the result AND the log when the pinger returned reachable=true without a statusCode', async () => {
    const { service: configService, double: configDouble } = createConfigServiceDouble();
    const { port: pinger, double: pingerDouble } = createPingerDouble();
    const { repo, double: repoDouble } = createRepoDouble();
    configDouble.getForHotel.mockResolvedValue(sampleConfig);
    pingerDouble.ping.mockResolvedValue({ reachable: true });
    repoDouble.markVerified.mockResolvedValue({});
    const logger = createLoggerSpy();
    const service = new WhatsappWebhookVerifyService(configService, pinger, repo, logger);

    const result = await service.verifyForHotel(HOTEL_ID);

    expect(result.verified).toBe(true);
    expect(result.outcome).toBe('verified');
    expect(result.statusCode).toBeUndefined();
    expect(Object.keys(result)).not.toContain('statusCode');
    const logged = logger.info.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(Object.keys(logged)).not.toContain('statusCode');
  });
});

describe('WhatsappWebhookVerifyService.verifyForHotel — unreachable branch (network error)', () => {
  it('should return verified=false with outcome=unreachable when the pinger returns statusCode undefined', async () => {
    const { service: configService, double: configDouble } = createConfigServiceDouble();
    const { port: pinger, double: pingerDouble } = createPingerDouble();
    const { repo, double: repoDouble } = createRepoDouble();
    configDouble.getForHotel.mockResolvedValue(sampleConfig);
    pingerDouble.ping.mockResolvedValue({ reachable: false });
    const service = new WhatsappWebhookVerifyService(
      configService,
      pinger,
      repo,
      createLoggerSpy(),
    );

    const result = await service.verifyForHotel(HOTEL_ID);

    expect(result.verified).toBe(false);
    expect(result.outcome).toBe('unreachable');
    expect(result.verifiedAt).toBeNull();
    expect(result.statusCode).toBeUndefined();
    expect(repoDouble.markVerified).not.toHaveBeenCalled();
  });
});

describe('WhatsappWebhookVerifyService.verifyForHotel — invalid_response branch (non-2xx)', () => {
  it('should return verified=false with outcome=invalid_response and statusCode when the hotel returned non-2xx', async () => {
    const { service: configService, double: configDouble } = createConfigServiceDouble();
    const { port: pinger, double: pingerDouble } = createPingerDouble();
    const { repo, double: repoDouble } = createRepoDouble();
    configDouble.getForHotel.mockResolvedValue(sampleConfig);
    pingerDouble.ping.mockResolvedValue({ reachable: false, statusCode: 404 });
    const service = new WhatsappWebhookVerifyService(
      configService,
      pinger,
      repo,
      createLoggerSpy(),
    );

    const result = await service.verifyForHotel(HOTEL_ID);

    expect(result.verified).toBe(false);
    expect(result.outcome).toBe('invalid_response');
    expect(result.statusCode).toBe(404);
    expect(result.verifiedAt).toBeNull();
    expect(repoDouble.markVerified).not.toHaveBeenCalled();
  });
});

describe('WhatsappWebhookVerifyService.verifyForHotel — config not found', () => {
  it('should propagate NotFoundError from WhatsappConfigService and NOT call the pinger', async () => {
    const { service: configService, double: configDouble } = createConfigServiceDouble();
    const { port: pinger, double: pingerDouble } = createPingerDouble();
    const { repo, double: repoDouble } = createRepoDouble();
    configDouble.getForHotel.mockRejectedValue(new NotFoundError('WaConfig', HOTEL_ID));
    const service = new WhatsappWebhookVerifyService(
      configService,
      pinger,
      repo,
      createLoggerSpy(),
    );

    await expect(service.verifyForHotel(HOTEL_ID)).rejects.toBeInstanceOf(NotFoundError);
    expect(pingerDouble.ping).not.toHaveBeenCalled();
    expect(repoDouble.markVerified).not.toHaveBeenCalled();
  });
});

describe('WhatsappWebhookVerifyService.verifyForHotel — log shape (positive PII floor)', () => {
  it('should log a payload containing only { msg, module, hotelId, outcome, statusCode? } and NOT spread the full config object', async () => {
    const { service: configService, double: configDouble } = createConfigServiceDouble();
    const { port: pinger, double: pingerDouble } = createPingerDouble();
    const { repo, double: repoDouble } = createRepoDouble();
    configDouble.getForHotel.mockResolvedValue(sampleConfig);
    pingerDouble.ping.mockResolvedValue({ reachable: true, statusCode: 200 });
    repoDouble.markVerified.mockResolvedValue({});
    const logger = createLoggerSpy();
    const service = new WhatsappWebhookVerifyService(configService, pinger, repo, logger);

    await service.verifyForHotel(HOTEL_ID);

    expect(logger.info).toHaveBeenCalledTimes(1);
    const logged = logger.info.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(logged).toEqual({
      msg: 'whatsapp_webhook_verify.probe',
      module: 'whatsapp',
      hotelId: HOTEL_ID,
      outcome: 'verified',
      statusCode: 200,
    });
    expect(JSON.stringify(logged).length).toBeLessThan(500);
    expect(JSON.stringify(logged)).not.toContain(sampleConfig.accessToken);
    expect(JSON.stringify(logged)).not.toContain(sampleConfig.webhookVerifyToken);
    expect(JSON.stringify(logged)).not.toContain(sampleConfig.webhookUrl);
  });

  it('should log the unreachable outcome without a statusCode field when the pinger did not return one', async () => {
    const { service: configService, double: configDouble } = createConfigServiceDouble();
    const { port: pinger, double: pingerDouble } = createPingerDouble();
    const { repo } = createRepoDouble();
    configDouble.getForHotel.mockResolvedValue(sampleConfig);
    pingerDouble.ping.mockResolvedValue({ reachable: false });
    const logger = createLoggerSpy();
    const service = new WhatsappWebhookVerifyService(configService, pinger, repo, logger);

    await service.verifyForHotel(HOTEL_ID);

    const logged = logger.info.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(logged).toEqual({
      msg: 'whatsapp_webhook_verify.probe',
      module: 'whatsapp',
      hotelId: HOTEL_ID,
      outcome: 'unreachable',
    });
    expect(Object.keys(logged)).not.toContain('statusCode');
  });
});
