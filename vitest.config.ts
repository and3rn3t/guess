import { defineConfig } from 'vitest/config'
import { resolve } from 'path'

export default defineConfig({
  resolve: {
    alias: {
      '@': resolve(import.meta.dirname, 'src'),
      '@guess/game-engine': resolve(import.meta.dirname, 'packages/game-engine/src/index.ts'),
    },
  },
  test: {
    include: [
      'src/**/*.test.ts',
      'src/**/*.test.tsx',
      'functions/**/*.test.ts',
      'packages/**/*.test.ts',
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      // Focus coverage on business logic; React components are covered by Playwright e2e
      include: ['src/lib/**', 'src/hooks/**', 'functions/api/v2/_*.ts', 'packages/game-engine/src/**'],
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
        // Admin-only LLM tools — require live AI API, not unit testable
        'src/lib/admin/attributeRecommender.ts',
        'src/lib/admin/categoryRecommender.ts',
        'src/lib/admin/dataCleanup.ts',
        'src/lib/admin/adminApi.ts',
        // Browser-only APIs with no jest-dom equivalent
        'src/lib/sounds.ts',
        'src/lib/view-transitions.ts',
        'src/hooks/use-mobile.ts',
        'src/hooks/useGlobalStats.ts',
        'src/hooks/useSyncStatus.ts',
        'src/hooks/useWakeLock.ts',
        // Complex game-lifecycle hook — covered by Playwright e2e
        'src/hooks/useGameState.ts',
        // Barrel re-exports and pure type declarations — no runtime logic
        'packages/game-engine/src/index.ts',
        'packages/game-engine/src/types.ts',
        // Pure seed data (character/question definitions) — no runtime logic
        'src/lib/database.ts',
        'src/lib/seed/**',
      ],
      thresholds: {
        lines: 80,
        branches: 65,
        functions: 75,
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
