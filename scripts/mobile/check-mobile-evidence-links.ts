#!/usr/bin/env tsx
/**
 * Mobile evidence-link guardrail.
 *
 * Fails when:
 * - Core parity rows are missing evidence references.
 * - Referenced repo files in canonical mobile docs do not exist.
 * - Referenced mobile CI artifact paths are not produced by mobile-ci workflow.
 * - Mobile artifact names are not documented in docs/ci-artifacts.md.
 */
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..', '..');

const PARITY_MATRIX = path.join(REPO_ROOT, 'docs', 'mobile', 'parity-matrix.md');
const QA_INDEX = path.join(REPO_ROOT, 'docs', 'mobile', 'ios-qa-evidence-index.md');
const RELEASE_PLAYBOOK = path.join(REPO_ROOT, 'docs', 'mobile', 'ios-release-handoff-playbook.md');
const CI_ARTIFACT_DOC = path.join(REPO_ROOT, 'docs', 'ci-artifacts.md');
const MOBILE_CI_WORKFLOW = path.join(REPO_ROOT, '.github', 'workflows', 'mobile-ci.yml');

const DOCS_TO_SCAN = [PARITY_MATRIX, QA_INDEX, RELEASE_PLAYBOOK];

const REPO_PATH_PREFIXES = [
  'apps/mobile/',
  'docs/mobile/',
  '.github/workflows/',
  'e2e/',
  'packages/',
  'scripts/',
  'ROADMAP.md',
  'CHANGELOG.md',
  'package.json',
] as const;

interface Failure {
  scope: string;
  message: string;
}

function toRepoRelative(filePath: string): string {
  return path.relative(REPO_ROOT, filePath).replaceAll(path.sep, '/');
}

function readUtf8(filePath: string): string {
  return readFileSync(filePath, 'utf-8');
}

function looksLikeRepoPath(candidate: string): boolean {
  if (candidate.startsWith('.ci-artifacts/mobile-ci/')) {
    return false;
  }
  if (candidate.includes('*') || candidate.includes('{') || candidate.includes('}')) {
    return false;
  }
  return REPO_PATH_PREFIXES.some((prefix) => candidate.startsWith(prefix));
}

function extractBacktickedValues(markdown: string): string[] {
  const values: string[] = [];
  const regex = /`([^`]+)`/g;
  let match: RegExpExecArray | null = regex.exec(markdown);
  while (match) {
    values.push(match[1].trim());
    match = regex.exec(markdown);
  }
  return values;
}

function collectEvidenceFromCoreRows(content: string): Failure[] {
  const failures: Failure[] = [];
  const lines = content.split(/\r?\n/);

  let inCoreSection = false;
  for (const line of lines) {
    if (line.startsWith('## Core Features')) {
      inCoreSection = true;
      continue;
    }

    if (inCoreSection && line.startsWith('---')) {
      break;
    }

    if (!inCoreSection || !line.startsWith('| **')) {
      continue;
    }

    const cells = line.split('|').map((cell) => cell.trim());
    if (cells.length < 12) {
      failures.push({
        scope: 'parity-matrix',
        message: `Malformed core feature row: ${line}`,
      });
      continue;
    }

    const feature = cells[1];
    const evidence = cells[10];
    if (evidence.length === 0 || !/`[^`]+`/.test(evidence)) {
      failures.push({
        scope: 'parity-matrix',
        message: `${feature} is missing evidence path references in the Evidence column.`,
      });
    }
    if (!evidence.includes('QA:')) {
      failures.push({
        scope: 'parity-matrix',
        message: `${feature} evidence should include a QA reference marker (QA: ...).`,
      });
    }
  }

  return failures;
}

function main(): void {
  const failures: Failure[] = [];

  for (const docPath of [...DOCS_TO_SCAN, CI_ARTIFACT_DOC, MOBILE_CI_WORKFLOW]) {
    if (!existsSync(docPath)) {
      failures.push({
        scope: 'bootstrap',
        message: `Required file is missing: ${toRepoRelative(docPath)}`,
      });
    }
  }

  if (failures.length > 0) {
    printAndExit(failures);
  }

  const parityMatrix = readUtf8(PARITY_MATRIX);
  const qaIndex = readUtf8(QA_INDEX);
  const releasePlaybook = readUtf8(RELEASE_PLAYBOOK);
  const ciArtifactsDoc = readUtf8(CI_ARTIFACT_DOC);
  const mobileCiWorkflow = readUtf8(MOBILE_CI_WORKFLOW);

  failures.push(...collectEvidenceFromCoreRows(parityMatrix));

  const allRefs = new Set<string>();
  for (const source of [parityMatrix, qaIndex, releasePlaybook]) {
    for (const value of extractBacktickedValues(source)) {
      allRefs.add(value);
    }
  }

  const artifactRefs = [...allRefs].filter((ref) => ref.startsWith('.ci-artifacts/mobile-ci/'));
  const repoRefs = [...allRefs].filter(looksLikeRepoPath);

  for (const ref of repoRefs) {
    const absolutePath = path.join(REPO_ROOT, ref);
    if (!existsSync(absolutePath)) {
      failures.push({
        scope: 'repo-evidence',
        message: `Referenced file does not exist: ${ref}`,
      });
    }
  }

  for (const artifactRef of artifactRefs) {
    const relativeArtifact = artifactRef.replace('.ci-artifacts/mobile-ci/', '');

    if (!mobileCiWorkflow.includes(artifactRef) && !mobileCiWorkflow.includes(relativeArtifact)) {
      failures.push({
        scope: 'workflow-evidence',
        message: `Artifact reference is not produced in mobile-ci workflow: ${artifactRef}`,
      });
    }

    if (!ciArtifactsDoc.includes(relativeArtifact) && !ciArtifactsDoc.includes(artifactRef)) {
      failures.push({
        scope: 'docs-evidence',
        message: `Artifact reference is not documented in docs/ci-artifacts.md: ${artifactRef}`,
      });
    }
  }

  console.log('mobile-evidence-links report');
  console.log('──────────────────────────');
  console.log(`Scanned docs: ${DOCS_TO_SCAN.map(toRepoRelative).join(', ')}`);
  console.log(`Repo references checked: ${repoRefs.length}`);
  console.log(`Artifact references checked: ${artifactRefs.length}`);

  if (failures.length === 0) {
    console.log('Status: PASS');
    return;
  }

  printAndExit(failures);
}

function printAndExit(failures: Failure[]): never {
  console.error('mobile-evidence-links report');
  console.error('──────────────────────────');
  console.error('Status: FAIL');
  console.error(`Failures: ${failures.length}`);
  for (const failure of failures) {
    console.error(`- [${failure.scope}] ${failure.message}`);
  }
  process.exit(1);
}

main();
