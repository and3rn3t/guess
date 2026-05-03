#!/usr/bin/env npx tsx
/**
 * DQ.32 — validate data/attribute-completeness-sla.json.
 *
 * Fast, network-free guard that enforces shape, ranges, and consistency for
 * the completeness SLA matrix before CI gates and completeness scoring depend
 * on it.
 *
 * Usage:
 *   npx tsx scripts/data-quality/check-sla.ts
 */

import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const REPO_ROOT = path.resolve(__dirname, '..', '..')
const SLA_PATH = path.join(REPO_ROOT, 'data', 'attribute-completeness-sla.json')

const VALID_CATEGORIES = new Set([
  'video-games',
  'movies',
  'anime',
  'comics',
  'books',
  'cartoons',
  'tv-shows',
  'pop-culture',
])

const CAMEL_OR_IDENT = /^[a-z][a-zA-Z0-9]*$/

interface SlaRule {
  attributeKey: string
  targets: Record<string, number>
}

interface SlaConfig {
  version: number
  updatedAt: string
  categories: string[]
  global: {
    warnScore: number
    failScore: number
    defaultCategoryFloor: number
    disputeBudget: number
  }
  rules: SlaRule[]
}

const errors: string[] = []

function pushError(message: string): void {
  errors.push(message)
}

function asNumber(v: unknown): number | null {
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

function inUnitRange(name: string, value: unknown): void {
  const n = asNumber(value)
  if (n === null || n < 0 || n > 1) {
    pushError(`${name} must be a number in [0, 1], got ${JSON.stringify(value)}`)
  }
}

function main(): void {
  if (!existsSync(SLA_PATH)) {
    pushError(`SLA file missing: ${SLA_PATH}`)
    reportAndExit()
    return
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(readFileSync(SLA_PATH, 'utf-8'))
  } catch (err) {
    pushError(`SLA file is not valid JSON: ${err instanceof Error ? err.message : String(err)}`)
    reportAndExit()
    return
  }

  if (!parsed || typeof parsed !== 'object') {
    pushError('SLA file root must be an object')
    reportAndExit()
    return
  }

  const cfg = parsed as Partial<SlaConfig>

  if (!Number.isInteger(cfg.version) || (cfg.version ?? 0) <= 0) {
    pushError(`version must be a positive integer, got ${JSON.stringify(cfg.version)}`)
  }

  if (typeof cfg.updatedAt !== 'string' || cfg.updatedAt.trim().length === 0) {
    pushError('updatedAt must be a non-empty string')
  }

  if (!Array.isArray(cfg.categories) || cfg.categories.length === 0) {
    pushError('categories must be a non-empty array')
  }

  const categories = new Set<string>()
  for (const c of cfg.categories ?? []) {
    if (typeof c !== 'string' || !VALID_CATEGORIES.has(c)) {
      pushError(`categories includes invalid value: ${JSON.stringify(c)}`)
      continue
    }
    if (categories.has(c)) pushError(`categories contains duplicate value: ${c}`)
    categories.add(c)
  }

  if (categories.size !== VALID_CATEGORIES.size) {
    const missing = [...VALID_CATEGORIES].filter((c) => !categories.has(c))
    if (missing.length > 0) pushError(`categories missing required values: ${missing.join(', ')}`)
  }

  if (!cfg.global || typeof cfg.global !== 'object') {
    pushError('global must be an object')
  } else {
    inUnitRange('global.warnScore', cfg.global.warnScore)
    inUnitRange('global.failScore', cfg.global.failScore)
    inUnitRange('global.defaultCategoryFloor', cfg.global.defaultCategoryFloor)
    const disputeBudget = asNumber(cfg.global.disputeBudget)
    if (disputeBudget === null || !Number.isInteger(disputeBudget) || disputeBudget < 1) {
      pushError(`global.disputeBudget must be a positive integer, got ${JSON.stringify(cfg.global.disputeBudget)}`)
    }
    const warnScore = asNumber(cfg.global.warnScore)
    const failScore = asNumber(cfg.global.failScore)
    if (warnScore !== null && failScore !== null && warnScore > failScore) {
      pushError(`global.warnScore (${warnScore}) cannot exceed global.failScore (${failScore})`)
    }
  }

  if (!Array.isArray(cfg.rules) || cfg.rules.length === 0) {
    pushError('rules must be a non-empty array')
  }

  const seenAttrs = new Set<string>()
  for (const [i, rule] of (cfg.rules ?? []).entries()) {
    if (!rule || typeof rule !== 'object') {
      pushError(`rules[${i}] must be an object`)
      continue
    }

    const key = (rule as Partial<SlaRule>).attributeKey
    if (typeof key !== 'string' || !CAMEL_OR_IDENT.test(key)) {
      pushError(`rules[${i}].attributeKey must be camelCase/alphanumeric, got ${JSON.stringify(key)}`)
    } else {
      if (seenAttrs.has(key)) pushError(`rules has duplicate attributeKey: ${key}`)
      seenAttrs.add(key)
    }

    const targets = (rule as Partial<SlaRule>).targets
    if (!targets || typeof targets !== 'object' || Array.isArray(targets)) {
      pushError(`rules[${i}].targets must be an object keyed by category`)
      continue
    }

    for (const category of categories) {
      if (!(category in targets)) {
        pushError(`rules[${i}].targets missing category target: ${category}`)
      }
    }

    for (const [category, value] of Object.entries(targets)) {
      if (!categories.has(category)) {
        pushError(`rules[${i}].targets contains unknown category: ${category}`)
      }
      inUnitRange(`rules[${i}].targets.${category}`, value)
    }
  }

  reportAndExit({
    categories: categories.size,
    rules: seenAttrs.size,
  })
}

function reportAndExit(summary?: { categories: number; rules: number }): void {
  console.log('DQ SLA check')
  console.log('────────────')

  if (summary) {
    console.log(`categories : ${summary.categories}`)
    console.log(`rules      : ${summary.rules}`)
  }

  if (errors.length > 0) {
    console.error('')
    console.error(`✗ ${errors.length} error(s):`)
    for (const e of errors) console.error(`  - ${e}`)
    process.exit(1)
  }

  console.log('')
  console.log('✓ SLA config valid.')
}

main()
