# Xcode Setup (apps/mobile)

This project uses Expo + React Native. The Xcode workspace is generated from Expo config and should be treated as a native output surface.

Planning references:

- `ROADMAP.md` for active mobile queue/status (`MB.*`).
- `docs/mobile/roadmap-foundations.md` for foundational sequencing and acceptance criteria.

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

## SweetPad in VS Code

SweetPad is configured at the repo root for the mobile workspace.

1. Open the repo root in VS Code.
2. Use the SweetPad Build panel to build and run `Andernator.xcworkspace`.
3. Press `F5` to attach with the preconfigured CodeLLDB launch profile.

The workspace settings point SweetPad at `apps/mobile/ios/Andernator.xcworkspace`, and the project already ships with `buildServer.json` for autocomplete.

## Physical Device Run (Red Header / Black Screen Recovery)

If you see a black screen with a red header and actions like `Dismiss`, `Reload JS`, and `Copy`, the app is running but Metro is unreachable.

Run this flow from repo root before launching from Xcode on iPhone:

1. Start Metro for physical-device dev client:
   - `pnpm mobile:dev:device`
2. Keep Metro running, then launch from Xcode.
3. The default device launcher uses tunnel, so it does not depend on the iPhone reaching the Mac over LAN.
4. If you need a direct LAN session, use `pnpm mobile:dev:device -- --host lan`.

If the device still cannot connect to Metro:

1. Create local override file:
   - `cp apps/mobile/.xcode.env.local.example apps/mobile/ios/.xcode.env.local`
2. Set your Mac LAN IP in `apps/mobile/ios/.xcode.env.local`:
   - `export RCT_METRO_HOST=<your-mac-lan-ip>`
3. Re-run:
   - `pnpm --filter @guess/mobile sync:xcode-env`
   - `pnpm mobile:dev:device`
4. Clean build folder in Xcode and relaunch.

Fallback when local LAN is constrained or tunnel is unavailable:

- `pnpm mobile:dev:tunnel`

## Environment config

- Shared config file: `apps/mobile/.xcode.env`
- Local overrides template: `apps/mobile/.xcode.env.local.example`
- Sync into generated iOS folder: `pnpm --filter @guess/mobile sync:xcode-env`

## Notes

- Do not import web UI modules into mobile code. Guardrails are enforced by `pnpm mobile:guardrails`.
- Treat `apps/mobile/ios/Pods` and build outputs as generated artifacts.
- If Expo config changes, regenerate native files with `pnpm mobile:prebuild:ios`.
- For AI context handoff limitations between IDEs, use `docs/mobile/xcode-claude-memory-handoff.md`.

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
