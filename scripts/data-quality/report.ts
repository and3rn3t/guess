#!/usr/bin/env npx tsx
/**
 * DQ.v2.1 — canonical `pnpm dq:report` orchestrator.
 *
 * Unions the four existing data-quality subsystems into a single artifact so
 * operators have one answer to "is data quality OK to ship?":
 *
 *   1. SLA shape           → `scripts/data-quality/check-sla.ts`        (offline)
 *   2. Golden-image audit  → `scripts/vision-validate.ts --check`        (offline)
 *   3. Completeness        → `scripts/data-quality/compute-completeness.ts --json`  (live D1)
 *   4. Null-closure queue  → `scripts/data-quality/build-null-closure-queue.ts --json` (live D1)
 *
 * Top-10 sparse attributes are derived from the null-closure queue summary
 * (highest queue-pair counts per attribute), which is the closest proxy to
 * "where is data quality bleeding most?" without re-querying D1.
 *
 * Outputs:
 *   - `.ci-artifacts/data-quality/report.json`  (machine-readable union)
 *   - `.ci-artifacts/data-quality/report.md`    (human summary)
 *
 * Usage:
 *   pnpm dq:report                         # production env, gate off (default)
 *   pnpm dq:report --env preview
 *   pnpm dq:report --env production --gate-mode warn --ci
 *   pnpm dq:report --env production --gate-mode fail --ci
 *
 * Exit codes:
 *   0 — report written; verdict not FAIL or gate-mode != fail
 *   1 — gate-mode=fail and any section is FAIL
 *   2 — orchestrator-level error (missing files, malformed JSON from a subcall)
 *
 * Live-D1 sections are skipped (status='skipped') when wrangler creds are
 * absent (no CLOUDFLARE_API_TOKEN and `--allow-skip` set). Default behavior is
 * to surface the error so CI gets a real signal.
 */
import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// ── Args & paths ─────────────────────────────────────────────────────────────

function flag(name: string, fallback = ''): string {
  const i = process.argv.indexOf(name);
  return i >= 0 ? (process.argv[i + 1] ?? fallback) : fallback;
}

const ENV_FLAG = flag('--env', 'production');
const GATE_MODE = (flag('--gate-mode', 'off') || 'off').toLowerCase();
const IS_CI = process.argv.includes('--ci');
const ALLOW_SKIP = process.argv.includes('--allow-skip');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..', '..');
const OUT_DIR = path.join(REPO_ROOT, '.ci-artifacts', 'data-quality');

// ── Types ────────────────────────────────────────────────────────────────────

type SectionStatus = 'pass' | 'warn' | 'fail' | 'skipped' | 'error';

interface SectionResult {
  status: SectionStatus;
  summary: string;
  details?: Record<string, unknown>;
  durationMs: number;
}

interface ReportPayload {
  generatedAt: string;
  env: string;
  gateMode: string;
  overall: { status: SectionStatus; reason: string };
  sections: {
    slaShape: SectionResult;
    goldenImage: SectionResult;
    completeness: SectionResult;
    nullClosure: SectionResult;
  };
  topSparseAttributes: Array<{ attributeKey: string; queuedPairs: number }>;
}

interface SpawnResult {
  ok: boolean;
  stdout: string;
  stderr: string;
  exitCode: number | null;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function runCli(args: string[]): SpawnResult {
  const result = spawnSync('npx', ['tsx', ...args], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    maxBuffer: 100 * 1024 * 1024,
    env: process.env,
  });
  const ok = result.status === 0 && !result.error;
  return {
    ok,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
    exitCode: result.status,
  };
}

function pct(v: number, decimals = 2): string {
  if (!Number.isFinite(v)) return 'n/a';
  return `${(v * 100).toFixed(decimals)}%`;
}

function isLiveD1Available(): boolean {
  // Live D1 queries shell out to `wrangler d1 execute --remote`, which
  // requires CLOUDFLARE_API_TOKEN (or interactive auth) and CLOUDFLARE_ACCOUNT_ID.
  return Boolean(process.env.CLOUDFLARE_API_TOKEN);
}

