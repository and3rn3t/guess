# Mobile Docs Index (Xcode + VS Code)

Start here for any iOS/native work.

## Read Order

1. [native-product-contract.md](native-product-contract.md)
2. [native-surface-policy.md](native-surface-policy.md)
3. [xcode-setup.md](xcode-setup.md)
4. [xcode-claude-memory-handoff.md](xcode-claude-memory-handoff.md)
5. [screen-quality-scorecard.md](screen-quality-scorecard.md)

## What Each Doc Is For

- [native-product-contract.md](native-product-contract.md): non-negotiable iOS quality bar and scope.
- [native-surface-policy.md](native-surface-policy.md): native-vs-web boundary rules.
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

## Native Scaffold Location

- Swift starter files: [../../apps/mobile/ios/Andernator/NativeServices/](../../apps/mobile/ios/Andernator/NativeServices/)
- Xcode project map: [../../apps/mobile/ios/Andernator.xcodeproj/project.pbxproj](../../apps/mobile/ios/Andernator.xcodeproj/project.pbxproj)
