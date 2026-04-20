# Guess Readiness Calibration

Use this after the readiness changes have enough real traffic behind them. The goal is to keep guesses late enough to feel earned without pushing too many games into forced guesses.

## Minimum Sample

- Wait for at least 50 instrumented games before changing thresholds.
- Prefer 100+ games if you are changing `requiredConfidence`, `requiredGap`, or `requiredEntropy`.
- Review the last 14 days first so old behavior does not dominate the signal.

## Target Ranges

- `strict_readiness_win_pct`: target 75% or higher. If this drops below 70%, the readiness gate is still too loose.
- `high_certainty_win_pct`: target 90% or higher. If this is materially lower, the engine is still guessing before the top candidate is dominant enough.
- `forced_guess_rate`: target below 8%. If this climbs, the game is waiting too long or the question selector is not separating top suspects effectively enough.
- `forced_guess_win_pct`: target within 15 points of overall win rate. If it is far worse, the fallback path needs separate tuning.
- `early_guess_win_pct`: target at or above overall win rate, but keep the underlying volume low. Guesses with 4 or more questions remaining should be rare.
- `max_question_guess_rate`: target below 15%. If this rises, the engine is running out of runway too often.
- `low_ambiguity_win_pct`: target above overall win rate. If not, the top-suspect narrowing logic is not paying off.

## What To Change

- If `strict_readiness_win_pct` is low and `forced_guess_rate` is low, raise the readiness bar in [functions/api/v2/_game-engine.ts](functions/api/v2/_game-engine.ts) and [src/lib/gameEngine.ts](src/lib/gameEngine.ts).
- If `forced_guess_rate` is high and `max_question_guess_rate` is also high, improve late-game question separation before lowering readiness thresholds.
- If `high_certainty_win_pct` is low, tighten the `highCertainty` condition before touching the broader readiness curve.
- If games are accurate but feel too long, look at `questions_remaining_at_guess` and difficulty breakdowns before weakening confidence thresholds globally.

## Review Loop

1. Run the preview report.
2. Compare query 7 against the target ranges above.
3. Change one threshold family at a time.
4. Re-run after another meaningful sample window instead of tuning from single-session anecdotes.