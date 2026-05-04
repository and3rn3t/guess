# Native Product Contract (iOS)

This contract defines the non-negotiable quality bar for the mobile app.

## Goal

Ship an iOS-first experience that feels native by default, not a web UI wrapped in a native shell.

## Non-Negotiables

- Follow Apple Human Interface Guidelines first; do not optimize for visual parity with web.
- Reuse only domain logic and API contracts from web.
- Do not reuse web UI components or browser-specific hooks in the mobile app.
- Core interactions must provide native feedback (touch, haptics, transitions, accessibility announcements).
- Dynamic Type, VoiceOver support, and reduced motion are required for core gameplay screens.

## Scope Rules

Included for initial release:

- Welcome
- Playing
- Guessing
- Game over
- Challenge entry

Excluded for initial release:

- Admin routes
- PWA/service-worker behavior
- Browser-only install/update flows

## Native Depth Policy

- Expo + React Native primitives are default.
- If Expo abstraction cannot meet quality targets, add a focused Swift module.
- Every Swift module must include:
  - why Expo path was insufficient
  - measurable user impact
  - ownership and maintenance notes

## Stage Gate Requirements

A milestone cannot pass unless:

- Screen Quality Scorecard thresholds are met.
- Native boundary checks pass.
- Accessibility gate passes for touched screens.
- Performance budgets pass on target iPhone devices.

## Ownership

- Engineering owns implementation and guardrail automation.
- Design owns HIG alignment and scorecard sign-off.
- Product owns release promotion decisions based on gate outcomes.
