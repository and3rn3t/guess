import {
  checkRateLimitDO,
  type Env,
  getCompletionsEndpoint,
  getLlmHeaders,
  getOrCreateUserId,
  withSetCookie,
  sanitizeString,
  logError,
} from "./_helpers";
import { recordLLMUsage, type RetryOutcome } from "./_llm_metrics";

const MAX_PROMPT_LENGTH = 50_000;
const ALLOWED_MODELS = ["gpt-4o", "gpt-4o-mini"];

const MAX_RETRIES = 2;
const RETRY_DELAYS = [1000, 3000];
const CACHE_MAX_AGE = 86400; // 24 hours (seconds)
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

function classifyRetryStatus(status: number): Exclude<RetryOutcome, "none" | "mixed"> {
  if (status === 429) return "429";
  if (status >= 500 && status <= 599) return "5xx";
  return "other";
}

function mergeRetryOutcome(
  current: RetryOutcome,
  next: Exclude<RetryOutcome, "none" | "mixed">,
): RetryOutcome {
  if (current === "none") return next;
  if (current === next) return current;
  return "mixed";
}

/** Call OpenAI with retries on transient errors */
async function callOpenAIWithRetry(
  endpoint: string,
  headers: Record<string, string>,
  openaiBody: Record<string, unknown>,
): Promise<{ response: Response; retryCount: number; retryOutcome: RetryOutcome }> {
  let lastResponse: Response | null = null;
  let retryCount = 0;
  let retryOutcome: RetryOutcome = "none";

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const response = await fetch(endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify(openaiBody),
    });

    if (response.ok) return { response, retryCount, retryOutcome };

    lastResponse = response;
    const retryable = [429, 500, 503].includes(response.status);
    if (!retryable || attempt === MAX_RETRIES) break;

    retryCount += 1;
    retryOutcome = mergeRetryOutcome(retryOutcome, classifyRetryStatus(response.status));
    await sleep(RETRY_DELAYS[attempt]);
  }

  // unreachable: loop always runs at least once
  if (!lastResponse) throw new Error("No response from OpenAI");
  return { response: lastResponse, retryCount, retryOutcome };
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

/** Check per-user rate limit using cookie-based user ID, returning 429 Response or null */
async function enforceRateLimit(
  request: Request,
  env: Env,
): Promise<Response | null> {
  const { userId, setCookieHeader } = await getOrCreateUserId(request, env);
  const { allowed } = await checkRateLimitDO(env, userId, "llm", 60);
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
  const cache = (caches as unknown as { default: Cache }).default;
  const cacheUrl = new URL(`/cache/${cacheKey}`, requestUrl).toString();
  const cached = await cache.match(new Request(cacheUrl));
  if (!cached) return null;
  const body = await cached.text();
  return new Response(body, {
    headers: {
      "Content-Type": "text/plain",
      "X-Cache": "HIT",
      "X-LLM-Retry-Count": "0",
    },
  });
}

/** Write response to Cloudflare edge cache */
async function putEdgeCache(
  cacheKey: string,
  requestUrl: string,
  content: string,
): Promise<void> {
  const cache = (caches as unknown as { default: Cache }).default;
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

interface ProcessSuccessInput {
  data: {
    choices: Array<{ message: { content: string } }>;
    usage?: {
      prompt_tokens: number;
      completion_tokens: number;
      total_tokens: number;
    };
  };
  cacheKey: string;
  request: Request;
  env: Env;
  model: string;
  retryCount: number;
  retryOutcome: RetryOutcome;
}

/** Process successful OpenAI response: cache + track tokens + return */
async function processSuccess({
  data,
  cacheKey,
  request,
  env,
  model,
  retryCount,
  retryOutcome,
}: ProcessSuccessInput): Promise<Response> {
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
    "X-LLM-Retry-Count": String(retryCount),
  };

  // Resolve stable cookie-based user ID for analytics + Set-Cookie on response.
  const { userId, setCookieHeader } = await getOrCreateUserId(request, env);

  if (data.usage) {
    responseHeaders["X-Token-Usage"] = JSON.stringify(data.usage);
    // Analytics Engine is the source of truth for cost dashboards
    recordLLMUsage(env.LLM_COSTS, {
      model,
      userId,
      usage: data.usage,
      cacheStatus: "MISS",
      endpoint: "llm",
      retryCount,
      retryOutcome,
    });
  }

  return withSetCookie(new Response(content, { headers: responseHeaders }), setCookieHeader);
}

