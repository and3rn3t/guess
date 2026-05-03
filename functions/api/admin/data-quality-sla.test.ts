import { describe, it, expect } from 'vitest'
import { onRequestGet } from './data-quality-sla'

describe('/api/admin/data-quality-sla', () => {
  it('returns SLA targets for all attributes and categories', async () => {
    const mockContext = {
      request: new Request('https://example.com/api/admin/data-quality-sla'),
      env: {},
      params: {},
    } as unknown as Parameters<typeof onRequestGet>[0]

    const response = await onRequestGet(mockContext)
    const data = await response.json() as { targets: Array<{ attributeKey: string; displayName: string; category: string; target: number }> }

    expect(response.status).toBe(200)
    expect(data.targets).toBeDefined()
    expect(Array.isArray(data.targets)).toBe(true)

    // Verify some known targets exist
    const isHumanTargets = data.targets.filter((t) => t.attributeKey === 'isHuman')
    expect(isHumanTargets.length).toBeGreaterThan(0)
    expect(isHumanTargets.every((t) => t.target === 1)).toBe(true)

    const firstAppearedYearTargets = data.targets.filter((t) => t.attributeKey === 'firstAppearedYear')
    expect(firstAppearedYearTargets.length).toBeGreaterThan(0)
    expect(firstAppearedYearTargets.some((t) => t.target === 0.95)).toBe(true)

    // Verify display names are readable
    expect(isHumanTargets[0].displayName).toBe('Is Human')
    expect(firstAppearedYearTargets[0].displayName).toBe('First Appeared Year')

    // Verify all categories are represented
    const categories = new Set(data.targets.map((t) => t.category))
    expect(categories.has('video-games')).toBe(true)
    expect(categories.has('movies')).toBe(true)
  })

  it('has consistent targets across all attributes', async () => {
    const mockContext = {
      request: new Request('https://example.com/api/admin/data-quality-sla'),
      env: {},
      params: {},
    } as unknown as Parameters<typeof onRequestGet>[0]

    const response = await onRequestGet(mockContext)
    const data = await response.json() as { targets: Array<{ attributeKey: string; category: string; target: number }> }

    // Group by attribute to verify no missing categories
    const byAttribute = new Map<string, Set<string>>()
    for (const target of data.targets) {
      if (!byAttribute.has(target.attributeKey)) {
        byAttribute.set(target.attributeKey, new Set())
      }
      byAttribute.get(target.attributeKey)!.add(target.category)
    }

    // Verify each attribute has targets for all 8 categories
    const expectedCategoryCount = 8
    for (const [attribute, categories] of byAttribute.entries()) {
      expect(
        categories.size,
        `${attribute} should have targets for ${expectedCategoryCount} categories`
      ).toBe(expectedCategoryCount)
    }
  })
})
