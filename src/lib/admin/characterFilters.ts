/**
 * Character Manager Filters & Helpers
 * Provides quick filters, search presets, and bulk operations
 */

// AdminCharacter is defined in CharactersRoute, so we define it here for type sharing
export interface AdminCharacter {
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

export interface QuickFilterPreset {
  id: string
  label: string
  search?: string
  category?: string
  maxCoverage?: string
  sort?: 'popularity' | 'name' | 'coverage' | 'createdAt' | 'needsWork' | 'recentlyAdded'
  order?: 'asc' | 'desc'
}

export const QUICK_FILTER_PRESETS: QuickFilterPreset[] = [
  { id: 'incomplete', label: 'Incomplete (<30%)', maxCoverage: '30', sort: 'coverage', order: 'asc' },
  { id: 'recent', label: 'Recently Added', sort: 'recentlyAdded', order: 'desc' },
  { id: 'low', label: 'Low Coverage (<20%)', maxCoverage: '20', sort: 'coverage', order: 'asc' },
  { id: 'popular', label: 'Popular', maxCoverage: '', sort: 'popularity', order: 'desc' },
  { id: 'needswork', label: 'Needs Work', sort: 'needsWork', order: 'asc' },
]

export interface RecentSearch {
  query: string
  timestamp: number
}

/**
 * Load recent searches from localStorage
 */
export function loadRecentSearches(): RecentSearch[] {
  try {
    const stored = localStorage.getItem('admin:recent-searches')
    return stored ? JSON.parse(stored) : []
  } catch {
    return []
  }
}

/**
 * Save recent searches to localStorage (max 5)
 */
export function saveRecentSearches(searches: RecentSearch[]): void {
  try {
    localStorage.setItem('admin:recent-searches', JSON.stringify(searches.slice(0, 5)))
  } catch (e) {
    console.error('Failed to save recent searches:', e)
  }
}

/**
 * Add a search to recent searches
 */
export function addRecentSearch(query: string): RecentSearch[] {
  const searches = loadRecentSearches().filter((s) => s.query !== query)
  const newSearches = [{ query, timestamp: Date.now() }, ...searches]
  saveRecentSearches(newSearches)
  return newSearches
}

/**
 * Export characters as CSV
 */
export function exportAsCSV(characters: AdminCharacter[], filename = 'characters.csv'): void {
  const headers = ['ID', 'Name', 'Category', 'Coverage %', 'Popularity', 'Source', 'Attributes']
  const rows = characters.map((c) => [
    c.id,
    c.name,
    c.category,
    c.coveragePct,
    (c.popularity * 100).toFixed(1),
    c.source,
    `${c.attributeCount}/${c.totalAttributes}`,
  ])
  const csv = [headers, ...rows]
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    .join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

/**
 * Export characters as JSON
 */
export function exportAsJSON(characters: AdminCharacter[], filename = 'characters.json'): void {
  const data = JSON.stringify(characters, null, 2)
  const blob = new Blob([data], { type: 'application/json;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

/**
 * Calculate time elapsed since creation
 */
export function timeSinceCreated(createdAt: number): string {
  const now = Date.now()
  const diffMs = now - createdAt
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7) return `${diffDays}d ago`
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`
  return `${Math.floor(diffDays / 30)}mo ago`
}

/**
 * Filter characters by "Needs Work" criteria
 * (high popularity but low coverage)
 */
export function getNeedsWorkScore(character: AdminCharacter): number {
  // High popularity characters with low coverage are priority
  const popularityWeight = character.popularity
  const coverageGap = 100 - character.coveragePct
  return (popularityWeight * 0.6 + (coverageGap * 0.4))
}
