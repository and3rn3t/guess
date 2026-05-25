/**
 * Refactor guardrail: fail when key orchestration files exceed agreed complexity ceilings.
 *
 * Metrics tracked per guarded file:
 *   lines       — total line count (blank + code)
 *   ownImports  — count of top-level import statements (lines starting with `import `).
 *                 Multi-line imports count as 1 since only the first line starts with `import `.
 *                 This is intentional — do not "fix" it.
 *
 * Flags:
 *   --report    Emit .ci-artifacts/checks-static/complexity-report.json and print a top-5
 *               closest-to-ceiling summary. Never fails on ungoverned hotspots (warnings only).
 *   --ratchet   Print suggested new ceilings (current value + 10% grace, rounded up to nearest 10).
 *               Manual only — never run in CI. Copy the output back to the rules array.
 *
 * Auto-scan: any .ts/.tsx file in {src,functions,scripts,packages} with >400 lines that is NOT
 * in the explicit rules list is reported as an ungoverned hotspot (warning, not a failure).
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

interface FileRule {
  path: string;
  maxLines: number;
  maxOwnImports: number;
}

interface FileMetrics {
  lines: number;
  ownImports: number;
}

interface ReportEntry extends FileMetrics {
  file: string;
  maxLines: number;
  maxOwnImports: number;
  lineHeadroom: number;
  importHeadroom: number;
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');

const rules: FileRule[] = [
  { path: 'src/App.tsx', maxLines: 500, maxOwnImports: 36 },
  { path: 'src/components/GamePhaseRouter.tsx', maxLines: 330, maxOwnImports: 14 },
  { path: 'src/components/PlayingScreen.tsx', maxLines: 600, maxOwnImports: 26 },
  { path: 'src/components/GameOver.tsx', maxLines: 480, maxOwnImports: 26 },
  { path: 'src/components/admin/routes/CharactersRoute.tsx', maxLines: 530, maxOwnImports: 18 },
  { path: 'src/components/admin/routes/LandingRoute.tsx', maxLines: 420, maxOwnImports: 20 },
  { path: 'src/components/admin/routes/DataQualityRoute.tsx', maxLines: 540, maxOwnImports: 14 },
  { path: 'src/hooks/useServerGame.ts', maxLines: 430, maxOwnImports: 12 },
  { path: 'functions/api/v2/game/start.ts', maxLines: 320, maxOwnImports: 12 },
  { path: 'functions/api/v2/game/answer.ts', maxLines: 360, maxOwnImports: 12 },
  { path: 'functions/api/v2/_game-engine.ts', maxLines: 340, maxOwnImports: 20 },
  { path: 'packages/game-engine/src/question-selection.ts', maxLines: 490, maxOwnImports: 12 },
  { path: 'scripts/ingest/run.ts', maxLines: 320, maxOwnImports: 22 },
  { path: 'scripts/ingest/enrich.ts', maxLines: 520, maxOwnImports: 14 },
  { path: 'scripts/ingest/enrich/storage.ts', maxLines: 400, maxOwnImports: 10 },
];

const AUTO_SCAN_DIRS = ['src', 'functions', 'scripts', 'packages'];
const AUTO_SCAN_THRESHOLD = 400;
// Exclude test files, data files, and generated tooling from auto-scan warnings.
// These are expected to be large and are not production orchestrators.
const AUTO_SCAN_EXCLUDE = /(__tests__|\.test\.[tj]sx?|src\/lib\/seed\/|scripts\/openapi\/lib)/;

function getMetrics(absPath: string): FileMetrics {
  const text = readFileSync(absPath, 'utf-8');
  const lineList = text.split('\n');
  const lines = lineList.length;
  const ownImports = lineList.filter((line) => line.trimStart().startsWith('import ')).length;
  return { lines, ownImports };
}

function* walkTs(dir: string): Generator<string> {
  let entries: import('node:fs').Dirent<string>[];
  try {
    entries = readdirSync(dir, { withFileTypes: true, encoding: 'utf-8' });
  } catch {
    return;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name === '.git') continue;
      yield* walkTs(full);
    } else if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx'))) {
      yield full;
    }
  }
}

function ratchetCeiling(current: number, factor = 1.1, step = 10): number {
  return Math.ceil((current * factor) / step) * step;
}

function main(): void {
  const args = process.argv.slice(2);
  const reportMode = args.includes('--report');
  const ratchetMode = args.includes('--ratchet');

  const failures: string[] = [];
  const warnings: string[] = [];
  const report: ReportEntry[] = [];

  console.log('Refactor complexity guard');
  console.log('─────────────────────────');

  const governedPaths = new Set(rules.map((r) => path.join(repoRoot, r.path)));

  for (const rule of rules) {
    const absPath = path.join(repoRoot, rule.path);

    if (!existsSync(absPath)) {
      warnings.push(`${rule.path}: file not found (rule may be stale)`);
      console.warn(`  ⚠ ${rule.path}: not found`);
      continue;
    }

    const metrics = getMetrics(absPath);
    const lineStatus = metrics.lines <= rule.maxLines ? 'ok' : 'exceeds';
    const importStatus = metrics.ownImports <= rule.maxOwnImports ? 'ok' : 'exceeds';

    const lineHeadroom = rule.maxLines - metrics.lines;
    const importHeadroom = rule.maxOwnImports - metrics.ownImports;

    console.log(
      `${rule.path} :: lines=${metrics.lines}/${rule.maxLines}(${lineStatus}) ownImports=${metrics.ownImports}/${rule.maxOwnImports}(${importStatus})`,
    );

    if (metrics.lines > rule.maxLines) {
      failures.push(`${rule.path}: line count ${metrics.lines} exceeds max ${rule.maxLines}`);
    }
    if (metrics.ownImports > rule.maxOwnImports) {
      failures.push(`${rule.path}: import count ${metrics.ownImports} exceeds max ${rule.maxOwnImports}`);
    }

    if (reportMode || ratchetMode) {
      report.push({
        file: rule.path,
        lines: metrics.lines,
        ownImports: metrics.ownImports,
        maxLines: rule.maxLines,
        maxOwnImports: rule.maxOwnImports,
        lineHeadroom,
        importHeadroom,
      });
    }
  }

  // Auto-scan: find ungoverned hotspots
  if (reportMode || ratchetMode) {
    const hotspots: ReportEntry[] = [];
    for (const dir of AUTO_SCAN_DIRS) {
      const absDir = path.join(repoRoot, dir);
      for (const absFile of walkTs(absDir)) {
        if (governedPaths.has(absFile)) continue;
        const rel = path.relative(repoRoot, absFile);
        if (AUTO_SCAN_EXCLUDE.test(rel)) continue;
        const metrics = getMetrics(absFile);
        if (metrics.lines > AUTO_SCAN_THRESHOLD) {
          hotspots.push({
            file: rel,
            lines: metrics.lines,
            ownImports: metrics.ownImports,
            maxLines: AUTO_SCAN_THRESHOLD,
            maxOwnImports: 999,
            lineHeadroom: AUTO_SCAN_THRESHOLD - metrics.lines,
            importHeadroom: 999,
          });
        }
      }
    }

    if (hotspots.length > 0) {
      console.log('');
      console.log('Ungoverned hotspots (>400 lines, not in rules):');
      const sorted = hotspots.sort((a, b) => b.lines - a.lines);
      for (const h of sorted) {
        console.warn(`  ⚠ ${h.file}: ${h.lines} lines`);
        warnings.push(`ungoverned hotspot: ${h.file} (${h.lines} lines)`);
      }
      report.push(...sorted);
    }
  }

  // Report mode: emit JSON artifact + top-5 summary
  if (reportMode) {
    const artifactDir = path.join(repoRoot, '.ci-artifacts', 'checks-static');
    mkdirSync(artifactDir, { recursive: true });
    const outPath = path.join(artifactDir, 'complexity-report.json');
    writeFileSync(outPath, JSON.stringify({ generatedAt: new Date().toISOString(), entries: report }, null, 2));
    console.log('');
    console.log(`Report written to ${path.relative(repoRoot, outPath)}`);

    const governed = report
      .filter((e) => governedPaths.has(path.join(repoRoot, e.file)))
      .sort((a, b) => a.lineHeadroom - b.lineHeadroom)
      .slice(0, 5);
    if (governed.length > 0) {
      console.log('');
      console.log('Top 5 closest to line ceiling:');
      for (const e of governed) {
        const pct = Math.round((e.lines / e.maxLines) * 100);
        console.log(`  ${e.file}: ${e.lines}/${e.maxLines} (${pct}%, ${e.lineHeadroom} lines headroom)`);
      }
    }
  }

  // Ratchet mode: print suggested new ceilings
  if (ratchetMode) {
    console.log('');
    console.log('Suggested ratcheted ceilings (current + 10% grace, rounded up to nearest 10):');
    console.log('Copy these back into the rules array in scripts/check-complexity.ts');
    console.log('');
    for (const rule of rules) {
      const entry = report.find((e) => e.file === rule.path);
      if (!entry) continue;
      const newMax = ratchetCeiling(entry.lines);
      const newImports = ratchetCeiling(entry.ownImports, 1.2);
      console.log(
        `  { path: '${rule.path}', maxLines: ${newMax}, maxOwnImports: ${newImports} },`,
      );
    }
  }

  if (failures.length > 0) {
    console.error('');
    console.error(`Complexity guard failed (${failures.length} issue(s)):`);
    for (const failure of failures) {
      console.error(`  - ${failure}`);
    }
    process.exit(1);
  }

  console.log('');
  console.log('All complexity checks passed.');
  if (warnings.length > 0) {
    console.log(`(${warnings.length} warning(s) — see ungoverned hotspots above)`);
  }
}

main();

