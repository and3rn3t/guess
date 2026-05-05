# @guess/mobile

iOS-first native app shell for Andernator using Expo + React Native.

Canonical iOS planning:

- [../../ROADMAP.md](../../ROADMAP.md) for active queue/status (`MB.*`)
- [../../docs/mobile/roadmap-foundations.md](../../docs/mobile/roadmap-foundations.md) for foundational sequencing

## Commands

- pnpm --filter @guess/mobile dev
- pnpm --filter @guess/mobile dev:device
- pnpm --filter @guess/mobile dev:tunnel
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

## Physical iPhone Launch

If Xcode launches to a black screen with the red React Native error header, Metro is not reachable.

1. Start Metro for device mode:
   - pnpm --filter @guess/mobile dev:device
2. Keep that terminal running and launch from Xcode.
3. If LAN fails, use tunnel mode:
   - pnpm --filter @guess/mobile dev:tunnel

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
- Use docs/mobile/roadmap-foundations.md for mobile foundation sequencing and acceptance criteria

## AI Quick Start (VS Code + Xcode)

Use this when handing work between IDEs or AI agents.

1. `pnpm validate:fast`
2. `pnpm --filter @guess/mobile typecheck`
3. `pnpm --filter @guess/mobile sync:xcode-env`

If dependencies or Expo config changed:

1. `pnpm --filter @guess/mobile prebuild:ios`
2. `pnpm --filter @guess/mobile pods`

For boundaries, handoff, and ownership rules use:

- `ROADMAP.md`
- `docs/mobile/roadmap-foundations.md`
- `docs/mobile/xcode-setup.md`
- `docs/mobile/xcode-claude-memory-handoff.md`
