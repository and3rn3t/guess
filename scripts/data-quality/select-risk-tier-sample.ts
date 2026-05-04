#!/usr/bin/env npx tsx

import { execFileSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  selectRiskTierSample,
  type RiskTier,
  type RiskTierCandidate,
} from '../../functions/api/_risk_tier.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const REPO_ROOT = path.resolve(__dirname, '..', '..')
const OUT_DIR = path.join(REPO_ROOT, 'data', 'reconcile')
mkdirSync(OUT_DIR, { recursive: true })

function flag(name: string, fallback: string): string {
  const i = process.argv.indexOf(name)
  return i >= 0 ? (process.argv[i + 1] ?? fallback) : fallback
}

function parseTier(raw: string): RiskTier {
  if (raw === 'tier1' || raw === 'tier2' || raw === 'tier3') return raw
  throw new Error(`Invalid --tier value: ${raw}. Expected tier1 | tier2 | tier3.`)
}

function parseIntStrict(raw: string, fallback: number, min: number, max: number): number {
  const parsed = Number.parseInt(raw, 10)
  if (Number.isNaN(parsed)) return fallback
  return Math.max(min, Math.min(max, parsed))
}

function defaultLimitForTier(tier: RiskTier): number {
  if (tier === 'tier1') return 50
  if (tier === 'tier2') return 120
  return 200
}

const ENV_FLAG = flag('--env', 'production')
const TIER = parseTier(flag('--tier', 'tier1'))
const defaultLimit = defaultLimitForTier(TIER)
const LIMIT = parseIntStrict(flag('--limit', String(defaultLimit)), defaultLimit, 1, 2000)
const OUT_FILE = flag(
  '--out',
  path.join(OUT_DIR, `risk-tier-${TIER}-${ENV_FLAG}-${new Date().toISOString().slice(0, 10)}.json`),
)

const DB_NAME = ENV_FLAG === 'production' ? 'guess-db' : 'guess-db-preview'

function d1<T>(sql: string): T[] {
  const out = execFileSync(
    'npx',
    ['wrangler', 'd1', 'execute', DB_NAME, '--env', ENV_FLAG, '--remote', '--json', '--command', sql],
    { encoding: 'utf8', maxBuffer: 200 * 1024 * 1024 },
  )
  const parsed = JSON.parse(out) as Array<{ results: T[] }>
  return parsed[0]?.results ?? []
}

const rows = d1<RiskTierCandidate>(`
WITH plays AS (
  SELECT actual_character_id AS character_id,
         COUNT(*) AS plays_30d
  FROM game_reveals
  WHERE actual_character_id IS NOT NULL
    AND created_at >= unixepoch('now', '-30 days') * 1000
  GROUP BY actual_character_id
),
open_disputes AS (
  SELECT character_id,
         COUNT(*) AS open_disputes
  FROM attribute_disputes
  WHERE status = 'open'
  GROUP BY character_id
),
agreement AS (
  SELECT character_id,
         AVG(agreement_score) AS agreement_avg
  FROM character_attributes
  WHERE agreement_score IS NOT NULL
  GROUP BY character_id
),
last_revalidated AS (
  SELECT character_id,
         MAX(detected_at) AS last_validated_at
  FROM attribute_drift
  GROUP BY character_id
)
SELECT c.id,
       c.name,
       c.category,
       c.popularity,
       COALESCE(p.plays_30d, 0) AS plays30d,
       COALESCE(d.open_disputes, 0) AS openDisputes,
       a.agreement_avg AS agreementAvg,
       lr.last_validated_at AS lastValidatedAt
FROM characters c
LEFT JOIN plays p ON p.character_id = c.id
LEFT JOIN open_disputes d ON d.character_id = c.id
LEFT JOIN agreement a ON a.character_id = c.id
LEFT JOIN last_revalidated lr ON lr.character_id = c.id
`)

const selection = selectRiskTierSample(rows, TIER, { limit: LIMIT })

const payload = {
  generatedAt: new Date().toISOString(),
  env: ENV_FLAG,
  tier: TIER,
  limit: LIMIT,
  coverage: selection.coverage,
  ids: selection.selected.map((candidate) => candidate.id),
  candidates: selection.selected.map((candidate) => ({
    id: candidate.id,
    name: candidate.name,
    category: candidate.category,
    riskScore: candidate.riskScore,
    plays30d: candidate.plays30d ?? 0,
    openDisputes: candidate.openDisputes ?? 0,
    agreementAvg: candidate.agreementAvg,
    staleDays: candidate.staleDays,
  })),
}

writeFileSync(OUT_FILE, `${JSON.stringify(payload, null, 2)}\n`, 'utf8')

console.log(`[risk-tier] env=${ENV_FLAG} tier=${TIER} limit=${LIMIT}`)
console.log(`[risk-tier] selected=${selection.coverage.selectedCount}/${selection.coverage.tierCandidates} tier candidates (${(selection.coverage.selectedPctOfTier * 100).toFixed(1)}%)`)
console.log(`[risk-tier] output=${path.relative(REPO_ROOT, OUT_FILE)}`)
