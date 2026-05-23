# iOS Documentation Program

Effective date: 2026-05-09

This document defines the documentation backlog and acceptance gates for the iOS parity effort (React Native / Expo implementation).

## Purpose

- Keep documentation in lockstep with implementation.
- Remove stale or contradictory iOS notes from active planning paths.
- Ensure a new contributor can set up, validate, and ship without oral handoff.

## Scope

In scope:

- Mobile planning docs under `docs/mobile/**`
- Mobile execution status in `ROADMAP.md` (MP.*)
- Mobile architecture references in `ARCHITECTURE.md`
- Release communication in `CHANGELOG.md`

Out of scope:

- Admin-only surfaces not included in iOS v1 parity
- Web/PWA-only behavior docs unless they directly affect mobile parity boundaries

## Source-of-Truth Ownership

- `ROADMAP.md`: queue/status and in-progress/up-next only
- `docs/mobile/ios-feature-parity-plan.md`: milestone sequencing and quality gates
- `docs/mobile/parity-matrix.md`: feature-by-feature parity truth + evidence
- `docs/mobile/ios-documentation-program.md`: documentation backlog and gates
- `docs/mobile/xcode-setup.md`: setup and toolchain runbook
- `docs/mobile/xcode-claude-memory-handoff.md`: cross-IDE handoff protocol
- `docs/mobile/screen-quality-scorecard.md`: UX-quality scoring rubric
- `docs/mobile/device-validation-checklist.md`: physical-device validation evidence

## Backlog

### D.1 Active Doc Reset

Goal: eliminate stale active references from the pre-reset mobile track.

Done when:

- `docs/mobile/README.md` read order points to MP-era docs first.
- `docs/mobile/parity-matrix.md` states match active branch reality.
- Superseded notes are archived with pointer stubs instead of silent deletion.

### D.2 Architecture Reference

Goal: document React Native / Expo architecture with clear boundaries.

Done when:

- `docs/mobile/ios-architecture-map.md` includes state model, navigation model, transport layer, persistence, and native service boundaries.
- Reuse boundaries with `@guess/app-core` and backend contracts are explicit.
- Error handling and offline behavior strategy are documented.

### D.3 Screen Specification Pack

Goal: define implementation-ready specs for each player-facing screen.

Done when each screen has:

- purpose and primary user jobs
- state matrix (`idle`, `loading`, `error`, `offline`, `empty`)
- accessibility requirements (VoiceOver, Dynamic Type, reduced motion)
- iOS/HIG notes and interaction expectations
- telemetry events and success criteria

Primary artifact:

- `docs/mobile/ios-screen-spec-pack.md`

### D.4 API Contract Reference

Goal: mobile-facing API behavior is explicit and testable.

Done when:

- Player-facing endpoints are documented with request/response examples.
- Error semantics and retry guidance are documented.
- Contract references align with `docs/openapi-inventory.json` and endpoint constants.

Primary artifact:

- `docs/mobile/ios-api-contract-reference.md`

### D.5 Operations and QA Evidence

Goal: make validation repeatable and auditable.

Done when:

- runbook includes common failures and recovery paths
- QA evidence index links scorecards, device checklist runs, and perf traces
- milestone closure requires evidence links in `parity-matrix.md`

Primary artifact:

- `docs/mobile/ios-qa-evidence-index.md`

### D.6 Release and Handoff

Goal: ensure predictable release communication and team continuity.

Done when:

- TestFlight/App Store preflight checklist exists and is current
- release notes summarize mobile scope and known divergences
- handoff checklist is complete for VS Code + Xcode continuity

Primary artifact:

- `docs/mobile/ios-release-handoff-playbook.md`

## Acceptance Gates

- Same-commit rule: implementation + doc updates land together.
- Contradiction rule: no conflicting status across `ROADMAP.md`, `ios-feature-parity-plan.md`, and `parity-matrix.md`.
- Evidence rule: no milestone closure without linked scorecard/device/perf evidence.
- Archive-first rule: replaced planning docs move to `docs/mobile/archive/` with date-prefixed filenames and pointer stubs.

## Suggested Commit Prefixes

- `docs(mobile):` for mobile documentation updates
- `docs(roadmap):` for roadmap status changes
- `feat(mobile):` for implementation that includes required doc updates
