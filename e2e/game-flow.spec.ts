import { expect } from "@playwright/test";
import {
  MOCK_SESSION_ID,
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
    gamePage: page,
  }) => {
    await expect(page.getByText("Andernator")).toBeVisible();
    await expect(
      page.getByRole("button", { name: /start game/i }).first(),
    ).toBeVisible();
  });

  test("can start a game and see a question", async ({ gamePage: page }) => {
    await page
      .getByRole("button", { name: /start game/i })
      .first()
      .click();

    await expect(
      page.getByRole("button", { name: /answer yes/i }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /answer no/i }),
    ).toBeVisible();
  });

  test("full game flow: answer questions until guess", async ({
    gamePage: page,
  }) => {
    await page
      .getByRole("button", { name: /start game/i })
      .first()
      .click();

    for (let i = 0; i < 3; i++) {
      await expect(
        page.getByRole("button", { name: /answer yes/i }),
      ).toBeVisible();
      await page.getByRole("button", { name: /answer yes/i }).click();
    }

    await expect(page.getByText(/was i correct/i)).toBeVisible();
  });

  test("sends correct payload to answer endpoint", async ({
    gamePage: page,
  }) => {
    await page
      .getByRole("button", { name: /start game/i })
      .first()
      .click();
    await expect(
      page.getByRole("button", { name: /answer yes/i }),
    ).toBeVisible();

    const [request] = await Promise.all([
      page.waitForRequest("**/api/v2/game/answer"),
      page.getByRole("button", { name: /answer yes/i }).click(),
    ]);

    const body = request.postDataJSON() as Record<string, unknown>;
    expect(body.sessionId).toBe(MOCK_SESSION_ID);
    expect(body.value).toBe("yes");
  });

  test("can mute/unmute sounds", async ({ gamePage: page }) => {
    await page.getByRole("button", { name: /mute sounds/i }).click();
    await expect(
      page.getByRole("button", { name: /unmute sounds/i }),
    ).toBeVisible();
  });

  test("can toggle theme", async ({ gamePage: page }) => {
    await page.getByRole("button", { name: /switch to.*mode/i }).click();
    await expect(
      page.getByRole("button", { name: /switch to.*mode/i }),
    ).toBeVisible();
  });

  test("can navigate to statistics", async ({ gamePage: page }) => {
    await page.getByRole("button", { name: /statistics/i }).click();
    await expect(page.getByText(/statistics dashboard/i)).toBeVisible();
  });

  test("can quit game and return to welcome", async ({ gamePage: page }) => {
    await page
      .getByRole("button", { name: /start game/i })
      .first()
      .click();
    await expect(
      page.getByRole("button", { name: /answer yes/i }),
    ).toBeVisible();

    await page.getByRole("button", { name: /^quit$/i }).click();

    await expect(page.getByText("End this game?")).toBeVisible();
    await page.getByRole("button", { name: /quit without saving/i }).click();

    await expect(page.getByText("Andernator")).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// Persistence
// ---------------------------------------------------------------------------

test.describe("Persistence", () => {
  test("remembers mute preference across reload", async ({ page }) => {
    // Do NOT clear localStorage — mute state written by the app must survive reload.
    await page.addInitScript(() => {
      localStorage.setItem("kv:onboarding-complete", "true");
    });
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

    await gamePage
      .getByRole("button", { name: /start game/i })
      .first()
      .click();
    await expect(
      gamePage.getByRole("button", { name: /answer yes/i }),
    ).toBeVisible();
  });

  test("maybe/unknown button is present on question card", async ({
    gamePage,
  }) => {
    await expect(
      gamePage.getByRole("button", { name: /answer maybe/i }),
    ).toBeVisible();
  });

  test('clicking "Not sure" advances to next question', async ({
    gamePage,
  }) => {
    await gamePage.getByRole("button", { name: /answer maybe/i }).click();
    await expect(
      gamePage.getByRole("button", { name: /answer yes/i }),
    ).toBeVisible();
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

    await gamePage
      .getByRole("button", { name: /start game/i })
      .first()
      .click();
    await expect(
      gamePage.getByRole("button", { name: /answer yes/i }),
    ).toBeVisible();
    await gamePage.getByRole("button", { name: /answer yes/i }).click();
  });

  test("correct guess flow shows game-over/win screen", async ({
    gamePage,
  }) => {
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

    await expect(
      gamePage.getByRole("button", { name: /answer yes/i }),
    ).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// Error states
// ---------------------------------------------------------------------------

test.describe("Error states", () => {
  test("handles API 500 on game start gracefully", async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.clear();
      localStorage.setItem("kv:onboarding-complete", "true");
    });
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
    await page.addInitScript(() => {
      localStorage.clear();
      localStorage.setItem("kv:onboarding-complete", "true");
    });
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
