import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { z } from "zod";
import {
  AnswerRequestSchema,
  ClientEventSchema,
  EventsBatchRequestSchema,
  FeedbackRequestSchema,
  RejectGuessRequestSchema,
  ResultRequestSchema,
  ResumeRequestSchema,
  SkipRequestSchema,
  StartRequestSchema,
} from "../../functions/api/_schemas";

export interface EndpointOperation {
  operationId: string;
  summary: string;
  tags: string[];
  security?: Array<Record<string, string[]>>;
  requestBody?: {
    required: boolean;
    content: {
      "application/json": {
        schema: Record<string, unknown>;
      };
    };
  };
  responses: Record<string, unknown>;
}

export interface EndpointEntry {
  filePath: string;
  routePath: string;
  methods: HttpMethod[];
  domain: "admin" | "public";
  tags: string[];
}

export type HttpMethod =
  | "get"
  | "post"
  | "put"
  | "patch"
  | "delete"
  | "options"
  | "head";

interface GenerationArtifacts {
  openapiJson: string;
  openapiYaml: string;
  inventoryJson: string;
}

interface OperationMetadata {
  summary?: string;
  tags?: string[];
  requestSchema?: Record<string, unknown>;
  responseSchema?: Record<string, unknown>;
}

const ROOT_DIR = resolve(import.meta.dirname, "..", "..");
const API_DIR = resolve(ROOT_DIR, "functions", "api");
const DOCS_DIR = resolve(ROOT_DIR, "docs");
const PUBLIC_DIR = resolve(ROOT_DIR, "public");
const PACKAGE_JSON_PATH = resolve(ROOT_DIR, "package.json");

const METHODS_ORDER: HttpMethod[] = [
  "get",
  "post",
  "put",
  "patch",
  "delete",
  "options",
  "head",
];

const DAILY_RESULT_REQUEST_SCHEMA: Record<string, unknown> = {
  type: "object",
  properties: {
    won: { type: "boolean" },
    questionsAsked: { type: "integer", minimum: 1 },
  },
  required: ["won", "questionsAsked"],
  additionalProperties: false,
};

const GENERIC_OBJECT_SCHEMA: Record<string, unknown> = {
  type: "object",
  additionalProperties: true,
};

const QUESTION_SCHEMA: Record<string, unknown> = {
  type: "object",
  properties: {
    id: { type: "string" },
    text: { type: "string" },
    attribute: { type: "string" },
    displayText: { type: "string" },
    category: { type: "string" },
  },
  required: ["id", "text", "attribute"],
  additionalProperties: false,
};

const READINESS_SCHEMA: Record<string, unknown> = {
  type: "object",
  properties: {
    trigger: { type: ["string", "null"] },
    blockedByRejectCooldown: { type: "boolean" },
    rejectCooldownRemaining: { type: "number" },
    topProbability: { type: "number" },
    gap: { type: "number" },
    aliveCount: { type: "number" },
    questionsRemaining: { type: "number" },
    forced: { type: "boolean" },
  },
  additionalProperties: false,
};

const GUESS_CHARACTER_SCHEMA: Record<string, unknown> = {
  type: "object",
  properties: {
    id: { type: "string" },
    name: { type: "string" },
    category: { type: "string" },
    imageUrl: { type: ["string", "null"] },
    trivia: {
      type: "array",
      items: { type: "string" },
    },
  },
  required: ["id", "name", "category", "imageUrl"],
  additionalProperties: false,
};

const QUESTION_RESPONSE_SCHEMA: Record<string, unknown> = {
  type: "object",
  properties: {
    type: { const: "question" },
    question: QUESTION_SCHEMA,
    reasoning: GENERIC_OBJECT_SCHEMA,
    remaining: { type: "number" },
    questionCount: { type: "number" },
    eliminated: { type: "number" },
    readiness: READINESS_SCHEMA,
    skippedCount: { type: "number" },
    maxQuestions: { type: "number" },
    guessCount: { type: "number" },
    rejectCooldownRemaining: { type: "number" },
  },
  required: ["type", "question", "reasoning", "remaining", "questionCount"],
  additionalProperties: false,
};

