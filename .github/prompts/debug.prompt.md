---
description: "Debug and fix issues in the guessing game application."
mode: "agent"
---

# Debug Issue

Diagnose and fix a bug in the Guess application.

## Debugging Approach
1. Reproduce the issue — understand the exact symptoms
2. Identify the relevant game phase in `App.tsx` (`GamePhase` type)
3. Trace the data flow: KV state → game engine → component rendering
4. Check common failure points:
   - KV state returning `undefined` (always provide defaults with `useKV`)
   - localStorage corruption or quota exceeded
   - Attribute key mismatches between characters and questions
   - Missing null checks on `boolean | null` attributes
   - Animation timing issues with Framer Motion `AnimatePresence`
   - Race conditions in `setTimeout` calls in `generateNextQuestion`

## Key Files to Check
- `src/App.tsx` — Game state machine, phase transitions
- `src/lib/gameEngine.ts` — Probability and question selection logic
- `src/lib/database.ts` — Default data integrity
- `src/lib/types.ts` — Type definitions
- Relevant component in `src/components/`

## After Fixing
- Verify the fix doesn't break other game phases
- Run `pnpm build` to check for type errors
- Run `pnpm lint` for code quality

Issue: {{input}}
