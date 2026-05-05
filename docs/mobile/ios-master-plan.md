# iOS Master Plan (Canonical)

This is the canonical planning document for the Guess iOS app.

Scope: iOS only.
Horizon: 6-12 months.
Consolidation model: this file owns strategy, sequencing, governance, and release criteria; supporting docs under `docs/mobile/` remain policy and runbook references.

## Objectives

1. Ship an iOS-first gameplay experience that meets native quality standards and feels materially better than a wrapped web port.
2. Close current execution items M.4-M.8 with measurable acceptance criteria.
3. Establish durable release governance (quality gates, evidence, ownership, cadence) for continuous mobile delivery.
4. Reach App Store readiness with repeatable TestFlight and launch operations.

## Source-of-Truth Map

Use this map to avoid duplicated or conflicting guidance.

| Topic | Canonical file | Purpose |
|---|---|---|
| Strategy and roadmap | `docs/mobile/ios-master-plan.md` | 6-12 month plan, waves, governance, KPIs, release gates |
| Product quality bar | `docs/mobile/native-product-contract.md` | Non-negotiable native quality and release scope |
| Native boundary policy | `docs/mobile/native-surface-policy.md` | Allowed/forbidden reuse and enforcement model |
| Xcode setup and sync | `docs/mobile/xcode-setup.md` | Setup and VS Code/Xcode sync contract |
| AI memory handoff | `docs/mobile/xcode-claude-memory-handoff.md` | Cross-IDE handoff protocol for AI-assisted work |
| Screen scoring rubric | `docs/mobile/screen-quality-scorecard.md` | Category rubric and thresholds |
| Screen evidence artifact | `docs/mobile/screen-quality-scores.json` | Machine-readable score evidence |
| Active queue status | `ROADMAP.md` (`#m-1` ... `#m-8`) | Execution status of mobile IDs |

## Current Baseline (May 2026)

### Implementation baseline

- Mobile shell and phase composition are in `apps/mobile/App.tsx`.
- Core mobile gameplay orchestration is in `apps/mobile/src/state/useMobileServerGame.ts`.
- Shared phase/state model is in `apps/mobile/src/state/useCoreGameFlow.ts` and `packages/app-core/src/core-phase.ts`.
- Platform adapters (network, storage, share, haptics, lifecycle) are in `apps/mobile/src/platform/adapters.ts`.
- Native bridge surface is in `apps/mobile/src/native/NativeServices.ts` and hooks under `apps/mobile/src/native/`.

### Roadmap baseline

- Completed: M.1, M.2, M.3.
- In progress: M.4, M.5.
- Up next: M.6.
- Planned after current wave: M.7, M.8.

### Known open gaps

1. Physical-device validation and native target verification completion (M.4).
2. Scorecard threshold closure tied to device validation evidence (M.5).
3. Lifecycle interruption and stale-session recovery matrix not yet complete (M.6).
4. Dynamic Type and full VoiceOver journey depth are not yet fully evidenced across all core screens.
5. Challenge/share path behavior needs stronger platform consistency and announcement semantics (M.7).

## Architecture and Boundary Model

### Reuse boundaries

- Shared domain logic: `packages/game-engine/**` and `packages/app-core/**`.
- Mobile product experience: `apps/mobile/src/**`.
- Native capabilities: `apps/mobile/src/native/**` and intentional native modules in `apps/mobile/ios/**`.
- Generated native output: `apps/mobile/ios/**` (review carefully; avoid accidental churn commits).

### Guardrails and enforcement

- Native boundary guardrail script: `scripts/mobile/check-mobile-boundaries.ts`.
- Scorecard evidence guardrail script: `scripts/mobile/check-screen-scorecard.ts`.
- Combined command: `pnpm mobile:guardrails`.
- CI enforcement point: `.github/workflows/ci.yml` in `checks-static`.

### Native escalation protocol

A Swift/native module is allowed when Expo-level capabilities are insufficient for quality targets.
Each native escalation must document:

1. Why Expo path is insufficient.
2. User-visible impact and measurable improvement.
3. JS/TS contract and fallback behavior.
4. Ownership for maintenance and future upgrades.

## 6-12 Month Wave Plan

## Wave A: Stabilize and Verify (0-8 weeks)

Primary objective: close current in-progress items and establish release-ready quality evidence.

### Deliverables

1. M.4 complete with device-validated bridge and target membership checks.
2. M.5 scorecard gate operating with required evidence for touched core screens.
3. M.6 lifecycle resilience matrix completed for background/foreground/re-entry/stale recovery.
4. Clear blocker tracking and closure criteria tied to ROADMAP status updates.

### Exit criteria

1. No open M.4-M.6 blockers in current wave.
2. Scorecard thresholds met for all touched core screens according to PR and milestone gates.
3. Lifecycle matrix scenarios pass on target test devices.

## Wave B: Native Experience Depth (2-4 months)

Primary objective: raise interaction and accessibility quality from "functional" to "native-premium".

### Deliverables