// ── Section 1: SLA shape (offline) ───────────────────────────────────────────

function runSlaShape(): SectionResult {
  const t0 = Date.now();
  const result = runCli(['scripts/data-quality/check-sla.ts']);
  const durationMs = Date.now() - t0;
  if (result.ok) {
    return {
      status: 'pass',
      summary: 'attribute-completeness-sla.json shape and ranges valid',
      durationMs,
    };
  }
  return {
    status: 'fail',
    summary: 'SLA file failed shape/range validation',
    details: { stderr: result.stderr.slice(-2000) },
    durationMs,
  };
}

// ── Section 2: Golden-image audit (offline) ──────────────────────────────────

function runGoldenImageAudit(): SectionResult {
  const t0 = Date.now();
  const result = runCli(['scripts/vision-validate.ts', '--check']);
  const durationMs = Date.now() - t0;
  if (result.ok) {
    // Parse the coverage line: "Loaded N golden characters · image cache covers M (no-image: X, missing-from-cache: 0)"
    const coverageRegex =
      /Loaded (\d+) golden characters · image cache covers (\d+) \(no-image: (\d+), missing-from-cache: (\d+)\)/;
    const match = coverageRegex.exec(result.stdout);
    const details = match
      ? {
          goldenCharacters: Number(match[1]),
          withImage: Number(match[2]),
          withoutImage: Number(match[3]),
          missingFromCache: Number(match[4]),
        }
      : undefined;
    return {
      status: 'pass',
      summary: 'golden image cache covers all golden characters',
      details,
      durationMs,
    };
  }
  // Schema-only failures (missing entries, unusable URLs) exit 1.
  return {
    status: 'fail',
    summary: 'golden image cache drift — missing or unusable entries',
    details: { stderr: result.stderr.slice(-2000) },
    durationMs,
  };
}

// ── Section 3: Completeness (live D1) ────────────────────────────────────────

interface CompletenessPayload {
  env: string;
  gateMode: string;
  inputs: {
    totalCharacters: number;
    activeAttributes: number;
    totalRequiredCells: number;
    filledRequiredCells: number;
    evidenceRows: number;
    sourceCoverageCount: number;
    openHighPriorityDisputes: number;
    categoryCompleteness: Record<string, number>;
  };
  result: {
    score: number;
    categoryFloorScore: number;
    gate: {
      warn: boolean;
      fail: boolean;
      categoriesBelowFloor: string[];
      disputeBudget: number;
    };
  };
}

function runCompleteness(): SectionResult {
  if (!isLiveD1Available()) {
    if (ALLOW_SKIP) {
      return {
        status: 'skipped',
        summary: 'CLOUDFLARE_API_TOKEN missing and --allow-skip set',
        durationMs: 0,
      };
    }
    return {
      status: 'error',
      summary: 'CLOUDFLARE_API_TOKEN missing (re-run with --allow-skip to bypass)',
      durationMs: 0,
    };
  }

  const t0 = Date.now();
  const result = runCli([
    'scripts/data-quality/compute-completeness.ts',
    '--env',
    ENV_FLAG,
    '--gate-mode',
    'off', // we own the verdict here; never let the child exit non-zero on warn/fail
    '--json',
  ]);
  const durationMs = Date.now() - t0;

  if (!result.ok) {
    return {
      status: 'error',
      summary: 'compute-completeness.ts exited non-zero',
      details: { stderr: result.stderr.slice(-2000), exitCode: result.exitCode },
      durationMs,
    };
  }

  let payload: CompletenessPayload;
  try {
    payload = JSON.parse(result.stdout) as CompletenessPayload;
  } catch (err) {
    return {
      status: 'error',
      summary: 'compute-completeness.ts emitted non-JSON output',
      details: { error: (err as Error).message, stdoutHead: result.stdout.slice(0, 500) },
      durationMs,
    };
  }

  let status: SectionStatus = 'pass';
  if (payload.result.gate.fail) status = 'fail';
  else if (payload.result.gate.warn) status = 'warn';

  return {
    status,
    summary: `data_complete_score=${payload.result.score.toFixed(4)} (${pct(payload.result.score)}); ${payload.inputs.totalCharacters.toLocaleString()} chars × ${payload.inputs.activeAttributes} attrs`,
    details: {
      score: payload.result.score,
      categoryFloorScore: payload.result.categoryFloorScore,
      gate: payload.result.gate,
      categoryCompleteness: payload.inputs.categoryCompleteness,
      totalRequiredCells: payload.inputs.totalRequiredCells,
      filledRequiredCells: payload.inputs.filledRequiredCells,
      evidenceRows: payload.inputs.evidenceRows,
      sourceCoverageCount: payload.inputs.sourceCoverageCount,
      openHighPriorityDisputes: payload.inputs.openHighPriorityDisputes,
    },
    durationMs,
  };
}

