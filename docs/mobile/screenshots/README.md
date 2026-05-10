# Mobile Evidence Screenshots

Store physical-device evidence captures for mobile parity and release gates here.

## Naming Convention

Use date-prefixed filenames so parity evidence stays attributable:

- `YYYY-MM-DD-mp6-stats-diagnostics.png` — Stats diagnostics screenshot showing p95 values and sample counts
- `YYYY-MM-DD-mp6-offline-recording.mov` — airplane-mode recording covering offline banner, queueing, and reconnect flush
- `YYYY-MM-DD-mp3-stats-a11y.png` — accessibility or Dynamic Type evidence for upgraded surfaces

## Capture Rules

- Capture from a physical device when the checklist requires device evidence.
- Keep one file per validation run instead of overwriting older captures.
- Reference the exact file path in `docs/mobile/device-validation-checklist.md` pasteback notes and in `docs/mobile/parity-matrix.md` evidence cells when a milestone is closed.
- If a capture contains sensitive data, redact before committing.

## Minimum MP.6 Evidence Set

- One Stats diagnostics screenshot after 20+ gameplay samples
- One offline/airplane-mode recording that shows queueing and reconnect flush
