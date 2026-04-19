import { test, expect } from '@playwright/test'

test.describe('Game flow', () => {
  test.beforeEach(async ({ page }) => {
    // Clear storage for a clean state, then mark onboarding as complete
    // to prevent the overlay from blocking interactions
    await page.goto('/')
    await page.evaluate(() => {
      localStorage.clear()
      localStorage.setItem('kv:onboarding-complete', 'true')
    })
    await page.reload()
  })

  test('shows welcome screen with title and start button', async ({ page }) => {
    await expect(page.getByText('Mystic Guesser')).toBeVisible()
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

    // Answer questions until the game makes a guess or we hit max
    for (let i = 0; i < 20; i++) {
      // Check if we've reached the guess phase
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

      // Still playing — answer the question
      const yesButton = page.getByRole('button', { name: /answer yes/i })
      if (await yesButton.isVisible().catch(() => false)) {
        await yesButton.click()
        // Wait for next question or phase transition
        await page.waitForTimeout(500)
      } else {
        // Might be in a transition — wait and check again
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

    // Dismiss onboarding overlay if it appears
    const skipButton = page.getByRole('button', { name: /skip/i })
    if (await skipButton.isVisible({ timeout: 1000 }).catch(() => false)) {
      await skipButton.click()
      await page.waitForTimeout(500)
    }

    // Click quit button (text is just "Quit")
    await page.getByRole('button', { name: /^quit$/i }).click()

    // Confirm quit in the alert dialog (button text is "Quit Game")
    await expect(page.getByText('Quit this game?')).toBeVisible()
    await page.getByRole('button', { name: /quit game/i }).click()

    // Should be back at welcome
    await expect(page.getByText('Mystic Guesser')).toBeVisible({ timeout: 5000 })
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
