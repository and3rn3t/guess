#!/usr/bin/env tsx
/**
 * pnpm doctor — environment health check
 *
 * Prints a green/red checklist verifying that the dev environment is ready.
 * Exits 0 if all hard checks pass, 1 if any hard check fails.
 *
 * Usage:
 *   pnpm doctor
 */
import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const ROOT = resolve(import.meta.dirname, '..')

// ── Helpers ───────────────────────────────────────────────────────────────────

const GREEN = '\x1b[32m'
const RED = '\x1b[31m'
const YELLOW = '\x1b[33m'
const RESET = '\x1b[0m'
const BOLD = '\x1b[1m'

let anyFailed = false

function pass(label: string, detail?: string): void {
  const suffix = detail ? `  ${detail}` : ''
  console.log(`  ${GREEN}✓${RESET}  ${label}${suffix}`)
}

function fail(label: string, hint?: string): void {
  anyFailed = true
  const suffix = hint ? `\n       ${RED}→${RESET} ${hint}` : ''
  console.log(`  ${RED}✗${RESET}  ${label}${suffix}`)
}

function warn(label: string, hint?: string): void {
  const suffix = hint ? `\n       ${YELLOW}→${RESET} ${hint}` : ''
  console.log(`  ${YELLOW}⚠${RESET}  ${label}${suffix}`)
}

function run(cmd: string): { ok: boolean; stdout: string } {
  const result = spawnSync(cmd, { shell: true, encoding: 'utf8' })
  return { ok: result.status === 0, stdout: (result.stdout ?? '').trim() }
}

// ── Checks ────────────────────────────────────────────────────────────────────

console.log(`\n${BOLD}guess — environment check${RESET}\n`)

// 1. Node version ≥ 22
const nodeVersion = process.versions.node
const nodeMajor = parseInt(nodeVersion.split('.')[0], 10)
if (nodeMajor >= 22) {
  pass('Node.js', `v${nodeVersion}`)
} else {
  fail(`Node.js v${nodeVersion}`, 'Requires Node ≥ 22 — update via nvm or https://nodejs.org')
}

// 2. pnpm version matches packageManager field
const pkgJson = JSON.parse(readFileSync(resolve(ROOT, 'package.json'), 'utf8')) as {
  packageManager?: string
}
const expectedPnpm = pkgJson.packageManager?.replace('pnpm@', '') ?? null
const actualPnpm = run('pnpm --version')
if (expectedPnpm && actualPnpm.ok) {
  const actual = actualPnpm.stdout
  if (actual === expectedPnpm) {
    pass('pnpm', `v${actual}`)
  } else {
    warn(
      `pnpm v${actual} (expected v${expectedPnpm})`,
      `Run: corepack enable && corepack prepare pnpm@${expectedPnpm} --activate`,
    )
  }
} else {
  fail('pnpm not found', 'Run: npm install -g pnpm')
}

// 3. wrangler login
const wranglerWhoami = run('wrangler whoami 2>/dev/null')
if (wranglerWhoami.ok && wranglerWhoami.stdout.includes('@')) {
  const match = wranglerWhoami.stdout.match(/You are logged in.*?as\s+(.+?)(\s|$)/i)
  pass('wrangler auth', match ? match[1] : 'logged in')
} else {
  fail('wrangler not authenticated', 'Run: pnpm cf:login')
}

// 4. .dev.vars exists + required keys present
const devVarsPath = resolve(ROOT, '.dev.vars')
const requiredDevVarsKeys = ['OPENAI_API_KEY', 'ADMIN_PASSWORD']
if (existsSync(devVarsPath)) {
  const content = readFileSync(devVarsPath, 'utf8')
  const missingKeys = requiredDevVarsKeys.filter((k) => !content.includes(`${k}=`))
  if (missingKeys.length === 0) {
    pass('.dev.vars', `keys: ${requiredDevVarsKeys.join(', ')}`)
  } else {
    fail(
      `.dev.vars missing keys: ${missingKeys.join(', ')}`,
      'Copy .dev.vars.example to .dev.vars and fill in values',
    )
  }
} else {
  fail('.dev.vars not found', 'Run: cp .dev.vars.example .dev.vars && fill in values')
}

// 5. .env exists + R2 keys (only needed for ingest scripts)
const envPath = resolve(ROOT, '.env')
const requiredEnvKeys = ['R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY']
if (existsSync(envPath)) {
  const content = readFileSync(envPath, 'utf8')
  const missingKeys = requiredEnvKeys.filter((k) => !content.includes(`${k}=`))
  if (missingKeys.length === 0) {
    pass('.env', `keys: ${requiredEnvKeys.join(', ')}`)
  } else {
    warn(
      `.env missing R2 keys: ${missingKeys.join(', ')}`,
      'Only needed for pnpm ingest / image upload scripts',
    )
  }
} else {
  warn('.env not found', 'Only needed for pnpm ingest / image upload — create from .env.example')
}

// 6. node_modules installed
const nmPath = resolve(ROOT, 'node_modules', '.modules.yaml')
if (existsSync(nmPath)) {
  pass('node_modules', 'installed')
} else {
  fail('node_modules not found', 'Run: pnpm install')
}

// 7. gitleaks (warn-only — CI is the hard gate)
const gitleaks = run('command -v gitleaks')
if (gitleaks.ok) {
  const version = run('gitleaks version 2>/dev/null')
  pass('gitleaks', version.stdout || 'installed')
} else {
  warn('gitleaks not installed', 'Install for local secret scanning: brew install gitleaks')
}

// ── Summary ───────────────────────────────────────────────────────────────────

console.log()
if (anyFailed) {
  console.log(`  ${RED}${BOLD}Some checks failed — fix the issues above before running pnpm cf:dev.${RESET}\n`)
  process.exit(1)
} else {
  console.log(`  ${GREEN}${BOLD}All checks passed — ready to develop.${RESET}\n`)
}
