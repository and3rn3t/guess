/**
 * LLM prompt builders for the enrichment pipeline.
 *
 * Pure string-builders — no I/O, no DB, no LLM calls. Safe to test in isolation.
 *
 * Extracted from scripts/ingest/enrich.ts (RF.1) without behavior change.
 *
 * AI.4 audit (2026-05-25): every caller of these prompts enforces
 * `response_format: { type: 'json_object' }` at the OpenAI client layer
 * (see [callLLM](llm-client.ts)). That means we don't need to repeat
 * "RESPONSE FORMAT: {json example}" inside the prompt body — the model
 * is already constrained to return valid JSON. We keep one short sentence
 * mentioning "Return a JSON object" because OpenAI requires the literal
 * string "JSON" to appear somewhere in the messages when json_object mode
 * is on; otherwise the API rejects the request. Skeptic + trivia prompts
 * still inline a schema sketch because their output shape is the actual
 * contract (not just "be JSON"), and the model can't infer it from the
 * attribute key list alone.
 */

export function buildSystemPrompt(attrKeys: string[]): string {
  // AI.4: dropped the `RESPONSE FORMAT (strict JSON, one entry per character): {…}`
  // example block (~6 lines, ~150 tokens) — json_object mode + the "Return a JSON
  // object…" rule below cover it. The attribute-key list still defines the schema.
  return `You are a fictional character classifier. For each character, determine boolean attributes.

RULES:
- Return a JSON object where keys are character IDs and values are objects mapping attribute keys to true, false, or null.
- true = the attribute clearly applies to this character
- false = the attribute clearly does NOT apply
- null = genuinely ambiguous, unknown, or insufficient information
- Be decisive: prefer true/false over null when you have reasonable knowledge
- Use your broad knowledge of fiction, games, anime, comics, movies, TV shows, and books
- You MUST include ALL ${attrKeys.length} attribute keys for each character

ATTRIBUTE KEYS (${attrKeys.length} total — respond with these exact keys):
${attrKeys.join(', ')}`;
}

export function buildUserPrompt(
  characters: { id: string; name: string; category: string; description: string | null }[]
): string {
  const charDescriptions = characters.map(c => {
    const desc = c.description ? ` — ${c.description.slice(0, 200)}` : '';
    return `- ${c.id}: "${c.name}" (${c.category})${desc}`;
  }).join('\n');

  return `Classify these characters:\n\n${charDescriptions}`;
}

export function buildSkepticPrompt(
  chars: { id: string; name: string; category: string }[],
  attrValues: Record<string, Record<string, boolean | null>>
): string {
  const charBlocks = chars.map(c => {
    const attrs = attrValues[c.id] ?? {};
    const attrLines = Object.entries(attrs)
      .filter(([, v]) => v !== null)
      .map(([k, v]) => `  ${k}: ${v}`)
      .join('\n');
    return `${c.name} (${c.category}):\n${attrLines}`;
  }).join('\n\n');

  return `You are a fact-checking expert reviewing attribute assignments for fictional characters.

Below are characters with their current attribute values (true/false). Your job is to challenge assignments that seem INCORRECT or SUSPICIOUS based on your knowledge.

Characters and their attributes:
${charBlocks}

Identify up to 5 attribute assignments you believe are WRONG or HIGHLY QUESTIONABLE. Only flag genuine errors, not minor ambiguities.

Return JSON:
{
  "disputes": [
    {
      "character_id": "char_id_here",
      "attribute_key": "attributeKey",
      "current_value": true,
      "dispute_reason": "One sentence explaining why this seems wrong",
      "confidence": 0.85
    }
  ]
}

If you see no errors, return: { "disputes": [] }`;
}
