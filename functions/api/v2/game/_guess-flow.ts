import {
  getBestGuessResult,
  saveSessionState,
  type GameSession,
  type ServerCharacter,
} from "../_game-engine";
import { buildGuessAnalytics } from "./_guess-analytics";
import { buildGuessResponse } from "./_responses";

type GuessSelectionScoring = Parameters<typeof getBestGuessResult>[3];
type GuessSelectionCharacter = NonNullable<
  ReturnType<typeof getBestGuessResult>["character"]
>;

interface GuessReadinessShape {
  trigger?: string | null;
  blockedByRejectCooldown?: boolean;
  rejectCooldownRemaining?: number;
  topProbability?: number;
  gap?: number;
  aliveCount?: number;
  questionsRemaining?: number;
  forced?: boolean;
}

export function selectBestGuessForSession(
  session: GameSession,
  filtered: ServerCharacter[],
  scoring: GuessSelectionScoring,
): ReturnType<typeof getBestGuessResult> {
  return getBestGuessResult(
    filtered,
    session.answers,
    session.rejectedGuesses,
    scoring,
  );
}

export async function finalizeGuessAndSave(input: {
  db: D1Database;
  session: GameSession;
  guess: GuessSelectionCharacter;
  probs: Map<string, number>;
  questionCount: number;
  remaining: number;
  readiness?: GuessReadinessShape;
}): Promise<ReturnType<typeof buildGuessResponse>> {
  const confidence = Math.round((input.probs.get(input.guess.id) || 0) * 100);

  input.session.currentQuestion = null;
  input.session.guessCount += 1;
  await saveSessionState(input.db, input.session);

  return buildGuessResponse({
    character: input.guess,
    confidence,
    questionCount: input.questionCount,
    remaining: input.remaining,
    guessCount: input.session.guessCount,
    ...(input.readiness ? { readiness: input.readiness } : {}),
  });
}

export async function finalizeBestGuessForSession(input: {
  db: D1Database;
  session: GameSession;
  filtered: ServerCharacter[];
  scoring: GuessSelectionScoring;
  questionCount: number;
  remaining: number;
  readiness?: GuessReadinessShape;
  recordAnalytics?: boolean;
}): Promise<ReturnType<typeof buildGuessResponse> | null> {
  const { character: guess, probs } = selectBestGuessForSession(
    input.session,
    input.filtered,
    input.scoring,
  );

  if (!guess) return null;

  if (input.recordAnalytics) {
    input.session.guessAnalytics = buildGuessAnalytics({
      guessId: guess.id,
      probs,
      answers: input.session.answers,
      remaining: input.remaining,
      readiness: input.readiness ?? {},
    });
  }

  return finalizeGuessAndSave({
    db: input.db,
    session: input.session,
    guess,
    probs,
    questionCount: input.questionCount,
    remaining: input.remaining,
    ...(input.readiness ? { readiness: input.readiness } : {}),
  });
}
