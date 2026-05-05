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
- For AI context handoff limitations between IDEs, use `docs/mobile/xcode-claude-memory-handoff.md` as the canonical repo note.

## VS Code + Xcode AI Sync Contract

Use this checklist to keep both IDE workflows aligned for AI-assisted changes.

### Source-of-truth boundaries

- Product logic and orchestration: `apps/mobile/src/**` and `packages/app-core/**`.
- Native bridge runtime (TS/hooks/debug tooling): `apps/mobile/src/native/**`.
- Generated native output: `apps/mobile/ios/**` from Expo prebuild.
- Shared iOS environment: `apps/mobile/.xcode.env` (sync via `pnpm --filter @guess/mobile sync:xcode-env`).

### Safe edit policy

- Prefer editing TypeScript and Expo config in VS Code.
- Regenerate iOS output after relevant config/dependency changes:
   - `pnpm mobile:prebuild:ios`
   - `pnpm mobile:pods`
- Avoid committing accidental generated churn from `apps/mobile/ios/**` unless intentionally updating native project files.

### AI session handoff routine

Before switching IDEs (or AI agents), run from repo root:

1. `pnpm validate:fast`
2. `pnpm --filter @guess/mobile typecheck`
3. `pnpm --filter @guess/mobile sync:xcode-env`

This keeps code health, mobile type safety, and Xcode env parity in sync.

### Native-only changes

- If a change is made directly in Xcode-native files, mirror intent back into docs and mobile TS entry points so future AI work in VS Code has context.
- When introducing native module behavior, document why Expo-level APIs were insufficient in `docs/mobile/native-product-contract.md`.

### Swift scaffold entry points

- Starter Swift files are scaffolded at `apps/mobile/ios/Andernator/NativeServices/`.
- In Xcode, ensure each file is added to the project and has target membership for `Andernator`.
- Start implementation from:
   - `HapticsService.swift`
   - `VoiceOverAnnouncer.swift`
   - `ReduceMotionObserver.swift`
   - `LifecycleObserver.swift`
   - `BridgeContract.swift`
