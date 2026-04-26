import { expect } from "@playwright/test";
import {
  MOCK_SESSION_ID,
  ONBOARDING_KEY,
  SESSION_KEY,
  mockQuestion,
  mockReasoning,
  setupApiMocks,
  test,
} from "./fixtures";

// ---------------------------------------------------------------------------
// Game flow
// ---------------------------------------------------------------------------

test.describe("Game flow", () => {
  test("shows welcome screen with title and start button", async ({
    gamePage,
  }) => {
    await expect(gamePage.getByText("Andernator")).toBeVisible();
    await expect(
      gamePage.getByRole("button", { name: /start game/i }).first(),
    ).toBeVisible();
  });

  test("can start a game and see a question", async ({ gamePage }) => {
    await gamePage.startGame();
    await gamePage.waitForQuestion();
  });

  test("full game flow: answer questions until guess", async ({ gamePage }) => {
    await gamePage.startGame();
    await gamePage.answerQuestions(3);
    await gamePage.waitForGuessScreen();
  });

  test("sends correct payload to answer endpoint", async ({ gamePage }) => {
    await gamePage.startGame();
    const [request] = await Promise.all([
      gamePage.waitForRequest("**/api/v2/game/answer"),
      gamePage.answerQuestion("yes"),
    ]);

    const body = request.postDataJSON() as Record<string, unknown>;
    expect(body.sessionId).toBe(MOCK_SESSION_ID);
    expect(body.value).toBe("yes");
  });

  test("can mute/unmute sounds", async ({ gamePage }) => {
    await gamePage.getByRole("button", { name: /mute sounds/i }).click();
    await expect(
      gamePage.getByRole("button", { name: /unmute sounds/i }),
    ).toBeVisible();
  });

  test("can toggle theme", async ({ gamePage }) => {
    await gamePage.getByRole("button", { name: /switch to.*mode/i }).click();
    await expect(
      gamePage.getByRole("button", { name: /switch to.*mode/i }),
    ).toBeVisible();
  });

  test("can navigate to statistics", async ({ gamePage }) => {
    await gamePage.getByRole("button", { name: /statistics/i }).click();
    await expect(gamePage.getByText(/statistics dashboard/i)).toBeVisible();
  });

  test("can quit game and return to welcome", async ({ gamePage }) => {
    await gamePage.startGame();
    await gamePage.waitForQuestion();
    await gamePage.quitGame();
    await expect(gamePage.getByText("Andernator")).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// Persistence
// ---------------------------------------------------------------------------

test.describe("Persistence", () => {
  test("remembers mute preference across reload", async ({ page }) => {
    // Do NOT clear localStorage — mute state written by the app must survive reload.
    await page.addInitScript((key: string) => {
      localStorage.setItem(key, "true");
    }, ONBOARDING_KEY);
    await setupApiMocks(page);
    await page.goto("/");

    await page.getByRole("button", { name: /mute sounds/i }).click();
    await expect(
      page.getByRole("button", { name: /unmute sounds/i }),
    ).toBeVisible();

    await page.reload();

    await expect(
      page.getByRole("button", { name: /unmute sounds/i }),
    ).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// Game answer types
// ---------------------------------------------------------------------------

test.describe("Game answer types", () => {
  test.beforeEach(async ({ gamePage }) => {
    // Override answer route: always return next question (no guess threshold)
    await gamePage.route("**/api/v2/game/answer", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          type: "question",
          question: mockQuestion(2),
          reasoning: { ...mockReasoning, remaining: 80 },
          remaining: 80,
          eliminated: 20,
          questionCount: 2,
        }),
      }),
    );

    await gamePage.startGame();
    await gamePage.waitForQuestion();
  });

  test("maybe/unknown button is present on question card", async ({
    gamePage,
  }) => {
    await expect(
      gamePage.getByRole("button", { name: /answer maybe/i }),
    ).toBeVisible();
  });

  test('clicking "Not sure" advances to next question', async ({ gamePage }) => {
    await gamePage.getByRole("button", { name: /answer maybe/i }).click();
    await gamePage.waitForQuestion();
  });
});

// ---------------------------------------------------------------------------
// Guess confirmation flow
// ---------------------------------------------------------------------------

test.describe("Guess confirmation flow", () => {
  test.beforeEach(async ({ gamePage }) => {
    // Override answer route: return a guess immediately on first answer
    await gamePage.route("**/api/v2/game/answer", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          type: "guess",
          character: {
            id: "mario",
            name: "Mario",
            category: "video-games",
            imageUrl: null,
          },
          confidence: 92,
          questionCount: 1,
          remaining: 1,
        }),
      }),
    );

    await gamePage.route("**/api/v2/game/reject-guess", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          type: "question",
          question: mockQuestion(2),
          reasoning: { ...mockReasoning, remaining: 50 },
          remaining: 50,
          eliminated: 50,
          questionCount: 2,
        }),
      }),
    );

    await gamePage.startGame();
    await gamePage.answerQuestion("yes");
  });

  test("correct guess flow shows game-over/win screen", async ({ gamePage }) => {
    await expect(gamePage.getByTestId("guess-correct-btn")).toBeVisible({
      timeout: 10000,
    });
    await gamePage.getByTestId("guess-correct-btn").click();

    await expect(gamePage.getByTestId("play-again-btn").first()).toBeVisible({
      timeout: 10000,
    });
  });

  test("wrong guess flow allows rejecting the guess", async ({ gamePage }) => {
    await expect(gamePage.getByTestId("guess-wrong-btn")).toBeVisible({
      timeout: 10000,
    });
    await gamePage.getByTestId("guess-wrong-btn").click();

    await gamePage.waitForQuestion();
  });
});

