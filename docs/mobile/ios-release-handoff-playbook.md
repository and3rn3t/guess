# iOS Release and Handoff Playbook

Effective date: 2026-05-09

This playbook defines pre-release checks, release communication requirements, and handoff steps for iOS parity work.

## Release Preconditions

- Target MP milestone is implementation-complete.
- `docs/mobile/parity-matrix.md` includes current evidence links.
- QA evidence meets gates in `docs/mobile/ios-qa-evidence-index.md`.

## Local Validation Gate

Run from repo root:

1. `pnpm validate`
2. `pnpm build`
3. `pnpm build:worker`
4. `pnpm mobile:typecheck`
5. `pnpm mobile:guardrails`

If iOS dependencies/config changed:

1. `pnpm mobile:prebuild:ios`
2. `pnpm mobile:ios`

## TestFlight and App Store Preflight

- Confirm build version and changelog scope alignment.
- Confirm no blocker issues remain in changed player-facing flows.
- Confirm privacy-sensitive behaviors and data disclosures are still accurate.
- Confirm crash-free smoke run on at least one physical device.

Functional preflight:

- Welcome -> Playing -> Guessing -> Game Over flow completes.
- Challenge flow and leaderboard summary render correctly.
- Resume path and preferences persistence verified.

Quality preflight:

- VoiceOver pass for changed screens.
- Dynamic Type pass for changed screens.
- Reduced-motion pass for changed screens.
- Performance budgets checked for changed transitions and interactions.

## Release Notes Contract

For every iOS parity release update:

- Update `CHANGELOG.md` with shipped mobile scope.
- List intentional divergences from web behavior.
- Call out known limitations and follow-up items.

## VS Code and Xcode Handoff

Before handoff to another contributor:

1. Update `ROADMAP.md` status and `In Progress / Up Next` if needed.
2. Update `docs/mobile/parity-matrix.md` state and evidence columns.
3. Update operational docs when behavior/scripts changed:
   - `docs/mobile/xcode-setup.md`
   - `docs/mobile/xcode-claude-memory-handoff.md`
4. Include links to QA evidence artifacts in the PR summary.
5. Include unresolved risks and next actions.

## Handoff Template

Use this in PR description or team handoff notes:

- Milestone: MP.x
- Scope shipped:
- Evidence links:
- Known divergences:
- Known risks:
- Next recommended step:
