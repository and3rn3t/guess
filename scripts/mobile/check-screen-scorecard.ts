#!/usr/bin/env tsx
/**
 * Screen quality scorecard gate.
 *
 * Enforces that every screen file under apps/mobile/src/screens/*.tsx
 * has a corresponding entry in docs/mobile/screen-quality-scores.json.
 *
 * Threshold behaviour:
 * - EXIT 1  if any screen has no scorecard entry (evidence is mandatory).
 * - EXIT 0  always otherwise; scores below PR-merge threshold are reported
 *           as WARNINGs so the pipeline is never blocked by partially-validated
 *           screens (device validation is required for runtime categories).
 *
 * Run: pnpm mobile:scorecard
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..', '..');
const SCREENS_DIR = path.join(REPO_ROOT, 'apps', 'mobile', 'src', 'screens');
const SCORES_FILE = path.join(REPO_ROOT, 'docs', 'mobile', 'screen-quality-scores.json');

interface CategoryScores {
  nativeInteractionFidelity: number;
  visualNativeFit: number;
  accessibilityAndInclusivity: number;
  performanceFeel: number;
  platformBehaviorIntegrity: number;
  contentClarityAndCognitiveLoad: number;
}

interface ScreenEntry {
  file: string;
  evaluatedAt: string;
  deviceValidationPending?: boolean;
  categories: CategoryScores;
  notes?: string;
}

interface Threshold {
  weighted: number;
  minCategory: number;
}

interface ScoresJson {
  version: number;
  thresholds: { prMerge: Threshold; milestone: Threshold; production: Threshold };
  categoryWeights: Record<keyof CategoryScores, number>;
  screens: Record<string, ScreenEntry>;
}

function computeWeighted(categories: CategoryScores, weights: Record<string, number>): number {
  let total = 0;
  for (const [key, score] of Object.entries(categories)) {
    const weight = weights[key] ?? 0;
    total += score * (weight / 100);
  }
  return Math.round(total * 10) / 10;
}

function checkThreshold(
  categories: CategoryScores,
  weighted: number,
  threshold: Threshold,
): { pass: boolean; failures: string[] } {
  const failures: string[] = [];
  if (weighted < threshold.weighted) {
    failures.push(`weighted ${weighted} < ${threshold.weighted}`);
  }
  for (const [key, score] of Object.entries(categories)) {
    if (score < threshold.minCategory) {
      failures.push(`${key} ${score} < ${threshold.minCategory}`);
    }
  }
  return { pass: failures.length === 0, failures };
}

function main(): void {
  // Guard: screens directory must exist.
  if (!existsSync(SCREENS_DIR)) {
    console.log('mobile-scorecard: apps/mobile/src/screens not found; skipping.');
    return;
  }

  // Guard: scores file must exist.
  if (!existsSync(SCORES_FILE)) {
    console.error('mobile-scorecard: docs/mobile/screen-quality-scores.json not found.');
    console.error('  Create the file with entries for all core screens.');
    process.exit(1);
  }

  const data: ScoresJson = JSON.parse(readFileSync(SCORES_FILE, 'utf-8'));
  const { thresholds, categoryWeights, screens } = data;

  // Collect all screen TSX files (excluding types.ts).
  const screenFiles = readdirSync(SCREENS_DIR).filter(
    (f) => f.endsWith('.tsx') && f !== 'index.tsx',
  );

  const missing: string[] = [];
  const warnings: string[] = [];
  const rows: Array<{ name: string; weighted: number; pending: boolean; pass: boolean }> = [];

  for (const fileName of screenFiles) {
    const name = fileName.replace(/\.tsx$/, '');
    const entry = screens[name];
    if (!entry) {
      missing.push(name);
      continue;
    }

    const weighted = computeWeighted(entry.categories, categoryWeights);
    const { pass, failures } = checkThreshold(entry.categories, weighted, thresholds.prMerge);
    rows.push({ name, weighted, pending: entry.deviceValidationPending ?? false, pass });

    if (!pass) {
      const pendingNote = entry.deviceValidationPending ? ' (device validation pending)' : '';
      warnings.push(
        `  ${name}: weighted=${weighted}${pendingNote}\n    Below PR-merge threshold: ${failures.join(', ')}`,
      );
    }
  }

  console.log('mobile-scorecard report');
  console.log('───────────────────────');
  console.log(`Screens evaluated: ${rows.length + missing.length}`);
  console.log(`PR-merge threshold: weighted≥${thresholds.prMerge.weighted}, no category<${thresholds.prMerge.minCategory}`);
  console.log('');

  for (const row of rows) {
    const status = row.pass ? '✓' : row.pending ? '~' : '✗';
    const pendingNote = row.pending ? ' (device-pending)' : '';
    console.log(`  ${status} ${row.name}: ${row.weighted}${pendingNote}`);
  }

  if (missing.length > 0) {
    console.error('');
    console.error(`Status: FAIL — ${missing.length} screen(s) missing scorecard entries:`);
    for (const name of missing) {
      console.error(`  ✗ ${name}`);
    }
    console.error('');
    console.error('  Add entries to docs/mobile/screen-quality-scores.json before merging.');
    process.exit(1);
  }

  if (warnings.length > 0) {
    console.log('');
    console.log(`Status: WARN — ${warnings.length} screen(s) below PR-merge threshold:`);
    for (const w of warnings) {
      console.log(w);
    }
    console.log('');
    console.log('  Improve scores or complete device validation before requesting review.');
  } else {
    console.log('');
    console.log('Status: PASS');
  }
}

main();
