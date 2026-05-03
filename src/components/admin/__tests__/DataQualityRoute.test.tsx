// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import type { ReactNode } from 'react'

import DataQualityRoute from '../routes/DataQualityRoute'

vi.mock('recharts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('recharts')>()
  return {
    ...actual,
    ResponsiveContainer: ({ children }: { children?: ReactNode }) => (
      <div className="h-80 w-200">{children}</div>
    ),
  }
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('DataQualityRoute', () => {
  it('renders completeness gate metrics from the admin API payload', async () => {
    const fetchMock = vi.fn().mockImplementation(async (input: RequestInfo | URL) => {
      const url = (() => {
        if (typeof input === 'string') return input
        if (input instanceof URL) return input.toString()
        return input.url
      })()
      if (url.includes('/api/admin/data-quality/closure-queue-status')) {
        return {
          ok: true,
          json: async () => ({
            report: {
              generatedAt: '2026-05-03T19:03:17.940Z',
              summary: {
                totalPairs: 50,
                automationPairs: 20,
                manualPairs: 30,
              },
            },
            fetchedAt: 1714760000000,
          }),
        }
      }
      if (url.includes('/api/admin/source-health-status')) {
        return {
          ok: true,
          json: async () => ({
            report: {
              generatedAt: '2026-05-03T19:04:17.940Z',
              totals: {
                totalCharacters: 100,
                validCharacters: 95,
                issueCount: 5,
                coveragePct: 0.95,
              },
            },
            fetchedAt: 1714760000000,
          }),
        }
      }
      if (url.includes('/api/admin/source-health')) {
        return {
          ok: true,
          json: async () => ({
            generatedAt: '2026-05-03T19:04:17.940Z',
            totals: {
              totalCharacters: 100,
              validCharacters: 95,
              issueCount: 5,
              coveragePct: 0.95,
            },
            perSource: [
              {
                source: 'tmdb',
                total: 30,
                valid: 29,
                missing: 1,
                malformed: 0,
                coveragePct: 0.9667,
              },
            ],
            issues: [
              {
                characterId: 'c1',
                characterName: 'Spike Spiegel',
                category: 'anime',
                source: 'tmdb',
                sourceId: null,
                issueType: 'missing-source-id',
                reason: 'tmdb source is missing source_id.',
                popularity: 0.9,
                agedDays: 5,
                createdAt: Math.floor(Date.now() / 1000) - 5 * 86400,
              },
            ],
          }),
        }
      }
      if (url.includes('/api/admin/data-quality/closure-queue')) {
        return {
          ok: true,
          json: async () => ({
            generatedAt: '2026-05-03T19:03:17.940Z',
            limit: 50,
            lanePolicy: {
              automationScoreThreshold: 0.00002,
              automationMinConfidenceGap: 0.1,
            },
            totalCandidatePairs: 1234,
            summary: {
              totalPairs: 50,
              automationPairs: 20,
              manualPairs: 30,
              categories: { anime: 50 },
              attributes: { personality: 30, firstAppearedYear: 20 },
            },
            queue: [
              {
                characterId: 'anilist-1',
                characterName: 'Levi',
                category: 'anime',
                attributeKey: 'firstAppearedYear',
                score: 0.000078,
                lane: 'automation',
                components: {
                  popularity: 0.01,
                  selectorImpact: 0.7,
                  confidenceGap: 0.95,
                  staleness: 0.16,
                },
              },
            ],
          }),
        }
      }
      if (url.includes('/api/admin/image-health')) {
        return {
          ok: true,
          json: async () => ({
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
            ],
            issues: [],
          }),
        }
      }
      if (url.includes('/api/admin/curator-queue')) {
        return {
          ok: true,
          json: async () => ({
            report: {
              totals: {
                totalItems: 10,
                unresolved: 8,
                assigned: 3,
                locked: 1,
                avgAgedDays: 2,
              },
              perIssueType: {
                cannot_infer: { count: 5, percentOfTotal: 50 },
                canon_conflict: { count: 3, percentOfTotal: 30 },
                subjective: { count: 2, percentOfTotal: 20 },
              },
              items: [],
            },
            fetchedAt: Date.now(),
            limit: 200,
          }),
        }
      }

      return {
        ok: true,
        json: async () => ({
          live: {
            capturedAt: 1,
            dataHealthScore: 88.2,
            components: { coverage: 0.9, evidence: 0.85, agreement: 0.8, disputeHealth: 0.95 },
            weights: { coverage: 0.3, evidence: 0.3, agreement: 0.25, disputeHealth: 0.15 },
            coveragePct: 0.9,
            evidencePct: 0.85,
            agreementAvg: 0.8,
            agreementSampleSize: 123,
            openDisputes: 5,
            totalCharacters: 100,
            activeAttributes: 20,
            attributeRows: 1800,
            completeness: {
              dataCompleteScore: 0.9342,
              components: {
                global: 0.93,
                categoryFloor: 0.91,
                evidence: 0.88,
                sourceId: 0.95,
                disputeHealth: 0.92,
              },
              weights: {
                global: 0.35,
                categoryFloor: 0.25,
                evidence: 0.2,
                sourceId: 0.1,
                disputeHealth: 0.1,
              },
              categoryFloorScore: 0.91,
              categoryCompleteness: {
                anime: 0.91,
                movies: 0.96,
                books: 0.93,
              },
              globalCompleteness: 0.93,
              evidenceCoverage: 0.88,
              sourceIdCoverage: 0.95,
              openHighPriorityDisputes: 4,
              totalRequiredCells: 2000,
              filledRequiredCells: 1860,
              gate: {
                warn: true,
                fail: false,
                warnThreshold: 0.92,
                failThreshold: 0.95,
                categoryFloorThreshold: 0.9,
                disputeBudget: 25,
                categoriesBelowFloor: [],
              },
              config: {
                warnScore: 0.92,
                failScore: 0.95,
                defaultCategoryFloor: 0.9,
                disputeBudget: 25,
              },
            },
          },
          history: [
            {
              captured_at: 1714650000,
              data_health_score: 85,
              coverage_pct: 0.88,
              evidence_pct: 0.84,
              agreement_avg: 0.78,
              open_disputes: 6,
              golden_pass_rate: null,
              vision_pass_rate: null,
              closure_total_pairs: 100,
              closure_automation_pairs: 50,
              closure_manual_pairs: 50,
            },
            {
              captured_at: 1714736400,
              data_health_score: 88.2,
              coverage_pct: 0.9,
              evidence_pct: 0.85,
              agreement_avg: 0.8,
              open_disputes: 5,
              golden_pass_rate: null,
              vision_pass_rate: null,
              closure_total_pairs: 100,
              closure_automation_pairs: 70,
              closure_manual_pairs: 30,
            },
          ],
          windowDays: 30,
        }),
      }
    })
    vi.stubGlobal('fetch', fetchMock)

    render(
      <MemoryRouter>
        <DataQualityRoute />
      </MemoryRouter>,
    )

    await waitFor(() => {
      expect(screen.getByText('Completeness Gate')).toBeInTheDocument()
    })

    expect(screen.getByText('WARN')).toBeInTheDocument()
    expect(screen.getByText('0.9342')).toBeInTheDocument()
    expect(screen.getByText('1,860 / 2,000 required cells')).toBeInTheDocument()
    expect(screen.getByText('Warn 92.00% · Fail 95.00%')).toBeInTheDocument()
    expect(screen.getAllByText('anime').length).toBeGreaterThan(0)
    expect(screen.getByText('High-priority disputes: 4 / 25')).toBeInTheDocument()
    expect(screen.getByText('None')).toBeInTheDocument()
    expect(screen.getByText('Source-ID Health')).toBeInTheDocument()
    expect(screen.getAllByText('95.00%').length).toBeGreaterThan(0)
    expect(screen.getByText('Spike Spiegel')).toBeInTheDocument()
    expect(screen.getAllByText('5').length).toBeGreaterThanOrEqual(2)
    expect(screen.getByText('Null-Closure Queue')).toBeInTheDocument()
    expect(screen.getByText('1,234')).toBeInTheDocument()
    expect(screen.getByText('Levi')).toBeInTheDocument()
    expect(screen.getByText('automation')).toBeInTheDocument()
    expect(screen.getByText(/Latest materialized queue:/)).toBeInTheDocument()
    expect(screen.getByText(/50 queued/)).toBeInTheDocument()
    expect(screen.getByText('Closure lane mix (share)')).toBeInTheDocument()
    expect(screen.getByText('70.00%')).toBeInTheDocument()
    expect(screen.getByText('+20.0 pp')).toBeInTheDocument()
  })
})

