# Mobile Docs Index (Xcode + VS Code)

Start here for any iOS/native work.

Canonical planning source: [ios-master-plan.md](ios-master-plan.md)

## Read Order

1. [ios-master-plan.md](ios-master-plan.md)
2. [native-product-contract.md](native-product-contract.md)
3. [native-surface-policy.md](native-surface-policy.md)
4. [xcode-setup.md](xcode-setup.md)
5. [xcode-claude-memory-handoff.md](xcode-claude-memory-handoff.md)
6. [screen-quality-scorecard.md](screen-quality-scorecard.md)

## What Each Doc Is For

- [ios-master-plan.md](ios-master-plan.md): canonical iOS strategy, sequencing, governance, and KPI framework.
- [native-product-contract.md](native-product-contract.md): non-negotiable iOS quality bar and release scope.
- [native-surface-policy.md](native-surface-policy.md): native-vs-web boundary rules and enforcement contract.
- [xcode-setup.md](xcode-setup.md): setup steps, sync contract, and Swift scaffold entry points.
- [xcode-claude-memory-handoff.md](xcode-claude-memory-handoff.md): AI handoff protocol when memory is not shared across IDEs.
- [screen-quality-scorecard.md](screen-quality-scorecard.md): PR scoring rubric for core screens.

## Operational Commands

Run from repo root:

1. `pnpm validate:fast`
2. `pnpm --filter @guess/mobile typecheck`
3. `pnpm --filter @guess/mobile sync:xcode-env`

If dependencies or Expo config changed:

1. `pnpm --filter @guess/mobile prebuild:ios`
2. `pnpm --filter @guess/mobile pods`

For merge and gate expectations (scorecard evidence, roadmap alignment, ownership), use [ios-master-plan.md](ios-master-plan.md).

## Native Scaffold Location

- Swift starter files: [../../apps/mobile/ios/Andernator/NativeServices/](../../apps/mobile/ios/Andernator/NativeServices/)
- Xcode project map: [../../apps/mobile/ios/Andernator.xcodeproj/project.pbxproj](../../apps/mobile/ios/Andernator.xcodeproj/project.pbxproj)
