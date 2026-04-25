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

async function setupApiMocks(page: Page) {
  let answerCount = 0

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
    await page.getByRole('button', { name: /start game/i }).first().click()

    // Mock returns a guess after 3 answers — click Yes 3 times
    for (let i = 0; i < 3; i++) {
      await expect(page.getByRole('button', { name: /answer yes/i })).toBeVisible()
      await page.getByRole('button', { name: /answer yes/i }).click()
    }

    // Should reach the guess confirmation screen
    await expect(page.getByText(/was i correct/i)).toBeVisible({ timeout: 5000 })
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

    // Confirm quit in the alert dialog (button text is "Quit Without Saving")
    await expect(page.getByText('End this game?')).toBeVisible()
    await page.getByRole('button', { name: /quit without saving/i }).click()

    // Should be back at welcome
    await expect(page.getByText('Andernator')).toBeVisible({ timeout: 5000 })
  })
})

test.describe('Persistence', () => {
  test('remembers mute preference across reload', async ({ page }) => {
    // addInitScript runs on every navigation — only set onboarding, don't clear,
    // so the mute state written by the app persists across the reload check.
    await setupApiMocks(page)
    await page.addInitScript(() => {
      localStorage.setItem('kv:onboarding-complete', 'true')
    })
    await page.goto('/')

    // Mute
    await page.getByRole('button', { name: /mute sounds/i }).click()
    await expect(page.getByRole('button', { name: /unmute sounds/i })).toBeVisible()

    // Reload — addInitScript sets onboarding key again but leaves mute key intact
    await page.reload()

    // Should still be muted
    await expect(page.getByRole('button', { name: /unmute sounds/i })).toBeVisible()
  })
})

test.describe('Game answer types', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.clear()
      localStorage.setItem('kv:onboarding-complete', 'true')
    })
    await setupApiMocks(page)

    // Override answer route to return 'maybe' type on first answer
    await page.route('**/api/v2/game/answer', (route) => {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          type: 'question',
          question: mockQuestion(2),
          reasoning: { ...mockReasoning, remaining: 80 },
          remaining: 80,
          eliminated: 20,
          questionCount: 2,
        }),
      })
    })

    await page.goto('/')
    await page.getByRole('button', { name: /start game/i }).first().click()
    await expect(page.getByRole('button', { name: /answer yes/i })).toBeVisible({ timeout: 5000 })
  })

  test('maybe/unknown button is present on question card', async ({ page }) => {
    // The "Not sure" / "Maybe" button should be visible alongside Yes/No
    const maybeButton = page.getByRole('button', { name: /not sure|maybe|unknown/i })
    await expect(maybeButton).toBeVisible()
  })

  test('clicking "Not sure" advances to next question', async ({ page }) => {
    const maybeButton = page.getByRole('button', { name: /not sure|maybe|unknown/i })
    await maybeButton.click()
    // Should still be in playing phase (next question loaded)
    await expect(page.getByRole('button', { name: /answer yes/i })).toBeVisible({ timeout: 5000 })
  })
})

test.describe('Guess confirmation flow', () => {
  async function setupGuessRoute(page: Page) {
    await page.addInitScript(() => {
      localStorage.clear()
      localStorage.setItem('kv:onboarding-complete', 'true')
    })

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

    // Immediately return a guess on first answer
    await page.route('**/api/v2/game/answer', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          type: 'guess',
          character: { id: 'mario', name: 'Mario', category: 'video-games', imageUrl: null },
          confidence: 92,
          questionCount: 1,
          remaining: 1,
        }),
      }),
    )

    await page.route('**/api/v2/game/result', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true }),
      }),
    )

    await page.route('**/api/v2/game/reject-guess', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          type: 'question',
          question: mockQuestion(2),
          reasoning: { ...mockReasoning, remaining: 50 },
          remaining: 50,
          eliminated: 50,
          questionCount: 2,
        }),
      }),
    )

    await page.route('**/api/v2/game/resume', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ expired: true }) }),
    )
  }

  test('correct guess flow shows game-over/win screen', async ({ page }) => {
    await setupGuessRoute(page)
    await page.goto('/')
    await page.getByRole('button', { name: /start game/i }).first().click()
    await expect(page.getByRole('button', { name: /answer yes/i })).toBeVisible({ timeout: 5000 })
    await page.getByRole('button', { name: /answer yes/i }).click()

    // Guess phase — confirm correct
    const confirmButton = page.getByRole('button', { name: /yes.*correct|that'?s correct/i })
    await expect(confirmButton).toBeVisible({ timeout: 10000 })
    await confirmButton.click()

    // Should reach game-over
    await expect(page.getByRole('button', { name: /play again/i }).first()).toBeVisible({ timeout: 10000 })
  })

  test('wrong guess flow allows rejecting the guess', async ({ page }) => {
    await setupGuessRoute(page)
    await page.goto('/')
    await page.getByRole('button', { name: /start game/i }).first().click()
    await expect(page.getByRole('button', { name: /answer yes/i })).toBeVisible({ timeout: 5000 })
    await page.getByRole('button', { name: /answer yes/i }).click()

    // Guess phase — reject the guess
    const wrongButton = page.getByRole('button', { name: /no.*wrong|that'?s wrong|wrong/i })
    await expect(wrongButton).toBeVisible({ timeout: 5000 })
    await wrongButton.click()

    // After rejecting, should show the next question
    await expect(page.getByRole('button', { name: /answer yes/i })).toBeVisible({ timeout: 5000 })
  })
})
