# iOS QA Evidence Index

Effective date: 2026-05-09

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

Minimum requirement for milestone closure:

- Each changed surface has score evidence that meets milestone gate thresholds.

### Device Validation

- Runtime checklist: `docs/mobile/device-validation-checklist.md`
- Test notes: link concrete run notes in PR description and parity evidence rows

Minimum requirement for milestone closure:

- Physical-device run completed for changed surfaces.
- Checklist entries dated and attributable.

### Performance

- Capture startup and transition traces for changed surfaces.
- Include p95 tap-to-feedback and key transition timing evidence.

Suggested artifact folder:

- `docs/mobile/evidence/perf/` (date-prefixed files)

Minimum requirement for milestone closure:

- No regressions beyond approved thresholds in `ios-feature-parity-plan.md`.

### Accessibility

- VoiceOver flow checks for each changed screen.
- Dynamic Type scaling checks at large content sizes.
- Reduced-motion behavior checks for animated transitions.

Suggested artifact folder:

- `docs/mobile/evidence/a11y/` (date-prefixed files)

Minimum requirement for milestone closure:

- Changed surfaces pass accessibility checks with no blocker defects.

### Error and Recovery

- Retry behavior verified for network and transient failures.
- Offline or degraded-path behavior validated for changed flows.

Suggested artifact folder:

- `docs/mobile/evidence/reliability/` (date-prefixed files)

Minimum requirement for milestone closure:

- Recovery paths validated and documented with evidence links.

## Milestone Closure Protocol

Before setting an MP row to complete:

1. Update `docs/mobile/parity-matrix.md` with evidence links for touched features.
2. Ensure scorecard and device validation artifacts are current.
3. Attach performance and accessibility evidence for changed surfaces.
4. Confirm no contradiction between `ROADMAP.md`, `ios-feature-parity-plan.md`, and `parity-matrix.md`.

## PR Checklist Snippet

Use this checklist in mobile parity pull requests:

- [ ] Score evidence linked
- [ ] Device checklist evidence linked
- [ ] Performance evidence linked
- [ ] Accessibility evidence linked
- [ ] Recovery/error-path evidence linked
- [ ] `parity-matrix.md` evidence column updated
