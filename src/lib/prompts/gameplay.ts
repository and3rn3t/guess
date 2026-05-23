import type { Persona } from '@guess/game-engine'
import {
  CLOSE_TO_GUESS_ASIDE,
  EARLY_CONFIDENCE_ASIDE,
  confidenceTierPhrase,
  getDifficultyPersona,
  sanitizeForPrompt,
  type PromptPair,
} from './core'

// ---------------------------------------------------------------------------
// Dynamic Question Rephrasing (during gameplay) — A.2, A.4, C.7
// ---------------------------------------------------------------------------

export function dynamicQuestion_v1(
  originalQuestion: string,
  attribute: string,
  answeredQuestions: Array<{ question: string; answer: string }>,
  topCandidates: string[],
  confidence: number,
  persona: Persona = 'watson',
  options: { isCloseToGuess?: boolean; isEarlyHighConfidence?: boolean } = {}
): PromptPair {
  const context = answeredQuestions
    .slice(-5)
    .filter((q) => q.question) // skip empty question text
    .map((q) => `Q: ${sanitizeForPrompt(q.question)} → ${q.answer}`)
    .join('\n')

  const candidateHint = topCandidates.length > 0
    ? `\nMy top suspects: ${topCandidates.map(sanitizeForPrompt).join(', ')}`
    : ''

  // A.2: Confidence tier phrase in system message
  const tierPhrase = confidenceTierPhrase(confidence)

  // A.4: Dramatic aside at ≥80% confidence
  const closeAside = options.isCloseToGuess ? `\n\n${CLOSE_TO_GUESS_ASIDE}` : ''

  // C.7: Sly aside when already confident early in the game
  const earlyAside = options.isEarlyHighConfidence ? `\n\n${EARLY_CONFIDENCE_ASIDE}` : ''

  return {
    system: `${getDifficultyPersona(persona)}\n\n${tierPhrase}${closeAside}${earlyAside}\n\nYou rephrase yes/no questions to feel more natural, conversational, and engaging — like a curious detective narrowing down suspects. The core question must still target the same attribute. Keep it under 120 characters. Return valid JSON only.`,
    user: `Original question: "${sanitizeForPrompt(originalQuestion)}"
Attribute: "${attribute}"
Recent Q&A:
${context}${candidateHint}
Confidence: ${Math.round(confidence * 100)}%

Rephrase this question to feel natural and detective-like. Build on what we already know from recent answers (e.g., "Since they're human, do they..."). If confidence is high, sound more targeted. Keep the same yes/no intent.

Return JSON: { "text": "rephrased question" }`,
  }
}

// ---------------------------------------------------------------------------
// Narrative Explanation (streaming, post-guess) — A.5
// ---------------------------------------------------------------------------

export function narrativeExplanation_v1(
  characterName: string,
  won: boolean,
  questionsAndAnswers: Array<{ question: string; answer: string }>,
  remainingCount: number,
  persona: Persona = 'watson'
): PromptPair {
  const safeName = sanitizeForPrompt(characterName)
  const qaText = questionsAndAnswers
    .filter((qa) => qa.question) // skip empty question text
    .map((qa) => `Q: ${sanitizeForPrompt(qa.question)} → ${qa.answer}`)
    .join('\n')

  const totalAsked = questionsAndAnswers.length
  const winLose = won
    ? `I correctly guessed "${safeName}" after ${totalAsked} questions with ${remainingCount} characters still possible`
    : `I guessed "${safeName}" but was wrong — ${remainingCount} characters remained`

  return {
    system: `${getDifficultyPersona(persona)}\n\nYou write fun, brief narrative explanations of how you deduced (or failed to deduce) a character. Write in your detective persona. Be playful; reference specific clues. 2-3 sentences max. Don't use emojis.`,
    user: `${winLose}.

Q&A history:
${qaText}

Write a ${won ? 'triumphant' : 'humble'} narrative. Name the single pivotal answer that cracked${won ? '' : ' (or failed to crack)'} the case and close with a one-liner that fits your character voice.`,
  }
}

// ---------------------------------------------------------------------------
// Conversational Parse (free-text answers)
// ---------------------------------------------------------------------------

export function conversationalParse_v1(
  userResponse: string,
  questionText: string,
  attribute: string,
  persona: Persona = 'watson'
): PromptPair {
  return {
    system: `${getDifficultyPersona(persona)}\n\nYou interpret free-text answers to yes/no questions. Map the user's response to one of: "yes", "no", "maybe", or "unknown". Return valid JSON only.`,
    user: `Question asked: "${sanitizeForPrompt(questionText)}"
Attribute: "${attribute}"
User's response: "${sanitizeForPrompt(userResponse)}"

Interpret this response. What did the user mean?

Return JSON: { "value": "yes"|"no"|"maybe"|"unknown", "confidence": 0.0-1.0 }`,
  }
}

// ---------------------------------------------------------------------------
// Phase 3 — Contradiction Explainer (C.3)
// ---------------------------------------------------------------------------

/**
 * C.3: When the engine has no remaining candidates, explain the contradiction
 * in natural language so the player understands what conflicting answers they gave.
 */