const GUESS_RESPONSE_SCHEMA: Record<string, unknown> = {
  type: "object",
  properties: {
    type: { const: "guess" },
    character: GUESS_CHARACTER_SCHEMA,
    confidence: { type: "number" },
    questionCount: { type: "number" },
    remaining: { type: "number" },
    guessCount: { type: "number" },
    readiness: READINESS_SCHEMA,
  },
  required: [
    "type",
    "character",
    "confidence",
    "questionCount",
    "remaining",
    "guessCount",
  ],
  additionalProperties: false,
};

const CONTRADICTION_RESPONSE_SCHEMA: Record<string, unknown> = {
  type: "object",
  properties: {
    type: { const: "contradiction" },
    message: { type: "string" },
    question: QUESTION_SCHEMA,
    reasoning: GENERIC_OBJECT_SCHEMA,
    remaining: { type: "number" },
    questionCount: { type: "number" },
  },
  required: [
    "type",
    "message",
    "question",
    "reasoning",
    "remaining",
    "questionCount",
  ],
  additionalProperties: false,
};

const EXHAUSTED_RESPONSE_SCHEMA: Record<string, unknown> = {
  type: "object",
  properties: {
    type: { const: "exhausted" },
    message: { type: "string" },
    questionCount: { type: "number" },
    guessCount: { type: "number" },
    rejectCooldownRemaining: { type: "number" },
  },
  required: [
    "type",
    "message",
    "questionCount",
    "guessCount",
    "rejectCooldownRemaining",
  ],
  additionalProperties: false,
};

const START_RESPONSE_SCHEMA: Record<string, unknown> = {
  type: "object",
  properties: {
    sessionId: { type: "string" },
    question: QUESTION_SCHEMA,
    reasoning: GENERIC_OBJECT_SCHEMA,
    totalCharacters: { type: "number" },
    maxQuestions: { type: "number" },
  },
  required: [
    "sessionId",
    "question",
    "reasoning",
    "totalCharacters",
    "maxQuestions",
  ],
  additionalProperties: false,
};

const RESULT_RESPONSE_SCHEMA: Record<string, unknown> = {
  type: "object",
  properties: {
    success: { type: "boolean" },
    summary: {
      type: "object",
      properties: {
        won: { type: "boolean" },
        difficulty: { type: "string" },
        questionsAsked: { type: "number" },
        maxQuestions: { type: "number" },
        poolSize: { type: "number" },
        guessesUsed: { type: "number" },
      },
      required: [
        "won",
        "difficulty",
        "questionsAsked",
        "maxQuestions",
        "poolSize",
        "guessesUsed",
      ],
      additionalProperties: false,
    },
  },
  required: ["success", "summary"],
  additionalProperties: false,
};

const FEEDBACK_RESPONSE_SCHEMA: Record<string, unknown> = {
  type: "object",
  properties: {
    success: { type: "boolean" },
  },
  required: ["success"],
  additionalProperties: false,
};

const RESUME_RESPONSE_SCHEMA: Record<string, unknown> = {
  oneOf: [
    {
      type: "object",
      properties: {
        expired: { const: true },
      },
      required: ["expired"],
      additionalProperties: false,
    },
    {
      type: "object",
      properties: {
        expired: { const: false },
        question: {
          oneOf: [QUESTION_SCHEMA, { type: "null" }],
        },
        reasoning: {
          oneOf: [GENERIC_OBJECT_SCHEMA, { type: "null" }],
        },
        remaining: { type: "number" },
        totalCharacters: { type: "number" },
        questionCount: { type: "number" },
        guessCount: { type: "number" },
        answers: {
          type: "array",
          items: {
            type: "object",
            properties: {
              questionId: { type: "string" },
              value: { type: "string" },
            },
            required: ["questionId", "value"],
            additionalProperties: false,
          },
        },
      },
      required: [
        "expired",
        "question",
        "reasoning",
        "remaining",
        "totalCharacters",
        "questionCount",
        "guessCount",
        "answers",
      ],
      additionalProperties: false,
    },
  ],
};

