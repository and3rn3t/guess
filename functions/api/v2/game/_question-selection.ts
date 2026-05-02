import {
  buildQuestionOptions,
  selectBestQuestion,
  type GameSession,
  type ServerCharacter,
  type ServerQuestion,
} from '../_game-engine'

interface SelectNextQuestionForTurnInput {
  session: GameSession
  filtered: ServerCharacter[]
  questions: ServerQuestion[]
  scoring: Parameters<typeof buildQuestionOptions>[1]
  adaptive: Parameters<typeof buildQuestionOptions>[2]
  probs?: Map<string, number>
  recentCategories?: string[]
  selector?: 'greedy' | 'mcts'
}

export function getRecentQuestionCategories(session: GameSession, limit = 3): string[] {
  return session.answers
    .slice(-limit)
    .map((a) => session.questions.find((q) => q.attribute === a.questionId)?.category)
    .filter((c): c is string => c != null)
}

export function selectNextQuestionForTurn(input: SelectNextQuestionForTurnInput): ServerQuestion | null {
  const { session, filtered, questions, scoring, adaptive, probs, recentCategories, selector } = input
  const progress = session.answers.length / session.maxQuestions

  return selectBestQuestion(
    filtered,
    session.answers,
    questions,
    buildQuestionOptions(session, scoring, adaptive, { progress, probs, recentCategories }),
    selector,
  )
}
