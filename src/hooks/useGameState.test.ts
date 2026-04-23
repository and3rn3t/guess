import type { Character, Question, ReasoningExplanation } from "@/lib/types";
import { describe, expect, it } from "vitest";
import type { GameState } from "./useGameState";
import { gameReducer, initialState } from "./useGameState";

const CHARS: Character[] = [
  {
    id: "mario",
    name: "Mario",
    category: "video-games",
    attributes: { isHuman: true, canFly: false },
  },
  {
    id: "link",
    name: "Link",
    category: "video-games",
    attributes: { isHuman: true, usesWeapons: true },
  },
];

const QUESTION: Question = {
  id: "q1",
  text: "Is this character human?",
  attribute: "isHuman",
};

const REASONING: ReasoningExplanation = {
  why: "Splits evenly",
  impact: "Eliminates 50%",
  remaining: 2,
  confidence: 50,
};

// ========== START_GAME ==========

describe("START_GAME", () => {
  it("sets phase to playing and assigns possibleCharacters", () => {
    const next = gameReducer(initialState, {
      type: "START_GAME",
      characters: CHARS,
    });
    expect(next.phase).toBe("playing");
    expect(next.possibleCharacters).toBe(CHARS);
    expect(next.answers).toHaveLength(0);
    expect(next.gameSteps).toHaveLength(0);
  });

  it("resets prior game state", () => {
    const dirty: GameState = {
      ...initialState,
      phase: "gameOver",
      answers: [{ questionId: "isHuman", value: "yes" }],
      gameWon: true,
    };
    const next = gameReducer(dirty, { type: "START_GAME", characters: CHARS });
    expect(next.phase).toBe("playing");
    expect(next.answers).toHaveLength(0);
    expect(next.gameWon).toBe(false);
  });
});

// ========== SET_QUESTION ==========

describe("SET_QUESTION", () => {
  it("sets currentQuestion and reasoning", () => {
    const playing: GameState = {
      ...initialState,
      phase: "playing",
      possibleCharacters: CHARS,
    };
    const next = gameReducer(playing, {
      type: "SET_QUESTION",
      question: QUESTION,
      reasoning: REASONING,
    });
    expect(next.currentQuestion).toBe(QUESTION);
    expect(next.reasoning).toBe(REASONING);
  });
});

// ========== ANSWER ==========

describe("ANSWER", () => {
  it("adds answer and clears currentQuestion", () => {
    const withQuestion: GameState = {
      ...initialState,
      phase: "playing",
      currentQuestion: QUESTION,
      possibleCharacters: CHARS,
    };
    const next = gameReducer(withQuestion, { type: "ANSWER", value: "yes" });
    expect(next.answers).toHaveLength(1);
    expect(next.answers[0]).toEqual({ questionId: "isHuman", value: "yes" });
    expect(next.currentQuestion).toBeNull();
  });

  it("appends to existing answers", () => {
    const withAnswers: GameState = {
      ...initialState,
      phase: "playing",
      currentQuestion: QUESTION,
      answers: [{ questionId: "canFly", value: "no" }],
      gameSteps: [
        { questionText: "Can fly?", attribute: "canFly", answer: "no" },
      ],
    };
    const next = gameReducer(withAnswers, { type: "ANSWER", value: "yes" });
    expect(next.answers).toHaveLength(2);
    expect(next.gameSteps).toHaveLength(2);
  });

  it("is a no-op when currentQuestion is null", () => {
    const noQuestion: GameState = {
      ...initialState,
      phase: "playing",
      currentQuestion: null,
    };
    const next = gameReducer(noQuestion, { type: "ANSWER", value: "yes" });
    expect(next.answers).toHaveLength(0);
  });

  it("records gameStep with question text and attribute", () => {
    const withQuestion: GameState = {
      ...initialState,
      phase: "playing",
      currentQuestion: QUESTION,
    };
    const next = gameReducer(withQuestion, { type: "ANSWER", value: "no" });
    expect(next.gameSteps[0].questionText).toBe("Is this character human?");
    expect(next.gameSteps[0].attribute).toBe("isHuman");
    expect(next.gameSteps[0].answer).toBe("no");
  });
});

