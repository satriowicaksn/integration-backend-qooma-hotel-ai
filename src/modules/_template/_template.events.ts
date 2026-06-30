// Type-safe event definitions. Emit lewat @core/events EventEmitter.

export type ExampleEvents = {
  'example.created': { id: string; name: string };
  'example.archived': { id: string; reason: string };
};
