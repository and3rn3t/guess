/**
 * POST /api/admin/recommender — LLM-powered attribute recommendations with live data.
 *
 * IMPORTANT: This is a **server-side** recommendation engine. All processing happens
 * on the server with access to the full character database. This is not client-side.
 *
 * ✅ Benefits over client-side rules:
 *    - Uses live database statistics (attribute frequency, discrimination value)
 *    - Can access the full character pool for context
 *    - LLM reasoning is transparent and updatable
 *    - Respects rate limiting (1 req/60s per admin user)
 *
 * 📊 Live Data Integration:
 *    - Queries database for attribute statistics (% of characters with each attr)
 *    - Calculates strategic value: attributes in 10-50% frequency range are most useful
 *    - Fetches top-5 most popular characters in the same category as reference examples
 *    - Includes both stats + examples in the LLM prompt for better reasoning
 *    - Falls back gracefully if DB is unavailable
 *
 * ⚡ Performance Optimization:
 *    - Attribute stats cached in KV for 30 minutes (stable across many requests)
 *    - Popular characters cached per category for 15 minutes (updates with popularity changes)
 *    - KV cache miss falls back transparently to DB queries
 *    - Parallel fetch: both stat queries complete simultaneously
 *
 * � Cost & Quality Optimizations:
 *    - Smart model selection: uses gpt-4o-mini for straightforward characters (>=8 attrs, <=15 options, no focus)
 *      Reduces cost by ~90% for simple pattern extension while gpt-4o handles nuanced cases
 *    - Attribute pre-filtering: removes attributes with <2% or >95% frequency (poor discriminative value)
 *      Reduces prompt size by 20-30% and improves LLM focus on useful traits
 *
 * �🌟 Popular Character Examples:
 *    - When category is provided, fetches the 5 most popular characters from that category
 *    - Shows their attributes to the LLM as reference patterns
 *    - LLM learns from real popular characters → better recommendations
 *    - Example: "Popular video game characters typically have: X, Y, Z"
 *
 * Protected by HTTP Basic Auth via functions/_middleware.ts.
 */
import {
  checkRateLimitBestEffort,
  type Env,
  errorResponse,
  getActorId,
  getCompletionsEndpoint,
  getLlmHeaders,
  getRequestId,
  jsonResponse,
  logError,
  parseJsonBodyWithSchema,
  withRequestId,
} from "../_helpers";
import { d1CacheGet, d1CachePut } from "../_d1_cache";
import { z } from "zod";

const AttributeValueSchema = z.union([z.boolean(), z.null()]);

const BodySchema = z.object({
  characterName: z.string().min(1).max(120),
  category: z.string().max(50).optional(), // e.g., 'movies', 'books', 'video-games'
  existingAttributes: z.record(z.string(), AttributeValueSchema),
  availableAttributes: z
    .array(
      z.object({
        key: z.string().min(1).max(120),
        label: z.string().min(1).max(160),
      }),
    )
    .max(400),
  maxRecommendations: z.number().int().min(1).max(30).optional(),
  focusDescription: z.string().min(1).max(200).optional(),
});

const RecommendationSchema = z.object({
  attribute: z.string().min(1),
  label: z.string().min(1),
  reason: z.string().min(1),
  priority: z.enum(["high", "medium", "low"]),
});

type Recommendation = z.infer<typeof RecommendationSchema>;

interface AttributeStats {
  attributeKey: string;
  label: string;
  frequency: number; // 0-100 percentage
  averageDiscriminativeValue: number; // 0-100, how useful in guessing
}

interface PopularCharacterExample {
  name: string;
  attributes: string[];
  popularity: number;
}

/**
 * Determine if we should use gpt-4o-mini (cost optimization) instead of gpt-4o.
 * Mini is sufficient for straightforward character patterns.
 */
function shouldUseMiniModel(
  existingAttributes: Record<string, boolean | null>,
  availableAttributes: Array<{ key: string; label: string }>,
  focusDescription?: string,
): boolean {
  const existingCount = Object.keys(existingAttributes).length;
  const availableCount = availableAttributes.length;
  const hasFocus = !!focusDescription && focusDescription.length > 0;

  // Use mini when: character is well-defined (8+ attrs), small decision space (≤15 attrs), no focused request
  // Mini handles straightforward pattern extension well; gpt-4o needed for nuanced/focused work
  return existingCount >= 8 && availableCount <= 15 && !hasFocus;
}