// ── Section 4: Null-closure queue (live D1) ──────────────────────────────────

interface NullClosurePayload {
  env: string;
  limit: number;
  slaVersion: number;
  totalCandidatePairs: number;
  summary: {
    totalPairs: number;
    automationPairs: number;
    manualPairs: number;
    categories: Record<string, number>;
    attributes: Record<string, number>;
  };
}

function runNullClosure(): { section: SectionResult; topSparse: Array<{ attributeKey: string; queuedPairs: number }> } {
  if (!isLiveD1Available()) {
    if (ALLOW_SKIP) {
      return {
        section: {
          status: 'skipped',
          summary: 'CLOUDFLARE_API_TOKEN missing and --allow-skip set',
          durationMs: 0,
        },
        topSparse: [],
      };
    }
    return {
      section: {
        status: 'error',
        summary: 'CLOUDFLARE_API_TOKEN missing (re-run with --allow-skip to bypass)',
        durationMs: 0,
      },
      topSparse: [],
    };
  }

  const t0 = Date.now();
  const result = runCli([
    'scripts/data-quality/build-null-closure-queue.ts',
    '--env',
    ENV_FLAG,
    '--json',
  ]);
  const durationMs = Date.now() - t0;

  if (!result.ok) {
    return {
      section: {
        status: 'error',
        summary: 'build-null-closure-queue.ts exited non-zero',
        details: { stderr: result.stderr.slice(-2000), exitCode: result.exitCode },
        durationMs,
      },
      topSparse: [],
    };
  }

  let payload: NullClosurePayload;
  try {
    payload = JSON.parse(result.stdout) as NullClosurePayload;
  } catch (err) {
    return {
      section: {
        status: 'error',
        summary: 'build-null-closure-queue.ts emitted non-JSON output',
        details: { error: (err as Error).message, stdoutHead: result.stdout.slice(0, 500) },
        durationMs,
      },
      topSparse: [],
    };
  }

  // Null-closure queue depth itself is informational, not pass/fail. We only
  // flag if the manual lane is ballooning vs the automation lane (>50%
  // manual = ops capacity risk).
  const manualShare =
    payload.summary.totalPairs > 0
      ? payload.summary.manualPairs / payload.summary.totalPairs
      : 0;
  let status: SectionStatus = 'pass';
  if (manualShare > 0.5) status = 'warn';

  const topSparse = Object.entries(payload.summary.attributes ?? {})
    .map(([attributeKey, queuedPairs]) => ({ attributeKey, queuedPairs }))
    .sort((a, b) => b.queuedPairs - a.queuedPairs)
    .slice(0, 10);

  return {
    section: {
      status,
      summary: `${payload.summary.totalPairs.toLocaleString()} queued pairs (auto: ${payload.summary.automationPairs.toLocaleString()}, manual: ${payload.summary.manualPairs.toLocaleString()}); manual share ${pct(manualShare)}`,
      details: {
        totalCandidatePairs: payload.totalCandidatePairs,
        summary: payload.summary,
        manualShare,
        slaVersion: payload.slaVersion,
        limit: payload.limit,
      },
      durationMs,
    },
    topSparse,
  };
}

