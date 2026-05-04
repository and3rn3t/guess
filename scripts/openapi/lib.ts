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

const DAILY_GET_RESPONSE_SCHEMA: Record<string, unknown> = {
  type: "object",
  properties: {
    date: { type: "string" },
    characterId: { type: "string" },
    completed: { type: "boolean" },
    result: {
      oneOf: [
        {
          type: "object",
          properties: {
            won: { type: "boolean" },
            questionsAsked: { type: "number" },
            completedAt: { type: "number" },
          },
          required: ["won", "questionsAsked", "completedAt"],
          additionalProperties: false,
        },
        { type: "null" },
      ],
    },
    revealedCharacter: {
      oneOf: [
        {
          type: "object",
          properties: {
            id: { type: "string" },
            name: { type: "string" },
            imageUrl: { type: ["string", "null"] },
          },
          required: ["id", "name", "imageUrl"],
          additionalProperties: false,
        },
        { type: "null" },
      ],
    },
  },
  required: ["date", "characterId", "completed", "result", "revealedCharacter"],
  additionalProperties: false,
};

const DAILY_POST_RESPONSE_SCHEMA: Record<string, unknown> = {
  type: "object",
  properties: {
    ok: { type: "boolean" },
    date: { type: "string" },
    characterId: { type: "string" },
  },
  required: ["ok", "date", "characterId"],
  additionalProperties: false,
};

const DAILY_LEADERBOARD_RESPONSE_SCHEMA: Record<string, unknown> = {
  type: "object",
  properties: {
    date: { type: "string" },
    leaderboard: {
      type: "array",
      items: {
        type: "object",
        properties: {
          rank: { type: "number" },
          userLabel: { type: "string" },
          won: { type: "boolean" },
          questionsAsked: { type: "number" },
          completedAt: { type: "number" },
          isYou: { type: "boolean" },
        },
        required: [
          "rank",
          "userLabel",
          "won",
          "questionsAsked",
          "completedAt",
          "isYou",
        ],
        additionalProperties: false,
      },
    },
  },
  required: ["date", "leaderboard"],
  additionalProperties: false,
};

const EVENTS_BATCH_RESPONSE_SCHEMA: Record<string, unknown> = {
  type: "object",
  properties: {
    accepted: { type: "number" },
  },
  required: ["accepted"],
  additionalProperties: false,
};

const HISTORY_RESPONSE_SCHEMA: Record<string, unknown> = {
  type: "object",
  properties: {
    games: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "string" },
          characterId: { type: "string" },
          characterName: { type: "string" },
          won: { type: "boolean" },
          difficulty: { type: "string" },
          questionsAsked: { type: "number" },
          poolSize: { type: "number" },
          steps: {
            type: "array",
            items: {
              type: "object",
              properties: {
                questionText: { type: "string" },
                attribute: { type: "string" },
                answer: { type: "string" },
              },
              required: ["questionText", "attribute", "answer"],
              additionalProperties: false,
            },
          },
          timestamp: { type: "number" },
        },
        required: [
          "id",
          "characterId",
          "characterName",
          "won",
          "difficulty",
          "questionsAsked",
          "poolSize",
          "steps",
          "timestamp",
        ],
        additionalProperties: false,
      },
    },
    total: { type: "number" },
  },
  required: ["games", "total"],
  additionalProperties: false,
};

const QUESTIONS_LIST_ITEM_SCHEMA: Record<string, unknown> = {
  type: "object",
  properties: {
    id: { type: "number" },
    text: { type: "string" },
    attribute_key: { type: "string" },
    priority: { type: "number" },
  },
  required: ["id", "text", "attribute_key", "priority"],
  additionalProperties: false,
};

const QUESTIONS_WITH_COVERAGE_ITEM_SCHEMA: Record<string, unknown> = {
  ...QUESTIONS_LIST_ITEM_SCHEMA,
  properties: {
    ...(QUESTIONS_LIST_ITEM_SCHEMA.properties as Record<string, unknown>),
    total_characters: { type: "number" },
    filled_count: { type: "number" },
    coverage_pct: { type: "number" },
  },
  required: [
    "id",
    "text",
    "attribute_key",
    "priority",
    "total_characters",
    "filled_count",
    "coverage_pct",
  ],
};

const QUESTIONS_RESPONSE_SCHEMA: Record<string, unknown> = {
  oneOf: [
    {
      type: "array",
      items: QUESTIONS_LIST_ITEM_SCHEMA,
    },
    {
      type: "array",
      items: QUESTIONS_WITH_COVERAGE_ITEM_SCHEMA,
    },
  ],
};

const ATTRIBUTES_RESPONSE_SCHEMA: Record<string, unknown> = {
  oneOf: [
    {
      type: "array",
      items: {
        type: "object",
        properties: {
          key: { type: "string" },
          display_text: { type: "string" },
          question_text: { type: ["string", "null"] },
          categories: { type: ["string", "null"] },
          created_at: { type: ["number", "null"] },
        },
        required: ["key", "display_text"],
        additionalProperties: true,
      },
    },
    {
      type: "array",
      items: {
        type: "object",
        properties: {
          key: { type: "string" },
          display_text: { type: "string" },
          total_characters: { type: "number" },
          filled_count: { type: "number" },
          true_count: { type: "number" },
          false_count: { type: "number" },
          null_count: { type: "number" },
          coverage_pct: { type: "number" },
        },
        required: [
          "key",
          "display_text",
          "total_characters",
          "filled_count",
          "true_count",
          "false_count",
          "null_count",
          "coverage_pct",
        ],
        additionalProperties: false,
      },
    },
  ],
};

const CHARACTER_BASE_SCHEMA: Record<string, unknown> = {
  type: "object",
  properties: {
    id: { type: "string" },
    name: { type: "string" },
    category: { type: "string" },
  },
  required: ["id", "name", "category"],
  additionalProperties: true,
};

const CHARACTERS_GET_RESPONSE_SCHEMA: Record<string, unknown> = {
  oneOf: [
    {
      type: "object",
      properties: {
        ...(CHARACTER_BASE_SCHEMA.properties as Record<string, unknown>),
        attributes: {
          type: "object",
          additionalProperties: {
            oneOf: [{ type: "boolean" }, { type: "null" }],
          },
        },
      },
      required: ["id", "name", "category", "attributes"],
      additionalProperties: true,
    },
    {
      type: "object",
      properties: {
        characters: {
          type: "array",
          items: CHARACTER_BASE_SCHEMA,
        },
        total: { type: "number" },
        limit: { type: "number" },
        offset: { type: "number" },
      },
      required: ["characters", "total", "limit", "offset"],
      additionalProperties: false,
    },
  ],
};

const CHARACTERS_POST_REQUEST_SCHEMA: Record<string, unknown> = {
  type: "object",
  properties: {
    name: { type: "string", minLength: 2, maxLength: 50 },
    category: { type: "string" },
    description: { type: "string", maxLength: 2000 },
    attributes: {
      type: "object",
      additionalProperties: {
        oneOf: [{ type: "boolean" }, { type: "null" }],
      },
    },
  },
  required: ["name", "category", "attributes"],
  additionalProperties: false,
};

const CHARACTERS_POST_RESPONSE_SCHEMA: Record<string, unknown> = {
  type: "object",
  properties: {
    id: { type: "string" },
    name: { type: "string" },
    category: { type: "string" },
    description: { type: ["string", "null"] },
  },
  required: ["id", "name", "category", "description"],
  additionalProperties: false,
};

