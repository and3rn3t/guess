import React, { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  MagnifyingGlassIcon,
  TrashIcon,
  ArrowLeftIcon,
  ArrowRightIcon,
  ArrowUpIcon,
  ArrowDownIcon,
  CaretDownIcon,
  CaretUpIcon,
  ArrowsClockwiseIcon,
  SparkleIcon,
  WarningIcon,
} from '@phosphor-icons/react'
import type { CharacterCategory } from '@/lib/types'
import { CATEGORY_LABELS } from '@/lib/types'

interface AdminCharacter {
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

interface ValidationIssue {
  attributeKey: string
  type: 'contradiction' | 'suspicious-null' | 'recommended-fill'
  currentValue: boolean | null
  suggestedValue: boolean | null
  reason: string
}

interface PageData {
  characters: AdminCharacter[]
  total: number
  page: number
  pageSize: number
}

type SortKey = 'popularity' | 'name' | 'coverage' | 'createdAt'

const CATEGORIES = Object.keys(CATEGORY_LABELS) as CharacterCategory[]

export default function CharactersRoute(): React.JSX.Element {
  const [data, setData] = useState<PageData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('')
  const [maxCoverage, setMaxCoverage] = useState<string>('')
  const [page, setPage] = useState(1)
  const [sort, setSort] = useState<SortKey>('popularity')
  const [order, setOrder] = useState<'asc' | 'desc'>('desc')
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [expandedCharId, setExpandedCharId] = useState<string | null>(null)
  const [expandedData, setExpandedData] = useState<{
    definitions: Array<{ key: string; displayText: string }>
    attributes: Record<string, 0 | 1 | null>
  } | null>(null)
  const [expandLoading, setExpandLoading] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [reenriching, setReenriching] = useState(false)
  const [validating, setValidating] = useState<string | null>(null)
  const [validationResults, setValidationResults] = useState<Record<string, ValidationIssue[]>>({})
  const pageSize = 50

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({
        search,
        category,
        page: String(page),
        pageSize: String(pageSize),
        sort,
        order,
      })
      if (maxCoverage !== '') params.set('maxCoverage', maxCoverage)
      const res = await fetch(`/api/admin/characters?${params}`)
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
      setData(await res.json())
      setSelectedIds(new Set())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [search, category, maxCoverage, page, pageSize, sort, order])

  useEffect(() => {
    const timer = setTimeout(() => { setPage(1); void fetchData() }, 300)
    return () => clearTimeout(timer)
  }, [search, category, maxCoverage]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { void fetchData() }, [fetchData])

  const toggleSort = (col: SortKey) => {
    if (sort === col) {
      setOrder((o) => (o === 'desc' ? 'asc' : 'desc'))
    } else {
      setSort(col)
      setOrder('desc')
    }
    setPage(1)
  }

  const deleteCharacter = async (id: string, name: string) => {
    if (deleteConfirm !== id) { setDeleteConfirm(id); return }
    setDeleting(true)
    try {
      const res = await fetch(`/api/admin/characters/${encodeURIComponent(id)}`, { method: 'DELETE' })
      if (!res.ok) throw new Error(res.statusText)
      setData((prev) => prev ? { ...prev, characters: prev.characters.filter((c) => c.id !== id), total: prev.total - 1 } : prev)
    } catch (e) {
      setError(`Failed to delete ${name}: ${e instanceof Error ? e.message : 'Unknown error'}`)
    } finally {
      setDeleting(false)
      setDeleteConfirm(null)
    }
  }

  const toggleExpand = async (id: string) => {
    if (expandedCharId === id) {
      setExpandedCharId(null)
      setExpandedData(null)
      return
    }
    setExpandedCharId(id)
    setExpandedData(null)
    setExpandLoading(true)
    try {
      const res = await fetch(`/api/admin/characters/${encodeURIComponent(id)}`)
      if (!res.ok) throw new Error(res.statusText)
      const json = await res.json() as {
        definitions: Array<{ key: string; displayText: string }>
        attributes: Record<string, 0 | 1 | null>
      }
      setExpandedData(json)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load attributes')
      setExpandedCharId(null)
    } finally {
      setExpandLoading(false)
    }
  }

  const nextAttrValue = (v: 0 | 1 | null): 0 | 1 | null => {
    if (v === null) return 1
    if (v === 1) return 0
    return null
  }

