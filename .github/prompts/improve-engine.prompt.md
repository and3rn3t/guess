---
description: "Improve the game engine's question selection or probability algorithms."
mode: "agent"
---

# Improve Game Engine

Enhance the game engine logic in `src/lib/gameEngine.ts`.

## Context
The game engine handles:
- **Probability calculation** (`calculateProbabilities`): Bayesian-style scoring of characters against answered questions
- **Question selection** (`selectBestQuestion`): Information gain / entropy-based selection from available questions
- **Guess decision** (`shouldMakeGuess`): Confidence threshold (~80%) or question limit
- **Best guess** (`getBestGuess`): Highest probability character
- **Reasoning** (`generateReasoning`): Human-readable explanation of AI strategy

## Key Types
```typescript
Character { id, name, attributes: Record<string, boolean | null> }
Question { id, text, attribute }
Answer { questionId, value: 'yes' | 'no' | 'maybe' | 'unknown' }
```

## Principles
- null attributes = 50% weight (uncertain)
- 'maybe' answers have reduced weight (0.3)
- Questions that split remaining characters most evenly score highest
- Coverage (% of characters with non-null values) boosts question score
- Keep reasoning explanations clear and engaging

## After Changes
- Verify probability normalization still sums to ~1.0
- Test with edge cases: single character remaining, all nulls, contradictory answers
- Run `pnpm build`

Improve: {{input}}
