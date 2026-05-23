# CI Artifacts and Logs

This document describes the artifacts produced by GitHub Actions workflows and what to inspect when a step fails.

## Observability convention

- Workflow command steps that need diagnostics use `set -o pipefail` and `tee` logs into `.ci-artifacts/<workflow>/`.
- Log and metadata files are uploaded with `actions/upload-artifact` for post-run debugging.
- Jobs add a short `$GITHUB_STEP_SUMMARY` section listing artifact names.
- Shared actions used across workflows:
  - `.github/actions/setup`
  - `.github/actions/verify-secrets`
  - `.github/actions/smoke-test-url`

## Main CI workflow

Source: .github/workflows/ci.yml

### checks-static job

- Artifact: ci-checks-static-logs
- Contents:
  - lint.log
  - typecheck.log
  - dq-sla-check.log
  - mobile-guardrails.log
  - openapi-generate.log
  - openapi-validate.log
  - openapi-check.log
  - refactor-guard.log
  - knip.log
  - complexity-report.json (JSON report with line/import metrics for all governed + ungoverned hotspot files)
- Use when: lint, type-check, OpenAPI contract checks, or complexity guard fail.

### checks-tests job

- Artifact: ci-checks-tests-logs
- Contents:
  - test-coverage.log
- Use when: unit test coverage fails.

### build job

- Artifact: dist
- Contents: compiled app bundle for downstream jobs.
- Artifact: ci-build-logs
- Contents:
  - build.log
  - worker-build.log
  - bundle-size.log
  - named-chunk-budgets.log
  - js-asset-sizes-kb.txt
  - css-asset-sizes-kb.txt
- Use when: production build or bundle-size budget checks fail.

## Mobile CI workflow

Source: .github/workflows/mobile-ci.yml

### checks job

- Artifact: mobile-ci-{run_id}
- Contents:
  - typecheck.log — mobile TypeScript typecheck output
  - guardrails.log — boundary violation scan + evidence-link guard output
  - evidence-links.log — canonical mobile evidence-link integrity check (docs refs, repo paths, workflow artifact linkage)
  - reliability-perf-gate.log — mobile Vitest gate for perf budgets, transport resilience, and session durability
  - mobile-core-flow-e2e.log — Playwright mobile core-flow lane output
  - scorecard-milestone.log — milestone gate result on `main` push events
  - scorecard-production.log — production gate result on `main` push events (warn-only rollout)
  - scorecard-production-status.txt — one-line pass/fail status for production gate telemetry
- Use when: mobile typecheck, runtime reliability checks, or boundary guardrails fail on mobile-touching PRs.
- Triggered by: changes to `apps/mobile/**`, `packages/app-core/**`, or `packages/game-engine/**`.

### eas-build job

- Runs on `main` merges only (after `checks` passes).
- Submits an iOS `preview` build to EAS Build.
- Uses `EXPO_TOKEN` secret. Set in repo settings before enabling.
- Build profile: `preview` in `apps/mobile/eas.json` (`credentialsSource: local`).

## Docs link workflow

Source: .github/workflows/docs-links.yml

### links job

- Artifact: ci-docs-links-logs
- Contents:
  - lychee-out.md
- Use when: markdown/docs links fail validation (warn-only rollout mode).
- Rollout toggle: set `DOCS_LINKS_ENFORCE: 'true'` in `.github/workflows/docs-links.yml`.

## Online validation workflow

Source: .github/workflows/online-validation.yml

### validate-online job

- Artifact: ci-online-validation-logs
- Contents:
  - validate-online.log
  - dq-sla-check.log
  - dq-completeness.log
- Use when: credentialed validation checks (D1 dry-run, vision gate, completeness gate) fail or were unexpectedly skipped.
- Rollout toggle: set `DQ_COMPLETENESS_ENFORCE: 'true'` in `.github/workflows/online-validation.yml` to enforce the completeness gate.

## Strict changed workflow

Source: .github/workflows/strict-changed.yml

### strict job

- Artifact: ci-strict-changed-logs
- Contents:
  - validate-strict.log
- Use when: strict lane failures need triage during warn-only rollout.
- Rollout toggle: set `STRICT_CHANGED_ENFORCE: 'true'` in `.github/workflows/strict-changed.yml`.

## Quality ratchet workflow

Source: .github/workflows/quality-ratchet.yml

### ratchet job

- Artifact: ci-quality-ratchet-logs
- Contents:
  - typecheck.log
  - test-coverage.log
  - quality-ratchet.log
- Use when: coverage/type-quality trend warnings need analysis before enforcing ratchets.
- Rollout toggle: set `QUALITY_RATCHET_ENFORCE: 'true'` in `.github/workflows/quality-ratchet.yml`.

### db-checks job

- Artifact: ci-db-checks-logs
- Contents:
  - db-types.log
  - db-drift.log
  - migrate-validate.log
  - migrate-dry-run-preview.log
- Use when: migration validation or generated DB type drift checks fail.

### test-e2e job

- Artifact: playwright-report
- Contents: Playwright HTML report and traces.
- Use when: browser E2E tests fail.

### deploy-preview job