// ========== CORRECT_GUESS ==========

describe("CORRECT_GUESS", () => {
  it("sets gameWon true and phase to gameOver", () => {
    const guessing: GameState = {
      ...initialState,
      phase: "guessing",
      finalGuess: CHARS[0],
    };
    const next = gameReducer(guessing, { type: "CORRECT_GUESS" });
    expect(next.gameWon).toBe(true);
    expect(next.phase).toBe("gameOver");
  });
});

// ========== INCORRECT_GUESS ==========

describe("INCORRECT_GUESS", () => {
  it("sets gameWon false and phase to gameOver", () => {
    const guessing: GameState = {
      ...initialState,
      phase: "guessing",
      finalGuess: CHARS[0],
    };
    const next = gameReducer(guessing, { type: "INCORRECT_GUESS" });
    expect(next.gameWon).toBe(false);
    expect(next.phase).toBe("gameOver");
  });
});

// ========== UNDO_LAST_ANSWER ==========

describe("UNDO_LAST_ANSWER", () => {
  it("removes the last answer and gameStep", () => {
    const withAnswers: GameState = {
      ...initialState,
      phase: "playing",
      answers: [
        { questionId: "isHuman", value: "yes" },
        { questionId: "canFly", value: "no" },
      ],
      gameSteps: [
        { questionText: "Human?", attribute: "isHuman", answer: "yes" },
        { questionText: "Fly?", attribute: "canFly", answer: "no" },
      ],
    };
    const next = gameReducer(withAnswers, { type: "UNDO_LAST_ANSWER" });
    expect(next.answers).toHaveLength(1);
    expect(next.answers[0].questionId).toBe("isHuman");
    expect(next.gameSteps).toHaveLength(1);
  });

  it("handles undo on empty answers gracefully", () => {
    const next = gameReducer(initialState, { type: "UNDO_LAST_ANSWER" });
    expect(next.answers).toHaveLength(0);
    expect(next.gameSteps).toHaveLength(0);
  });
});

// ========== RESTORE_SESSION ==========

describe("RESTORE_SESSION", () => {
  it("restores full state and clears isThinking", () => {
    const saved: GameState = {
      ...initialState,
      phase: "playing",
      answers: [{ questionId: "isHuman", value: "yes" }],
      possibleCharacters: CHARS,
      isThinking: true,
    };
    const next = gameReducer(initialState, {
      type: "RESTORE_SESSION",
      state: saved,
    });
    expect(next.phase).toBe("playing");
    expect(next.answers).toHaveLength(1);
    expect(next.possibleCharacters).toBe(CHARS);
    expect(next.isThinking).toBe(false);
  });
});

// ========== MAKE_GUESS ==========

describe("MAKE_GUESS", () => {
  it("sets finalGuess and transitions to guessing phase", () => {
    const playing: GameState = {
      ...initialState,
      phase: "playing",
      isThinking: true,
    };
    const next = gameReducer(playing, {
      type: "MAKE_GUESS",
      character: CHARS[0],
    });
    expect(next.finalGuess).toBe(CHARS[0]);
    expect(next.phase).toBe("guessing");
    expect(next.isThinking).toBe(false);
  });
});

// ========== NAVIGATE ==========

describe("NAVIGATE", () => {
  it("changes phase", () => {
    const next = gameReducer(initialState, {
      type: "NAVIGATE",
      phase: "stats",
    });
    expect(next.phase).toBe("stats");
  });

  it("clears selectedCharacter when navigating to welcome", () => {
    const withChar: GameState = {
      ...initialState,
      selectedCharacter: CHARS[0],
    };
    const next = gameReducer(withChar, { type: "NAVIGATE", phase: "welcome" });
    expect(next.selectedCharacter).toBeNull();
  });
});

