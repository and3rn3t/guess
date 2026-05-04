# Xcode Setup (apps/mobile)

This project uses Expo + React Native. The Xcode workspace is generated from Expo config and should be treated as a native output surface.

## Prerequisites

- Xcode installed (latest stable)
- CocoaPods installed (`pod` available in PATH)
- Node + pnpm available in PATH

## Generate and open in Xcode

From repo root:

1. Generate iOS project:
   - `pnpm mobile:prebuild:ios`
2. Install pods:
   - `pnpm mobile:pods`
3. Open workspace:
   - `pnpm mobile:open:xcode`

Or run all three:

- `pnpm mobile:setup:xcode`

## Environment config

- Shared config file: `apps/mobile/.xcode.env`
- Local overrides template: `apps/mobile/.xcode.env.local.example`
- Sync into generated iOS folder: `pnpm --filter @guess/mobile sync:xcode-env`

## Notes

- Do not import web UI modules into mobile code. Guardrails are enforced by `pnpm mobile:guardrails`.
- Treat `apps/mobile/ios/Pods` and build outputs as generated artifacts.
- If Expo config changes, regenerate native files with `pnpm mobile:prebuild:ios`.
