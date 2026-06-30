/**
 * Entrypoint: Bull queue worker process.
 *
 * Tanggung jawab:
 * - Register Bull queues + processors dari semua modul
 * - Scheduler untuk job berulang (kalau ada)
 * - Graceful drain saat SIGTERM
 */

export {}; // ESM module marker

// TODO(boilerplate): implementasi setelah Bull queue factory siap.

async function main(): Promise<void> {
  // const config = loadConfig();
  // const logger = createLogger({ service: 'worker', level: config.LOG_LEVEL });
  // const services = await buildServices(config);
  //
  // // Register processors
  // fooQueue.process('process_something', config.WORKER_CONCURRENCY_DEFAULT, fooProcessor);
  //
  // // Schedule repeatable jobs
  // await fooQueue.add('process_something', {}, { repeat: { cron: '0 * * * *' } });
  //
  // process.on('SIGTERM', async () => {
  //   logger.info('SIGTERM received, draining queues...');
  //   await fooQueue.close();
  //   process.exit(0);
  // });
  //
  // logger.info('[worker] Started');

  console.warn('[worker] Entrypoint stub — implementasi setelah core/queue siap.');
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('Fatal worker error:', err);
  process.exit(1);
});
