/**
 * EP: Automated Attribute Discovery
 *
 * Samples character descriptions from the staging DB, asks GPT-4o to suggest
 * new boolean discriminating attributes that don't exist in the current definitions,
 * and inserts novel candidates into D1's `proposed_attributes` table for admin review.
 *
 * Usage (via run.ts):
 *   npx tsx scripts/ingest/run.ts discover-attrs [--sample N] [--limit N] [--dry-run] [--apply]
 *
 * Flags:
 *   --sample N     Number of random characters to sample per LLM call (default: 50)
 *   --limit N      Max total candidates to submit to D1 (default: 50)
 *   --dry-run      Print candidates without submitting to D1
 *   --apply        Submit approved candidates via POST /api/admin/proposed-attributes
 *                  Requires ADMIN_URL + ADMIN_BASIC_AUTH in .env.local
 */
import { readFileSync, existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getDb } from './db.js';
import { getConfig } from './config.js';
import { loadAttributeDefinitions, type AttributeDef } from './enrich.js';
import { withRetry } from './rate-limiter.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

interface ProposedAttr {
  key: string;
  display_text: string;
  question_text: string;
  rationale: string;
  example_chars: string; // JSON string of [{ id, name }]
}

interface OpenAIResponse {
  choices: { message: { content: string } }[];
  usage: { prompt_tokens: number; completion_tokens: number };
}

interface DiscoverOptions {
  sampleSize?: number;
  limit?: number;
  dryRun?: boolean;
  apply?: boolean;
}

const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';

async function callGPT4o(prompt: string, apiKey: string): Promise<OpenAIResponse> {
  const response = await fetch(OPENAI_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7, // Higher temp for creative attribute discovery
      response_format: { type: 'json_object' },
      max_tokens: 4096,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`OpenAI API error ${response.status}: ${body}`);
  }

  return response.json() as Promise<OpenAIResponse>;
}

function buildDiscoveryPrompt(
  characters: { id: string; name: string; category: string; description: string | null }[],
  existingKeys: Set<string>
): string {
  const charList = characters
    .map(c => {
      const desc = c.description ? ` — ${c.description.slice(0, 150)}` : '';
      return `- ${c.id}: "${c.name}" (${c.category})${desc}`;
    })
    .join('\n');

  return `You are an expert at designing boolean attribute classifiers for fictional characters.

Here are ${characters.length} fictional characters from a character-guessing game:
${charList}

We already have these attribute keys (DO NOT suggest these):
${Array.from(existingKeys).sort().join(', ')}

Your task: Suggest up to 20 NEW boolean attributes (true/false questions) that would help distinguish these characters from each other. Focus on high-signal attributes that:
1. Split the characters roughly 50/50 (avoid attributes that almost all or almost none have)
2. Are factually verifiable from widely known information
3. Are NOT redundant with existing attributes listed above
4. Use camelCase (e.g. "hasWings", "isFromEarth", "speaksMultipleLanguages")

Return JSON with this exact structure:
{
  "proposals": [
    {
      "key": "camelCaseKey",
      "display_text": "Short human-readable label (3-6 words)",
      "question_text": "Yes/no question phrasing (e.g. 'Does this character have wings?')",
      "rationale": "One sentence why this attribute is useful for discrimination",
      "example_char_ids": ["char_id_1", "char_id_2"]
    }
  ]
}`;
}

function getExistingKeys(allAttrs: AttributeDef[], localDefsPath: string): Set<string> {
  const keys = new Set(allAttrs.map(a => a.key));

  // Also check local attribute_definitions.json for any extras
  if (existsSync(localDefsPath)) {
    try {
      const local = JSON.parse(readFileSync(localDefsPath, 'utf-8')) as AttributeDef[];
      for (const a of local) keys.add(a.key);
    } catch {
      // ignore
    }
  }

  return keys;
}

function sampleCharacters(
  n: number
): { id: string; name: string; category: string; description: string | null }[] {
  const db = getDb();
  return db.prepare(`
    SELECT rc.id, rc.name, rc.category, rc.description
    FROM raw_characters rc
    INNER JOIN dedup_map dm ON dm.canonical_id = rc.id
    WHERE rc.description IS NOT NULL
    ORDER BY RANDOM()
    LIMIT ?
  `).all(n) as { id: string; name: string; category: string; description: string | null }[];
}

