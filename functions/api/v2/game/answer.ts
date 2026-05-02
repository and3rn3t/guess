import {
  type Env,
  jsonResponse,
  errorResponse,
  parseJsonBodyWithSchema,
  logError,
} from '../../_helpers'
import { AnswerRequestSchema } from '../../_schemas'
import {
  filterPossibleCharacters,
  detectContradictions,
  evaluateGuessReadiness,
  getBestGuessResult,
  selectBestQuestion,
  generateReasoning,
  calculateProbabilities,
  loadSession,
  saveSessionState,
  loadAdaptiveData,
  getOrBuildCoverageMap,
  buildQuestionOptions,
} from '../_game-engine'
import {
  buildContradictionResponse,
  buildGuessResponse,
  buildQuestionResponse,
} from './_responses'
import { advanceToNextQuestion } from './_question-flow'
import {
  queueAnswerSessionSync,
  queueQuestionAttemptWrite,
} from './_turn-effects'

// ── POST /api/v2/game/answer ─────────────────────────────────
// Processes the user's answer, returns next question or a guess

export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
  const kv = context.env.GUESS_KV
  if (!kv) return errorResponse('KV not configured', 503)

  const parsed = await parseJsonBodyWithSchema(context.request, AnswerRequestSchema)
  if (!parsed.success) return parsed.response
  const { sessionId, value } = parsed.data

  // Load session
  const session = await loadSession(kv, sessionId)
  if (!session) {
    return errorResponse('Session not found or expired', 404)
  }

  if (!session.currentQuestion) {
    return errorResponse('No pending question to answer', 400)
  }

  // Record answer (questionId is the attribute key)
  const newAnswer = {
    questionId: session.currentQuestion.attribute,
    value,
  }
  const questionIndex = session.answers.length // 0-based index of this answer
  const askedQuestion = session.currentQuestion
  const candidatesBefore = filterPossibleCharacters(
    session.characters,
    session.answers,
    session.rejectedGuesses
  ).length
  session.answers.push(newAnswer)

  // Filter characters (hard elimination + rejected guesses)
  const filtered = filterPossibleCharacters(session.characters, session.answers, session.rejectedGuesses)

  // Persist question_attempts row (fire-and-forget). Powers per-question empirical
  // info-gain analytics (kv:question-empirical-gain) and per-question skip/maybe rates.
  queueQuestionAttemptWrite(context.waitUntil, context.env.GUESS_DB, {
    sessionId,
    questionId: askedQuestion.id,
    attribute: askedQuestion.attribute,
    answer: value,
    candidatesBefore,
    candidatesAfter: filtered.length,
    questionIndex,
    createdAt: Date.now(),
  })

  const coverageMap = getOrBuildCoverageMap(session)
  const scoring = { coverageMap, popularityMap: session.popularityMap }

  // Pre-compute probabilities once — reused by evaluateGuessReadiness and selectBestQuestion
  // to avoid redundant O(C×A) passes over the same data.
  const probs = calculateProbabilities(filtered, session.answers, scoring)

  // AN.11/AN.21: record posterior history and top-10 after each answer (fire-and-update-session).
  // posteriorHistory[i] = top candidate's normalized probability after answers[i].
  // stepTopTen[i] = [{id, name}] of top-10 candidates after answers[i] (for triage).
  {
    const sortedEntries = Array.from(probs.entries()).sort((a, b) => b[1] - a[1])
    const topProb = sortedEntries.length > 0 ? sortedEntries[0][1] : 0
    const top10 = sortedEntries.slice(0, 10).map(([id]) => {
      const c = filtered.find((ch) => ch.id === id)
      return { id, name: c?.name ?? id }
    })
    if (!session.posteriorHistory) session.posteriorHistory = []
    if (!session.stepTopTen) session.stepTopTen = []
    session.posteriorHistory.push(topProb)
    session.stepTopTen.push(top10)
  }

  // Check for contradictions
  const { hasContradiction } = detectContradictions(filtered, session.answers)
  if (hasContradiction) {
    // Undo the last answer
    session.answers.pop()
    // Restore current question
    await saveSessionState(kv, session)

    return jsonResponse(
      buildContradictionResponse({
        question: session.currentQuestion,
        reasoning: generateReasoning(session.currentQuestion, session.characters, session.answers),
        remaining: session.characters.length,
        questionCount: session.answers.length,
      })
    )
  }

  const questionCount = session.answers.length
  // Pass pre-computed probs to avoid recalculating inside evaluateGuessReadiness
  const readiness = evaluateGuessReadiness(
    filtered,
    session.answers,
    questionCount,
    session.maxQuestions,
    session.guessCount,
    scoring,
    probs,
  )

  const cooldownBeforeAnswer = session.postRejectCooldown
  const blockedByRejectCooldown = cooldownBeforeAnswer > 0 && !readiness.forced
  if (blockedByRejectCooldown) {
    session.postRejectCooldown = Math.max(0, cooldownBeforeAnswer - 1)
  }

  const responseReadiness = {
    ...readiness,
    blockedByRejectCooldown,
    rejectCooldownRemaining: session.postRejectCooldown,
  }

  // Check if we should guess
  if (responseReadiness.shouldGuess && !responseReadiness.blockedByRejectCooldown) {
    const { character: guess, probs } = getBestGuessResult(filtered, session.answers, session.rejectedGuesses, scoring)
    if (guess) {
      const confidence = Math.round((probs.get(guess.id) || 0) * 100)

      // Capture analytics at guess time
      const probValues = Array.from(probs.values()).filter((p) => p > 0)
      const guessEntropy = probValues.reduce((sum, p) => (p > 0 ? sum - p * Math.log2(p) : sum), 0)
      const answerDist: Record<string, number> = { yes: 0, no: 0, maybe: 0, unknown: 0 }
      for (const a of session.answers) answerDist[a.value] = (answerDist[a.value] || 0) + 1
      session.guessAnalytics = {
        confidence: confidence / 100,
        entropy: Math.round(guessEntropy * 100) / 100,
        remaining: filtered.length,
        answerDistribution: answerDist,
        trigger: responseReadiness.trigger,
        forced: responseReadiness.forced,
        gap: Math.round(responseReadiness.gap * 100) / 100,
        aliveCount: responseReadiness.aliveCount,
        questionsRemaining: responseReadiness.questionsRemaining,
      }

      session.currentQuestion = null
      session.guessCount += 1
      await saveSessionState(kv, session)

      return jsonResponse(
        buildGuessResponse({
          character: guess,
          confidence,
          questionCount,
          remaining: filtered.length,
          guessCount: session.guessCount,
          readiness: responseReadiness,
        })
      )
    }
  }

  // Load runtime adaptive data (parallel — best-effort, failures are non-fatal)
  const db = context.env.GUESS_DB
  const adaptive = await loadAdaptiveData(kv, db)

  // Select next question (pass progress + pre-computed probs for efficiency)
  const progress = questionCount / session.maxQuestions
  const recentCategories = session.answers.slice(-3)
    .map((a) => session.questions.find((q) => q.attribute === a.questionId)?.category)
    .filter((c): c is string => c != null)
  const nextQuestion = selectBestQuestion(filtered, session.answers, session.questions,
    buildQuestionOptions(session, scoring, adaptive, { progress, probs, recentCategories }),
    session.selector ?? 'mcts'
  )

  if (!nextQuestion) {
    // No more questions — force a guess
    const { character: guess, probs: guessProbs } = getBestGuessResult(filtered, session.answers, session.rejectedGuesses, scoring)
    session.currentQuestion = null
    session.guessCount += 1
    await saveSessionState(kv, session)

    if (guess) {
      const confidence = Math.round((guessProbs.get(guess.id) || 0) * 100)

      return jsonResponse(
        buildGuessResponse({
          character: guess,
          confidence,
          questionCount,
          remaining: filtered.length,
          guessCount: session.guessCount,
        })
      )
    }

    return errorResponse('No questions or candidates available', 500)
  }

  const reasoning = generateReasoning(nextQuestion, filtered, session.answers, scoring)
  const previousFiltered = filterPossibleCharacters(
    session.characters,
    session.answers.slice(0, -1),
    session.rejectedGuesses
  )
  const eliminated = previousFiltered.length - filtered.length

  await advanceToNextQuestion({
    env: context.env,
    kv,
    session,
    nextQuestion,
    reasoning,
    questionNumber: questionCount + 1,
  })

  // Sync answers to D1 backup (non-blocking)
  queueAnswerSessionSync(context.waitUntil, db, {
    sessionId: session.id,
    answersJson: JSON.stringify(session.answers),
    currentQuestionAttr: nextQuestion.attribute,
  })

  return jsonResponse(
    buildQuestionResponse({
      question: nextQuestion,
      reasoning,
      remaining: filtered.length,
      eliminated,
      questionCount,
      readiness: responseReadiness,
    })
  )
  } catch (err) {
    console.error('POST /api/v2/game/answer error:', err)
    context.waitUntil(logError(context.env.GUESS_DB, 'answer', 'error', 'answer processing failed', err))
    const message = err instanceof Error ? err.message : 'Unknown error'
    return errorResponse(`Answer processing failed: ${message}`, 500)
  }
}
