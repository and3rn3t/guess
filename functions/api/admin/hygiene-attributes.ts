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

const AttributeValueSchema = z.union([z.boolean(), z.null()]);

const BodySchema = z.object({
  characterId: z.string().min(1).max(120),
  characterName: z.string().min(1).max(120),
  attributes: z.record(z.string(), AttributeValueSchema),
});

const IssueSchema = z.object({
  attribute: z.string().min(1),
  currentValue: AttributeValueSchema,
  suggestedValue: AttributeValueSchema,
  reason: z.string().min(1).max(500),
  type: z
    .enum(["contradiction", "likely-incorrect", "missing-critical"])
    .optional(),
});

type HygieneIssue = {
  characterId: string;
  characterName: string;
  type: "contradiction" | "likely-incorrect" | "missing-critical";
  attribute: string;
  currentValue: boolean | null;
  suggestedValue: boolean | null;
  reason: string;
};

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
    "admin.hygiene.attributes",
    60,
  );
  if (!rate.allowed) return respond(errorResponse("Rate limit exceeded", 429));

  if (!env.OPENAI_API_KEY)
    return respond(errorResponse("OpenAI not configured", 503));

  const parsed = await parseJsonBodyWithSchema(request, BodySchema);
  if (!parsed.success) return respond(parsed.response);

  const { characterId, characterName, attributes } = parsed.data;
  const knownKeys = new Set(Object.keys(attributes));

  const attributeDisplay = Object.entries(attributes)
    .slice(0, 500)
    .map(([key, value]) => {
      let valueStr = "UNKNOWN";
      if (value === true) valueStr = "YES";
      if (value === false) valueStr = "NO";
      return `- ${key}: ${valueStr}`;
    })
    .join("\n");

  const prompt = `You are auditing attributes for a character guessing game.

Character: ${characterName}
Character ID: ${characterId}

Current attributes:
${attributeDisplay || "- (none)"}

Task:
Find only high-confidence attribute fixes. Keep output concise.

Rules:
1) Use only attribute keys already present in the input.
2) Suggest value changes only when confidence is high.
3) Prefer returning no issues over low-confidence guesses.
4) "currentValue" and "suggestedValue" must be true, false, or null.

Return ONLY JSON in this exact shape:
{
  "issues": [
    {
      "attribute": "attributeKey",
      "currentValue": true,
      "suggestedValue": false,
      "reason": "Short reason",
      "type": "likely-incorrect"
    }
  ]
}`;

  try {
    const response = await fetch(getCompletionsEndpoint(env), {
      method: "POST",
      headers: getLlmHeaders(env),
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.2,
        max_tokens: 700,
        response_format: { type: "json_object" },
      }),
    });

    if (!response.ok) {
      context.waitUntil(
        logError(
          env.GUESS_DB,
          "admin.hygiene.attributes",
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
    const json = JSON.parse(content) as { issues?: unknown[] };

    const safe = z.array(IssueSchema).safeParse(json.issues ?? []);
    if (!safe.success) {
      return respond(jsonResponse({ issues: [] }));
    }

    const issues: HygieneIssue[] = safe.data
      .filter((issue) => knownKeys.has(issue.attribute))
      .filter((issue) => issue.currentValue !== issue.suggestedValue)
      .slice(0, 20)
      .map((issue) => ({
        characterId,
        characterName,
        type: issue.type ?? "likely-incorrect",
        attribute: issue.attribute,
        currentValue: issue.currentValue,
        suggestedValue: issue.suggestedValue,
        reason: issue.reason,
      }));

    return respond(jsonResponse({ issues }));
  } catch (err) {
    context.waitUntil(
      logError(
        env.GUESS_DB,
        "admin.hygiene.attributes",
        "error",
        "Attribute hygiene request failed",
        err,
        { requestId, actorId, path, method: request.method },
      ),
    );
    return respond(
      errorResponse(
        `Hygiene analysis failed: ${err instanceof Error ? err.message : "Unknown error"}`,
        500,
      ),
    );
  }
};
