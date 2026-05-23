import type { Persona } from '@guess/game-engine'
import {
  INJECTION_GUARD,
  PROMPT_VERSION,
  getDifficultyPersona,
  sanitizeForPrompt,
  type PromptPair,
} from './core'

// ---------------------------------------------------------------------------
// Data Cleanup (batch operations)
// ---------------------------------------------------------------------------

export function dataCleanup_v1(
  characters: Array<{ name: string; id: string }>,
  checkType: 'duplicates' | 'attributes' | 'categorization',
  persona: Persona = 'watson'
): PromptPair {
  const charList = characters
    .map((c) => `${sanitizeForPrompt(c.name)} (${c.id})`)
    .join(', ')

  const instructions: Record<string, string> = {
    duplicates: `Identify any duplicate or near-duplicate characters in this list. Group them by likely same character (different spellings, aliases, etc.).\n\nReturn JSON: { "groups": [{ "canonical": "id", "duplicates": ["id1", "id2"] }] }`,
    attributes: `Review these characters for likely attribute errors or inconsistencies.\n\nReturn JSON: { "issues": [{ "characterId": "id", "attribute": "attr", "currentValue": true/false, "suggestedValue": true/false, "reason": "..." }] }`,
    categorization: `Suggest the best category for each character from: video-games, movies, anime, comics, books, cartoons.\n\nReturn JSON: { "suggestions": [{ "characterId": "id", "suggestedCategory": "category" }] }`,
  }

  return {
    system: `${getDifficultyPersona(persona)}\n\nYou help maintain the game's character database. Return valid JSON only.`,
    user: `Characters: [${charList}]\n\n${instructions[checkType]}`,
  }
}

// ---------------------------------------------------------------------------
// Phase 6 — LLM-Judged Corrections (C.2)
// ---------------------------------------------------------------------------

/**
 * C.2: Assess whether a player-submitted attribute correction is likely correct.
 * Returns confidence score for auto-apply decisions.
 */
export function correctionJudge_v1(
  characterName: string,
  attribute: string,
  currentValue: boolean | null,
  flaggedValue: boolean | null
): PromptPair {
  const safeName = sanitizeForPrompt(characterName)

  return {
    system: `[v${PROMPT_VERSION}] You are a fact-checker for a fictional character database. Assess which attribute value is most likely correct based on widely-known canonical facts. Return valid JSON only.\n\n${INJECTION_GUARD}`,
    user: `Character: "${safeName}"
Attribute: "${attribute}"
Current database value: ${currentValue === null ? 'null (unknown)' : currentValue}
Flagged correction: ${flaggedValue === null ? 'null (unknown)' : flaggedValue}

Which value is more likely correct for "${safeName}"? Use canonical, widely-known facts.

Return JSON: { "correct": "current" | "flagged", "confidence": 0.0-1.0, "reason": "brief explanation" }`,
  }
}