/**
 * Filter available attributes to exclude those with poor discriminative value.
 * Removes attributes that are too rare (<2%) or too common (>95%).
 * These don't help the guessing game and just add noise to the prompt.
 */
function filterAttributesByDiscriminativeValue(
  stats: Map<string, AttributeStats>,
  availableAttributes: Array<{ key: string; label: string }>,
): Array<{ key: string; label: string }> {
  return availableAttributes.filter(({ key }) => {
    const stat = stats.get(key);
    if (!stat) return true; // If no stats, include it (safer to include than exclude)
    const freq = stat.frequency;
    // Exclude: too rare (<2%) or too common (>95%)
    // Keep: attributes in 2-95% range (discriminative potential)
    return freq >= 2 && freq <= 95;
  });
}

/**
 * Generate a stable cache key for attribute stats.
 * Key is based on sorted attribute keys to ensure consistency.
 */
function getAttributeStatsCacheKey(attributeKeys: string[]): string {
  const sorted = [...attributeKeys].sort().join("|");
  return `recommender:attr-stats:${sorted}`;
}

/**
 * Generate a cache key for popular characters in a category.
 */
function getPopularCharactersCacheKey(category: string): string {
  return `recommender:popular-chars:${category}`;
}

/**
 * Fetch live attribute statistics from the database.
 * Checks D1 kv_cache first (30-minute TTL), then queries DB, then caches result.
 */
async function fetchAttributeStats(
  db: D1Database,
  attributeKeys: string[],
): Promise<Map<string, AttributeStats>> {
  if (!db || attributeKeys.length === 0) return new Map();

  const cacheKey = getAttributeStatsCacheKey(attributeKeys);

  // Try D1 kv_cache first
  try {
    const cached = await d1CacheGet<Array<[string, AttributeStats]>>(db, cacheKey);
    if (cached) return new Map(cached);
  } catch {
    // If cache read fails, fall through to DB query
  }

  try {
    const statsResults = await db
      .prepare(
        `SELECT 
           ad.key,
           ad.label,
           ad.key IN (SELECT DISTINCT attribute_key FROM character_attributes WHERE value = 1) as is_used,
           (SELECT COUNT(*) FROM character_attributes ca WHERE ca.attribute_key = ad.key AND ca.value = 1) as true_count,
           (SELECT COUNT(DISTINCT character_id) FROM character_attributes) as total_chars
         FROM attribute_definitions ad
         WHERE ad.key IN (${attributeKeys.map(() => "?").join(",")})`,
      )
      .bind(...attributeKeys)
      .all<{
        key: string;
        label: string;
        is_used: boolean | number;
        true_count: number;
        total_chars: number;
      }>();

    const stats = new Map<string, AttributeStats>();
    for (const row of statsResults.results ?? []) {
      const frequency =
        row.total_chars > 0
          ? Math.round((row.true_count / row.total_chars) * 100)
          : 0;
      // Simple heuristic: attributes used by 10-50% of characters tend to be most discriminative
      // (too rare = not useful, too common = not discriminative)
      const discriminativeValue =
        frequency >= 10 && frequency <= 50 ? 100 : Math.abs(30 - frequency);

      stats.set(row.key, {
        attributeKey: row.key,
        label: row.label,
        frequency,
        averageDiscriminativeValue: Math.round(discriminativeValue),
      });
    }

    // Cache the result for 30 minutes
    if (stats.size > 0) {
      try {
        await d1CachePut(db, cacheKey, Array.from(stats.entries()), 1800);
      } catch {
        // If cache write fails, continue without caching
      }
    }

    return stats;
  } catch (err) {
    // Gracefully handle DB errors — fall back to non-live-data mode
    console.error("Failed to fetch attribute stats:", err);
    return new Map();
  }
}

/**
 * Fetch the most popular characters from the same category.
 * Checks D1 kv_cache first (15-minute TTL), then queries DB, then caches result.
 * Includes their top attributes for reference/grounding.
 */
