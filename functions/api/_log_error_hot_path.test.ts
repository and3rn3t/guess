/**
 * PI.3 hot-path regression: ensure no request handler under `functions/api/`
 * blocks the response on `logError(...)`.
 *
 * `logError` writes to D1 (INSERT + DELETE batch); awaiting it on the hot
 * path couples response latency to D1 latency and risks bubbling D1 failures
 * up as 500s. The contract is:
 *
 *   - Fire-and-forget on the request path:    context.waitUntil(logError(...))
 *   - Bare call is acceptable for sync handlers that don't have ctx in scope.
 *   - Cron / admin / hygiene jobs may await — they run off the user request.
 *
 * This test walks the filesystem and rejects any new `await logError(...)`
 * outside the explicit allowlist.
 */

import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const FUNCTIONS_API_ROOT = join(__dirname)
const REPO_ROOT = join(__dirname, '..', '..')

/**
 * Files allowed to use `await logError(...)`. These run off the user request
 * path (cron jobs, admin hygiene tasks, background workers). Adding a file
 * here is OK if you can show the call site is not part of a request handler
 * whose Response the user is waiting on.
 */
const ALLOWED_AWAITED_LOG_ERROR: ReadonlySet<string> = new Set([
  // Admin hygiene jobs (run by curators, not players).
  'admin/hygiene-attributes.ts',
  'admin/hygiene-categories.ts',
  'admin/hygiene-duplicates.ts',
  'admin/hygiene-question-scores.ts',
  'admin/recommender.ts',
])

/** All `.ts` files under `functions/api/`, excluding tests + admin helpers. */
function collectHandlerFiles(dir: string, files: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === '__tests__' || entry === 'node_modules') continue
    const full = join(dir, entry)
    const stat = statSync(full)
    if (stat.isDirectory()) {
      collectHandlerFiles(full, files)
      continue
    }
    if (!entry.endsWith('.ts')) continue
    if (entry.endsWith('.test.ts')) continue
    files.push(full)
  }
  return files
}

const AWAIT_LOG_ERROR_RE = /\bawait\s+logError\s*\(/g

describe('PI.3 hot-path regression: await logError', () => {
  const handlerFiles = collectHandlerFiles(FUNCTIONS_API_ROOT)

  it('finds handler files to audit', () => {
    expect(handlerFiles.length).toBeGreaterThan(20)
  })

  it('no request-path handler awaits logError outside the allowlist', () => {
    const offenders: string[] = []
    for (const file of handlerFiles) {
      const rel = relative(FUNCTIONS_API_ROOT, file)
      if (ALLOWED_AWAITED_LOG_ERROR.has(rel)) continue
      const src = readFileSync(file, 'utf8')
      if (AWAIT_LOG_ERROR_RE.test(src)) {
        offenders.push(rel)
      }
    }
    expect(
      offenders,
      `Use context.waitUntil(logError(...)) on the request path so D1 latency cannot block responses (PI.3). Add to ALLOWED_AWAITED_LOG_ERROR only for cron/admin/hygiene files that aren't part of a user-facing request.`,
    ).toEqual([])
  })

  it('allowlist entries still exist on disk', () => {
    for (const rel of ALLOWED_AWAITED_LOG_ERROR) {
      const full = join(FUNCTIONS_API_ROOT, rel)
      expect(() => statSync(full), `Allowlisted file missing: ${rel}`).not.toThrow()
    }
  })

  it('repo root is resolvable (sanity)', () => {
    expect(() => statSync(REPO_ROOT)).not.toThrow()
  })
})
