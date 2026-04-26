import { test as base } from '@playwright/test'
import { setupApiMocks } from './helpers'

export { expect } from '@playwright/test'
export { MOCK_SESSION_ID, mockQuestion, mockReasoning, setupApiMocks } from './helpers'

type Fixtures = {
  /** Page pre-loaded with localStorage init, API mocks, and navigated to '/'. */
  gamePage: import('@playwright/test').Page
}

export const test = base.extend<Fixtures>({
  gamePage: async ({ page }, provide) => {
    await page.addInitScript(() => {
      localStorage.clear()
      localStorage.setItem('kv:onboarding-complete', 'true')
    })
    await setupApiMocks(page)
    await page.goto('/')
    await provide(page)
  },
})
