import { test as base } from '@playwright/test'
import { GamePage } from './pages/GamePage'
import { setupApiMocks, ONBOARDING_KEY } from './helpers'

export { expect } from '@playwright/test'
export { MOCK_SESSION_ID, ONBOARDING_KEY, SESSION_KEY, mockQuestion, mockReasoning, setupApiMocks } from './helpers'

type Fixtures = {
  /** GamePage pre-loaded with localStorage init, API mocks, and navigated to '/'. */
  gamePage: GamePage
}

export const test = base.extend<Fixtures>({
  gamePage: async ({ page }, provide) => {
    await page.addInitScript((key: string) => {
      localStorage.clear()
      localStorage.setItem(key, 'true')
    }, ONBOARDING_KEY)
    await setupApiMocks(page)
    await page.goto('/')
    await provide(new GamePage(page))
  },
})
