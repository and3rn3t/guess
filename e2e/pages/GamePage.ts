import type { Page } from '@playwright/test'
import { expect } from '@playwright/test'

/**
 * Page Object Model for the Andernator game.
 *
 * Exposes high-level game actions alongside proxy methods for the underlying
 * Playwright `Page`, so existing `beforeEach` route overrides and inline
 * assertions continue to work without change.
 */
export class GamePage {
  constructor(readonly page: Page) {}

  // ── Page proxy methods ──────────────────────────────────────────────────
  // These delegate directly to the underlying Page so existing test code
  // that calls `gamePage.route(...)`, `gamePage.getByRole(...)`, etc. keeps
  // working after the fixture type changes from `Page` to `GamePage`.

  route(...args: Parameters<Page['route']>) {
    return this.page.route(...args)
  }

  getByRole(...args: Parameters<Page['getByRole']>) {
    return this.page.getByRole(...args)
  }

  getByTestId(id: string) {
    return this.page.getByTestId(id)
  }

  getByText(...args: Parameters<Page['getByText']>) {
    return this.page.getByText(...args)
  }

  waitForRequest(...args: Parameters<Page['waitForRequest']>) {
    return this.page.waitForRequest(...args)
  }

  // ── High-level game actions ─────────────────────────────────────────────

  async startGame() {
    await this.page.getByRole('button', { name: /start game/i }).first().click()
  }

  /** Waits until the Yes answer button is visible (question card rendered). */
  async waitForQuestion() {
    await expect(this.page.getByRole('button', { name: /answer yes/i })).toBeVisible()
  }

  /** Waits for the question card, then clicks the given answer button. */
  async answerQuestion(value: 'yes' | 'no' | 'maybe' = 'yes') {
    await this.waitForQuestion()
    await this.page.getByRole('button', { name: new RegExp(`answer ${value}`, 'i') }).click()
  }

  /** Answers `n` consecutive questions with the same value. */
  async answerQuestions(n: number, value: 'yes' | 'no' | 'maybe' = 'yes') {
    for (let i = 0; i < n; i++) {
      await this.answerQuestion(value)
    }
  }

  /** Waits until the "Was I correct?" guess screen is visible. */
  async waitForGuessScreen() {
    await expect(this.page.getByText(/was i correct/i)).toBeVisible()
  }

  async skipQuestion() {
    await this.page.getByTestId('skip-btn').click()
  }

  async undoLastAnswer() {
    await this.page.getByRole('button', { name: /undo last answer/i }).click()
  }

  /** Clicks Quit, confirms the dialog, and returns to the welcome screen. */
  async quitGame() {
    await this.page.getByRole('button', { name: /^quit$/i }).click()
    await expect(this.page.getByText('End this game?')).toBeVisible()
    await this.page.getByRole('button', { name: /quit without saving/i }).click()
  }
}