  const patchAttr = async (charId: string, attrKey: string, currentVal: 0 | 1 | null) => {
    const newVal = nextAttrValue(currentVal)
    setExpandedData((prev) => prev ? { ...prev, attributes: { ...prev.attributes, [attrKey]: newVal } } : prev)
    try {
      const res = await fetch(`/api/admin/characters/${encodeURIComponent(charId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ attributeKey: attrKey, value: newVal }),
      })
      if (!res.ok) throw new Error(res.statusText)
    } catch (e) {
      setExpandedData((prev) => prev ? { ...prev, attributes: { ...prev.attributes, [attrKey]: currentVal } } : prev)
      setError(e instanceof Error ? e.message : 'Attribute update failed')
    }
  }

  const reenrichSelected = async () => {
    if (selectedIds.size === 0) return
    setReenriching(true)
    try {
      const res = await fetch('/api/admin/enrichment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ characterIds: Array.from(selectedIds) }),
      })
      if (!res.ok) throw new Error(res.statusText)
      setSelectedIds(new Set())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Re-enrich failed')
    } finally {
      setReenriching(false)
    }
  }

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const validateCharacter = async (id: string, name: string) => {
    if (!expandedData) return
    setValidating(id)
    try {
      const attributes: Record<string, boolean | null> = {}
      for (const [k, v] of Object.entries(expandedData.attributes)) {
        attributes[k] = v === 1 ? true : v === 0 ? false : null
      }
      const res = await fetch(`/api/admin/characters/${encodeURIComponent(id)}/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, attributes }),
      })
      if (!res.ok) throw new Error(res.statusText)
      const json = await res.json() as { issues: ValidationIssue[] }
      setValidationResults((prev) => ({ ...prev, [id]: json.issues }))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Validation failed')
    } finally {
      setValidating(null)
    }
  }

  const toggleSelectAll = () => {
    const allIds = (data?.characters ?? []).map((c) => c.id)
    setSelectedIds((prev) => prev.size === allIds.length ? new Set() : new Set(allIds))
  }

  const totalPages = data ? Math.ceil(data.total / pageSize) : 1

  const SortIcon = ({ col }: { col: SortKey }) => {
    if (sort !== col) return null
    return order === 'desc' ? <ArrowDownIcon size={12} className="inline ml-1" /> : <ArrowUpIcon size={12} className="inline ml-1" />
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Character Manager</h1>
          {data && <p className="text-sm text-muted-foreground mt-1">{data.total} characters</p>}
        </div>
        <div className="flex gap-2 flex-wrap">
          {selectedIds.size > 0 && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => void reenrichSelected()}
              disabled={reenriching}
              className="text-violet-400 border-violet-500/40 hover:bg-violet-500/10"
            >
              <ArrowsClockwiseIcon size={14} className="mr-1.5" />
              Re-enrich {selectedIds.size} selected
            </Button>
          )}
          <div className="relative">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
            <Input placeholder="Search characters…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 w-56" />
          </div>
          <Input
            type="number"
            placeholder="Max coverage %"
            value={maxCoverage}
            onChange={(e) => { setMaxCoverage(e.target.value); setPage(1) }}
            className="w-36"
            min={0}
            max={100}
          />
          <select
            value={category}
            onChange={(e) => { setCategory(e.target.value); setPage(1) }}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="">All categories</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>
            ))}
          </select>
        </div>
      </div>

      {error && (
        <div className="rounded-lg bg-destructive/10 border border-destructive/30 px-4 py-3 text-sm text-destructive">{error}</div>
      )}

      <div className="rounded-xl border bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="px-4 py-3 w-8">
                <input
                  type="checkbox"
                  checked={(data?.characters ?? []).length > 0 && selectedIds.size === (data?.characters ?? []).length}
                  onChange={toggleSelectAll}
                  className="cursor-pointer"
                  aria-label="Select all"
                />
              </th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                <button onClick={() => toggleSort('name')} className="hover:text-foreground">
                  Name <SortIcon col="name" />
                </button>
              </th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground w-32">Category</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground w-24">Source</th>
              <th className="text-center px-4 py-3 font-medium text-muted-foreground w-32">
                <button onClick={() => toggleSort('coverage')} className="hover:text-foreground">
                  Coverage <SortIcon col="coverage" />
                </button>
              </th>
              <th className="text-center px-4 py-3 font-medium text-muted-foreground w-24">
                <button onClick={() => toggleSort('popularity')} className="hover:text-foreground">
                  Pop. <SortIcon col="popularity" />
                </button>
              </th>
              <th className="text-center px-4 py-3 font-medium text-muted-foreground w-24">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {loading && !data
              ? Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i}><td colSpan={7} className="px-4 py-3"><div className="h-4 bg-muted animate-pulse rounded" /></td></tr>
                ))
              : (data?.characters ?? []).map((c) => (
                  <React.Fragment key={c.id}>
                    <tr className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(c.id)}
                          onChange={() => toggleSelect(c.id)}
                          className="cursor-pointer"
                          aria-label={`Select ${c.name}`}
                        />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {c.imageUrl && (
                            <img src={c.imageUrl} alt="" className="w-7 h-7 rounded-full object-cover" loading="lazy" />
                          )}
                          <span className="font-medium">{c.name}</span>
                          {c.isCustom && <Badge variant="outline" className="text-xs">custom</Badge>}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">{CATEGORY_LABELS[c.category as CharacterCategory] ?? c.category}</td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">{c.source}</td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                            <div className="h-full bg-violet-500 rounded-full" style={{ width: `${c.coveragePct}%` }} />
                          </div>
                          <span className="text-xs text-muted-foreground w-10 text-right">{c.coveragePct}%</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center text-xs text-muted-foreground">{c.popularity.toFixed(2)}</td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            className={`h-7 w-7 ${deleteConfirm === c.id ? 'text-destructive' : 'text-muted-foreground'}`}
                            onClick={() => void deleteCharacter(c.id, c.name)}
                            disabled={deleting}
                            title={deleteConfirm === c.id ? 'Click again to confirm delete' : 'Delete character'}
                          >
                            <TrashIcon size={14} />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 text-muted-foreground"
                            onClick={() => void toggleExpand(c.id)}
                            title={expandedCharId === c.id ? 'Collapse attributes' : 'Edit attributes'}
                          >
                            {expandedCharId === c.id ? <CaretUpIcon size={14} /> : <CaretDownIcon size={14} />}
                          </Button>
                        </div>
                      </td>
                    </tr>
                    {expandedCharId === c.id && (
                      <tr>
                        <td colSpan={7} className="px-4 py-4 bg-muted/20 border-b border-border">
                          {expandLoading ? (
                            <p className="text-sm text-muted-foreground">Loading attributes…</p>
                          ) : expandedData ? (
                            <div className="space-y-3">
                              <div className="flex items-center justify-between">
                                <span className="text-xs text-muted-foreground">
                                  Click an attribute to cycle: null → true → false → null
                                </span>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => void validateCharacter(c.id, c.name)}
                                  disabled={validating === c.id}
                                  className="h-7 text-xs text-violet-400 border-violet-500/40 hover:bg-violet-500/10"
                                >
                                  <SparkleIcon size={12} className={`mr-1.5 ${validating === c.id ? 'animate-pulse' : ''}`} />
                                  {validating === c.id ? 'Validating…' : 'Validate with AI'}
                                </Button>
                              </div>
                              <div className="flex flex-wrap gap-1.5">
                                {expandedData.definitions.map((def) => {
                                  const val = expandedData.attributes[def.key] ?? null
                                  return (
                                    <button
                                      key={def.key}
                                      onClick={() => void patchAttr(c.id, def.key, val)}
                                      title={`${def.displayText}: ${val === 1 ? 'true' : val === 0 ? 'false' : 'unknown'} — click to cycle`}
                                      className={`px-2 py-1 rounded text-xs font-mono border transition-colors ${
                                        val === 1
                                          ? 'bg-green-500/20 text-green-400 border-green-500/30 hover:bg-green-500/30'
                                          : val === 0
                                          ? 'bg-red-500/20 text-red-400 border-red-500/30 hover:bg-red-500/30'
                                          : 'bg-muted text-muted-foreground border-border hover:text-foreground'
                                      }`}
                                    >
                                      {def.key}
                                    </button>
                                  )
                                })}
                              </div>
                              {validationResults[c.id] !== undefined && (
                                <div className="space-y-1.5 pt-1 border-t border-border">
                                  {validationResults[c.id].length === 0 ? (
                                    <p className="text-xs text-green-400">No issues found — attributes look clean!</p>
                                  ) : (
                                    validationResults[c.id].map((issue, idx) => (
                                      <div
                                        key={idx}
                                        className={`flex items-start gap-2 text-xs px-2 py-1.5 rounded border ${
                                          issue.type === 'contradiction'
                                            ? 'bg-red-500/10 border-red-500/30 text-red-400'
                                            : issue.type === 'recommended-fill'
                                            ? 'bg-violet-500/10 border-violet-500/30 text-violet-400'
                                            : 'bg-yellow-500/10 border-yellow-500/30 text-yellow-400'
                                        }`}
                                      >
                                        <WarningIcon size={12} className="mt-0.5 shrink-0" />
                                        <span>
                                          <code className="font-mono">{issue.attributeKey}</code>: {issue.reason}
                                          {issue.suggestedValue !== null && (
                                            <button
                                              onClick={() => void patchAttr(
                                                c.id,
                                                issue.attributeKey,
                                                expandedData.attributes[issue.attributeKey] ?? null
                                              )}
                                              className="ml-2 underline opacity-80 hover:opacity-100"
                                            >
                                              Set {String(issue.suggestedValue)}
                                            </button>
                                          )}
                                        </span>
                                      </div>
                                    ))
                                  )}
                                </div>
                              )}
                            </div>
                          ) : null}
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))
            }
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">Page {page} of {totalPages}</p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setPage((p) => p - 1)} disabled={page <= 1 || loading}>
              <ArrowLeftIcon size={14} className="mr-1" /> Prev
            </Button>
            <Button variant="outline" size="sm" onClick={() => setPage((p) => p + 1)} disabled={page >= totalPages || loading}>
              Next <ArrowRightIcon size={14} className="ml-1" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