const REVEAL_REQUEST_SCHEMA: Record<string, unknown> = {
  type: "object",
  properties: {
    characterName: { type: "string", minLength: 1 },
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
  required: ["characterName", "answers"],
  additionalProperties: false,
};

const REVEAL_RESPONSE_SCHEMA: Record<string, unknown> = {
  type: "object",
  properties: {
    found: { type: "boolean" },
    characterId: { type: ["string", "null"] },
    characterName: { type: ["string", "null"] },
    attributesFilled: { type: "number" },
    discrepancies: { type: "number" },
  },
  required: [
    "found",
    "characterId",
    "characterName",
    "attributesFilled",
    "discrepancies",
  ],
  additionalProperties: false,
};

const STATS_RESPONSE_SCHEMA: Record<string, unknown> = {
  type: "object",
  properties: {
    characters: { type: "number" },
    attributes: { type: "number" },
    questions: { type: "number" },
    characterAttributes: {
      type: "object",
      properties: {
        total: { type: "number" },
        filled: { type: "number" },
        fillRate: { type: "number" },
      },
      required: ["total", "filled", "fillRate"],
      additionalProperties: false,
    },
    byCategory: {
      type: "array",
      items: {
        type: "object",
        properties: {
          category: { type: "string" },
          count: { type: "number" },
        },
        required: ["category", "count"],
        additionalProperties: false,
      },
    },
    bySource: {
      type: "array",
      items: {
        type: "object",
        properties: {
          source: { type: "string" },
          count: { type: "number" },
        },
        required: ["source", "count"],
        additionalProperties: false,
      },
    },
    gameStats: {
      oneOf: [
        {
          type: "object",
          properties: {
            totalGames: { type: "number" },
            wins: { type: "number" },
            winRate: { type: "number" },
            avgQuestions: { type: "number" },
            avgPoolSize: { type: "number" },
          },
          required: ["totalGames", "wins", "winRate", "avgQuestions", "avgPoolSize"],
          additionalProperties: true,
        },
        { type: "null" },
      ],
    },
    confusion: {
      oneOf: [
        {
          type: "array",
          items: {
            type: "object",
            properties: {
              targetName: { type: "string" },
              secondBestName: { type: "string" },
              count: { type: "number" },
              lossRate: { type: "number" },
            },
            required: ["targetName", "secondBestName", "count", "lossRate"],
            additionalProperties: false,
          },
        },
        { type: "null" },
      ],
    },
    calibration: {
      oneOf: [
        {
          type: "array",
          items: {
            type: "object",
            properties: {
              difficulty: { type: "string" },
              realGames: { type: "number" },
              realWinRate: { type: "number" },
              realAvgQ: { type: "number" },
              simGames: { type: "number" },
              simWinRate: { type: "number" },
              simAvgQ: { type: "number" },
            },
            required: [
              "difficulty",
              "realGames",
              "realWinRate",
              "realAvgQ",
              "simGames",
              "simWinRate",
              "simAvgQ",
            ],
            additionalProperties: false,
          },
        },
        { type: "null" },
      ],
    },
  },
  required: [
    "characters",
    "attributes",
    "questions",
    "characterAttributes",
    "byCategory",
    "bySource",
    "gameStats",
    "confusion",
    "calibration",
  ],
  additionalProperties: false,
};

const ADMIN_ABOUT_RESPONSE_SCHEMA: Record<string, unknown> = {
  type: "object",
  properties: {
    appVersion: { type: "string" },
    schemaVersion: { type: "number" },
    lastEnrichmentRun: {
      type: "object",
      properties: {
        timestamp: { type: ["number", "null"] },
        batchId: { type: ["string", "null"] },
      },
      required: ["timestamp", "batchId"],
      additionalProperties: false,
    },
    lastCronRun: {
      type: "object",
      properties: {
        timestamp: { type: ["number", "null"] },
        name: { type: ["string", "null"] },
      },
      required: ["timestamp", "name"],
      additionalProperties: false,
    },
    lastD1Backup: {
      type: "object",
      properties: {
        timestamp: { type: ["number", "null"] },
      },
      required: ["timestamp"],
      additionalProperties: false,
    },
  },
  required: [
    "appVersion",
    "schemaVersion",
    "lastEnrichmentRun",
    "lastCronRun",
    "lastD1Backup",
  ],
  additionalProperties: false,
};

const DATA_QUALITY_SLA_RESPONSE_SCHEMA: Record<string, unknown> = {
  type: "object",
  properties: {
    targets: {
      type: "array",
      items: {
        type: "object",
        properties: {
          attributeKey: { type: "string" },
          displayName: { type: "string" },
          category: { type: "string" },
          target: { type: "number" },
        },
        required: ["attributeKey", "displayName", "category", "target"],
        additionalProperties: false,
      },
    },
  },
  required: ["targets"],
  additionalProperties: false,
};

const IMAGE_HEALTH_RESPONSE_SCHEMA: Record<string, unknown> = {
  type: "object",
  properties: {
    generatedAt: { type: "string" },
    totals: {
      type: "object",
      properties: {
        totalCharacters: { type: "number" },
        withImage: { type: "number" },
        validR2Url: { type: "number" },
        missingUrl: { type: "number" },
        invalidUrl: { type: "number" },
        externalUrl: { type: "number" },
        usablePct: { type: "number" },
      },
      required: [
        "totalCharacters",
        "withImage",
        "validR2Url",
        "missingUrl",
        "invalidUrl",
        "externalUrl",
        "usablePct",
      ],
      additionalProperties: false,
    },
    perCategory: {
      type: "array",
      items: {
        type: "object",
        properties: {
          category: { type: "string" },
          total: { type: "number" },
          withImage: { type: "number" },
          validR2Url: { type: "number" },
          imageCoveragePct: { type: "number" },
        },
        required: ["category", "total", "withImage", "validR2Url", "imageCoveragePct"],
        additionalProperties: false,
      },
    },
    issues: {
      type: "array",
      items: {
        type: "object",
        properties: {
          characterId: { type: "string" },
          characterName: { type: "string" },
          category: { type: "string" },
          issueType: { type: "string", enum: ["missing-url", "invalid-url", "external-url"] },
          reason: { type: "string" },
          popularity: { type: "number" },
          createdAt: { type: "number" },
        },
        required: [
          "characterId",
          "characterName",
          "category",
          "issueType",
          "reason",
          "popularity",
          "createdAt",
        ],
        additionalProperties: false,
      },
    },
    fetchedAt: { type: "number" },
    issueLimit: { type: "number" },
  },
  required: ["generatedAt", "totals", "perCategory", "issues", "fetchedAt", "issueLimit"],
  additionalProperties: false,
};

const SOURCE_HEALTH_REPORT_SCHEMA: Record<string, unknown> = {
  type: "object",
  properties: {
    generatedAt: { type: "string" },
    totals: {
      type: "object",
      properties: {
        totalCharacters: { type: "number" },
        validCharacters: { type: "number" },
        issueCount: { type: "number" },
        coveragePct: { type: "number" },
      },
      required: ["totalCharacters", "validCharacters", "issueCount", "coveragePct"],
      additionalProperties: false,
    },
    perSource: {
      type: "array",
      items: {
        type: "object",
        properties: {
          source: { type: "string" },
          total: { type: "number" },
          valid: { type: "number" },
          missing: { type: "number" },
          malformed: { type: "number" },
          coveragePct: { type: "number" },
        },
        required: ["source", "total", "valid", "missing", "malformed", "coveragePct"],
        additionalProperties: false,
      },
    },
    issues: {
      type: "array",
      items: {
        type: "object",
        properties: {
          characterId: { type: "string" },
          characterName: { type: "string" },
          category: { type: "string" },
          source: { type: "string" },
          sourceId: { type: ["string", "null"] },
          issueType: {
            type: "string",
            enum: [
              "missing-source",
              "missing-source-id",
              "malformed-source-id",
              "unknown-source",
            ],
          },
          reason: { type: "string" },
          popularity: { type: "number" },
          agedDays: { type: "number" },
          createdAt: { type: "number" },
        },
        required: [
          "characterId",
          "characterName",
          "category",
          "source",
          "sourceId",
          "issueType",
          "reason",
          "popularity",
          "agedDays",
          "createdAt",
        ],
        additionalProperties: false,
      },
    },
  },
  required: ["generatedAt", "totals", "perSource", "issues"],
  additionalProperties: false,
};

const SOURCE_HEALTH_RESPONSE_SCHEMA: Record<string, unknown> = {
  type: "object",
  properties: {
    ...(SOURCE_HEALTH_REPORT_SCHEMA.properties as Record<string, unknown>),
    fetchedAt: { type: "number" },
    issueLimit: { type: "number" },
  },
  required: ["generatedAt", "totals", "perSource", "issues", "fetchedAt", "issueLimit"],
  additionalProperties: false,
};

const SOURCE_HEALTH_STATUS_RESPONSE_SCHEMA: Record<string, unknown> = {
  type: "object",
  properties: {
    report: {
      oneOf: [SOURCE_HEALTH_REPORT_SCHEMA, { type: "null" }],
    },
    fetchedAt: { type: "number" },
  },
  required: ["report", "fetchedAt"],
  additionalProperties: false,
};

const CURATOR_QUEUE_REPORT_SCHEMA: Record<string, unknown> = {
  type: "object",
  properties: {
    totals: {
      type: "object",
      properties: {
        totalItems: { type: "number" },
        unresolved: { type: "number" },
        assigned: { type: "number" },
        locked: { type: "number" },
        avgAgedDays: { type: "number" },
      },
      required: ["totalItems", "unresolved", "assigned", "locked", "avgAgedDays"],
      additionalProperties: false,
    },
    perIssueType: {
      type: "object",
      properties: {
        cannot_infer: {
          type: "object",
          properties: {
            count: { type: "number" },
            percentOfTotal: { type: "number" },
          },
          required: ["count", "percentOfTotal"],
          additionalProperties: false,
        },
        canon_conflict: {
          type: "object",
          properties: {
            count: { type: "number" },
            percentOfTotal: { type: "number" },
          },
          required: ["count", "percentOfTotal"],
          additionalProperties: false,
        },
        subjective: {
          type: "object",
          properties: {
            count: { type: "number" },
            percentOfTotal: { type: "number" },
          },
          required: ["count", "percentOfTotal"],
          additionalProperties: false,
        },
      },
      required: ["cannot_infer", "canon_conflict", "subjective"],
      additionalProperties: false,
    },
    items: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "number" },
          characterId: { type: "string" },
          attributeKey: { type: "string" },
          issueType: { type: "string", enum: ["cannot_infer", "canon_conflict", "subjective"] },
          issueReason: { type: "string" },
          category: { type: "string" },
          assignedTo: { type: ["string", "null"] },
          resolvedAt: { type: ["number", "null"] },
          resolutionReason: { type: ["string", "null"] },
          locked: { type: "boolean" },
          lockedUntil: { type: ["number", "null"] },
          lockReason: { type: ["string", "null"] },
          createdAt: { type: "number" },
          agedDays: { type: "number" },
          popularity: { type: "number" },
          priorityScore: { type: "number" },
        },
        required: [
          "id",
          "characterId",
          "attributeKey",
          "issueType",
          "issueReason",
          "category",
          "assignedTo",
          "resolvedAt",
          "resolutionReason",
          "locked",
          "lockedUntil",
          "lockReason",
          "createdAt",
          "agedDays",
          "popularity",
          "priorityScore",
        ],
        additionalProperties: false,
      },
    },
  },
  required: ["totals", "perIssueType", "items"],
  additionalProperties: false,
};

