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
import { spawnSync } from 'node:child_process';
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

interface DeviceValidationChecklist {
  file: string;
  lastUpdated: string;
}

interface ScoresJson {
  version: number;
  thresholds: { prMerge: Threshold; milestone: Threshold; production: Threshold };
  deviceValidationChecklist: DeviceValidationChecklist;
  categoryWeights: Record<keyof CategoryScores, number>;
  screens: Record<string, ScreenEntry>;
}

type GateName = keyof ScoresJson['thresholds'];

const GATE_ORDER: GateName[] = ['prMerge', 'milestone', 'production'];

interface ParsedArgs {
  gate: GateName;
  baseRef?: string;
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

function parseArgs(argv: string[]): ParsedArgs {
  let gate: GateName = 'prMerge';
  let baseRef: string | undefined;

  for (const arg of argv) {
    if (arg.startsWith('--gate=')) {
      const value = arg.slice('--gate='.length);
      if (value === 'prMerge' || value === 'milestone' || value === 'production') {
        gate = value;
      } else {
        console.error(`mobile-scorecard: invalid gate '${value}'. Use prMerge|milestone|production.`);
        process.exit(1);
      }
    } else if (arg.startsWith('--base-ref=')) {
      const value = arg.slice('--base-ref='.length).trim();
      if (value.length > 0) {
        baseRef = value;
      }
    }
  }

  return { gate, baseRef };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isIsoDate(value: unknown): value is string {
  if (typeof value !== 'string') {
    return false;
  }
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

const CATEGORY_KEYS: (keyof CategoryScores)[] = [
  'nativeInteractionFidelity',
  'visualNativeFit',
  'accessibilityAndInclusivity',
  'performanceFeel',
  'platformBehaviorIntegrity',
  'contentClarityAndCognitiveLoad',
];

function parseCategoryScores(value: unknown, pathLabel: string, errors: string[]): CategoryScores | null {
  if (!isRecord(value)) {
    errors.push(`${pathLabel} must be an object.`);
    return null;
  }

  const parsed: Partial<CategoryScores> = {};
  for (const key of CATEGORY_KEYS) {
    const raw = value[key];
    if (!isFiniteNumber(raw)) {
      errors.push(`${pathLabel}.${key} must be a finite number.`);
      continue;
    }
    if (raw < 0 || raw > 100) {
      errors.push(`${pathLabel}.${key} must be within 0-100.`);
      continue;
    }
    parsed[key] = raw;
  }

  if (errors.length > 0) {
    return null;
  }

  return parsed as CategoryScores;
}

function parseThreshold(value: unknown, pathLabel: string, errors: string[]): Threshold | null {
  if (!isRecord(value)) {
    errors.push(`${pathLabel} must be an object.`);
    return null;
  }

  const weighted = value.weighted;
  const minCategory = value.minCategory;

  if (!isFiniteNumber(weighted)) {
    errors.push(`${pathLabel}.weighted must be a finite number.`);
  } else if (weighted < 0 || weighted > 100) {
    errors.push(`${pathLabel}.weighted must be within 0-100.`);
  }

  if (!isFiniteNumber(minCategory)) {
    errors.push(`${pathLabel}.minCategory must be a finite number.`);
  } else if (minCategory < 0 || minCategory > 100) {
    errors.push(`${pathLabel}.minCategory must be within 0-100.`);
  }

  if (!isFiniteNumber(weighted) || !isFiniteNumber(minCategory)) {
    return null;
  }

  return { weighted, minCategory };
}

function parseCategoryWeights(value: unknown, errors: string[]): Record<keyof CategoryScores, number> | null {
  if (!isRecord(value)) {
    errors.push('categoryWeights must be an object.');
    return null;
  }

  const parsed: Partial<Record<keyof CategoryScores, number>> = {};
  let totalWeight = 0;

  for (const key of CATEGORY_KEYS) {
    const raw = value[key];
    if (!isFiniteNumber(raw)) {
      errors.push(`categoryWeights.${key} must be a finite number.`);
      continue;
    }
    if (raw < 0 || raw > 100) {
      errors.push(`categoryWeights.${key} must be within 0-100.`);
      continue;
    }
    parsed[key] = raw;
    totalWeight += raw;
  }

  if (Math.abs(totalWeight - 100) > 0.001) {
    errors.push(`categoryWeights must sum to 100, received ${totalWeight}.`);
  }

  if (errors.length > 0) {
    return null;
  }

  return parsed as Record<keyof CategoryScores, number>;
}

function parseDeviceValidationChecklist(
  value: unknown,
  errors: string[],
): DeviceValidationChecklist | null {
  if (!isRecord(value)) {
    errors.push('deviceValidationChecklist must be an object.');
    return null;
  }

  const file = value.file;
  if (typeof file !== 'string' || file.length === 0) {
    errors.push('deviceValidationChecklist.file must be a non-empty string.');
  } else if (file !== 'docs/mobile/device-validation-checklist.md') {
    errors.push(
      `deviceValidationChecklist.file must be 'docs/mobile/device-validation-checklist.md', received '${file}'.`,
    );
  }

  const lastUpdated = value.lastUpdated;
  if (!isIsoDate(lastUpdated)) {
    errors.push('deviceValidationChecklist.lastUpdated must be in YYYY-MM-DD format.');
  }

  if (typeof file !== 'string' || !isIsoDate(lastUpdated)) {
    return null;
  }

  return { file, lastUpdated };
}

function parseScoresJson(raw: unknown, coreScreenNames: string[]): { data: ScoresJson | null; errors: string[] } {
  const errors: string[] = [];

  if (!isRecord(raw)) {
    return { data: null, errors: ['Top-level scorecard document must be a JSON object.'] };
  }

  const version = raw.version;
  if (!isFiniteNumber(version)) {
    errors.push('version must be a finite number.');
  }

  const thresholdsRaw = raw.thresholds;
  let thresholds: ScoresJson['thresholds'] | null = null;
  if (!isRecord(thresholdsRaw)) {
    errors.push('thresholds must be an object.');
  } else {
    const prMerge = parseThreshold(thresholdsRaw.prMerge, 'thresholds.prMerge', errors);
    const milestone = parseThreshold(thresholdsRaw.milestone, 'thresholds.milestone', errors);
    const production = parseThreshold(thresholdsRaw.production, 'thresholds.production', errors);

    if (prMerge && milestone && production) {
      thresholds = { prMerge, milestone, production };

      if (milestone.weighted < prMerge.weighted || production.weighted < milestone.weighted) {
        errors.push('thresholds.weighted must be non-decreasing from prMerge -> milestone -> production.');
      }
      if (milestone.minCategory < prMerge.minCategory || production.minCategory < milestone.minCategory) {
        errors.push('thresholds.minCategory must be non-decreasing from prMerge -> milestone -> production.');
      }
    }
  }

  const deviceValidationChecklist = parseDeviceValidationChecklist(raw.deviceValidationChecklist, errors);

  const categoryWeights = parseCategoryWeights(raw.categoryWeights, errors);

  const screensRaw = raw.screens;
  const screens: Record<string, ScreenEntry> = {};
  if (!isRecord(screensRaw)) {
    errors.push('screens must be an object keyed by screen name.');
  } else {
    const expectedScreenNames = new Set(coreScreenNames);

    for (const screenName of coreScreenNames) {
      const entryRaw = screensRaw[screenName];
      const label = `screens.${screenName}`;

      if (!isRecord(entryRaw)) {
        errors.push(`${label} is missing or invalid.`);
        continue;
      }

      const file = entryRaw.file;
      const expectedFile = `apps/mobile/src/screens/${screenName}.tsx`;
      if (typeof file !== 'string' || file.length === 0) {
        errors.push(`${label}.file must be a non-empty string.`);
      } else if (file !== expectedFile) {
        errors.push(`${label}.file must be '${expectedFile}', received '${file}'.`);
      }

      const evaluatedAt = entryRaw.evaluatedAt;
      if (!isIsoDate(evaluatedAt)) {
        errors.push(`${label}.evaluatedAt must be in YYYY-MM-DD format.`);
      }

      const categories = parseCategoryScores(entryRaw.categories, `${label}.categories`, errors);

      const deviceValidationPending = entryRaw.deviceValidationPending;
      if (deviceValidationPending !== undefined && typeof deviceValidationPending !== 'boolean') {
        errors.push(`${label}.deviceValidationPending must be a boolean when provided.`);
      }

      const notes = entryRaw.notes;
      if (notes !== undefined && typeof notes !== 'string') {
        errors.push(`${label}.notes must be a string when provided.`);
      }

      if (typeof file === 'string' && isIsoDate(evaluatedAt) && categories) {
        screens[screenName] = {
          file,
          evaluatedAt,
          categories,
          ...(typeof deviceValidationPending === 'boolean' ? { deviceValidationPending } : {}),
          ...(typeof notes === 'string' ? { notes } : {}),
        };
      }
    }

    for (const key of Object.keys(screensRaw)) {
      if (!expectedScreenNames.has(key)) {
        errors.push(`screens.${key} is not a known core screen in apps/mobile/src/screens.`);
      }
    }
  }

  if (errors.length > 0 || !thresholds || !deviceValidationChecklist || !categoryWeights || !isFiniteNumber(version)) {
    return { data: null, errors };
  }

  return {
    data: {
      version,
      thresholds,
      deviceValidationChecklist,
      categoryWeights,
      screens,
    },
    errors: [],
  };
}

function resolveBaseRef(explicitBaseRef?: string): string | null {
  if (explicitBaseRef) {
    return explicitBaseRef;
  }

  const envBase = process.env.MOBILE_SCORECARD_BASE_REF?.trim();
  if (envBase) {
    return envBase;
  }

  const githubBase = process.env.GITHUB_BASE_REF?.trim();
  if (githubBase) {
    return `origin/${githubBase}`;
  }

  return 'HEAD~1';
}

function gitRefExists(ref: string): boolean {
  const result = spawnSync('git', ['rev-parse', '--verify', ref], {
    cwd: REPO_ROOT,
    stdio: 'ignore',
  });
  return result.status === 0;
}

function getChangedPaths(baseRef: string): string[] {
  const result = spawnSync('git', ['diff', '--name-only', '--diff-filter=ACMR', `${baseRef}...HEAD`], {
    cwd: REPO_ROOT,
    encoding: 'utf-8',
  });

  if (result.status !== 0) {
    return [];
  }

  return result.stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

function getCoreScreenNames(): string[] {
  return readdirSync(SCREENS_DIR)
    .filter((f) => f.endsWith('.tsx') && f !== 'index.tsx' && f !== 'tokens.ts')
    .map((fileName) => fileName.replace(/\.tsx$/, ''));
}

function selectScreens(coreScreenNames: string[], baseRef: string | null): {
  changedPaths: string[];
  selectedScreenNames: string[];
  selectionMode: 'touched' | 'fallback-all';
  selectionDetail: string;
} {
  if (!baseRef || !gitRefExists(baseRef)) {
    return {
      changedPaths: [],
      selectedScreenNames: coreScreenNames,
      selectionMode: 'fallback-all',
      selectionDetail: 'no comparable git base ref found; validated all core screens',
    };
  }

  const changedPaths = getChangedPaths(baseRef);
  const touchedScreenFiles = new Set(
    changedPaths
      .filter((filePath) => filePath.startsWith('apps/mobile/src/screens/'))
      .map((filePath) => path.basename(filePath))
      .filter((fileName) => fileName.endsWith('.tsx') && fileName !== 'index.tsx' && fileName !== 'tokens.ts'),
  );

  const touchedScreenNames = coreScreenNames.filter((name) => touchedScreenFiles.has(`${name}.tsx`));

  if (touchedScreenNames.length > 0) {
    return {
      changedPaths,
      selectedScreenNames: touchedScreenNames,
      selectionMode: 'touched',
      selectionDetail: `touched screen files vs ${baseRef}`,
    };
  }

  return {
    changedPaths,
    selectedScreenNames: coreScreenNames,
    selectionMode: 'fallback-all',
    selectionDetail: `no touched core screens vs ${baseRef}; validated all core screens`,
  };
}

interface ScreenRow {
  name: string;
  weighted: number;
  pending: boolean;
  gatePass: boolean;
  perGate: Record<GateName, boolean>;
}

function evaluateScreens(
  selectedScreenNames: string[],
  screens: Record<string, ScreenEntry>,
  categoryWeights: Record<keyof CategoryScores, number>,
  thresholds: ScoresJson['thresholds'],
  gate: GateName,
): {
  rows: ScreenRow[];
  missing: string[];
  warnings: string[];
  failures: string[];
} {
  const rows: ScreenRow[] = [];
  const missing: string[] = [];
  const warnings: string[] = [];
  const failures: string[] = [];

  for (const name of selectedScreenNames) {
    const entry = screens[name];
    if (!entry) {
      missing.push(name);
      continue;
    }

    const weighted = computeWeighted(entry.categories, categoryWeights);
    const perGate = {
      prMerge: checkThreshold(entry.categories, weighted, thresholds.prMerge).pass,
      milestone: checkThreshold(entry.categories, weighted, thresholds.milestone).pass,
      production: checkThreshold(entry.categories, weighted, thresholds.production).pass,
    } satisfies Record<GateName, boolean>;

    const gateResult = checkThreshold(entry.categories, weighted, thresholds[gate]);
    const pending = entry.deviceValidationPending ?? false;

    rows.push({
      name,
      weighted,
      pending,
      gatePass: gateResult.pass,
      perGate,
    });

    if (gateResult.pass) {
      continue;
    }

    const pendingNote = pending ? ' (device validation pending)' : '';
    const detail = `  ${name}: weighted=${weighted}${pendingNote}\n    Below ${gate} threshold: ${gateResult.failures.join(', ')}`;

    if (gate === 'prMerge' && pending) {
      warnings.push(detail);
    } else {
      failures.push(detail);
    }
  }

  return { rows, missing, warnings, failures };
}

function statusSymbol(row: ScreenRow, gate: GateName): string {
  if (row.gatePass) {
    return '✓';
  }
  if (row.pending && gate === 'prMerge') {
    return '~';
  }
  return '✗';
}

function main(): void {
  const args = parseArgs(process.argv.slice(2));

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

  const coreScreenNames = getCoreScreenNames();
  const parsed = parseScoresJson(JSON.parse(readFileSync(SCORES_FILE, 'utf-8')), coreScreenNames);
  if (!parsed.data) {
    console.error('mobile-scorecard: invalid scorecard file format.');
    for (const error of parsed.errors) {
      console.error(`  - ${error}`);
    }
    process.exit(1);
  }

  const data = parsed.data;
  const { thresholds, deviceValidationChecklist, categoryWeights, screens } = data;

  const baseRef = resolveBaseRef(args.baseRef);
  const selection = selectScreens(coreScreenNames, baseRef);
  const { rows, missing, warnings, failures } = evaluateScreens(
    selection.selectedScreenNames,
    screens,
    categoryWeights,
    thresholds,
    args.gate,
  );

  console.log('mobile-scorecard report');
  console.log('───────────────────────');
  console.log(`Gate mode: ${args.gate}`);
  console.log(`Selection mode: ${selection.selectionMode} (${selection.selectionDetail})`);
  console.log(`Changed files considered: ${selection.changedPaths.length}`);
  console.log(`Screens evaluated: ${rows.length + missing.length}`);
  console.log(`Device checklist: ${deviceValidationChecklist.file} (lastUpdated: ${deviceValidationChecklist.lastUpdated})`);
  console.log(`Gate threshold: weighted≥${thresholds[args.gate].weighted}, no category<${thresholds[args.gate].minCategory}`);
  console.log(
    `All thresholds: prMerge≥${thresholds.prMerge.weighted}/${thresholds.prMerge.minCategory}, ` +
      `milestone≥${thresholds.milestone.weighted}/${thresholds.milestone.minCategory}, ` +
      `production≥${thresholds.production.weighted}/${thresholds.production.minCategory}`,
  );
  console.log('');

  for (const row of rows) {
    const status = statusSymbol(row, args.gate);
    const pendingNote = row.pending ? ' (device-pending)' : '';
    const gates = GATE_ORDER.map((gate) => `${gate}:${row.perGate[gate] ? '✓' : '✗'}`).join(' ');
    console.log(`  ${status} ${row.name}: ${row.weighted}${pendingNote}  [${gates}]`);
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

  if (failures.length > 0) {
    console.error('');
    console.error(`Status: FAIL — ${failures.length} screen(s) below ${args.gate} gate:`);
    for (const failure of failures) {
      console.error(failure);
    }
    console.error('');
    console.error('  Raise category/weighted scores before merging for this gate.');
    process.exit(1);
  }

  if (warnings.length > 0) {
    console.log('');
    console.log(`Status: WARN — ${warnings.length} screen(s) below ${args.gate} threshold:`);
    for (const w of warnings) {
      console.log(w);
    }
    console.log('');
    console.log('  Complete device validation and raise scores before milestone/production gates.');
  } else {
    console.log('');
    console.log('Status: PASS');
  }
}

main();
