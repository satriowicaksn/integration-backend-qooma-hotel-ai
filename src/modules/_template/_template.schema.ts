// zod schema = source of truth runtime + compile-time type.
// Lihat docs/MODULE_TEMPLATE.md §3 untuk pola.

import { z } from 'zod';

export const ExampleRequestSchema = z.object({
  // TODO(qooma): definisikan field sesuai kebutuhan
  // Contoh:
  // departmentCode: z.enum(['FO', 'HSK', 'FNB', 'ENG', 'CON']),
  // title: z.string().min(1).max(500),
});

export type ExampleRequestDto = z.infer<typeof ExampleRequestSchema>;

export const ExampleResponseSchema = z.object({
  id: z.string().uuid(),
  // ...
});

export type ExampleResponseDto = z.infer<typeof ExampleResponseSchema>;
