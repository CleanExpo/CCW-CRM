import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test-setup.ts'],
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.next/**',
      '**/e2e/**',
      '**/CCW-CRM/**',
    ],
    coverage: {
      // Scoped to src/lib because that is where the suite actually reaches.
      // Measuring the 193 route/page files as well drags the global number to
      // ~3.7%, which is too coarse to ratchet against and reads as a claim
      // about the whole app that the tests do not support.
      include: ['src/lib/**/*.ts'],
      // A RATCHET, not a standard. These are the measured figures on
      // 2026-08-07 rounded down — they exist to stop coverage regressing, and
      // they are not a statement that this coverage is adequate. Raise them
      // when a change raises the real number; never lower them to go green.
      thresholds: {
        statements: 11,
        branches: 62,
        functions: 41,
        lines: 11,
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