const CURATOR_QUEUE_GET_RESPONSE_SCHEMA: Record<string, unknown> = {
  type: "object",
  properties: {
    report: CURATOR_QUEUE_REPORT_SCHEMA,
    fetchedAt: { type: "number" },
    limit: { type: "number" },
  },
  required: ["report", "fetchedAt", "limit"],
  additionalProperties: false,
};

const CURATOR_QUEUE_POST_REQUEST_SCHEMA: Record<string, unknown> = {
  type: "object",
  properties: {
    assignedTo: { type: "string" },
    reason: { type: "string" },
    value: { type: "string" },
    durationMinutes: { type: "number" },
  },
  additionalProperties: false,
};

const CURATOR_QUEUE_POST_RESPONSE_SCHEMA: Record<string, unknown> = {
  oneOf: [
    {
      type: "object",
      properties: {
        success: { const: true },
        id: { type: "number" },
        assignedTo: { type: "string" },
      },
      required: ["success", "id", "assignedTo"],
      additionalProperties: false,
    },
    {
      type: "object",
      properties: {
        success: { const: true },
        id: { type: "number" },
        resolvedAt: { type: "number" },
      },
      required: ["success", "id", "resolvedAt"],
      additionalProperties: false,
    },
    {
      type: "object",
      properties: {
        success: { const: true },
        id: { type: "number" },
        lockedUntil: { type: "number" },
      },
      required: ["success", "id", "lockedUntil"],
      additionalProperties: false,
    },
    {
      type: "object",
      properties: {
        success: { const: true },
        id: { type: "number" },
        lockedUntil: { type: "null" },
      },
      required: ["success", "id", "lockedUntil"],
      additionalProperties: false,
    },
  ],
};

const JSON_ANY_SCHEMA: Record<string, unknown> = {
  oneOf: [
    { type: "object", additionalProperties: true },
    { type: "array", items: {} },
    { type: "string" },
    { type: "number" },
    { type: "boolean" },
    { type: "null" },
  ],
};

const AUTOMATION_STATUS_RESPONSE_SCHEMA: Record<string, unknown> = {
  type: "object",
  properties: {
    report: JSON_ANY_SCHEMA,
    fetchedAt: { type: "number" },
  },
  required: ["report", "fetchedAt"],
  additionalProperties: false,
};

const ANALYTICS_EVENT_SCHEMA: Record<string, unknown> = {
  type: "object",
  properties: {
    id: { type: "string" },
    session_id: { type: ["string", "null"] },
    user_id: { type: ["string", "null"] },
    event_type: { type: "string" },
    data: { type: ["string", "null"] },
    client_ts: { type: ["number", "null"] },
    created_at: { type: "number" },
  },
  required: ["id", "session_id", "user_id", "event_type", "data", "client_ts", "created_at"],
  additionalProperties: false,
};

const ANALYTICS_SUMMARY_ITEM_SCHEMA: Record<string, unknown> = {
  type: "object",
  properties: {
    event_type: { type: "string" },
    count: { type: "number" },
  },
  required: ["event_type", "count"],
  additionalProperties: false,
};

const ANALYTICS_GET_RESPONSE_SCHEMA: Record<string, unknown> = {
  type: "object",
  properties: {
    events: {
      type: "array",
      items: ANALYTICS_EVENT_SCHEMA,
    },
    total: { type: "number" },
    page: { type: "number" },
    pageSize: { type: "number" },
    summary: {
      type: "array",
      items: ANALYTICS_SUMMARY_ITEM_SCHEMA,
    },
    filters: {
      type: "object",
      properties: {
        eventType: { type: "string" },
        q: { type: "string" },
        days: { type: "number" },
      },
      required: ["eventType", "q", "days"],
      additionalProperties: false,
    },
    aggregates: {
      type: "object",
      properties: {
        uniqueSessions: { type: "number" },
        uniqueUsers: { type: "number" },
      },
      required: ["uniqueSessions", "uniqueUsers"],
      additionalProperties: false,
    },
  },
  required: ["events", "total", "page", "pageSize", "summary", "filters", "aggregates"],
  additionalProperties: false,
};

const ANALYTICS_AHA_MOMENTS_RESPONSE_SCHEMA: Record<string, unknown> = {
  type: "object",
  properties: {
    moments: {
      type: "array",
      items: {
        type: "object",
        properties: {
          attribute: { type: "string" },
          count: { type: "number" },
          medianJump: { type: "number" },
          avgJump: { type: "number" },
        },
        required: ["attribute", "count", "medianJump", "avgJump"],
        additionalProperties: false,
      },
    },
  },
  required: ["moments"],
  additionalProperties: false,
};

const ANALYTICS_INSIGHTS_REQUEST_SCHEMA: Record<string, unknown> = {
  type: "object",
  properties: {
    summary: {
      type: "array",
      items: ANALYTICS_SUMMARY_ITEM_SCHEMA,
    },
    totalGames7d: { type: "number" },
    bustCache: { type: "boolean" },
  },
  additionalProperties: false,
};

const ANALYTICS_INSIGHTS_RESPONSE_SCHEMA: Record<string, unknown> = {
  type: "object",
  properties: {
    insights: { type: "string" },
    generated_at: { type: "number" },
  },
  required: ["insights", "generated_at"],
  additionalProperties: false,
};

const ATTRIBUTE_DISPUTE_ROW_SCHEMA: Record<string, unknown> = {
  type: "object",
  properties: {
    id: { type: "number" },
    character_id: { type: "string" },
    attribute_key: { type: "string" },
    current_value: { oneOf: [{ type: "boolean" }, { type: "string" }, { type: "number" }, { type: "null" }] },
    dispute_reason: { type: ["string", "null"] },
    confidence: { type: ["number", "null"] },
    disputed_by: { type: ["string", "null"] },
    created_at: { type: "number" },
    status: { type: "string" },
    resolved_by: { type: ["string", "null"] },
    resolved_at: { type: ["number", "null"] },
    character_name: { type: ["string", "null"] },
  },
  required: [
    "id",
    "character_id",
    "attribute_key",
    "current_value",
    "dispute_reason",
    "confidence",
    "disputed_by",
    "created_at",
    "status",
    "resolved_by",
    "resolved_at",
    "character_name",
  ],
  additionalProperties: false,
};

const ATTRIBUTE_DISPUTES_GET_RESPONSE_SCHEMA: Record<string, unknown> = {
  type: "object",
  properties: {
    disputes: {
      type: "array",
      items: ATTRIBUTE_DISPUTE_ROW_SCHEMA,
    },
    total: { type: "number" },
    page: { type: "number" },
    pageSize: { type: "number" },
  },
  required: ["disputes", "total", "page", "pageSize"],
  additionalProperties: false,
};

const ATTRIBUTE_DISPUTES_PATCH_REQUEST_SCHEMA: Record<string, unknown> = {
  type: "object",
  properties: {
    id: { type: "number" },
    status: { type: "string", enum: ["resolved", "dismissed"] },
    resolved_by: { type: "string" },
  },
  required: ["id", "status"],
  additionalProperties: false,
};

const ATTRIBUTE_DISPUTES_PATCH_RESPONSE_SCHEMA: Record<string, unknown> = {
  type: "object",
  properties: {
    ok: { type: "boolean" },
  },
  required: ["ok"],
  additionalProperties: false,
};

const ATTRIBUTE_DISPUTES_AI_REQUEST_SCHEMA: Record<string, unknown> = {
  type: "object",
  properties: {
    characterName: { type: "string" },
    attributeKey: { type: "string" },
    currentValue: { oneOf: [{ type: "boolean" }, { type: "null" }] },
    disputeReason: { type: "string" },
    confidence: { type: "number" },
  },
  required: ["characterName", "attributeKey"],
  additionalProperties: false,
};

const ATTRIBUTE_DISPUTES_AI_RESPONSE_SCHEMA: Record<string, unknown> = {
  type: "object",
  properties: {
    correct: { type: "string", enum: ["current", "flagged"] },
    confidence: { type: "number" },
    reason: { type: "string" },
  },
  required: ["correct", "confidence", "reason"],
  additionalProperties: false,
};

const ERROR_LOG_ROW_SCHEMA: Record<string, unknown> = {
  type: "object",
  properties: {
    id: { type: "number" },
    level: { type: "string" },
    source: { type: "string" },
    message: { type: "string" },
    detail: { type: ["string", "null"] },
    created_at: { type: "number" },
  },
  required: ["id", "level", "source", "message", "detail", "created_at"],
  additionalProperties: false,
};

const ERROR_LOGS_GET_RESPONSE_SCHEMA: Record<string, unknown> = {
  type: "object",
  properties: {
    logs: {
      type: "array",
      items: ERROR_LOG_ROW_SCHEMA,
    },
    total: { type: "number" },
    page: { type: "number" },
    pageSize: { type: "number" },
    sources: {
      type: "array",
      items: { type: "string" },
    },
  },
  required: ["logs", "total", "page", "pageSize", "sources"],
  additionalProperties: false,
};

const WORKFLOW_PROGRESS_RECORD_SCHEMA: Record<string, unknown> = {
  type: "object",
  properties: {
    activeTo: { type: ["string", "null"] },
    completed: { type: "boolean" },
  },
  required: ["activeTo", "completed"],
  additionalProperties: false,
};

const WORKFLOW_PROGRESS_MAP_SCHEMA: Record<string, unknown> = {
  type: "object",
  additionalProperties: WORKFLOW_PROGRESS_RECORD_SCHEMA,
};

const WORKFLOW_PROGRESS_GET_RESPONSE_SCHEMA: Record<string, unknown> = {
  type: "object",
  properties: {
    progress: WORKFLOW_PROGRESS_MAP_SCHEMA,
    updatedAt: { type: ["number", "null"] },
    updatedBy: { type: ["string", "null"] },
  },
  required: ["progress", "updatedAt", "updatedBy"],
  additionalProperties: false,
};

