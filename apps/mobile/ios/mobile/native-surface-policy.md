# Native Surface Policy

This policy prevents web-port drift in mobile implementation.

## Allowed Reuse

- Shared game engine and domain types from packages/game-engine.
- Shared app-core orchestration package (platform-agnostic only).
- API contract shapes and endpoint semantics.

## Forbidden in Mobile Surface

- Imports from web component trees (for example src/components).
- Browser/DOM globals in mobile app code:
  - window
  - document
  - navigator
  - localStorage
  - sessionStorage
  - serviceWorker
- Web-only libraries for mobile UI behavior:
  - motion/react
  - next-themes
  - @radix-ui/*

## Native-First Expectations

- Use native navigation and presentation conventions.
- Use iOS-appropriate spacing, hierarchy, and control semantics.
- Use native haptics and transition idioms where interaction calls for feedback.
- Avoid forcing web visual patterns that conflict with iOS behavior.

## Enforcement

- Script: scripts/mobile/check-mobile-boundaries.ts
- Command: pnpm mobile:guardrails
- CI: checks-static job in .github/workflows/ci.yml

Violations should fail pull requests before merge.
