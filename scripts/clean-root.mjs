import { rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';

const root = process.cwd();

const targets = [
  '.ci-artifacts/checks-local',
  '.playwright-mcp',
  '.tmp-functions',
  '.wrangler',
  'coverage',
  'dist',
  'playwright-report',
  'test-results',
];

let removed = 0;

function containsTrackedFiles(target) {
  try {
    const output = execFileSync('git', ['ls-files', '--', target], {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    return output.trim().length > 0;
  } catch {
    return false;
  }
}

for (const target of targets) {
  if (containsTrackedFiles(target)) {
    console.log(`skipped ${target} (contains tracked files)`);
    continue;
  }

  const fullPath = resolve(root, target);
  try {
    await rm(fullPath, { recursive: true, force: true });
    console.log(`removed ${target}`);
    removed += 1;
  } catch (error) {
    console.error(`failed ${target}`);
    console.error(error);
    process.exitCode = 1;
  }
}

if (process.exitCode !== 1) {
  console.log(`done: removed ${removed} root artifact path(s)`);
}
