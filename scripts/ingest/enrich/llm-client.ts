/**
 * LLM client adapters for the enrichment pipeline.
 *
 * Wraps OpenAI Chat Completions and OpenRouter (for second-model consensus).
 * Also contains the pure consensus merge function that combines two model outputs.
 *
 * Extracted from scripts/ingest/enrich.ts (RF.1) without behavior change.
 */
import { RateLimiter } from '../rate-limiter.js';

export const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';
export const MODEL = 'gpt-4o-mini';
export const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

// Rate limit: gpt-4o-mini tier 1 ~500 RPM, use 400 RPM to be safe.
// Shared module-level limiter — preserves prior global behavior.
export const rateLimiter = new RateLimiter(100, 400, 60_000);

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface OpenAIResponse {
  choices: { message: { content: string }; finish_reason: string }[];
  usage: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
}

export async function callLLM(
  messages: ChatMessage[],
  apiKey: string,
  model = MODEL,
): Promise<OpenAIResponse> {
  await rateLimiter.wait();

  const response = await fetch(OPENAI_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.1, // Low temp for factual classification
      response_format: { type: 'json_object' },
      max_tokens: 16384,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`OpenAI API error ${response.status}: ${body}`);
  }

  return response.json() as Promise<OpenAIResponse>;
}

// EN.2: OpenRouter client for second-model consensus voting.
export async function callOpenRouter(
  messages: ChatMessage[],
  model: string,
  apiKey: string,
): Promise<OpenAIResponse> {
  const response = await fetch(OPENROUTER_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
      'HTTP-Referer': 'https://guess.pages.dev',
      'X-Title': 'Guess — Attribute Enrichment',
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.1,
      response_format: { type: 'json_object' },
      max_tokens: 16384,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`OpenRouter API error ${response.status}: ${body}`);
  }

  return response.json() as Promise<OpenAIResponse>;
}

/**
 * EN.2: Merge two sets of attribute results using majority voting.
 *
 * - Both models agree → confidence 0.92 (or 0.70 for null=null).
 * - One model abstains (null) → use the definite answer at 0.72.
 * - Genuine disagreement → primary wins tie-break, confidence 0.50, contested=true.
 */
export function mergeConsensusResults(
  primary: Record<string, boolean | null>,
  secondary: Record<string, boolean | null>,
): {
  merged: Record<string, boolean | null>;
  confidence: Record<string, number>;
  contested: Record<string, boolean>;
} {
  const merged: Record<string, boolean | null> = {};
  const confidence: Record<string, number> = {};
  const contested: Record<string, boolean> = {};

  const allKeys = new Set([...Object.keys(primary), ...Object.keys(secondary)]);

  for (const key of allKeys) {
    const p = primary[key] ?? null;
    const s = secondary[key] ?? null;

    if (p === s) {
      merged[key] = p;
      confidence[key] = p === null ? 0.7 : 0.92;
      contested[key] = false;
    } else if (p !== null && s === null) {
      merged[key] = p;
      confidence[key] = 0.72;
      contested[key] = false;
    } else if (s !== null && p === null) {
      merged[key] = s;
      confidence[key] = 0.72;
      contested[key] = false;
    } else {
      // Genuine disagreement (true vs false). Primary wins tie-break.
      merged[key] = p;
      confidence[key] = 0.5;
      contested[key] = true;
    }
  }

  return { merged, confidence, contested };
}