export function contradictionExplain_v1(
  answeredQuestions: Array<{ question: string; answer: string; attribute: string }>,
  persona: Persona = 'watson'
): PromptPair {
  const qaText = answeredQuestions
    .filter((q) => q.question)
    .map((q) => `"${sanitizeForPrompt(q.question)}" → ${q.answer} (${q.attribute})`)
    .join('\n')

  return {
    system: `${getDifficultyPersona(persona)}\n\nYou explain why a set of yes/no answers is logically contradictory — i.e., no character in the database matches all of them simultaneously. Be concise (1 sentence). In your detective voice.`,
    user: `The player's answers have created a contradiction — no character in the database matches all of them simultaneously.

Answers given:
${qaText}

Identify the specific logical conflict (e.g., two answers that can't both be true for the same character) and explain it in one sentence. Do not ask the player to restart. Do not list all answers — focus on the conflict.`,
  }
}

// ---------------------------------------------------------------------------
// Phase 3 — Contradiction Pushback ("AI Argues Back")
// ---------------------------------------------------------------------------

/**
 * "AI Argues Back": fires when a specific new answer triggers a contradiction.
 * The AI calls out the conflicting pair directly, in character.
 */
export function contradictionPushback_v1(
  conflictingAnswerA: { question: string; answer: string },
  conflictingAnswerB: { question: string; answer: string },
  persona: Persona = 'watson'
): PromptPair {
  return {
    system: `${getDifficultyPersona(persona)}\n\nYou have spotted a logical contradiction in the player's answers — two answers that cannot both be true for the same character. Challenge them directly, in character. Maximum 2 sentences. Don't be harsh — be curious and a little theatrical. Do not use emojis.`,
    user: `These two answers contradict each other:
- "${sanitizeForPrompt(conflictingAnswerA.question)}" → ${conflictingAnswerA.answer}
- "${sanitizeForPrompt(conflictingAnswerB.question)}" → ${conflictingAnswerB.answer}

Write a short, in-character pushback. Ask the player to clarify which answer to keep. Be specific about the conflict.`,
  }
}

// ---------------------------------------------------------------------------
// Phase 3 — "What Set You Apart" (C.5)
// ---------------------------------------------------------------------------

/**
 * C.5: On game win, explain the single attribute that uniquely distinguished
 * the correct character from the runner-up.
 */
export function distinctiveAttributeExplain_v1(
  winnerName: string,
  runnerUpName: string,
  topCandidates: Array<{ name: string; probability: number }>,
  persona: Persona = 'watson'
): PromptPair {
  const safeWinner = sanitizeForPrompt(winnerName)
  const safeRunnerUp = sanitizeForPrompt(runnerUpName)
  const candidateList = topCandidates
    .slice(0, 5)
    .map((c) => `${sanitizeForPrompt(c.name)} (${Math.round(c.probability * 100)}%)`)
    .join(', ')

  return {
    system: `${getDifficultyPersona(persona)}\n\nYou give a one-line explanation of what set the winning character apart from the runner-up. Be specific and reference the actual characters. No emojis. Maximum 1 sentence.`,
    user: `The correct character was "${safeWinner}".
Runner-up: "${safeRunnerUp}".
Full top candidates: ${candidateList}.

What single distinguishing factor — an attribute or trait — most likely set ${safeWinner} apart from ${safeRunnerUp}? Give one sentence that makes the player say "oh, of course!"`,
  }
}

// ---------------------------------------------------------------------------
// Phase 4 — "Describe My Suspect" pre-reveal (C.1)
// ---------------------------------------------------------------------------

/**
 * C.1: At ~85% confidence, generate a 2-sentence prose description of the
 * suspected character WITHOUT naming them. Builds suspense before the reveal.
 */
export function suspectDescription_v1(
  _topCandidates: Array<{ name: string; probability: number }>,
  confidence: number,
  answeredQuestions: Array<{ question: string; answer: string }>,
  persona: Persona = 'watson'
): PromptPair {
  const qaText = answeredQuestions
    .slice(-8)
    .filter((q) => q.question)
    .map((q) => `"${sanitizeForPrompt(q.question)}" → ${q.answer}`)
    .join('\n')

  return {
    system: `${getDifficultyPersona(persona)}\n\nYou are about to make your final guess. First, build suspense with a 2-sentence description of what you believe the character looks like and their personality — WITHOUT naming them or revealing who they are. Be evocative, not encyclopedic. Write in your detective voice.`,
    user: `I am ${Math.round(confidence * 100)}% confident I know the character.

Clues gathered:
${qaText}

Describe my suspect in exactly 2 sentences. Reference their appearance, personality, or notable traits based on the clues. Do NOT name the character or give away who it is.`,
  }
}

// ---------------------------------------------------------------------------
// Phase 7 — Describe Yourself (selfMatchNarrative)
// ---------------------------------------------------------------------------

/**
 * Generate the "you are most like X" reveal narrative for Describe Yourself mode.
 * Streamed to the result screen.
 */
export function selfMatchNarrative_v1(
  topMatchName: string,
  matchScore: number,
  selfAnswers: Array<{ question: string; answer: string }>,
  persona: Persona = 'watson'
): PromptPair {
  const safeName = sanitizeForPrompt(topMatchName)
  const qaText = selfAnswers
    .slice(-8)
    .filter((q) => q.question)
    .map((q) => `"${sanitizeForPrompt(q.question)}" → ${q.answer}`)
    .join('\n')

  return {
    system: `${getDifficultyPersona(persona)}\n\nYou reveal which fictional character someone most resembles based on their personality answers. Be warm, specific, and a little dramatic. 2 sentences max. No emojis.`,
    user: `Based on the player's answers, they are most like "${safeName}" with a ${Math.round(matchScore * 100)}% match.

Their answers:
${qaText}

Write a 2-sentence reveal: state the match with the percentage, then explain one specific reason why based on their answers. Be charming and in character.`,
  }
}
