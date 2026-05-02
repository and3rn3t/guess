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

const QuestionSchema = z.object({
  id: z.string().min(1).max(120),
  text: z.string().min(1).max(500),
  attribute: z.string().min(1).max(120),
});

const BodySchema = z.object({
  questions: z.array(QuestionSchema).min(1).max(25),
});

const ScoreSchema = z.object({
  questionId: z.string().min(1),
  clarity: z.number().int().min(1).max(5),
  power: z.number().int().min(1).max(5),
  grammar: z.number().int().min(1).max(5),
  rewrite: z.string().min(1).max(500).optional(),
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
    "admin.hygiene.questions",
    60,
  );
  if (!rate.allowed) return respond(errorResponse("Rate limit exceeded", 429));

  if (!env.OPENAI_API_KEY)
    return respond(errorResponse("OpenAI not configured", 503));

  const parsed = await parseJsonBodyWithSchema(request, BodySchema);
  if (!parsed.success) return respond(parsed.response);

  const { questions } = parsed.data;
  const idSet = new Set(questions.map((q) => q.id));
  const questionList = questions
    .map((q) => `- [${q.id}] "${q.text}" (attribute: ${q.attribute})`)
    .join("\n");

  const prompt = `Rate these yes/no questions for a character guessing game on three dimensions (1-5 each):
- Clarity: Is the question unambiguous?
- Discriminative power: Does it effectively split the character space?
- Grammar/naturalness: Does it sound natural?

If any score < 3, suggest a rewrite.

Questions:
${questionList}

Return ONLY JSON in this exact shape:
{
  "scores": [
    {
      "questionId": "id",
      "clarity": 1,
      "power": 1,
      "grammar": 1,
      "rewrite": "Optional improved text"
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
        max_tokens: 900,
        response_format: { type: "json_object" },
      }),
    });

    if (!response.ok) {
      context.waitUntil(
        logError(
          env.GUESS_DB,
          "admin.hygiene.questions",
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
    const json = JSON.parse(content) as { scores?: unknown[] };

    const safe = z.array(ScoreSchema).safeParse(json.scores ?? []);
    if (!safe.success) return respond(jsonResponse({ scores: [] }));

    const scores = safe.data
      .filter((score) => idSet.has(score.questionId))
      .slice(0, questions.length);

    return respond(jsonResponse({ scores }));
  } catch (err) {
    context.waitUntil(
      logError(
        env.GUESS_DB,
        "admin.hygiene.questions",
        "error",
        "Question scoring request failed",
        err,
        { requestId, actorId, path, method: request.method },
      ),
    );
    return respond(
      errorResponse(
        `Question scoring failed: ${err instanceof Error ? err.message : "Unknown error"}`,
        500,
      ),
    );
  }
};
