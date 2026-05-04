# @guess/mobile

iOS-first native app shell for Andernator using Expo + React Native.

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
- Start from docs/mobile/README.md for the full Xcode + AI handoff doc map

## AI Quick Start (VS Code + Xcode)

Use this when handing work between IDEs or AI agents.

Source-of-truth boundaries:

- Product logic lives in `apps/mobile/src/**` and `packages/app-core/**`.
- `apps/mobile/ios/**` is generated native output from Expo prebuild.
- Shared iOS env source is `apps/mobile/.xcode.env` (sync into `ios/.xcode.env`).

Handoff routine (run from repo root):

1. `pnpm validate:fast`
2. `pnpm --filter @guess/mobile typecheck`
3. `pnpm --filter @guess/mobile sync:xcode-env`

When dependencies or Expo config change:

1. `pnpm --filter @guess/mobile prebuild:ios`
2. `pnpm --filter @guess/mobile pods`

Avoid committing accidental `apps/mobile/ios/**` churn unless the native project itself was intentionally changed.

For full policy, see `docs/mobile/xcode-setup.md`.
