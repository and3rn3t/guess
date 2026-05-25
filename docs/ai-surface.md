# AI Surface Audit

> **Status:** Phase 0 baseline doc for [Wave AI](../ROADMAP.md#wave-ai--ai-capabilities--skills). Owned by [AI.0](../ROADMAP.md#ai-0). Refreshed at the end of every Wave-AI phase so each later item has a measurable before/after.
>
> **Scope:** Every code path that calls an external LLM (OpenAI, OpenRouter) or a Cloudflare Workers AI model, and every binding / config / telemetry surface that backs them.
>
> **Not covered:** Local-only ML utilities (scoring math in `packages/game-engine/`), embeddings that have already been generated and persisted (those are data, not call sites).

---

## 1. Models in use

| Model | Provider | Routed via | First-class binding? | Used by |
|---|---|---|---|---|
| `gpt-4o` | OpenAI | AI Gateway (prod + preview, separate) | n/a (HTTP) | Game answer parsing (free-text), high-stakes admin endpoints, several CLI scripts (`improve-questions.ts`, `classify-difficulty.ts`, `propose-attributes.ts`, `discover-attributes.ts`) |
| `gpt-4o-mini` | OpenAI | AI Gateway | n/a (HTTP) | Default for most game + admin LLM endpoints, enrichment pipeline (`scripts/ingest/enrich/llm-client.ts`), `v2/_llm-rephrase.ts`, `DescribeYourselfScreen.tsx` |
| `gpt-4o-mini` (vision) | OpenAI | AI Gateway | n/a (HTTP) | `scripts/vision-validate.ts`, `scripts/vision-enrich-characters.ts` |
| 2nd-model (e.g. `google/gemma-3-27b-it`) | OpenRouter | Direct (no gateway) | n/a (HTTP) | Enrichment `--model2` consensus voting only |
| `@cf/baai/bge-base-en-v1.5` | Cloudflare Workers AI | `env.AI.run(…)` | `[ai] binding = "AI"` | Question-deduplication embeddings (B.4) only |

**Not yet adopted (Wave AI candidates):** `@cf/meta/llama-3.1-8b-instruct` (AI.3 tiered routing), `@cf/meta/llama-guard-3-8b` (AI.6 moderation), `@cf/llava-1.5-7b-hf` (AI.5 vision), `@cf/baai/bge-reranker-base` (AI.7), Vectorize (AI.9), Browser Rendering (AI.13), AutoRAG (AI.12).

---

## 2. Server endpoints (Pages Functions)

All routed through the AI Gateway when `CLOUDFLARE_AI_GATEWAY` is set (it is, in both envs).

| Endpoint | File | Model | JSON mode | App-side cache | Gateway cache TTL | Retry strategy |
|---|---|---|---|---|---|---|
| `POST /api/llm` | [functions/api/llm.ts](../functions/api/llm.ts) | `gpt-4o` / `gpt-4o-mini` (allow-list enforced) | Conditional (caller-supplied) | 24 h via `kv_cache` (D1) keyed on `sha256(prompt+model+jsonMode)` | **24 h** (AI.1, `cf-aig-cache-ttl`) | 3 attempts, 1 s + 3 s backoff, on 429/500/503 |
| `POST /api/llm-stream` | [functions/api/llm-stream.ts](../functions/api/llm-stream.ts) | same allow-list | n/a (SSE) | None (streaming) | Inapplicable | None — surfaces upstream errors directly |
| `POST /api/v2/_llm-rephrase` | [functions/api/v2/_llm-rephrase.ts](../functions/api/v2/_llm-rephrase.ts) | `gpt-4o-mini` | Yes | None | None — AI.1 follow-on candidate | None |
| `POST /api/admin/questions/[key]/score` | [functions/api/admin/questions/[key]/score.ts](../functions/api/admin/questions/[key]/score.ts) | `gpt-4o-mini` (admin) | Yes | None | None — AI.1 follow-on candidate | None |
| `GET /api/admin/coverage-priority` | [functions/api/admin/coverage-priority.ts](../functions/api/admin/coverage-priority.ts) | `gpt-4o-mini` | Yes | 6 h via `d1CachePut` | **6 h** (AI.1, `cf-aig-cache-ttl`) | None |
| `GET /api/admin/analytics/insights` | [functions/api/admin/analytics/insights.ts](../functions/api/admin/analytics/insights.ts) | `gpt-4o-mini` | Yes | 6 h via `d1CachePut` | **6 h** (AI.1, `cf-aig-cache-ttl`) | None |
| `GET /api/admin/questions/duplicates/*` | [functions/api/admin/questions/duplicates/](../functions/api/admin/questions/duplicates/) | `@cf/baai/bge-base-en-v1.5` (Workers AI) | n/a | Embeddings persisted in `attribute_embeddings` (D1 BLOB) | n/a | None — degrades gracefully when `env.AI` missing |

**Gateway-shared config**

- Endpoint resolver: [`getCompletionsEndpoint(env)`](../functions/api/_helpers.ts) returns `env.CLOUDFLARE_AI_GATEWAY` or falls back to `https://api.openai.com/v1/chat/completions`.
- Header builder: [`getLlmHeaders(env)`](../functions/api/_helpers.ts) attaches OpenAI `Authorization` plus `cf-aig-authorization` when `AI_GATEWAY_TOKEN` is set.
- Cost telemetry: [`recordLLMUsage(env, route, model, …)`](../functions/api/_llm_metrics.ts) writes to the `LLM_COSTS` Analytics Engine dataset on every call.

---

## 3. Client (browser) call sites

| File | Surface | Model | Notes |
|---|---|---|---|
| [src/lib/llm.ts](../src/lib/llm.ts) | `llmWithMeta()` + `llmStream()` — generic LLM client used by gameplay + admin UI | passes through to `/api/llm` / `/api/llm-stream` | Has its own retry layer (`LLM_MAX_RETRIES`, `LLM_RETRYABLE_STATUSES` in `constants.ts`); should be reviewed in AI.2 alongside the server-side retry. |
| [src/components/DescribeYourselfScreen.tsx](../src/components/DescribeYourselfScreen.tsx) | Mobile "describe yourself" flow | `gpt-4o-mini` | Single non-streaming call. |

---

## 4. Enrichment + CLI scripts (Node, `tsx`)

All call OpenAI **directly** (not via AI Gateway) because they run from a developer laptop / CI runner and don't hit the Pages worker.

| Script | File | Model | Notes |
|---|---|---|---|
| Bulk attribute enrichment | [scripts/ingest/enrich/llm-client.ts](../scripts/ingest/enrich/llm-client.ts) | `gpt-4o-mini` (default), optional `--model2` via OpenRouter | Module-level `RateLimiter(100, 400, 60_000)` — 400 RPM. Always JSON mode. **AI.3 target** for tiered routing. |
| Golden regression | [scripts/golden-regression.ts](../scripts/golden-regression.ts) | `gpt-4o-mini` (override via `GOLDEN_MODEL`) | CI gate for enrichment quality. |
| Vision validation | [scripts/vision-validate.ts](../scripts/vision-validate.ts) | `gpt-4o-mini` (vision) | Compares model answers to golden set; ≥90% agreement gate. |
| Vision enrichment (existing) | [scripts/vision-enrich-characters.ts](../scripts/vision-enrich-characters.ts) | `gpt-4o-mini` (vision) | **Coexists with AI.5**: AI.5 introduces a Workers AI Llava primary + GPT-4o-mini escalation pattern; this script's role to be revisited then. |
| Bulk enrich (one-off) | [scripts/bulk-enrich-characters.ts](../scripts/bulk-enrich-characters.ts) | `gpt-4o-mini` | Side path; same OpenAI direct fetch pattern. |
| Sparse-fill attributes | [scripts/sparse-fill-attributes.ts](../scripts/sparse-fill-attributes.ts) | `gpt-4o-mini` | |
| Reconcile attributes | [scripts/reconcile-attributes.ts](../scripts/reconcile-attributes.ts) | `gpt-4o-mini` | |
| Generate trivia | [scripts/generate-trivia.ts](../scripts/generate-trivia.ts) | `gpt-4o-mini` | |
| Propose attributes | [scripts/propose-attributes.ts](../scripts/propose-attributes.ts) | `gpt-4o` | Used to discover candidate new attributes. |
| Classify difficulty | [scripts/classify-difficulty.ts](../scripts/classify-difficulty.ts) | `gpt-4o` | Populates `questions.difficulty`. |
| Discover attributes | [scripts/ingest/discover-attributes.ts](../scripts/ingest/discover-attributes.ts) | `gpt-4o` | EP attribute-discovery pipeline. |
| Improve questions | [scripts/improve-questions.ts](../scripts/improve-questions.ts) | `gpt-4o` | |

**Observation:** seven CLI scripts call `https://api.openai.com/v1/chat/completions` directly. They bypass the AI Gateway entirely, which means they don't benefit from gateway caching, fallback chains, or evals (AI.11). Routing them through the gateway is out of scope for AI.0 but is a candidate follow-on item.

---

## 5. Cloudflare bindings & vars

From [wrangler.toml](../wrangler.toml):

| Binding | Type | Production | Preview | Used by |
|---|---|---|---|---|
| `AI` | Workers AI | shared | shared | Question dedup embeddings (`functions/api/admin/_embed.ts`). Free tier 10 k neurons/day. |
| `LLM_COSTS` | Analytics Engine dataset | `llm_costs` | `llm_costs_preview` | `recordLLMUsage()` per LLM call. Source of truth for Phase 0 baseline numbers. |
| `WORKER_TAIL` | Analytics Engine dataset | `worker_tail` | `worker_tail_preview` | Per-request observability (`functions/_middleware.ts` inline writer). |
| `CLOUDFLARE_AI_GATEWAY` (var) | Plain string | `andernet-ai` | `andernet-ai-preview` | Separate gateways since I.1 (2026-05-03) so preview LLM calls don't pollute prod dashboards. |
| `OPENAI_API_KEY` (secret) | Worker secret + `.dev.vars` | required | required | All OpenAI HTTP calls + every CLI script. |
| `OPENROUTER_API_KEY` (secret) | `.dev.vars` only | n/a (CLI) | n/a (CLI) | `--model2` consensus voting in enrichment. |
| `AI_GATEWAY_TOKEN` (secret) | Worker secret | optional | optional | Adds `cf-aig-authorization` header when present. |

---

## 6. Telemetry surfaces (already wired)

- **`LLM_COSTS` Analytics Engine** (I.2) — per-call rows with `route`, `model`, `prompt_tokens`, `completion_tokens`, `total_tokens`, `cost_usd`, `latency_ms`, `cached`, `retry_count`, `retry_outcome`. Query via CF dashboard SQL editor or the queries in [docs/slo-queries.sql](slo-queries.sql).
- **AI Gateway dashboard** (prod: `andernet-ai`, preview: `andernet-ai-preview`) — per-route cache hit ratio, p50/p95 latency, error rate, $/request.
- **Worker Tail Analytics Engine** (I.4) — `WORKER_TAIL` dataset; per-request `route`, `status`, `duration_ms`, `error_class`.
- **`error_logs` D1 table** (PI.3) — forensic detail for LLM errors that bubble out of retries (writes are now hot-path-decoupled via `context.waitUntil`).

---

## 7. Regression gates (already in CI)

| Gate | Script | Trigger | Pass criterion |
|---|---|---|---|
| Golden enrichment | `pnpm golden:regression` | PR + nightly | Deviation < 3 % on the golden set vs. checked-in baseline. |
| Vision validation | `pnpm vision:validate` | Nightly + on demand | Agreement ≥ 90 % on the visual subset of the golden set. |
| Data quality report | `pnpm dq:report` (DQ.v2.1) | Nightly (`reconcile-nightly`) | Warn-only for ≥ 7 nights, then blocking. |

Gaps Wave AI fills: no continuous evaluation of production prompts (AI.11), no cost regression gate (manual review of `LLM_COSTS`), no moderation suite (AI.6).

---

## 8. Baseline metrics

Snapshot pulled at the close of AI.0 and persisted to [data/ai-baseline-2026-05.json](../data/ai-baseline-2026-05.json). Every Wave-AI item refreshes the relevant fields in that file (not this doc) so improvements are measurable.

Numbers to capture (TODO — needs CF dashboard pull):

- **Cost (last 30 days):** $/day total, $/day per top-5 (route × model) combination.
- **Gateway cache:** hit ratio per cacheable route.
- **Latency:** p50 + p95 for `/api/llm`, `/api/v2/game/answer` (LLM-touching path), `/api/admin/questions/duplicates`.
- **Workers AI:** neurons consumed per day, % of 10 k daily free quota.
- **Enrichment:** $/character on the last full enrichment run, tokens per character (prompt + completion).
- **Error rate:** 5xx per 1 k LLM calls (server-side, post-retry).

---

## 9. Open questions (gating later items)

Tracked in `/memories/session/plan.md` § "Further considerations":

1. **AI.3 cost model** — cap Workers AI to free quota (overflow → 4o-mini) vs. pay for overage vs. dynamic split. *Recommend: cap.*
2. **AI.10 MCP auth** — bearer token vs. Cloudflare Access vs. public read-only + per-IP rate limit. *Recommend: Cloudflare Access.*
3. **AI.5 vision provider** — Llava only vs. GPT-4o-mini only vs. Llava primary + 4o-mini escalation. *Recommend: Llava + escalation.*

---

## 10. Change log

| Date | Change |
|---|---|
| 2026-05-25 | Initial audit (AI.0). Sections 1–7 written from code inspection; section 8 baseline numbers still TODO (need CF dashboard pull). |
| 2026-05-25 | AI.1 shipped: `cf-aig-cache-ttl` plumbed via `getLlmHeaders(env, ttl)` and opted in on `/api/llm` (24 h), `/api/admin/coverage-priority` (6 h), `/api/admin/analytics/insights` (6 h). Other admin LLM endpoints flagged as AI.1 follow-on candidates pending per-route audit. 7-day observation window for cache-hit ratio starts on next deploy. |
