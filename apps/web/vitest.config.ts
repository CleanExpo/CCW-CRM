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
      // Raise incrementally as page-level tests are added (UNI-1254).
      thresholds: {
        lines: 5,
        branches: 5,
        functions: 5,
        statements: 5,
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
