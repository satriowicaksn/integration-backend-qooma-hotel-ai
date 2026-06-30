# Module Template — Pola Standar Modul

> Setiap modul di `src/modules/<name>/` mengikuti template ini. Folder `src/modules/_template/` berisi skeleton kode siap-copy. **JANGAN edit `_template/`** — pakai sebagai referensi pola.

## 1. Struktur file per modul

### Modul standar (CRUD-ish, no external IO)

```
modules/<name>/
├── index.ts                      Barrel export public API
├── <name>.routes.ts              (opt) HTTP routes
├── <name>.service.ts             Business logic orchestrator
├── <name>.repository.ts          Prisma queries (no interface — Prisma sudah abstraksi)
├── <name>.schema.ts              zod schemas (request/response/internal)
├── <name>.types.ts               TypeScript types lokal
├── <name>.events.ts              (opt) Event names + payload types
├── <name>.jobs.ts                (opt) Bull processor definitions
└── __tests__/
    ├── <name>.service.test.ts
    └── <name>.repository.integration.test.ts
```

### Modul dengan external IO

Tambahkan:
```
├── ports/
│   ├── <thing>-sender.port.ts        Interface
│   └── <thing>-validator.port.ts
└── adapters/
    ├── vendor-x-sender.adapter.ts    Implementasi 1
    └── vendor-y-sender.adapter.ts    Implementasi 2 (jika ada)
```

## 2. Cara copy template untuk modul baru

```bash
cp -r src/modules/_template src/modules/my-new-module
cd src/modules/my-new-module
# Rename: _template.* → my-new-module.*
# Sesuaikan: edit isi, hapus port/adapter kalau tidak perlu
```

## 3. File-by-file convention

### `<name>.schema.ts`

zod schema sebagai source of truth runtime + compile-time type.

```ts
import { z } from 'zod';

export const CreateFooSchema = z.object({
  name: z.string().min(1).max(255),
  status: z.enum(['active', 'archived']).default('active'),
});
export type CreateFooDto = z.infer<typeof CreateFooSchema>;

export const FooResponseSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  status: z.string(),
  createdAt: z.coerce.date(),
});
export type FooResponse = z.infer<typeof FooResponseSchema>;
```

### `<name>.types.ts`

Types internal yang BUKAN dari zod (mis. domain object, enum).

```ts
export type FooStatus = 'active' | 'archived';

export interface FooDomain {
  readonly id: string;
  readonly name: string;
  readonly status: FooStatus;
  readonly createdAt: Date;
}
```

### `<name>.repository.ts`

Prisma client langsung. Method-method query. **No interface** (Prisma sudah jadi abstraksi).

```ts
import type { PrismaClient } from '@prisma/client';
import type { FooDomain } from './foo.types.js';

export class FooRepository {
  constructor(private readonly db: PrismaClient) {}

  async findById(id: string): Promise<FooDomain | null> {
    const row = await this.db.exampleResource.findUnique({ where: { id } });
    return row ? this.toDomain(row) : null;
  }

  async create(input: { name: string }): Promise<FooDomain> {
    const row = await this.db.exampleResource.create({ data: input });
    return this.toDomain(row);
  }

  private toDomain(row: { id: string; name: string; status: string; createdAt: Date }): FooDomain {
    return {
      id: row.id,
      name: row.name,
      status: row.status as FooStatus,
      createdAt: row.createdAt,
    };
  }
}
```

### `<name>.service.ts`

Business logic + orchestrate repository + ports + cross-module.

```ts
import type { ExternalApiPort } from './ports/external-api.port.js';
import type { FooRepository } from './foo.repository.js';
import type { CreateFooDto } from './foo.schema.js';
import type { FooDomain } from './foo.types.js';

export class FooService {
  constructor(
    private readonly repo: FooRepository,
    private readonly externalApi: ExternalApiPort,
  ) {}

  async create(dto: CreateFooDto): Promise<FooDomain> {
    const created = await this.repo.create({ name: dto.name });
    await this.externalApi.send({ id: created.id, payload: { event: 'foo.created' } });
    return created;
  }
}
```

### `<name>.routes.ts`

Tipis. Validate → call service → return.

```ts
import type { FastifyPluginAsync } from 'fastify';
import { CreateFooSchema, type CreateFooDto } from './foo.schema.js';

export const fooRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post<{ Body: CreateFooDto }>(
    '/foo',
    { schema: { body: CreateFooSchema } },
    async (req, reply) => {
      const result = await fastify.services.foo.create(req.body);
      return reply.code(201).send(result);
    },
  );
};
```

### `ports/<thing>.port.ts`

```ts
export interface ExternalApiPort {
  send(input: { id: string; payload: unknown }): Promise<{ messageId: string }>;
}

// Symbol untuk DI keyed lookup (opsional). Default: manual wiring di entrypoint.
export const EXTERNAL_API_PORT = Symbol('ExternalApiPort');
```

### `adapters/<vendor>-<thing>.adapter.ts`

```ts
import type { ExternalApiPort } from '../ports/external-api.port.js';
import type { HttpClient } from '@core/http/http-client.js';

export class VendorXAdapter implements ExternalApiPort {
  constructor(private readonly http: HttpClient, private readonly config: { baseUrl: string }) {}

  async send(input: { id: string; payload: unknown }): Promise<{ messageId: string }> {
    const res = await this.http.post(`${this.config.baseUrl}/notify`, input);
    return { messageId: res.data.id };
  }
}
```

### `<name>.events.ts`

Type-safe event definitions.

```ts
export type FooEvents = {
  'foo.created': { id: string; name: string };
  'foo.archived': { id: string; reason: string };
};
```

### `<name>.jobs.ts`

Bull processor.

```ts
import type { Job } from 'bull';

export type FooJobData = {
  fooId: string;
};

export const fooProcessor = async (job: Job<FooJobData>): Promise<void> => {
  await services.foo.processAsync(job.data.fooId);
};
```

### `index.ts` (barrel)

Hanya export public API.

```ts
export { fooRoutes } from './foo.routes.js';
export { FooService } from './foo.service.js';
export type { FooDomain, FooStatus } from './foo.types.js';
export type { FooEvents } from './foo.events.js';
// JANGAN export repository, adapter — itu internal
```

## 4. Wiring di entrypoint

Untuk `api.ts`:

```ts
const externalAdapter = new VendorXAdapter(httpClient, config.vendorX);
const fooRepo = new FooRepository(db);
const fooService = new FooService(fooRepo, externalAdapter);

fastify.decorate('services', { foo: fooService /* ... */ });
fastify.register(fooRoutes, { prefix: '/api' });
```

## 5. Testing checklist per modul

- [ ] Unit test untuk setiap public method service (mock port)
- [ ] Integration test untuk repository (testcontainers Postgres)
- [ ] Event emission verification (kalau pakai event)
- [ ] HTTP test via Fastify `inject()` untuk routes

## 6. Checklist saat buat modul baru

- [ ] Folder dibuat di `src/modules/<name>/`
- [ ] schema.ts (zod) — bahkan untuk modul kecil
- [ ] types.ts — domain types
- [ ] service.ts + repository.ts (jika perlu DB)
- [ ] routes.ts (jika expose API)
- [ ] ports/ + adapters/ (hanya kalau external IO)
- [ ] index.ts barrel
- [ ] __tests__/ dengan minimal 1 unit + 1 integration
- [ ] Wire up di entrypoint yang relevan
- [ ] Run `make check` lulus
