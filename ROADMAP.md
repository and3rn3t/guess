# Mobile-Only Roadmap (iOS Focus)

This roadmap is now dedicated to iOS/mobile execution only.

The previous full-product roadmap was archived on 2026-05-11:

- [docs/ROADMAP-archive-v1.6.1-mobile-pivot-2026-05-11.md](docs/ROADMAP-archive-v1.6.1-mobile-pivot-2026-05-11.md)

Mobile planning inputs consolidated into this roadmap:

- [docs/mobile/ios-feature-parity-plan.md](docs/mobile/ios-feature-parity-plan.md)
- [docs/mobile/parity-matrix.md](docs/mobile/parity-matrix.md)
- [docs/mobile/ios-documentation-program.md](docs/mobile/ios-documentation-program.md)
- [docs/mobile/ios-qa-evidence-index.md](docs/mobile/ios-qa-evidence-index.md)
- [docs/mobile/device-validation-checklist.md](docs/mobile/device-validation-checklist.md)
- [docs/mobile/ios-release-handoff-playbook.md](docs/mobile/ios-release-handoff-playbook.md)
- [docs/mobile/roadmap-foundations.md](docs/mobile/roadmap-foundations.md)

---

## Status Key

- `⬜` not started
- `🟡` in progress
- `✅ YYYY-MM-DD` shipped
- `⚪` deferred / parked

## How To Pull Work

1. Start from **In Progress / Up Next**.
2. Finish any `🟡` item before starting new work.
3. Pull the next `⬜` item in order.
4. Update roadmap status in the same commit as implementation/docs.

## Definition Of Done (Mobile)

An item is only `✅` when all apply:

- [ ] Code and/or docs are merged to `main`.
- [ ] `pnpm validate` passes.
- [ ] `pnpm build && pnpm build:worker` pass.
- [ ] Mobile checks pass for touched scope:
	- [ ] `pnpm mobile:typecheck`
	- [ ] `pnpm mobile:guardrails`
	- [ ] `pnpm mobile:reliability-gate` (when route/reliability scope is touched)
- [ ] Evidence links are updated in [docs/mobile/parity-matrix.md](docs/mobile/parity-matrix.md).
- [ ] Release/behavior changes reflected in [CHANGELOG.md](CHANGELOG.md) when applicable.

---

## In Progress / Up Next

