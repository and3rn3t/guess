import { describe, expect, it } from "vitest";
import {
  analyzeAndGenerateQuestions,
  getQuestionGenerationInsight,
} from "./questionGenerator";
import type { Character, Question } from "./types";

const CHARS: Character[] = [
  {
    id: "char1",
    name: "Character 1",
    category: "movies",
    attributes: { isHuman: true, canFly: false, hasMagic: true },
  },
  {
    id: "char2",
    name: "Character 2",
    category: "movies",
    attributes: { isHuman: false, canFly: true, hasMagic: false },
  },
];

const EXISTING_QUESTIONS: Question[] = [
  { id: "q1", text: "Is this character human?", attribute: "isHuman" },
];

describe("getQuestionGenerationInsight", () => {
  it("reports new discriminating attributes", () => {
    const insight = getQuestionGenerationInsight(CHARS, EXISTING_QUESTIONS);
    // canFly and hasMagic are new, and they split 1/1 — both are discriminating
    expect(insight).toContain("2");
    expect(insight).toContain("discriminating");
  });

  it("reports all covered when questions match all attributes", () => {
    const allQuestions: Question[] = [
      { id: "q1", text: "Human?", attribute: "isHuman" },
      { id: "q2", text: "Fly?", attribute: "canFly" },
      { id: "q3", text: "Magic?", attribute: "hasMagic" },
    ];
    const insight = getQuestionGenerationInsight(CHARS, allQuestions);
    expect(insight).toContain("covered");
  });
});

// --- analyzeAndGenerateQuestions: synchronous early-return paths ---

describe("analyzeAndGenerateQuestions", () => {
  it("returns empty questions for empty character list", async () => {
    const result = await analyzeAndGenerateQuestions([], EXISTING_QUESTIONS);
    expect(result.newQuestions).toHaveLength(0);
    expect(result.reasoning).toContain("No new attributes");
  });

  it("returns empty questions when all attributes are already covered", async () => {
    const allQuestions: Question[] = [
      { id: "q1", text: "Human?", attribute: "isHuman" },
      { id: "q2", text: "Fly?", attribute: "canFly" },
      { id: "q3", text: "Magic?", attribute: "hasMagic" },
    ];
    const result = await analyzeAndGenerateQuestions(CHARS, allQuestions);
    expect(result.newQuestions).toHaveLength(0);
    expect(result.reasoning).toContain("No new attributes");
  });
});

// --- getQuestionGenerationInsight: edge cases ---

describe("getQuestionGenerationInsight – edge cases", () => {
  it("handles empty character list", () => {
    const insight = getQuestionGenerationInsight([], EXISTING_QUESTIONS);
    // No attributes to discover from empty characters
    expect(insight).toContain("covered");
  });

  it("handles character with all attributes filled", () => {
    const chars: Character[] = [
      {
        id: "full",
        name: "Fully Filled",
        category: "movies",
        attributes: {
          isHuman: true,
          canFly: false,
          hasMagic: true,
          isVillain: false,
          isTall: true,
        },
      },
      {
        id: "full2",
        name: "Fully Filled 2",
        category: "movies",
        attributes: {
          isHuman: false,
          canFly: true,
          hasMagic: false,
          isVillain: true,
          isTall: false,
        },
      },
    ];
    // Only isHuman is covered by existing questions
    const insight = getQuestionGenerationInsight(chars, EXISTING_QUESTIONS);
    // Should report discriminating attributes for canFly, hasMagic, isVillain, isTall
    expect(insight).toContain("discriminating");
  });
});
