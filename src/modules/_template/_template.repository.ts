// Repository: Prisma queries langsung. TIDAK pakai interface (Prisma sudah abstraksi).
// Lihat ADR-0001 untuk rationale.

// TODO(boilerplate): uncomment setelah `pnpm prisma:generate`:
// import type { PrismaClient } from '@prisma/client';

import type { ExampleDomain } from './_template.types.js';

export class ExampleRepository {
  // TODO(boilerplate): ganti dengan `private readonly db: PrismaClient` setelah prisma:generate
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  constructor(_db: any /* PrismaClient */) {}

  async findById(_id: string): Promise<ExampleDomain | null> {
    // const row = await this.db.exampleResource.findUnique({ where: { id } });
    // return row ? this.toDomain(row) : null;
    return null;
  }

  async create(_input: { name: string }): Promise<ExampleDomain> {
    // const row = await this.db.exampleResource.create({ data: input });
    // return this.toDomain(row);
    throw new Error('not implemented');
  }

  // private toDomain(row): ExampleDomain { ... }
}
