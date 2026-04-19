#!/usr/bin/env tsx
/**
 * create-migration.ts
 *
 * Scaffolds a new numbered SQL migration file.
 *
 * Usage: pnpm migrate:create <name>
 * Example: pnpm migrate:create add_user_preferences
 * Output:  migrations/0013_add_user_preferences.sql
 */

import { readdirSync, writeFileSync } from 'node:fs'
import { resolve, join } from 'node:path'

const MIGRATIONS_DIR = resolve(import.meta.dirname ?? '.', '..', 'migrations')

function main(): void {
  const name = process.argv[2]
  if (!name) {
    console.error('Usage: pnpm migrate:create <name>')
    console.error('Example: pnpm migrate:create add_user_preferences')
    process.exit(1)
  }

  // Validate name: lowercase, underscores, no spaces
  const sanitized = name.toLowerCase().replace(/[^a-z0-9_]/g, '_')

  // Find the next migration number
  const existing = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql') && /^\d{4}/.test(f))
    .map((f) => parseInt(f.slice(0, 4), 10))
    .filter((n) => !isNaN(n))

  const next = existing.length > 0 ? Math.max(...existing) + 1 : 1
  const padded = String(next).padStart(4, '0')
  const filename = `${padded}_${sanitized}.sql`
  const filepath = join(MIGRATIONS_DIR, filename)

  const content = `-- Migration: ${sanitized.replace(/_/g, ' ')}
-- Created: ${new Date().toISOString()}

`

  writeFileSync(filepath, content)
  console.log(`✓ Created ${filename}`)
  console.log(`  Path: ${filepath}`)
  console.log(`\n  After editing, regenerate types: pnpm db:types`)
}

main()
