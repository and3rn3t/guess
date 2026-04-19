var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// api/_helpers.ts
var OPENAI_COMPLETIONS = "https://api.openai.com/v1/chat/completions";
function getCompletionsEndpoint(env) {
  return env.CLOUDFLARE_AI_GATEWAY || OPENAI_COMPLETIONS;
}
__name(getCompletionsEndpoint, "getCompletionsEndpoint");
function getLlmHeaders(env) {
  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${env.OPENAI_API_KEY}`
  };
  if (env.CLOUDFLARE_AI_GATEWAY && env.AI_GATEWAY_TOKEN) {
    headers["cf-aig-authorization"] = `Bearer ${env.AI_GATEWAY_TOKEN}`;
  }
  return headers;
}
__name(getLlmHeaders, "getLlmHeaders");
function sanitizeString(input) {
  return input.replace(/<[^>]*>/g, "").trim();
}
__name(sanitizeString, "sanitizeString");
function validateString(value, fieldName, minLength = 1, maxLength = 500) {
  if (!value || typeof value !== "string") {
    throw new ValidationError(`Missing or invalid "${fieldName}"`);
  }
  const sanitized = sanitizeString(value);
  if (sanitized.length < minLength) {
    throw new ValidationError(`"${fieldName}" must be at least ${minLength} characters`);
  }
  if (sanitized.length > maxLength) {
    throw new ValidationError(`"${fieldName}" must be at most ${maxLength} characters`);
  }
  return sanitized;
}
__name(validateString, "validateString");
var ValidationError = class extends Error {
  static {
    __name(this, "ValidationError");
  }
  constructor(message) {
    super(message);
    this.name = "ValidationError";
  }
};
async function checkRateLimit(kv, userId, action, maxPerHour) {
  const hour = Math.floor(Date.now() / 36e5);
  const key = `ratelimit:${action}:${userId}:${hour}`;
  const current = parseInt(await kv.get(key) || "0", 10);
  if (current >= maxPerHour) {
    return { allowed: false, remaining: 0 };
  }
  await kv.put(key, String(current + 1), { expirationTtl: 7200 });
  return { allowed: true, remaining: maxPerHour - current - 1 };
}
__name(checkRateLimit, "checkRateLimit");
function getUserId(request) {
  return request.headers.get("X-User-Id") || request.headers.get("CF-Connecting-IP") || "anonymous";
}
__name(getUserId, "getUserId");
async function parseJsonBody(request) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}
__name(parseJsonBody, "parseJsonBody");
function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}
__name(jsonResponse, "jsonResponse");
function errorResponse(message, status) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}
__name(errorResponse, "errorResponse");
async function kvGetArray(kv, key) {
  const raw = await kv.get(key);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
__name(kvGetArray, "kvGetArray");
async function kvGetObject(kv, key) {
  const raw = await kv.get(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}
__name(kvGetObject, "kvGetObject");
async function kvPut(kv, key, value) {
  await kv.put(key, JSON.stringify(value));
}
__name(kvPut, "kvPut");
var VALID_CATEGORIES = /* @__PURE__ */ new Set([
  "video-games",
  "movies",
  "anime",
  "comics",
  "books",
  "cartoons",
  "tv-shows",
  "pop-culture"
]);
function isValidCategory(value) {
  return typeof value === "string" && VALID_CATEGORIES.has(value);
}
__name(isValidCategory, "isValidCategory");
async function d1Query(db, sql, params = []) {
  const result = await db.prepare(sql).bind(...params).all();
  return result.results;
}
__name(d1Query, "d1Query");
async function d1Run(db, sql, params = []) {
  return db.prepare(sql).bind(...params).run();
}
__name(d1Run, "d1Run");
async function d1First(db, sql, params = []) {
  return db.prepare(sql).bind(...params).first();
}
__name(d1First, "d1First");
async function d1Batch(db, statements) {
  const prepared = statements.map(
    (s) => s.params ? db.prepare(s.sql).bind(...s.params) : db.prepare(s.sql)
  );
  return db.batch(prepared);
}
__name(d1Batch, "d1Batch");

// api/v2/_game-engine.ts
var SCORE_MATCH = 1;
var SCORE_MISMATCH = 0;
var SCORE_UNKNOWN = 0.5;
var SCORE_MAYBE = 0.7;
var SCORE_MAYBE_MISS = 0.3;
var POOL_SIZE = 500;
var MIN_ATTRIBUTES = 5;
var SESSION_TTL = 3600;
var DIFFICULTY_MAP = {
  easy: 20,
  medium: 15,
  hard: 10
};
var VALID_ANSWERS = /* @__PURE__ */ new Set(["yes", "no", "maybe", "unknown"]);
function scoreForAnswer(answerValue, characterValue) {
  if (answerValue === "yes") {
    if (characterValue === true) return SCORE_MATCH;
    if (characterValue === false) return SCORE_MISMATCH;
    return SCORE_UNKNOWN;
  }
  if (answerValue === "no") {
    if (characterValue === false) return SCORE_MATCH;
    if (characterValue === true) return SCORE_MISMATCH;
    return SCORE_UNKNOWN;
  }
  if (answerValue === "maybe") {
    if (characterValue === true) return SCORE_MAYBE;
    if (characterValue === false) return SCORE_MAYBE_MISS;
    return SCORE_UNKNOWN;
  }
  return 1;
}
__name(scoreForAnswer, "scoreForAnswer");
function calculateProbabilities(characters, answers) {
  const probabilities = /* @__PURE__ */ new Map();
  for (const character of characters) {
    let score = 1;
    for (const answer of answers) {
      const characterValue = character.attributes[answer.questionId];
      score *= scoreForAnswer(answer.value, characterValue);
    }
    probabilities.set(character.id, score);
  }
  const totalScore = Array.from(probabilities.values()).reduce((a, b) => a + b, 0);
  if (totalScore > 0) {
    for (const [id, score] of probabilities) {
      probabilities.set(id, score / totalScore);
    }
  }
  return probabilities;
}
__name(calculateProbabilities, "calculateProbabilities");
function entropy(probabilities) {
  return probabilities.reduce((sum, p) => {
    if (p <= 0) return sum;
    return sum - p * Math.log2(p);
  }, 0);
}
__name(entropy, "entropy");
function selectBestQuestion(characters, answers, allQuestions) {
  const askedAttributes = new Set(answers.map((a) => a.questionId));
  const availableQuestions = allQuestions.filter((q) => !askedAttributes.has(q.attribute));
  if (availableQuestions.length === 0) return null;
  const probs = calculateProbabilities(characters, answers);
  const sortedProbs = Array.from(probs.entries()).filter(([, p]) => p > 0).sort((a, b) => b[1] - a[1]);
  const topN = sortedProbs.slice(0, Math.min(5, sortedProbs.length));
  const topNMass = topN.reduce((sum, [, p]) => sum + p, 0);
  const topNChars = topN.map(([id]) => characters.find((c) => c.id === id)).filter(Boolean);
  let bestQuestion = null;
  let bestScore = -1;
  const currentProbs = characters.map((c) => probs.get(c.id) || 0);
  const currentEntropy = entropy(currentProbs);
  for (const question of availableQuestions) {
    let pYes = 0;
    let pNo = 0;
    const yesProbs = [];
    const noProbs = [];
    const unknownProbs = [];
    for (const c of characters) {
      const prob = probs.get(c.id) || 0;
      const attr = c.attributes[question.attribute];
      if (attr === true) {
        pYes += prob;
        yesProbs.push(prob);
      } else if (attr === false) {
        pNo += prob;
        noProbs.push(prob);
      } else {
        unknownProbs.push(prob);
      }
    }
    let expectedEntropy = 0;
    const pUnknown = unknownProbs.reduce((s, p) => s + p, 0);
    const yesTotal = pYes + pUnknown * 0.5;
    if (yesTotal > 0) {
      const yesGroupProbs = [
        ...yesProbs.map((p) => p / yesTotal),
        ...unknownProbs.map((p) => p * 0.5 / yesTotal)
      ];
      expectedEntropy += yesTotal * entropy(yesGroupProbs);
    }
    const noTotal = pNo + pUnknown * 0.5;
    if (noTotal > 0) {
      const noGroupProbs = [
        ...noProbs.map((p) => p / noTotal),
        ...unknownProbs.map((p) => p * 0.5 / noTotal)
      ];
      expectedEntropy += noTotal * entropy(noGroupProbs);
    }
    let infoGain = currentEntropy - expectedEntropy;
    const nullCount = characters.filter((c) => c.attributes[question.attribute] == null).length;
    const nullRatio = nullCount / characters.length;
    if (nullRatio > 0.6) {
      infoGain *= 1 - (nullRatio - 0.6);
    }
    if (topNMass > 0.6 && topNChars.length >= 2) {
      const topValues = new Set(topNChars.map((c) => c.attributes[question.attribute]));
      if (topValues.has(true) && topValues.has(false)) {
        infoGain *= 1 + 0.5 * topNMass;
      }
    }
    if (infoGain > bestScore) {
      bestScore = infoGain;
      bestQuestion = question;
    }
  }
  return bestQuestion;
}
__name(selectBestQuestion, "selectBestQuestion");
function generateReasoning(question, characters, answers) {
  const total = characters.length;
  const yesCount = characters.filter((c) => c.attributes[question.attribute] === true).length;
  const noCount = characters.filter((c) => c.attributes[question.attribute] === false).length;
  const probabilities = calculateProbabilities(characters, answers);
  const sorted = Array.from(probabilities.entries()).filter(([, p]) => p > 0).sort((a, b) => b[1] - a[1]);
  const topCharacter = sorted[0];
  const confidence = topCharacter ? topCharacter[1] * 100 : 0;
  const topCandidates = sorted.slice(0, 5).map(([id, p]) => {
    const char = characters.find((c) => c.id === id);
    return {
      name: char?.name ?? id,
      probability: Math.round(p * 100),
      imageUrl: char?.imageUrl ?? null
    };
  });
  const yesPercent = Math.round(yesCount / total * 100);
  const noPercent = Math.round(noCount / total * 100);
  let why;
  if (Math.abs(yesCount - noCount) < total * 0.2) {
    why = `This question splits the possibilities almost perfectly: ${yesPercent}% could answer "yes" while ${noPercent}% would say "no". This is an optimal binary split.`;
  } else if (yesCount < noCount) {
    why = `Only ${yesPercent}% of remaining possibilities have this trait. A "yes" answer dramatically narrows options.`;
  } else {
    why = `About ${yesPercent}% of remaining possibilities share this characteristic.`;
  }
  const eliminateYes = noCount;
  const eliminateNo = yesCount;
  const impact = `"Yes" eliminates ${eliminateYes} (${Math.round(eliminateYes / total * 100)}%), "No" eliminates ${eliminateNo} (${Math.round(eliminateNo / total * 100)}%).`;
  return { why, impact, remaining: total, confidence: Math.round(confidence), topCandidates };
}
__name(generateReasoning, "generateReasoning");
function shouldMakeGuess(characters, answers, questionCount, maxQuestions) {
  if (characters.length <= 1) return true;
  const probabilities = calculateProbabilities(characters, answers);
  const sorted = Array.from(probabilities.values()).sort((a, b) => b - a);
  const topProbability = sorted[0];
  if (questionCount >= maxQuestions) return true;
  if (topProbability > 0.8) return true;
  const aliveCount = sorted.filter((p) => p > 0).length;
  if (aliveCount <= 2 && questionCount >= 3 && topProbability >= 0.5) return true;
  const progress = questionCount / maxQuestions;
  if (progress >= 0.75 && topProbability > 0.45) return true;
  if (progress >= 0.5 && topProbability > 0.65) return true;
  const halfwayPoint = Math.floor(maxQuestions / 2);
  const secondProbability = sorted.length > 1 ? sorted[1] : 0;
  const gap = topProbability - secondProbability;
  if (questionCount >= halfwayPoint && gap > 0.3 && topProbability > 0.5) return true;
  return false;
}
__name(shouldMakeGuess, "shouldMakeGuess");
function getBestGuess(characters, answers) {
  if (characters.length === 0) return null;
  const probabilities = calculateProbabilities(characters, answers);
  const sorted = Array.from(probabilities.entries()).sort((a, b) => {
    if (b[1] !== a[1]) return b[1] - a[1];
    return a[0].localeCompare(b[0]);
  });
  const bestId = sorted[0][0];
  return characters.find((c) => c.id === bestId) || characters[0];
}
__name(getBestGuess, "getBestGuess");
function detectContradictions(characters, answers) {
  if (answers.length === 0) return { hasContradiction: false, remainingCount: characters.length };
  const probabilities = calculateProbabilities(characters, answers);
  const remaining = Array.from(probabilities.values()).filter((p) => p > 0).length;
  return { hasContradiction: remaining === 0, remainingCount: remaining };
}
__name(detectContradictions, "detectContradictions");
function filterPossibleCharacters(characters, answers) {
  return characters.filter((char) => {
    for (const answer of answers) {
      const attr = char.attributes[answer.questionId];
      if (answer.value === "yes" && attr === false) return false;
      if (answer.value === "no" && attr === true) return false;
    }
    return true;
  });
}
__name(filterPossibleCharacters, "filterPossibleCharacters");

// api/v2/game/answer.ts
var onRequestPost = /* @__PURE__ */ __name(async (context) => {
  const kv = context.env.GUESS_KV;
  if (!kv) return errorResponse("KV not configured", 503);
  const body = await parseJsonBody(context.request);
  if (!body?.sessionId || !body?.value || !VALID_ANSWERS.has(body.value)) {
    return errorResponse("Invalid request: sessionId and valid answer value required", 400);
  }
  const session = await kvGetObject(kv, `game:${body.sessionId}`);
  if (!session) {
    return errorResponse("Session not found or expired", 404);
  }
  if (!session.currentQuestion) {
    return errorResponse("No pending question to answer", 400);
  }
  const newAnswer = {
    questionId: session.currentQuestion.attribute,
    value: body.value
  };
  session.answers.push(newAnswer);
  const filtered = filterPossibleCharacters(session.characters, session.answers);
  const { hasContradiction } = detectContradictions(filtered, session.answers);
  if (hasContradiction) {
    session.answers.pop();
    await kv.put(`game:${session.id}`, JSON.stringify(session), { expirationTtl: SESSION_TTL });
    return jsonResponse({
      type: "contradiction",
      message: "Your answers seem contradictory \u2014 no characters match. Last answer was undone.",
      question: session.currentQuestion,
      reasoning: generateReasoning(session.currentQuestion, session.characters, session.answers),
      remaining: session.characters.length,
      questionCount: session.answers.length
    });
  }
  const questionCount = session.answers.length;
  if (shouldMakeGuess(filtered, session.answers, questionCount, session.maxQuestions)) {
    const guess = getBestGuess(filtered, session.answers);
    if (guess) {
      const probs = calculateProbabilities(filtered, session.answers);
      const confidence = Math.round((probs.get(guess.id) || 0) * 100);
      session.currentQuestion = null;
      await kv.put(`game:${session.id}`, JSON.stringify(session), { expirationTtl: SESSION_TTL });
      return jsonResponse({
        type: "guess",
        character: {
          id: guess.id,
          name: guess.name,
          category: guess.category,
          imageUrl: guess.imageUrl
        },
        confidence,
        questionCount,
        remaining: filtered.length
      });
    }
  }
  const nextQuestion = selectBestQuestion(filtered, session.answers, session.questions);
  if (!nextQuestion) {
    const guess = getBestGuess(filtered, session.answers);
    session.currentQuestion = null;
    await kv.put(`game:${session.id}`, JSON.stringify(session), { expirationTtl: SESSION_TTL });
    if (guess) {
      const probs = calculateProbabilities(filtered, session.answers);
      const confidence = Math.round((probs.get(guess.id) || 0) * 100);
      return jsonResponse({
        type: "guess",
        character: {
          id: guess.id,
          name: guess.name,
          category: guess.category,
          imageUrl: guess.imageUrl
        },
        confidence,
        questionCount,
        remaining: filtered.length
      });
    }
    return errorResponse("No questions or candidates available", 500);
  }
  const reasoning = generateReasoning(nextQuestion, filtered, session.answers);
  const previousFiltered = filterPossibleCharacters(
    session.characters,
    session.answers.slice(0, -1)
  );
  const eliminated = previousFiltered.length - filtered.length;
  session.currentQuestion = nextQuestion;
  await kv.put(`game:${session.id}`, JSON.stringify(session), { expirationTtl: SESSION_TTL });
  return jsonResponse({
    type: "question",
    question: nextQuestion,
    reasoning,
    remaining: filtered.length,
    eliminated,
    questionCount
  });
}, "onRequestPost");

// api/v2/game/result.ts
var onRequestPost2 = /* @__PURE__ */ __name(async (context) => {
  const kv = context.env.GUESS_KV;
  const db = context.env.GUESS_DB;
  if (!kv) return errorResponse("KV not configured", 503);
  const body = await parseJsonBody(context.request);
  if (!body?.sessionId || typeof body.correct !== "boolean") {
    return errorResponse("Invalid request: sessionId and correct required", 400);
  }
  const session = await kvGetObject(kv, `game:${body.sessionId}`);
  if (!session) {
    return errorResponse("Session not found or expired", 404);
  }
  const userId = getUserId(context.request);
  if (db) {
    try {
      await d1Run(
        db,
        `INSERT INTO game_stats (user_id, won, difficulty, questions_asked, character_pool_size, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          userId,
          body.correct ? 1 : 0,
          session.difficulty,
          session.answers.length,
          session.characters.length,
          Date.now()
        ]
      );
    } catch {
    }
  }
  await kv.delete(`game:${body.sessionId}`);
  return jsonResponse({
    success: true,
    summary: {
      won: body.correct,
      difficulty: session.difficulty,
      questionsAsked: session.answers.length,
      maxQuestions: session.maxQuestions,
      poolSize: session.characters.length
    }
  });
}, "onRequestPost");

