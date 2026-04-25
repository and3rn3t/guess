import {
  checkRateLimit,
  type Env,
  getCompletionsEndpoint,
  getLlmHeaders,
  getOrCreateUserId,
  getUserId,
  kvGetObject,
  kvPut,
  sanitizeString,
  logError,
} from "./_helpers";

const MAX_PROMPT_LENGTH = 50_000;
const ALLOWED_MODELS = ["gpt-4o", "gpt-4o-mini"];
const MAX_RETRIES = 2;
const RETRY_DELAYS = [1000, 3000];
const CACHE_MAX_AGE = 86400; // 24 hours (seconds)

interface CostRecord {
  promptTokens: number;
  completionTokens: number;
  calls: number;
}

/** SHA-256 hash for cache keys */
async function sha256CacheKey(str: string): Promise<string> {
  const encoded = new TextEncoder().encode(str);
  const hashBuffer = await crypto.subtle.digest("SHA-256", encoded);
  const hex = Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return "cache:llm:" + hex;
}

/** Sleep utility for retry delays */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Call OpenAI with retries on transient errors */
async function callOpenAIWithRetry(
  endpoint: string,
  headers: Record<string, string>,
  openaiBody: Record<string, unknown>,
): Promise<Response> {
  let lastResponse: Response | null = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const response = await fetch(endpoint, {
      method: "POST",
      headers,
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

/** Check per-user rate limit using cookie-based user ID, returning 429 Response or null */
async function enforceRateLimit(
  kv: KVNamespace,
  request: Request,
  env: Env,
): Promise<Response | null> {
  const { userId, setCookieHeader } = await getOrCreateUserId(request, env);
  const { allowed } = await checkRateLimit(kv, userId, "llm", 60);
  if (!allowed) {
    const headers: Record<string, string> = {
      "Retry-After": "3600",
      "X-RateLimit-Remaining": "0",
    };
    if (setCookieHeader) headers["Set-Cookie"] = setCookieHeader;
    return Response.json(
      { error: "Rate limit exceeded", retryAfter: 3600 },
      { status: 429, headers },
    );
  }
  return null;
}

/** Check Cloudflare edge cache, returning cached Response or null */
async function checkEdgeCache(
  cacheKey: string,
  requestUrl: string,
): Promise<Response | null> {
  const cache = caches.default;
  const cacheUrl = new URL(`/cache/${cacheKey}`, requestUrl).toString();
  const cached = await cache.match(new Request(cacheUrl));
  if (!cached) return null;
  const body = await cached.text();
  return new Response(body, {
    headers: { "Content-Type": "text/plain", "X-Cache": "HIT" },
  });
}

/** Write response to Cloudflare edge cache */
async function putEdgeCache(
  cacheKey: string,
  requestUrl: string,
  content: string,
): Promise<void> {
  const cache = caches.default;
  const cacheUrl = new URL(`/cache/${cacheKey}`, requestUrl).toString();
  const response = new Response(content, {
    headers: {
      "Content-Type": "text/plain",
      "Cache-Control": `public, max-age=${CACHE_MAX_AGE}`,
    },
  });
  await cache.put(new Request(cacheUrl), response);
}

/** Build the OpenAI request payload */
function buildOpenAIPayload(
  model: string,
  prompt: string,
  systemPrompt: string | undefined,
  jsonMode: boolean | undefined,
  jsonSchema: Record<string, unknown> | undefined,
): Record<string, unknown> {
  const messages: Array<{ role: string; content: string }> = [];
  if (systemPrompt) {
    messages.push({ role: "system", content: sanitizeString(systemPrompt) });
  }
  messages.push({ role: "user", content: prompt });

  const body: Record<string, unknown> = { model, messages };
  if (jsonSchema) {
    // Structured Outputs (stricter than json_object — guaranteed schema conformance)
    body.response_format = {
      type: "json_schema",
      json_schema: jsonSchema,
    };
  } else if (jsonMode) {
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
      { error: "Empty response from LLM", code: "EMPTY_RESPONSE" },
      { status: 502 },
    );
  }

  // Cache at the edge (non-blocking)
  putEdgeCache(cacheKey, request.url, content).catch(() => {});

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
    jsonSchema?: Record<string, unknown>;
    systemPrompt?: string;
  };
  try {
    body = await context.request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const validationError = validateBody(body);
  if (validationError) return validationError;

  const { prompt, model, jsonMode, jsonSchema, systemPrompt } = body as {
    prompt: string;
    model: string;
    jsonMode?: boolean;
    jsonSchema?: Record<string, unknown>;
    systemPrompt?: string;
  };

  // Rate limiting
  if (kv) {
    const rateLimited = await enforceRateLimit(kv, context.request, context.env);
    if (rateLimited) return rateLimited;
  }

  // Check edge cache
  const cacheKey = await sha256CacheKey(
    `${model}:${systemPrompt || ""}:${prompt}:${jsonMode}:${jsonSchema ? JSON.stringify(jsonSchema) : ""}`,
  );
  const cacheHit = await checkEdgeCache(
    cacheKey,
    context.request.url,
  ).catch(() => null);
  if (cacheHit) return cacheHit;

  // Build request & call OpenAI (via AI Gateway if configured)
  const endpoint = getCompletionsEndpoint(context.env);
  const headers = getLlmHeaders(context.env);
  const openaiBody = buildOpenAIPayload(model, prompt, systemPrompt, jsonMode, jsonSchema);

  try {
    const openaiResponse = await callOpenAIWithRetry(endpoint, headers, openaiBody);

    if (!openaiResponse.ok) {
      const errorText = await openaiResponse
        .text()
        .catch(() => "Unknown error");
      console.error("OpenAI API error:", openaiResponse.status, errorText);
      context.waitUntil(logError(context.env.GUESS_DB, 'llm', 'error', `OpenAI API error ${openaiResponse.status}`, errorText));

      // Surface specific error codes to the client
      if (openaiResponse.status === 429) {
        const isQuota = errorText.includes("insufficient_quota");
        return Response.json(
          {
            error: isQuota
              ? "API quota exceeded — please check billing"
              : "Rate limited by LLM provider",
            code: isQuota ? "QUOTA_EXCEEDED" : "RATE_LIMITED",
          },
          { status: 429 },
        );
      }

      return Response.json(
        { error: "LLM provider error", code: "PROVIDER_ERROR" },
        { status: 502 },
      );
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
    context.waitUntil(logError(context.env.GUESS_DB, 'llm', 'error', 'LLM proxy error', error));
    return Response.json(
      { error: "Internal server error", code: "INTERNAL" },
      { status: 500 },
    );
  }
};
