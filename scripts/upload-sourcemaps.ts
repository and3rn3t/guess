/**
 * H.4 — Source map upload to R2.
 *
 * Runs after `pnpm build`, before `wrangler pages deploy`. For every
 * `dist/assets/*.map` produced by Vite/Rollup:
 *   1. Uploads the map to the R2 `GUESS_IMAGES` bucket under
 *      `maps/{commit_sha}/{filename}` (private — served only via the admin-
 *      auth'd `/api/admin/resolve-stack` endpoint).
 *   2. Deletes the `.map` file from `dist/` so it is not shipped publicly.
 *   3. Strips the trailing `//# sourceMappingURL=` line from the matching `.js`
 *      file so browsers don't 404 chasing a missing map.
 *
 * Records the active commit SHA into KV `deploy:current-sha` so the admin
 * resolver knows which directory to read from.
 *
 * Usage (run automatically via `pnpm deploy` / `pnpm deploy:preview`):
 *   tsx scripts/upload-sourcemaps.ts --env=preview
 *   tsx scripts/upload-sourcemaps.ts --env=production
 */
import { execFileSync } from 'node:child_process'
import { readdirSync, readFileSync, statSync, unlinkSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const DIST_ASSETS = join(process.cwd(), 'dist', 'assets')

// Asset filenames are produced by Vite/Rollup and are limited to a safe
// alphabet, but we re-validate before passing them to a child process to
// satisfy CodeQL's command-injection analysis and as defense-in-depth.
const SAFE_ASSET_NAME = /^[A-Za-z0-9._-]+$/
// Git SHAs (and the COMMIT_SHA override CI may inject) are hex-only. Accept
// both the short and full form.
const SAFE_GIT_SHA = /^[0-9a-f]{7,64}$/

function assertSafeAssetName(name: string): void {
  if (!SAFE_ASSET_NAME.test(name)) {
    throw new Error(`unsafe asset filename refused: ${JSON.stringify(name)}`)
  }
}

function assertSafeSha(sha: string): void {
  if (!SAFE_GIT_SHA.test(sha)) {
    throw new Error(`unsafe commit sha refused: ${JSON.stringify(sha)}`)
  }
}

function getEnv(): 'production' | 'preview' {
  const arg = process.argv.find((a) => a.startsWith('--env='))
  const env = arg?.split('=')[1]
  if (env !== 'production' && env !== 'preview') {
    throw new Error("usage: upload-sourcemaps.ts --env=production|preview")
  }
  return env
}

function getCommitSha(): string {
  // Allow override (CI may inject COMMIT_SHA explicitly).
  const fromEnv = process.env.COMMIT_SHA?.trim()
  if (fromEnv) {
    assertSafeSha(fromEnv)
    return fromEnv
  }
  const sha = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim()
  assertSafeSha(sha)
  return sha
}

function listMapFiles(): string[] {
  try {
    return readdirSync(DIST_ASSETS).filter((f) => f.endsWith('.map'))
  } catch {
    return []
  }
}

function stripSourceMappingURL(jsPath: string): void {
  let contents: string
  try {
    contents = readFileSync(jsPath, 'utf8')
  } catch {
    return
  }
  const cleaned = contents.replace(/\n?\/\/[#@]\s*sourceMappingURL=.*\s*$/m, '')
  if (cleaned !== contents) writeFileSync(jsPath, cleaned)
}

function uploadMap(env: 'production' | 'preview', sha: string, file: string): void {
  assertSafeSha(sha)
  assertSafeAssetName(file)
  const localPath = join(DIST_ASSETS, file)
  const remoteKey = `maps/${sha}/${file}`
  // R2 is shared across envs in this project (single GUESS_IMAGES bucket); the
  // `--env` flag still selects the correct credentials/account context.
  // Use execFileSync (no shell) so the sha/filename can never be interpreted
  // as shell metacharacters even if validation upstream drifts.
  execFileSync(
    'wrangler',
    [
      'r2',
      'object',
      'put',
      `guess-images/${remoteKey}`,
      `--file=${localPath}`,
      `--env=${env}`,
      '--remote',
      '--content-type=application/json',
    ],
    { stdio: 'inherit' },
  )
}

function writeShaToKV(env: 'production' | 'preview', sha: string): void {
  assertSafeSha(sha)
  execFileSync(
    'wrangler',
    ['kv', 'key', 'put', 'deploy:current-sha', sha, '--binding=GUESS_KV', `--env=${env}`, '--remote'],
    { stdio: 'inherit' },
  )
}

function main(): void {
  const env = getEnv()
  const sha = getCommitSha()
  const maps = listMapFiles()

  if (maps.length === 0) {
    console.log('[upload-sourcemaps] no .map files in dist/assets — skipping')
    return
  }

  console.log(`[upload-sourcemaps] env=${env} sha=${sha} maps=${maps.length}`)

  for (const map of maps) {
    const fullMapPath = join(DIST_ASSETS, map)
    const stats = statSync(fullMapPath)
    console.log(`  → ${map} (${(stats.size / 1024).toFixed(1)} KB)`)
    uploadMap(env, sha, map)

    // Strip sourceMappingURL from the matching .js file (e.g. index-abc.js.map → index-abc.js).
    const jsFile = map.replace(/\.map$/, '')
    stripSourceMappingURL(join(DIST_ASSETS, jsFile))

    // Remove the map from dist so wrangler doesn't ship it publicly.
    unlinkSync(fullMapPath)
  }

  writeShaToKV(env, sha)
  console.log(`[upload-sourcemaps] ✓ uploaded ${maps.length} maps to maps/${sha}/ and recorded sha in KV`)
}

main()