// api/v2/game/resume.ts
var onRequestPost3 = /* @__PURE__ */ __name(async (context) => {
  const kv = context.env.GUESS_KV;
  if (!kv) return errorResponse("KV not configured", 503);
  const body = await parseJsonBody(context.request);
  if (!body?.sessionId || typeof body.sessionId !== "string") {
    return errorResponse("Missing sessionId", 400);
  }
  const session = await kvGetObject(kv, `game:${body.sessionId}`);
  if (!session) {
    return jsonResponse({ expired: true }, 200);
  }
  await kv.put(`game:${session.id}`, JSON.stringify(session), { expirationTtl: SESSION_TTL });
  const filtered = filterPossibleCharacters(session.characters, session.answers);
  const reasoning = session.currentQuestion ? generateReasoning(session.currentQuestion, filtered, session.answers) : null;
  return jsonResponse({
    expired: false,
    question: session.currentQuestion,
    reasoning,
    remaining: filtered.length,
    totalCharacters: session.characters.length,
    questionCount: session.answers.length,
    answers: session.answers.map((a) => ({
      questionId: a.questionId,
      value: a.value
    }))
  });
}, "onRequestPost");

// api/v2/game/start.ts
var onRequestPost4 = /* @__PURE__ */ __name(async (context) => {
  const db = context.env.GUESS_DB;
  const kv = context.env.GUESS_KV;
  if (!db || !kv) return errorResponse("D1/KV not configured", 503);
  const body = await parseJsonBody(context.request);
  const categories = body?.categories?.filter(isValidCategory) ?? [];
  const difficulty = body?.difficulty && body.difficulty in DIFFICULTY_MAP ? body.difficulty : "medium";
  const maxQuestions = DIFFICULTY_MAP[difficulty];
  const conditions = [];
  const params = [];
  if (categories.length > 0) {
    conditions.push(`c.category IN (${categories.map(() => "?").join(",")})`);
    params.push(...categories);
  }
  conditions.push(
    `c.id IN (SELECT character_id FROM character_attributes WHERE value IS NOT NULL GROUP BY character_id HAVING COUNT(*) >= ?)`
  );
  params.push(MIN_ATTRIBUTES);
  const where = `WHERE ${conditions.join(" AND ")}`;
  const candidateLimit = POOL_SIZE * 2;
  const candidates = await d1Query(
    db,
    `SELECT c.id, c.name, c.category, c.image_url
     FROM characters c
     ${where}
     ORDER BY c.popularity DESC
     LIMIT ?`,
    [...params, candidateLimit]
  );
  for (let i = candidates.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
  }
  const characters = candidates.slice(0, POOL_SIZE);
  if (characters.length < 2) {
    return errorResponse("Not enough characters with attribute data for selected categories", 400);
  }
  const charIds = characters.map((c) => c.id);
  const placeholders = charIds.map(() => "?").join(",");
  const attributes = await d1Query(
    db,
    `SELECT ca.character_id, ca.attribute_key, ca.value
     FROM character_attributes ca
     WHERE ca.character_id IN (${placeholders})
     AND ca.value IS NOT NULL`,
    charIds
  );
  const questionRows = await d1Query(
    db,
    "SELECT id, text, attribute_key FROM questions ORDER BY priority DESC"
  );
  const attrMap = /* @__PURE__ */ new Map();
  for (const a of attributes) {
    let map = attrMap.get(a.character_id);
    if (!map) {
      map = {};
      attrMap.set(a.character_id, map);
    }
    if (a.value === 1) {
      map[a.attribute_key] = true;
    } else if (a.value === 0) {
      map[a.attribute_key] = false;
    } else {
      map[a.attribute_key] = null;
    }
  }
  const serverChars = characters.map((c) => ({
    id: c.id,
    name: c.name,
    category: c.category,
    imageUrl: c.image_url,
    attributes: attrMap.get(c.id) || {}
  }));
  const serverQuestions = questionRows.map((q) => ({
    id: q.id,
    text: q.text,
    attribute: q.attribute_key
  }));
  const firstQuestion = selectBestQuestion(serverChars, [], serverQuestions);
  if (!firstQuestion) {
    return errorResponse("No questions available", 500);
  }
  const reasoning = generateReasoning(firstQuestion, serverChars, []);
  const sessionId = crypto.randomUUID();
  const session = {
    id: sessionId,
    characters: serverChars,
    questions: serverQuestions,
    answers: [],
    currentQuestion: firstQuestion,
    difficulty,
    maxQuestions,
    createdAt: Date.now()
  };
  await kv.put(`game:${sessionId}`, JSON.stringify(session), { expirationTtl: SESSION_TTL });
  return jsonResponse({
    sessionId,
    question: firstQuestion,
    reasoning,
    totalCharacters: serverChars.length
  });
}, "onRequestPost");

