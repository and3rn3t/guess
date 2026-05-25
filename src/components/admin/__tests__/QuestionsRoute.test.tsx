// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'

import QuestionsRoute from '../routes/QuestionsRoute'

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

interface MockQuestion {
  key: string
  displayText: string
  questionText: string | null
  isActive: boolean
  usageCount: number
  difficulty: string | null
  createdAt?: number
}

const DEFAULT_QUESTIONS: MockQuestion[] = [
  {
    key: 'isHuman',
    displayText: 'Is the character human?',
    questionText: 'Is the character a human being?',
    isActive: true,
    usageCount: 120,
    difficulty: 'easy',
    createdAt: Math.floor(Date.now() / 1000) - 86400,
  },
  {
    key: 'hasSuperpowers',
    displayText: 'Does the character have superpowers?',
    questionText: null,
    isActive: false,
    usageCount: 35,
    difficulty: 'hard',
    createdAt: Math.floor(Date.now() / 1000) - 86400 * 3,
  },
]

interface FetchCall {
  url: string
  method: string
  body: unknown
}

function buildFetchMock(options: {
  questions?: MockQuestion[]
  total?: number
  listStatus?: number
  expansionRuns?: unknown[]
} = {}) {
  const calls: FetchCall[] = []
  const questions = options.questions ?? DEFAULT_QUESTIONS
  const total = options.total ?? questions.length

  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = (() => {
      if (typeof input === 'string') return input
      if (input instanceof URL) return input.toString()
      return input.url
    })()
    const method = init?.method ?? 'GET'
    calls.push({ url, method, body: init?.body })

    // Expansion history (GET /api/admin/questions/expand)
    if (url.endsWith('/api/admin/questions/expand') && method === 'GET') {
      return {
        ok: true,
        json: async () => ({ runs: options.expansionRuns ?? [] }),
      }
    }

    // List (GET /api/admin/questions?...)
    if (url.includes('/api/admin/questions?')) {
      const status = options.listStatus ?? 200
      if (status >= 400) {
        return { ok: false, status, statusText: 'Internal Server Error', json: async () => ({}) }
      }
      return {
        ok: true,
        json: async () => ({ questions, total, page: 1, pageSize: 50 }),
      }
    }

    return { ok: false, status: 404, statusText: 'Not Found', json: async () => ({}) }
  })

  return { fetchMock, calls }
}

function renderRoute(): void {
  render(
    <MemoryRouter>
      <QuestionsRoute />
    </MemoryRouter>,
  )
}

beforeEach(() => {
  window.localStorage.clear()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('QuestionsRoute', () => {
  describe('loading & list rendering', () => {
    it('renders the questions list and the total in the header subtitle', async () => {
      const { fetchMock, calls } = buildFetchMock()
      vi.stubGlobal('fetch', fetchMock)

      renderRoute()

      await waitFor(() => {
        expect(screen.getByText('Is the character a human being?')).toBeInTheDocument()
      })

      // The second question has questionText=null, so it renders the placeholder.
      expect(screen.getByText('No question text')).toBeInTheDocument()
      expect(screen.getByText('isHuman')).toBeInTheDocument()
      expect(screen.getByText('hasSuperpowers')).toBeInTheDocument()
      expect(screen.getByText('2 attribute definitions')).toBeInTheDocument()

      const listCalls = calls.filter((c) => c.url.includes('/api/admin/questions?'))
      expect(listCalls.length).toBeGreaterThanOrEqual(1)
      const firstUrl = listCalls[0].url
      expect(firstUrl).toContain('page=1')
      expect(firstUrl).toContain('pageSize=50')
      expect(firstUrl).toContain('sort=usage')
      expect(firstUrl).toContain('order=desc')
      expect(firstUrl).toContain('active=all')
      expect(firstUrl).toContain('difficulty=all')
      expect(firstUrl).toContain('textStatus=all')
    })

    it('renders an error banner when the list endpoint returns a non-OK status', async () => {
      const { fetchMock } = buildFetchMock({ listStatus: 500 })
      vi.stubGlobal('fetch', fetchMock)

      renderRoute()

      await waitFor(() => {
        expect(screen.getByText(/500/)).toBeInTheDocument()
      })
    })

    it('renders gracefully when the API returns zero questions', async () => {
      const { fetchMock } = buildFetchMock({ questions: [], total: 0 })
      vi.stubGlobal('fetch', fetchMock)

      renderRoute()

      await waitFor(() => {
        expect(screen.getByText('0 attribute definitions')).toBeInTheDocument()
      })
    })
  })

  describe('search & filters', () => {
    it('debounces search input and refetches with the typed value', async () => {
      const user = userEvent.setup()
      const { fetchMock, calls } = buildFetchMock()
      vi.stubGlobal('fetch', fetchMock)

      renderRoute()

      await waitFor(() => {
        expect(screen.getByText('Is the character a human being?')).toBeInTheDocument()
      })

      const searchInput = screen.getByPlaceholderText('Search questions…')
      await user.type(searchInput, 'human')

      await waitFor(() => {
        const searched = calls.find(
          (c) => c.url.includes('/api/admin/questions?') && c.url.includes('search=human'),
        )
        expect(searched).toBeDefined()
      })
    })

    it('applies the "Needs Copy" quick preset (textStatus=missing, active=active)', async () => {
      const { fetchMock, calls } = buildFetchMock()
      vi.stubGlobal('fetch', fetchMock)

      renderRoute()

      await waitFor(() => {
        expect(screen.getByText('isHuman')).toBeInTheDocument()
      })

      fireEvent.click(screen.getByRole('button', { name: 'Needs Copy' }))

      await waitFor(() => {
        const presetCall = calls.find(
          (c) =>
            c.url.includes('/api/admin/questions?') &&
            c.url.includes('textStatus=missing') &&
            c.url.includes('active=active'),
        )
        expect(presetCall).toBeDefined()
      })
    })
  })

  describe('expansion workflow', () => {
    it('issues a dry-run expansion POST when "Preview Expansion" is clicked', async () => {
      const { fetchMock, calls } = buildFetchMock()
      // Override to also handle POST /api/admin/questions/expand
      const wrapped = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url
        if (url.endsWith('/api/admin/questions/expand') && (init?.method ?? 'GET') === 'POST') {
          calls.push({ url, method: 'POST', body: init?.body })
          return {
            ok: true,
            json: async () => ({
              ok: true,
              dryRun: true,
              targetAttributes: 4,
              candidates: 7,
              inserted: 0,
            }),
          }
        }
        return fetchMock(input, init)
      })
      vi.stubGlobal('fetch', wrapped)

      renderRoute()

      await waitFor(() => {
        expect(screen.getByText('isHuman')).toBeInTheDocument()
      })

      fireEvent.click(screen.getByRole('button', { name: /Preview Expansion/ }))

      await waitFor(() => {
        const postCall = calls.find(
          (c) => c.url.endsWith('/api/admin/questions/expand') && c.method === 'POST',
        )
        expect(postCall).toBeDefined()
        expect(JSON.parse(String(postCall!.body))).toMatchObject({ dryRun: true, limit: 40 })
      })

      await waitFor(() => {
        expect(
          screen.getByText(/Preview complete: 7 candidate questions across 4 attributes/),
        ).toBeInTheDocument()
      })
    })
  })
})
