# iOS Release and Handoff Playbook

Effective date: 2026-05-11

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

This section is the MR.2 release gate record.

### Preflight Metadata

- Preflight date: 2026-05-11
- Owner: andernet
- Build track: iOS parity release closeout (post-MP.7, mobile-only roadmap)
- Evidence source bundle:
   - `docs/mobile/device-validation-checklist.md`
   - `docs/mobile/parity-matrix.md`
   - `docs/mobile/ios-qa-evidence-index.md`
   - `docs/mobile/screenshots/2026-05-10-mp6-offline-diagnostics-1.png`
   - `docs/mobile/screenshots/2026-05-10-mp6-offline-diagnostics-2.png`
   - `docs/mobile/screenshots/2026-05-10-mp6-offline-recording.mov`
   - `.ci-artifacts/mobile-ci/reliability-perf-gate.log`
   - `.ci-artifacts/mobile-ci/mobile-core-flow-e2e.log`

### Functional Preflight Matrix

| Flow | Status | Evidence |
| --- | --- | --- |
| Welcome -> Playing -> Guessing -> Game Over | ✅ Pass | `docs/mobile/device-validation-checklist.md`, `e2e/mobile-core-flow.spec.ts` |
| Challenge entry + leaderboard summary | ✅ Pass | `docs/mobile/device-validation-checklist.md`, `e2e/mobile-core-flow.spec.ts` |
| Resume interrupted session | ✅ Pass | `docs/mobile/device-validation-checklist.md`, `e2e/mobile-core-flow.spec.ts` |
| Feedback submission (online + queued offline path) | ✅ Pass | `docs/mobile/device-validation-checklist.md`, `e2e/mobile-core-flow.spec.ts`, `apps/mobile/src/network/mobileOfflineQueue.test.ts` |
| Preferences persistence across relaunch | ✅ Pass | `docs/mobile/device-validation-checklist.md`, `apps/mobile/src/state/mobilePreferencesSession.test.ts` |
| Teaching, Stats, History, Compare surfaces load with current branch data/copy | ✅ Pass | `docs/mobile/parity-matrix.md`, `docs/mobile/device-validation-checklist.md` |

### Quality Preflight Matrix

| Gate | Status | Evidence |
| --- | --- | --- |
| VoiceOver on changed screens | ✅ Pass | `docs/mobile/device-validation-checklist.md` |
| Dynamic Type behavior | ✅ Pass | `docs/mobile/device-validation-checklist.md`, `docs/mobile/screen-quality-scores.json` |
| Reduced-motion behavior | ✅ Pass | `docs/mobile/device-validation-checklist.md` |
| Performance budgets (tap/transition/feedback) | ✅ Pass | `docs/mobile/device-validation-checklist.md`, `docs/mobile/screenshots/2026-05-10-mp6-offline-diagnostics-1.png`, `docs/mobile/screenshots/2026-05-10-mp6-offline-diagnostics-2.png` |
| Airplane-mode offline/reconnect recovery | ✅ Pass | `docs/mobile/device-validation-checklist.md`, `docs/mobile/screenshots/2026-05-10-mp6-offline-recording.mov` |
| Mobile CI reliability gate | ✅ Pass | `.ci-artifacts/mobile-ci/reliability-perf-gate.log`, `.github/workflows/mobile-ci.yml` |
| Mobile core-flow E2E gate | ✅ Pass | `.ci-artifacts/mobile-ci/mobile-core-flow-e2e.log`, `.github/workflows/mobile-ci.yml`, `e2e/mobile-core-flow.spec.ts` |
| Runtime telemetry baseline (global + network error capture) | ✅ Pass | `apps/mobile/src/perf/mobileRuntimeTelemetry.ts`, `apps/mobile/src/network/mobileGameApi.ts`, `apps/mobile/src/screens/StatsScreen.tsx` |

### Privacy and Submission Notes

- Privacy-sensitive behavior remains consistent with current network + offline queue architecture (`apps/mobile/src/network/mobileOfflineQueue.ts`).
- No blocker defects remain for the release-critical player flows listed above.
- Crash-free physical-device smoke evidence is captured in the MP.6 offline recording bundle.

### Intentional Web Divergences (Must Be Listed in Release Notes)

- Challenge leaderboard remains summary-first (top-10) on mobile.
- Describe Yourself remains deferred for a later mobile milestone.
- Team leaderboard surfaces remain deferred until multi-player session support is prioritized.

## Release Evidence Package

Before marking MP.6 or MP.7 complete, capture and reference:

- `docs/mobile/device-validation-checklist.md` MP.6 addendum results
- `docs/mobile/parity-matrix.md` row updates for touched features
- `.ci-artifacts/mobile-ci/reliability-perf-gate.log` (or equivalent CI artifact)
- Runtime telemetry snapshot from Stats diagnostics (runtime totals + latest events)
- Any device screenshots/recordings stored under `docs/mobile/screenshots/`

### MP.7 Release Prep Notes

- Confirm the changelog entry reflects the current RN branch truth and does not describe the legacy SwiftUI reset baseline as shipped state.
- Verify the handoff summary names the exact capture paths for Stats diagnostics and airplane-mode recordings.
- Call out any intentional divergences from web behavior in the release notes so Xcode-side reviewers know what is expected.

## App Store Submission Checklist

- [x] Confirm version/build number alignment with the release notes.
- [x] Confirm privacy disclosure text still matches current networked and offline-queue behavior.
- [x] Confirm no open blocker issues in start game, challenge, resume, feedback, or preferences flows.
- [x] Confirm TestFlight smoke run on at least one current iPhone and one small-screen device.
- [x] Confirm release handoff notes call out remaining intentional divergences from web.

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
