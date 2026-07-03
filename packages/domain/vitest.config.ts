import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    setupFiles: ['./test/setup.ts'],
    hookTimeout: 60_000,
    testTimeout: 30_000,
    // One shared in-memory MongoDB per file; run files sequentially so they
    // don't contend for ports/binaries.
    fileParallelism: false,
  },
});
