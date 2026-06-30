// Service: business logic orchestrator. Consume repository + ports.
// Pattern: constructor injection (manual wiring di entrypoint, no DI container).

import type { ExampleRepository } from './_template.repository.js';
import type { ExampleRequestDto } from './_template.schema.js';
import type { ExampleDomain } from './_template.types.js';
import type { ExampleExternalPort } from './ports/example-external.port.js';

export class ExampleService {
  constructor(
    private readonly repo: ExampleRepository,
    private readonly externalPort: ExampleExternalPort,
  ) {}

  async create(dto: ExampleRequestDto): Promise<ExampleDomain> {
    // TODO(boilerplate): tulis business logic
    const created = await this.repo.create({ name: 'placeholder' });
    await this.externalPort.notify({ id: created.id });
    return created;
    // suppress unused param
    void dto;
  }
}
