# @guess/mobile

iOS-first native app shell for Andernator using Expo + React Native.

Canonical iOS strategy and roadmap: [../../docs/mobile/ios-master-plan.md](../../docs/mobile/ios-master-plan.md)

## Commands

- pnpm --filter @guess/mobile dev
- pnpm --filter @guess/mobile ios
- pnpm --filter @guess/mobile typecheck
- pnpm --filter @guess/mobile prebuild:ios
- pnpm --filter @guess/mobile pods
- pnpm --filter @guess/mobile open:xcode
- pnpm --filter @guess/mobile setup:xcode

## Xcode Setup

1. Generate iOS native project files:
	- pnpm --filter @guess/mobile prebuild:ios
2. Install CocoaPods dependencies:
	- pnpm --filter @guess/mobile pods
3. Open the generated workspace in Xcode:
	- pnpm --filter @guess/mobile open:xcode

One-command bootstrap:

- pnpm --filter @guess/mobile setup:xcode

Environment files:

- Shared config: apps/mobile/.xcode.env
- Local overrides template: apps/mobile/.xcode.env.local.example
- Sync command (copies shared config to ios/.xcode.env):
  - pnpm --filter @guess/mobile sync:xcode-env

## Rules

- Follow docs/mobile/native-product-contract.md
- Follow docs/mobile/native-surface-policy.md
- PRs for core screens must include docs/mobile/screen-quality-scorecard.md evidence
- Start from docs/mobile/README.md for the full mobile docs map
- Use docs/mobile/ios-master-plan.md for roadmap sequencing, governance, and release gates

## AI Quick Start (VS Code + Xcode)

Use this when handing work between IDEs or AI agents.

1. `pnpm validate:fast`
2. `pnpm --filter @guess/mobile typecheck`
3. `pnpm --filter @guess/mobile sync:xcode-env`

If dependencies or Expo config changed:

1. `pnpm --filter @guess/mobile prebuild:ios`
2. `pnpm --filter @guess/mobile pods`

For boundaries, handoff, and ownership rules use:

- `docs/mobile/ios-master-plan.md`
- `docs/mobile/xcode-setup.md`
- `docs/mobile/xcode-claude-memory-handoff.md`
