# Testing Strategy

> Untuk repo AI-driven, test = guard rail. Setiap commit tanpa test = teknologi debt yang mahal.

## 1. Filosofi

- **Test perilaku, bukan implementasi.** "When X happens, Y should result" — bukan "internal method Z is called".
- **Test sebagai dokumentasi**: pembaca test harus paham fitur tanpa baca implementasi.
- **Fast feedback**: unit test < 1 detik per file, full suite < 60 detik.
- **No mock Prisma**: mock di boundary external IO saja. Repository ditest pakai real DB (testcontainers).

## 2. Piramida test

```
                  ┌─────────────┐
                  │  E2E (sedikit)
                  │  - golden path
                  │  - critical flow
                  └─────────────┘
              ┌─────────────────────┐
              │ Integration (banyak)
              │ - repositories
              │ - module flows
              │ - DB + Redis nyata
              └─────────────────────┘
        ┌───────────────────────────────┐
        │ Unit (paling banyak)
        │ - service logic
        │ - utils
        │ - mock external port
        └───────────────────────────────┘
```

Target rasio: 70% unit, 25% integration, 5% E2E.

## 3. Tools

| Layer | Tool |
|---|---|
| Test runner | Jest 29 |
| TS preset | ts-jest ESM |
| HTTP test | Fastify `inject()` (in-process) |
| DB container | `@testcontainers/postgresql` |
| Redis container | `@testcontainers/redis` |
| HTTP mock | `nock` (untuk external API) |
| Time mock | Jest fake timers + `@sinonjs/fake-timers` |
| Snapshot | Hindari untuk business logic — eksplisit assertion |
| Coverage | Built-in Jest, threshold di `jest.config.ts` |

## 4. Unit tests

Untuk: service method, util pure functions.

### Pattern dengan mocked port

```ts
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import type { ExternalApiPort } from '../ports/external-api.port.js';

describe('FooService.create', () => {
  let externalApi: jest.Mocked<ExternalApiPort>;
  let repo: jest.Mocked<FooRepository>;
  let service: FooService;

  beforeEach(() => {
    externalApi = { send: jest.fn() };
    repo = createMockRepo();
    service = new FooService(repo, externalApi);
  });

  it('should create resource and notify external when input valid', async () => {
    repo.create.mockResolvedValue(aFoo({ id: '1' }));

    const result = await service.create({ name: 'test' });

    expect(result.id).toBe('1');
    expect(externalApi.send).toHaveBeenCalledWith({ id: '1', payload: expect.any(Object) });
  });

  it('should throw ValidationError when name empty', async () => {
    await expect(service.create({ name: '' })).rejects.toThrow(ValidationError);
  });
});
```

### Test naming

- `it('should <expected behavior> when <condition>')` — default
- Group dengan `describe('<MethodName>', ...)` per public method

## 5. Integration tests

Untuk: repository, modul yang punya side-effect (Redis cache, Bull enqueue), webhook handler end-to-end.

### Setup pattern (testcontainers)

```ts
// src/shared/utils/test-setup.ts (global)
import { PostgreSqlContainer } from '@testcontainers/postgresql';
import { GenericContainer } from 'testcontainers';

let pgContainer: StartedPostgreSqlContainer;
let redisContainer: StartedTestContainer;

beforeAll(async () => {
  pgContainer = await new PostgreSqlContainer('postgres:15-alpine').start();
  redisContainer = await new GenericContainer('redis:7-alpine')
    .withExposedPorts(6379)
    .start();

  process.env.DATABASE_URL = pgContainer.getConnectionUri();
  process.env.REDIS_URL = `redis://localhost:${redisContainer.getMappedPort(6379)}`;

  await execAsync('pnpm prisma:migrate:deploy');
}, 60_000);