- Artifact: ci-deploy-preview-metadata
- Contents: metadata.txt with preview URL, PR title, branch, and commit SHA.
- Use when: preview deploy/smoke test fails or preview URL needs auditing.

### deploy-production job

- Artifact: ci-deploy-production-metadata
- Contents: metadata.txt with production URL, commit subject, and commit SHA.
- Use when: production deploy/smoke test fails or deployment provenance needs auditing.

## Data quality gate workflows

### Golden regression

Source: .github/workflows/golden-regression.yml

- Artifact: golden-schema-logs
  - schema-check.log
- Artifact: golden-regression-report
  - golden-report.json
- Artifact: golden-llm-logs
  - golden-regression.log

### Vision validation

Source: .github/workflows/vision-validate.yml

- Artifact: vision-schema-logs
  - schema-check.log
- Artifact: vision-validation-report
  - vision-report.json
- Artifact: vision-llm-logs
  - vision-validation.log

## Scheduled workflows

### Real-game signal aggregation

Source: .github/workflows/real-data-aggregate.yml

- Artifact: real-data-aggregate-diagnostics
- Contents:
  - metadata.txt
  - aggregate.log
  - d1-attribute-trust.log
  - d1-character-popularity.log
  - d1-question-empirical-gain.log
  - d1-question-quality-penalty.log
  - d1-character-confusions.log
  - attribute-trust.json
  - character-popularity.json
  - question-empirical-gain.json
  - question-quality-penalty.json
  - character-confusions.sql

### Adaptive data refresh

Source: .github/workflows/adaptive-data-refresh.yml

- Artifact: adaptive-export-diagnostics
  - export.log
  - metadata.txt
- Artifact: adaptive-simulate-diagnostics-easy
  - simulate-easy.log
  - metadata-easy.txt
- Artifact: adaptive-simulate-diagnostics-medium
  - simulate-medium.log
  - metadata-medium.txt
- Artifact: adaptive-simulate-diagnostics-hard
  - simulate-hard.log
  - metadata-hard.txt
- Artifact: adaptive-compute-diagnostics
  - merge.log
  - maybe-rates.log
  - net-gains.log
  - confusion-discriminators.log
  - kv-maybe-rates.log
  - kv-net-gains.log
  - kv-confusion-discriminators.log
  - maybe-rates.json
  - net-gains.json
  - confusion-discriminators.json

### Reconcile nightly

Source: .github/workflows/reconcile-nightly.yml

- Artifact: attribute-drift-sql
- Artifact: reconcile-log
  - reconcile-output.log
- Artifact: reconcile-risk-tier-log
  - risk-tier.log
- Artifact: reconcile-risk-tier-sample
  - risk-tier-sample.json
- Artifact: reconcile-metadata
  - metadata.txt
- Artifact: reconcile-perf-baseline-pre
  - perf-baseline-pre.md
  - perf-baseline-pre.log
- Artifact: reconcile-perf-baseline-post
  - perf-baseline-post.md
  - perf-baseline-post.log
- Artifact: reconcile-perf-baseline-delta
  - perf-baseline-delta.md
  - perf-baseline-delta.log

### Sparse-fill nightly

Source: .github/workflows/sparse-fill-nightly.yml

- Artifact: sparse-fill-sql
- Artifact: sparse-fill-log
  - sparse-fill-output.log
- Artifact: sparse-fill-metadata
  - metadata.txt

### Bulk enrichment nightly

Source: .github/workflows/enrich-bulk-nightly.yml

- Artifact: bulk-enrich-sql
- Artifact: bulk-enrich-log
  - bulk-enrich-output.log
- Artifact: bulk-enrich-metadata
  - metadata.txt

### Schema drift detector

Source: .github/workflows/schema-drift.yml

- No artifacts uploaded — exits non-zero on drift; inspect the workflow log directly.
- Use when: `pnpm schema:check` fails in CI (attribute schema ↔ migrations ↔ golden set out of sync).

### Corroborate nightly

Source: .github/workflows/corroborate-nightly.yml

- Artifact: corroboration-disputes-sql
  - disputes-*.sql (generated dispute SQL, ready to apply)
- Artifact: corroborate-log
  - corroborate-output.log
- Artifact: corroborate-metadata
  - metadata.txt
- Use when: player-answer corroboration run fails or generated SQL needs review before applying.

### Adaptive data refresh

Source: .github/workflows/adaptive-data-refresh.yml

- Artifact: adaptive-export-diagnostics
  - export.log, metadata.txt (simulation data export)
- Artifact: adaptive-simulate-diagnostics-{difficulty}
  - simulate-{difficulty}.log, metadata-{difficulty}.txt (per-difficulty simulation run)
- Artifact: adaptive-compute-diagnostics
  - merge.log, maybe-rates.log, net-gains.log (signal computation)
- Use when: adaptive weight refresh, maybe-rate, or net-gain aggregation fails mid-pipeline.

## How to access artifacts

1. Open the workflow run in GitHub Actions.
2. Scroll to the Artifacts section in the run summary.
3. Download the artifact and inspect the relevant log file.

## Retention defaults

- Diagnostic logs generally use workflow-specific retention windows (commonly 14 or 30 days).
- Build outputs and generated reports use workflow-specific retention windows.
