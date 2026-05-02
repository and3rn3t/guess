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
import { z } from "zod";

const BodySchema = z.object({
  a: z.object({
    id: z.string().min(1).max(120),
    name: z.string().min(1).max(200),
  }),
  b: z.object({
    id: z.string().min(1).max(120),
    name: z.string().min(1).max(200),
  }),
});

const ResultSchema = z.object({
  isDuplicate: z.boolean(),
  canonicalId: z.string().min(1).optional(),
  reason: z.string().min(1).max(500).optional(),
});

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
    "admin.hygiene.duplicates",
    90,
  );
  if (!rate.allowed) return respond(errorResponse("Rate limit exceeded", 429));

  if (!env.OPENAI_API_KEY)
    return respond(errorResponse("OpenAI not configured", 503));

  const parsed = await parseJsonBodyWithSchema(request, BodySchema);
  if (!parsed.success) return respond(parsed.response);

  const { a, b } = parsed.data;
  if (a.id === b.id) {
    return respond(jsonResponse({ isDuplicate: false }));
  }

  const prompt = `You are resolving possible duplicate character records.

Record A:
- id: ${a.id}
- name: ${a.name}

Record B:
- id: ${b.id}
- name: ${b.name}

Task:
Decide if A and B refer to the same character entity.

Rules:
1) If uncertain, return isDuplicate=false.
2) canonicalId must be either "${a.id}" or "${b.id}" when isDuplicate=true.
3) Keep reason short.

Return ONLY JSON in this exact shape:
{
  "isDuplicate": true,
  "canonicalId": "${a.id}",
  "reason": "Short reason"
}`;

  try {
    const response = await fetch(getCompletionsEndpoint(env), {
      method: "POST",
      headers: getLlmHeaders(env),
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [{ role: "user", content: prompt }],
        temperature: 0,
        max_tokens: 200,
        response_format: { type: "json_object" },
      }),
    });

    if (!response.ok) {
      context.waitUntil(
        logError(
          env.GUESS_DB,
          "admin.hygiene.duplicates",
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

    const data: { choices?: Array<{ message?: { content?: string } }> } =
      await response.json();
    const content = data.choices?.[0]?.message?.content ?? "{}";
    const json = JSON.parse(content) as unknown;
    const safe = ResultSchema.safeParse(json);

    if (!safe.success) {
      return respond(jsonResponse({ isDuplicate: false }));
    }

    if (!safe.data.isDuplicate) {
      return respond(jsonResponse({ isDuplicate: false }));
    }

    const canonicalId = safe.data.canonicalId;
    if (canonicalId !== a.id && canonicalId !== b.id) {
      return respond(jsonResponse({ isDuplicate: false }));
    }

    return respond(
      jsonResponse({
        isDuplicate: true,
        canonicalId,
        reason: safe.data.reason ?? "Likely same entity",
      }),
    );
  } catch (err) {
    context.waitUntil(
      logError(
        env.GUESS_DB,
        "admin.hygiene.duplicates",
        "error",
        "Duplicate analysis request failed",
        err,
        { requestId, actorId, path, method: request.method },
      ),
    );
    return respond(
      errorResponse(
        `Duplicate analysis failed: ${err instanceof Error ? err.message : "Unknown error"}`,
        500,
      ),
    );
  }
};
