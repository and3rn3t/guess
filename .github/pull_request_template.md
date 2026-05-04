## What

<!-- Brief description of the change -->

## Why

<!-- Motivation / link to issue -->

## How to test

<!-- Steps to verify, or note if covered by automated tests -->

## Native Quality Evidence (mobile PRs)

<!-- Required when touching apps/mobile core gameplay screens -->

- [ ] Screen Quality Scorecard attached (see docs/mobile/screen-quality-scorecard.md)
- [ ] Accessibility checks noted (VoiceOver, Dynamic Type, reduced motion)
- [ ] Performance measurements noted (tap-to-feedback and transition latency)

## Checklist

- [ ] `pnpm validate` passes (lint + typecheck + tests)
- [ ] Tested on preview deployment
- [ ] Bundle size reasonable (check PR comment)
- [ ] No new `any` types introduced