async function fetchPopularCharactersInCategory(
  db: D1Database,
  category: string,
  limit: number = 5,
): Promise<PopularCharacterExample[]> {
  if (!db || !category) return [];

  const cacheKey = getPopularCharactersCacheKey(category);

  // Try D1 kv_cache first
  try {
    const cached = await d1CacheGet<PopularCharacterExample[]>(db, cacheKey);
    if (cached) return cached;
  } catch {
    // If cache read fails, fall through to DB query
  }

  try {
    const charResults = await db
      .prepare(
        `SELECT c.id, c.name, c.popularity
         FROM characters c
         WHERE c.category = ?
         ORDER BY c.popularity DESC
         LIMIT ?`,
      )
      .bind(category, limit)
      .all<{ id: string; name: string; popularity: number }>();

    const examples: PopularCharacterExample[] = [];
    for (const char of charResults.results ?? []) {
      const attrResults = await db
        .prepare(
          `SELECT ca.attribute_key
           FROM character_attributes ca
           WHERE ca.character_id = ? AND ca.value = 1
           ORDER BY ca.attribute_key ASC
           LIMIT 10`,
        )
        .bind(char.id)
        .all<{ attribute_key: string }>();

      examples.push({
        name: char.name,
        attributes: attrResults.results?.map((r) => r.attribute_key) ?? [],
        popularity: char.popularity,
      });
    }

    // Cache the result for 15 minutes
    if (examples.length > 0) {
      try {
        await d1CachePut(db, cacheKey, examples, 900);
      } catch {
        // If cache write fails, continue without caching
      }
    }

    return examples;
  } catch (err) {
    // Gracefully handle DB errors
    console.error("Failed to fetch popular characters:", err);
    return [];
  }
}

/**
 * Build attribute statistics section for the prompt.
 * Shows attribute frequency and strategic value to the LLM.
 */
function buildStatsContext(
  stats: Map<string, AttributeStats>,
  availableAttributes: Array<{ key: string; label: string }>,
): string {
  const statsLines = availableAttributes
    .map(({ key, label }) => {
      const stat = stats.get(key);
      if (!stat) return null;
      return `  - ${label} (${key}): used by ${stat.frequency}% of characters, strategic value: ${stat.averageDiscriminativeValue}/100`;
    })
    .filter(Boolean)
    .slice(0, 50);

  if (statsLines.length === 0) return "";

  return `\nATTRIBUTE STATISTICS (from database):
${statsLines.join("\n")}

Prioritize recommendations with 10-50% frequency — these tend to be most discriminative in the guessing game.`;
}

/**
 * Build popular character examples section for the prompt.
 * Shows top popular characters from the same category and their key attributes.
 * Gives the LLM concrete reference points for recommendations.
 */
