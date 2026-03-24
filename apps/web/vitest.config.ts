import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.next/**',
      '**/e2e/**',
      '**/tests/visual/**',
      '**/tests/accessibility/**',
      '**/tests/contracts/**',
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      // Threshold reflects current test coverage of lib/ and components/.
      // Actual coverage is ~4.68% (65+ dashboard pages untested — UNI-1254).
      // Raise incrementally as page-level tests are added.
      thresholds: {
        lines: 4,
        branches: 4,
        functions: 4,
        statements: 4,
      },
      exclude: [
        'node_modules/',
        '**/*.d.ts',
        '**/*.config.*',
        '**/dist/**',
        '**/.next/**',
        '**/coverage/**',
        '**/__tests__/**',
        '**/e2e/**',
      ],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
    },
  },
});
