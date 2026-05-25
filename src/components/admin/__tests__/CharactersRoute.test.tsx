// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'

import CharactersRoute from '../routes/CharactersRoute'

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

interface MockCharacter {
  id: string
  name: string
  category: string
  source: string
  popularity: number
  imageUrl: string | null
  attributeCount: number
  totalAttributes: number
  coveragePct: number
  isCustom: boolean
  createdAt: number
}

const DEFAULT_CHARACTERS: MockCharacter[] = [
  {
    id: 'goku',
    name: 'Goku',
    category: 'anime',
    source: 'tmdb',
    popularity: 0.95,
    imageUrl: null,
    attributeCount: 18,
    totalAttributes: 20,
    coveragePct: 90,
    isCustom: false,
    createdAt: Math.floor(Date.now() / 1000) - 86400 * 7,
  },
  {
    id: 'batman',
    name: 'Batman',
    category: 'superheroes',
    source: 'tmdb',
    popularity: 0.92,
    imageUrl: null,
    attributeCount: 19,
    totalAttributes: 20,
    coveragePct: 95,
    isCustom: false,
    createdAt: Math.floor(Date.now() / 1000) - 86400 * 14,
  },
]

interface FetchCall {
  url: string
  method: string
  body: unknown
}

/**
 * Build a fetch mock keyed by URL substring. Tracks every call so tests can
 * assert exact query-string construction for future-extraction parity.
 */
function buildFetchMock(options: {
  characters?: MockCharacter[]
  total?: number
  listStatus?: number
  detailPayload?: unknown
  deleteStatus?: number
} = {}) {
  const calls: FetchCall[] = []
  const characters = options.characters ?? DEFAULT_CHARACTERS
  const total = options.total ?? characters.length

  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = (() => {
      if (typeof input === 'string') return input
      if (input instanceof URL) return input.toString()
      return input.url
    })()
    const method = init?.method ?? 'GET'
    calls.push({ url, method, body: init?.body })

    // Detail endpoint — GET /api/admin/characters/<id>
    if (/\/api\/admin\/characters\/[^?]+$/.test(url) && method === 'GET') {
      return {
        ok: true,
        json: async () => options.detailPayload ?? {
          definitions: [
            { key: 'isHuman', displayText: 'Is human?' },
            { key: 'hasSuperpowers', displayText: 'Has superpowers?' },
          ],
          attributes: { isHuman: 1, hasSuperpowers: 0 },
          evidence: { isHuman: 'wiki source', hasSuperpowers: null },
          agreement: { isHuman: { score: 0.95, signals: 3 }, hasSuperpowers: { score: null, signals: 0 } },
        },
      }
    }

    // DELETE /api/admin/characters/<id>
    if (/\/api\/admin\/characters\/[^?]+$/.test(url) && method === 'DELETE') {
      const status = options.deleteStatus ?? 200
      return { ok: status < 400, status, statusText: status < 400 ? 'OK' : 'Error' }
    }

    // List endpoint — GET /api/admin/characters?...
    if (url.includes('/api/admin/characters')) {
      const status = options.listStatus ?? 200
      if (status >= 400) {
        return { ok: false, status, statusText: 'Internal Server Error', json: async () => ({}) }
      }
      return {
        ok: true,
        json: async () => ({
          characters,
          total,
          page: 1,
          pageSize: 50,
        }),
      }
    }

    return { ok: false, status: 404, statusText: 'Not Found', json: async () => ({}) }
  })

  return { fetchMock, calls }
}

function renderRoute(): void {
  render(
    <MemoryRouter>
      <CharactersRoute />
    </MemoryRouter>,
  )
}