// api/admin/upload-attrs.ts
var onRequestPost5 = /* @__PURE__ */ __name(async (context) => {
  const db = context.env.GUESS_DB;
  const kv = context.env.GUESS_KV;
  if (!db) return errorResponse("D1 not configured", 503);
  const body = await parseJsonBody(context.request);
  if (!body?.secret) return errorResponse("Missing secret", 401);
  const adminSecret = await kv?.get("admin:secret");
  if (!adminSecret || body.secret !== adminSecret) {
    return errorResponse("Unauthorized", 403);
  }
  let attrCount = 0;
  let imgCount = 0;
  const errors = [];
  if (body.attributes && body.attributes.length > 0) {
    if (body.attributes.length > 500) {
      return errorResponse("Max 500 attribute rows per request", 400);
    }
    try {
      const prepared = body.attributes.map(
        (a) => db.prepare("INSERT OR REPLACE INTO character_attributes (character_id, attribute_key, value, confidence) VALUES (?, ?, ?, 0.8)").bind(a.c, a.k, a.v)
      );
      await db.batch(prepared);
      attrCount = prepared.length;
    } catch (e) {
      errors.push(`attributes: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  if (body.images && body.images.length > 0) {
    if (body.images.length > 500) {
      return errorResponse("Max 500 image updates per request", 400);
    }
    try {
      const prepared = body.images.map(
        (img) => db.prepare("UPDATE characters SET image_url = ? WHERE id = ?").bind(img.url, img.id)
      );
      await db.batch(prepared);
      imgCount = prepared.length;
    } catch (e) {
      errors.push(`images: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  return jsonResponse({ ok: true, attributes: attrCount, images: imgCount, errors: errors.length > 0 ? errors : void 0 });
}, "onRequestPost");

// api/v2/attributes.ts
var onRequestGet = /* @__PURE__ */ __name(async (context) => {
  const db = context.env.GUESS_DB;
  if (!db) return errorResponse("D1 not configured", 503);
  const url = new URL(context.request.url);
  const withCoverage = url.searchParams.get("coverage") === "true";
  if (withCoverage) {
    const attrs2 = await d1Query(
      db,
      `SELECT
        ad.key,
        ad.display_text,
        (SELECT COUNT(*) FROM characters) as total_characters,
        (SELECT COUNT(*) FROM character_attributes ca
         WHERE ca.attribute_key = ad.key AND ca.value IS NOT NULL) as filled_count,
        (SELECT COUNT(*) FROM character_attributes ca
         WHERE ca.attribute_key = ad.key AND ca.value = 1) as true_count,
        (SELECT COUNT(*) FROM character_attributes ca
         WHERE ca.attribute_key = ad.key AND ca.value = 0) as false_count,
        (SELECT COUNT(*) FROM character_attributes ca
         WHERE ca.attribute_key = ad.key AND ca.value IS NULL) as null_count,
        ROUND(
          CAST((SELECT COUNT(*) FROM character_attributes ca
                WHERE ca.attribute_key = ad.key AND ca.value IS NOT NULL) AS REAL)
          / MAX((SELECT COUNT(*) FROM characters), 1) * 100, 1
        ) as coverage_pct
       FROM attribute_definitions ad
       ORDER BY ad.key ASC`
    );
    return jsonResponse(attrs2);
  }
  const attrs = await d1Query(
    db,
    "SELECT key, display_text, question_text, categories, created_at FROM attribute_definitions ORDER BY key ASC"
  );
  return jsonResponse(attrs);
}, "onRequestGet");

// api/v2/characters.ts
var onRequestGet2 = /* @__PURE__ */ __name(async (context) => {
  const db = context.env.GUESS_DB;
  if (!db) return errorResponse("D1 not configured", 503);
  const url = new URL(context.request.url);
  const category = url.searchParams.get("category");
  const search = url.searchParams.get("search");
  const id = url.searchParams.get("id");
  const limit = Math.min(parseInt(url.searchParams.get("limit") || "50", 10), 200);
  const offset = Math.max(parseInt(url.searchParams.get("offset") || "0", 10), 0);
  if (id) {
    const char = await d1First(db, "SELECT * FROM characters WHERE id = ?", [id]);
    if (!char) return errorResponse("Character not found", 404);
    const attrs = await d1Query(
      db,
      "SELECT attribute_key, value, confidence FROM character_attributes WHERE character_id = ?",
      [id]
    );
    const attributes = {};
    for (const a of attrs) {
      attributes[a.attribute_key] = a.value === 1 ? true : a.value === 0 ? false : null;
    }
    return jsonResponse({ ...char, attributes });
  }
  const conditions = [];
  const params = [];
  if (category && isValidCategory(category)) {
    conditions.push("category = ?");
    params.push(category);
  }
  if (search && search.length >= 2) {
    conditions.push("name LIKE ?");
    params.push(`%${search}%`);
  }
  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  const countRow = await d1First(
    db,
    `SELECT COUNT(*) as total FROM characters ${where}`,
    params
  );
  const total = countRow?.total ?? 0;
  const characters = await d1Query(
    db,
    `SELECT * FROM characters ${where} ORDER BY popularity DESC, name ASC LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );
  return jsonResponse({ characters, total, limit, offset });
}, "onRequestGet");
var onRequestPost6 = /* @__PURE__ */ __name(async (context) => {
  const db = context.env.GUESS_DB;
  const kv = context.env.GUESS_KV;
  if (!db) return errorResponse("D1 not configured", 503);
  if (!kv) return errorResponse("KV not configured", 503);
  const body = await parseJsonBody(context.request);
  if (!body) return errorResponse("Invalid JSON body", 400);
  try {
    const name = validateString(body.name, "name", 2, 50);
    if (!body.category || !isValidCategory(body.category)) {
      return errorResponse("Invalid category", 400);
    }
    const category = body.category;
    const attributes = body.attributes;
    if (!attributes || typeof attributes !== "object") {
      return errorResponse('Missing or invalid "attributes"', 400);
    }
    const nonNullCount = Object.values(attributes).filter((v) => v !== null).length;
    if (nonNullCount < 5) {
      return errorResponse("Character must have at least 5 non-null attributes", 400);
    }
    const userId = getUserId(context.request);
    const { allowed } = await checkRateLimit(kv, userId, "characters-v2", 5);
    if (!allowed) return errorResponse("Rate limit exceeded. Try again later.", 429);
    const existing = await d1First(
      db,
      "SELECT id FROM characters WHERE LOWER(name) = LOWER(?)",
      [name]
    );
    if (existing) return errorResponse(`Character "${name}" already exists`, 409);
    const id = `char-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const description = body.description ? validateString(body.description, "description", 0, 2e3) : null;
    await d1Run(
      db,
      `INSERT INTO characters (id, name, category, source, is_custom, created_by, description)
       VALUES (?, ?, ?, 'user', 1, ?, ?)`,
      [id, name, category, userId, description]
    );
    const attrStatements = Object.entries(attributes).map(([key, value]) => ({
      sql: "INSERT INTO character_attributes (character_id, attribute_key, value, confidence) VALUES (?, ?, ?, 1.0)",
      params: [id, key, value === true ? 1 : value === false ? 0 : null]
    }));
    if (attrStatements.length > 0) {
      await d1Batch(db, attrStatements);
    }
    return jsonResponse({ id, name, category, description }, 201);
  } catch (err) {
    if (err instanceof ValidationError) {
      return errorResponse(err.message, 400);
    }
    console.error("POST /api/v2/characters error:", err);
    return errorResponse("Internal error", 500);
  }
}, "onRequestPost");

// api/v2/questions.ts
var onRequestGet3 = /* @__PURE__ */ __name(async (context) => {
  const db = context.env.GUESS_DB;
  if (!db) return errorResponse("D1 not configured", 503);
  const url = new URL(context.request.url);
  const withCoverage = url.searchParams.get("coverage") === "true";
  if (withCoverage) {
    const questions2 = await d1Query(
      db,
      `SELECT
        q.id, q.text, q.attribute_key, q.priority,
        (SELECT COUNT(*) FROM characters) as total_characters,
        (SELECT COUNT(*) FROM character_attributes ca
         WHERE ca.attribute_key = q.attribute_key AND ca.value IS NOT NULL) as filled_count,
        ROUND(
          CAST((SELECT COUNT(*) FROM character_attributes ca
                WHERE ca.attribute_key = q.attribute_key AND ca.value IS NOT NULL) AS REAL)
          / MAX((SELECT COUNT(*) FROM characters), 1) * 100, 1
        ) as coverage_pct
       FROM questions q
       ORDER BY q.priority DESC, q.id ASC`
    );
    return jsonResponse(questions2);
  }
  const questions = await d1Query(
    db,
    "SELECT id, text, attribute_key, priority FROM questions ORDER BY priority DESC, id ASC"
  );
  return jsonResponse(questions);
}, "onRequestGet");

// api/v2/stats.ts
var onRequestGet4 = /* @__PURE__ */ __name(async (context) => {
  const db = context.env.GUESS_DB;
  if (!db) return errorResponse("D1 not configured", 503);
  const [characters, attributes, questions, byCategory, bySource] = await Promise.all([
    d1First(db, "SELECT COUNT(*) as count FROM characters"),
    d1First(db, "SELECT COUNT(*) as count FROM attribute_definitions"),
    d1First(db, "SELECT COUNT(*) as count FROM questions"),
    d1Query(
      db,
      "SELECT category, COUNT(*) as count FROM characters GROUP BY category ORDER BY count DESC"
    ),
    d1Query(
      db,
      "SELECT source, COUNT(*) as count FROM characters GROUP BY source ORDER BY count DESC"
    )
  ]);
  const totalAttrs = await d1First(
    db,
    `SELECT
       COUNT(*) as total,
       COUNT(CASE WHEN value IS NOT NULL THEN 1 END) as filled
     FROM character_attributes`
  );
  let gameStats = null;
  try {
    const [overview, byDifficulty, recent] = await Promise.all([
      d1First(
        db,
        `SELECT
           COUNT(*) as total_games,
           SUM(CASE WHEN won = 1 THEN 1 ELSE 0 END) as wins,
           ROUND(AVG(questions_asked), 1) as avg_questions,
           ROUND(AVG(character_pool_size), 0) as avg_pool_size
         FROM game_stats`
      ),
      d1Query(
        db,
        `SELECT
           difficulty,
           COUNT(*) as games,
           SUM(CASE WHEN won = 1 THEN 1 ELSE 0 END) as wins,
           ROUND(AVG(questions_asked), 1) as avg_questions
         FROM game_stats
         GROUP BY difficulty
         ORDER BY games DESC`
      ),
      d1Query(
        db,
        `SELECT won, difficulty, questions_asked, character_pool_size, created_at
         FROM game_stats
         ORDER BY created_at DESC
         LIMIT 50`
      )
    ]);
    gameStats = {
      totalGames: overview?.total_games ?? 0,
      wins: overview?.wins ?? 0,
      winRate: overview?.total_games ? Math.round((overview.wins ?? 0) / overview.total_games * 1e3) / 10 : 0,
      avgQuestions: overview?.avg_questions ?? 0,
      avgPoolSize: overview?.avg_pool_size ?? 0,
      byDifficulty: byDifficulty.map((d) => ({
        difficulty: d.difficulty,
        games: d.games,
        wins: d.wins,
        winRate: d.games ? Math.round(d.wins / d.games * 1e3) / 10 : 0,
        avgQuestions: d.avg_questions
      })),
      recentGames: recent.map((g) => ({
        won: g.won === 1,
        difficulty: g.difficulty,
        questionsAsked: g.questions_asked,
        poolSize: g.character_pool_size,
        timestamp: g.created_at
      }))
    };
  } catch {
  }
  return jsonResponse({
    characters: characters?.count ?? 0,
    attributes: attributes?.count ?? 0,
    questions: questions?.count ?? 0,
    characterAttributes: {
      total: totalAttrs?.total ?? 0,
      filled: totalAttrs?.filled ?? 0,
      fillRate: totalAttrs?.total ? Math.round((totalAttrs.filled ?? 0) / totalAttrs.total * 1e3) / 10 : 0
    },
    byCategory,
    bySource,
    gameStats
  });
}, "onRequestGet");

// api/images/[[path]].ts
var onRequestGet5 = /* @__PURE__ */ __name(async ({ params, env }) => {
  const path = Array.isArray(params.path) ? params.path.join("/") : params.path;
  if (!path) {
    return new Response("Not Found", { status: 404 });
  }
  const match2 = path.match(/^([\w-]+)\/(thumb|profile)\.webp$/);
  if (!match2) {
    return new Response("Not Found", { status: 404 });
  }
  const key = `characters/${path}`;
  const object = await env.GUESS_IMAGES.get(key);
  if (!object) {
    return new Response("Not Found", { status: 404 });
  }
  return new Response(object.body, {
    headers: {
      "Content-Type": "image/webp",
      "Cache-Control": "public, max-age=31536000, immutable",
      "ETag": object.httpEtag
    }
  });
}, "onRequestGet");

// api/characters.ts
var KV_KEY = "global:characters";
var MAX_PER_HOUR = 5;
var onRequestGet6 = /* @__PURE__ */ __name(async (context) => {
  const kv = context.env.GUESS_KV;
  if (!kv) {
    return errorResponse("KV not configured", 503);
  }
  const characters = await kvGetArray(kv, KV_KEY);
  return jsonResponse(characters);
}, "onRequestGet");
var onRequestPost7 = /* @__PURE__ */ __name(async (context) => {
  const kv = context.env.GUESS_KV;
  if (!kv) {
    return errorResponse("KV not configured", 503);
  }
  const body = await parseJsonBody(context.request);
  if (!body) {
    return errorResponse("Invalid JSON body", 400);
  }
  try {
    const name = validateString(body.name, "name", 2, 50);
    if (!body.category || !isValidCategory(body.category)) {
      return errorResponse("Invalid category", 400);
    }
    const category = body.category;
    const attributes = body.attributes;
    if (!attributes || typeof attributes !== "object") {
      return errorResponse('Missing or invalid "attributes"', 400);
    }
    const nonNullCount = Object.values(attributes).filter((v) => v !== null).length;
    if (nonNullCount < 5) {
      return errorResponse("Character must have at least 5 non-null attributes", 400);
    }
    const userId = getUserId(context.request);
    const { allowed } = await checkRateLimit(kv, userId, "characters", MAX_PER_HOUR);
    if (!allowed) {
      return errorResponse("Rate limit exceeded. Try again later.", 429);
    }
    const existing = await kvGetArray(kv, KV_KEY);
    const duplicate = existing.find(
      (c) => c.name.toLowerCase() === name.toLowerCase()
    );
    if (duplicate) {
      return errorResponse(`Character "${name}" already exists`, 409);
    }
    const character = {
      id: `char-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name,
      category,
      attributes,
      createdBy: userId,
      createdAt: Date.now()
    };
    existing.push(character);
    await kvPut(kv, KV_KEY, existing);
    return jsonResponse(character, 201);
  } catch (err) {
    if (err instanceof ValidationError) {
      return errorResponse(err.message, 400);
    }
    console.error("Characters API error:", err);
    return errorResponse("Internal server error", 500);
  }
}, "onRequestPost");

// api/corrections.ts
var AUTO_APPLY_THRESHOLD = 3;
var onRequestGet7 = /* @__PURE__ */ __name(async (context) => {
  const kv = context.env.GUESS_KV;
  if (!kv) return errorResponse("KV not configured", 503);
  const url = new URL(context.request.url);
  const characterId = url.searchParams.get("characterId");
  if (!characterId) return errorResponse("Missing characterId parameter", 400);
  try {
    const corrections = await kvGetArray(kv, `corrections:${characterId}`);
    return jsonResponse(corrections);
  } catch (e) {
    console.error("corrections GET error:", e);
    return errorResponse("Internal server error", 500);
  }
}, "onRequestGet");
var onRequestPost8 = /* @__PURE__ */ __name(async (context) => {
  const kv = context.env.GUESS_KV;
  if (!kv) return errorResponse("KV not configured", 503);
  const body = await parseJsonBody(context.request);
  if (!body) return errorResponse("Invalid JSON body", 400);
  const { characterId, attribute, suggestedValue } = body;
  if (!characterId || typeof characterId !== "string") return errorResponse("Missing characterId", 400);
  if (!attribute || typeof attribute !== "string") return errorResponse("Missing attribute", 400);
  if (typeof suggestedValue !== "boolean") return errorResponse("suggestedValue must be boolean", 400);
  const userId = getUserId(context.request);
  const { allowed } = await checkRateLimit(kv, userId, "corrections", 20);
  if (!allowed) return errorResponse("Rate limit exceeded", 429);
  const key = `corrections:${characterId}`;
  const corrections = await kvGetArray(kv, key);
  const alreadyVoted = corrections.some(
    (c) => c.attribute === attribute && c.userId === userId
  );
  if (alreadyVoted) {
    return errorResponse("You already submitted a correction for this attribute", 409);
  }
  const vote = {
    attribute,
    currentValue: body.currentValue ?? null,
    suggestedValue,
    userId,
    createdAt: Date.now()
  };
  try {
    corrections.push(vote);
    await kvPut(kv, key, corrections);
    const votesForThisAttr = corrections.filter(
      (c) => c.attribute === attribute && c.suggestedValue === suggestedValue
    );
    const uniqueVoters = new Set(votesForThisAttr.map((c) => c.userId));
    if (uniqueVoters.size >= AUTO_APPLY_THRESHOLD) {
      const characters = await kvGetArray(kv, "global:characters");
      const char = characters.find((c) => c.id === characterId);
      if (char) {
        char.attributes[attribute] = suggestedValue;
        await kvPut(kv, "global:characters", characters);
      }
      const remaining = corrections.filter((c) => c.attribute !== attribute);
      await kvPut(kv, key, remaining);
      return jsonResponse({ success: true, autoApplied: true });
    }
    return jsonResponse({ success: true, autoApplied: false });
  } catch (e) {
    console.error("corrections POST error:", e);
    return errorResponse("Internal server error", 500);
  }
}, "onRequestPost");

// api/llm.ts
var MAX_PROMPT_LENGTH = 5e4;
var ALLOWED_MODELS = ["gpt-4o", "gpt-4o-mini"];
var MAX_RETRIES = 2;
var RETRY_DELAYS = [1e3, 3e3];
var CACHE_MAX_AGE = 86400;
function simpleHash(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.codePointAt(i) ?? 0;
    hash = (hash << 5) - hash + char;
    hash = Math.trunc(hash);
  }
  return "cache:llm:" + Math.abs(hash).toString(36);
}
__name(simpleHash, "simpleHash");
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
__name(sleep, "sleep");
async function callOpenAIWithRetry(endpoint, headers, openaiBody) {
  let lastResponse = null;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const response = await fetch(endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify(openaiBody)
    });
    if (response.ok) return response;
    lastResponse = response;
    const retryable = [429, 500, 503].includes(response.status);
    if (!retryable || attempt === MAX_RETRIES) break;
    await sleep(RETRY_DELAYS[attempt]);
  }
  if (!lastResponse) throw new Error("No response from OpenAI");
  return lastResponse;
}
__name(callOpenAIWithRetry, "callOpenAIWithRetry");
function validateBody(body) {
  const { prompt, model } = body;
  if (!prompt || typeof prompt !== "string") {
    return Response.json(
      { error: 'Missing or invalid "prompt"' },
      { status: 400 }
    );
  }
  if (!model || typeof model !== "string") {
    return Response.json(
      { error: 'Missing or invalid "model"' },
      { status: 400 }
    );
  }
  if (prompt.length > MAX_PROMPT_LENGTH) {
    return Response.json(
      { error: `Prompt exceeds max length of ${MAX_PROMPT_LENGTH}` },
      { status: 400 }
    );
  }
  if (!ALLOWED_MODELS.includes(model)) {
    return Response.json(
      { error: `Model must be one of: ${ALLOWED_MODELS.join(", ")}` },
      { status: 400 }
    );
  }
  return null;
}
__name(validateBody, "validateBody");
async function trackTokenUsage(kv, userId, usage) {
  const dateKey = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
  const costKey = `costs:${userId}:${dateKey}`;
  const existing = await kvGetObject(kv, costKey) || {
    promptTokens: 0,
    completionTokens: 0,
    calls: 0
  };
  existing.promptTokens += usage.prompt_tokens;
  existing.completionTokens += usage.completion_tokens;
  existing.calls++;
  await kvPut(kv, costKey, existing);
}
__name(trackTokenUsage, "trackTokenUsage");
async function enforceRateLimit(kv, request) {
  const userId = getUserId(request);
  const { allowed } = await checkRateLimit(kv, userId, "llm", 60);
  if (!allowed) {
    return Response.json(
      { error: "Rate limit exceeded", retryAfter: 3600 },
      {
        status: 429,
        headers: { "Retry-After": "3600", "X-RateLimit-Remaining": "0" }
      }
    );
  }
  return null;
}
__name(enforceRateLimit, "enforceRateLimit");
async function checkEdgeCache(cacheKey, requestUrl) {
  const cache = caches.default;
  const cacheUrl = new URL(`/cache/${cacheKey}`, requestUrl).toString();
  const cached = await cache.match(new Request(cacheUrl));
  if (!cached) return null;
  const body = await cached.text();
  return new Response(body, {
    headers: { "Content-Type": "text/plain", "X-Cache": "HIT" }
  });
}
__name(checkEdgeCache, "checkEdgeCache");
async function putEdgeCache(cacheKey, requestUrl, content) {
  const cache = caches.default;
  const cacheUrl = new URL(`/cache/${cacheKey}`, requestUrl).toString();
  const response = new Response(content, {
    headers: {
      "Content-Type": "text/plain",
      "Cache-Control": `public, max-age=${CACHE_MAX_AGE}`
    }
  });
  await cache.put(new Request(cacheUrl), response);
}
__name(putEdgeCache, "putEdgeCache");
function buildOpenAIPayload(model, prompt, systemPrompt, jsonMode) {
  const messages = [];
  if (systemPrompt) {
    messages.push({ role: "system", content: sanitizeString(systemPrompt) });
  }
  messages.push({ role: "user", content: prompt });
  const body = { model, messages };
  if (jsonMode) {
    body.response_format = { type: "json_object" };
  }
  return body;
}
__name(buildOpenAIPayload, "buildOpenAIPayload");
async function processSuccess(data, kv, cacheKey, request) {
  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    return Response.json(
      { error: "Empty response from LLM", code: "EMPTY_RESPONSE" },
      { status: 502 }
    );
  }
  putEdgeCache(cacheKey, request.url, content).catch(() => {
  });
  const responseHeaders = {
    "Content-Type": "text/plain",
    "X-Cache": "MISS"
  };
  if (data.usage) {
    responseHeaders["X-Token-Usage"] = JSON.stringify(data.usage);
    if (kv) {
      await trackTokenUsage(kv, getUserId(request), data.usage).catch(
        () => {
        }
      );
    }
  }
  return new Response(content, { headers: responseHeaders });
}
__name(processSuccess, "processSuccess");
var onRequestPost9 = /* @__PURE__ */ __name(async (context) => {
  const apiKey = context.env.OPENAI_API_KEY;
  if (!apiKey) {
    return Response.json(
      { error: "LLM not configured", code: "NO_API_KEY" },
      { status: 500 }
    );
  }
  const kv = context.env.GUESS_KV;
  let body;
  try {
    body = await context.request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const validationError = validateBody(body);
  if (validationError) return validationError;
  const { prompt, model, jsonMode, systemPrompt } = body;
  if (kv) {
    const rateLimited = await enforceRateLimit(kv, context.request);
    if (rateLimited) return rateLimited;
  }
  const cacheKey = simpleHash(
    `${model}:${systemPrompt || ""}:${prompt}:${jsonMode}`
  );
  const cacheHit = await checkEdgeCache(
    cacheKey,
    context.request.url
  ).catch(() => null);
  if (cacheHit) return cacheHit;
  const endpoint = getCompletionsEndpoint(context.env);
  const headers = getLlmHeaders(context.env);
  const openaiBody = buildOpenAIPayload(model, prompt, systemPrompt, jsonMode);
  try {
    const openaiResponse = await callOpenAIWithRetry(endpoint, headers, openaiBody);
    if (!openaiResponse.ok) {
      const errorText = await openaiResponse.text().catch(() => "Unknown error");
      console.error("OpenAI API error:", openaiResponse.status, errorText);
      if (openaiResponse.status === 429) {
        const isQuota = errorText.includes("insufficient_quota");
        return Response.json(
          {
            error: isQuota ? "API quota exceeded \u2014 please check billing" : "Rate limited by LLM provider",
            code: isQuota ? "QUOTA_EXCEEDED" : "RATE_LIMITED"
          },
          { status: 429 }
        );
      }
      return Response.json(
        { error: "LLM provider error", code: "PROVIDER_ERROR" },
        { status: 502 }
      );
    }
    const data = await openaiResponse.json();
    return processSuccess(data, kv, cacheKey, context.request);
  } catch (error) {
    console.error("LLM proxy error:", error);
    return Response.json(
      { error: "Internal server error", code: "INTERNAL" },
      { status: 500 }
    );
  }
}, "onRequestPost");

// api/llm-stream.ts
var MAX_PROMPT_LENGTH2 = 5e4;
var ALLOWED_MODELS2 = ["gpt-4o", "gpt-4o-mini"];
function parseSSELine(line) {
  const trimmed = line.trim();
  if (!trimmed?.startsWith("data: ")) return null;
  const data = trimmed.slice(6);
  if (data === "[DONE]") return 'data: {"done":true}\n\n';
  try {
    const parsed = JSON.parse(data);
    const token = parsed.choices?.[0]?.delta?.content;
    if (token) return `data: ${JSON.stringify({ token })}

`;
  } catch {
  }
  return null;
}
__name(parseSSELine, "parseSSELine");
var onRequestPost10 = /* @__PURE__ */ __name(async (context) => {
  const apiKey = context.env.OPENAI_API_KEY;
  if (!apiKey) {
    return Response.json({ error: "LLM not configured", code: "NO_API_KEY" }, { status: 500 });
  }
  const kv = context.env.GUESS_KV;
  let body;
  try {
    body = await context.request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const { prompt, model, systemPrompt } = body;
  if (!prompt || typeof prompt !== "string") {
    return Response.json({ error: 'Missing or invalid "prompt"' }, { status: 400 });
  }
  if (!model || typeof model !== "string") {
    return Response.json({ error: 'Missing or invalid "model"' }, { status: 400 });
  }
  if (prompt.length > MAX_PROMPT_LENGTH2) {
    return Response.json({ error: "Prompt too long" }, { status: 400 });
  }
  if (!ALLOWED_MODELS2.includes(model)) {
    return Response.json({ error: `Model must be one of: ${ALLOWED_MODELS2.join(", ")}` }, { status: 400 });
  }
  if (kv) {
    const userId = getUserId(context.request);
    const { allowed } = await checkRateLimit(kv, userId, "llm", 60);
    if (!allowed) {
      return Response.json({ error: "Rate limit exceeded", code: "RATE_LIMITED" }, { status: 429 });
    }
  }
  const messages = [];
  if (systemPrompt && typeof systemPrompt === "string") {
    messages.push({ role: "system", content: sanitizeString(systemPrompt) });
  }
  messages.push({ role: "user", content: prompt });
  try {
    const openaiResponse = await fetch(getCompletionsEndpoint(context.env), {
      method: "POST",
      headers: getLlmHeaders(context.env),
      body: JSON.stringify({
        model,
        messages,
        stream: true
      })
    });
    if (!openaiResponse.ok) {
      const errorText = await openaiResponse.text().catch(() => "Unknown error");
      console.error("OpenAI stream error:", openaiResponse.status, errorText);
      if (openaiResponse.status === 429) {
        const isQuota = errorText.includes("insufficient_quota");
        return Response.json(
          {
            error: isQuota ? "API quota exceeded \u2014 please check billing" : "Rate limited by LLM provider",
            code: isQuota ? "QUOTA_EXCEEDED" : "RATE_LIMITED"
          },
          { status: 429 }
        );
      }
      return Response.json(
        { error: "LLM provider error", code: "PROVIDER_ERROR" },
        { status: 502 }
      );
    }
    const { readable, writable } = new TransformStream();
    const writer = writable.getWriter();
    const encoder = new TextEncoder();
    const processStream = /* @__PURE__ */ __name(async () => {
      const body2 = openaiResponse.body;
      if (!body2) return;
      const reader = body2.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";
          for (const line of lines) {
            const chunk = parseSSELine(line);
            if (!chunk) continue;
            await writer.write(encoder.encode(chunk));
          }
        }
      } catch (err) {
        console.error("Stream processing error:", err);
      } finally {
        await writer.close();
      }
    }, "processStream");
    context.waitUntil(processStream());
    return new Response(readable, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive"
      }
    });
  } catch (error) {
    console.error("LLM stream error:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}, "onRequestPost");

// api/questions.ts
var KV_KEY2 = "global:questions";
var MAX_PER_HOUR2 = 10;
var onRequestGet8 = /* @__PURE__ */ __name(async (context) => {
  const kv = context.env.GUESS_KV;
  if (!kv) return errorResponse("KV not configured", 503);
  const questions = await kvGetArray(kv, KV_KEY2);
  return jsonResponse(questions);
}, "onRequestGet");
var onRequestPost11 = /* @__PURE__ */ __name(async (context) => {
  const kv = context.env.GUESS_KV;
  if (!kv) return errorResponse("KV not configured", 503);
  const body = await parseJsonBody(context.request);
  if (!body) return errorResponse("Invalid JSON body", 400);
  try {
    const text = validateString(body.text, "text", 10, 200);
    const attribute = validateString(body.attribute, "attribute", 2, 50);
    if (!/^[a-z][a-zA-Z]*$/.test(attribute)) {
      return errorResponse("Attribute must be camelCase (letters only)", 400);
    }
    const userId = getUserId(context.request);
    const { allowed } = await checkRateLimit(kv, userId, "questions", MAX_PER_HOUR2);
    if (!allowed) return errorResponse("Rate limit exceeded", 429);
    const existing = await kvGetArray(kv, KV_KEY2);
    if (existing.some((q) => q.attribute === attribute)) {
      return errorResponse(`Question for attribute "${attribute}" already exists`, 409);
    }
    const question = {
      id: `q-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      text,
      attribute,
      createdBy: userId,
      createdAt: Date.now()
    };
    existing.push(question);
    await kvPut(kv, KV_KEY2, existing);
    return jsonResponse(question, 201);
  } catch (err) {
    if (err instanceof ValidationError) return errorResponse(err.message, 400);
    console.error("Questions API error:", err);
    return errorResponse("Internal server error", 500);
  }
}, "onRequestPost");

// api/stats.ts
function emptyStats(characterId) {
  return {
    characterId,
    timesPlayed: 0,
    timesGuessed: 0,
    totalQuestions: 0,
    wins: 0,
    losses: 0,
    byDifficulty: {
      easy: { played: 0, won: 0 },
      medium: { played: 0, won: 0 },
      hard: { played: 0, won: 0 }
    }
  };
}
__name(emptyStats, "emptyStats");
var onRequestGet9 = /* @__PURE__ */ __name(async (context) => {
  const kv = context.env.GUESS_KV;
  if (!kv) return errorResponse("KV not configured", 503);
  try {
    const url = new URL(context.request.url);
    const characterId = url.searchParams.get("characterId");
    if (characterId) {
      const stats = await kvGetObject(kv, `stats:${characterId}`) || emptyStats(characterId);
      return jsonResponse(stats);
    }
    const leaderboard = await kvGetArray(kv, "stats:leaderboard");
    return jsonResponse(leaderboard);
  } catch (e) {
    console.error("stats GET error:", e);
    return errorResponse("Internal server error", 500);
  }
}, "onRequestGet");
var onRequestPost12 = /* @__PURE__ */ __name(async (context) => {
  const kv = context.env.GUESS_KV;
  if (!kv) return errorResponse("KV not configured", 503);
  const body = await parseJsonBody(context.request);
  if (!body) return errorResponse("Invalid JSON body", 400);
  const characterId = body.characterId;
  if (!characterId || typeof characterId !== "string") {
    return errorResponse("Missing characterId", 400);
  }
  if (typeof body.won !== "boolean") {
    return errorResponse('Missing or invalid "won" field', 400);
  }
  if (typeof body.questionsAsked !== "number" || body.questionsAsked < 0) {
    return errorResponse('Missing or invalid "questionsAsked"', 400);
  }
  const userId = getUserId(context.request);
  const { allowed } = await checkRateLimit(kv, userId, "stats", 30);
  if (!allowed) return errorResponse("Rate limit exceeded", 429);
  try {
    const key = `stats:${characterId}`;
    const stats = await kvGetObject(kv, key) || emptyStats(characterId);
    stats.timesPlayed++;
    stats.totalQuestions += body.questionsAsked;
    if (body.won) {
      stats.wins++;
      stats.timesGuessed++;
    } else {
      stats.losses++;
    }
    const diff = body.difficulty || "medium";
    if (!stats.byDifficulty[diff]) {
      stats.byDifficulty[diff] = { played: 0, won: 0 };
    }
    stats.byDifficulty[diff].played++;
    if (body.won) stats.byDifficulty[diff].won++;
    await kvPut(kv, key, stats);
    const leaderboard = await kvGetArray(kv, "stats:leaderboard");
    const idx = leaderboard.findIndex((s) => s.characterId === characterId);
    if (idx >= 0) leaderboard[idx] = stats;
    else leaderboard.push(stats);
    leaderboard.sort((a, b) => b.timesPlayed - a.timesPlayed);
    await kvPut(kv, "stats:leaderboard", leaderboard.slice(0, 20));
    return jsonResponse({ success: true });
  } catch (e) {
    console.error("stats POST error:", e);
    return errorResponse("Internal server error", 500);
  }
}, "onRequestPost");

// api/sync.ts
var onRequestGet10 = /* @__PURE__ */ __name(async (context) => {
  const kv = context.env.GUESS_KV;
  if (!kv) return errorResponse("KV not configured", 503);
  try {
    const url = new URL(context.request.url);
    const userId = url.searchParams.get("userId");
    if (!userId) return errorResponse("Missing userId parameter", 400);
    const data = await kvGetObject(kv, `user:${userId}`);
    if (!data) return jsonResponse({ userId, settings: {}, gameStats: {}, lastSync: 0 });
    return jsonResponse(data);
  } catch (e) {
    console.error("sync GET error:", e);
    return errorResponse("Internal server error", 500);
  }
}, "onRequestGet");
var onRequestPost13 = /* @__PURE__ */ __name(async (context) => {
  const kv = context.env.GUESS_KV;
  if (!kv) return errorResponse("KV not configured", 503);
  const body = await parseJsonBody(context.request);
  if (!body) return errorResponse("Invalid JSON body", 400);
  const userId = body.userId || getUserId(context.request);
  if (!userId || userId === "anonymous") {
    return errorResponse("Missing userId", 400);
  }
  try {
    const existing = await kvGetObject(kv, `user:${userId}`) || {
      userId,
      settings: {},
      gameStats: {},
      lastSync: 0
    };
    const updated = {
      userId,
      settings: { ...existing.settings, ...body.settings },
      gameStats: { ...existing.gameStats, ...body.gameStats },
      lastSync: Date.now()
    };
    await kvPut(kv, `user:${userId}`, updated);
    return jsonResponse({ success: true, lastSync: updated.lastSync });
  } catch (e) {
    console.error("sync POST error:", e);
    return errorResponse("Internal server error", 500);
  }
}, "onRequestPost");

// ../.wrangler/tmp/pages-xEqhOt/functionsRoutes-0.28821556749298227.mjs
var routes = [
  {
    routePath: "/api/v2/game/answer",
    mountPath: "/api/v2/game",
    method: "POST",
    middlewares: [],
    modules: [onRequestPost]
  },
  {
    routePath: "/api/v2/game/result",
    mountPath: "/api/v2/game",
    method: "POST",
    middlewares: [],
    modules: [onRequestPost2]
  },
  {
    routePath: "/api/v2/game/resume",
    mountPath: "/api/v2/game",
    method: "POST",
    middlewares: [],
    modules: [onRequestPost3]
  },
  {
    routePath: "/api/v2/game/start",
    mountPath: "/api/v2/game",
    method: "POST",
    middlewares: [],
    modules: [onRequestPost4]
  },
  {
    routePath: "/api/admin/upload-attrs",
    mountPath: "/api/admin",
    method: "POST",
    middlewares: [],
    modules: [onRequestPost5]
  },
  {
    routePath: "/api/v2/attributes",
    mountPath: "/api/v2",
    method: "GET",
    middlewares: [],
    modules: [onRequestGet]
  },
  {
    routePath: "/api/v2/characters",
    mountPath: "/api/v2",
    method: "GET",
    middlewares: [],
    modules: [onRequestGet2]
  },
  {
    routePath: "/api/v2/characters",
    mountPath: "/api/v2",
    method: "POST",
    middlewares: [],
    modules: [onRequestPost6]
  },
  {
    routePath: "/api/v2/questions",
    mountPath: "/api/v2",
    method: "GET",
    middlewares: [],
    modules: [onRequestGet3]
  },
  {
    routePath: "/api/v2/stats",
    mountPath: "/api/v2",
    method: "GET",
    middlewares: [],
    modules: [onRequestGet4]
  },
  {
    routePath: "/api/images/:path*",
    mountPath: "/api/images",
    method: "GET",
    middlewares: [],
    modules: [onRequestGet5]
  },
  {
    routePath: "/api/characters",
    mountPath: "/api",
    method: "GET",
    middlewares: [],
    modules: [onRequestGet6]
  },
  {
    routePath: "/api/characters",
    mountPath: "/api",
    method: "POST",
    middlewares: [],
    modules: [onRequestPost7]
  },
  {
    routePath: "/api/corrections",
    mountPath: "/api",
    method: "GET",
    middlewares: [],
    modules: [onRequestGet7]
  },
  {
    routePath: "/api/corrections",
    mountPath: "/api",
    method: "POST",
    middlewares: [],
    modules: [onRequestPost8]
  },
  {
    routePath: "/api/llm",
    mountPath: "/api",
    method: "POST",
    middlewares: [],
    modules: [onRequestPost9]
  },
  {
    routePath: "/api/llm-stream",
    mountPath: "/api",
    method: "POST",
    middlewares: [],
    modules: [onRequestPost10]
  },
  {
    routePath: "/api/questions",
    mountPath: "/api",
    method: "GET",
    middlewares: [],
    modules: [onRequestGet8]
  },
  {
    routePath: "/api/questions",
    mountPath: "/api",
    method: "POST",
    middlewares: [],
    modules: [onRequestPost11]
  },
  {
    routePath: "/api/stats",
    mountPath: "/api",
    method: "GET",
    middlewares: [],
    modules: [onRequestGet9]
  },
  {
    routePath: "/api/stats",
    mountPath: "/api",
    method: "POST",
    middlewares: [],
    modules: [onRequestPost12]
  },
  {
    routePath: "/api/sync",
    mountPath: "/api",
    method: "GET",
    middlewares: [],
    modules: [onRequestGet10]
  },
  {
    routePath: "/api/sync",
    mountPath: "/api",
    method: "POST",
    middlewares: [],
    modules: [onRequestPost13]
  }
];

// ../node_modules/.pnpm/path-to-regexp@6.3.0/node_modules/path-to-regexp/dist.es2015/index.js
function lexer(str) {
  var tokens = [];
  var i = 0;
  while (i < str.length) {
    var char = str[i];
    if (char === "*" || char === "+" || char === "?") {
      tokens.push({ type: "MODIFIER", index: i, value: str[i++] });
      continue;
    }
    if (char === "\\") {
      tokens.push({ type: "ESCAPED_CHAR", index: i++, value: str[i++] });
      continue;
    }
    if (char === "{") {
      tokens.push({ type: "OPEN", index: i, value: str[i++] });
      continue;
    }
    if (char === "}") {
      tokens.push({ type: "CLOSE", index: i, value: str[i++] });
      continue;
    }
    if (char === ":") {
      var name = "";
      var j = i + 1;
      while (j < str.length) {
        var code = str.charCodeAt(j);
        if (
          // `0-9`
          code >= 48 && code <= 57 || // `A-Z`
          code >= 65 && code <= 90 || // `a-z`
          code >= 97 && code <= 122 || // `_`
          code === 95
        ) {
          name += str[j++];
          continue;
        }
        break;
      }
      if (!name)
        throw new TypeError("Missing parameter name at ".concat(i));
      tokens.push({ type: "NAME", index: i, value: name });
      i = j;
      continue;
    }
    if (char === "(") {
      var count = 1;
      var pattern = "";
      var j = i + 1;
      if (str[j] === "?") {
        throw new TypeError('Pattern cannot start with "?" at '.concat(j));
      }
      while (j < str.length) {
        if (str[j] === "\\") {
          pattern += str[j++] + str[j++];
          continue;
        }
        if (str[j] === ")") {
          count--;
          if (count === 0) {
            j++;
            break;
          }
        } else if (str[j] === "(") {
          count++;
          if (str[j + 1] !== "?") {
            throw new TypeError("Capturing groups are not allowed at ".concat(j));
          }
        }
        pattern += str[j++];
      }
      if (count)
        throw new TypeError("Unbalanced pattern at ".concat(i));
      if (!pattern)
        throw new TypeError("Missing pattern at ".concat(i));
      tokens.push({ type: "PATTERN", index: i, value: pattern });
      i = j;
      continue;
    }
    tokens.push({ type: "CHAR", index: i, value: str[i++] });
  }
  tokens.push({ type: "END", index: i, value: "" });
  return tokens;
}
__name(lexer, "lexer");
function parse(str, options) {
  if (options === void 0) {
    options = {};
  }
  var tokens = lexer(str);
  var _a = options.prefixes, prefixes = _a === void 0 ? "./" : _a, _b = options.delimiter, delimiter = _b === void 0 ? "/#?" : _b;
  var result = [];
  var key = 0;
  var i = 0;
  var path = "";
  var tryConsume = /* @__PURE__ */ __name(function(type) {
    if (i < tokens.length && tokens[i].type === type)
      return tokens[i++].value;
  }, "tryConsume");
  var mustConsume = /* @__PURE__ */ __name(function(type) {
    var value2 = tryConsume(type);
    if (value2 !== void 0)
      return value2;
    var _a2 = tokens[i], nextType = _a2.type, index = _a2.index;
    throw new TypeError("Unexpected ".concat(nextType, " at ").concat(index, ", expected ").concat(type));
  }, "mustConsume");
  var consumeText = /* @__PURE__ */ __name(function() {
    var result2 = "";
    var value2;
    while (value2 = tryConsume("CHAR") || tryConsume("ESCAPED_CHAR")) {
      result2 += value2;
    }
    return result2;
  }, "consumeText");
  var isSafe = /* @__PURE__ */ __name(function(value2) {
    for (var _i = 0, delimiter_1 = delimiter; _i < delimiter_1.length; _i++) {
      var char2 = delimiter_1[_i];
      if (value2.indexOf(char2) > -1)
        return true;
    }
    return false;
  }, "isSafe");
  var safePattern = /* @__PURE__ */ __name(function(prefix2) {
    var prev = result[result.length - 1];
    var prevText = prefix2 || (prev && typeof prev === "string" ? prev : "");
    if (prev && !prevText) {
      throw new TypeError('Must have text between two parameters, missing text after "'.concat(prev.name, '"'));
    }
    if (!prevText || isSafe(prevText))
      return "[^".concat(escapeString(delimiter), "]+?");
    return "(?:(?!".concat(escapeString(prevText), ")[^").concat(escapeString(delimiter), "])+?");
  }, "safePattern");
  while (i < tokens.length) {
    var char = tryConsume("CHAR");
    var name = tryConsume("NAME");
    var pattern = tryConsume("PATTERN");
    if (name || pattern) {
      var prefix = char || "";
      if (prefixes.indexOf(prefix) === -1) {
        path += prefix;
        prefix = "";
      }
      if (path) {
        result.push(path);
        path = "";
      }
      result.push({
        name: name || key++,
        prefix,
        suffix: "",
        pattern: pattern || safePattern(prefix),
        modifier: tryConsume("MODIFIER") || ""
      });
      continue;
    }
    var value = char || tryConsume("ESCAPED_CHAR");
    if (value) {
      path += value;
      continue;
    }
    if (path) {
      result.push(path);
      path = "";
    }
    var open = tryConsume("OPEN");
    if (open) {
      var prefix = consumeText();
      var name_1 = tryConsume("NAME") || "";
      var pattern_1 = tryConsume("PATTERN") || "";
      var suffix = consumeText();
      mustConsume("CLOSE");
      result.push({
        name: name_1 || (pattern_1 ? key++ : ""),
        pattern: name_1 && !pattern_1 ? safePattern(prefix) : pattern_1,
        prefix,
        suffix,
        modifier: tryConsume("MODIFIER") || ""
      });
      continue;
    }
    mustConsume("END");
  }
  return result;
}
__name(parse, "parse");
function match(str, options) {
  var keys = [];
  var re = pathToRegexp(str, keys, options);
  return regexpToFunction(re, keys, options);
}
__name(match, "match");
function regexpToFunction(re, keys, options) {
  if (options === void 0) {
    options = {};
  }
  var _a = options.decode, decode = _a === void 0 ? function(x) {
    return x;
  } : _a;
  return function(pathname) {
    var m = re.exec(pathname);
    if (!m)
      return false;
    var path = m[0], index = m.index;
    var params = /* @__PURE__ */ Object.create(null);
    var _loop_1 = /* @__PURE__ */ __name(function(i2) {
      if (m[i2] === void 0)
        return "continue";
      var key = keys[i2 - 1];
      if (key.modifier === "*" || key.modifier === "+") {
        params[key.name] = m[i2].split(key.prefix + key.suffix).map(function(value) {
          return decode(value, key);
        });
      } else {
        params[key.name] = decode(m[i2], key);
      }
    }, "_loop_1");
    for (var i = 1; i < m.length; i++) {
      _loop_1(i);
    }
    return { path, index, params };
  };
}
__name(regexpToFunction, "regexpToFunction");
function escapeString(str) {
  return str.replace(/([.+*?=^!:${}()[\]|/\\])/g, "\\$1");
}
__name(escapeString, "escapeString");
function flags(options) {
  return options && options.sensitive ? "" : "i";
}
__name(flags, "flags");
function regexpToRegexp(path, keys) {
  if (!keys)
    return path;
  var groupsRegex = /\((?:\?<(.*?)>)?(?!\?)/g;
  var index = 0;
  var execResult = groupsRegex.exec(path.source);
  while (execResult) {
    keys.push({
      // Use parenthesized substring match if available, index otherwise
      name: execResult[1] || index++,
      prefix: "",
      suffix: "",
      modifier: "",
      pattern: ""
    });
    execResult = groupsRegex.exec(path.source);
  }
  return path;
}
__name(regexpToRegexp, "regexpToRegexp");
function arrayToRegexp(paths, keys, options) {
  var parts = paths.map(function(path) {
    return pathToRegexp(path, keys, options).source;
  });
  return new RegExp("(?:".concat(parts.join("|"), ")"), flags(options));
}
__name(arrayToRegexp, "arrayToRegexp");
function stringToRegexp(path, keys, options) {
  return tokensToRegexp(parse(path, options), keys, options);
}
__name(stringToRegexp, "stringToRegexp");
function tokensToRegexp(tokens, keys, options) {
  if (options === void 0) {
    options = {};
  }
  var _a = options.strict, strict = _a === void 0 ? false : _a, _b = options.start, start = _b === void 0 ? true : _b, _c = options.end, end = _c === void 0 ? true : _c, _d = options.encode, encode = _d === void 0 ? function(x) {
    return x;
  } : _d, _e = options.delimiter, delimiter = _e === void 0 ? "/#?" : _e, _f = options.endsWith, endsWith = _f === void 0 ? "" : _f;
  var endsWithRe = "[".concat(escapeString(endsWith), "]|$");
  var delimiterRe = "[".concat(escapeString(delimiter), "]");
  var route = start ? "^" : "";
  for (var _i = 0, tokens_1 = tokens; _i < tokens_1.length; _i++) {
    var token = tokens_1[_i];
    if (typeof token === "string") {
      route += escapeString(encode(token));
    } else {
      var prefix = escapeString(encode(token.prefix));
      var suffix = escapeString(encode(token.suffix));
      if (token.pattern) {
        if (keys)
          keys.push(token);
        if (prefix || suffix) {
          if (token.modifier === "+" || token.modifier === "*") {
            var mod = token.modifier === "*" ? "?" : "";
            route += "(?:".concat(prefix, "((?:").concat(token.pattern, ")(?:").concat(suffix).concat(prefix, "(?:").concat(token.pattern, "))*)").concat(suffix, ")").concat(mod);
          } else {
            route += "(?:".concat(prefix, "(").concat(token.pattern, ")").concat(suffix, ")").concat(token.modifier);
          }
        } else {
          if (token.modifier === "+" || token.modifier === "*") {
            throw new TypeError('Can not repeat "'.concat(token.name, '" without a prefix and suffix'));
          }
          route += "(".concat(token.pattern, ")").concat(token.modifier);
        }
      } else {
        route += "(?:".concat(prefix).concat(suffix, ")").concat(token.modifier);
      }
    }
  }
  if (end) {
    if (!strict)
      route += "".concat(delimiterRe, "?");
    route += !options.endsWith ? "$" : "(?=".concat(endsWithRe, ")");
  } else {
    var endToken = tokens[tokens.length - 1];
    var isEndDelimited = typeof endToken === "string" ? delimiterRe.indexOf(endToken[endToken.length - 1]) > -1 : endToken === void 0;
    if (!strict) {
      route += "(?:".concat(delimiterRe, "(?=").concat(endsWithRe, "))?");
    }
    if (!isEndDelimited) {
      route += "(?=".concat(delimiterRe, "|").concat(endsWithRe, ")");
    }
  }
  return new RegExp(route, flags(options));
}
__name(tokensToRegexp, "tokensToRegexp");
function pathToRegexp(path, keys, options) {
  if (path instanceof RegExp)
    return regexpToRegexp(path, keys);
  if (Array.isArray(path))
    return arrayToRegexp(path, keys, options);
  return stringToRegexp(path, keys, options);
}
__name(pathToRegexp, "pathToRegexp");

// ../node_modules/.pnpm/wrangler@4.83.0_@cloudflare+workers-types@4.20260416.2/node_modules/wrangler/templates/pages-template-worker.ts
var escapeRegex = /[.+?^${}()|[\]\\]/g;
function* executeRequest(request) {
  const requestPath = new URL(request.url).pathname;
  for (const route of [...routes].reverse()) {
    if (route.method && route.method !== request.method) {
      continue;
    }
    const routeMatcher = match(route.routePath.replace(escapeRegex, "\\$&"), {
      end: false
    });
    const mountMatcher = match(route.mountPath.replace(escapeRegex, "\\$&"), {
      end: false
    });
    const matchResult = routeMatcher(requestPath);
    const mountMatchResult = mountMatcher(requestPath);
    if (matchResult && mountMatchResult) {
      for (const handler of route.middlewares.flat()) {
        yield {
          handler,
          params: matchResult.params,
          path: mountMatchResult.path
        };
      }
    }
  }
  for (const route of routes) {
    if (route.method && route.method !== request.method) {
      continue;
    }
    const routeMatcher = match(route.routePath.replace(escapeRegex, "\\$&"), {
      end: true
    });
    const mountMatcher = match(route.mountPath.replace(escapeRegex, "\\$&"), {
      end: false
    });
    const matchResult = routeMatcher(requestPath);
    const mountMatchResult = mountMatcher(requestPath);
    if (matchResult && mountMatchResult && route.modules.length) {
      for (const handler of route.modules.flat()) {
        yield {
          handler,
          params: matchResult.params,
          path: matchResult.path
        };
      }
      break;
    }
  }
}
__name(executeRequest, "executeRequest");
var pages_template_worker_default = {
  async fetch(originalRequest, env, workerContext) {
    let request = originalRequest;
    const handlerIterator = executeRequest(request);
    let data = {};
    let isFailOpen = false;
    const next = /* @__PURE__ */ __name(async (input, init) => {
      if (input !== void 0) {
        let url = input;
        if (typeof input === "string") {
          url = new URL(input, request.url).toString();
        }
        request = new Request(url, init);
      }
      const result = handlerIterator.next();
      if (result.done === false) {
        const { handler, params, path } = result.value;
        const context = {
          request: new Request(request.clone()),
          functionPath: path,
          next,
          params,
          get data() {
            return data;
          },
          set data(value) {
            if (typeof value !== "object" || value === null) {
              throw new Error("context.data must be an object");
            }
            data = value;
          },
          env,
          waitUntil: workerContext.waitUntil.bind(workerContext),
          passThroughOnException: /* @__PURE__ */ __name(() => {
            isFailOpen = true;
          }, "passThroughOnException")
        };
        const response = await handler(context);
        if (!(response instanceof Response)) {
          throw new Error("Your Pages function should return a Response");
        }
        return cloneResponse(response);
      } else if ("ASSETS") {
        const response = await env["ASSETS"].fetch(request);
        return cloneResponse(response);
      } else {
        const response = await fetch(request);
        return cloneResponse(response);
      }
    }, "next");
    try {
      return await next();
    } catch (error) {
      if (isFailOpen) {
        const response = await env["ASSETS"].fetch(request);
        return cloneResponse(response);
      }
      throw error;
    }
  }
};
var cloneResponse = /* @__PURE__ */ __name((response) => (
  // https://fetch.spec.whatwg.org/#null-body-status
  new Response(
    [101, 204, 205, 304].includes(response.status) ? null : response.body,
    response
  )
), "cloneResponse");
export {
  pages_template_worker_default as default
};