async function submitToAdminApi(
  proposals: ProposedAttr[],
  adminUrl: string,
  basicAuth: string
): Promise<{ inserted: number; submitted: number }> {
  const response = await fetch(`${adminUrl}/api/admin/proposed-attributes`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Basic ${Buffer.from(basicAuth).toString('base64')}`,
    },
    body: JSON.stringify({ proposals }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Admin API error ${response.status}: ${body}`);
  }

  return response.json() as Promise<{ inserted: number; submitted: number }>;
}

export async function runDiscoverAttributes(opts: DiscoverOptions = {}): Promise<void> {
  const sampleSize = opts.sampleSize ?? 50;
  const limit = opts.limit ?? 50;
  const config = getConfig();

  if (!config.openaiApiKey) {
    throw new Error('OPENAI_API_KEY not set');
  }

  console.log(`\n=== Automated Attribute Discovery ===`);
  console.log(`Sampling ${sampleSize} characters, targeting up to ${limit} new proposals\n`);

  // Load existing attribute definitions
  const allAttrs = loadAttributeDefinitions();
  const localDefsPath = path.join(__dirname, '..', '..', 'data', 'enrich-cache', 'attribute_definitions.json');
  const existingKeys = getExistingKeys(allAttrs, localDefsPath);
  console.log(`Existing attribute keys: ${existingKeys.size}`);

  // Sample characters
  const characters = sampleCharacters(sampleSize);
  if (characters.length === 0) {
    console.log('No characters found in staging DB. Run ingestion first.');
    return;
  }
  console.log(`Sampled ${characters.length} characters`);

  // Call GPT-4o
  const prompt = buildDiscoveryPrompt(characters, existingKeys);
  console.log('\nCalling GPT-4o for attribute discovery...');

  const response = await withRetry(() => callGPT4o(prompt, config.openaiApiKey), 3, 2000);
  const content = response.choices[0]?.message?.content;
  if (!content) throw new Error('Empty response from GPT-4o');

  const cost = ((response.usage.prompt_tokens / 1_000_000) * 2.50) +
    ((response.usage.completion_tokens / 1_000_000) * 10.00);
  console.log(`Tokens: ${response.usage.prompt_tokens} prompt + ${response.usage.completion_tokens} completion ($${cost.toFixed(4)})`);

  // Parse response
  let rawProposals: {
    key: string;
    display_text: string;
    question_text: string;
    rationale: string;
    example_char_ids?: string[];
  }[];
  try {
    const parsed = JSON.parse(content) as { proposals: typeof rawProposals };
    rawProposals = parsed.proposals ?? [];
  } catch {
    throw new Error(`Failed to parse GPT-4o response:\n${content.slice(0, 500)}`);
  }

  // Filter to truly new keys
  const charMap = new Map(characters.map(c => [c.id, c]));
  const novel: ProposedAttr[] = [];

  for (const p of rawProposals) {
    if (!p.key || existingKeys.has(p.key)) continue;
    if (!p.display_text || !p.question_text) continue;

    const exampleChars = (p.example_char_ids ?? [])
      .filter(id => charMap.has(id))
      .slice(0, 3)
      .map(id => ({ id, name: charMap.get(id)!.name }));

    novel.push({
      key: p.key,
      display_text: p.display_text,
      question_text: p.question_text,
      rationale: p.rationale ?? '',
      example_chars: JSON.stringify(exampleChars),
    });

    if (novel.length >= limit) break;
  }

  console.log(`\nDiscovered ${novel.length} new attribute candidates (${rawProposals.length} total suggested, ${rawProposals.length - novel.length} already exist):`);
  for (const p of novel) {
    console.log(`  [${p.key}] "${p.display_text}" — ${p.question_text}`);
    console.log(`    Rationale: ${p.rationale}`);
  }

  if (opts.dryRun) {
    console.log('\nDry run — not submitting to D1.');
    return;
  }

  if (!opts.apply) {
    console.log('\nRun with --apply to submit to D1 proposed_attributes table.');
    return;
  }

  // Submit to D1 via admin API
  const adminUrl = process.env.ADMIN_URL ?? 'https://guess.pages.dev';
  const basicAuth = process.env.ADMIN_BASIC_AUTH ?? '';
  if (!basicAuth) {
    throw new Error('ADMIN_BASIC_AUTH not set (format: "user:pass")');
  }

  console.log(`\nSubmitting ${novel.length} proposals to ${adminUrl}...`);
  const result = await submitToAdminApi(novel, adminUrl, basicAuth);
  console.log(`Submitted ${result.submitted}, inserted ${result.inserted} new (skipped ${result.submitted - result.inserted} duplicates)`);
}
