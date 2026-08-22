// vitest.config.ts — repo-root Vitest config for the PWA vision services.
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['pwa/src/**/*.test.ts'],
  },
});
