// HTTP routes. Tipis: validate → call service → return.
// zod schema sebagai Fastify schema validator.

import type { FastifyPluginAsync } from 'fastify';

import { ExampleRequestSchema, type ExampleRequestDto } from './_template.schema.js';

export const exampleRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post<{ Body: ExampleRequestDto }>(
    '/examples',
    {
      schema: {
        body: ExampleRequestSchema,
      },
    },
    async (_req, reply) => {
      // const result = await fastify.services.example.create(req.body);
      // return reply.code(201).send(result);
      return reply.code(501).send({ error: 'not_implemented' });
    },
  );
};
