# iOS QA Evidence Index

Effective date: 2026-05-11

This index is the canonical checklist for milestone evidence required before marking iOS parity work complete.

## Required Evidence Types

- Screen quality evidence
- Device validation evidence
- Performance evidence
- Accessibility evidence
- Error and recovery evidence

## Evidence Locations

### Screen Quality

- Primary score rubric: `docs/mobile/screen-quality-scorecard.md`
- Expected score artifacts: mobile score outputs referenced in `docs/mobile/parity-matrix.md`
- Current branch references:
	- `docs/mobile/parity-matrix.md` (core feature rows last verified 2026-05-10)
	- `docs/mobile/screen-quality-scores.json`

Minimum requirement for milestone closure:

- Each changed surface has score evidence that meets milestone gate thresholds.

### Device Validation

- Runtime checklist: `docs/mobile/device-validation-checklist.md`
- Test notes: link concrete run notes in PR description and parity evidence rows
- Current branch references:
	- `docs/mobile/device-validation-checklist.md` (2026-05-10 run record + MP.6 pasteback)
	- `docs/mobile/screenshots/2026-05-10-mp6-offline-recording.mov`

Minimum requirement for milestone closure:

- Physical-device run completed for changed surfaces.
- Checklist entries dated and attributable.

### Performance

- Capture startup and transition traces for changed surfaces.
- Include p95 tap-to-feedback and key transition timing evidence.
- Current branch references:
	- `apps/mobile/src/perf/mobilePerfMetrics.ts`
	- `apps/mobile/src/perf/mobilePerfMetrics.test.ts`
	- `docs/mobile/screenshots/2026-05-10-mp6-offline-diagnostics-1.png`
	- `docs/mobile/screenshots/2026-05-10-mp6-offline-diagnostics-2.png`
	- `.ci-artifacts/mobile-ci/reliability-perf-gate.log`

Minimum requirement for milestone closure:

- No regressions beyond approved thresholds in `ios-feature-parity-plan.md`.

### Accessibility

- VoiceOver flow checks for each changed screen.
- Dynamic Type scaling checks at large content sizes.
- Reduced-motion behavior checks for animated transitions.
- Current branch references:
	- `docs/mobile/device-validation-checklist.md` (native module + run notes)
	- `docs/mobile/screen-quality-scores.json` (score evidence and notes)

Minimum requirement for milestone closure:

- Changed surfaces pass accessibility checks with no blocker defects.

### Error and Recovery

- Retry behavior verified for network and transient failures.
- Offline or degraded-path behavior validated for changed flows.
- Current branch references:
	- `apps/mobile/src/network/mobileOfflineQueue.ts`
	- `apps/mobile/src/network/mobileOfflineQueue.test.ts`
	- `apps/mobile/src/network/mobileGameApi.ts`
	- `apps/mobile/src/network/mobileGameApi.test.ts`
	- `docs/mobile/screenshots/2026-05-10-mp6-offline-recording.mov`

Minimum requirement for milestone closure:

- Recovery paths validated and documented with evidence links.

## Milestone Closure Protocol

Before setting an MP row to complete:

1. Update `docs/mobile/parity-matrix.md` with evidence links for touched features.
2. Ensure scorecard and device validation artifacts are current.
3. Attach performance and accessibility evidence for changed surfaces.
4. Confirm no contradiction between `ROADMAP.md`, `ios-feature-parity-plan.md`, and `parity-matrix.md`.

## Canonical Evidence Bundle (MP.6/MP.7)

Use these as the reference artifacts for release-closeout validations:

- `docs/mobile/parity-matrix.md`
- `docs/mobile/device-validation-checklist.md`
- `docs/mobile/ios-release-handoff-playbook.md`
- `docs/mobile/screenshots/2026-05-10-mp6-offline-diagnostics-1.png`
- `docs/mobile/screenshots/2026-05-10-mp6-offline-diagnostics-2.png`
- `docs/mobile/screenshots/2026-05-10-mp6-offline-recording.mov`
- `.ci-artifacts/mobile-ci/reliability-perf-gate.log`

## Canonical Evidence Bundle (MR.2 Release Preflight)

Use these as the reference artifacts for App Store / TestFlight readiness sign-off:

- `docs/mobile/ios-release-handoff-playbook.md` (functional + quality preflight matrices)
- `docs/mobile/parity-matrix.md`
- `docs/mobile/device-validation-checklist.md`
- `.ci-artifacts/mobile-ci/reliability-perf-gate.log`
- `.ci-artifacts/mobile-ci/mobile-core-flow-e2e.log`

## Canonical Evidence Bundle (MN.3 Runtime Telemetry Baseline)

Use these as the reference artifacts for mobile stability go/no-go checks:

- `apps/mobile/src/perf/mobileRuntimeTelemetry.ts`
- `apps/mobile/src/perf/mobileRuntimeTelemetry.test.ts`
- `apps/mobile/src/network/mobileGameApi.ts` (runtime/network error capture hooks)
- `apps/mobile/app/index.tsx` (global fatal/non-fatal handler)
- `apps/mobile/src/screens/StatsScreen.tsx` (runtime telemetry diagnostics summary)

## Canonical Evidence Bundle (MY.2 Leaderboard Depth Perf Validation)

Use these as the reference artifacts for validating expanded challenge leaderboard depth (up to 25 rows):

- `docs/mobile/device-validation-checklist.md` (MY.2 addendum section + pasteback)
- `docs/mobile/parity-matrix.md` (Challenge row + exception register wording)
- `docs/mobile/screenshots/YYYY-MM-DD-my2-leaderboard-expanded.png`
- `docs/mobile/screenshots/YYYY-MM-DD-my2-leaderboard-scroll.mov`
- `docs/mobile/screenshots/YYYY-MM-DD-my2-leaderboard-diagnostics.png` (optional)

MY.2 closure requirements:

- At least one small-screen physical-device run is captured.
- Expanded-list scroll behavior is documented as pass/fail with notes.
- If regressions appear, fallback cap recommendation is documented before marking complete.

## PR Checklist Snippet

Use this checklist in mobile parity pull requests:

- [ ] Score evidence linked
- [ ] Device checklist evidence linked
- [ ] Performance evidence linked
- [ ] Accessibility evidence linked
- [ ] Recovery/error-path evidence linked
- [ ] `parity-matrix.md` evidence column updated
