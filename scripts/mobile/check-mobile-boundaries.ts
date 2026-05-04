#!/usr/bin/env tsx
/**
 * Mobile native-boundary guardrail.
 *
 * Fails when apps/mobile contains obvious web-port drift:
 * - imports from web UI trees
 * - web-only UI libraries
 * - browser/DOM globals
 *
 * Safe behavior:
 * - If apps/mobile does not exist yet, exits 0 with an informational message.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..', '..');
const MOBILE_ROOT = path.join(REPO_ROOT, 'apps', 'mobile');

interface Violation {
  file: string;
  line: number;
  reason: string;
  snippet: string;
}

const SCAN_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs']);

const FORBIDDEN_PATTERNS: Array<{ regex: RegExp; reason: string }> = [
  // Web UI trees from this repository
  { regex: /from\s+['"]@?\/?src\/components\//, reason: 'Importing web component tree is forbidden in mobile.' },
  { regex: /from\s+['"]@\/components\//, reason: 'Importing web component tree is forbidden in mobile.' },

  // Web-only UI/runtime libs
  { regex: /from\s+['"]motion\/react['"]/, reason: 'motion/react is web-only in this project.' },
  { regex: /from\s+['"]next-themes['"]/, reason: 'next-themes is web-only and not allowed in mobile.' },
  { regex: /from\s+['"]@radix-ui\//, reason: '@radix-ui/* is web-only and not allowed in mobile.' },

  // Browser globals and storage APIs
  { regex: /\bwindow\b/, reason: 'window global suggests DOM usage and is not allowed in mobile surface.' },
  { regex: /\bdocument\b/, reason: 'document global suggests DOM usage and is not allowed in mobile surface.' },
  { regex: /\bnavigator\b/, reason: 'navigator global suggests browser API usage and is not allowed in mobile surface.' },
  { regex: /\blocalStorage\b/, reason: 'localStorage is browser-only; use mobile storage adapter.' },
  { regex: /\bsessionStorage\b/, reason: 'sessionStorage is browser-only; use mobile storage adapter.' },
  { regex: /\bserviceWorker\b/, reason: 'serviceWorker is browser-only and out of mobile scope.' },
  { regex: /beforeinstallprompt/, reason: 'beforeinstallprompt is PWA-only and out of mobile scope.' },
];

function listCodeFiles(dir: string): string[] {
  const results: string[] = [];
  const entries = readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name === '.expo') continue;
      results.push(...listCodeFiles(full));
      continue;
    }
    const ext = path.extname(entry.name);
    if (!SCAN_EXTENSIONS.has(ext)) continue;
    results.push(full);
  }
  return results;
}

function scanFile(filePath: string): Violation[] {
  const content = readFileSync(filePath, 'utf-8');
  const lines = content.split(/\r?\n/);
  const violations: Violation[] = [];

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    for (const pattern of FORBIDDEN_PATTERNS) {
      if (!pattern.regex.test(line)) continue;
      violations.push({
        file: path.relative(REPO_ROOT, filePath),
        line: i + 1,
        reason: pattern.reason,
        snippet: line.trim(),
      });
    }
  }

  return violations;
}

function main(): void {
  if (!existsSync(MOBILE_ROOT)) {
    console.log('mobile-guardrails: apps/mobile not found; skipping checks.');
    return;
  }

  const files = listCodeFiles(MOBILE_ROOT);
  if (files.length === 0) {
    console.log('mobile-guardrails: no code files found under apps/mobile.');
    return;
  }

  const violations = files.flatMap(scanFile);

  console.log('mobile-guardrails report');
  console.log('───────────────────────');
  console.log(`Scanned files: ${files.length}`);

  if (violations.length === 0) {
    console.log('Status: PASS');
    return;
  }

  console.error('Status: FAIL');
  console.error(`Violations: ${violations.length}`);
  for (const v of violations) {
    console.error(`- ${v.file}:${v.line}`);
    console.error(`  reason: ${v.reason}`);
    console.error(`  code: ${v.snippet}`);
  }

  console.error('');
  console.error('Fix guidance:');
  console.error('- Use native adapters and React Native primitives in apps/mobile.');
  console.error('- Keep shared logic in packages/app-core or packages/game-engine.');
  process.exit(1);
}

main();
