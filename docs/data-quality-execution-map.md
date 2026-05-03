# Data Quality Execution Map

Purpose: single planning map for unshipped Data Quality work with dependency order, current surfaces, and first implementation targets.

## Current Focus

- In progress: DQ.31 Definition of complete + release gate, DQ.33 null-closure queue
- Up next: DQ.32 SLA matrix, then DQ.34 source-ID completeness
- Priority note: AP.10 deferred intentionally while completeness foundations are built

## Foundations Already Shipped

- DQ.1, DQ.2, DQ.3, DQ.4, DQ.5, DQ.6, DQ.7, DQ.21, DQ.22, DQ.28
- Existing baseline surfaces:
  - `GET /api/admin/data-quality`
  - `/admin/data-quality`
  - `scripts/snapshot-data-quality.ts`
  - `data_quality_snapshots`, `attribute_drift`, `agreement_score`, `evidence`

## Completeness Program (Wave 5 Priority)

| Item | Status | Depends On | Existing Surface | New Surface Needed | Initial Slice |
|---|---|---|---|---|---|
| DQ.31 | In progress | DQ.32 | `functions/api/admin/data-quality.ts` | `scripts/data-quality/compute-completeness.ts`, CI gate integration, completeness API payload | compute script + API contract |
| DQ.32 | Up next | None | none | `data/attribute-completeness-sla.json`, `scripts/data-quality/check-sla.ts` | SLA config + validator |
| DQ.33 | In progress | DQ.31 + DQ.32 | sparse-fill + reconcile scripts | `scripts/data-quality/build-null-closure-queue.ts`, admin queue endpoint | queue generator dry run |
| DQ.34 | Not started | DQ.31 + DQ.32 | `characters.source`, `characters.source_id` | `scripts/data-quality/check-source-ids.ts`, `/api/admin/source-health` | source-id report JSON |
| DQ.35 | Not started | DQ.31 + DQ.32 | `characters.image_url` | `scripts/data-quality/check-image-health.ts`, `/api/admin/image-health` | image-health report JSON |
| DQ.36 | Not started | DQ.31 + DQ.32 | `attribute_disputes` | migration + `/api/admin/curation-queue` | schema + list endpoint |
| DQ.37 | Not started | DQ.31 + DQ.33 | `scripts/reconcile-attributes.ts` | `scripts/data-quality/select-risk-tier-sample.ts` + scheduler wiring | tier sampler utility |
| DQ.38 | Not started | DQ.31 + DQ.33 + DQ.34 + DQ.35 + DQ.36 | `reconcile-nightly.yml`, data-quality route | completeness sub-route + weekly markdown report artifact | report generator |

## Non-completeness DQ Backlog (Unshipped)

- Validation and triangulation: DQ.8, DQ.9, DQ.10, DQ.11
- Vision loops: DQ.12, DQ.13, DQ.14
- Player feedback loops: DQ.15, DQ.16, DQ.17
- Adversarial hardening: DQ.18, DQ.19, DQ.20
- Catalog automation: DQ.23, DQ.24, DQ.25, DQ.26
- Trust surfaces: DQ.27, DQ.29, DQ.30

## Execution Rules

1. Keep roadmap row state and code changes in the same commit.
2. Run `pnpm validate` after each slice.
3. Run `pnpm build && pnpm build:worker` before marking a row shipped.
4. If ordering changes, append a Decision Log row in `ROADMAP.md` in the same commit.
