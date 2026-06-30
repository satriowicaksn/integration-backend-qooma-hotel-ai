// Bull job processors. Worker entrypoint register processor ini.

import type { Job } from 'bull';

export type ExampleJobData = {
  exampleId: string;
};

export const exampleProcessor = async (job: Job<ExampleJobData>): Promise<void> => {
  // TODO(boilerplate): call service untuk handle async work
  // await services.example.processAsync(job.data.exampleId);
  job; // suppress unused
};