const WORKFLOW_PROGRESS_POST_REQUEST_SCHEMA: Record<string, unknown> = {
  type: "object",
  properties: {
    progress: WORKFLOW_PROGRESS_MAP_SCHEMA,
  },
  required: ["progress"],
  additionalProperties: false,
};

const WORKFLOW_PROGRESS_POST_RESPONSE_SCHEMA: Record<string, unknown> = {
  type: "object",
  properties: {
    ok: { type: "boolean" },
    progress: WORKFLOW_PROGRESS_MAP_SCHEMA,
    updatedAt: { type: "number" },
    updatedBy: { type: "string" },
  },
  required: ["ok", "progress", "updatedAt", "updatedBy"],
  additionalProperties: false,
};

const LIVE_OPS_RESPONSE_SCHEMA: Record<string, unknown> = {
  type: "object",
  properties: {
    games1h: { type: "number" },
    wins1h: { type: "number" },
    losses1h: { type: "number" },
    errors1h: { type: "number" },
    warns1h: { type: "number" },
    gamesPerMin: { type: "number" },
    winRate: { type: ["number", "null"] },
    errorsPerMin: { type: "number" },
    errorRate: { type: ["number", "null"] },
    p95LatencyMs: { type: ["number", "null"] },
    telemetryErrors1h: { type: ["number", "null"] },
    loggingGap: { type: ["boolean", "null"] },
    generatedAt: { type: "number" },
  },
  required: [
    "games1h",
    "wins1h",
    "losses1h",
    "errors1h",
    "warns1h",
    "gamesPerMin",
    "winRate",
    "errorsPerMin",
    "errorRate",
    "p95LatencyMs",
    "telemetryErrors1h",
    "loggingGap",
    "generatedAt",
  ],
  additionalProperties: false,
};

const DAILY_COST_USAGE_SCHEMA: Record<string, unknown> = {
  type: "object",
  properties: {
    date: { type: "string" },
    promptTokens: { type: "number" },
    completionTokens: { type: "number" },
    calls: { type: "number" },
  },
  required: ["date", "promptTokens", "completionTokens", "calls"],
  additionalProperties: false,
};

const COSTS_RESPONSE_SCHEMA: Record<string, unknown> = {
  type: "object",
  properties: {
    source: { type: "string" },
    windowDays: { type: "number" },
    today: DAILY_COST_USAGE_SCHEMA,
    totals: {
      type: "object",
      properties: {
        promptTokens: { type: "number" },
        completionTokens: { type: "number" },
        calls: { type: "number" },
      },
      required: ["promptTokens", "completionTokens", "calls"],
      additionalProperties: false,
    },
    history: {
      type: "array",
      items: DAILY_COST_USAGE_SCHEMA,
    },
  },
  required: ["source", "windowDays", "today", "totals", "history"],
  additionalProperties: false,
};

const FUNNEL_RESPONSE_SCHEMA: Record<string, unknown> = {
  type: "object",
  properties: {
    windowDays: { type: "number" },
    totals: {
      type: "object",
      properties: {
        gameStarts: { type: "number" },
        gameEnds: { type: "number" },
        gameAbandons: { type: "number" },
        questionSkips: { type: "number" },
        completionRate: { type: "number" },
        abandonRate: { type: "number" },
        avgSkipsPerGame: { type: "number" },
      },
      required: [
        "gameStarts",
        "gameEnds",
        "gameAbandons",
        "questionSkips",
        "completionRate",
        "abandonRate",
        "avgSkipsPerGame",
      ],
      additionalProperties: false,
    },
    daily: {
      type: "array",
      items: {
        type: "object",
        properties: {
          day: { type: "string" },
          starts: { type: "number" },
          ends: { type: "number" },
          abandons: { type: "number" },
          skips: { type: "number" },
        },
        required: ["day", "starts", "ends", "abandons", "skips"],
        additionalProperties: false,
      },
    },
    skipLeaderboard: {
      type: "array",
      items: {
        type: "object",
        properties: {
          question_id: { type: "string" },
          text: { type: ["string", "null"] },
          skips: { type: "number" },
          avg_questions_asked: { type: ["number", "null"] },
        },
        required: ["question_id", "text", "skips", "avg_questions_asked"],
        additionalProperties: false,
      },
    },
    perQuestion: {
      type: "array",
      items: {
        type: "object",
        properties: {
          questionId: { type: "string" },
          text: { type: ["string", "null"] },
          shown: { type: "number" },
          skipped: { type: "number" },
          yes: { type: "number" },
          no: { type: "number" },
          maybe: { type: "number" },
          unknown: { type: "number" },
          skipRate: { type: "number" },
          maybeRate: { type: "number" },
          frustrationScore: { type: "number" },
        },
        required: [
          "questionId",
          "text",
          "shown",
          "skipped",
          "yes",
          "no",
          "maybe",
          "unknown",
          "skipRate",
          "maybeRate",
          "frustrationScore",
        ],
        additionalProperties: false,
      },
    },
  },
  required: ["windowDays", "totals", "daily", "skipLeaderboard", "perQuestion"],
  additionalProperties: false,
};

const CONFUSION_RESPONSE_SCHEMA: Record<string, unknown> = {
  type: "object",
  properties: {
    source: { type: "string", enum: ["real", "sim"] },
    pairs: {
      type: "array",
      items: {
        type: "object",
        properties: {
          targetId: { type: "string" },
          targetName: { type: "string" },
          confusedWithId: { type: "string" },
          confusedWithName: { type: "string" },
          confusionCount: { type: "number" },
          winPct: { type: ["number", "null"] },
          lastSeen: { type: ["number", "null"] },
        },
        required: [
          "targetId",
          "targetName",
          "confusedWithId",
          "confusedWithName",
          "confusionCount",
          "winPct",
          "lastSeen",
        ],
        additionalProperties: false,
      },
    },
    total: { type: "number" },
    generatedAt: { type: "number" },
    message: { type: "string" },
  },
  required: ["source", "pairs", "total", "generatedAt"],
  additionalProperties: false,
};

const DASHBOARD_RECENT_GAME_SCHEMA: Record<string, unknown> = {
  type: "object",
  properties: {
    id: { type: "number" },
    won: { type: "number" },
    questions_asked: { type: "number" },
    target_character_id: { type: ["string", "null"] },
    character_name: { type: ["string", "null"] },
  },
  required: ["id", "won", "questions_asked", "target_character_id", "character_name"],
  additionalProperties: false,
};

const DASHBOARD_RESPONSE_SCHEMA: Record<string, unknown> = {
  type: "object",
  properties: {
    stats: {
      type: "object",
      properties: {
        totalCharacters: { type: "number" },
        enriched: { type: "number" },
        pendingEnrich: { type: "number" },
        activeQuestions: { type: "number" },
        openDisputes: { type: "number" },
        pendingProposals: { type: "number" },
        games7d: { type: "number" },
      },
      required: [
        "totalCharacters",
        "enriched",
        "pendingEnrich",
        "activeQuestions",
        "openDisputes",
        "pendingProposals",
        "games7d",
      ],
      additionalProperties: false,
    },
    recentGames: {
      type: "array",
      items: DASHBOARD_RECENT_GAME_SCHEMA,
    },
  },
  required: ["stats", "recentGames"],
  additionalProperties: false,
};

const DATA_QUALITY_HISTORY_ROW_SCHEMA: Record<string, unknown> = {
  type: "object",
  properties: {
    captured_at: { type: "number" },
    data_health_score: { type: "number" },
    coverage_pct: { type: "number" },
    evidence_pct: { type: "number" },
    agreement_avg: { type: "number" },
    open_disputes: { type: "number" },
    golden_pass_rate: { type: ["number", "null"] },
    vision_pass_rate: { type: ["number", "null"] },
    closure_total_pairs: { type: ["number", "null"] },
    closure_automation_pairs: { type: ["number", "null"] },
    closure_manual_pairs: { type: ["number", "null"] },
  },
  required: [
    "captured_at",
    "data_health_score",
    "coverage_pct",
    "evidence_pct",
    "agreement_avg",
    "open_disputes",
    "golden_pass_rate",
    "vision_pass_rate",
    "closure_total_pairs",
    "closure_automation_pairs",
    "closure_manual_pairs",
  ],
  additionalProperties: false,
};

const DATA_QUALITY_RESPONSE_SCHEMA: Record<string, unknown> = {
  type: "object",
  properties: {
    live: {
      type: "object",
      properties: {
        capturedAt: { type: "number" },
        dataHealthScore: { type: "number" },
        components: { type: "object", additionalProperties: true },
        weights: { type: "object", additionalProperties: true },
        coveragePct: { type: "number" },
        evidencePct: { type: "number" },
        agreementAvg: { type: "number" },
        agreementSampleSize: { type: "number" },
        openDisputes: { type: "number" },
        totalCharacters: { type: "number" },
        activeAttributes: { type: "number" },
        attributeRows: { type: "number" },
        completeness: {
          type: "object",
          properties: {
            dataCompleteScore: { type: "number" },
            components: { type: "object", additionalProperties: true },
            weights: { type: "object", additionalProperties: true },
            categoryFloorScore: { type: "number" },
            categoryCompleteness: {
              type: "object",
              additionalProperties: { type: "number" },
            },
            globalCompleteness: { type: "number" },
            evidenceCoverage: { type: "number" },
            sourceIdCoverage: { type: "number" },
            openHighPriorityDisputes: { type: "number" },
            totalRequiredCells: { type: "number" },
            filledRequiredCells: { type: "number" },
            gate: { type: "string" },
            config: { type: "object", additionalProperties: true },
          },
          required: [
            "dataCompleteScore",
            "components",
            "weights",
            "categoryFloorScore",
            "categoryCompleteness",
            "globalCompleteness",
            "evidenceCoverage",
            "sourceIdCoverage",
            "openHighPriorityDisputes",
            "totalRequiredCells",
            "filledRequiredCells",
            "gate",
            "config",
          ],
          additionalProperties: false,
        },
      },
      required: [
        "capturedAt",
        "dataHealthScore",
        "components",
        "weights",
        "coveragePct",
        "evidencePct",
        "agreementAvg",
        "agreementSampleSize",
        "openDisputes",
        "totalCharacters",
        "activeAttributes",
        "attributeRows",
        "completeness",
      ],
      additionalProperties: false,
    },
    history: {
      type: "array",
      items: DATA_QUALITY_HISTORY_ROW_SCHEMA,
    },
    windowDays: { type: "number" },
  },
  required: ["live", "history", "windowDays"],
  additionalProperties: false,
};

