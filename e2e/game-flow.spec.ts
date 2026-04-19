import { test, expect, type Page } from '@playwright/test'

// ---------------------------------------------------------------------------
// Mock API helpers — the static preview server has no Workers backend,
// so we intercept /api/v2/game/* and return canned responses.
// ---------------------------------------------------------------------------

const MOCK_SESSION_ID = 'e2e-mock-session-id'

const mockReasoning = {
  why: 'Testing question',
  impact: 'Splits the pool evenly',
  remaining: 50,
  confidence: 20,
  topCandidates: [],
}

function mockQuestion(id: number) {
  return {
    id: `q${id}`,
    text: `Is your character from a movie? (mock question ${id})`,
    attribute: `mockAttr${id}`,
  }
}

let answerCount = 0

async function setupApiMocks(page: Page) {
  answerCount = 0

  await page.route('**/api/v2/game/start', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        sessionId: MOCK_SESSION_ID,
        question: mockQuestion(1),
        reasoning: mockReasoning,
        totalCharacters: 100,
      }),
    }),
  )

  await page.route('**/api/v2/game/answer', (route) => {
    answerCount++
    // After 3 answers, return a guess
    if (answerCount >= 3) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          type: 'guess',
          character: { id: 'mario', name: 'Mario', category: 'video-games', imageUrl: null },
          confidence: 85,
          questionCount: answerCount,
          remaining: 1,
        }),
      })
    }
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        type: 'question',
        question: mockQuestion(answerCount + 1),
        reasoning: { ...mockReasoning, remaining: 100 - answerCount * 20 },
        remaining: 100 - answerCount * 20,
        eliminated: answerCount * 20,
        questionCount: answerCount + 1,
      }),
    })
  })

  await page.route('**/api/v2/game/result', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        summary: {
          won: true,
          difficulty: 'medium',
          questionsAsked: answerCount,
          maxQuestions: 15,
          poolSize: 100,
        },
      }),
    }),
  )

  await page.route('**/api/v2/game/resume', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ expired: true }),
    }),
  )
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe('Game flow', () => {
  test.beforeEach(async ({ page }) => {
    // Set localStorage BEFORE the page loads so useKV hooks read these
    // values on first render (avoids race with the 300ms debounce write-back)
    await page.addInitScript(() => {
      localStorage.clear()
      localStorage.setItem('kv:onboarding-complete', 'true')
    })
    await setupApiMocks(page)
    await page.goto('/')
  })

  test('shows welcome screen with title and start button', async ({ page }) => {
    await expect(page.getByText('Andernator')).toBeVisible()
    await expect(page.getByRole('button', { name: /start game/i }).first()).toBeVisible()
  })

  test('can start a game and see a question', async ({ page }) => {
    await page.getByRole('button', { name: /start game/i }).first().click()

    // Should transition to playing phase with a question
    await expect(page.getByRole('button', { name: /answer yes/i })).toBeVisible({ timeout: 5000 })
    await expect(page.getByRole('button', { name: /answer no/i })).toBeVisible()
  })

  test('full game flow: answer questions until guess', async ({ page }) => {
    test.setTimeout(60000)
    await page.getByRole('button', { name: /start game/i }).first().click()

    // Answer questions until the mock API returns a guess (after 3 answers)
    for (let i = 0; i < 20; i++) {
      const correctButton = page.getByRole('button', { name: /yes.*correct/i })
      const wrongButton = page.getByRole('button', { name: /no.*wrong/i })
      const playAgainButton = page.getByRole('button', { name: /play again/i }).first()

      if (await correctButton.isVisible().catch(() => false)) {
        await correctButton.click()
        break
      }

      if (await wrongButton.isVisible().catch(() => false)) {
        await wrongButton.click()
        break
      }

      if (await playAgainButton.isVisible().catch(() => false)) {
        break
      }

      const yesButton = page.getByRole('button', { name: /answer yes/i })
      if (await yesButton.isVisible().catch(() => false)) {
        await yesButton.click()
        await page.waitForTimeout(500)
      } else {
        await page.waitForTimeout(1000)
      }
    }

    // Should end up in guess or gameOver phase
    const gameOverVisible = await page.getByRole('button', { name: /play again/i }).first().isVisible().catch(() => false)
    const guessVisible = await page.getByText(/was i correct/i).isVisible().catch(() => false)
    expect(gameOverVisible || guessVisible).toBe(true)
  })

  test('can mute/unmute sounds', async ({ page }) => {
    const muteButton = page.getByRole('button', { name: /mute sounds/i })
    await expect(muteButton).toBeVisible()
    await muteButton.click()

    // After clicking, should now show "Unmute sounds"
    await expect(page.getByRole('button', { name: /unmute sounds/i })).toBeVisible()
  })

  test('can toggle theme', async ({ page }) => {
    const themeButton = page.getByRole('button', { name: /switch to.*mode/i })
    await expect(themeButton).toBeVisible()
    await themeButton.click()
    // Theme should change (button label toggles between light/dark)
    await expect(page.getByRole('button', { name: /switch to.*mode/i })).toBeVisible()
  })

  test('can navigate to statistics', async ({ page }) => {
    const statsButton = page.getByRole('button', { name: /statistics/i })
    await expect(statsButton).toBeVisible()
    await statsButton.click()

    // Should show stats dashboard
    await expect(page.getByText(/statistics dashboard/i)).toBeVisible({ timeout: 5000 })
  })

  test('can quit game and return to welcome', async ({ page }) => {
    // Start a game
    await page.getByRole('button', { name: /start game/i }).first().click()
    await expect(page.getByRole('button', { name: /answer yes/i })).toBeVisible({ timeout: 5000 })

    // Click quit button (text is just "Quit")
    await page.getByRole('button', { name: /^quit$/i }).click()

    // Confirm quit in the alert dialog (button text is "Quit Game")
    await expect(page.getByText('Quit this game?')).toBeVisible()
    await page.getByRole('button', { name: /quit game/i }).click()

    // Should be back at welcome
    await expect(page.getByText('Andernator')).toBeVisible({ timeout: 5000 })
  })
})

test.describe('Persistence', () => {
  test('remembers mute preference across reload', async ({ page }) => {
    await page.goto('/')
    await page.evaluate(() => localStorage.clear())
    await page.reload()

    // Mute
    await page.getByRole('button', { name: /mute sounds/i }).click()
    await expect(page.getByRole('button', { name: /unmute sounds/i })).toBeVisible()

    // Reload
    await page.reload()

    // Should still be muted
    await expect(page.getByRole('button', { name: /unmute sounds/i })).toBeVisible()
  })
})