// ========== Unknown action ==========

describe("unknown action", () => {
  it("returns state unchanged", () => {
    const next = gameReducer(initialState, { type: "TOGGLE_DEV_TOOLS" });
    expect(next.showDevTools).toBe(!initialState.showDevTools);
  });
});

// ========== REJECT_GUESS ==========

describe("REJECT_GUESS", () => {
  it("returns to playing, clears finalGuess, increments guessCount, starts thinking", () => {
    const guessing: GameState = {
      ...initialState,
      phase: "guessing",
      finalGuess: CHARS[0],
      guessCount: 1,
    };
    const next = gameReducer(guessing, { type: "REJECT_GUESS" });
    expect(next.phase).toBe("playing");
    expect(next.finalGuess).toBeNull();
    expect(next.guessCount).toBe(2);
    expect(next.isThinking).toBe(true);
  });
});

// ========== SET_EXHAUSTED ==========

describe("SET_EXHAUSTED", () => {
  it("sets exhausted=true, gameWon=false, phase=gameOver", () => {
    const playing: GameState = { ...initialState, phase: "playing" };
    const next = gameReducer(playing, { type: "SET_EXHAUSTED" });
    expect(next.exhausted).toBe(true);
    expect(next.gameWon).toBe(false);
    expect(next.phase).toBe("gameOver");
  });
});

// ========== SURRENDER ==========

describe("SURRENDER", () => {
  it("sets surrendered=true, gameWon=false, phase=gameOver", () => {
    const playing: GameState = { ...initialState, phase: "playing" };
    const next = gameReducer(playing, { type: "SURRENDER" });
    expect(next.surrendered).toBe(true);
    expect(next.gameWon).toBe(false);
    expect(next.phase).toBe("gameOver");
  });
});

// ========== SET_THINKING ==========

describe("SET_THINKING", () => {
  it("sets isThinking to true", () => {
    const next = gameReducer(initialState, { type: "SET_THINKING", isThinking: true });
    expect(next.isThinking).toBe(true);
  });

  it("sets isThinking to false", () => {
    const thinking: GameState = { ...initialState, isThinking: true };
    const next = gameReducer(thinking, { type: "SET_THINKING", isThinking: false });
    expect(next.isThinking).toBe(false);
  });
});

// ========== SET_POSSIBLE_CHARACTERS ==========

describe("SET_POSSIBLE_CHARACTERS", () => {
  it("replaces possibleCharacters array", () => {
    const playing: GameState = {
      ...initialState,
      phase: "playing",
      possibleCharacters: CHARS,
    };
    const subset = [CHARS[0]];
    const next = gameReducer(playing, { type: "SET_POSSIBLE_CHARACTERS", characters: subset });
    expect(next.possibleCharacters).toBe(subset);
  });
});

// ========== NAVIGATE additional branches ==========

describe("NAVIGATE – additional branches", () => {
  it("sets selectedCharacter when navigating to a non-welcome phase with character", () => {
    const next = gameReducer(initialState, {
      type: "NAVIGATE",
      phase: "history",
      character: CHARS[0],
    });
    expect(next.phase).toBe("history");
    expect(next.selectedCharacter).toBe(CHARS[0]);
  });

  it("resets guessCount, exhausted, and surrendered when navigating to welcome", () => {
    const dirty: GameState = {
      ...initialState,
      guessCount: 3,
      exhausted: true,
      surrendered: true,
    };
    const next = gameReducer(dirty, { type: "NAVIGATE", phase: "welcome" });
    expect(next.guessCount).toBe(0);
    expect(next.exhausted).toBe(false);
    expect(next.surrendered).toBe(false);
  });

  it("preserves selectedCharacter when navigating to non-welcome phase without character arg", () => {
    const withChar: GameState = { ...initialState, selectedCharacter: CHARS[1] };
    const next = gameReducer(withChar, { type: "NAVIGATE", phase: "stats" });
    expect(next.selectedCharacter).toBe(CHARS[1]);
  });
});
