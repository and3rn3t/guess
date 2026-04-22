# @guess/game-engine

Shared Bayesian game engine used by both the React client and the Cloudflare Worker API.

## Overview

This package eliminates the dual-engine drift problem where scoring constants and algorithms were duplicated between `src/lib/gameEngine.ts` and `functions/api/v2/_game-engine.ts`. All pure game logic lives here; each consumer adds its own adapters and type wrappers.

## Modules

| Module | Contents |
|---|---|
| `constants` | Bayesian scoring weights (`SCORE_MATCH`, `SCORE_MISMATCH`, etc.) |
| `types` | Minimal shared interfaces (`GameCharacter`, `GameQuestion`, `GameAnswer`, `GuessReadiness`, …) |
| `scoring` | `calculateProbabilities`, `scoreForAnswer` |
| `question-selection` | `selectBestQuestion`, `getAttributeGroup`, `entropy` |
| `guess-readiness` | `evaluateGuessReadiness`, `shouldMakeGuess`, `getBestGuess`, `generateReasoning`, `detectContradictions` |

## Key Interfaces

```ts
interface GameCharacter {
  id: string
  name: string
  attributes: Record<string, boolean | null>
  imageUrl?: string | null
}

interface GameQuestion {
  attribute: string
  category?: string
}

interface GameAnswer {
  questionId: string
  value: 'yes' | 'no' | 'maybe' | 'unknown'
}
```

The client's `Character` and the server's `ServerCharacter` are both structurally compatible with `GameCharacter` — no explicit `extends` needed thanks to TypeScript's structural typing.

## Usage

```ts
import {
  calculateProbabilities,
  selectBestQuestion,
  evaluateGuessReadiness,
} from '@guess/game-engine'
```

## Testing

Tests live in `src/lib/gameEngine.test.ts` (client wrapper) and `functions/api/v2/_game-engine.test.ts` (server wrapper). Core algorithm tests can be added under `packages/game-engine/src/` following the same Vitest conventions.
