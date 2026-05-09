# iOS API Contract Reference (Player-Facing)

Effective date: 2026-05-09

This reference maps iOS mobile client behavior to player-facing API contracts used by web.

Contract sources:

- endpoint constants: `src/lib/constants.ts`
- transport semantics and response typing: `src/lib/gameApi.ts`
- inventory baseline: `docs/openapi-inventory.json`

## Endpoint Catalog

- `POST /api/v2/game/start`: start session and return first question.
- `POST /api/v2/game/answer`: submit answer and receive next question or guess.
- `POST /api/v2/game/skip`: skip current question.
- `POST /api/v2/game/reject-guess`: reject current guess and continue flow.
- `POST /api/v2/game/result`: submit final correctness outcome.
- `POST /api/v2/game/resume`: resume existing session.
- `POST /api/v2/game/reveal`: reveal user character after loss and backfill.
- `POST /api/v2/game/feedback`: submit post-game feedback.
- `GET /api/v2/daily`: fetch daily status.
- `POST /api/v2/daily`: record daily completion.
- `GET /api/v2/daily/leaderboard`: fetch daily leaderboard entries.

## Request and Response Reference

### Start Game

Route:

- `POST /api/v2/game/start`

Request:

- `categories: CharacterCategory[]` (optional when empty)
- `difficulty: Difficulty` (required)
- `characterId?: string` (optional challenge/manual start)

Success response fields:

- `sessionId: string`
- `question: Question`
- `reasoning: ReasoningExplanation`
- `totalCharacters: number`
- `maxQuestions?: number`

### Submit Answer

Route:

- `POST /api/v2/game/answer`

Request:

- `sessionId: string`
- `value: AnswerValue`

Success response `type` variants:

- `question`: includes next `question`, `reasoning`, and readiness metadata.
- `guess`: includes candidate character plus confidence/readiness.
- `contradiction`: includes message and contradiction handling context.

### Skip Question

Route:

- `POST /api/v2/game/skip`

Request:

- `sessionId: string`

Success response fields:

- `type: "question"`
- `question: Question`
- `reasoning: ReasoningExplanation`
- `remaining: number`
- `questionCount: number`
- `skippedCount: number`

Special case:

- HTTP `409` means no more questions to skip; client should not treat this as a fatal crash.

### Reject Guess

Route:

- `POST /api/v2/game/reject-guess`

Request:

- `sessionId: string`
- `characterId: string`

Success response variants:

- `question`: next question payload and cooldown metadata.
- `exhausted`: no further progression; game should close loop.

### Submit Result

Route:

- `POST /api/v2/game/result`

Request:

- `sessionId: string`
- `correct: boolean`

Success behavior:

- No typed JSON contract is required for client progression; client treats completion as a best-effort post.

### Resume Game

Route:

- `POST /api/v2/game/resume`

Request:

- `sessionId: string`

Success response:

- `null` when resume is unavailable or expired.
- object snapshot when resume is available (`question`, `reasoning`, counts, prior answers).

### Reveal Character

Route:

- `POST /api/v2/game/reveal`

Request:

- `characterName: string`
- `answers: Array<{ questionId: string; value: string }>`

Success response fields:

- `found: boolean`
- `characterId?: string | null`
- `characterName?: string | null`
- `attributesFilled?: number`
- `discrepancies?: number`

### Submit Feedback

Route:

- `POST /api/v2/game/feedback`

Request:

- `sessionId: string`
- `rating: number`
- `feedbackText?: string`

Success response:

- `success: boolean`

### Daily Status and Completion

Routes:

- `GET /api/v2/daily`
- `POST /api/v2/daily`

POST request:

- `won: boolean`
- `questionsAsked: number`

POST success response:

- `ok: boolean`
- `date: string`
- `characterId: string`

### Daily Leaderboard

Route:

- `GET /api/v2/daily/leaderboard?date=YYYY-MM-DD` (date optional)

Success response fields:

- `date: string`
- `leaderboard: DailyLeaderboardEntry[]`

## Error Semantics and Retry Guidance

Client error taxonomy (aligned with web transport):

- transport failure: no response or connectivity problem
- server failure: non-2xx with structured or unstructured payload
- validation failure: response shape does not match expected schema

Retry guidance:

- answer, skip, and reject actions should support inline retry without session loss
- result posting may be best-effort and deferred from critical UX path
- daily and leaderboard reads can retry with backoff and cached fallback
- `409` skip exhaustion should surface as informational state, not fatal error

## Contract Maintenance Rules

- If `src/lib/constants.ts` endpoints change, update this doc in the same commit.
- If `src/lib/gameApi.ts` request or response semantics change, update corresponding sections.
- Validate endpoint presence against `docs/openapi-inventory.json` during doc updates.
- Keep this doc focused on player-facing routes; admin routes belong in admin docs.