const COVERAGE_ATTRIBUTE_SCHEMA: Record<string, unknown> = {
  type: "object",
  properties: {
    key: { type: "string" },
    displayText: { type: "string" },
    trueCount: { type: "number" },
    falseCount: { type: "number" },
    nullCount: { type: "number" },
    definedCount: { type: "number" },
    missingCount: { type: "number" },
    coveragePct: { type: "number" },
    diversityScore: { type: "number" },
  },
  required: [
    "key",
    "displayText",
    "trueCount",
    "falseCount",
    "nullCount",
    "definedCount",
    "missingCount",
    "coveragePct",
    "diversityScore",
  ],
  additionalProperties: false,
};

const COVERAGE_RESPONSE_SCHEMA: Record<string, unknown> = {
  type: "object",
  properties: {
    totalEnriched: { type: "number" },
    totalActive: { type: "number" },
    category: { type: ["string", "null"] },
    attributes: {
      type: "array",
      items: COVERAGE_ATTRIBUTE_SCHEMA,
    },
  },
  required: ["totalEnriched", "totalActive", "category", "attributes"],
  additionalProperties: false,
};

const MATRIX_RESPONSE_SCHEMA: Record<string, unknown> = {
  type: "object",
  properties: {
    characters: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "string" },
          name: { type: "string" },
          category: { type: "string" },
          popularity: { type: ["number", "null"] },
        },
        required: ["id", "name", "category", "popularity"],
        additionalProperties: false,
      },
    },
    attributes: {
      type: "array",
      items: {
        type: "object",
        properties: {
          key: { type: "string" },
          displayText: { type: "string" },
        },
        required: ["key", "displayText"],
        additionalProperties: false,
      },
    },
    values: {
      type: "object",
      additionalProperties: {
        type: "object",
        additionalProperties: {
          oneOf: [{ type: "number" }, { type: "null" }],
        },
      },
    },
  },
  required: ["characters", "attributes", "values"],
  additionalProperties: false,
};

const PIPELINE_RUN_SCHEMA: Record<string, unknown> = {
  type: "object",
  properties: {
    id: { type: "number" },
    runBatch: { type: "string" },
    characterId: { type: "string" },
    step: { type: "string", enum: ["fetch", "dedup", "enrich", "image", "upload"] },
    status: { type: "string", enum: ["pending", "running", "success", "error"] },
    error: { type: ["string", "null"] },
    durationMs: { type: ["number", "null"] },
    createdAt: { type: "number" },
  },
  required: ["id", "runBatch", "characterId", "step", "status", "error", "durationMs", "createdAt"],
  additionalProperties: false,
};

const PIPELINE_GET_RESPONSE_SCHEMA: Record<string, unknown> = {
  type: "object",
  properties: {
    runs: {
      type: "array",
      items: PIPELINE_RUN_SCHEMA,
    },
    total: { type: "number" },
    page: { type: "number" },
    pageSize: { type: "number" },
  },
  required: ["runs", "total", "page", "pageSize"],
  additionalProperties: false,
};

const PIPELINE_POST_REQUEST_SCHEMA: Record<string, unknown> = {
  type: "object",
  properties: {
    runBatch: { type: "string" },
    characterId: { type: "string" },
    step: { type: "string", enum: ["fetch", "dedup", "enrich", "image", "upload"] },
    status: { type: "string", enum: ["pending", "running", "success", "error"] },
    error: { type: "string" },
    durationMs: { type: "number" },
  },
  required: ["runBatch", "characterId", "step", "status"],
  additionalProperties: false,
};

const PIPELINE_POST_RESPONSE_SCHEMA: Record<string, unknown> = {
  type: "object",
  properties: {
    ok: { type: "boolean" },
    id: { type: "number" },
  },
  required: ["ok", "id"],
  additionalProperties: false,
};

const ADMIN_CHARACTERS_ITEM_SCHEMA: Record<string, unknown> = {
  type: "object",
  properties: {
    id: { type: "string" },
    name: { type: "string" },
    category: { type: "string" },
    source: { type: "string" },
    popularity: { type: "number" },
    imageUrl: { type: ["string", "null"] },
    attributeCount: { type: "number" },
    totalAttributes: { type: "number" },
    coveragePct: { type: "number" },
    isCustom: { type: "boolean" },
    createdAt: { type: "number" },
  },
  required: [
    "id",
    "name",
    "category",
    "source",
    "popularity",
    "imageUrl",
    "attributeCount",
    "totalAttributes",
    "coveragePct",
    "isCustom",
    "createdAt",
  ],
  additionalProperties: false,
};

const ADMIN_CHARACTERS_GET_RESPONSE_SCHEMA: Record<string, unknown> = {
  type: "object",
  properties: {
    characters: {
      type: "array",
      items: ADMIN_CHARACTERS_ITEM_SCHEMA,
    },
    total: { type: "number" },
    page: { type: "number" },
    pageSize: { type: "number" },
  },
  required: ["characters", "total", "page", "pageSize"],
  additionalProperties: false,
};

const ADMIN_QUESTION_SCHEMA: Record<string, unknown> = {
  type: "object",
  properties: {
    key: { type: "string" },
    displayText: { type: "string" },
    questionText: { type: ["string", "null"] },
    categories: { type: ["string", "null"] },
    isActive: { type: "boolean" },
    createdAt: { type: "number" },
    usageCount: { type: "number" },
    difficulty: { type: ["string", "null"] },
  },
  required: [
    "key",
    "displayText",
    "questionText",
    "categories",
    "isActive",
    "createdAt",
    "usageCount",
    "difficulty",
  ],
  additionalProperties: false,
};

const ADMIN_QUESTIONS_GET_RESPONSE_SCHEMA: Record<string, unknown> = {
  type: "object",
  properties: {
    questions: {
      type: "array",
      items: ADMIN_QUESTION_SCHEMA,
    },
    total: { type: "number" },
    page: { type: "number" },
    pageSize: { type: "number" },
  },
  required: ["questions", "total", "page", "pageSize"],
  additionalProperties: false,
};

const QUESTIONS_EXPAND_RUN_SCHEMA: Record<string, unknown> = {
  type: "object",
  properties: {
    requestId: { type: "string" },
    actorId: { type: "string" },
    dryRun: { type: "boolean" },
    limit: { type: "number" },
    minCharacterCount: { type: "number" },
    maxPerAttribute: { type: "number" },
    targetAttributes: { type: "number" },
    candidates: { type: "number" },
    inserted: { type: "number" },
    createdAt: { type: "string" },
    status: { type: "string", enum: ["success", "error"] },
    error: { type: "string" },
  },
  required: [
    "requestId",
    "actorId",
    "dryRun",
    "limit",
    "minCharacterCount",
    "maxPerAttribute",
    "targetAttributes",
    "candidates",
    "inserted",
    "createdAt",
    "status",
  ],
  additionalProperties: false,
};

const QUESTIONS_EXPAND_CANDIDATE_SCHEMA: Record<string, unknown> = {
  type: "object",
  properties: {
    id: { type: "string" },
    attributeKey: { type: "string" },
    text: { type: "string" },
  },
  required: ["id", "attributeKey", "text"],
  additionalProperties: false,
};

const QUESTIONS_EXPAND_GET_RESPONSE_SCHEMA: Record<string, unknown> = {
  type: "object",
  properties: {
    ok: { type: "boolean" },
    requestId: { type: "string" },
    runs: {
      type: "array",
      items: QUESTIONS_EXPAND_RUN_SCHEMA,
    },
  },
  required: ["ok", "requestId", "runs"],
  additionalProperties: false,
};

const QUESTIONS_EXPAND_POST_REQUEST_SCHEMA: Record<string, unknown> = {
  type: "object",
  properties: {
    limit: { type: "number", minimum: 1, maximum: 200 },
    minCharacterCount: { type: "number", minimum: 0, maximum: 50000 },
    maxPerAttribute: { type: "number", minimum: 1, maximum: 3 },
    dryRun: { type: "boolean" },
  },
  additionalProperties: false,
};

const QUESTIONS_EXPAND_POST_RESPONSE_SCHEMA: Record<string, unknown> = {
  type: "object",
  properties: {
    ok: { type: "boolean" },
    requestId: { type: "string" },
    dryRun: { type: "boolean" },
    targetAttributes: { type: "number" },
    candidates: { type: "number" },
    inserted: { type: "number" },
    sample: {
      type: "array",
      items: QUESTIONS_EXPAND_CANDIDATE_SCHEMA,
    },
  },
  required: ["ok", "requestId", "dryRun", "targetAttributes", "candidates", "inserted", "sample"],
  additionalProperties: false,
};

