import { type Env, errorResponse, jsonResponse } from "../../_helpers";
import {
  type AdaptiveData,
  calculateProbabilities,
  detectContradictions,
  evaluateGuessReadiness,
  loadAdaptiveData,
} from "../_game-engine";
import { rollbackAndBuildContradictionResponse } from "./_contradiction";
import { finalizeBestGuessForSession } from "./_guess-flow";
import {
  buildNextQuestionResponse,
  persistAndSyncAnswerTurn,
} from "./_question-flow";
import {
  getRecentQuestionCategories,
  selectNextQuestionForTurn,
} from "./_question-selection";
import { applyRejectCooldown } from "./_readiness";

const EMPTY_ADAPTIVE_DATA: AdaptiveData = {
  maybeRateMap: undefined,
  netGainMap: undefined,
  confusionDiscriminators: undefined,
  disputeMap: undefined,
  attributeTrustMap: undefined,
  characterPopularityMap: undefined,
  questionEmpiricalGainMap: undefined,
  questionQualityPenaltyMap: undefined,
  confusionPairs: undefined,
  activeWeights: undefined,
};

export function prefetchAdaptiveData(
  db: D1Database | undefined,
): Promise<AdaptiveData> {
  return loadAdaptiveData(db).catch(() => EMPTY_ADAPTIVE_DATA);
}

async function finalizeGuessJsonResponse(
  input: Parameters<typeof finalizeBestGuessForSession>[0],
): Promise<Response | null> {
  const guessResponse = await finalizeBestGuessForSession(input);
  return guessResponse ? jsonResponse(guessResponse) : null;
}

export async function maybeFinalizeReadinessGuess(
  input: {
    readiness: { shouldGuess: boolean; blockedByRejectCooldown: boolean };
  } & Omit<
    Parameters<typeof finalizeBestGuessForSession>[0],
    "recordAnalytics" | "readiness"
  >,
): Promise<Response | null> {
  if (!input.readiness.shouldGuess || input.readiness.blockedByRejectCooldown) {
    return null;
  }

  return finalizeGuessJsonResponse({
    ...input,
    readiness: input.readiness,
    recordAnalytics: true,
  });
}

export async function maybeHandleContradiction(input: {
  db: D1Database;
  session: Parameters<
    typeof rollbackAndBuildContradictionResponse
  >[0]["session"];
  filtered: Parameters<typeof detectContradictions>[0];
}): Promise<Response | null> {
  const { hasContradiction } = detectContradictions(
    input.filtered,
    input.session.answers,
  );
  if (!hasContradiction) {
    return null;
  }

  return jsonResponse(
    await rollbackAndBuildContradictionResponse({
      db: input.db,
      session: input.session,
    }),
  );
}

export function computeResponseReadiness(input: {
  session: Parameters<typeof applyRejectCooldown>[0];
  filtered: Parameters<typeof evaluateGuessReadiness>[0];
  scoring: Parameters<typeof evaluateGuessReadiness>[5];
  probs: Parameters<typeof evaluateGuessReadiness>[6];
}): ReturnType<typeof applyRejectCooldown> {
  const questionCount = input.session.answers.length;
  const readiness = evaluateGuessReadiness(
    input.filtered,
    input.session.answers,
    questionCount,
    input.session.maxQuestions,
    input.session.guessCount,
    input.scoring,
    input.probs,
  );

  return applyRejectCooldown(input.session, readiness);
}

export async function continueWithNextQuestion(input: {
  env: Env;
  waitUntil: (promise: Promise<unknown>) => void;
  db: D1Database | null | undefined;
  session: Parameters<typeof buildNextQuestionResponse>[0]["session"];
  filtered: Parameters<typeof buildNextQuestionResponse>[0]["filtered"];
  scoring: NonNullable<
    Parameters<typeof selectNextQuestionForTurn>[0]["scoring"]
  >;
  adaptive: AdaptiveData;
  probs: ReturnType<typeof calculateProbabilities>;
  questionCount: number;
  readiness: Parameters<typeof buildNextQuestionResponse>[0]["readiness"];
}): Promise<Response> {
  const nextQuestion = selectNextQuestionForTurn({
    session: input.session,
    filtered: input.filtered,
    questions: input.session.questions,
    scoring: input.scoring,
    adaptive: input.adaptive,
    probs: input.probs,
    recentCategories: getRecentQuestionCategories(input.session),
    selector: input.session.selector ?? "mcts",
  });

  if (!nextQuestion) {
    const forcedGuessResponse = await finalizeGuessJsonResponse({
      db: input.db as D1Database,
      session: input.session,
      filtered: input.filtered,
      scoring: input.scoring,
      questionCount: input.questionCount,
      remaining: input.filtered.length,
    });

    if (forcedGuessResponse) {
      return forcedGuessResponse;
    }

    return errorResponse("No questions or candidates available", 500);
  }

  const { reasoning, response } = buildNextQuestionResponse({
    session: input.session,
    nextQuestion,
    filtered: input.filtered,
    scoring: input.scoring,
    questionCount: input.questionCount,
    readiness: input.readiness,
  });

  await persistAndSyncAnswerTurn({
    env: input.env,
    db: input.db,
    waitUntil: input.waitUntil,
    session: input.session,
    nextQuestion,
    reasoning,
    questionNumber: input.questionCount + 1,
  });

  return jsonResponse(response);
}
