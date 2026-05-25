# Roadmap Archive — v1.8 Mobile Wave (May 2026)

> Archived on 2026-05-25 when `ROADMAP.md` was reframed from mobile-only back to full-product for v1.9.
>
> Predecessor archive: [ROADMAP-archive-v1.6.1-mobile-pivot-2026-05-11.md](ROADMAP-archive-v1.6.1-mobile-pivot-2026-05-11.md).

This archive preserves the full "Done when" criteria, evidence references, and decision log entries from the mobile-only roadmap chapter that ran 2026-05-11 → 2026-05-25. All items below are `✅` shipped. For the active roadmap, see [ROADMAP.md](../ROADMAP.md).

---

## Mobile planning inputs (still authoritative)

- [docs/mobile/ios-feature-parity-plan.md](mobile/ios-feature-parity-plan.md)
- [docs/mobile/parity-matrix.md](mobile/parity-matrix.md)
- [docs/mobile/ios-documentation-program.md](mobile/ios-documentation-program.md)
- [docs/mobile/ios-qa-evidence-index.md](mobile/ios-qa-evidence-index.md)
- [docs/mobile/device-validation-checklist.md](mobile/device-validation-checklist.md)
- [docs/mobile/ios-release-handoff-playbook.md](mobile/ios-release-handoff-playbook.md)
- [docs/mobile/roadmap-foundations.md](mobile/roadmap-foundations.md)

---

## Wave 1 — Release Closeout

### MR.1 — Release-documentation closeout + parity evidence normalization
**Status:** ✅ 2026-05-11
**Source consolidation:** MP.7 done-when items, QA index, release playbook

Done when:

- [x] `parity-matrix.md` evidence column normalized for all shipped rows (consistent artifact references).
- [x] Owner signatures and last-verified dates current for all in-scope rows.
- [x] `xcode-claude-memory-handoff.md` includes latest known edge cases and API behavior notes.
- [x] `CHANGELOG.md` has a clean mobile release summary for MP.6/MP.7 closure scope.

Primary files: `docs/mobile/parity-matrix.md`, `docs/mobile/xcode-claude-memory-handoff.md`, `CHANGELOG.md`.

### MR.2 — App Store / TestFlight submission readiness gate
**Status:** ✅ 2026-05-11
**Source consolidation:** release playbook preflight + MP.7 checklist

Done when:

- [x] TestFlight/App Store preflight checklist completed and captured in docs.
- [x] Functional preflight pass documented for Welcome → Playing → Guessing → Game Over, Challenge, Resume, Feedback, Preferences, Teaching, Stats, History, Compare.
- [x] Quality preflight pass documented (VoiceOver, Dynamic Type, reduced motion, performance budgets, airplane mode).
- [x] Known intentional web divergences explicitly listed in release notes.

Primary files: `docs/mobile/ios-release-handoff-playbook.md`, `docs/mobile/parity-matrix.md`, `CHANGELOG.md`.

### MR.3 — Post-MP.7 evidence debt cleanup
**Status:** ✅ 2026-05-11
**Source consolidation:** device checklist addenda + QA evidence index

Done when:

- [x] Pending MP.3 addendum checks completed with evidence or explicitly closed as superseded with rationale.
- [x] MP.6 precondition checklist reflects current branch truth (no stale unchecked preconditions where evidence already exists).
- [x] QA evidence index references concrete artifact paths used in current branch.

Primary files: `docs/mobile/device-validation-checklist.md`, `docs/mobile/ios-qa-evidence-index.md`.

---

## Wave 2 — Native Product Hardening

### MN.1 — Native quality gate automation hardening
**Status:** ✅ 2026-05-11

Done when:

- [x] Required mobile evidence checks codified in CI for mobile-touching changes.
- [x] Guardrail and reliability gates fail predictably on missing evidence links or boundary regressions.
- [x] CI artifact naming and linkage for mobile evidence documented and stable.

### MN.2 — Mobile UI E2E gate (core flow automation)
**Status:** ✅ 2026-05-11

Done when:

- [x] A mobile UI E2E lane exists for core flows (start game, answer, guess, game over, challenge, resume, feedback).
- [x] The lane runs in CI for mobile-touching PRs (blocking or required-for-release).
- [x] Failing scenarios provide artifacted evidence (video/log/screenshot) in `.ci-artifacts/mobile-ci/`.

### MN.3 — Crash + runtime telemetry baseline
**Status:** ✅ 2026-05-11

Done when:

- [x] Mobile runtime captures crash/error events with actionable stack context.
- [x] A minimal mobile stability dashboard/query path exists for release go/no-go.
- [x] Release handoff references telemetry checks alongside scorecard/device evidence.

---

## Wave 3 — Mobile-First Product Expansion

### MX.1 — Describe Yourself (mobile)
**Status:** ✅ 2026-05-11

Done when:

- [x] Player can complete a native mobile "Describe Yourself" flow end-to-end.
- [x] Inputs validated and persisted through existing backend contract.
- [x] Mobile UX diverges intentionally from web where needed for small-screen clarity.

### MX.2 — Team leaderboard + social comparison scope decision
**Status:** ✅ 2026-05-11

Decision:

- Deferred from the current mobile release train.
- Target release window: v1.9+ (post-multi-player session foundations).
- Dependency blockers: team identity/membership model, shared team-session backend contracts, anti-abuse leaderboard rules, mobile perf budget validation for deeper ranking surfaces.

### MX.3 — Challenge leaderboard depth expansion
**Status:** ✅ 2026-05-11

Notes:

