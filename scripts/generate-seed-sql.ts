/**
 * Generate seed SQL from database.ts DEFAULT_CHARACTERS and DEFAULT_QUESTIONS.
 *
 * Usage: npx tsx scripts/generate-seed-sql.ts > migrations/0002_seed.sql
 */
import { DEFAULT_CHARACTERS, DEFAULT_QUESTIONS } from '../src/lib/database'

function esc(s: string): string {
  return s.replace(/'/g, "''")
}

function boolToInt(v: boolean | null): string {
  if (v === true) return '1'
  if (v === false) return '0'
  return 'NULL'
}

const lines: string[] = []

lines.push('-- ============================================================')
lines.push('-- Seed data from src/lib/database.ts')
lines.push(`-- Generated: ${new Date().toISOString()}`)
lines.push(`-- Characters: ${DEFAULT_CHARACTERS.length}, Questions: ${DEFAULT_QUESTIONS.length}`)
lines.push('-- ============================================================')
lines.push('')

// Collect all unique attribute keys across all characters
const allAttrKeys = new Set<string>()
for (const char of DEFAULT_CHARACTERS) {
  for (const key of Object.keys(char.attributes)) {
    allAttrKeys.add(key)
  }
}

// Build a display text from camelCase key: "isHuman" -> "Is Human"
function keyToDisplay(key: string): string {
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (c) => c.toUpperCase())
    .trim()
}

// ── Attribute definitions ─────────────────────────────────────
lines.push('-- Attribute definitions')
for (const key of [...allAttrKeys].sort()) {
  const display = keyToDisplay(key)
  lines.push(
    `INSERT INTO attribute_definitions (key, display_text) VALUES ('${esc(key)}', '${esc(display)}');`
  )
}
lines.push('')

// ── Characters ────────────────────────────────────────────────
lines.push('-- Characters')
for (const char of DEFAULT_CHARACTERS) {
  lines.push(
    `INSERT INTO characters (id, name, category, source, popularity) VALUES ('${esc(char.id)}', '${esc(char.name)}', '${esc(char.category)}', 'default', 1.0);`
  )
}
lines.push('')

// ── Character attributes ──────────────────────────────────────
lines.push('-- Character attributes')
for (const char of DEFAULT_CHARACTERS) {
  for (const [key, value] of Object.entries(char.attributes)) {
    const v = boolToInt(value)
    lines.push(
      `INSERT INTO character_attributes (character_id, attribute_key, value, confidence) VALUES ('${esc(char.id)}', '${esc(key)}', ${v}, 1.0);`
    )
  }
}
lines.push('')

// ── Questions ─────────────────────────────────────────────────
lines.push('-- Questions')
for (const q of DEFAULT_QUESTIONS) {
  lines.push(
    `INSERT INTO questions (id, text, attribute_key) VALUES ('${esc(q.id)}', '${esc(q.text)}', '${esc(q.attribute)}');`
  )
}

// Also backfill question_text into attribute_definitions where we have a matching question
lines.push('')
lines.push('-- Backfill question text into attribute definitions')
for (const q of DEFAULT_QUESTIONS) {
  lines.push(
    `UPDATE attribute_definitions SET question_text = '${esc(q.text)}' WHERE key = '${esc(q.attribute)}';`
  )
}

console.log(lines.join('\n'))
