/**
 * DQ.2 — Vision-derived visual attributes (validation harness).
 *
 * Runs each golden character's portrait image through a vision model
 * (default `gpt-4o-mini`) and compares the model's answers for a fixed set of
 * VISUAL boolean attributes to the curator's golden values. Exits non-zero
 * when overall agreement < 90%.
 *
 * Image source: Wikipedia REST API summary endpoint
 * (`/api/rest_v1/page/summary/<slug>`). The slug for each character is cached
 * in `data/golden-image-sources.json` (committed) so the validation step is
 * fully reproducible and CI does not need to call Wikipedia.
 *
 * Usage:
 *   pnpm vision:check                  # Schema-only: verify image cache covers golden set, no network
 *   pnpm vision:cache-images           # Refresh data/golden-image-sources.json from Wikipedia
 *   pnpm vision:validate               # Live LLM run; needs OPENAI_API_KEY
 *   pnpm vision:validate --json out.json
 *
 * Exit codes:
 *   0 — agreement ≥ threshold (or schema-only succeeded)
 *   1 — schema / cache malformed
 *   2 — agreement below threshold
 *   3 — missing OPENAI_API_KEY
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..');

function loadEnvFiles(): void {
  for (const file of ['.env.local', '.dev.vars']) {
    const p = path.join(REPO_ROOT, file);
    if (!existsSync(p)) continue;
    for (const line of readFileSync(p, 'utf-8').split('\n')) {
      const t = line.trim();
      if (!t || t.startsWith('#')) continue;
      const i = t.indexOf('=');
      if (i === -1) continue;
      const k = t.slice(0, i).trim();
      const v = t.slice(i + 1).trim();
      if (!process.env[k]) process.env[k] = v;
    }
  }
}
loadEnvFiles();

const GOLDEN_PATH = path.join(REPO_ROOT, 'data', 'data-quality-golden.json');
const IMAGE_CACHE_PATH = path.join(REPO_ROOT, 'data', 'golden-image-sources.json');
const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';
const MODEL = process.env.VISION_MODEL ?? 'gpt-4o-mini';
const AGREEMENT_THRESHOLD_PCT = 90;

/**
 * Visual boolean attributes a vision model can confidently determine from a
 * portrait. All keys must exist in `data/enrich-cache/attribute_definitions.json`.
 */
const VISION_TARGET_ATTRS = [
  'wearsCape',
  'wearsGlasses',
  'wearsHat',
  'wearsMask',
  'hasBeard',
  'hasFacialHair',
  'hasGlasses',
  'hasLongHair',
  'hasShortHair',
  'hasBlondeHair',
  'hasRedHair',
  'hasBlueEyes',
  'hasGreenEyes',
  'hasArmor',
  'hasClaws',
  'hasTail',
  'hasWings',
  'hasScar',
  'hasTattoos',
  'isBald',
  'isFemale',
  'isMale',
  'isAlien',
  'isRobot',
  'isCyborg',
] as const;

interface GoldenCharacter {
  id: string;
  name: string;
  category: string;
  description: string;
  expected: Record<string, boolean>;
}

interface GoldenSet {
  version: number;
  thresholdPct: number;
  characters: GoldenCharacter[];
}

interface ImageCacheEntry {
  /** Wikipedia page slug used in the REST summary call. */
  slug: string;
  /** Direct image URL (Wikipedia/Wikimedia). null = no usable image found. */
  url: string | null;
  /** Unix seconds when the entry was last refreshed. */
  fetchedAt: number;
}

interface ImageCache {
  version: number;
  entries: Record<string, ImageCacheEntry>;
}

function parseArgs(): {
  mode: 'check' | 'cache' | 'validate';
  jsonOut: string | null;
} {
  const argv = process.argv.slice(2);
  let mode: 'check' | 'cache' | 'validate' = 'validate';
  if (argv.includes('--schema-only') || argv.includes('--check')) mode = 'check';
  if (argv.includes('--cache-images')) mode = 'cache';
  const jsonIdx = argv.findIndex((a) => a === '--json');
  const jsonOut = jsonIdx >= 0 ? (argv[jsonIdx + 1] ?? null) : null;
  return { mode, jsonOut };
}

