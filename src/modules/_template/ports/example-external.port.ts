// Port = interface untuk external IO. Service consume INI, bukan adapter konkret.
// Lihat CLAUDE.md §5 untuk aturan kapan WAJIB pakai port.

export interface ExampleExternalPort {
  notify(input: { id: string }): Promise<{ acknowledged: boolean }>;
}

// Symbol untuk DI keyed lookup (opsional). Default kita manual wiring di entrypoint.
export const EXAMPLE_EXTERNAL_PORT = Symbol('ExampleExternalPort');
