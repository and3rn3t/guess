#!/usr/bin/env tsx
/**
 * Informational quality ratchet for coverage and explicit-any usage.
 * Exits non-zero only when QUALITY_RATCHET_ENFORCE=true.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

interface CoverageTotals {
  linesFound: number;
  linesHit: number;
  branchesFound: number;
  branchesHit: number;
  functionsFound: number;
  functionsHit: number;
}

interface RatchetConfig {
  linesMin: number;
  branchesMin: number;
  functionsMin: number;
  explicitAnyMax: number;
  enforce: boolean;
}

const repoRoot = path.resolve(import.meta.dirname, '..');
const lcovPath = path.join(repoRoot, 'coverage', 'lcov.info');

const config: RatchetConfig = {
  linesMin: Number(process.env.QUALITY_LINES_MIN ?? '82'),
  branchesMin: Number(process.env.QUALITY_BRANCHES_MIN ?? '67'),
  functionsMin: Number(process.env.QUALITY_FUNCTIONS_MIN ?? '77'),
  explicitAnyMax: Number(process.env.QUALITY_EXPLICIT_ANY_MAX ?? '0'),
  enforce: process.env.QUALITY_RATCHET_ENFORCE === 'true',
};

function toPercent(hit: number, found: number): number {
  if (found === 0) {
    return 100;
  }
  return (hit / found) * 100;
}

function parseLcovTotals(text: string): CoverageTotals {
  const totals: CoverageTotals = {
    linesFound: 0,
    linesHit: 0,
    branchesFound: 0,
    branchesHit: 0,
    functionsFound: 0,
    functionsHit: 0,
  };

  for (const line of text.split('\n')) {
    if (line.startsWith('LF:')) totals.linesFound += Number(line.slice(3) || 0);
    if (line.startsWith('LH:')) totals.linesHit += Number(line.slice(3) || 0);
    if (line.startsWith('BRF:')) totals.branchesFound += Number(line.slice(4) || 0);
    if (line.startsWith('BRH:')) totals.branchesHit += Number(line.slice(4) || 0);
    if (line.startsWith('FNF:')) totals.functionsFound += Number(line.slice(4) || 0);
    if (line.startsWith('FNH:')) totals.functionsHit += Number(line.slice(4) || 0);
  }

  return totals;
}

function countExplicitAnyFromEslint(repoPath: string): number {
  const result = spawnSync(
    'pnpm',
    ['eslint', '.', '--format', 'json', '--cache', '--cache-location', 'node_modules/.cache/eslint-ratchet'],
    {
      cwd: repoPath,
      env: process.env,
      encoding: 'utf-8',
      shell: false,
    },
  );

  const raw = result.stdout?.trim();
  if (!raw) {
    return 0;
  }

  let reports: Array<{ messages?: Array<{ ruleId?: string | null }> }>;
  try {
    reports = JSON.parse(raw) as Array<{ messages?: Array<{ ruleId?: string | null }> }>;
  } catch {
    console.warn('::warning::Unable to parse eslint JSON output for explicit-any count.');
    return 0;
  }

  let count = 0;
  for (const report of reports) {
    for (const message of report.messages ?? []) {
      if (message.ruleId === '@typescript-eslint/no-explicit-any') {
        count += 1;
      }
    }
  }
  return count;
}

function main(): void {
  console.log('Quality ratchet report');
  console.log('──────────────────────');

  let hasFailure = false;

  let linesPct = 0;
  let branchesPct = 0;
  let functionsPct = 0;

  try {
    const lcovText = readFileSync(lcovPath, 'utf-8');
    const totals = parseLcovTotals(lcovText);
    linesPct = toPercent(totals.linesHit, totals.linesFound);
    branchesPct = toPercent(totals.branchesHit, totals.branchesFound);
    functionsPct = toPercent(totals.functionsHit, totals.functionsFound);
  } catch (error) {
    console.warn(`::warning::Could not read coverage report at ${lcovPath}`);
    if (config.enforce) {
      throw error;
    }
  }

  const explicitAnyCount = countExplicitAnyFromEslint(repoRoot);

  const checks = [
    { name: 'lines', value: linesPct, min: config.linesMin },
    { name: 'branches', value: branchesPct, min: config.branchesMin },
    { name: 'functions', value: functionsPct, min: config.functionsMin },
  ];

  for (const check of checks) {
    const ok = check.value >= check.min;
    console.log(`${check.name}: ${check.value.toFixed(2)}% (min ${check.min}%)`);
    if (!ok) {
      hasFailure = true;
      console.warn(
        `::warning::Coverage ${check.name} ${check.value.toFixed(2)}% is below informational minimum ${check.min}%`,
      );
    }
  }

  console.log(
    `explicit-any occurrences: ${explicitAnyCount} (max ${config.explicitAnyMax})`,
  );
  if (explicitAnyCount > config.explicitAnyMax) {
    hasFailure = true;
    console.warn(
      `::warning::Explicit any count ${explicitAnyCount} exceeds informational max ${config.explicitAnyMax}`,
    );
  }

  if (hasFailure && config.enforce) {
    console.error('Quality ratchet failed in enforce mode.');
    process.exit(1);
  }

  if (hasFailure) {
    console.log('Quality ratchet produced warnings (informational mode).');
    return;
  }

  console.log('Quality ratchet passed.');
}

main();