const ANSWER_RESPONSE_SCHEMA: Record<string, unknown> = {
  oneOf: [
    QUESTION_RESPONSE_SCHEMA,
    GUESS_RESPONSE_SCHEMA,
    CONTRADICTION_RESPONSE_SCHEMA,
  ],
};

const REJECT_GUESS_RESPONSE_SCHEMA: Record<string, unknown> = {
  oneOf: [QUESTION_RESPONSE_SCHEMA, EXHAUSTED_RESPONSE_SCHEMA],
};

function toJsonSchema(schema: z.ZodTypeAny): Record<string, unknown> {
  const jsonSchema = z.toJSONSchema(schema) as Record<string, unknown>;
  const { $schema: _schema, ...rest } = jsonSchema;
  return rest;
}

const V2_EVENTS_BATCH_REQUEST_SCHEMA = toJsonSchema(EventsBatchRequestSchema);
const V2_EVENTS_BATCH_ITEM_SCHEMA = toJsonSchema(ClientEventSchema);

const OPERATION_METADATA: Record<string, OperationMetadata> = {
  "post /api/v2/game/start": {
    summary: "Start a new game session",
    requestSchema: toJsonSchema(StartRequestSchema),
    responseSchema: START_RESPONSE_SCHEMA,
  },
  "post /api/v2/game/answer": {
    summary: "Submit an answer for the current question",
    requestSchema: toJsonSchema(AnswerRequestSchema),
    responseSchema: ANSWER_RESPONSE_SCHEMA,
  },
  "post /api/v2/game/skip": {
    summary: "Skip the current question and continue",
    requestSchema: toJsonSchema(SkipRequestSchema),
    responseSchema: QUESTION_RESPONSE_SCHEMA,
  },
  "post /api/v2/game/reject-guess": {
    summary: "Reject an AI guess and continue the session",
    requestSchema: toJsonSchema(RejectGuessRequestSchema),
    responseSchema: REJECT_GUESS_RESPONSE_SCHEMA,
  },
  "post /api/v2/game/result": {
    summary: "Finalize game result and persist outcome",
    requestSchema: toJsonSchema(ResultRequestSchema),
    responseSchema: RESULT_RESPONSE_SCHEMA,
  },
  "post /api/v2/game/resume": {
    summary: "Resume an existing game session",
    requestSchema: toJsonSchema(ResumeRequestSchema),
    responseSchema: RESUME_RESPONSE_SCHEMA,
  },
  "post /api/v2/game/feedback": {
    summary: "Submit post-game user feedback",
    requestSchema: toJsonSchema(FeedbackRequestSchema),
    responseSchema: FEEDBACK_RESPONSE_SCHEMA,
  },
  "post /api/v2/events": {
    summary: "Ingest a client analytics event batch",
    requestSchema: {
      ...V2_EVENTS_BATCH_REQUEST_SCHEMA,
      properties: {
        ...(V2_EVENTS_BATCH_REQUEST_SCHEMA.properties as
          | Record<string, unknown>
          | undefined),
        events: {
          type: "array",
          maxItems: 50,
          items: V2_EVENTS_BATCH_ITEM_SCHEMA,
        },
      },
    },
  },
  "post /api/v2/daily": {
    summary: "Record daily challenge completion result",
    requestSchema: DAILY_RESULT_REQUEST_SCHEMA,
  },
  "get /api/v2/daily": {
    summary: "Get current user daily challenge status",
  },
};

function toPosixPath(pathValue: string): string {
  return pathValue.split("\\").join("/");
}

function collectTsFiles(dirPath: string): string[] {
  const entries = readdirSync(dirPath, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const fullPath = join(dirPath, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectTsFiles(fullPath));
      continue;
    }

    if (!entry.name.endsWith(".ts")) continue;
    if (entry.name.endsWith(".test.ts")) continue;
    if (entry.name.startsWith("_")) continue;

    files.push(fullPath);
  }

  return files;
}

