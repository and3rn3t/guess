import { useCallback, useEffect, useState } from 'react'
import {
  addRecentSearch,
  type QuickFilterPreset,
} from '@/lib/admin/characterFilters'
import { httpClient } from '@/lib/http'
import type { paths } from '@/lib/api.generated'
import type { SortKey } from './charactersHelpers'

export type PageData =
  paths['/api/admin/characters']['get']['responses']['200']['content']['application/json']

export type AdminCharacter = PageData['characters'][number]

export interface UseCharactersListingResult {
  // Data
  data: PageData | null
  loading: boolean
  error: string | null
  // Query state
  search: string
  category: string
  maxCoverage: string
  page: number
  sort: SortKey
  order: 'asc' | 'desc'
  pageSize: number
  totalPages: number
  // Selection state (list-bound)
  selectedIds: Set<string>
  // Query setters
  setSearch: (value: string) => void
  setCategory: (value: string) => void
  setMaxCoverage: (value: string) => void
  setPage: React.Dispatch<React.SetStateAction<number>>
  // Actions
  toggleSort: (col: SortKey) => void
  applyQuickFilter: (preset: QuickFilterPreset) => void
  applyRecentSearch: (query: string) => void
  toggleSelect: (id: string) => void
  toggleSelectAll: () => void
  clearSelection: () => void
  refetch: () => Promise<void>
  removeCharacterFromList: (id: string) => void
  setError: (error: string | null) => void
}

const PAGE_SIZE = 50

/**
 * Bundles the character-listing query state, paging, sort, debounced
 * filter refetch, and list-bound selection for CharactersRoute.
 *
 * Side-effect contracts:
 *  - search / category / maxCoverage changes trigger a 300 ms debounced
 *    refetch and reset `page` to 1.
 *  - Every successful refetch clears the current selection.
 *  - `applyRecentSearch` also writes the query to the recent-searches store.
 */
export function useCharactersListing(): UseCharactersListingResult {
  const [data, setData] = useState<PageData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('')
  const [maxCoverage, setMaxCoverage] = useState<string>('')
  const [page, setPage] = useState(1)
  const [sort, setSort] = useState<SortKey>('popularity')
  const [order, setOrder] = useState<'asc' | 'desc'>('desc')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  const refetch = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({
        search,
        category,
        page: String(page),
        pageSize: String(PAGE_SIZE),
        sort,
        order,
      })
      if (maxCoverage !== '') params.set('maxCoverage', maxCoverage)
      const json = await httpClient.getJson<PageData>(`/api/admin/characters?${params}`)
      setData(json)
      setSelectedIds(new Set())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [search, category, maxCoverage, page, sort, order])

  // Debounced refetch on filter changes (search/category/maxCoverage).
  // Resets page to 1 first so the new params hit page 1.
  useEffect(() => {
    const timer = setTimeout(() => { setPage(1); void refetch() }, 300)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- omitting `refetch` prevents double-fetch: the effect below reacts to refetch identity changes after deps settle
  }, [search, category, maxCoverage])

  // Immediate refetch when the refetch identity changes (page/sort/order).
  useEffect(() => { void refetch() }, [refetch])

  const toggleSort = useCallback((col: SortKey) => {
    if (sort === col) {
      setOrder((o) => (o === 'desc' ? 'asc' : 'desc'))
    } else {
      setSort(col)
      setOrder(col === 'needsWork' ? 'asc' : 'desc')
    }
    setPage(1)
  }, [sort])

  const applyQuickFilter = useCallback((preset: QuickFilterPreset) => {
    if (preset.search !== undefined) {
      setSearch(preset.search)
    }
    if (preset.category !== undefined) {
      setCategory(preset.category)
    }
    if (preset.maxCoverage !== undefined) {
      setMaxCoverage(preset.maxCoverage)
    }
    if (preset.sort) {
      setSort(preset.sort)
      setOrder(preset.order ?? 'desc')
    }
    setPage(1)
  }, [])

  const applyRecentSearch = useCallback((query: string) => {
    setSearch(query)
    addRecentSearch(query)
    setPage(1)
  }, [])

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const toggleSelectAll = useCallback(() => {
    setSelectedIds((prev) => {
      const allIds = (data?.characters ?? []).map((c) => c.id)
      return prev.size === allIds.length ? new Set() : new Set(allIds)
    })
  }, [data])

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set())
  }, [])

  const removeCharacterFromList = useCallback((id: string) => {
    setData((prev) => prev
      ? { ...prev, characters: prev.characters.filter((c) => c.id !== id), total: prev.total - 1 }
      : prev)
  }, [])

  const totalPages = data ? Math.ceil(data.total / PAGE_SIZE) : 1

  return {
    data,
    loading,
    error,
    search,
    category,
    maxCoverage,
    page,
    sort,
    order,
    pageSize: PAGE_SIZE,
    totalPages,
    selectedIds,
    setSearch,
    setCategory,
    setMaxCoverage,
    setPage,
    toggleSort,
    applyQuickFilter,
    applyRecentSearch,
    toggleSelect,
    toggleSelectAll,
    clearSelection,
    refetch,
    removeCharacterFromList,
    setError,
  }
}