afterAll(async () => {
  await pgContainer.stop();
  await redisContainer.stop();
});
```

### Repository test pattern

```ts
describe('FooRepository (integration)', () => {
  let repo: FooRepository;

  beforeEach(async () => {
    await db.exampleResource.deleteMany();
    repo = new FooRepository(db);
  });

  it('should persist and retrieve resource', async () => {
    const created = await repo.create({ name: 'test' });
    const fetched = await repo.findById(created.id);
    expect(fetched).toEqual(created);
  });
});
```

## 6. Mock external services

### HTTP external API

```ts
// src/shared/utils/test-doubles/api-mock.ts
export const mockUpstreamApi = (response: object): void => {
  nock('https://api.example.com')
    .post('/v1/notify')
    .reply(200, response);
};
```

Atau langsung mock port di unit test (preferred — lebih cepat).

## 7. Bull queue testing

### Unit (test job processor logic)

Test function processor langsung tanpa Bull:

```ts
it('should process job when valid data', async () => {
  const job = { data: { id: 'foo-1' } } as Job<FooJobData>;
  await fooProcessor(job);
  // assert
});
```

### Integration (test enqueue + dequeue dengan real Bull)

```ts
it('should retry failed call with exponential backoff', async () => {
  await fooQueue.add('process_something', data, { attempts: 3, backoff: 'exponential' });
  // simulate failure twice
  // assert third attempt succeeds
});
```

## 8. Time-dependent tests

```ts
import { useFakeTimers } from '@sinonjs/fake-timers';

it('should expire token exactly after 8 hours', async () => {
  const clock = useFakeTimers(new Date('2026-06-11T10:00:00Z').getTime());
  const token = await auth.issueToken(user);

  clock.tick(8 * 60 * 60 * 1000 + 1);
  await expect(auth.verify(token)).rejects.toThrow('expired');

  clock.uninstall();
});
```

## 9. Coverage targets

| Module category | Line | Function | Branch |
|---|---|---|---|
| Critical (auth, security-related) | 90% | 90% | 85% |
| Standard | 80% | 75% | 70% |
| Plugins, util | 85% | 85% | 80% |
| Entrypoints | exempt (smoke test) | — | — |

CI fail kalau threshold tidak tercapai (defined di `jest.config.ts`).

## 10. CI test strategy

| Job | Run | Duration target |
|---|---|---|
| `lint-and-typecheck` | every push | < 2 menit |
| `test-unit` | every push | < 3 menit |
| `test-integration` | every push (Postgres + Redis in container) | < 8 menit |
| `test-load` | manual + weekly schedule | < 30 menit |

## 11. Test data builders

Bukan fixtures statis — pakai builder pattern untuk maintainability:

```ts
export const aFoo = (overrides?: Partial<FooDomain>): FooDomain => ({
  id: 'foo-1',
  name: 'Test Foo',
  status: 'active',
  createdAt: new Date('2026-01-01'),
  ...overrides,
});
```

## 12. Anti-patterns dalam test

| ❌ | ✅ |
|---|---|
| Mock Prisma `prismaMock.user.findUnique.mockResolvedValue(...)` | Real DB via testcontainers |
| `it('test 1', ...)` | `it('should <verb> when <cond>', ...)` |
| Test sharing state via top-level `let user` tanpa reset | Setup di `beforeEach` |
| Snapshot test untuk JSON response besar | Eksplisit assertion field kunci |
| `expect(arr).toHaveLength(5)` (magic number) | `expect(arr).toEqual(expected)` |
| `setTimeout(done, 1000)` (real timer) | Fake timers |
| Skip test (`it.skip`) di main | Hapus + bikin issue |
| `expect(spy).toHaveBeenCalled()` (lemah) | `toHaveBeenCalledWith(...)` |

## 13. Local development workflow

```bash
make test-unit -- --watch          # TDD mode
make test                          # full sebelum push
make test-coverage                 # cek coverage
```

## 14. Debugging tests

- Jangan `console.log` di test final — pakai `logger.debug` (off di CI)
- Test gagal di CI tapi pass lokal? Cek: timezone (CI = UTC), locale, Node version
- Flaky test: tag `it.concurrent` salah, race condition di teardown, atau real timer leaked
