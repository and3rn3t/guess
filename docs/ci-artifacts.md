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

### checks job

- Artifact: ci-checks-logs
- Contents:
  - lint.log
  - typecheck.log
  - test-coverage.log
- Use when: lint, type-check, or unit test coverage fails.

### build job

- Artifact: dist
- Contents: compiled app bundle for downstream jobs.
- Artifact: ci-build-logs
- Contents:
  - build.log
  - bundle-size.log
  - named-chunk-budgets.log
  - js-asset-sizes-kb.txt
- Use when: production build or bundle-size budget checks fail.

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
  - kv-attribute-trust.log
  - kv-character-popularity.log
  - kv-question-empirical-gain.log
  - kv-question-quality-penalty.log
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
- Artifact: reconcile-metadata
  - metadata.txt

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

## How to access artifacts

1. Open the workflow run in GitHub Actions.
2. Scroll to the Artifacts section in the run summary.
3. Download the artifact and inspect the relevant log file.

## Retention defaults

- Diagnostic logs generally use workflow-specific retention windows (commonly 14 or 30 days).
- Build outputs and generated reports use workflow-specific retention windows.
