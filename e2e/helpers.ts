import type { Page } from '@playwright/test'

// ---------------------------------------------------------------------------
// Shared mock constants
// ---------------------------------------------------------------------------

export const MOCK_SESSION_ID = 'e2e-mock-session-id'

export const mockReasoning = {
  why: 'Testing question',
  impact: 'Splits the pool evenly',
  remaining: 50,
  confidence: 20,
  topCandidates: [],
}

export function mockQuestion(id: number) {
  return {
    id: `q${id}`,
    text: `Is your character from a movie? (mock question ${id})`,
    attribute: `mockAttr${id}`,
  }
}

// ---------------------------------------------------------------------------
// Default API mock setup
// The static preview server has no Workers backend, so we intercept
// /api/v2/game/* and return canned responses.
// ---------------------------------------------------------------------------

export async function setupApiMocks(page: Page) {
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
