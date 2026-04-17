import {
  checkRateLimit,
  type Env,
  getUserId,
  kvGetObject,
  kvPut,
  sanitizeString,
} from "./_helpers";

const MAX_PROMPT_LENGTH = 50_000;
const ALLOWED_MODELS = ["gpt-4o", "gpt-4o-mini"];
const MAX_RETRIES = 2;
const RETRY_DELAYS = [1000, 3000];
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

interface CachedResponse {
  content: string;
  cachedAt: number;
}

interface CostRecord {
  promptTokens: number;
  completionTokens: number;
  calls: number;
}

/** Simple string hash for cache keys */
function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.codePointAt(i) ?? 0;
    hash = (hash << 5) - hash + char;
    hash = Math.trunc(hash);
  }
  return "cache:llm:" + Math.abs(hash).toString(36);
}

/** Sleep utility for retry delays */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Call OpenAI with retries on transient errors */
async function callOpenAIWithRetry(
  apiKey: string,
  openaiBody: Record<string, unknown>,
): Promise<Response> {
  let lastResponse: Response | null = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(openaiBody),
    });

    if (response.ok) return response;

    lastResponse = response;
    const retryable = [429, 500, 503].includes(response.status);
    if (!retryable || attempt === MAX_RETRIES) break;

    await sleep(RETRY_DELAYS[attempt]);
  }

  // unreachable: loop always runs at least once
  if (!lastResponse) throw new Error("No response from OpenAI");
  return lastResponse;
}

/** Validate request body fields, returning an error Response or null if valid */
function validateBody(body: {
  prompt?: string;
  model?: string;
}): Response | null {
  const { prompt, model } = body;
  if (!prompt || typeof prompt !== "string") {
    return Response.json(
      { error: 'Missing or invalid "prompt"' },
      { status: 400 },
    );
  }
  if (!model || typeof model !== "string") {
    return Response.json(
      { error: 'Missing or invalid "model"' },
      { status: 400 },
    );
  }
  if (prompt.length > MAX_PROMPT_LENGTH) {
    return Response.json(
      { error: `Prompt exceeds max length of ${MAX_PROMPT_LENGTH}` },
      { status: 400 },
    );
  }
  if (!ALLOWED_MODELS.includes(model)) {
    return Response.json(
      { error: `Model must be one of: ${ALLOWED_MODELS.join(", ")}` },
      { status: 400 },
    );
  }
  return null;
}

/** Track token usage costs in KV */
async function trackTokenUsage(
  kv: KVNamespace,
  userId: string,
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  },
): Promise<void> {
  const dateKey = new Date().toISOString().slice(0, 10);
  const costKey = `costs:${userId}:${dateKey}`;
  const existing = (await kvGetObject<CostRecord>(kv, costKey)) || {
    promptTokens: 0,
    completionTokens: 0,
    calls: 0,
  };
  existing.promptTokens += usage.prompt_tokens;
  existing.completionTokens += usage.completion_tokens;
  existing.calls++;
  await kvPut(kv, costKey, existing);
}

/** Check per-user rate limit, returning 429 Response or null */
async function enforceRateLimit(
  kv: KVNamespace,
  request: Request,
): Promise<Response | null> {
  const userId = getUserId(request);
  const { allowed } = await checkRateLimit(kv, userId, "llm", 60);
  if (!allowed) {
    return Response.json(
      { error: "Rate limit exceeded", retryAfter: 3600 },
      {
        status: 429,
        headers: { "Retry-After": "3600", "X-RateLimit-Remaining": "0" },
      },
    );
  }
  return null;
}

/** Check KV cache, returning cached Response or null */
async function checkCache(
  kv: KVNamespace,
  cacheKey: string,
): Promise<Response | null> {
  const cached = await kvGetObject<CachedResponse>(kv, cacheKey);
  if (cached && Date.now() - cached.cachedAt < CACHE_TTL) {
    return new Response(cached.content, {
      headers: { "Content-Type": "text/plain", "X-Cache": "HIT" },
    });
  }
  return null;
}

/** Build the OpenAI request payload */
function buildOpenAIPayload(
  model: string,
  prompt: string,
  systemPrompt: string | undefined,
  jsonMode: boolean | undefined,
): Record<string, unknown> {
  const messages: Array<{ role: string; content: string }> = [];
  if (systemPrompt) {
    messages.push({ role: "system", content: sanitizeString(systemPrompt) });
  }
  messages.push({ role: "user", content: prompt });

  const body: Record<string, unknown> = { model, messages };
  if (jsonMode) {
    body.response_format = { type: "json_object" };
  }
  return body;
}

/** Process successful OpenAI response: cache + track tokens + return */
async function processSuccess(
  data: {
    choices: Array<{ message: { content: string } }>;
    usage?: {
      prompt_tokens: number;
      completion_tokens: number;
      total_tokens: number;
    };
  },
  kv: KVNamespace | undefined,
  cacheKey: string,
  request: Request,
): Promise<Response> {
  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    return Response.json(
      { error: "Empty response from LLM" },
      { status: 502 },
    );
  }

  if (kv) {
    await kvPut(kv, cacheKey, {
      content,
      cachedAt: Date.now(),
    } satisfies CachedResponse).catch(() => {});
  }

  const responseHeaders: Record<string, string> = {
    "Content-Type": "text/plain",
    "X-Cache": "MISS",
  };

  if (data.usage) {
    responseHeaders["X-Token-Usage"] = JSON.stringify(data.usage);
    if (kv) {
      await trackTokenUsage(kv, getUserId(request), data.usage).catch(
        () => {},
      );
    }
  }

  return new Response(content, { headers: responseHeaders });
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const apiKey = context.env.OPENAI_API_KEY;
  if (!apiKey) {
    return Response.json(
      { error: "LLM not configured", code: "NO_API_KEY" },
      { status: 500 },
    );
  }

  const kv = context.env.GUESS_KV;

  // Parse body
  let body: {
    prompt?: string;
    model?: string;
    jsonMode?: boolean;
    systemPrompt?: string;
  };
  try {
    body = await context.request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const validationError = validateBody(body);
  if (validationError) return validationError;

  const { prompt, model, jsonMode, systemPrompt } = body as {
    prompt: string;
    model: string;
    jsonMode?: boolean;
    systemPrompt?: string;
  };

  // Rate limiting
  if (kv) {
    const rateLimited = await enforceRateLimit(kv, context.request);
    if (rateLimited) return rateLimited;
  }

  // Check cache
  const cacheKey = simpleHash(
    `${model}:${systemPrompt || ""}:${prompt}:${jsonMode}`,
  );
  if (kv) {
    const cacheHit = await checkCache(kv, cacheKey);
    if (cacheHit) return cacheHit;
  }

  // Build request & call OpenAI
  const openaiBody = buildOpenAIPayload(model, prompt, systemPrompt, jsonMode);

  try {
    const openaiResponse = await callOpenAIWithRetry(apiKey, openaiBody);

    if (!openaiResponse.ok) {
      const errorText = await openaiResponse
        .text()
        .catch(() => "Unknown error");
      console.error("OpenAI API error:", openaiResponse.status, errorText);
      return Response.json({ error: "LLM provider error" }, { status: 502 });
    }

    const data: {
      choices: Array<{ message: { content: string } }>;
      usage?: {
        prompt_tokens: number;
        completion_tokens: number;
        total_tokens: number;
      };
    } = await openaiResponse.json();

    return processSuccess(data, kv, cacheKey, context.request);
  } catch (error) {
    console.error("LLM proxy error:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
};