function loadGolden(): GoldenSet {
  if (!existsSync(GOLDEN_PATH)) throw new Error(`Golden set missing: ${GOLDEN_PATH}`);
  const raw = JSON.parse(readFileSync(GOLDEN_PATH, 'utf-8')) as GoldenSet;
  if (!Array.isArray(raw.characters) || raw.characters.length === 0) {
    throw new Error('Golden set has no characters');
  }
  return raw;
}

function loadAttrKeys(): Set<string> {
  const p = path.join(REPO_ROOT, 'data', 'enrich-cache', 'attribute_definitions.json');
  if (!existsSync(p)) {
    throw new Error(`Attribute definitions cache missing: ${p}`);
  }
  const defs = JSON.parse(readFileSync(p, 'utf-8')) as Array<{ key: string }>;
  return new Set(defs.map((d) => d.key));
}

function loadImageCache(): ImageCache {
  if (!existsSync(IMAGE_CACHE_PATH)) {
    return { version: 1, entries: {} };
  }
  return JSON.parse(readFileSync(IMAGE_CACHE_PATH, 'utf-8')) as ImageCache;
}

function saveImageCache(cache: ImageCache): void {
  writeFileSync(IMAGE_CACHE_PATH, JSON.stringify(cache, null, 2) + '\n', 'utf-8');
}

function defaultSlug(name: string): string {
  return name.replace(/\s+/g, '_');
}

interface WikiSummary {
  originalimage?: { source?: string };
  thumbnail?: { source?: string };
  type?: string;
}

async function fetchWikipediaImage(slug: string): Promise<string | null> {
  const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(slug)}?redirect=true`;
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'GuessGame/1.0 (DQ.2 vision validation; https://github.com/and3rn3t/guess)',
      Accept: 'application/json',
    },
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) return null;
  const data = (await res.json()) as WikiSummary;
  return data.originalimage?.source ?? data.thumbnail?.source ?? null;
}

async function cacheImages(): Promise<void> {
  const golden = loadGolden();
  const cache = loadImageCache();
  let added = 0;
  let updated = 0;
  let missing = 0;

  for (const char of golden.characters) {
    const existing = cache.entries[char.id];
    const slug = existing?.slug ?? defaultSlug(char.name);
    process.stdout.write(`  ${char.id} (${slug}) … `);
    try {
      const url = await fetchWikipediaImage(slug);
      const entry: ImageCacheEntry = {
        slug,
        url,
        fetchedAt: Math.floor(Date.now() / 1000),
      };
      if (!existing) added++;
      else if (existing.url !== url) updated++;
      cache.entries[char.id] = entry;
      if (!url) {
        missing++;
        process.stdout.write('NO IMAGE\n');
      } else {
        process.stdout.write('ok\n');
      }
    } catch (err) {
      missing++;
      const msg = err instanceof Error ? err.message : String(err);
      process.stdout.write(`error: ${msg}\n`);
      cache.entries[char.id] = {
        slug,
        url: null,
        fetchedAt: Math.floor(Date.now() / 1000),
      };
    }
    // Be nice to Wikipedia.
    await new Promise((r) => setTimeout(r, 150));
  }

  saveImageCache(cache);
  console.log(
    `\nImage cache updated → ${IMAGE_CACHE_PATH}`,
  );
  console.log(`  ${golden.characters.length} chars · added ${added} · changed ${updated} · no-image ${missing}`);
}

function validateCacheCoverage(golden: GoldenSet, cache: ImageCache): {
  withImage: number;
  withoutImage: number;
  missingFromCache: string[];
} {
  let withImage = 0;
  let withoutImage = 0;
  const missingFromCache: string[] = [];
  for (const char of golden.characters) {
    const entry = cache.entries[char.id];
    if (!entry) {
      missingFromCache.push(char.id);
      continue;
    }
    if (entry.url) withImage++;
    else withoutImage++;
  }
  return { withImage, withoutImage, missingFromCache };
}

function buildSystemPrompt(): string {
  return `You are a careful visual classifier of fictional characters.

