// Real-Postgres integration test for T17 repository.
//
// Setup expectation (CI: Actions services + `pnpm prisma:migrate:deploy`;
// local: `make start` boots docker-compose Postgres, then
// `pnpm prisma:migrate:dev`). If `DATABASE_URL` is not set the suite
// skips — matches the T17-followup + Q-C-01 workflow.

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from '@jest/globals';
import type { PrismaClient } from '@prisma/client';

import { resetConfigCache } from '@core/config/env.js';

import { TelegramConfigRepository } from '../telegram.repository.js';

const HOTEL_ID = '11111111-2222-3333-4444-555555555555';

const runOrSkip = process.env['DATABASE_URL'] ? describe : describe.skip;

runOrSkip('TelegramConfigRepository (integration)', () => {
  let savedEnv: NodeJS.ProcessEnv;
  let db: PrismaClient;

  beforeAll(async () => {
    savedEnv = { ...process.env };
    process.env['NODE_ENV'] ??= 'development';
    process.env['API_BASE_URL'] ??= 'http://localhost:3000';
    process.env['CORS_ORIGIN'] ??= 'http://localhost:5173';
    process.env['REDIS_URL'] ??= 'redis://localhost:6380';
    process.env['JWT_ACCESS_SECRET'] ??= 'x'.repeat(48);
    process.env['JWT_REFRESH_SECRET'] ??= 'y'.repeat(48);
    process.env['ENCRYPTION_KEY'] ??= 'a'.repeat(64);
    process.env['ENCRYPTION_KEY_VERSION'] ??= 'v1';
    resetConfigCache();

    const module = await import('@core/prisma/prisma-client.js');
    db = module.db;
  });

  afterAll(async () => {
    if (db) await db.$disconnect();
    process.env = savedEnv;
    resetConfigCache();
  });

  beforeEach(async () => {
    await db.telegramConfig.deleteMany({});
  });

  afterEach(async () => {
    await db.telegramConfig.deleteMany({});
  });

  it('should return null when no config exists for the hotel', async () => {
    const repo = new TelegramConfigRepository(db);

    const result = await repo.findByHotelId(HOTEL_ID);

    expect(result).toBeNull();
  });

  it('should insert a new row on first upsert and roundtrip via findByHotelId', async () => {
    const repo = new TelegramConfigRepository(db);

    const created = await repo.upsert(HOTEL_ID, {
      botTokenEnc: 'v1:iv:ct:tag',
      botUsername: 'qooma_demo_bot',
      defaultChatId: '-100999',
      gmTelegramId: null,
      webhookUrl: null,
    });

    expect(created.hotelId).toBe(HOTEL_ID);
    expect(created.botUsername).toBe('qooma_demo_bot');
    expect(created.defaultChatId).toBe('-100999');

    const fetched = await repo.findByHotelId(HOTEL_ID);
    expect(fetched).toEqual(created);
  });

  it('should overwrite fields on second upsert and preserve the hotel_id PK', async () => {
    const repo = new TelegramConfigRepository(db);
    await repo.upsert(HOTEL_ID, {
      botTokenEnc: 'v1:first:ct:tag',
      botUsername: 'first_bot',
      defaultChatId: '-100AAA',
      gmTelegramId: null,
      webhookUrl: null,
    });

    const updated = await repo.upsert(HOTEL_ID, {
      botTokenEnc: 'v1:second:ct:tag',
      botUsername: 'second_bot',
      defaultChatId: '-100BBB',
      gmTelegramId: '99',
      webhookUrl: 'https://cdn.example.com/hook',
    });

    expect(updated.hotelId).toBe(HOTEL_ID);
    expect(updated.botUsername).toBe('second_bot');
    expect(updated.botTokenEnc).toBe('v1:second:ct:tag');
    expect(updated.defaultChatId).toBe('-100BBB');
    expect(updated.gmTelegramId).toBe('99');
    expect(updated.webhookUrl).toBe('https://cdn.example.com/hook');

    const rowCount = await db.telegramConfig.count({ where: { hotelId: HOTEL_ID } });
    expect(rowCount).toBe(1);
  });
});
