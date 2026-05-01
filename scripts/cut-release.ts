#!/usr/bin/env tsx
/**
 * Cut a new release: bump version, slot the [Unreleased] CHANGELOG section
 * under a new [X.Y.Z] heading, commit, tag, push.
 *
 * Usage:
 *   pnpm release patch        # 1.6.0 -> 1.6.1
 *   pnpm release minor        # 1.6.0 -> 1.7.0
 *   pnpm release major        # 1.6.0 -> 2.0.0
 *   pnpm release 1.6.1        # explicit version
 *   pnpm release --dry-run minor
 *
 * The tag-driven `.github/workflows/release.yml` then publishes the GitHub
 * release using the new CHANGELOG section as notes.
 */
import { execSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

type Bump = 'patch' | 'minor' | 'major'

const ROOT = resolve(import.meta.dirname, '..')
const PKG = resolve(ROOT, 'package.json')
const CHANGELOG = resolve(ROOT, 'CHANGELOG.md')

function bumpVersion(current: string, bump: Bump | string): string {
  if (/^\d+\.\d+\.\d+$/.test(bump)) return bump
  const [maj, min, pat] = current.split('.').map(Number)
  if (bump === 'patch') return `${maj}.${min}.${pat + 1}`
  if (bump === 'minor') return `${maj}.${min + 1}.0`
  if (bump === 'major') return `${maj + 1}.0.0`
  throw new Error(`Unknown bump: ${bump}. Use patch | minor | major | X.Y.Z`)
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

function run(cmd: string, dryRun: boolean): void {
  console.log(dryRun ? `[dry-run] ${cmd}` : `$ ${cmd}`)
  if (!dryRun) execSync(cmd, { stdio: 'inherit', cwd: ROOT })
}

function main(): void {
  const args = process.argv.slice(2)
  const dryRun = args.includes('--dry-run')
  const bump = args.find((a) => a !== '--dry-run')
  if (!bump) {
    console.error('Missing bump arg. Usage: pnpm release <patch|minor|major|X.Y.Z>')
    process.exit(1)
  }

  // Fail fast if working tree is dirty
  const status = execSync('git status --porcelain', { cwd: ROOT }).toString().trim()
  if (status && !dryRun) {
    console.error('Working tree dirty. Commit or stash before releasing:\n' + status)
    process.exit(1)
  }

  const pkg = JSON.parse(readFileSync(PKG, 'utf8')) as { version: string }
  const current = pkg.version
  const next = bumpVersion(current, bump)
  console.log(`Releasing v${current} -> v${next}`)

  // 1. Bump package.json
  pkg.version = next
  if (!dryRun) writeFileSync(PKG, JSON.stringify(pkg, null, 2) + '\n')

  // 2. Slot [Unreleased] -> [next] - today
  const changelog = readFileSync(CHANGELOG, 'utf8')
  if (!changelog.includes('## [Unreleased]')) {
    console.error('CHANGELOG.md missing `## [Unreleased]` heading')
    process.exit(1)
  }
  const newChangelog = changelog.replace(
    '## [Unreleased]\n',
    `## [Unreleased]\n\n### Added\n\n## [${next}] - ${todayIso()}\n`,
  )
  if (!dryRun) writeFileSync(CHANGELOG, newChangelog)

  // 3. Commit + tag + push
  run(`git add package.json CHANGELOG.md`, dryRun)
  run(`git commit -m "chore: release v${next}"`, dryRun)
  run(`git tag v${next}`, dryRun)
  run(`git push`, dryRun)
  run(`git push origin v${next}`, dryRun)

  console.log(
    dryRun
      ? '\nDry run complete. Re-run without --dry-run to ship.'
      : `\n✓ Pushed v${next}. The Release workflow will create the GitHub release shortly.`,
  )
}

main()