- Expanded mobile leaderboard depth to a top-10 summary preview with user-triggered expansion up to 25 rows.
- Full-board parity remains intentionally deferred for mobile performance and scanability.

---

## Wave 4 — v1.9 Scope Foundations

### MY.1 — Team leaderboard contract-prep + blocker breakdown
**Status:** ✅ 2026-05-11

Done when:

- [x] Mobile-facing API contract docs enumerate the required team leaderboard endpoints/payloads for v1.9+.
- [x] Deferred-blocker wording across roadmap/parity/release docs is consistent and implementation-ready.
- [x] Scope documented as contract-prep only (no runtime team leaderboard UI shipped).

### MY.2 — Challenge leaderboard perf validation for deeper rows
**Status:** carried into v1.9 as [`MOB.1`](../ROADMAP.md#mob-1).

### MY.3 — v1.9 scope lock and release-note contract refresh
**Status:** carried into v1.9 as [`MOB.2`](../ROADMAP.md#mob-2).

---

## Completed Mobile Foundations And Parity

- ✅ 2026-05-05: MB.1 toolchain and local run reliability baseline
- ✅ 2026-05-05: MB.2 architecture boundaries and shared-core contract lock
- ✅ 2026-05-05: MB.3 core gameplay shell and state-flow baseline
- ✅ 2026-05-05: MB.4 native bridge baseline reliability
- ✅ 2026-05-05: MB.5 verification baseline and gates
- ✅ 2026-05-07: MP.1 foundation closeout and parity matrix seed
- ✅ 2026-05-07: MP.2 navigation shell and phase router expansion
- ✅ 2026-05-09: MP.3 player insights and personalization (I)
- ✅ 2026-05-09: MP.4 gameplay depth and personalization (II)
- ✅ 2026-05-09: MP.5 daily challenge and seasonal depth
- ✅ 2026-05-10: MP.6 reliability and performance gate
- ✅ 2026-05-10: MP.7 release and handoff gate

---

## Decision Log (mobile-only chapter)

| Date | Decision | Why |
|---|---|---|
| 2026-05-11 | Archived full-product roadmap and moved active execution to mobile-only roadmap. | Immediate priority was iOS delivery; reduces context switching and planning drift across non-mobile tracks. |
| 2026-05-11 | Re-prioritized mobile roadmap to concrete must-focus work (doc evidence cleanup, mobile UI E2E gate, crash telemetry baseline, Describe Yourself feature). | Current branch already shipped parity/reliability; remaining leverage was release confidence + next user-facing mobile value, not generic placeholder items. |
| 2026-05-11 | Completed MR.3 evidence debt cleanup and normalized QA references to concrete branch artifacts. | Checklist truth matches captured MP.6/MP.7 evidence, reducing release-readiness ambiguity and doc drift. |
| 2026-05-11 | Completed MR.1 release-documentation closeout and parity evidence normalization. | Evidence references, handoff read order, and release documentation language consistent with mobile-only roadmap and current branch truth. |
| 2026-05-11 | Completed MN.2 by adding a mobile-core-flow E2E lane and artifact capture in mobile CI. | Core release flows now have automated regression coverage with reproducible logs/traces/screenshots in `.ci-artifacts/mobile-ci/`. |
| 2026-05-11 | Completed MR.2 release readiness gate with a concrete functional/quality preflight matrix and explicit divergence contract for release notes. | TestFlight/App Store submission decisions now reference a deterministic checklist with branch-truth evidence instead of generic preflight prose. |
| 2026-05-11 | Completed MN.3 runtime telemetry baseline (global handler + network failure capture + diagnostics visibility). | Mobile release go/no-go now has a concrete in-app stability signal with actionable runtime event context, without waiting on full third-party crash analytics rollout. |
| 2026-05-11 | Completed MX.1 with a native mobile Describe Yourself flow, local archetype summary, and persistence through `POST /api/v2/events`. | Closes the deferred parity gap with a mobile-first UX while keeping backend compatibility and explicit input validation. |
| 2026-05-11 | Completed MX.2 with an explicit defer decision for team leaderboard + social comparison surfaces. | Mobile release priorities remain reliability and existing parity features; team leaderboard delivery requires multiplayer/team identity foundations and ranking integrity guardrails not yet present in the mobile stack. |
| 2026-05-11 | Completed MN.1 by codifying mobile evidence-link checks in CI and guardrails. | Mobile-touching changes now fail predictably when canonical evidence links drift from repository files, workflow artifact outputs, or CI artifact documentation. |
| 2026-05-11 | Completed MX.3 by expanding challenge leaderboard depth while retaining summary-first mobile UX. | Mobile users get deeper leaderboard visibility (top-10 preview expandable to 25) without committing to full-board rendering. |
| 2026-05-11 | Completed MY.1 by documenting v1.9+ team leaderboard contract prerequisites and blocker breakdown. | Next mobile wave now has explicit API and policy prerequisites so implementation can proceed without scope ambiguity. |
| 2026-05-25 | Reframed `ROADMAP.md` from mobile-only back to full-product for v1.9; archived mobile-only chapter into this file. | Mobile parity, reliability, and release readiness are shipped; remaining mobile work (MY.2/MY.3) carries forward into v1.9 as a single track among five. Refocus on long-deferred code-health, data-quality, engine, platform, and DX/CI investments. |

---

## Removed / De-Prioritized (from this chapter)

- Removed vague "post-parity queue definition" item in favor of concrete feature delivery (`MX.1`, `MX.2`).
- Replaced generic offline/perf maintenance entries with specific must-focus execution items (`MN.2` UI E2E gate, `MN.3` crash telemetry baseline).
