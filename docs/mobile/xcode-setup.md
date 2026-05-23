# Xcode Setup (apps/mobile)

This project uses Expo + React Native. The active delivery platform is React Native / Expo for iOS parity, with native screens in `apps/mobile/src/screens/**`.

Planning references:

- `ROADMAP.md` for active mobile queue/status (`MP.*`).
- `docs/mobile/ios-feature-parity-plan.md` for parity sequencing and quality gates.
- `docs/mobile/ios-architecture-map.md` for state/navigation/networking boundaries.

## Prerequisites

- Xcode installed (latest stable)
- CocoaPods installed (`pod` available in PATH)
- Node + pnpm available in PATH

## Generate and open in Xcode

From repo root:

1. Generate iOS project:
   - `pnpm mobile:prebuild:ios`
2. Open the generated workspace in Xcode:
   - `open apps/mobile/ios/*.xcworkspace`
3. Build/run from Xcode or use:
   - `pnpm mobile:ios`

## VS Code Mobile Loop

From repo root:

1. Start Expo dev server:
   - `pnpm mobile:dev`
2. Use tunnel mode if LAN/networking is restricted:
   - `pnpm mobile:dev:tunnel`
3. Typecheck mobile workspace:
   - `pnpm mobile:typecheck`

## Physical Device Notes

- Keep Metro running (`pnpm mobile:dev` or `pnpm mobile:dev:tunnel`) before launching from Xcode.
- If the device cannot reach Metro over LAN, prefer tunnel mode.
- If you see stale bundles, clean build folder in Xcode and restart Metro.

## Environment config

- Keep environment/config assumptions documented in `docs/mobile/xcode-claude-memory-handoff.md`.
- If new native env sync tooling is added, update this runbook and root scripts in the same commit.

## Notes

- Do not import web UI modules into mobile code. Guardrails are enforced by `pnpm mobile:guardrails`.
- Treat `apps/mobile/ios/**` generated content and build outputs as artifacts unless explicitly editing native implementation files.
- If Expo config changes, regenerate native files with `pnpm mobile:prebuild:ios`.
- For AI context handoff limitations between IDEs, use `docs/mobile/xcode-claude-memory-handoff.md`.
- For architecture intent, use `docs/mobile/ios-architecture-map.md`.

## VS Code + Xcode AI Sync Contract

Use this checklist to keep both IDE workflows aligned for AI-assisted changes.

### Source-of-truth boundaries

- Product logic and orchestration: mobile app state + API adapters + shared package boundaries.
- Active architecture source: `docs/mobile/ios-architecture-map.md`.
- Generated native output: `apps/mobile/ios/**` from Expo prebuild (when using Expo flows).
- Native implementation details and handoff notes: `docs/mobile/xcode-claude-memory-handoff.md`.

### Safe edit policy

- Prefer editing TypeScript and Expo config in VS Code.
- Regenerate iOS output after relevant config/dependency changes:
  - `pnpm mobile:prebuild:ios`
- Avoid committing accidental generated churn from `apps/mobile/ios/**` unless intentionally updating native project files.

### AI session handoff routine

Before switching IDEs (or AI agents), run from repo root:

1. `pnpm validate:fast`
2. `pnpm mobile:typecheck`
3. `pnpm mobile:guardrails`

This keeps code health, mobile type safety, and Xcode env parity in sync.

### Native-only changes

- If a change is made directly in Xcode-native files, mirror intent back into docs and mobile TS entry points so future AI work in VS Code has context.
- When introducing native module behavior, document why Expo-level APIs were insufficient in `docs/mobile/native-product-contract.md`.

### Native scaffold entry points

- Reference native service intent and ownership in `docs/mobile/ios-architecture-map.md`.
- When adding/updating Swift modules, document why platform-level behavior is needed and how fallbacks behave.
