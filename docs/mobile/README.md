# Mobile Docs Index (Xcode + VS Code)

Start here for any iOS/native work.

Canonical planning sources:

- [../../ROADMAP.md](../../ROADMAP.md) for active queue/status (`MB.*`)
- [roadmap-foundations.md](roadmap-foundations.md) for foundational sequencing and acceptance criteria

## Read Order

1. [roadmap-foundations.md](roadmap-foundations.md)
2. [native-product-contract.md](native-product-contract.md)
3. [native-surface-policy.md](native-surface-policy.md)
4. [xcode-setup.md](xcode-setup.md)
5. [xcode-claude-memory-handoff.md](xcode-claude-memory-handoff.md)
6. [screen-quality-scorecard.md](screen-quality-scorecard.md)
7. [ios-master-plan.md](ios-master-plan.md) (superseded pointer)

## What Each Doc Is For

- [roadmap-foundations.md](roadmap-foundations.md): active foundational mobile roadmap detail (dependencies, deliverables, acceptance criteria).
- [native-product-contract.md](native-product-contract.md): non-negotiable iOS quality bar and release scope.
- [native-surface-policy.md](native-surface-policy.md): native-vs-web boundary rules and enforcement contract.
- [xcode-setup.md](xcode-setup.md): setup steps, sync contract, and Swift scaffold entry points.
- [xcode-claude-memory-handoff.md](xcode-claude-memory-handoff.md): AI handoff protocol when memory is not shared across IDEs.
- [screen-quality-scorecard.md](screen-quality-scorecard.md): PR scoring rubric for core screens.
- [ios-master-plan.md](ios-master-plan.md): superseded compatibility pointer to archived strategy content.

## Ownership Split (No Overlap)

- `ROADMAP.md`: mobile execution queue and status only.
- `docs/mobile/roadmap-foundations.md`: foundational sequencing and acceptance criteria only.
- `docs/mobile/native-product-contract.md`: quality bar and release scope only.
- `docs/mobile/native-surface-policy.md`: boundary policy and enforcement only.
- `docs/mobile/xcode-setup.md`: setup/sync runbook only.
- `docs/mobile/xcode-claude-memory-handoff.md`: cross-IDE handoff protocol only.
- `docs/mobile/screen-quality-scorecard.md`: score rubric and gates only.

## Operational Commands

Run from repo root:

1. `pnpm validate:fast`
2. `pnpm --filter @guess/mobile typecheck`
3. `pnpm --filter @guess/mobile sync:xcode-env`

If dependencies or Expo config changed:

1. `pnpm --filter @guess/mobile prebuild:ios`
2. `pnpm --filter @guess/mobile pods`

For merge and gate expectations, use [roadmap-foundations.md](roadmap-foundations.md) plus [../../ROADMAP.md](../../ROADMAP.md).

## Native Scaffold Location

- Swift starter files: [../../apps/mobile/ios/Andernator/NativeServices/](../../apps/mobile/ios/Andernator/NativeServices/)
- Xcode project map: [../../apps/mobile/ios/Andernator.xcodeproj/project.pbxproj](../../apps/mobile/ios/Andernator.xcodeproj/project.pbxproj)
