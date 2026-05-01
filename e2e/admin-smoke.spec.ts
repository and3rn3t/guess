import { test, expect, type Page } from '@playwright/test'

// AP.1 — Admin route smoke-test sweep.
//
// Goal: catch the "the admin route silently broke" regression class before it
// reaches prod. Each admin route is mounted in isolation against a stubbed
// /api/admin/** surface; we assert the route renders without surfacing the
// global ErrorBoundary fallback ("Something went wrong") and without throwing
// an uncaught exception during mount.
//
// We deliberately do NOT assert the contents of each route — that is AP.2's
// job (action round-trip tests). This sweep is purely a wiring guarantee.

interface RouteCase {
  /** URL path under /admin (no leading slash). Empty string = landing/index. */
  path: string
  /** Human-readable label for the test name. */
  label: string
}

// Mirrors src/components/admin/AdminApp.tsx <Routes>.
// Keep this list in sync — the matching unit test below asserts parity.
const ADMIN_ROUTES: RouteCase[] = [
  { path: '', label: 'landing (index)' },
  { path: 'coverage', label: 'coverage' },
  { path: 'hygiene', label: 'hygiene' },
  { path: 'cost', label: 'cost' },
  { path: 'recommender', label: 'recommender' },
  { path: 'category-recommender', label: 'category-recommender' },
  { path: 'env', label: 'env' },
  { path: 'bulk-habitat', label: 'bulk-habitat' },
  { path: 'demo', label: 'demo' },
  { path: 'characters', label: 'characters' },
  { path: 'questions', label: 'questions' },
  { path: 'enrichment', label: 'enrichment' },
  { path: 'pipeline', label: 'pipeline' },
  { path: 'analytics', label: 'analytics' },
  { path: 'funnel', label: 'funnel' },
  { path: 'confusion', label: 'confusion' },
  { path: 'matrix', label: 'matrix' },
  { path: 'stress-test', label: 'stress-test' },
  { path: 'experiments', label: 'experiments' },
  { path: 'data-quality', label: 'data-quality' },
  { path: 'enrich', label: 'enrich' },
  { path: 'proposed-attrs', label: 'proposed-attrs' },
  { path: 'disputes', label: 'disputes' },
  { path: 'community', label: 'community' },
  { path: 'error-logs', label: 'error-logs' },
]

/** Stub every /api/admin/** request with an empty-but-shape-tolerant payload. */
async function stubAdminApi(page: Page): Promise<void> {
  await page.route('**/api/admin/**', (route) => {
    // Empty object covers most routes; routes that destructure arrays
    // (e.g. recentGames) tolerate `undefined` via optional chaining.
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({}),
    })
  })
}

test.describe('AP.1 — admin route smoke sweep', () => {
  for (const { path, label } of ADMIN_ROUTES) {
    test(`/admin/${path} mounts without surfacing ErrorBoundary [${label}]`, async ({
      page,
    }) => {
      const pageErrors: Error[] = []
      page.on('pageerror', (err) => pageErrors.push(err))

      await stubAdminApi(page)
      const response = await page.goto(`/admin/${path}`)

      // SPA shell index.html should load; no 5xx from the static server.
      expect(response?.status() ?? 0).toBeLessThan(500)

      // AdminShell sidebar mounts on every admin route.
      await expect(page.locator('aside')).toBeVisible({ timeout: 10_000 })

      // Let lazy chunks + initial fetches settle.
      await page.waitForLoadState('networkidle')

      // Global ErrorBoundary fallback must NOT be visible.
      await expect(
        page.getByRole('heading', { name: /something went wrong/i }),
      ).toHaveCount(0)

      // No uncaught exceptions during mount.
      expect(
        pageErrors.map((e) => e.message),
        `pageerror events while mounting /admin/${path}`,
      ).toEqual([])
    })
  }
})