// ── Roll-up verdict ──────────────────────────────────────────────────────────

function rollUpOverall(sections: ReportPayload['sections']): { status: SectionStatus; reason: string } {
  const values = Object.entries(sections);
  const failing = values.filter(([, s]) => s.status === 'fail' || s.status === 'error');
  if (failing.length > 0) {
    return {
      status: failing.some(([, s]) => s.status === 'fail') ? 'fail' : 'error',
      reason: `${failing.length} section(s) failing: ${failing.map(([k]) => k).join(', ')}`,
    };
  }
  const warning = values.filter(([, s]) => s.status === 'warn');
  if (warning.length > 0) {
    return {
      status: 'warn',
      reason: `${warning.length} section(s) warning: ${warning.map(([k]) => k).join(', ')}`,
    };
  }
  const skipped = values.filter(([, s]) => s.status === 'skipped');
  if (skipped.length === values.length) {
    return { status: 'skipped', reason: 'all sections skipped (no live D1 access)' };
  }
  if (skipped.length > 0) {
    return {
      status: 'pass',
      reason: `pass with ${skipped.length} section(s) skipped: ${skipped.map(([k]) => k).join(', ')}`,
    };
  }
  return { status: 'pass', reason: 'all sections pass' };
}

// ── Markdown formatter ───────────────────────────────────────────────────────

const STATUS_BADGE: Record<SectionStatus, string> = {
  pass: '✅ pass',
  warn: '⚠️ warn',
  fail: '❌ fail',
  error: '🚨 error',
  skipped: '⚪ skipped',
};

function renderMarkdown(report: ReportPayload): string {
  const { sections, overall, topSparseAttributes } = report;

  const lines: string[] = [
    `# Data Quality Report — ${report.generatedAt.slice(0, 10)}`,
    '',
    `> Env: \`${report.env}\` · Gate mode: \`${report.gateMode}\` · Generated: ${report.generatedAt}`,
    '',
    `## Overall: ${STATUS_BADGE[overall.status]}`,
    '',
    `_${overall.reason}_`,
    '',
    '## Sections',
    '',
    '| Section | Status | Summary | Duration |',
    '|---------|--------|---------|----------|',
    `| SLA shape | ${STATUS_BADGE[sections.slaShape.status]} | ${sections.slaShape.summary} | ${sections.slaShape.durationMs} ms |`,
    `| Golden-image audit | ${STATUS_BADGE[sections.goldenImage.status]} | ${sections.goldenImage.summary} | ${sections.goldenImage.durationMs} ms |`,
    `| Completeness | ${STATUS_BADGE[sections.completeness.status]} | ${sections.completeness.summary} | ${sections.completeness.durationMs} ms |`,
    `| Null-closure queue | ${STATUS_BADGE[sections.nullClosure.status]} | ${sections.nullClosure.summary} | ${sections.nullClosure.durationMs} ms |`,
    '',
  ];

  if (topSparseAttributes.length > 0) {
    lines.push(
      '## Top-10 Sparse Attributes',
      '',
      '_Ranked by queued pairs in the null-closure queue._',
      '',
      '| Rank | Attribute | Queued Pairs |',
      '|------|-----------|--------------|',
      ...topSparseAttributes.map(
        (row, i) => `| ${i + 1} | \`${row.attributeKey}\` | ${row.queuedPairs.toLocaleString()} |`,
      ),
      '',
    );
  } else {
    lines.push('## Top-10 Sparse Attributes', '', '_No queue data available._', '');
  }

  // Completeness detail (most actionable section)
  if (sections.completeness.status !== 'skipped' && sections.completeness.status !== 'error') {
    const d = sections.completeness.details as
      | {
          score: number;
          categoryFloorScore: number;
          gate: { categoriesBelowFloor: string[]; disputeBudget: number };
          categoryCompleteness: Record<string, number>;
          openHighPriorityDisputes: number;
        }
      | undefined;
    if (d) {
      lines.push(
        '## Completeness Detail',
        '',
        `- **Score:** ${d.score.toFixed(4)} (${pct(d.score)})`,
        `- **Category floor score:** ${pct(d.categoryFloorScore)}`,
        `- **Categories below floor:** ${d.gate.categoriesBelowFloor.length > 0 ? d.gate.categoriesBelowFloor.join(', ') : '_none_'}`,
        `- **Open high-priority disputes:** ${d.openHighPriorityDisputes} / ${d.gate.disputeBudget}`,
        '',
        '### Per-category completeness',
        '',
        '| Category | Completeness |',
        '|----------|--------------|',
        ...Object.entries(d.categoryCompleteness)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([cat, score]) => `| ${cat} | ${pct(score)} |`),
        '',
      );
    }
  }

  lines.push(
    '---',
    `_Report generated by \`scripts/data-quality/report.ts\` (DQ.v2.1). Machine artifact: \`.ci-artifacts/data-quality/report.json\`._`,
  );

  return lines.join('\n');
}

