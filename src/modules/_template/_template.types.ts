// Domain types lokal modul. Bukan dari zod (zod schema = wire types).

// TODO(boilerplate): definisikan domain types sesuai modul.

export type ExampleStatus = 'active' | 'archived';

export interface ExampleDomain {
  readonly id: string;
  readonly name: string;
  readonly status: ExampleStatus;
  readonly createdAt: Date;
}