function filePathToRoutePath(filePath: string): string {
  const rel = toPosixPath(relative(API_DIR, filePath));
  const withoutExt = rel.replace(/\.ts$/, "");
  const rawSegments = withoutExt.split("/").filter(Boolean);

  const segments = rawSegments
    .filter(
      (segment, index) =>
        !(segment === "index" && index === rawSegments.length - 1),
    )
    .map((segment) => {
      const optionalCatchAll = /^\[\[(.+)\]\]$/.exec(segment);
      if (optionalCatchAll) return `{${optionalCatchAll[1]}}`;

      const dynamic = /^\[(.+)\]$/.exec(segment);
      if (dynamic) return `{${dynamic[1]}}`;

      return segment;
    });

  const routePath = `/api/${segments.join("/")}`;
  if (routePath === "/api/") return "/api";
  return routePath;
}

function extractMethods(source: string): HttpMethod[] {
  const methods = new Set<HttpMethod>();
  const re =
    /export\s+const\s+onRequest(Get|Post|Put|Patch|Delete|Options|Head)\b/g;

  let match: RegExpExecArray | null;
  while ((match = re.exec(source)) !== null) {
    methods.add(match[1].toLowerCase() as HttpMethod);
  }

  return [...methods].sort(
    (a, b) => METHODS_ORDER.indexOf(a) - METHODS_ORDER.indexOf(b),
  );
}

function deriveTags(routePath: string): string[] {
  const segments = routePath.split("/").filter(Boolean);
  const afterApi = segments.slice(1);

  if (afterApi[0] === "admin") {
    if (afterApi[1]) return ["admin", afterApi[1]];
    return ["admin"];
  }

  if (afterApi[0] === "v2") {
    if (afterApi[1]) return ["v2", afterApi[1]];
    return ["v2"];
  }

  if (afterApi[0]) return [afterApi[0]];
  return ["public"];
}

function toOperationId(method: HttpMethod, routePath: string): string {
  let pathWithoutPrefix = routePath;
  if (routePath.startsWith("/api/")) {
    pathWithoutPrefix = routePath.slice("/api/".length);
  } else if (routePath === "/api") {
    pathWithoutPrefix = "";
  }

  const cleanedPath = pathWithoutPrefix
    .replaceAll("{", "by-")
    .replaceAll("}", "")
    .replaceAll(/[^a-zA-Z0-9]+/g, "-")
    .replaceAll(/^-+|-+$/g, "")
    .toLowerCase();

  return `${method}-${cleanedPath || "root"}`;
}

function getOperationMetadata(
  method: HttpMethod,
  routePath: string,
): OperationMetadata | undefined {
  return OPERATION_METADATA[`${method} ${routePath}`];
}

function buildOperation(
  method: HttpMethod,
  routePath: string,
  tags: string[],
): EndpointOperation {
  const isAdmin = routePath.startsWith("/api/admin");
  const metadata = getOperationMetadata(method, routePath);
  const operation: EndpointOperation = {
    operationId: toOperationId(method, routePath),
    summary: metadata?.summary ?? `${method.toUpperCase()} ${routePath}`,
    tags: metadata?.tags ?? tags,
    responses: {
      "200": {
        description: "Success response",
        content: {
          "application/json": {
            schema: {
              ...(metadata?.responseSchema ?? GENERIC_OBJECT_SCHEMA),
            },
          },
        },
      },
      "400": {
        $ref: "#/components/responses/BadRequest",
      },
      "500": {
        $ref: "#/components/responses/InternalError",
      },
    },
  };

  if (isAdmin) {
    operation.security = [{ basicAuth: [] }];
  }

  if (!["get", "head", "options"].includes(method)) {
    const requestSchema = metadata?.requestSchema ?? GENERIC_OBJECT_SCHEMA;
    operation.requestBody = {
      required: true,
      content: {
        "application/json": {
          schema: requestSchema,
        },
      },
    };
  }

  return operation;
}