const RETIREMENT_CANDIDATE_SCHEMA: Record<string, unknown> = {
  type: "object",
  properties: {
    questionId: { type: "string" },
    text: { type: ["string", "null"] },
    attributeKey: { type: ["string", "null"] },
    shown: { type: "number" },
    skipped: { type: "number" },
    yes: { type: "number" },
    no: { type: "number" },
    maybe: { type: "number" },
    unknown: { type: "number" },
    skipRate: { type: "number" },
    maybeRate: { type: "number" },
    imbalance: { type: "number" },
    retirementScore: { type: "number" },
  },
  required: [
    "questionId",
    "text",
    "attributeKey",
    "shown",
    "skipped",
    "yes",
    "no",
    "maybe",
    "unknown",
    "skipRate",
    "maybeRate",
    "imbalance",
    "retirementScore",
  ],
  additionalProperties: false,
};

const RETIRED_ENTRY_SCHEMA: Record<string, unknown> = {
  type: "object",
  properties: {
    questionId: { type: "string" },
    text: { type: "string" },
    attributeKey: { type: "string" },
    retiredAt: { type: "number" },
    retiredReason: { type: ["string", "null"] },
  },
  required: ["questionId", "text", "attributeKey", "retiredAt", "retiredReason"],
  additionalProperties: false,
};

const RETIREMENT_QUEUE_RESPONSE_SCHEMA: Record<string, unknown> = {
  oneOf: [
    {
      type: "object",
      properties: {
        source: { const: "live" },
        windowDays: { type: "number" },
        minShown: { type: "number" },
        generatedAt: { type: "number" },
        candidates: {
          type: "array",
          items: RETIREMENT_CANDIDATE_SCHEMA,
        },
      },
      required: ["source", "windowDays", "minShown", "generatedAt", "candidates"],
      additionalProperties: false,
    },
    {
      type: "object",
      properties: {
        source: { const: "retired" },
        windowDays: { type: "number" },
        minShown: { type: "number" },
        generatedAt: { type: "number" },
        retired: {
          type: "array",
          items: RETIRED_ENTRY_SCHEMA,
        },
      },
      required: ["source", "windowDays", "minShown", "generatedAt", "retired"],
      additionalProperties: false,
    },
  ],
};

const TRIAGE_LIST_ROW_SCHEMA: Record<string, unknown> = {
  type: "object",
  properties: {
    id: { type: "number" },
    actual_character_id: { type: "string" },
    actual_character_name: { type: ["string", "null"] },
    min_rank: { type: ["number", "null"] },
    created_at: { type: "number" },
  },
  required: ["id", "actual_character_id", "actual_character_name", "min_rank", "created_at"],
  additionalProperties: false,
};

const TRIAGE_STEP_SCHEMA: Record<string, unknown> = {
  type: "object",
  properties: {
    idx: { type: "number" },
    questionId: { type: "string" },
    questionText: { type: "string" },
    answer: { type: "string" },
    topTen: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "string" },
          name: { type: "string" },
        },
        required: ["id", "name"],
        additionalProperties: false,
      },
    },
  },
  required: ["idx", "questionId", "questionText", "answer", "topTen"],
  additionalProperties: false,
};

const TRIAGE_RESPONSE_SCHEMA: Record<string, unknown> = {
  oneOf: [
    {
      type: "object",
      properties: {
        rows: {
          type: "array",
          items: TRIAGE_LIST_ROW_SCHEMA,
        },
        total: { type: "number" },
        limit: { type: "number" },
        offset: { type: "number" },
      },
      required: ["rows", "total", "limit", "offset"],
      additionalProperties: false,
    },
    {
      type: "object",
      properties: {
        id: { type: "number" },
        actualCharacterId: { type: "string" },
        actualCharacterName: { type: ["string", "null"] },
        minRank: { type: ["number", "null"] },
        createdAt: { type: "number" },
        steps: {
          type: "array",
          items: TRIAGE_STEP_SCHEMA,
        },
      },
      required: ["id", "actualCharacterId", "actualCharacterName", "minRank", "createdAt", "steps"],
      additionalProperties: false,
    },
  ],
};

const ADMIN_QUESTION_KEY_PATCH_REQUEST_SCHEMA: Record<string, unknown> = {
  type: "object",
  properties: {
    questionText: { type: "string", minLength: 10, maxLength: 300 },
    isActive: { type: "boolean" },
    difficulty: {
      oneOf: [
        { type: "string", enum: ["easy", "medium", "hard"] },
        { type: "null" },
      ],
    },
  },
  additionalProperties: false,
};

const ADMIN_QUESTION_KEY_PATCH_RESPONSE_SCHEMA: Record<string, unknown> = {
  type: "object",
  properties: {
    ok: { type: "boolean" },
  },
  required: ["ok"],
  additionalProperties: false,
};

const ADMIN_QUESTION_KEY_RETIRE_REQUEST_SCHEMA: Record<string, unknown> = {
  type: "object",
  properties: {
    reason: { type: "string", maxLength: 500 },
  },
  additionalProperties: false,
};

const ADMIN_QUESTION_KEY_RETIRE_RESPONSE_SCHEMA: Record<string, unknown> = {
  type: "object",
  properties: {
    ok: { type: "boolean" },
    retired: { type: "number" },
    reason: { type: ["string", "null"] },
  },
  required: ["ok", "retired", "reason"],
  additionalProperties: false,
};

const ADMIN_QUESTION_KEY_UNRETIRE_RESPONSE_SCHEMA: Record<string, unknown> = {
  type: "object",
  properties: {
    ok: { type: "boolean" },
    unretired: { type: "number" },
  },
  required: ["ok", "unretired"],
  additionalProperties: false,
};

const ADMIN_QUESTION_KEY_SCORE_REQUEST_SCHEMA: Record<string, unknown> = {
  type: "object",
  properties: {
    displayText: { type: "string" },
    questionText: { type: "string" },
  },
  additionalProperties: false,
};

const ADMIN_QUESTION_KEY_SCORE_RESPONSE_SCHEMA: Record<string, unknown> = {
  type: "object",
  properties: {
    clarity: { type: "number" },
    power: { type: "number" },
    grammar: { type: "number" },
    rewrite: { type: "string" },
  },
  required: ["clarity", "power", "grammar"],
  additionalProperties: false,
};

const ADMIN_QUESTIONS_BULK_REQUEST_SCHEMA: Record<string, unknown> = {
  type: "object",
  properties: {
    keys: {
      type: "array",
      items: { type: "string" },
      minItems: 1,
      maxItems: 500,
    },
    isActive: { type: "boolean" },
    difficulty: {
      oneOf: [
        { type: "string", enum: ["easy", "medium", "hard"] },
        { type: "null" },
      ],
    },
  },
  additionalProperties: false,
};

const ADMIN_QUESTIONS_BULK_RESPONSE_SCHEMA: Record<string, unknown> = {
  type: "object",
  properties: {
    ok: { type: "boolean" },
    touchedKeys: { type: "number" },
    updatedDefinitions: { type: "number" },
    updatedQuestions: { type: "number" },
  },
  required: ["ok", "touchedKeys", "updatedDefinitions", "updatedQuestions"],
  additionalProperties: false,
};

const ADMIN_CHARACTER_DETAIL_SCHEMA: Record<string, unknown> = {
  type: "object",
  properties: {
    id: { type: "string" },
    name: { type: "string" },
    category: { type: "string" },
  },
  required: ["id", "name", "category"],
  additionalProperties: false,
};

const ADMIN_CHARACTER_DEFINITION_SCHEMA: Record<string, unknown> = {
  type: "object",
  properties: {
    key: { type: "string" },
    displayText: { type: "string" },
  },
  required: ["key", "displayText"],
  additionalProperties: false,
};

const ADMIN_CHARACTER_ATTRIBUTE_VALUE_SCHEMA: Record<string, unknown> = {
  oneOf: [{ type: "integer", enum: [0, 1] }, { type: "null" }],
};

const ADMIN_CHARACTER_AGREEMENT_VALUE_SCHEMA: Record<string, unknown> = {
  type: "object",
  properties: {
    score: { type: ["number", "null"] },
    signals: { type: "number" },
  },
  required: ["score", "signals"],
  additionalProperties: false,
};

const ADMIN_CHARACTER_BY_ID_GET_RESPONSE_SCHEMA: Record<string, unknown> = {
  type: "object",
  properties: {
    character: ADMIN_CHARACTER_DETAIL_SCHEMA,
    definitions: {
      type: "array",
      items: ADMIN_CHARACTER_DEFINITION_SCHEMA,
    },
    attributes: {
      type: "object",
      additionalProperties: ADMIN_CHARACTER_ATTRIBUTE_VALUE_SCHEMA,
    },
    evidence: {
      type: "object",
      additionalProperties: { type: ["string", "null"] },
    },
    agreement: {
      type: "object",
      additionalProperties: ADMIN_CHARACTER_AGREEMENT_VALUE_SCHEMA,
    },
  },
  required: ["character", "definitions", "attributes", "evidence", "agreement"],
  additionalProperties: false,
};

const ADMIN_CHARACTER_BY_ID_PATCH_REQUEST_SCHEMA: Record<string, unknown> = {
  type: "object",
  properties: {
    attributeKey: { type: "string" },
    value: ADMIN_CHARACTER_ATTRIBUTE_VALUE_SCHEMA,
    confidence: { type: "number", minimum: 0, maximum: 1 },
    category: { type: "string" },
  },
  additionalProperties: false,
};