async function handleCacheHitResponse(
  cacheKey: string,
  request: Request,
  env: Env,
  model: string,
): Promise<Response | null> {
  const cacheHit = await checkEdgeCache(cacheKey, request.url).catch(() => null);
  if (!cacheHit) return null;

  // I.2: record HIT with zero tokens so HIT/MISS ratio is queryable in AE.
  const { userId: cachedUserId, setCookieHeader: cachedCookieHeader } =
    await getOrCreateUserId(request, env);
  recordLLMUsage(env.LLM_COSTS, {
    model,
    userId: cachedUserId,
    usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
    cacheStatus: "HIT",
    endpoint: "llm",
    retryCount: 0,
    retryOutcome: "none",
  });

  return withSetCookie(cacheHit, cachedCookieHeader);
}

async function recordProviderErrorUsage(
  request: Request,
  env: Env,
  model: string,
  retryCount: number,
  retryOutcome: RetryOutcome,
): Promise<void> {
  const { userId } = await getOrCreateUserId(request, env);
  recordLLMUsage(env.LLM_COSTS, {
    model,
    userId,
    usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
    cacheStatus: "MISS",
    endpoint: "llm",
    retryCount,
    retryOutcome,
  });
}

function buildProviderErrorResponse(status: number, errorText: string): Response {
  // Surface specific error codes to the client.
  if (status === 429) {
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

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const apiKey = context.env.OPENAI_API_KEY;
  if (!apiKey) {
    return Response.json(
      { error: "LLM not configured", code: "NO_API_KEY" },
      { status: 500 },
    );
  }

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
  const rateLimited = await enforceRateLimit(context.request, context.env);
  if (rateLimited) return rateLimited;

  // Check edge cache
  const cacheKey = await sha256CacheKey(
    `${model}:${systemPrompt || ""}:${prompt}:${jsonMode}:${jsonSchema ? JSON.stringify(jsonSchema) : ""}`,
  );
  const cacheHitResponse = await handleCacheHitResponse(cacheKey, context.request, context.env, model);
  if (cacheHitResponse) return cacheHitResponse;

  // Build request & call OpenAI (via AI Gateway if configured)
  const endpoint = getCompletionsEndpoint(context.env);
  // AI.1: ask the AI Gateway to also cache identical (model, prompt, jsonMode)
  // tuples upstream. Mirrors the 24h CACHE_MAX_AGE we already use at the CF
  // edge cache, so a cache-miss at the edge can still hit the gateway cache
  // instead of paying for an upstream model call.
  const headers = getLlmHeaders(context.env, CACHE_MAX_AGE);
  const openaiBody = buildOpenAIPayload(model, prompt, systemPrompt, jsonMode, jsonSchema);

  try {
    const { response: openaiResponse, retryCount, retryOutcome } = await callOpenAIWithRetry(endpoint, headers, openaiBody);

    if (!openaiResponse.ok) {
      const errorText = await openaiResponse
        .text()
        .catch(() => "Unknown error");
      console.error("OpenAI API error:", openaiResponse.status, errorText);
      context.waitUntil(logError(context.env.GUESS_DB, 'llm', 'error', `OpenAI API error ${openaiResponse.status}`, errorText));
      await recordProviderErrorUsage(
        context.request,
        context.env,
        model,
        retryCount,
        retryOutcome,
      ).catch(() => {});

      return buildProviderErrorResponse(openaiResponse.status, errorText);
    }

    const data: {
      choices: Array<{ message: { content: string } }>;
      usage?: {
        prompt_tokens: number;
        completion_tokens: number;
        total_tokens: number;
      };
    } = await openaiResponse.json();

    return processSuccess({
      data,
      cacheKey,
      request: context.request,
      env: context.env,
      model,
      retryCount,
      retryOutcome,
    });
  } catch (error) {
    console.error("LLM proxy error:", error);
    context.waitUntil(logError(context.env.GUESS_DB, 'llm', 'error', 'LLM proxy error', error));
    return Response.json(
      { error: "Internal server error", code: "INTERNAL" },
      { status: 500 },
    );
  }
};
