/**
 * Refactor guardrail: fail when key orchestration files exceed agreed complexity ceilings.
 *
 * Current focus is intentionally small and explicit: line count and import fan-in
 * for the highest-risk orchestrator files. This keeps the rule predictable and
 * cheap to run in validate/CI.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

interface FileRule {
  path: string;
  maxLines: number;
  maxImports: number;
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');

const rules: FileRule[] = [
  { path: 'src/App.tsx', maxLines: 620, maxImports: 36 },
  { path: 'src/components/GamePhaseRouter.tsx', maxLines: 430, maxImports: 14 },
  { path: 'src/hooks/useServerGame.ts', maxLines: 430, maxImports: 12 },
  { path: 'functions/api/v2/game/start.ts', maxLines: 340, maxImports: 12 },
  { path: 'functions/api/v2/game/answer.ts', maxLines: 360, maxImports: 12 },
  { path: 'scripts/ingest/run.ts', maxLines: 320, maxImports: 22 },
  { path: 'scripts/ingest/enrich.ts', maxLines: 1280, maxImports: 16 },
];

interface FileMetrics {
  lines: number;
  imports: number;
}

function getMetrics(absPath: string): FileMetrics {
  const text = readFileSync(absPath, 'utf-8');
  const lines = text.split('\n').length;
  const imports = text
    .split('\n')
    .filter((line) => line.trimStart().startsWith('import ')).length;
  return { lines, imports };
}

function main(): void {
  const failures: string[] = [];

  console.log('Refactor complexity guard');
  console.log('─────────────────────────');

  for (const rule of rules) {
    const absPath = path.join(repoRoot, rule.path);
    const metrics = getMetrics(absPath);

    const lineStatus = metrics.lines <= rule.maxLines ? 'ok' : 'exceeds';
    const importStatus = metrics.imports <= rule.maxImports ? 'ok' : 'exceeds';

    console.log(
      `${rule.path} :: lines=${metrics.lines}/${rule.maxLines}(${lineStatus}) imports=${metrics.imports}/${rule.maxImports}(${importStatus})`,
    );

    if (metrics.lines > rule.maxLines) {
      failures.push(
        `${rule.path}: line count ${metrics.lines} exceeds max ${rule.maxLines}`,
      );
    }
    if (metrics.imports > rule.maxImports) {
      failures.push(
        `${rule.path}: import fan-in ${metrics.imports} exceeds max ${rule.maxImports}`,
      );
    }
  }

  if (failures.length > 0) {
    console.error('');
    console.error(`Complexity guard failed (${failures.length} issue(s)):`);
    for (const failure of failures) {
      console.error(`- ${failure}`);
    }
    process.exit(1);
  }

  console.log('');
  console.log('All complexity checks passed.');
}

main();
