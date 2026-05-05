# iOS Foundations Roadmap (Active)

This is the active mobile planning document for foundational work.

Ownership split:

- `ROADMAP.md`: status queue and execution order for mobile IDs.
- `docs/mobile/roadmap-foundations.md`: foundational item detail, dependencies, and measurable acceptance criteria.

## Purpose

Reset the iOS track to foundational, unblock-first execution so work can move forward without broad governance overhead.

## Foundations Sequence

Work strictly in dependency order.

## MB.1 Toolchain and local run reliability baseline

Goal: make local iOS execution predictable across VS Code and Xcode.

Depends on: none.

Deliverables:

1. Verified setup path for prebuild, pods, and Xcode open commands.
2. Shared environment sync routine is current and documented.
3. Known failure modes are captured with recovery steps.

Acceptance criteria:

1. From clean checkout, all commands run successfully:
   - `pnpm --filter @guess/mobile prebuild:ios`
   - `pnpm --filter @guess/mobile pods`
   - `pnpm --filter @guess/mobile open:xcode`
2. Sync routine passes and is documented:
   - `pnpm validate:fast`
   - `pnpm --filter @guess/mobile typecheck`
   - `pnpm --filter @guess/mobile sync:xcode-env`
3. `docs/mobile/xcode-setup.md` contains one canonical flow with no duplicate alternatives.

## MB.2 Architecture boundaries and shared-core contract lock

Goal: prevent web-port drift and lock platform boundaries before feature expansion.

Depends on: MB.1.

Deliverables:

1. Boundary rules are explicit and current.
2. Guardrail checks are runnable locally and in CI.
3. Shared-core vs mobile-owned code paths are documented.

Acceptance criteria:

1. `pnpm mobile:guardrails` passes with no boundary violations.
2. Policy docs align with actual imports and platform adapter usage.
3. `docs/mobile/native-surface-policy.md` and `docs/mobile/native-product-contract.md` do not contain roadmap sequencing text.

## MB.3 Core gameplay shell and state-flow baseline

Goal: verify the mobile core flow remains coherent before deeper native polish.

Depends on: MB.2.

Deliverables:

1. Welcome, Playing, Guessing, Game Over, and Challenge screen flow validated.
2. State transitions are documented for mobile contributors.
3. Critical regressions have baseline test coverage or checklist evidence.

Acceptance criteria:

1. Core phase flow is validated end-to-end in mobile shell.
2. `apps/mobile/src/state/useMobileServerGame.ts` and related screens support the expected path without dead-end transitions.
3. Evidence recorded in mobile status docs for future handoffs.

## MB.4 Native bridge baseline reliability

Goal: establish reliable native capability behavior with explicit fallback semantics.

Depends on: MB.3.

Deliverables:

1. Native service module availability confirmed in runtime.
2. Physical-device checks completed for capabilities that require hardware behavior.
3. TS fallback behavior for unavailable native modules is documented.

Acceptance criteria:

1. Native modules verified: haptics, VoiceOver, reduce motion, lifecycle.
2. Device and runtime verification evidence is captured in:
   - `apps/mobile/ios/IMPLEMENTATION_STATUS.md`
   - `apps/mobile/ios/XCODE_IMPLEMENTATION_HANDOFF.md`
3. Roadmap closeout references MB.4, not legacy M IDs.

## MB.5 Verification baseline and gates

Goal: make quality checks routine and blocking at the right stage.

Depends on: MB.4.

Deliverables:

1. Device validation checklist exists and is actively used.
2. Scorecard evidence is required for touched core screens.
3. CI/static checks enforce baseline mobile quality gates.

Acceptance criteria:

1. `pnpm mobile:scorecard` is used for mobile-touching PRs with current evidence.
2. Score evidence JSON covers touched core screens and passes schema checks.
3. Mobile-related CI checks fail on missing required evidence or boundary violations.

## Legacy Migration Note

Legacy M-series mobile items were replaced with MB-series foundations to unblock forward execution.

Mapping for context only:

- M.4 and native verification work are carried under MB.4.
- M.5 scorecard gating work is carried under MB.5.
- M.6 and later polish items are deferred until MB.1-MB.5 are completed.

Historical strategy content is archived in:

- `docs/mobile/archive/2026-05-04-ios-master-plan.md`
