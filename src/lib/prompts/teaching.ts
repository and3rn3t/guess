import type { Persona } from '@guess/game-engine'
import { getDifficultyPersona, sanitizeForPrompt, type PromptPair } from './core'

// ---------------------------------------------------------------------------
// Question Generation
// ---------------------------------------------------------------------------

export function questionGeneration_v1(
  existingAttributes: string[],
  characterNames: string[],
  persona: Persona = 'watson'
): PromptPair {
  const safeNames = characterNames.map(sanitizeForPrompt).join(', ')
  const safeAttrs = existingAttributes.join(', ')

  return {
    system: `${getDifficultyPersona(persona)}\n\nYou generate yes/no questions for the guessing game. Each question must target a single boolean attribute. Return valid JSON only.`,
    user: `Given these existing attributes: [${safeAttrs}]
And these sample characters: [${safeNames}]

Generate 10 new yes/no questions that would help distinguish between characters. Each question should target a unique attribute not in the existing list.

Return JSON: { "questions": [{ "text": "Is this character...?", "attribute": "camelCaseAttributeName" }] }`,
  }
}

// ---------------------------------------------------------------------------
// Attribute Recommendation
// ---------------------------------------------------------------------------

export function attributeRecommendation_v1(
  characterName: string,
  existingAttributes: Record<string, boolean | null>,
  availableAttributes: string[],
  persona: Persona = 'watson'
): PromptPair {
  const safeName = sanitizeForPrompt(characterName)
  const existing = Object.entries(existingAttributes)
    .filter(([, v]) => v !== null)
    .map(([k, v]) => `${k}: ${v}`)
    .join(', ')
  const available = availableAttributes.join(', ')

  return {
    system: `${getDifficultyPersona(persona)}\n\nYou recommend attribute values for fictional characters. Return valid JSON only.`,
    user: `Character: "${safeName}"
Known attributes: {${existing}}
Available attributes to fill: [${available}]

For each available attribute, predict whether it's true or false for "${safeName}". Only include attributes you're confident about (>80% sure).

Return JSON: { "recommendations": [{ "attribute": "attrName", "value": true/false, "confidence": 0.0-1.0 }] }`,
  }
}

// ---------------------------------------------------------------------------
// Category Recommendation
// ---------------------------------------------------------------------------

export function categoryRecommendation_v1(
  characterName: string,
  currentCategory: string,
  availableAttributes: string[],
  persona: Persona = 'watson'
): PromptPair {
  const safeName = sanitizeForPrompt(characterName)
  const available = availableAttributes.join(', ')

  return {
    system: `${getDifficultyPersona(persona)}\n\nYou recommend attributes for fictional characters based on their category. Return valid JSON only.`,
    user: `Character: "${safeName}" (Category: ${currentCategory})
Available attributes: [${available}]

Based on this character's category "${currentCategory}", which attributes are most likely true or false?

Return JSON: { "recommendations": [{ "attribute": "attrName", "value": true/false, "confidence": 0.0-1.0 }] }`,
  }
}

// ---------------------------------------------------------------------------
// Attribute Auto-Fill (Teaching Mode)
// ---------------------------------------------------------------------------

export function attributeAutoFill_v1(
  characterName: string,
  category: string,
  knownAttributes: Record<string, boolean | null>,
  missingAttributes: string[],
  persona: Persona = 'watson'
): PromptPair {
  const safeName = sanitizeForPrompt(characterName)
  const known = Object.entries(knownAttributes)
    .filter(([, v]) => v !== null)
    .map(([k, v]) => `${k}: ${v}`)
    .join('\n  ')
  const missing = missingAttributes.join(', ')

  return {
    system: `${getDifficultyPersona(persona)}\n\nYou fill in missing character attributes for the game's database. Accuracy is critical — incorrect attributes cause wrong game outcomes.\n\nRules:\n- Use widely-known canonical facts about the character\n- Set to null ONLY if genuinely ambiguous or debatable\n- Prefer false over null when the trait clearly doesn't apply\n- Consider the character's most well-known portrayal\n\nReturn valid JSON only.`,
    user: `Character: "${safeName}" (Category: ${category})
Known attributes:
  ${known || '(none yet)'}

Fill in these missing attributes: [${missing}]

For each attribute, provide your best assessment as true, false, or null. Be decisive — most attributes have clear answers for well-known characters.

Return JSON: { "attributes": { "attrName": true/false/null, ... } }`,
  }
}

// ---------------------------------------------------------------------------
// Phase 5 — Living Character Bios
// ---------------------------------------------------------------------------

/**
 * Generate a 2-sentence detective case-file bio for a character.
 * Pre-generated in batch and cached in KV.
 */
export function livingBio_v1(
  characterName: string,
  category: string,
  persona: Persona = 'watson'
): PromptPair {
  const safeName = sanitizeForPrompt(characterName)

  return {
    system: `${getDifficultyPersona(persona)}\n\nYou write case file entries for fictional characters — brief, evocative, in your detective persona. 2 sentences max. No emojis. Write as if reading from a dossier.`,
    user: `Write a 2-sentence case file entry for: "${safeName}" (from ${category}).

Include their key role, one personality trait, and one distinguishing detail. Do not include their name in the text.`,
  }
}
