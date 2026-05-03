import { httpClient } from '@/lib/http'
import {
  ALL_KNOWN_ATTRIBUTES,
  type AttributeRecommendation,
} from './attributeRecommender'
import {
  getAvailableAttributesForCategory,
  getCategoryInfo,
  type AttributeCategory,
} from './categoryRecommender'

type FocusArea = 'physical' | 'abilities' | 'personality' | 'origins' | 'relationships'

interface RecommenderResponse {
  recommendations: AttributeRecommendation[]
}

function buildAllAvailableAttributes(existingAttributes: Record<string, boolean | null>): Array<{ key: string; label: string }> {
  const existing = new Set(Object.keys(existingAttributes))
  return Object.entries(ALL_KNOWN_ATTRIBUTES)
    .filter(([key]) => !existing.has(key))
    .map(([key, label]) => ({ key, label }))
}

function filterByFocus(
  available: Array<{ key: string; label: string }>,
  focusArea?: FocusArea,
): Array<{ key: string; label: string }> {
  if (!focusArea) return available

  if (focusArea === 'physical') {
    return available.filter(({ key, label }) =>
      label.toLowerCase().includes('wear') ||
      label.toLowerCase().includes('has ') ||
      (key.includes('has') && (key.includes('Hair') || key.includes('Wings') || key.includes('Tail') || key.includes('Claws')))
    )
  }

  if (focusArea === 'abilities') {
    return available.filter(({ key }) =>
      key.startsWith('can') ||
      key.includes('Powers') ||
      key.includes('shoots') ||
      key.includes('controls') ||
      key.includes('climbs')
    )
  }

  if (focusArea === 'personality') {
    return available.filter(({ key }) =>
      key.includes('Funny') ||
      key.includes('Villain') ||
      key.includes('Hero') ||
      key.includes('Leader')
    )
  }

  if (focusArea === 'origins') {
    return available.filter(({ key, label }) =>
      key.startsWith('from') ||
      key.startsWith('livesIn') ||
      key.includes('Real') ||
      label.includes('From ')
    )
  }

  return available.filter(({ key }) =>
    key.includes('Family') ||
    key.includes('Companion') ||
    key.includes('Sidekick') ||
    key.includes('Pet') ||
    key.includes('Minions')
  )
}

async function requestRecommendations(args: {
  characterName: string
  category?: string
  existingAttributes: Record<string, boolean | null>
  availableAttributes: Array<{ key: string; label: string }>
  maxRecommendations: number
  focusDescription: string
}): Promise<AttributeRecommendation[]> {
  if (args.availableAttributes.length === 0) return []

  const response = await httpClient.postJson<RecommenderResponse>('/api/admin/recommender', args)
  return response.recommendations ?? []
}

export async function generateAttributeRecommendationsWithAI(
  characterName: string,
  existingAttributes: Record<string, boolean | null>,
  category?: string,
): Promise<AttributeRecommendation[]> {
  const recommendations = await requestRecommendations({
    characterName,
    category,
    existingAttributes,
    availableAttributes: buildAllAvailableAttributes(existingAttributes),
    maxRecommendations: 15,
    focusDescription: 'General character traits with high strategic value and strong factual confidence',
  })
  return recommendations
}

export async function generateSmartAttributeSuggestions(
  characterName: string,
  existingAttributes: Record<string, boolean | null>,
  focusArea?: FocusArea,
  category?: string,
): Promise<AttributeRecommendation[]> {
  const all = buildAllAvailableAttributes(existingAttributes)
  const available = filterByFocus(all, focusArea)
  if (available.length === 0) return []

  const focusDescription = focusArea
    ? `Focus on ${focusArea} traits only`
    : 'General character traits'

  return requestRecommendations({
    characterName,
    category,
    existingAttributes,
    availableAttributes: available,
    maxRecommendations: 8,
    focusDescription,
  })
}

export async function generateCategoryRecommendations(
  characterName: string,
  existingAttributes: Record<string, boolean | null>,
  category: AttributeCategory,
  characterCategory?: string,
): Promise<AttributeRecommendation[]> {
  const available = getAvailableAttributesForCategory(category, existingAttributes)
  if (available.length === 0) return []

  const info = getCategoryInfo(category)
  return requestRecommendations({
    characterName,
    category: characterCategory,
    existingAttributes,
    availableAttributes: available,
    maxRecommendations: 10,
    focusDescription: `Focus on ${info.description}`,
  })
}