function buildPopularCharacterContext(
  examples: PopularCharacterExample[],
  characterName: string = "",
): string {
  if (examples.length === 0) return "";

  const exampleLines = examples.map((ex) => {
    const attrDisplay =
      ex.attributes.length > 0
        ? `\n        Attributes: ${ex.attributes.join(", ")}`
        : "";
    return `  - ${ex.name} (popularity: ${(ex.popularity * 100).toFixed(0)}%)${attrDisplay}`;
  });

  const charRef = characterName ? ` for ${characterName}` : "";
  return `\nPOPULAR CHARACTER EXAMPLES (from same category):
${exampleLines.join("\n")}

Use these as reference points — look for patterns in their attributes and recommend similar traits${charRef}.`;
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { env, request } = context;
  const requestId = getRequestId(request);
  const actorId = getActorId(request);
  const path = new URL(request.url).pathname;

  const respond = (response: Response): Response =>
    withRequestId(response, requestId);

  const rate = await checkRateLimitBestEffort(
    env,
    actorId,
    "admin.recommender",
    60,
  );
  if (!rate.allowed) return respond(errorResponse("Rate limit exceeded", 429));

  if (!env.OPENAI_API_KEY)
    return respond(errorResponse("OpenAI not configured", 503));

  const parsed = await parseJsonBodyWithSchema(request, BodySchema);
  if (!parsed.success) return respond(parsed.response);

  const {
    characterName,
    category,
    existingAttributes,
    availableAttributes,
    maxRecommendations = 10,
    focusDescription,
  } = parsed.data;

  if (availableAttributes.length === 0) {
    return respond(jsonResponse({ recommendations: [] }));
  }

  // Fetch live attribute statistics and popular characters in parallel
  const db = env.GUESS_DB;
  const attributeKeys = availableAttributes.map((a) => a.key);
  const [liveStats, popularChars] = await Promise.all([
    db
      ? fetchAttributeStats(db, attributeKeys)
      : Promise.resolve(new Map()),
    db && category
      ? fetchPopularCharactersInCategory(db, category, 5)
      : Promise.resolve([]),
  ]);

  // Pre-filter attributes: remove those with <2% or >95% frequency (poor discriminative value)
  const filteredAvailableAttributes = filterAttributesByDiscriminativeValue(
    liveStats,
    availableAttributes,
  );

  // Decide which model to use based on character complexity
  const useMinModel = shouldUseMiniModel(
    existingAttributes,
    filteredAvailableAttributes,
    focusDescription,
  );
  const selectedModel = useMinModel ? "gpt-4o-mini" : "gpt-4o";

  const existingAttrDisplay = Object.entries(existingAttributes)
    .slice(0, 300)
    .map(([key, value]) => {
      const valueStr =
        value === true ? "YES" : value === false ? "NO" : "MAYBE";
      return `  - ${key}: ${valueStr}`;
    })
    .join("\n");

  const availableAttrDisplay = filteredAvailableAttributes
    .map(({ key, label }) => `  - ${label} (${key})`)
    .join("\n");

  const statsContext = buildStatsContext(
    liveStats,
    filteredAvailableAttributes,
  );
  const popularContext = buildPopularCharacterContext(
    popularChars,
    characterName,
  );

  const prompt = `You are an expert character analyst for a character guessing game.

CHARACTER:
${characterName}

CURRENT ATTRIBUTES:
${existingAttrDisplay || "  (none)"}

AVAILABLE ATTRIBUTES TO CHOOSE FROM:
${availableAttrDisplay}${statsContext}${popularContext}

FOCUS:
${focusDescription ?? "General character traits with high strategic value in a guessing game"}

TASK:
Recommend up to ${maxRecommendations} attributes that should be added for this character.

REQUIREMENTS:
1. Accuracy first: only recommend attributes likely true for this character.
2. Prioritize discrimination value for a guessing game (use the strategic value scores above).
3. Provide specific, character-aware reasons.
4. Return a mix of high/medium/low priorities when appropriate.
5. Prefer attributes in the 10-50% frequency range when possible — these are most useful.
6. If popular character examples are provided, use them as reference for similar-category traits.

Return ONLY JSON in this shape:
{
  "recommendations": [
    {
      "attribute": "attribute_key",
      "label": "Human Readable Label",
      "reason": "Specific explanation",
      "priority": "high" | "medium" | "low"
    }
  ]
}`;

  try {
    const response = await fetch(getCompletionsEndpoint(env), {
      method: "POST",
      headers: getLlmHeaders(env),
      body: JSON.stringify({
        model: selectedModel,
        messages: [{ role: "user", content: prompt }],
        temperature: 0.3,
        max_tokens: 900,
        response_format: { type: "json_object" },
      }),
    });

    if (!response.ok) {
      context.waitUntil(
        logError(
          env,
          "admin.recommender",
          "error",
          `OpenAI error ${response.status}`,
          undefined,
          {
            requestId,
            actorId,
            path,
            method: request.method,
            status: response.status,
          },
        ),
      );
      return respond(errorResponse(`OpenAI error: ${response.status}`, 502));
    }

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = data.choices?.[0]?.message?.content ?? "{}";
    const json = JSON.parse(content) as { recommendations?: unknown[] };
    const safe = z
      .array(RecommendationSchema)
      .safeParse(json.recommendations ?? []);

    const recommendations: Recommendation[] = safe.success
      ? safe.data.slice(0, maxRecommendations)
      : [];

    return respond(jsonResponse({ recommendations }));
  } catch (err) {
    context.waitUntil(
      logError(
        env,
        "admin.recommender",
        "error",
        "Recommender request failed",
        err,
        { requestId, actorId, path, method: request.method },
      ),
    );
    return respond(
      errorResponse(
        `Recommendation failed: ${err instanceof Error ? err.message : "Unknown error"}`,
        500,
      ),
    );
  }
};