const ADMIN_CHARACTER_BY_ID_PATCH_RESPONSE_SCHEMA: Record<string, unknown> = {
  type: "object",
  properties: {
    ok: { type: "boolean" },
  },
  required: ["ok"],
  additionalProperties: false,
};

const ADMIN_CHARACTER_BY_ID_DELETE_RESPONSE_SCHEMA: Record<string, unknown> = {
  type: "object",
  properties: {
    ok: { type: "boolean" },
    deleted: { type: "string" },
  },
  required: ["ok", "deleted"],
  additionalProperties: false,
};

const ADMIN_CHARACTER_VALIDATE_ISSUE_SCHEMA: Record<string, unknown> = {
  type: "object",
  properties: {
    attributeKey: { type: "string" },
    type: {
      type: "string",
      enum: ["contradiction", "suspicious-null", "recommended-fill"],
    },
    currentValue: { type: ["boolean", "null"] },
    suggestedValue: { type: ["boolean", "null"] },
    reason: { type: "string" },
  },
  required: ["attributeKey", "type", "currentValue", "suggestedValue", "reason"],
  additionalProperties: false,
};

const ADMIN_CHARACTER_VALIDATE_REQUEST_SCHEMA: Record<string, unknown> = {
  type: "object",
  properties: {
    name: { type: "string" },
    attributes: {
      type: "object",
      additionalProperties: { type: ["boolean", "null"] },
    },
  },
  required: ["name", "attributes"],
  additionalProperties: false,
};

const ADMIN_CHARACTER_VALIDATE_RESPONSE_SCHEMA: Record<string, unknown> = {
  type: "object",
  properties: {
    issues: {
      type: "array",
      items: ADMIN_CHARACTER_VALIDATE_ISSUE_SCHEMA,
    },
  },
  required: ["issues"],
  additionalProperties: false,
};

const PROPOSED_ATTRIBUTE_ENTRY_SCHEMA: Record<string, unknown> = {
  type: "object",
  properties: {
    id: { type: "number" },
    key: { type: "string" },
    display_text: { type: "string" },
    question_text: { type: "string" },
    rationale: { type: ["string", "null"] },
    example_chars: { type: ["string", "null"] },
    proposed_by: { type: ["string", "null"] },
    status: { type: "string" },
    reviewed_by: { type: ["string", "null"] },
    reviewed_at: { type: ["number", "null"] },
    created_at: { type: "number" },
  },
  required: [
    "id",
    "key",
    "display_text",
    "question_text",
    "rationale",
    "example_chars",
    "proposed_by",
    "status",
    "reviewed_by",
    "reviewed_at",
    "created_at",
  ],
  additionalProperties: false,
};

const PROPOSED_ATTRIBUTES_GET_RESPONSE_SCHEMA: Record<string, unknown> = {
  type: "object",
  properties: {
    proposals: {
      type: "array",
      items: PROPOSED_ATTRIBUTE_ENTRY_SCHEMA,
    },
    total: { type: "number" },
    page: { type: "number" },
    pageSize: { type: "number" },
  },
  required: ["proposals", "total", "page", "pageSize"],
  additionalProperties: false,
};

const PROPOSED_ATTRIBUTE_INPUT_SCHEMA: Record<string, unknown> = {
  type: "object",
  properties: {
    key: { type: "string" },
    display_text: { type: "string" },
    question_text: { type: "string" },
    rationale: { type: "string" },
    example_chars: { type: "string" },
    proposed_by: { type: "string" },
  },
  required: ["key", "display_text", "question_text"],
  additionalProperties: false,
};

const PROPOSED_ATTRIBUTES_POST_REQUEST_SCHEMA: Record<string, unknown> = {
  oneOf: [
    PROPOSED_ATTRIBUTE_INPUT_SCHEMA,
    {
      type: "object",
      properties: {
        proposals: {
          type: "array",
          items: PROPOSED_ATTRIBUTE_INPUT_SCHEMA,
          minItems: 1,
          maxItems: 100,
        },
      },
      required: ["proposals"],
      additionalProperties: false,
    },
  ],
};

const PROPOSED_ATTRIBUTES_POST_RESPONSE_SCHEMA: Record<string, unknown> = {
  type: "object",
  properties: {
    inserted: { type: "number" },
    submitted: { type: "number" },
  },
  required: ["inserted", "submitted"],
  additionalProperties: false,
};

const PROPOSED_ATTRIBUTES_PATCH_REQUEST_SCHEMA: Record<string, unknown> = {
  type: "object",
  properties: {
    id: { type: "number" },
    status: { type: "string", enum: ["approved", "rejected"] },
    reviewed_by: { type: "string" },
  },
  required: ["id", "status"],
  additionalProperties: false,
};

const PROPOSED_ATTRIBUTES_PATCH_RESPONSE_SCHEMA: Record<string, unknown> = {
  type: "object",
  properties: {
    ok: { type: "boolean" },
  },
  required: ["ok"],
  additionalProperties: false,
};

const PROPOSED_ATTRIBUTE_BY_ID_POST_REQUEST_SCHEMA: Record<string, unknown> = {
  type: "object",
  properties: {
    action: { type: "string", enum: ["approve", "reject"] },
  },
  required: ["action"],
  additionalProperties: false,
};

const PROPOSED_ATTRIBUTE_BY_ID_POST_RESPONSE_SCHEMA: Record<string, unknown> = {
  oneOf: [
    {
      type: "object",
      properties: {
        ok: { type: "boolean" },
        action: { const: "approved" },
        key: { type: "string" },
      },
      required: ["ok", "action", "key"],
      additionalProperties: false,
    },
    {
      type: "object",
      properties: {
        ok: { type: "boolean" },
        action: { const: "rejected" },
      },
      required: ["ok", "action"],
      additionalProperties: false,
    },
  ],
};

const PROPOSED_ATTRIBUTE_SCORE_REQUEST_SCHEMA: Record<string, unknown> = {
  type: "object",
  properties: {
    key: { type: "string" },
    displayText: { type: "string" },
    questionText: { type: "string" },
    rationale: { type: "string" },
  },
  required: ["key", "displayText", "questionText"],
  additionalProperties: false,
};