1. M.7 challenge/share hardening with native share semantics and accessibility announcements.
2. Accessibility completion pass on core journey (VoiceOver path, touch target audit, Dynamic Type scale behavior).
3. Motion and reduced-motion behavior alignment across all core transitions.
4. Progressive haptic strategy for key intent moments (start, confidence shifts, success/failure, critical errors).

### Exit criteria

1. No category below milestone thresholds on touched core screens.
2. Accessibility test script passes for core flow and challenge entry.
3. Challenge/share flow has consistent and measurable success behavior on target iPhones.

## Wave C: Quality and Ops Maturity (4-8 months)

Primary objective: operationalize quality so regressions are caught early and recovery is routine.

### Deliverables

1. M.8 dual-IDE handoff runbook hardening finalized with drift controls.
2. Scorecard evidence and trend reporting cadence stabilized.
3. Lifecycle chaos validation expanded (interruptions, low-memory behavior, network transitions).
4. Mobile telemetry dashboard inputs defined and reviewed in weekly mobile review.

### Exit criteria

1. Weekly review cadence produces actionable trend deltas.
2. Regression detection and rollback playbook are documented and tested.
3. Dual-IDE handoff checklist has no stale steps for two consecutive milestones.

## Wave D: TestFlight to App Store Readiness (8-12 months)

Primary objective: complete release governance and launch preparation.

### Deliverables

1. End-to-end TestFlight runbook and go/no-go criteria.
2. Beta feedback triage process with turnaround targets.
3. App Store submission readiness checklist and release artifact ownership.
4. Post-launch reliability and iteration loop for first 90 days.

### Exit criteria

1. Two stable TestFlight cycles with target reliability/quality metrics met.
2. App Store checklist complete with all release-critical evidence artifacts.
3. Post-launch monitoring and rollback plans reviewed and signed off.

## KPI Framework

Track these KPI groups monthly and at each milestone review.

### Quality gates

1. Scorecard weighted pass rate.
2. Category floor pass rate.
3. Count of touched screens without complete evidence.

### Reliability

1. Lifecycle recovery success rate.
2. Crash-free session rate.
3. Regression escape count (post-merge defects found in QA or beta).

### UX performance feel

1. P95 tap-to-feedback latency.
2. P95 transition-start latency.
3. Count of stutter reports in core gameplay flow.

### Accessibility

1. Core-flow VoiceOver pass coverage.
2. Dynamic Type pass coverage.
3. Reduced-motion conformance coverage.

### Delivery

1. Lead time from change start to verified mobile merge.
2. Rework rate (reopened mobile tasks).
3. Blocker aging for active mobile roadmap items.

## Governance and Operating Cadence

### Weekly mobile review

Owner: Engineering + Design.
Inputs: blocker list, scorecard deltas, lifecycle matrix status, KPI snapshot.
Outputs: next-week focus and explicit unblock actions.

### Milestone gate review

Owner: Product (decision), with Engineering and Design sign-off.
Inputs: scorecard threshold evidence, accessibility verification, device validation, reliability signals.
Outputs: go/no-go decision and documented risk acceptance if applicable.

### Quarterly strategy review

Owner: Product + Engineering leadership.
Inputs: KPI trends, release outcomes, roadmap throughput.
Outputs: wave reprioritization and scope adjustments recorded in Decision Log.

## Documentation Ownership and Update Rules

| Area | Owner | Update trigger |
|---|---|---|
| This master plan | Product + Engineering | Milestone change, scope shift, quarterly review |
| Contract/policy docs | Engineering + Design | Policy change or new native boundary rule |
| Setup/handoff docs | Engineering | Tooling, workflow, or handoff routine change |
| Scorecard rubric | Design + Engineering | Threshold/rubric change |
| Score evidence JSON | Feature owner of touched screen | Every PR touching core screens |
| Mobile roadmap IDs | Engineering | In same commit as status change in `ROADMAP.md` |

## Execution Checklist (Canonical)

Run from repo root before switching IDEs/agents or opening a mobile PR:

1. `pnpm validate:fast`
2. `pnpm --filter @guess/mobile typecheck`
3. `pnpm --filter @guess/mobile sync:xcode-env`

When dependencies or Expo config changed:

1. `pnpm --filter @guess/mobile prebuild:ios`
2. `pnpm --filter @guess/mobile pods`

Before merge for mobile-touching changes:

1. `pnpm mobile:guardrails`
2. Ensure `docs/mobile/screen-quality-scores.json` includes touched core screens.
3. Ensure roadmap status updates (if any) are reflected in `ROADMAP.md` in the same logical change.

## Decision Log (Mobile)

Use this section for major iOS scope or sequencing changes (short, one line each).

| Date | Decision |
|---|---|
| 2026-05-04 | Consolidated iOS planning into `docs/mobile/ios-master-plan.md`; retained policy/runbook docs as subordinate references. |

## Relationship to ROADMAP

`ROADMAP.md` remains the source of truth for active status and in-progress/up-next execution ordering.
This document provides the long-range iOS strategy and governance that ROADMAP mobile IDs execute against.
