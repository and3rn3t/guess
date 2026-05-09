# iOS Architecture Map (SwiftUI-First)

Effective date: 2026-05-09

This document defines the target architecture for iOS feature parity delivery.

## Architecture Goals

- Deliver player-facing parity with web while following iOS Human Interface Guidelines.
- Keep backend contracts and core game semantics aligned with web.
- Keep mobile UI and interaction logic native-first.

## Boundaries

Reuse allowed:
- API contracts and endpoint semantics from `src/lib/constants.ts` and `src/lib/gameApi.ts`
- shared orchestration semantics from `packages/app-core/**`
- shared game logic from `packages/game-engine/**` where practical

Reuse forbidden:
- web UI components from `src/components/**`
- browser-specific hooks and globals (`window`, `document`, `localStorage`, service workers)
- web-only UI frameworks for core mobile interaction patterns

## Layers

### 1. Presentation Layer (SwiftUI)

Responsibilities:
- Screen composition and native navigation
- visual state rendering (`idle`, `loading`, `error`, `offline`)
- native interactions (haptics, accessibility announcements, transitions)

Target surfaces:
- Welcome, Playing, Guessing, Game Over, Challenge
- Stats, History, Compare
- Session Resume, Preferences, Teaching, Post-game Feedback

### 2. State and Flow Layer

Responsibilities:
- canonical app state machine equivalent to web game phases
- phase transitions and route orchestration
- session restoration and in-progress flow safety

Design constraints:
- one source of truth for active session and phase
- deterministic transition rules for answer/skip/reject/reveal paths

### 3. Networking Layer

Responsibilities:
- typed request/response handling for player-facing endpoints
- retries, cancellation, timeout handling, and explicit error taxonomy
- cache-aware reads and resilient writes

Player-facing endpoints in scope:
- `/api/v2/game/start`
- `/api/v2/game/answer`
- `/api/v2/game/skip`
- `/api/v2/game/reject-guess`
- `/api/v2/game/result`
- `/api/v2/game/resume`
- `/api/v2/game/reveal`
- `/api/v2/game/feedback`
- `/api/v2/daily`
- `/api/v2/daily/leaderboard`

### 4. Persistence Layer

Responsibilities:
- local preferences persistence
- resumable session snapshots
- offline queue stubs for deferred sync

Design constraints:
- persistence schema versioned and migration-safe
- no silent data loss on app lifecycle transitions

### 5. Native Services Layer

Responsibilities:
- haptics behavior mapping
- VoiceOver announcements and accessibility support
- reduced motion observation
- lifecycle signals and background/foreground handling

Design constraints:
- each native module includes fallback behavior
- module intent and maintenance notes documented in handoff docs

## Cross-Cutting Requirements

### Accessibility

- Dynamic Type support on all player-facing screens
- VoiceOver labels and reading order for interactive controls
- reduced motion alternatives for high-motion transitions

### Performance

- p95 tap-to-feedback under 100ms
- p95 transition start under 150ms
- graceful degradation under low bandwidth and offline conditions

### Observability

- screen-level error attribution
- network retry and failure telemetry
- milestone evidence links in `docs/mobile/parity-matrix.md`

## Implementation Sequence

1. Foundation: app shell, state model, navigation framework
2. Core gameplay: Welcome -> Playing -> Guessing -> Game Over -> Challenge
3. Utility surfaces: Stats, History, Compare, Resume, Preferences, Teaching, Feedback
4. L2 polish: HIG alignment, accessibility completion, visual and interaction quality
5. L3 hardening: offline resilience, performance budgets, release readiness

## Documentation Hooks

When architecture changes:
- update `docs/mobile/ios-feature-parity-plan.md` if milestone scope/gates change
- update `docs/mobile/parity-matrix.md` if feature states or divergences change
- update `docs/mobile/xcode-setup.md` and `docs/mobile/xcode-claude-memory-handoff.md` for operational changes
- add decision rationale to `ROADMAP.md` Decision Log when sequencing or architecture direction changes
