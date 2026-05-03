// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { SlaTargetsPanel } from './SlaTargetsPanel'

const mockSlaResponse = {
  targets: [
    {
      attributeKey: 'isHuman',
      displayName: 'Is Human',
      category: 'video-games',
      target: 1,
    },
    {
      attributeKey: 'isHuman',
      displayName: 'Is Human',
      category: 'movies',
      target: 1,
    },
    {
      attributeKey: 'firstAppearedYear',
      displayName: 'First Appeared Year',
      category: 'video-games',
      target: 0.95,
    },
    {
      attributeKey: 'firstAppearedYear',
      displayName: 'First Appeared Year',
      category: 'movies',
      target: 0.95,
    },
  ],
}

describe('SlaTargetsPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Mock fetch globally
    global.fetch = vi.fn()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders loading state initially', async () => {
    ;(global.fetch as ReturnType<typeof vi.fn>).mockImplementation(
      () =>
        new Promise((resolve) => {
          setTimeout(
            () =>
              resolve({
                ok: true,
                json: async () => mockSlaResponse,
              } as Response),
            100
          )
        })
    )
    render(<SlaTargetsPanel />)
    expect(screen.getByText('SLA Targets')).toBeInTheDocument()
  })

  it('renders SLA targets after loading', async () => {
    ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => mockSlaResponse,
    })

    render(<SlaTargetsPanel />)

    await waitFor(() => {
      expect(screen.getByText('Is Human')).toBeInTheDocument()
      expect(screen.getByText('First Appeared Year')).toBeInTheDocument()
    })

    // Verify targets are displayed (allow multiple)
    const hundredPercents = screen.getAllByText('100%')
    expect(hundredPercents.length).toBeGreaterThan(0)
  })

  it('renders error state on fetch failure', async () => {
    const errorMsg = 'Network error'
    ;(global.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error(errorMsg)
    )

    render(<SlaTargetsPanel />)

    await waitFor(() => {
      expect(screen.getByText(errorMsg)).toBeInTheDocument()
    })
  })

  it('groups targets by attribute', async () => {
    ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => mockSlaResponse,
    })

    render(<SlaTargetsPanel />)

    await waitFor(() => {
      // Check that both attributes are rendered as separate sections
      expect(screen.getByText('Is Human')).toBeInTheDocument()
      expect(screen.getByText('First Appeared Year')).toBeInTheDocument()
    })
  })

  it('displays categories correctly', async () => {
    ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => mockSlaResponse,
    })

    render(<SlaTargetsPanel />)

    await waitFor(() => {
      // Use queryAllByText to handle multiple instances
      const videoGamesElements = screen.queryAllByText('video games')
      expect(videoGamesElements.length).toBeGreaterThan(0)
      const moviesElements = screen.queryAllByText('movies')
      expect(moviesElements.length).toBeGreaterThan(0)
    })
  })
})
