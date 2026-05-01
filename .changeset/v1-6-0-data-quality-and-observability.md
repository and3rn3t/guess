---
"guess": minor
---

Wave 2 (Data Quality Foundation) and Wave 3 kickoff (Observability).

**Data Quality (Wave 2 — all 10 items shipped):**

- DQ.1 — Golden character regression set + CI gate (50 chars / 755 cells, ≥97% threshold)
- DQ.2 — Vision-derived visual attributes (gpt-4o-mini, ≥90% gate, 92.04% on first run)
- DQ.21 — Schema drift detector (network-free CI gate, 224/224 schema↔migration parity)
- DQ.28 — Per-attribute evidence trail (every writer threaded; admin pill tooltips show source tags)
- DQ.3 — Cross-source agreement scorecard (`agreement_score` + UI ring + nightly compute)
- DQ.4 — Logical-constraint validator (mutex / requiresOneOf / implies; auto-files disputes)
- DQ.7 — Continuous quality dashboard (`/admin/data-quality` rollup KPI + 5 trend charts)
- DQ.5 — Player-answer corroboration loop (20-vote / 70%-disagreement → auto-dispute)
- DQ.6 — Nightly attribute reconciliation cron (re-evals 50 random chars/night)
- DQ.22 — Sparse-attribute auto-fill cron (popularity-ranked gap closure)

**Observability (Wave 3):**

- I.2 — Workers Analytics Engine for LLM costs (`LLM_COSTS` binding, HIT/MISS rows)
- I.4 — Tail Worker observability (split: standalone `guess-tail` Worker scaffolding +
  inline `_request_metrics.ts` middleware fallback after Pages rejected `tail_consumers`)

**Admin wiring guarantees:**

- AP.1 — Admin route smoke-test sweep (Playwright spec covers all 25 admin routes)

**Foundation polish (Wave 1 catch-up):**

- H.4 — Source map upload (R2-backed; `Resolve stack` action in `/admin/error-logs`)

See [CHANGELOG.md](../CHANGELOG.md) for full details on each item.
