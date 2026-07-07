import { describe, expect, it, jest } from '@jest/globals';

import { ExternalServiceError, NotFoundError, ValidationError } from '@core/errors/app-errors.js';
import type { Logger } from '@core/logger/logger.js';

import type { ObjectStoragePort } from '../ports/object-storage.port.js';
import type { QrRenderRequest, QrRendererPort } from '../ports/qr-renderer.port.js';
import type { QrStateRepository } from '../qr-provisioning.repository.js';
import { objectKeyForHotel, QrService } from '../qr-provisioning.service.js';
import type { ObjectStoreLocation, QrDomain, QrRegenerateInput } from '../qr-provisioning.types.js';

const HOTEL_ID = '11111111-2222-3333-4444-555555555555';
const PHONE = '+6281234567890';
const NOW = new Date('2026-07-06T22:30:00Z');
const PNG_BYTES = Buffer.from('fake-png');

interface RepoMock {
  findByHotelId: jest.Mock<QrStateRepository['findByHotelId']>;
  upsert: jest.Mock<QrStateRepository['upsert']>;
}

interface RendererMock {
  render: jest.Mock<(req: QrRenderRequest) => Promise<Buffer>>;
}

interface StorageMock {
  uploadPng: jest.Mock<(input: { key: string; bytes: Buffer }) => Promise<ObjectStoreLocation>>;
  getPngStream: jest.Mock;
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

function buildRepoMock(): RepoMock {
  return {
    findByHotelId: jest.fn<QrStateRepository['findByHotelId']>(),
    upsert: jest.fn<QrStateRepository['upsert']>(),
  };
}

function buildRendererMock(): RendererMock {
  return { render: jest.fn<(req: QrRenderRequest) => Promise<Buffer>>() };
}

function buildStorageMock(): StorageMock {
  return {
    uploadPng: jest.fn<(input: { key: string; bytes: Buffer }) => Promise<ObjectStoreLocation>>(),
    getPngStream: jest.fn(),
  };
}

function buildDomain(overrides: Partial<QrDomain> = {}): QrDomain {
  return {
    hotelId: HOTEL_ID,
    waLink: 'https://wa.me/6281234567890',
    pngUrl: 'https://cdn.example.com/qr/hotel-1.png',
    generatedAt: NOW,
    ...overrides,
  };
}

function buildService(): {
  service: QrService;
  repo: RepoMock;
  renderer: RendererMock;
  storage: StorageMock;
  logger: LoggerMock;
} {
  const repo = buildRepoMock();
  const renderer = buildRendererMock();
  const storage = buildStorageMock();
  const logger = buildLoggerMock();
  const service = new QrService(
    repo as unknown as QrStateRepository,
    {
      renderer: renderer as unknown as QrRendererPort,
      storage: storage as unknown as ObjectStoragePort,
    },
    logger,
    { now: () => NOW },
  );
  return { service, repo, renderer, storage, logger };
}

const INPUT: QrRegenerateInput = { hotelId: HOTEL_ID, phoneNumber: PHONE };

describe('QrService.regenerate — happy path', () => {
  it('should build the wa.me URL, render 1024×1024 PNG, upload, upsert, and return the wire result', async () => {
    const { service, repo, renderer, storage } = buildService();
    renderer.render.mockResolvedValue(PNG_BYTES);
    storage.uploadPng.mockResolvedValue({
      key: `qr/${HOTEL_ID}.png`,
      publicUrl: 'https://cdn.example.com/qr/hotel-1.png',
    });
    repo.upsert.mockImplementation((input) =>
      Promise.resolve(
        buildDomain({
          waLink: input.waLink,
          pngUrl: input.pngUrl,
          generatedAt: input.generatedAt,
        }),
      ),
    );

    const result = await service.regenerate(INPUT);

    expect(renderer.render).toHaveBeenCalledWith({
      payload: 'https://wa.me/6281234567890',
      size: 1024,
    });
    expect(storage.uploadPng).toHaveBeenCalledWith({
      key: `qr/${HOTEL_ID}.png`,
      bytes: PNG_BYTES,
    });
    const upsertArg = repo.upsert.mock.calls[0]?.[0] as {
      hotelId: string;
      waLink: string;
      pngUrl: string;
      generatedAt: Date;
    };
    expect(upsertArg.hotelId).toBe(HOTEL_ID);
    expect(upsertArg.waLink).toBe('https://wa.me/6281234567890');
    expect(upsertArg.pngUrl).toBe('https://cdn.example.com/qr/hotel-1.png');
    expect(upsertArg.generatedAt).toEqual(NOW);
    expect(result).toEqual({
      url: 'https://wa.me/6281234567890',
      pngUrl: 'https://cdn.example.com/qr/hotel-1.png',
      generatedAt: NOW,
    });
  });

  it('should encode the greeting into the wa.me URL when provided', async () => {
    const { service, repo, renderer, storage } = buildService();
    renderer.render.mockResolvedValue(PNG_BYTES);
    storage.uploadPng.mockResolvedValue({
      key: `qr/${HOTEL_ID}.png`,
      publicUrl: 'https://cdn.example.com/qr/hotel-1.png',
    });
    repo.upsert.mockImplementation((input) =>
      Promise.resolve(buildDomain({ waLink: input.waLink })),
    );

    await service.regenerate({ ...INPUT, greetingText: 'Halo' });

    expect(renderer.render).toHaveBeenCalledWith({
      payload: 'https://wa.me/6281234567890?text=Halo',
      size: 1024,
    });
  });
});

describe('QrService.regenerate — error mapping (PM C ACK T22 binding #6)', () => {
  it('should throw ValidationError when the composed wa.me URL exceeds 500 chars', async () => {
    const { service, repo, renderer, storage } = buildService();
    // 600 x's — after `https://wa.me/6281234567890?text=` (33 chars) the URL
    // is 633 chars, comfortably past the 500 ceiling. Service enters the
    // length check BEFORE calling renderer/storage (binding #6).
    const longGreeting = 'x'.repeat(600);

    await expect(
      service.regenerate({ ...INPUT, greetingText: longGreeting }),
    ).rejects.toBeInstanceOf(ValidationError);
    expect(renderer.render).not.toHaveBeenCalled();
    expect(storage.uploadPng).not.toHaveBeenCalled();
    expect(repo.upsert).not.toHaveBeenCalled();
  });

  it('should throw ExternalServiceError when the renderer port throws', async () => {
    const { service, repo, renderer, storage } = buildService();
    renderer.render.mockRejectedValue(new Error('qrcode boom'));

    await expect(service.regenerate(INPUT)).rejects.toBeInstanceOf(ExternalServiceError);
    expect(storage.uploadPng).not.toHaveBeenCalled();
    expect(repo.upsert).not.toHaveBeenCalled();
  });

  it('should throw ExternalServiceError when the storage upload throws', async () => {
    const { service, repo, renderer, storage } = buildService();
    renderer.render.mockResolvedValue(PNG_BYTES);
    storage.uploadPng.mockRejectedValue(new Error('s3 5xx'));

    await expect(service.regenerate(INPUT)).rejects.toBeInstanceOf(ExternalServiceError);
    expect(repo.upsert).not.toHaveBeenCalled();
  });

  it('should log a structured record after a successful regenerate (PII-clean)', async () => {
    const { service, repo, renderer, storage, logger } = buildService();
    renderer.render.mockResolvedValue(PNG_BYTES);
    storage.uploadPng.mockResolvedValue({
      key: `qr/${HOTEL_ID}.png`,
      publicUrl: 'https://cdn.example.com/qr/hotel-1.png',
    });
    repo.upsert.mockImplementation((input) =>
      Promise.resolve(buildDomain({ waLink: input.waLink, generatedAt: input.generatedAt })),
    );

    await service.regenerate(INPUT);

    expect(logger.info).toHaveBeenCalledWith(
      expect.objectContaining({
        msg: 'qr_provisioning.regenerated',
        module: 'qr-provisioning',
        hotelId: HOTEL_ID,
        objectKey: `qr/${HOTEL_ID}.png`,
      }),
    );
    const record = logger.info.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(JSON.stringify(record)).not.toContain(PHONE);
  });
});

describe('QrService.getForDownload', () => {
  it('should return { hotelId, pngUrl, generatedAt } when the qr_state row exists', async () => {
    const { service, repo } = buildService();
    repo.findByHotelId.mockResolvedValue(
      buildDomain({ pngUrl: 'https://cdn.example.com/qr/hotel-1.png' }),
    );

    const result = await service.getForDownload(HOTEL_ID);

    expect(result).toEqual({
      hotelId: HOTEL_ID,
      pngUrl: 'https://cdn.example.com/qr/hotel-1.png',
      generatedAt: NOW,
    });
  });

  it('should throw NotFoundError when the hotel has never regenerated a QR', async () => {
    const { service, repo } = buildService();
    repo.findByHotelId.mockResolvedValue(null);

    await expect(service.getForDownload(HOTEL_ID)).rejects.toBeInstanceOf(NotFoundError);
    await expect(service.getForDownload(HOTEL_ID)).rejects.toMatchObject({
      code: 'NOT_FOUND',
      details: { resource: 'qr_state', id: HOTEL_ID },
    });
  });
});

describe('objectKeyForHotel (deterministic key strategy per PM C ACK GAP #4)', () => {
  it('should return the deterministic qr/{hotelId}.png key so the route layer can match adapter uploads', () => {
    expect(objectKeyForHotel(HOTEL_ID)).toBe(`qr/${HOTEL_ID}.png`);
  });
});
