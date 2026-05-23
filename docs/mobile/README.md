# Mobile Docs Index (Xcode + VS Code)

Start here for any iOS/native work.

Canonical planning sources:

- [../../ROADMAP.md](../../ROADMAP.md) for active queue/status (`MR.*`, `MN.*`, `MX.*`; historical `MP.*` listed as completed)
- [ios-feature-parity-plan.md](ios-feature-parity-plan.md) for parity sequencing, quality gates, and milestones
- [parity-matrix.md](parity-matrix.md) for feature-level parity truth

## Read Order

1. [ios-feature-parity-plan.md](ios-feature-parity-plan.md)
2. [parity-matrix.md](parity-matrix.md)
3. [ios-documentation-program.md](ios-documentation-program.md)
4. [ios-architecture-map.md](ios-architecture-map.md)
5. [ios-screen-spec-pack.md](ios-screen-spec-pack.md)
6. [ios-api-contract-reference.md](ios-api-contract-reference.md)
7. [ios-qa-evidence-index.md](ios-qa-evidence-index.md)
8. [ios-release-handoff-playbook.md](ios-release-handoff-playbook.md)
9. [native-product-contract.md](native-product-contract.md)
10. [native-surface-policy.md](native-surface-policy.md)
11. [xcode-setup.md](xcode-setup.md)
12. [xcode-claude-memory-handoff.md](xcode-claude-memory-handoff.md)
13. [screen-quality-scorecard.md](screen-quality-scorecard.md)
14. [device-validation-checklist.md](device-validation-checklist.md)
15. [screenshots/README.md](screenshots/README.md)
16. [roadmap-foundations.md](roadmap-foundations.md) (legacy foundations reference)
17. [ios-master-plan.md](ios-master-plan.md) (superseded pointer)

## What Each Doc Is For

- [ios-feature-parity-plan.md](ios-feature-parity-plan.md): active parity baseline for delivery history (MP.1-MP.7) and documentation track.
- [parity-matrix.md](parity-matrix.md): feature-by-feature parity state, divergence register, and evidence links.
- [ios-documentation-program.md](ios-documentation-program.md): documentation backlog, ownership, and acceptance gates.
- [ios-architecture-map.md](ios-architecture-map.md): Architecture boundaries, implementation layers, and sequencing (React Native / Expo).
- [ios-screen-spec-pack.md](ios-screen-spec-pack.md): implementation-ready specs for all player-facing screens.
- [ios-api-contract-reference.md](ios-api-contract-reference.md): mobile-facing API request/response and retry semantics.
- [ios-qa-evidence-index.md](ios-qa-evidence-index.md): milestone evidence checklist and artifact index.
- [ios-release-handoff-playbook.md](ios-release-handoff-playbook.md): release preflight and cross-IDE handoff protocol.
- [native-product-contract.md](native-product-contract.md): non-negotiable iOS quality bar and release scope.
- [native-surface-policy.md](native-surface-policy.md): native-vs-web boundary rules and enforcement contract.
- [xcode-setup.md](xcode-setup.md): setup steps, sync contract, and Swift scaffold entry points.
- [xcode-claude-memory-handoff.md](xcode-claude-memory-handoff.md): AI handoff protocol when memory is not shared across IDEs.
- [screen-quality-scorecard.md](screen-quality-scorecard.md): PR scoring rubric for core screens.
- [device-validation-checklist.md](device-validation-checklist.md): physical-device runtime checklist used for score evidence updates.
- [screenshots/README.md](screenshots/README.md): naming and storage rules for device-evidence screenshots and recordings.
- [roadmap-foundations.md](roadmap-foundations.md): legacy MB-series foundation detail retained for historical context.
- [ios-master-plan.md](ios-master-plan.md): superseded compatibility pointer to archived strategy content.

## Ownership Split (No Overlap)

- `ROADMAP.md`: mobile execution queue and status only.
- `docs/mobile/ios-feature-parity-plan.md`: parity sequencing, dependencies, and quality gates.
- `docs/mobile/parity-matrix.md`: parity truth table, per-feature state, and evidence links.
- `docs/mobile/ios-documentation-program.md`: documentation backlog and quality gates.
- `docs/mobile/ios-architecture-map.md`: architecture boundaries and implementation layers.
- `docs/mobile/ios-screen-spec-pack.md`: screen-level implementation specs and acceptance cues.
- `docs/mobile/ios-api-contract-reference.md`: player-facing API contract reference.
- `docs/mobile/ios-qa-evidence-index.md`: QA evidence requirements and closure checklist.
- `docs/mobile/ios-release-handoff-playbook.md`: release and handoff execution checklist.
- `docs/mobile/native-product-contract.md`: quality bar and release scope only.
- `docs/mobile/native-surface-policy.md`: boundary policy and enforcement only.
- `docs/mobile/xcode-setup.md`: setup/sync runbook only.
- `docs/mobile/xcode-claude-memory-handoff.md`: cross-IDE handoff protocol only.
- `docs/mobile/screen-quality-scorecard.md`: score rubric and gates only.
- `docs/mobile/device-validation-checklist.md`: device runtime verification log only.
- `docs/mobile/archive/**`: superseded plans and historical references (archive-first policy).

## Active vs Archived Policy

- Treat `ios-feature-parity-plan.md` + `parity-matrix.md` + `ROADMAP.md` as the active planning set.
- When replacing outdated mobile notes, move them into `docs/mobile/archive/` with a date-prefixed filename and keep a short pointer stub.
- Do not hard-delete historic planning docs unless they are exact duplicates with no inbound links.

## Operational Commands

Run from repo root:

1. `pnpm validate:fast`
2. `pnpm mobile:typecheck`
3. `pnpm mobile:guardrails`

If dependencies or Expo config changed:

1. `pnpm mobile:prebuild:ios`
2. `pnpm mobile:ios`

For merge and gate expectations, use [ios-feature-parity-plan.md](ios-feature-parity-plan.md), [ios-documentation-program.md](ios-documentation-program.md), and [../../ROADMAP.md](../../ROADMAP.md).

## Native Scaffold Location

- Swift starter files: [../../apps/mobile/ios/Andernator/NativeServices/](../../apps/mobile/ios/Andernator/NativeServices/)
- Xcode project map: [../../apps/mobile/ios/Andernator.xcodeproj/project.pbxproj](../../apps/mobile/ios/Andernator.xcodeproj/project.pbxproj)