You will be shown ONE image of a character. Look at the image and answer each boolean attribute strictly based on what is visible in the image. If the image clearly shows it, answer true. If the image clearly shows it is absent, answer false. If you genuinely cannot tell from the image alone, answer null.

Rules:
- Answer based on visual evidence in the image only — do not use prior knowledge of the character.
- "wearsHat" = a hat or helmet covering the top of the head is visible.
- "wearsCape" = a cape is visible behind the character.
- "wearsMask" = the face is partially or fully covered by a costume mask (not just shadows).
- "wearsGlasses" / "hasGlasses" = visible glasses or goggles on the eyes (treat as the same answer).
- "hasBeard" = a beard is clearly visible. "hasFacialHair" = any facial hair (beard, moustache, stubble).
- "hasLongHair" = hair clearly past the shoulders. "hasShortHair" = hair clearly above the shoulders. "isBald" = no visible hair on the scalp.
- "hasBlondeHair" / "hasRedHair" = hair color is clearly that color.
- "hasBlueEyes" / "hasGreenEyes" = eye color is clearly that color (null if eyes not visible).
- "hasArmor" = visible plate / hard armor on the body.
- "hasClaws" = pointed claws on hands.
- "hasTail" = a tail is visible.
- "hasWings" = wings are visible.
- "hasScar" = a scar is visible on visible skin.
- "hasTattoos" = tattoos are visible on visible skin.
- "isFemale" / "isMale" = apparent gender presentation in the image (one true, the other false; null only if truly unclear).
- "isAlien" = the figure is clearly non-human in appearance (e.g. green skin, antennae, non-human anatomy).
- "isRobot" = the figure is clearly mechanical / metallic / robotic.
- "isCyborg" = visible mix of organic and mechanical parts.