// ---------------------------------------------------------------------------
// Skip question
// ---------------------------------------------------------------------------

test.describe("Skip question", () => {
  test.beforeEach(async ({ gamePage }) => {
    // Override answer to always return a question (never guess, so skip is always visible)
    await gamePage.route("**/api/v2/game/answer", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          type: "question",
          question: mockQuestion(2),
          reasoning: { ...mockReasoning, remaining: 80 },
          remaining: 80,
          eliminated: 20,
          questionCount: 2,
        }),
      }),
    );
    await gamePage.startGame();
    await gamePage.waitForQuestion();
  });

  test("skip button advances to next question", async ({ gamePage }) => {
    await gamePage.skipQuestion();
    await gamePage.waitForQuestion();
  });

  test("sends correct sessionId to skip endpoint", async ({ gamePage }) => {
    const [request] = await Promise.all([
      gamePage.waitForRequest("**/api/v2/game/skip"),
      gamePage.skipQuestion(),
    ]);

    const body = request.postDataJSON() as Record<string, unknown>;
    expect(body.sessionId).toBe(MOCK_SESSION_ID);
  });
});

// ---------------------------------------------------------------------------
// Undo answer
// ---------------------------------------------------------------------------

test.describe("Undo answer", () => {
  test.beforeEach(async ({ gamePage }) => {
    // Override answer to always return a question so undo is testable
    await gamePage.route("**/api/v2/game/answer", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          type: "question",
          question: mockQuestion(2),
          reasoning: { ...mockReasoning, remaining: 80 },
          remaining: 80,
          eliminated: 20,
          questionCount: 2,
        }),
      }),
    );
    await gamePage.startGame();
  });

  test("undo reverts the last answer in the progress tracker", async ({
    gamePage,
  }) => {
    await gamePage.answerQuestion("yes");
    // Default medium difficulty: 15 max questions. After 1 answer → "14 left".
    await expect(gamePage.getByText("14 left")).toBeVisible();

    await gamePage.undoLastAnswer();
    await expect(gamePage.getByText("15 left")).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// Session resume
// ---------------------------------------------------------------------------

test.describe("Session resume", () => {
  test("resumes a non-expired session without showing welcome screen", async ({
    page,
  }) => {
    await page.addInitScript(
      (keys: { onboarding: string; session: string; sessionId: string }) => {
        localStorage.clear();
        localStorage.setItem(keys.onboarding, "true");
        sessionStorage.setItem(keys.session, keys.sessionId);
      },
      { onboarding: ONBOARDING_KEY, session: SESSION_KEY, sessionId: MOCK_SESSION_ID },
    );

    await setupApiMocks(page);
    // Override resume to return a live session
    await page.route("**/api/v2/game/resume", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          expired: false,
          sessionId: MOCK_SESSION_ID,
          question: mockQuestion(3),
          reasoning: mockReasoning,
          remaining: 60,
          totalCharacters: 100,
          answers: [
            { questionId: "q1", value: "yes" },
            { questionId: "q2", value: "no" },
          ],
          questionCount: 3,
          guessCount: 0,
        }),
      }),
    );

    await page.goto("/");

    // Should resume into the playing screen — question visible, no start button
    await expect(
      page.getByRole("button", { name: /answer yes/i }),
    ).toBeVisible({ timeout: 5000 });
    await expect(
      page.getByRole("button", { name: /start game/i }),
    ).not.toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// Onboarding
// ---------------------------------------------------------------------------

test.describe("Onboarding", () => {
  test("shows onboarding overlay when starting first game", async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.clear();
      // Deliberately no onboarding-complete flag → overlay triggers on first game
    });
    await setupApiMocks(page);
    await page.goto("/");

    await page.getByRole("button", { name: /start game/i }).first().click();

    // OnboardingOverlay step 1 title
    await expect(page.getByText("Answer Yes or No")).toBeVisible({
      timeout: 5000,
    });
  });
});

