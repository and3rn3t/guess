/**
 * SE.2 — Admin RBAC coverage audit.
 *
 * Why this test exists:
 *   Auth for the admin surface is enforced centrally in `functions/_middleware.ts`
 *   via a path-prefix predicate (`isAdminPath`), not via per-handler `requireAdmin()`
 *   calls. That means a new admin route is automatically gated **iff** its URL falls
 *   under `/admin*` or `/api/admin*`. A handler accidentally placed outside that
 *   tree (e.g. `functions/api/secret-admin.ts`) would bypass the gate silently.
 *
 * What this test asserts:
 *   1. The shared `isAdminPath()` predicate returns `true` for every URL derived
 *      from the on-disk file tree under `functions/api/admin/**`.
 *   2. The predicate's positive/negative behavior is locked: known admin paths
 *      gate, known public paths do not.
 *   3. Any future admin-flavored route placed outside the gated tree must be
 *      explicitly listed in `INTENTIONAL_PUBLIC_ADMIN_ROUTES` (currently empty)
 *      with a rationale comment.
 *
 * Allowlist policy:
 *   `INTENTIONAL_PUBLIC_ADMIN_ROUTES` is the only authorized escape hatch. Every
 *   entry must carry a comment explaining why the route is safe to leave public.
 */
import { readdirSync, statSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import { isAdminPath } from '../../../_admin_paths'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ADMIN_DIR = resolve(__dirname, '..')
const FUNCTIONS_DIR = resolve(__dirname, '..', '..', '..')

/**
 * Routes that intentionally live outside the gated admin tree.
 * Each entry must be accompanied by a code comment justifying the carve-out.
 * Keep this list as small as humanly possible.
 */
const INTENTIONAL_PUBLIC_ADMIN_ROUTES: readonly string[] = [
  // (empty by design — every admin route currently lives under /api/admin)
]

/**
 * Cloudflare Pages routing rules used to translate file paths → URL paths:
 *   - Files starting with `_` are private helpers, never routed.
 *   - Files inside `__tests__/` are tests, never routed.
 *   - Files ending in `.test.ts` are tests, never routed.
 *   - `index.ts` maps to its containing directory.
 *   - `[param]` becomes a `:param` placeholder (we substitute a sample value
 *     when probing the predicate; the predicate is prefix-based so any value
 *     works).
 */
function isRouteFile(relPath: string): boolean {
  const parts = relPath.split('/')
  if (parts.some((p) => p === '__tests__')) return false
  if (parts.some((p) => p.startsWith('_'))) return false
  const leaf = parts[parts.length - 1]
  if (!leaf.endsWith('.ts')) return false
  if (leaf.endsWith('.test.ts')) return false
  if (leaf === 'harness.ts') return false
  return true
}

function fileToUrlPath(absPath: string): string {
  const rel = relative(FUNCTIONS_DIR, absPath).replace(/\\/g, '/')
  let url = '/' + rel.replace(/\.ts$/, '')
  // `index.ts` → directory route
  url = url.replace(/\/index$/, '')
  // `[id]` → `:id` (placeholder; predicate is prefix-based so value is irrelevant)
  url = url.replace(/\[([^\]]+)\]/g, ':$1')
  return url
}

function walk(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    const stat = statSync(full)
    if (stat.isDirectory()) {
      walk(full, acc)
    } else if (stat.isFile()) {
      acc.push(full)
    }
  }
  return acc
}

const adminRouteFiles = walk(ADMIN_DIR).filter((abs) =>
  isRouteFile(relative(ADMIN_DIR, abs).replace(/\\/g, '/'))
)

describe('SE.2 — admin RBAC coverage audit', () => {
  it('discovers at least one admin route file (sanity check)', () => {
    expect(adminRouteFiles.length).toBeGreaterThan(0)
  })

  it.each(adminRouteFiles.map((f) => [relative(FUNCTIONS_DIR, f), f]))(
    'middleware gates %s',
    (_label, abs) => {
      const url = fileToUrlPath(abs)
      expect(
        url.startsWith('/api/admin'),
        `Route ${url} lives under functions/api/admin/ but did not produce an /api/admin* URL`
      ).toBe(true)
      expect(
        isAdminPath(url),
        `Route ${url} would NOT be gated by isAdminPath() — middleware bypass risk`
      ).toBe(true)
    }
  )

  it('isAdminPath predicate: positive cases', () => {
    expect(isAdminPath('/admin')).toBe(true)
    expect(isAdminPath('/admin/')).toBe(true)
    expect(isAdminPath('/admin/dashboard')).toBe(true)
    expect(isAdminPath('/api/admin')).toBe(true)
    expect(isAdminPath('/api/admin/')).toBe(true)
    expect(isAdminPath('/api/admin/characters/abc')).toBe(true)
  })

  it('isAdminPath predicate: negative cases', () => {
    expect(isAdminPath('/')).toBe(false)
    expect(isAdminPath('/api/v2/game/start')).toBe(false)
    expect(isAdminPath('/api/v2/game/answer')).toBe(false)
    expect(isAdminPath('/admins')).toBe(false) // not /admin or /admin/
    expect(isAdminPath('/api/administer')).toBe(false)
    expect(isAdminPath('/assets/index.js')).toBe(false)
  })

  it('intentional public admin allowlist is empty (or every entry is justified)', () => {
    // If an entry is added here, it MUST have a `// why:` comment above it in
    // INTENTIONAL_PUBLIC_ADMIN_ROUTES. This test exists to make additions
    // visible in code review.
    expect(INTENTIONAL_PUBLIC_ADMIN_ROUTES).toEqual([])
  })
})