Return STRICT JSON exactly matching this shape:
{
${VISION_TARGET_ATTRS.map((k) => `  "${k}": true | false | null`).join(',\n')}
}
No prose, no markdown.`;
}

async function fetchImageAsDataUrl(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'GuessGame/1.0 (DQ.2 vision validation; https://github.com/and3rn3t/guess)',
      Accept: 'image/*',
    },
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw new Error(`Image fetch HTTP ${res.status} for ${url}`);
  const buf = Buffer.from(await res.arrayBuffer());
  const ct = res.headers.get('content-type') ?? 'image/jpeg';
  return `data:${ct};base64,${buf.toString('base64')}`;
}

interface OpenAIVisionResponse {
  choices: Array<{ message: { content: string } }>;
}

async function callVisionModel(
  apiKey: string,
  imageDataUrl: string,
  characterName: string,
): Promise<Record<string, boolean | null>> {
  const res = await fetch(OPENAI_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: MODEL,
      temperature: 0,
      max_tokens: 800,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: buildSystemPrompt() },
        {
          role: 'user',
          content: [
            { type: 'text', text: `Classify the visible appearance of this character (name shown only as a hint; answer based on the image): ${characterName}` },
            { type: 'image_url', image_url: { url: imageDataUrl, detail: 'low' } },
          ],
        },
      ],
    }),
    signal: AbortSignal.timeout(60_000),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`OpenAI vision error ${res.status}: ${body.slice(0, 300)}`);
  }
  const data = (await res.json()) as OpenAIVisionResponse;
  const content = data.choices[0]?.message?.content?.trim() ?? '';
  const parsed = JSON.parse(content) as Record<string, boolean | null>;
  // Normalize: ensure all target keys present.
  const out: Record<string, boolean | null> = {};
  for (const k of VISION_TARGET_ATTRS) {
    const v = parsed[k];
    if (v === true || v === false || v === null) out[k] = v;
    else out[k] = null;
  }
  return out;
}

interface PerCharResult {
  id: string;
  name: string;
  imageUrl: string;
  asserted: number;
  agreed: number;
  disagreed: number;
  modelNull: number;
  mismatches: Array<{ attr: string; expected: boolean; got: boolean | null }>;
}

interface Report {
  model: string;
  thresholdPct: number;
  agreementPct: number;
  totalAsserted: number;
  totalAgreed: number;
  totalDisagreed: number;
  totalModelNull: number;
  charactersWithImage: number;
  charactersWithoutImage: number;
  perCharacter: PerCharResult[];
  perAttribute: Record<string, { asserted: number; agreed: number; agreementPct: number }>;
  generatedAt: string;
}

function score(
  golden: GoldenSet,
  cache: ImageCache,
  visionResults: Map<string, Record<string, boolean | null>>,
): Report {
  const perCharacter: PerCharResult[] = [];
  const perAttrAgg: Record<string, { asserted: number; agreed: number }> = {};
  for (const k of VISION_TARGET_ATTRS) perAttrAgg[k] = { asserted: 0, agreed: 0 };

  let totalAsserted = 0;
  let totalAgreed = 0;
  let totalDisagreed = 0;
  let totalModelNull = 0;
  let withImage = 0;
  let withoutImage = 0;

  for (const char of golden.characters) {
    const entry = cache.entries[char.id];
    if (!entry?.url) {
      withoutImage++;
      continue;
    }
    withImage++;
    const got = visionResults.get(char.id);
    if (!got) continue;

    const result: PerCharResult = {
      id: char.id,
      name: char.name,
      imageUrl: entry.url,
      asserted: 0,
      agreed: 0,
      disagreed: 0,
      modelNull: 0,
      mismatches: [],
    };

    for (const attr of VISION_TARGET_ATTRS) {
      if (!(attr in char.expected)) continue;
      const expected = char.expected[attr];
      if (typeof expected !== 'boolean') continue;
      result.asserted++;
      totalAsserted++;
      perAttrAgg[attr].asserted++;
      const v = got[attr];
      if (v === expected) {
        result.agreed++;
        totalAgreed++;
        perAttrAgg[attr].agreed++;
      } else if (v === null) {
        result.modelNull++;
        totalModelNull++;
        result.mismatches.push({ attr, expected, got: v });
      } else {
        result.disagreed++;
        totalDisagreed++;
        result.mismatches.push({ attr, expected, got: v });
      }
    }
    perCharacter.push(result);
  }

  const perAttribute: Report['perAttribute'] = {};
  for (const [k, v] of Object.entries(perAttrAgg)) {
    perAttribute[k] = {
      asserted: v.asserted,
      agreed: v.agreed,
      agreementPct: v.asserted === 0 ? 100 : (v.agreed / v.asserted) * 100,
    };
  }

  return {
    model: MODEL,
    thresholdPct: AGREEMENT_THRESHOLD_PCT,
    agreementPct: totalAsserted === 0 ? 0 : (totalAgreed / totalAsserted) * 100,
    totalAsserted,
    totalAgreed,
    totalDisagreed,
    totalModelNull,
    charactersWithImage: withImage,
    charactersWithoutImage: withoutImage,
    perCharacter,
    perAttribute,
    generatedAt: new Date().toISOString(),
  };
}

function printReport(r: Report): void {
  console.log('');
  console.log('Vision validation report');
  console.log('────────────────────────');
  console.log(`Model           : ${r.model}`);
  console.log(`Chars w/ image  : ${r.charactersWithImage}  (skipped ${r.charactersWithoutImage} with no image)`);
  console.log(`Asserted cells  : ${r.totalAsserted}`);
  console.log(`Agreed          : ${r.totalAgreed}`);
  console.log(`Disagreed       : ${r.totalDisagreed}`);
  console.log(`Model null      : ${r.totalModelNull}`);
  console.log(`Agreement       : ${r.agreementPct.toFixed(2)}%  (gate ≥ ${r.thresholdPct}%)`);
  console.log('');
  console.log('Per attribute (asserted / agreed / pct):');
  for (const [k, v] of Object.entries(r.perAttribute).sort((a, b) => a[1].agreementPct - b[1].agreementPct)) {
    if (v.asserted === 0) continue;
    console.log(`  ${k.padEnd(18)}  ${String(v.asserted).padStart(3)}  ${String(v.agreed).padStart(3)}  ${v.agreementPct.toFixed(1)}%`);
  }
  const worst = r.perCharacter.filter((c) => c.disagreed + c.modelNull > 0).sort((a, b) => (b.disagreed + b.modelNull) - (a.disagreed + a.modelNull)).slice(0, 10);
  if (worst.length > 0) {
    console.log('');
    console.log('Top characters by mismatch count:');
    for (const c of worst) {
      console.log(`  ${c.name.padEnd(24)} agreed=${c.agreed}/${c.asserted}  disagreed=${c.disagreed}  null=${c.modelNull}`);
    }
  }
}

async function main(): Promise<void> {
  const { mode, jsonOut } = parseArgs();
  const golden = loadGolden();
  const attrKeys = loadAttrKeys();

  // Schema sanity: every VISION_TARGET_ATTRS key must exist in the attribute schema.
  const unknownTargets = VISION_TARGET_ATTRS.filter((k) => !attrKeys.has(k));
  if (unknownTargets.length > 0) {
    console.error(`✗ Vision targets missing from attribute schema: ${unknownTargets.join(', ')}`);
    process.exit(1);
  }

  if (mode === 'cache') {
    await cacheImages();
    return;
  }

  const cache = loadImageCache();
  const coverage = validateCacheCoverage(golden, cache);
  console.log(
    `Loaded ${golden.characters.length} golden characters · image cache covers ${coverage.withImage} (no-image: ${coverage.withoutImage}, missing-from-cache: ${coverage.missingFromCache.length})`,
  );
  if (coverage.missingFromCache.length > 0) {
    console.error(`✗ Image cache missing entries for: ${coverage.missingFromCache.join(', ')}`);
    console.error('  Run: pnpm vision:cache-images');
    process.exit(1);
  }
  if (coverage.withImage === 0) {
    console.error('✗ Image cache has no usable URLs.');
    process.exit(1);
  }

  if (mode === 'check') {
    console.log('✓ Schema-only check passed.');
    return;
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error('✗ OPENAI_API_KEY is required for vision validation.');
    process.exit(3);
  }

  const visionResults = new Map<string, Record<string, boolean | null>>();
  let i = 0;
  for (const char of golden.characters) {
    i++;
    const entry = cache.entries[char.id];
    if (!entry?.url) continue;
    process.stdout.write(`  [${i}/${golden.characters.length}] ${char.name.padEnd(24)} … `);
    try {
      const dataUrl = await fetchImageAsDataUrl(entry.url);
      const got = await callVisionModel(apiKey, dataUrl, char.name);
      visionResults.set(char.id, got);
      process.stdout.write('ok\n');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      process.stdout.write(`error: ${msg}\n`);
    }
  }

  const report = score(golden, cache, visionResults);
  printReport(report);

  if (jsonOut) {
    writeFileSync(path.resolve(jsonOut), JSON.stringify(report, null, 2) + '\n', 'utf-8');
    console.log(`\nReport written → ${jsonOut}`);
  }

  if (report.agreementPct < report.thresholdPct) {
    console.error(`\n✗ Agreement ${report.agreementPct.toFixed(2)}% is below gate ${report.thresholdPct}%.`);
    process.exit(2);
  }
  console.log(`\n✓ Agreement ${report.agreementPct.toFixed(2)}% ≥ gate ${report.thresholdPct}%.`);
}

main().catch((err) => {
  console.error('✗ vision-validate failed:', err);
  process.exit(1);
});