- ✅ **Completed:** [MX.3](#mx-3) challenge leaderboard depth expansion (2026-05-11)
- ✅ **Completed:** [MN.1](#mn-1) native quality gate automation hardening (2026-05-11)
- ✅ **Completed:** [MX.2](#mx-2) team leaderboard + social comparison scope decision (2026-05-11)
- ✅ **Completed:** [MX.1](#mx-1) Describe Yourself (mobile) (2026-05-11)
- ✅ **Completed:** [MN.3](#mn-3) crash + runtime telemetry baseline (2026-05-11)
- ✅ **Completed:** [MR.2](#mr-2) App Store / TestFlight submission readiness gate (2026-05-11)
- ✅ **Completed:** [MN.2](#mn-2) mobile UI E2E gate (core flow automation) (2026-05-11)
- ✅ **Completed:** [MR.1](#mr-1) release-documentation closeout + parity evidence normalization (2026-05-11)
- ✅ **Completed:** [MR.3](#mr-3) post-MP.7 evidence debt cleanup (2026-05-11)

---

## Wave 1 - Release Closeout (Do First)

### MR.1

**Title:** Release-documentation closeout + parity evidence normalization  
**Status:** ✅ 2026-05-11  
**Source consolidation:** MP.7 done-when items, QA index, release playbook

Done when:

- [ ] `parity-matrix.md` evidence column is normalized for all shipped rows (consistent artifact references).
- [ ] Owner signatures and last-verified dates are current for all in-scope rows.
- [ ] `xcode-claude-memory-handoff.md` includes latest known edge cases and API behavior notes.
- [ ] `CHANGELOG.md` has a clean mobile release summary for MP.6/MP.7 closure scope.

Primary files:

- `docs/mobile/parity-matrix.md`
- `docs/mobile/xcode-claude-memory-handoff.md`
- `CHANGELOG.md`

### MR.2

**Title:** App Store / TestFlight submission readiness gate  
**Status:** ✅ 2026-05-11  
**Source consolidation:** release playbook preflight + MP.7 checklist

Done when:

- [ ] TestFlight/App Store preflight checklist is completed and captured in docs.
- [ ] Functional preflight pass is documented for Welcome -> Playing -> Guessing -> Game Over, Challenge, Resume, Feedback, Preferences, Teaching, Stats, History, Compare.
- [ ] Quality preflight pass is documented (VoiceOver, Dynamic Type, reduced motion, performance budgets, airplane mode).
- [ ] Known intentional web divergences are explicitly listed in release notes.

Primary files:

- `docs/mobile/ios-release-handoff-playbook.md`
- `docs/mobile/parity-matrix.md`
- `CHANGELOG.md`

### MR.3

**Title:** Post-MP.7 evidence debt cleanup  
**Status:** ✅ 2026-05-11  
**Source consolidation:** device checklist addenda + QA evidence index

Done when:

- [ ] Pending MP.3 addendum checks are either completed with evidence or explicitly closed as superseded with rationale.
- [ ] MP.6 precondition checklist reflects current branch truth (no stale unchecked preconditions where evidence already exists).
- [ ] QA evidence index references concrete artifact paths used in current branch.

Primary files:

- `docs/mobile/device-validation-checklist.md`
- `docs/mobile/ios-qa-evidence-index.md`

---

## Wave 2 - Native Product Hardening

### MN.1

**Title:** Native quality gate automation hardening  
**Status:** ✅ 2026-05-11  
**Source consolidation:** MB.5 verification baseline + QA/release gates

Done when:

- [ ] Required mobile evidence checks are codified in CI for mobile-touching changes.
- [ ] Guardrail and reliability gates fail predictably on missing evidence links or boundary regressions.
- [ ] CI artifact naming and linkage for mobile evidence are documented and stable.

### MN.2

**Title:** Mobile UI E2E gate (core flow automation)  
**Status:** ✅ 2026-05-11  
**Source consolidation:** release preflight + mobile-ci baseline

Done when:

- [ ] A mobile UI E2E lane exists for core flows (start game, answer, guess, game over, challenge, resume, feedback).
- [ ] The lane runs in CI for mobile-touching PRs (blocking or required-for-release).
- [ ] Failing scenarios provide artifacted evidence (video/log/screenshot) in `.ci-artifacts/mobile-ci/`.

### MN.3

**Title:** Crash + runtime telemetry baseline  
**Status:** ✅ 2026-05-11  
**Source consolidation:** release playbook quality preflight + reliability hardening

Done when:

- [ ] Mobile runtime captures crash/error events with actionable stack context.
- [ ] A minimal mobile stability dashboard/query path exists for release go/no-go.
- [ ] Release handoff references telemetry checks alongside scorecard/device evidence.

---

## Wave 3 - Mobile-First Product Expansion

### MX.1

**Title:** Describe Yourself (mobile)  
**Status:** ✅ 2026-05-11
**Source consolidation:** deferred parity feature + changelog known limitation

Done when:

- [ ] Player can complete a native mobile "Describe Yourself" flow end-to-end.
- [ ] Inputs are validated and persisted through the existing backend contract.
- [ ] Mobile UX diverges intentionally from web where needed for small-screen clarity.

### MX.2

**Title:** Team leaderboard + social comparison scope decision  
**Status:** ✅ 2026-05-11

Decision:

- Deferred from the current mobile release train.
- Target release window: v1.9+ (post-multi-player session foundations).
- Dependency blockers: team identity/membership model, shared team-session backend contracts, anti-abuse leaderboard rules, and mobile perf budget validation for deeper ranking surfaces.

Done when:

- [ ] Decide ship-now vs defer for team leaderboard surfaces on mobile.
- [ ] If deferred, document explicit release target and dependency blockers.
- [ ] If shipped, add feature rows/evidence requirements to `parity-matrix.md`.

### MX.3

**Title:** Challenge leaderboard depth expansion  
**Status:** ✅ 2026-05-11

Notes:

- Expanded mobile leaderboard depth to a top-10 summary preview with user-triggered expansion up to 25 rows.
- Full-board parity remains intentionally deferred for mobile performance and scanability.

---

## Removed / De-Prioritized

- Removed vague "post-parity queue definition" item in favor of concrete feature delivery (`MX.1`, `MX.2`).
- Replaced generic offline/perf maintenance entries with specific must-focus execution items (`MN.2` UI E2E gate, `MN.3` crash telemetry baseline).

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

## Decision Log

| Date | Decision | Why |
|---|---|---|
| 2026-05-11 | Archived full-product roadmap and moved active execution to mobile-only roadmap. | Immediate priority is iOS delivery; reduces context switching and planning drift across non-mobile tracks. |
| 2026-05-11 | Re-prioritized mobile roadmap to concrete must-focus work (doc evidence cleanup, mobile UI E2E gate, crash telemetry baseline, Describe Yourself feature). | Current branch already shipped parity/reliability; remaining leverage is release confidence + next user-facing mobile value, not generic placeholder items. |
| 2026-05-11 | Completed MR.3 evidence debt cleanup and normalized QA references to concrete branch artifacts. | Checklist truth now matches captured MP.6/MP.7 evidence, reducing release-readiness ambiguity and doc drift. |
| 2026-05-11 | Completed MR.1 release-documentation closeout and parity evidence normalization. | Evidence references, handoff read order, and release documentation language are now consistent with the mobile-only roadmap and current branch truth. |
| 2026-05-11 | Completed MN.2 by adding a mobile-core-flow E2E lane and artifact capture in mobile CI. | Core release flows now have automated regression coverage with reproducible logs/traces/screenshots in `.ci-artifacts/mobile-ci/`. |
| 2026-05-11 | Completed MR.2 release readiness gate with a concrete functional/quality preflight matrix and explicit divergence contract for release notes. | TestFlight/App Store submission decisions now reference a deterministic checklist with branch-truth evidence instead of generic preflight prose. |
| 2026-05-11 | Completed MN.3 runtime telemetry baseline (global handler + network failure capture + diagnostics visibility). | Mobile release go/no-go now has a concrete in-app stability signal with actionable runtime event context, without waiting on full third-party crash analytics rollout. |
| 2026-05-11 | Completed MX.1 with a native mobile Describe Yourself flow, local archetype summary, and persistence through `POST /api/v2/events`. | Closes the deferred parity gap with a mobile-first UX while keeping backend compatibility and explicit input validation (minimum answered prompt threshold) before persistence. |
| 2026-05-11 | Completed MX.2 with an explicit defer decision for team leaderboard + social comparison surfaces. | Current mobile release priorities remain reliability and existing parity features; team leaderboard delivery requires multiplayer/team identity foundations and ranking integrity guardrails not yet present in the mobile stack. |
| 2026-05-11 | Completed MN.1 by codifying mobile evidence-link checks in CI and guardrails. | Mobile-touching changes now fail predictably when canonical evidence links drift from repository files, workflow artifact outputs, or CI artifact documentation. |
| 2026-05-11 | Completed MX.3 by expanding challenge leaderboard depth while retaining summary-first mobile UX. | Mobile users now get deeper leaderboard visibility (top-10 preview expandable to 25) without committing to full-board rendering that risks small-screen performance regressions. |
