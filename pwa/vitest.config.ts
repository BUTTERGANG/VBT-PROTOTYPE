// pwa/vitest.config.ts — local Vitest config for the PWA vision services.
// (The repo-root ../vitest.config.ts can't resolve 'vitest/config' because
// node_modules lives under pwa/.)
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
