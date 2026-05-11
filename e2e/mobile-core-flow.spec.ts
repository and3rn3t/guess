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

test.describe("MN.2 mobile core flow lane", () => {
  test("start -> answer -> guess -> game over", async ({ gamePage }) => {
    await gamePage.startGame();
    await gamePage.answerQuestions(3, "yes");
    await gamePage.waitForGuessScreen();

    await gamePage.getByTestId("guess-correct-btn").click();

    await expect(gamePage.getByTestId("play-again-btn").first()).toBeVisible();
    await expect(gamePage.getByRole("button", { name: /send feedback/i })).toBeVisible();
  });

  test("daily challenge entry reaches playing flow", async ({ page }) => {
    await page.addInitScript((key: string) => {
      localStorage.clear();
      localStorage.setItem(key, "true");
    }, ONBOARDING_KEY);

    await setupApiMocks(page);

    await page.route("**/api/v2/daily", (route) => {
      if (route.request().method() === "POST") {
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ ok: true, date: "2026-05-11", characterId: "mario" }),
        });
      }

      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          date: "2026-05-11",
          characterId: "mario",
          completed: false,
          result: null,
          featuredCharacter: {
            id: "mario",
            name: "Mario",
            imageUrl: null,
          },
        }),
      });
    });

    await page.route("**/api/v2/daily/leaderboard**", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          date: "2026-05-11",
          leaderboard: [],
        }),
      }),
    );

    await page.goto("/");

    await expect(page.getByRole("button", { name: /play daily/i })).toBeEnabled();
    await page.getByRole("button", { name: /play daily/i }).click();

    await expect(page.getByRole("button", { name: /answer yes/i })).toBeVisible();
  });

  test("resume saved session bypasses welcome", async ({ page }) => {
    await page.addInitScript(
      (keys: { onboarding: string; session: string; sessionId: string }) => {
        localStorage.clear();
        localStorage.setItem(keys.onboarding, "true");
        sessionStorage.setItem(keys.session, keys.sessionId);
      },
      {
        onboarding: ONBOARDING_KEY,
        session: SESSION_KEY,
        sessionId: MOCK_SESSION_ID,
      },
    );

    await setupApiMocks(page);

    await page.route("**/api/v2/game/resume", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          expired: false,
          sessionId: MOCK_SESSION_ID,
          question: mockQuestion(2),
          reasoning: mockReasoning,
          remaining: 70,
          totalCharacters: 100,
          questionCount: 2,
          guessCount: 0,
          answers: [{ questionId: "q1", value: "yes" }],
        }),
      }),
    );

    await page.goto("/");

    await expect(page.getByRole("button", { name: /answer yes/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /start game/i })).not.toBeVisible();
  });

  test("feedback submission posts rating from game-over", async ({ gamePage }) => {
    let feedbackPayload: Record<string, unknown> | null = null;

    await gamePage.route("**/api/v2/game/feedback", async (route) => {
      feedbackPayload = route.request().postDataJSON() as Record<string, unknown>;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true }),
      });
    });

    await gamePage.startGame();
    await gamePage.answerQuestions(3, "yes");
    await gamePage.waitForGuessScreen();
    await gamePage.getByTestId("guess-correct-btn").click();

    await expect(gamePage.getByRole("button", { name: /send feedback/i })).toBeVisible();
    await gamePage.getByRole("button", { name: "5" }).click();
    await gamePage.getByRole("button", { name: /send feedback/i }).click();

    await expect(gamePage.getByText(/feedback saved/i)).toBeVisible();
    expect(feedbackPayload?.rating).toBe(5);
    expect(feedbackPayload?.sessionId).toBe(MOCK_SESSION_ID);
  });

});
