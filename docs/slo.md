# Service Level Objectives

> Quantitative answer to "is the service healthy?". Targets and burn-rate
> thresholds for the two hot gameplay routes that define perceived UX.
> v1.9 baseline — ratchet down once four weeks of Analytics Engine data
> are collected.

## Scope

| Route | Why it's an SLO target |
| --- | --- |
| `POST /api/v2/game/start` | Defines time-to-first-question. Loads the character pool, computes initial probabilities, allocates a session. The user is staring at a loading state until this returns. |
| `POST /api/v2/game/answer` | Drives every question transition. Updates session state, recomputes the next question, and serves the chosen prompt. The user is staring at the answer-button affordance until this returns. |

Other routes (admin, cron, enrichment scripts) are explicitly **out of
scope** — they have no end-user SLA.

## Targets (v1.9 baseline)

| Indicator | `start` | `answer` | Source |
| --- | --- | --- | --- |
| Latency p95 (wall-time) | ≤ 800 ms | ≤ 400 ms | `worker_tail` AE dataset, `doubles[2]` (`wallMs`), filtered by `blobs[1]` path |
| Latency p99 (wall-time) | ≤ 1500 ms | ≤ 800 ms | same as p95 |
| Error rate (rolling 28 d) | ≤ 1.0 % | ≤ 1.0 % | `worker_tail` AE — `doubles[0]` (`status`) `>= 500` OR `blobs[3]` (`outcome`) ≠ `'ok'`; cross-check with `error_logs` D1 table |

- **Latency** is measured as the wall-time recorded by the Tail Worker
  (`tail-worker/src/_tail_metrics.ts`, `doubles[2]`). CPU time alone
  understates real perceived latency because it excludes D1 round-trips
  blocked on the network.
- **Error rate** is the share of fetch invocations whose outcome is not
  `ok` or whose HTTP status is `>= 500`. Client-induced 4xx (validation,
  malformed payloads) are excluded from the SLO numerator — they reflect
  bad clients, not service unhealth.
- **Window** is rolling 28 days. The error budget for a 1 % objective over
  28 days is `0.01 × total_requests` — every successful request earns the
  budget back as it slides out of the window.

## Burn-rate alerts

A burn rate of `1×` consumes the full 28-day budget in exactly 28 days.
The two thresholds below mirror Google's "fast burn / slow burn" SRE
pattern.

| Severity | Burn rate | Window | Budget consumed before page | Action |
| --- | --- | --- | --- | --- |
| **Fast burn (page)** | ≥ `14×` | 1 h | 2 % of monthly budget in 1 h | Page on-call. Likely deploy regression or upstream outage (D1 / KV). |
| **Slow burn (ticket)** | ≥ `6×` | 6 h | 10 % of monthly budget in 6 h | Open a ticket. Likely creeping latency from a hot table or LLM degradation. |

Both alerts must trigger **per route** — a regression on `answer` should
not be masked by a healthy `start` (they have different traffic shapes).

### Why these specific thresholds

- `14×` over 1 h × 1 h = 14 budget-hours = `14 / (24 × 28)` ≈ **2.08 %**
  of the 28-day budget. Catches deploy-induced regressions fast enough to
  roll back before the budget is gone, but ignores 60-second blips that
  resolve themselves.
- `6×` over 6 h × 6 h = 36 budget-hours ≈ **5.36 %** of the 28-day
  budget. (Conservative vs. the 10 % the roadmap row suggested — chosen
  to fire on the first sustained drift rather than waiting for half the
  budget to evaporate.) Catches the long tail of slow regressions that
  fast burn would miss.

Until alerting is wired, treat the burn query in
[slo-queries.sql](slo-queries.sql) as a once-a-day manual check.

## Data sources & caveats

The SLO has two stores:

1. **Workers Analytics Engine** (`worker_tail` / `worker_tail_preview`)
   — populated by [tail-worker/](../tail-worker/). Authoritative source
   for latency and request counts. Queried via the Cloudflare GraphQL /
   AE SQL API; sample queries belong in a follow-up `docs/ae-queries.md`
   once the API key plumbing lands (currently dashboard-only).
2. **D1 `error_logs`** — populated by `logError(...)` from
   `functions/api/_helpers.ts`. Forensic detail (stack, request context)
   for any error worth investigating. **Capped at 1 000 rows** by the
   ring-buffer in the helper, so burn calculations from D1 alone are
   directional, not authoritative. See
   [ARCHITECTURE.md → Error Pipeline](../ARCHITECTURE.md#error-pipeline).

The SQL queries in [slo-queries.sql](slo-queries.sql) operate on the D1
stores (`error_logs` + `game_stats`) because they're trivially runnable
against any environment with `wrangler d1 execute`. They give a
fast-feedback "is something obviously on fire?" signal; the AE dataset
gives the authoritative SLO numbers.

## Cross-references

- [ARCHITECTURE.md → Error Pipeline](../ARCHITECTURE.md#error-pipeline)
  — the two-stream observability model.
- [tail-worker/src/_tail_metrics.ts](../tail-worker/src/_tail_metrics.ts)
  — Tail event → AE data point mapper (canonical schema).
- [docs/sim-vs-real-queries.sql](sim-vs-real-queries.sql) — adjacent
  game-quality (not service-health) calibration queries.

## Open follow-ups

- **OB.2 (proposed)** — wire AE SQL queries + alert delivery. SLO targets
  are useless until burn alerts page someone.
- **OB.3 (proposed)** — once four weeks of `worker_tail` data are in,
  re-evaluate baseline numbers. Expect to tighten `answer` p95 to ~250 ms
  if the steady-state is comfortable.