// ---------------------------------------------------------------------------
// Error states
// ---------------------------------------------------------------------------

test.describe("Error states", () => {
  test("handles API 500 on game start gracefully", async ({ page }) => {
    await page.addInitScript((key: string) => {
      localStorage.clear();
      localStorage.setItem(key, "true");
    }, ONBOARDING_KEY);
    await setupApiMocks(page);
    // Override start to return 500 — takes priority (LIFO routing)
    await page.route("**/api/v2/game/start", (route) =>
      route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ error: "Internal server error" }),
      }),
    );
    await page.goto("/");
    await page
      .getByRole("button", { name: /start game/i })
      .first()
      .click();

    // On start failure the app navigates back to welcome — start button stays accessible
    await expect(
      page.getByRole("button", { name: /start game/i }).first(),
    ).toBeVisible();
  });

  test("shows retry prompt when answer API returns 500", async ({ page }) => {
    await page.addInitScript((key: string) => {
      localStorage.clear();
      localStorage.setItem(key, "true");
    }, ONBOARDING_KEY);
    await setupApiMocks(page);

    // First answer succeeds (returns next question), second answer returns 500
    let callCount = 0;
    await page.route("**/api/v2/game/answer", (route) => {
      callCount++;
      if (callCount === 2) {
        return route.fulfill({
          status: 500,
          contentType: "application/json",
          body: JSON.stringify({ error: "server error" }),
        });
      }
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          type: "question",
          question: mockQuestion(callCount + 1),
          reasoning: { ...mockReasoning, remaining: 80 },
          remaining: 80,
          eliminated: 20,
          questionCount: callCount + 1,
        }),
      });
    });

    await page.goto("/");
    await page
      .getByRole("button", { name: /start game/i })
      .first()
      .click();

    // First answer succeeds — next question shown
    await expect(
      page.getByRole("button", { name: /answer yes/i }),
    ).toBeVisible();
    await page.getByRole("button", { name: /answer yes/i }).click();

    // Second answer triggers 500 — app undoes the last answer and shows retry
    await expect(
      page.getByRole("button", { name: /answer yes/i }),
    ).toBeVisible();
    await page.getByRole("button", { name: /answer yes/i }).click();

    await expect(
      page.getByRole("button", { name: /try again/i }),
    ).toBeVisible();
  });
});