function sortObjectKeys<T>(value: Record<string, T>): Record<string, T> {
  const sortedEntries = Object.entries(value).sort(([a], [b]) =>
    a.localeCompare(b),
  );
  return Object.fromEntries(sortedEntries);
}

function readPackageVersion(): string {
  const raw = readFileSync(PACKAGE_JSON_PATH, "utf-8");
  const parsed = JSON.parse(raw) as { version?: string };
  return parsed.version ?? "0.0.0";
}

export function collectEndpointInventory(): EndpointEntry[] {
  const files = collectTsFiles(API_DIR);
  const entries: EndpointEntry[] = [];

  for (const filePath of files) {
    const source = readFileSync(filePath, "utf-8");
    const methods = extractMethods(source);
    if (methods.length === 0) continue;

    const routePath = filePathToRoutePath(filePath);
    entries.push({
      filePath: toPosixPath(relative(ROOT_DIR, filePath)),
      routePath,
      methods,
      domain: routePath.startsWith("/api/admin") ? "admin" : "public",
      tags: deriveTags(routePath),
    });
  }

  return entries.sort(
    (a, b) =>
      a.routePath.localeCompare(b.routePath) ||
      a.filePath.localeCompare(b.filePath),
  );
}

export function buildArtifacts(): GenerationArtifacts {
  const version = readPackageVersion();
  const inventory = collectEndpointInventory();

  const paths: Record<string, Record<string, EndpointOperation>> = {};

  for (const endpoint of inventory) {
    if (!paths[endpoint.routePath]) {
      paths[endpoint.routePath] = {};
    }

    for (const method of endpoint.methods) {
      paths[endpoint.routePath][method] = buildOperation(
        method,
        endpoint.routePath,
        endpoint.tags,
      );
    }

    paths[endpoint.routePath] = sortObjectKeys(paths[endpoint.routePath]);
  }

  const sortedPaths = sortObjectKeys(paths);

  const openapi = {
    openapi: "3.1.0",
    info: {
      title: "Guess API",
      version,
      description:
        "Auto-generated API contract from Cloudflare Pages function handlers.",
    },
    servers: [
      { url: "/", description: "Same origin (Cloudflare Pages/Workers)" },
    ],
    tags: [
      { name: "admin", description: "Admin endpoints under /api/admin/*" },
      { name: "v2", description: "Version 2 public API" },
      { name: "public", description: "Public non-versioned API" },
    ],
    paths: sortedPaths,
    components: {
      securitySchemes: {
        basicAuth: {
          type: "http",
          scheme: "basic",
        },
      },
      schemas: {
        ErrorResponse: {
          type: "object",
          properties: {
            error: { type: "string" },
            requestId: { type: "string" },
          },
          required: ["error"],
          additionalProperties: true,
        },
      },
      responses: {
        BadRequest: {
          description: "Invalid request payload or query.",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/ErrorResponse" },
            },
          },
        },
        InternalError: {
          description: "Unexpected internal server error.",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/ErrorResponse" },
            },
          },
        },
      },
    },
  };

  const openapiJson = `${JSON.stringify(openapi, null, 2)}\n`;
  const openapiYaml = openapiJson;
  const inventoryJson = `${JSON.stringify(
    {
      endpointCount: inventory.length,
      endpoints: inventory,
    },
    null,
    2,
  )}\n`;

  return {
    openapiJson,
    openapiYaml,
    inventoryJson,
  };
}

export function writeArtifacts(artifacts: GenerationArtifacts): void {
  writeFileSync(join(DOCS_DIR, "openapi.json"), artifacts.openapiJson);
  writeFileSync(join(DOCS_DIR, "openapi.yaml"), artifacts.openapiYaml);
  writeFileSync(join(PUBLIC_DIR, "openapi.yaml"), artifacts.openapiYaml);
  writeFileSync(
    join(DOCS_DIR, "openapi-inventory.json"),
    artifacts.inventoryJson,
  );
}

export function readArtifact(pathParts: string[]): string | null {
  const path = resolve(ROOT_DIR, ...pathParts);
  try {
    return readFileSync(path, "utf-8");
  } catch {
    return null;
  }
}