// ── Main ─────────────────────────────────────────────────────────────────────

function main(): void {
  console.log('DQ canonical report');
  console.log('-------------------');
  console.log(`env       : ${ENV_FLAG}`);
  console.log(`gate mode : ${GATE_MODE}`);
  console.log(`live D1   : ${isLiveD1Available() ? 'available' : 'unavailable'}`);
  console.log('');

  const slaShape = runSlaShape();
  console.log(`[1/4] SLA shape          : ${STATUS_BADGE[slaShape.status]} (${slaShape.durationMs} ms)`);

  const goldenImage = runGoldenImageAudit();
  console.log(`[2/4] Golden-image audit : ${STATUS_BADGE[goldenImage.status]} (${goldenImage.durationMs} ms)`);

  const completeness = runCompleteness();
  console.log(`[3/4] Completeness       : ${STATUS_BADGE[completeness.status]} (${completeness.durationMs} ms)`);

  const nullClosureResult = runNullClosure();
  const nullClosure = nullClosureResult.section;
  console.log(`[4/4] Null-closure queue : ${STATUS_BADGE[nullClosure.status]} (${nullClosure.durationMs} ms)`);

  const sections: ReportPayload['sections'] = { slaShape, goldenImage, completeness, nullClosure };
  const overall = rollUpOverall(sections);

  const report: ReportPayload = {
    generatedAt: new Date().toISOString(),
    env: ENV_FLAG,
    gateMode: GATE_MODE,
    overall,
    sections,
    topSparseAttributes: nullClosureResult.topSparse,
  };

  mkdirSync(OUT_DIR, { recursive: true });
  const jsonPath = path.join(OUT_DIR, 'report.json');
  const mdPath = path.join(OUT_DIR, 'report.md');
  writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  writeFileSync(mdPath, `${renderMarkdown(report)}\n`, 'utf8');

  console.log('');
  console.log(`overall  : ${STATUS_BADGE[overall.status]} — ${overall.reason}`);
  console.log(`report   : ${path.relative(REPO_ROOT, jsonPath)}`);
  console.log(`summary  : ${path.relative(REPO_ROOT, mdPath)}`);

  if (IS_CI && (overall.status === 'warn' || overall.status === 'fail' || overall.status === 'error')) {
    const level = overall.status === 'warn' ? 'warning' : 'error';
    console.log(`::${level}::dq:report overall verdict ${overall.status.toUpperCase()} — ${overall.reason}`);
  }

  if (GATE_MODE === 'fail' && (overall.status === 'fail' || overall.status === 'error')) {
    process.exit(1);
  }
}

main();