const PROPOSED_ATTRIBUTE_SCORE_RESPONSE_SCHEMA: Record<string, unknown> = {
  type: "object",
  properties: {
    score: { type: "number" },
    concerns: {
      type: "array",
      items: { type: "string" },
    },
    strengths: {
      type: "array",
      items: { type: "string" },
    },
  },
  required: ["score", "concerns", "strengths"],
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
    responseSchema: EVENTS_BATCH_RESPONSE_SCHEMA,
  },
  "post /api/v2/daily": {
    summary: "Record daily challenge completion result",
    requestSchema: DAILY_RESULT_REQUEST_SCHEMA,
    responseSchema: DAILY_POST_RESPONSE_SCHEMA,
  },
  "get /api/v2/daily": {
    summary: "Get current user daily challenge status",
    responseSchema: DAILY_GET_RESPONSE_SCHEMA,
  },
  "get /api/v2/daily/leaderboard": {
    summary: "Get daily challenge leaderboard",
    responseSchema: DAILY_LEADERBOARD_RESPONSE_SCHEMA,
  },
  "get /api/v2/attributes": {
    summary: "List attribute definitions with optional coverage",
    responseSchema: ATTRIBUTES_RESPONSE_SCHEMA,
  },
  "get /api/v2/characters": {
    summary: "List characters or fetch one character by id",
    responseSchema: CHARACTERS_GET_RESPONSE_SCHEMA,
  },
  "post /api/v2/characters": {
    summary: "Create a new custom character",
    requestSchema: CHARACTERS_POST_REQUEST_SCHEMA,
    responseSchema: CHARACTERS_POST_RESPONSE_SCHEMA,
  },
  "get /api/v2/history": {
    summary: "Fetch game history for current user",
    responseSchema: HISTORY_RESPONSE_SCHEMA,
  },
  "get /api/v2/questions": {
    summary: "List questions with optional attribute coverage",
    responseSchema: QUESTIONS_RESPONSE_SCHEMA,
  },
  "get /api/v2/stats": {
    summary: "Get aggregate catalog and gameplay stats",
    responseSchema: STATS_RESPONSE_SCHEMA,
  },
  "post /api/v2/game/reveal": {
    summary: "Submit reveal outcome after an incorrect guess",
    requestSchema: REVEAL_REQUEST_SCHEMA,
    responseSchema: REVEAL_RESPONSE_SCHEMA,
  },
  "get /api/admin/about": {
    summary: "Get admin build and data freshness metadata",
    responseSchema: ADMIN_ABOUT_RESPONSE_SCHEMA,
  },
  "get /api/admin/analytics": {
    summary: "List client events with summary and aggregates",
    responseSchema: ANALYTICS_GET_RESPONSE_SCHEMA,
  },
  "get /api/admin/analytics/aha-moments": {
    summary: "Fetch ranked aha-moment attributes",
    responseSchema: ANALYTICS_AHA_MOMENTS_RESPONSE_SCHEMA,
  },
  "post /api/admin/analytics/insights": {
    summary: "Generate cached analytics insights with AI",
    requestSchema: ANALYTICS_INSIGHTS_REQUEST_SCHEMA,
    responseSchema: ANALYTICS_INSIGHTS_RESPONSE_SCHEMA,
  },
  "get /api/admin/attribute-disputes": {
    summary: "List attribute disputes with pagination",
    responseSchema: ATTRIBUTE_DISPUTES_GET_RESPONSE_SCHEMA,
  },
  "patch /api/admin/attribute-disputes": {
    summary: "Resolve or dismiss an attribute dispute",
    requestSchema: ATTRIBUTE_DISPUTES_PATCH_REQUEST_SCHEMA,
    responseSchema: ATTRIBUTE_DISPUTES_PATCH_RESPONSE_SCHEMA,
  },
  "post /api/admin/attribute-disputes-ai": {
    summary: "Run AI arbitration on an attribute dispute",
    requestSchema: ATTRIBUTE_DISPUTES_AI_REQUEST_SCHEMA,
    responseSchema: ATTRIBUTE_DISPUTES_AI_RESPONSE_SCHEMA,
  },
  "get /api/admin/automation-status": {
    summary: "Get latest cron automation report snapshot",
    responseSchema: AUTOMATION_STATUS_RESPONSE_SCHEMA,
  },
  "get /api/admin/characters": {
    summary: "List admin characters with coverage metrics",
    responseSchema: ADMIN_CHARACTERS_GET_RESPONSE_SCHEMA,
  },
  "get /api/admin/characters/{id}": {
    summary: "Get character attributes and active definitions",
    responseSchema: ADMIN_CHARACTER_BY_ID_GET_RESPONSE_SCHEMA,
  },
  "patch /api/admin/characters/{id}": {
    summary: "Update a character category or attribute value",
    requestSchema: ADMIN_CHARACTER_BY_ID_PATCH_REQUEST_SCHEMA,
    responseSchema: ADMIN_CHARACTER_BY_ID_PATCH_RESPONSE_SCHEMA,
  },
  "delete /api/admin/characters/{id}": {
    summary: "Delete a character",
    responseSchema: ADMIN_CHARACTER_BY_ID_DELETE_RESPONSE_SCHEMA,
  },
  "post /api/admin/characters/{id}/validate": {
    summary: "Run LLM validation for a character attribute set",
    requestSchema: ADMIN_CHARACTER_VALIDATE_REQUEST_SCHEMA,
    responseSchema: ADMIN_CHARACTER_VALIDATE_RESPONSE_SCHEMA,
  },
  "get /api/admin/confusion": {
    summary: "Get confusion matrix from real or simulation data",
    responseSchema: CONFUSION_RESPONSE_SCHEMA,
  },
  "get /api/admin/coverage": {
    summary: "Get attribute coverage aggregation",
    responseSchema: COVERAGE_RESPONSE_SCHEMA,
  },
  "get /api/admin/costs": {
    summary: "Get KV cost dashboard rollups",
    responseSchema: COSTS_RESPONSE_SCHEMA,
  },
  "get /api/admin/curator-queue": {
    summary: "Fetch manual curator queue report",
    responseSchema: CURATOR_QUEUE_GET_RESPONSE_SCHEMA,
  },
  "post /api/admin/curator-queue": {
    summary: "Apply a curator queue action",
    requestSchema: CURATOR_QUEUE_POST_REQUEST_SCHEMA,
    responseSchema: CURATOR_QUEUE_POST_RESPONSE_SCHEMA,
  },
  "get /api/admin/data-quality-sla": {
    summary: "List data quality SLA targets",
    responseSchema: DATA_QUALITY_SLA_RESPONSE_SCHEMA,
  },
  "get /api/admin/dashboard": {
    summary: "Get admin landing dashboard aggregates",
    responseSchema: DASHBOARD_RESPONSE_SCHEMA,
  },
  "get /api/admin/data-quality": {
    summary: "Get live and historical data-quality metrics",
    responseSchema: DATA_QUALITY_RESPONSE_SCHEMA,
  },
  "get /api/admin/image-health": {
    summary: "Get image health completeness report",
    responseSchema: IMAGE_HEALTH_RESPONSE_SCHEMA,
  },
  "get /api/admin/funnel": {
    summary: "Get game funnel and question frustration analytics",
    responseSchema: FUNNEL_RESPONSE_SCHEMA,
  },
  "get /api/admin/live-ops": {
    summary: "Get rolling one-hour live ops health snapshot",
    responseSchema: LIVE_OPS_RESPONSE_SCHEMA,
  },
  "get /api/admin/matrix": {
    summary: "Get character-attribute matrix slice",
    responseSchema: MATRIX_RESPONSE_SCHEMA,
  },
  "get /api/admin/pipeline": {
    summary: "List pipeline run audit entries",
    responseSchema: PIPELINE_GET_RESPONSE_SCHEMA,
  },
  "get /api/admin/questions": {
    summary: "List admin question definitions with usage",
    responseSchema: ADMIN_QUESTIONS_GET_RESPONSE_SCHEMA,
  },
  "patch /api/admin/questions/{key}": {
    summary: "Update question text, active state, or difficulty",
    requestSchema: ADMIN_QUESTION_KEY_PATCH_REQUEST_SCHEMA,
    responseSchema: ADMIN_QUESTION_KEY_PATCH_RESPONSE_SCHEMA,
  },
  "post /api/admin/questions/{key}/retire": {
    summary: "Retire all questions for an attribute key",
    requestSchema: ADMIN_QUESTION_KEY_RETIRE_REQUEST_SCHEMA,
    responseSchema: ADMIN_QUESTION_KEY_RETIRE_RESPONSE_SCHEMA,
  },
  "post /api/admin/questions/{key}/score": {
    summary: "Run LLM quality scoring for a question",
    requestSchema: ADMIN_QUESTION_KEY_SCORE_REQUEST_SCHEMA,
    responseSchema: ADMIN_QUESTION_KEY_SCORE_RESPONSE_SCHEMA,
  },
  "post /api/admin/questions/{key}/unretire": {
    summary: "Unretire all questions for an attribute key",
    responseSchema: ADMIN_QUESTION_KEY_UNRETIRE_RESPONSE_SCHEMA,
  },
  "post /api/admin/questions/bulk": {
    summary: "Bulk update question active state and difficulty",
    requestSchema: ADMIN_QUESTIONS_BULK_REQUEST_SCHEMA,
    responseSchema: ADMIN_QUESTIONS_BULK_RESPONSE_SCHEMA,
  },
  "get /api/admin/questions/expand": {
    summary: "Get recent question expansion runs",
    responseSchema: QUESTIONS_EXPAND_GET_RESPONSE_SCHEMA,
  },
  "post /api/admin/questions/expand": {
    summary: "Run heuristic question expansion",
    requestSchema: QUESTIONS_EXPAND_POST_REQUEST_SCHEMA,
    responseSchema: QUESTIONS_EXPAND_POST_RESPONSE_SCHEMA,
  },
  "get /api/admin/questions/retirement-queue": {
    summary: "Get question retirement candidates or retired list",
    responseSchema: RETIREMENT_QUEUE_RESPONSE_SCHEMA,
  },
  "post /api/admin/pipeline": {
    summary: "Log a pipeline run entry",
    requestSchema: PIPELINE_POST_REQUEST_SCHEMA,
    responseSchema: PIPELINE_POST_RESPONSE_SCHEMA,
  },
  "get /api/admin/proposed-attributes": {
    summary: "List proposed attributes",
    responseSchema: PROPOSED_ATTRIBUTES_GET_RESPONSE_SCHEMA,
  },
  "post /api/admin/proposed-attributes": {
    summary: "Submit one or more proposed attributes",
    requestSchema: PROPOSED_ATTRIBUTES_POST_REQUEST_SCHEMA,
    responseSchema: PROPOSED_ATTRIBUTES_POST_RESPONSE_SCHEMA,
  },
  "patch /api/admin/proposed-attributes": {
    summary: "Update proposed attribute review status",
    requestSchema: PROPOSED_ATTRIBUTES_PATCH_REQUEST_SCHEMA,
    responseSchema: PROPOSED_ATTRIBUTES_PATCH_RESPONSE_SCHEMA,
  },
  "post /api/admin/proposed-attributes/{id}": {
    summary: "Approve or reject a specific proposed attribute",
    requestSchema: PROPOSED_ATTRIBUTE_BY_ID_POST_REQUEST_SCHEMA,
    responseSchema: PROPOSED_ATTRIBUTE_BY_ID_POST_RESPONSE_SCHEMA,
  },
  "post /api/admin/proposed-attributes/{id}/score": {
    summary: "Run LLM quality scoring for a proposed attribute",
    requestSchema: PROPOSED_ATTRIBUTE_SCORE_REQUEST_SCHEMA,
    responseSchema: PROPOSED_ATTRIBUTE_SCORE_RESPONSE_SCHEMA,
  },
  "get /api/admin/error-logs": {
    summary: "List error and warning logs with filters",
    responseSchema: ERROR_LOGS_GET_RESPONSE_SCHEMA,
  },
  "get /api/admin/source-health": {
    summary: "Get source and source_id health report",
    responseSchema: SOURCE_HEALTH_RESPONSE_SCHEMA,
  },
  "get /api/admin/source-health-status": {
    summary: "Get latest persisted source health report status",
    responseSchema: SOURCE_HEALTH_STATUS_RESPONSE_SCHEMA,
  },
  "get /api/admin/triage": {
    summary: "Get catastrophic-failure triage queue",
    responseSchema: TRIAGE_RESPONSE_SCHEMA,
  },
  "get /api/admin/workflow-progress": {
    summary: "Get mission-control workflow progress state",
    responseSchema: WORKFLOW_PROGRESS_GET_RESPONSE_SCHEMA,
  },
  "post /api/admin/workflow-progress": {
    summary: "Update mission-control workflow progress state",
    requestSchema: WORKFLOW_PROGRESS_POST_REQUEST_SCHEMA,
    responseSchema: WORKFLOW_PROGRESS_POST_RESPONSE_SCHEMA,
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
