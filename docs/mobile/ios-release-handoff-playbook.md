# iOS Release and Handoff Playbook

Effective date: 2026-05-10

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
6. `pnpm mobile:reliability-gate`

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
- Teaching, Stats, History, and Compare surfaces load with current branch data and copy.
- Feedback submission succeeds online and queues safely offline.

Quality preflight:

- VoiceOver pass for changed screens.
- Dynamic Type pass for changed screens.
- Reduced-motion pass for changed screens.
- Performance budgets checked for changed transitions and interactions.
- Airplane-mode run verifies connection banner, sync badge, queueing, and reconnect flush.

## Release Evidence Package

Before marking MP.6 or MP.7 complete, capture and reference:

- `docs/mobile/device-validation-checklist.md` MP.6 addendum results
- `docs/mobile/parity-matrix.md` row updates for touched features
- `.ci-artifacts/mobile-ci/reliability-perf-gate.log` (or equivalent CI artifact)
- Any device screenshots/recordings stored under `docs/mobile/screenshots/`

## App Store Submission Checklist

- Confirm version/build number alignment with the release notes.
- Confirm privacy disclosure text still matches current networked and offline-queue behavior.
- Confirm no open blocker issues in start game, challenge, resume, feedback, or preferences flows.
- Confirm TestFlight smoke run on at least one current iPhone and one small-screen device.
- Confirm release handoff notes call out remaining intentional divergences from web.

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
   - `docs/mobile/ios-release-handoff-playbook.md`
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
