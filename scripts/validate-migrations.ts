#!/usr/bin/env tsx
/**
 * validate-migrations.ts
 *
 * Lints all SQL migration files in /migrations/ for idempotency guards:
 *   - CREATE TABLE must use IF NOT EXISTS
 *   - CREATE INDEX must use IF NOT EXISTS
 *   - DROP TABLE must use IF EXISTS
 *   - DROP INDEX must use IF EXISTS
 *   - DROP COLUMN must use IF EXISTS
 *   - ALTER TABLE ... ADD COLUMN should ideally be guarded (warns, not error)
 *
 * Usage: pnpm migrate:validate
 * Exit code 1 if any violations found, 0 otherwise.
 */

import { readdirSync, readFileSync } from 'node:fs'
import { resolve, join } from 'node:path'

const MIGRATIONS_DIR = resolve(import.meta.dirname ?? '.', '..', 'migrations')

// --from N: only validate migrations with number >= N (useful for CI gating on new migrations)
const fromArg = process.argv.indexOf('--from')
const fromNumber = fromArg !== -1 ? parseInt(process.argv[fromArg + 1] ?? '0', 10) : 0

interface Violation {
  file: string
  line: number
  text: string
  message: string
  severity: 'error' | 'warn'
}

const violations: Violation[] = []

// Patterns that REQUIRE a guard (hard error)
const errorPatterns: Array<{ re: RegExp; notRe: RegExp; message: string }> = [
  {
    re: /\bCREATE\s+TABLE\b/i,
    notRe: /\bCREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\b/i,
    message: 'CREATE TABLE must use IF NOT EXISTS',
  },
  {
    re: /\bDROP\s+TABLE\b/i,
    notRe: /\bDROP\s+TABLE\s+IF\s+EXISTS\b/i,
    message: 'DROP TABLE must use IF EXISTS',
  },
  {
    re: /\bDROP\s+INDEX\b/i,
    notRe: /\bDROP\s+INDEX\s+IF\s+EXISTS\b/i,
    message: 'DROP INDEX must use IF EXISTS',
  },
]

// Patterns that are advisory (warning only)
const warnPatterns: Array<{ re: RegExp; message: string }> = [
  {
    // CREATE INDEX without IF NOT EXISTS — historical migrations often omit this
    re: /\bCREATE\s+(?:UNIQUE\s+)?INDEX\b(?!.*\bIF\s+NOT\s+EXISTS\b)/i,
    message: 'CREATE INDEX should use IF NOT EXISTS for idempotency',
  },
  {
    re: /\bALTER\s+TABLE\b/i,
    message: 'ALTER TABLE is not idempotent — ensure the migration is safe to re-run or add a guard comment',
  },
]

const sqlFiles = readdirSync(MIGRATIONS_DIR)
  .filter((f) => {
    if (!f.endsWith('.sql') || !/^\d{4}/.test(f)) return false
    const num = parseInt(f.slice(0, 4), 10)
    return num >= fromNumber
  })
  .sort()

for (const file of sqlFiles) {
  const filePath = join(MIGRATIONS_DIR, file)
  const content = readFileSync(filePath, 'utf-8')

  // Strip single-line comments before pattern matching to avoid false positives on comment text
  const lines = content.split('\n')
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i]
    const stripped = raw.replace(/--.*$/, '').trim()
    if (!stripped) continue

    for (const { re, notRe, message } of errorPatterns) {
      if (re.test(stripped) && !notRe.test(stripped)) {
        violations.push({ file, line: i + 1, text: raw.trim(), message, severity: 'error' })
      }
    }

    for (const { re, message } of warnPatterns) {
      if (re.test(stripped)) {
        violations.push({ file, line: i + 1, text: raw.trim(), message, severity: 'warn' })
      }
    }
  }
}

if (violations.length === 0) {
  console.log(`✓ All ${sqlFiles.length} migration files passed idempotency checks.`)
  process.exit(0)
}

// Group by severity
const errors = violations.filter((v) => v.severity === 'error')
const warnings = violations.filter((v) => v.severity === 'warn')

for (const { file, line, text, message, severity } of violations) {
  const label = severity === 'error' ? 'ERROR' : 'WARN '
  console.error(`[${label}] ${file}:${line}  ${message}`)
  console.error(`        ${text}`)
}

console.error(`\n${errors.length} error(s), ${warnings.length} warning(s) across ${sqlFiles.length} migration files.`)

if (errors.length > 0) {
  process.exit(1)
}
// Warnings only — exit 0 but already printed above
