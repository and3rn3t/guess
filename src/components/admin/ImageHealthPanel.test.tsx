// @vitest-environment jsdom
import { render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest'
import { ImageHealthPanel } from './ImageHealthPanel'

describe('ImageHealthPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Mock fetch globally
    globalThis.fetch = vi.fn()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('loads and displays image health data', async () => {
    const mockData = {
      totals: {
        totalCharacters: 100,
        withImage: 95,
        validR2Url: 90,
        missingUrl: 5,
        invalidUrl: 3,
        externalUrl: 2,
        usablePct: 0.9,
      },
      perCategory: [
        { category: 'movies', total: 40, withImage: 38, validR2Url: 37, imageCoveragePct: 0.925 },
        { category: 'anime', total: 30, withImage: 28, validR2Url: 27, imageCoveragePct: 0.9 },
        { category: 'comics', total: 30, withImage: 29, validR2Url: 26, imageCoveragePct: 0.867 },
      ],
      issues: [
        {
          characterId: 'c1',
          characterName: 'Test Character',
          category: 'movies',
          issueType: 'missing-url' as const,
          reason: 'No image URL set',
          popularity: 0.95,
        },
      ],
    }

    ;(globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => mockData,
    })

    render(<ImageHealthPanel />)

    // Wait for the data to load
    await waitFor(() => {
      expect(screen.getByText('100')).toBeInTheDocument()
    })

    // Check overall metrics
    expect(screen.getByText('Total Characters')).toBeInTheDocument()
    expect(screen.getByText('Usable Portraits')).toBeInTheDocument()

    // Check per-category breakdown
    const categoryHeaders = screen.getAllByText(/^(movies|anime|comics)$/)
    expect(categoryHeaders.length).toBeGreaterThanOrEqual(2)

    // Check issues section
    expect(screen.getByText('Test Character')).toBeInTheDocument()
  })

  it('displays loading skeleton initially', () => {
    ;(globalThis.fetch as ReturnType<typeof vi.fn>).mockImplementation(
      () => new Promise(() => {}) // Never resolves
    )

    render(<ImageHealthPanel />)

    expect(screen.getByText('Image Health')).toBeInTheDocument()
    // Skeleton should be present during loading
  })

  it('displays error message on fetch failure', async () => {
    ;(globalThis.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Network error'))

    render(<ImageHealthPanel />)

    await waitFor(() => {
      expect(screen.getByText('Network error')).toBeInTheDocument()
    })
  })

  it('displays no data message when response is empty', async () => {
    ;(globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => null,
    })

    render(<ImageHealthPanel />)

    await waitFor(() => {
      expect(screen.getByText('No image health data available')).toBeInTheDocument()
    })
  })
})
