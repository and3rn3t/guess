import {
  generateReasoning,
  saveSessionState,
  type GameSession,
} from "../_game-engine";
import { buildContradictionResponse } from "./_responses";

export async function rollbackAndBuildContradictionResponse(input: {
  db: D1Database;
  session: GameSession;
}): Promise<ReturnType<typeof buildContradictionResponse>> {
  const { db, session } = input;

  session.answers.pop();
  await saveSessionState(db, session);

  const question = session.currentQuestion as NonNullable<
    GameSession["currentQuestion"]
  >;

  return buildContradictionResponse({
    question,
    reasoning: generateReasoning(question, session.characters, session.answers),
    remaining: session.characters.length,
    questionCount: session.answers.length,
  });
}
