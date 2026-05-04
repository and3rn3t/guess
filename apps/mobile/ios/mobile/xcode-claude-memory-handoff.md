# Xcode + Claude Memory Handoff

## Why this exists

Claude memory files used in one IDE/session are not guaranteed to be visible in another toolchain. In practice, Xcode-side assistants may not have access to Copilot memory scopes.

For this repo, the reliable shared memory is:

- Git-tracked docs in `docs/mobile/**`
- Git-tracked source comments in mobile/native files
- Commit history and PR descriptions

Do not depend on external memory files as the primary handoff mechanism.

## Canonical handoff sources

Before starting Xcode-native work, read in order:

1. `docs/mobile/native-product-contract.md`
2. `docs/mobile/native-surface-policy.md`
3. `docs/mobile/xcode-setup.md`
4. `apps/mobile/README.md` (AI quick start)

## Required handoff block for native PRs

Include this in every PR touching `apps/mobile/ios/**`.

```md
### Xcode Handoff
- Intent:
- User impact:
- Files touched:
- Bridge/API surface added or changed:
- TS fallback behavior:
- Validation run:
  - pnpm validate:fast
  - pnpm --filter @guess/mobile typecheck
- Follow-up tasks:
```

## Native implementation notes policy

When adding/changing Swift behavior, add a short note in one of:

- The relevant Swift file header comment, and/or
- `docs/mobile/xcode-setup.md` under the native sections

Minimum note content:

- Why native implementation is needed vs Expo-only path
- What JS/TS caller contract it exposes
- What fallback path exists if bridge is unavailable

## IDE sync routine

Run from repo root before switching IDEs or AI agents:

1. `pnpm validate:fast`
2. `pnpm --filter @guess/mobile typecheck`
3. `pnpm --filter @guess/mobile sync:xcode-env`

If dependencies or Expo config changed:

1. `pnpm --filter @guess/mobile prebuild:ios`
2. `pnpm --filter @guess/mobile pods`

## Source-of-truth boundaries

- Product/game logic: `apps/mobile/src/**`, `packages/app-core/**`
- Native capabilities: `apps/mobile/ios/Andernator/**`
- Generated artifacts to review carefully: `apps/mobile/ios/Pods/**`, build output, and broad prebuild churn

## Quick rule

If Xcode-side AI cannot see prior memory, treat this file and `docs/mobile/` as the authoritative context and continue from there.
