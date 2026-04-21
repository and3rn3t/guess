import { defineConfig } from 'vitest/config'
import { resolve } from 'path'

export default defineConfig({
  resolve: {
    alias: {
      '@': resolve(import.meta.dirname, 'src'),
    },
  },
  test: {
    include: [
      'src/**/*.test.ts',
      'src/**/*.test.tsx',
      'functions/**/*.test.ts',
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      // Focus coverage on business logic; React components are covered by Playwright e2e
      include: ['src/lib/**', 'src/hooks/**', 'functions/api/v2/_*.ts'],
      exclude: [
        'src/components/ui/**',
        // Cloudflare Workers route handlers require the Workers runtime and cannot be unit tested
        'functions/api/*.ts',
        'functions/api/admin/**',
        'functions/api/images/**',
        'functions/api/v2/game/**',
        'functions/api/v2/attributes.ts',
        'functions/api/v2/characters.ts',
        'functions/api/v2/history.ts',
        'functions/api/v2/questions.ts',
        'functions/api/v2/stats.ts',
      ],
      thresholds: {
        lines: 65,
        branches: 54,
        functions: 65,
      },
    },
    // Component tests use jsdom, unit tests use node
    environmentMatchGlobs: [
      ['src/components/**', 'jsdom'],
      ['src/hooks/**', 'jsdom'],
    ],
    setupFiles: ['src/test/setup.ts'],
  },
})
