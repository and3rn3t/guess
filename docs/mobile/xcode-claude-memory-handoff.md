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

1. `ROADMAP.md` (mobile queue/status; active IDs are `MR.*`, `MN.*`, `MX.*`)
2. `docs/mobile/parity-matrix.md`
3. `docs/mobile/ios-feature-parity-plan.md`
4. `docs/mobile/native-product-contract.md`
5. `docs/mobile/native-surface-policy.md`
6. `docs/mobile/ios-release-handoff-playbook.md`
7. `docs/mobile/device-validation-checklist.md`
8. `docs/mobile/xcode-setup.md`

## Current branch behaviors to preserve

- Session resume durability is backed by AsyncStorage in `apps/mobile/src/state/mobileSessionDurability.ts`; do not regress cold-start resume while touching provider lifecycle code.
- Offline resilience is visible in product UI through the connection banner, sync badge, offline queue, and replay-on-foreground flow; changes in `mobileGameApi.ts` should preserve those behaviors.
- MP.6 diagnostics live in `StatsScreen` and are currently the canonical in-app source for p95 tap-to-feedback and transition timing evidence.
- The current CI release guard for mobile behavior is `pnpm mobile:reliability-gate`; if you move tests or files, keep `.github/workflows/mobile-ci.yml` and `docs/ci-artifacts.md` in sync.

## MP.7 Handoff Focus

- The physical-device evidence path lives in `docs/mobile/device-validation-checklist.md` and `docs/mobile/screenshots/`; use the Stats diagnostics share action for pasteback snapshots when manual selection is unreliable.
- Release-prep reviewers should confirm the branch still reports `main...origin/main` cleanly after any push and that `pnpm mobile:reliability-gate` remains green before handoff.
- If MP.7 is being prepared for app submission, keep the changelog scope aligned with the shipped RN surfaces and call out intentional mobile divergences in the PR summary.

Current known evidence bundle:

- `docs/mobile/screenshots/2026-05-10-mp6-offline-diagnostics-1.png`
- `docs/mobile/screenshots/2026-05-10-mp6-offline-diagnostics-2.png`
- `docs/mobile/screenshots/2026-05-10-mp6-offline-recording.mov`

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
  - pnpm mobile:reliability-gate
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
3. `pnpm mobile:reliability-gate`
4. `pnpm --filter @guess/mobile sync:xcode-env`

If dependencies or Expo config changed:

1. `pnpm --filter @guess/mobile prebuild:ios`
2. `pnpm --filter @guess/mobile pods`

## Source-of-truth boundaries

- Product/game logic: `apps/mobile/src/**`, `packages/app-core/**`
- Native capabilities: `apps/mobile/ios/Andernator/**`
- Generated artifacts to review carefully: `apps/mobile/ios/Pods/**`, build output, and broad prebuild churn

## Quick rule

If Xcode-side AI cannot see prior memory, treat this file and `docs/mobile/` as the authoritative context and continue from there.