beforeEach(() => {
  // Each test gets a clean localStorage (recent searches widget reads from it).
  window.localStorage.clear()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('CharactersRoute', () => {
  describe('loading & list rendering', () => {
    it('renders the character list from the admin API and the total in the header subtitle', async () => {
      const { fetchMock, calls } = buildFetchMock()
      vi.stubGlobal('fetch', fetchMock)

      renderRoute()

      await waitFor(() => {
        expect(screen.getByText('Goku')).toBeInTheDocument()
      })

      expect(screen.getByText('Batman')).toBeInTheDocument()
      expect(screen.getByText('2 characters')).toBeInTheDocument()
      expect(screen.getByText('90%')).toBeInTheDocument()
      expect(screen.getByText('95%')).toBeInTheDocument()

      // Initial fetch parameters: page=1, pageSize=50, sort=popularity, order=desc, no maxCoverage.
      const listCalls = calls.filter((c) => c.url.includes('/api/admin/characters?'))
      expect(listCalls.length).toBeGreaterThanOrEqual(1)
      const firstUrl = listCalls[0].url
      expect(firstUrl).toContain('page=1')
      expect(firstUrl).toContain('pageSize=50')
      expect(firstUrl).toContain('sort=popularity')
      expect(firstUrl).toContain('order=desc')
      expect(firstUrl).not.toContain('maxCoverage=')
    })

    it('renders an error banner when the list endpoint returns a non-OK status', async () => {
      const { fetchMock } = buildFetchMock({ listStatus: 500 })
      vi.stubGlobal('fetch', fetchMock)

      renderRoute()

      await waitFor(() => {
        expect(screen.getByText(/500/)).toBeInTheDocument()
      })
    })

    it('renders an empty body when the API returns zero characters', async () => {
      const { fetchMock } = buildFetchMock({ characters: [], total: 0 })
      vi.stubGlobal('fetch', fetchMock)

      renderRoute()

      // Wait for the loading skeletons to clear (header subtitle proves data settled).
      await waitFor(() => {
        expect(screen.getByText('0 characters')).toBeInTheDocument()
      })

      expect(screen.queryByText('Goku')).not.toBeInTheDocument()
      expect(screen.queryByText('Batman')).not.toBeInTheDocument()
    })
  })

  describe('filtering & sorting', () => {
    it('debounces search input changes and re-fetches with the search query string', async () => {
      const user = userEvent.setup()
      const { fetchMock, calls } = buildFetchMock()
      vi.stubGlobal('fetch', fetchMock)

      renderRoute()

      await waitFor(() => {
        expect(screen.getByText('Goku')).toBeInTheDocument()
      })

      const searchInput = screen.getByPlaceholderText('Search characters...')
      await user.type(searchInput, 'batman')

      // Debounce is 300ms; allow waitFor's default 1000ms window.
      await waitFor(() => {
        const searchCalls = calls.filter((c) => c.url.includes('search=batman'))
        expect(searchCalls.length).toBeGreaterThan(0)
      })
    })

    it('toggles sort column from the column header (popularity → name desc, then name asc)', async () => {
      const user = userEvent.setup()
      const { fetchMock, calls } = buildFetchMock()
      vi.stubGlobal('fetch', fetchMock)

      renderRoute()

      await waitFor(() => {
        expect(screen.getByText('Goku')).toBeInTheDocument()
      })

      const nameHeader = screen.getByRole('button', { name: /^Name/ })
      await user.click(nameHeader)

      await waitFor(() => {
        const sortCalls = calls.filter((c) => c.url.includes('sort=name') && c.url.includes('order=desc'))
        expect(sortCalls.length).toBeGreaterThan(0)
      })

      // Clicking the same column flips the order to asc.
      await user.click(nameHeader)

      await waitFor(() => {
        const ascCalls = calls.filter((c) => c.url.includes('sort=name') && c.url.includes('order=asc'))
        expect(ascCalls.length).toBeGreaterThan(0)
      })
    })
  })

  describe('row actions', () => {
    it('requires two-click confirm before issuing a DELETE for an individual character', async () => {
      const user = userEvent.setup()
      const { fetchMock, calls } = buildFetchMock()
      vi.stubGlobal('fetch', fetchMock)

      renderRoute()

      await waitFor(() => {
        expect(screen.getByText('Goku')).toBeInTheDocument()
      })

      const gokuRow = screen.getByText('Goku').closest('tr')
      expect(gokuRow).not.toBeNull()
      const deleteButton = within(gokuRow as HTMLElement).getByTitle('Delete character')

      // First click arms the confirm — no DELETE issued yet.
      await user.click(deleteButton)
      const deleteCallsAfterFirst = calls.filter((c) => c.method === 'DELETE')
      expect(deleteCallsAfterFirst).toHaveLength(0)

      // Title flips to the confirm prompt.
      await waitFor(() => {
        expect(within(gokuRow as HTMLElement).getByTitle('Click again to confirm delete')).toBeInTheDocument()
      })

      // Second click issues the DELETE.
      const confirmButton = within(gokuRow as HTMLElement).getByTitle('Click again to confirm delete')
      await user.click(confirmButton)

      await waitFor(() => {
        const deleteCalls = calls.filter((c) => c.method === 'DELETE' && c.url.includes('/api/admin/characters/goku'))
        expect(deleteCalls.length).toBe(1)
      })
    })

    it('expands a row, fetches the detail endpoint, and renders the attribute buttons', async () => {
      const user = userEvent.setup()
      const { fetchMock, calls } = buildFetchMock()
      vi.stubGlobal('fetch', fetchMock)

      renderRoute()

      await waitFor(() => {
        expect(screen.getByText('Goku')).toBeInTheDocument()
      })

      const gokuRow = screen.getByText('Goku').closest('tr')
      const expandButton = within(gokuRow as HTMLElement).getByTitle('Edit attributes')
      await user.click(expandButton)

      await waitFor(() => {
        expect(screen.getByText('isHuman')).toBeInTheDocument()
      })

      expect(screen.getByText('hasSuperpowers')).toBeInTheDocument()

      const detailCalls = calls.filter(
        (c) => c.method === 'GET' && /\/api\/admin\/characters\/goku$/.test(c.url),
      )
      expect(detailCalls.length).toBe(1)
    })
  })

  describe('batch selection', () => {
    it('select-all checkbox marks every row selected and reveals the batch re-enrich action', async () => {
      const { fetchMock } = buildFetchMock()
      vi.stubGlobal('fetch', fetchMock)

      renderRoute()

      await waitFor(() => {
        expect(screen.getByText('Goku')).toBeInTheDocument()
      })

      const selectAll = screen.getByLabelText('Select all') as HTMLInputElement
      fireEvent.click(selectAll)

      await waitFor(() => {
        expect(screen.getByText(/Re-enrich 2 selected/)).toBeInTheDocument()
      })

      const gokuCheckbox = screen.getByLabelText('Select Goku') as HTMLInputElement
      const batmanCheckbox = screen.getByLabelText('Select Batman') as HTMLInputElement
      expect(gokuCheckbox.checked).toBe(true)
      expect(batmanCheckbox.checked).toBe(true)
    })
  })
})
