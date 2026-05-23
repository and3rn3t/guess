#!/usr/bin/env tsx
/**
 * DX.35 — Migration timeline visualizer
 * Prints a chronological list of every table and column introduced across all migrations.
 * Usage: pnpm db:timeline [--filter <table>]
 */

import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const MIGRATIONS_DIR = join(import.meta.dirname, '..', 'migrations')
const filterArg = process.argv[process.argv.indexOf('--filter') + 1] ?? null

interface Event {
  migration: string
  type: 'CREATE TABLE' | 'ADD COLUMN' | 'CREATE INDEX' | 'CREATE VIEW'
  table: string
  detail: string
}

function parseMigration(filename: string, sql: string): Event[] {
  const events: Event[] = []
  const name = filename.replace(/\.sql$/, '')

  // CREATE TABLE
  for (const m of sql.matchAll(/CREATE TABLE(?: IF NOT EXISTS)?\s+"?(\w+)"?\s*\(/gim)) {
    events.push({ migration: name, type: 'CREATE TABLE', table: m[1], detail: '' })
  }

  // ALTER TABLE ... ADD COLUMN
  for (const m of sql.matchAll(/ALTER TABLE\s+"?(\w+)"?\s+ADD COLUMN\s+"?(\w+)"?\s+([^\n,;]+)/gim)) {
    events.push({ migration: name, type: 'ADD COLUMN', table: m[1], detail: `${m[2]} ${m[3].trim()}` })
  }

  // CREATE INDEX
  for (const m of sql.matchAll(/CREATE(?: UNIQUE)? INDEX(?: IF NOT EXISTS)?\s+"?(\w+)"?\s+ON\s+"?(\w+)"?/gim)) {
    events.push({ migration: name, type: 'CREATE INDEX', table: m[2], detail: m[1] })
  }

  // CREATE VIEW
  for (const m of sql.matchAll(/CREATE(?: OR REPLACE)? VIEW\s+"?(\w+)"?/gim)) {
    events.push({ migration: name, type: 'CREATE VIEW', table: m[1], detail: '' })
  }

  return events
}

const files = readdirSync(MIGRATIONS_DIR)
  .filter(f => f.endsWith('.sql') && !f.startsWith('_'))
  .sort()

const allEvents: Event[] = []
for (const file of files) {
  const sql = readFileSync(join(MIGRATIONS_DIR, file), 'utf-8')
  allEvents.push(...parseMigration(file, sql))
}

const filtered = filterArg
  ? allEvents.filter(e => e.table.toLowerCase().includes(filterArg.toLowerCase()))
  : allEvents

// Group by migration
const byMigration = new Map<string, Event[]>()
for (const e of filtered) {
  const list = byMigration.get(e.migration) ?? []
  list.push(e)
  byMigration.set(e.migration, list)
}

const TYPE_COLOR: Record<Event['type'], string> = {
  'CREATE TABLE': '\x1b[32m', // green
  'ADD COLUMN':   '\x1b[36m', // cyan
  'CREATE INDEX': '\x1b[33m', // yellow
  'CREATE VIEW':  '\x1b[35m', // magenta
}
const RESET = '\x1b[0m'

let total = 0
for (const [migration, events] of byMigration) {
  console.log(`\n\x1b[1m${migration}\x1b[0m`)
  for (const e of events) {
    const color = TYPE_COLOR[e.type]
    const detail = e.detail ? ` — ${e.detail}` : ''
    console.log(`  ${color}${e.type}${RESET} ${e.table}${detail}`)
    total++
  }
}

console.log(`\n${total} event${total !== 1 ? 's' : ''}${filterArg ? ` matching "${filterArg}"` : ''} across ${byMigration.size} migration${byMigration.size !== 1 ? 's' : ''}.`)
