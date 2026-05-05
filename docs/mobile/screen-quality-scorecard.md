# Screen Quality Scorecard

Use this scorecard for each touched core screen in mobile pull requests.

## Categories and Weights

- Native Interaction Fidelity: 25
- Visual Native Fit: 20
- Accessibility and Inclusivity: 20
- Performance Feel: 15
- Platform Behavior Integrity: 10
- Content Clarity and Cognitive Load: 10

Total: 100

## Category Rubric

### Native Interaction Fidelity (25)

- Gestures feel platform-appropriate.
- Touch feedback is immediate and clear.
- Transition behavior feels native, not web-like.
- Interaction affordances match iOS expectations.

### Visual Native Fit (20)

- Typography scale and rhythm are iOS-consistent.
- Layout hierarchy is clear without web-style density.
- Navigation chrome and spacing match native norms.

### Accessibility and Inclusivity (20)

- VoiceOver labels and hints are complete.
- Dynamic Type works without clipping/overlap.
- Touch targets are usable.
- Reduced-motion behavior is supported.

### Performance Feel (15)

- P95 tap-to-feedback latency under 100 ms.
- P95 transition start under 150 ms.
- No noticeable stutter in core gameplay flow.

### Platform Behavior Integrity (10)

- Safe-area behavior is correct.
- Keyboard avoidance is robust.
- App lifecycle interruption/resume behavior is stable.

### Content Clarity and Cognitive Load (10)

- Player always knows current state and next action.
- Information hierarchy supports quick decisions.
- Copy reduces ambiguity under pressure.

## Thresholds

- PR merge threshold: weighted score >= 88 and no category below 80.
- Milestone threshold: weighted score >= 90 and no category below 85.
- Production threshold: weighted score >= 92 and no category below 88.

## PR Evidence Template

For each touched core screen:

- Score per category + weighted total.
- Accessibility checks performed.
- Performance measurements on target device.
- Device checklist run recorded in `docs/mobile/device-validation-checklist.md`.
- Known issues and mitigation plan.

## Guardrail Automation

Run the scorecard guardrail from repo root:

- `pnpm mobile:scorecard`

The guardrail validates touched core screens by default using git diff against the base ref.
Fallback behavior validates all core screens when touched-screen detection is unavailable.

Supported gate modes:

- `--gate=prMerge` (default)
- `--gate=milestone`
- `--gate=production`

Optional base ref overrides:

- `--base-ref=<git-ref>`
- `MOBILE_SCORECARD_BASE_REF=<git-ref>` environment variable

Gate behavior:

- Missing score entry for a touched core screen: fail.
- `prMerge` gate: below-threshold rows warn only when `deviceValidationPending=true`, otherwise fail.
- `milestone` and `production` gates: below-threshold rows fail regardless of pending device validation.

Threshold tracking output includes:

- Weighted score per screen.
- Per-threshold pass/fail state (`prMerge`, `milestone`, `production`).
- Device-validation pending marker.
