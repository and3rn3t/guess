import { Fragment, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { AdminPageHeader } from '../AdminPageHeader'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import {
  QuickFilterBar,
  RecentSearchesWidget,
  BatchCategoryModal,
} from '../CharacterManagerEnhancements'
import {
  TrashIcon,
  ArrowLeftIcon,
  ArrowRightIcon,
  CaretDownIcon,
  CaretUpIcon,
} from '@phosphor-icons/react'
import type { CharacterCategory } from '@/lib/types'
import { CATEGORY_LABELS } from '@/lib/types'
import {
  exportAsCSV,
  getNeedsWorkScore,
  timeSinceCreated,
} from '@/lib/admin/characterFilters'
import {
  type AttributeApiValue,
  toNullableBoolean,
  issueCountMessage,
  nextAttrValue,
} from './characters/charactersHelpers'
import { SortIndicator } from './characters/SortIndicator'
import { useCharactersListing } from './characters/useCharactersListing'
import {
  ExpandedAttributesPanel,
  type ExpandedCharacterData,
  type ValidationIssue,
} from './characters/ExpandedAttributesPanel'
import { CharactersToolbar } from './characters/CharactersToolbar'

const SKELETON_ROW_KEYS = [
  'char-skeleton-1',
  'char-skeleton-2',
  'char-skeleton-3',
  'char-skeleton-4',
  'char-skeleton-5',
  'char-skeleton-6',
  'char-skeleton-7',
  'char-skeleton-8',
]

export default function CharactersRoute(): React.JSX.Element {
  const {
    data,
    loading,
    error,
    search,
    category,
    maxCoverage,
    page,
    sort,
    order,
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
  } = useCharactersListing()
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [expandedCharId, setExpandedCharId] = useState<string | null>(null)
  const [expandedData, setExpandedData] = useState<ExpandedCharacterData | null>(null)
  const [expandLoading, setExpandLoading] = useState(false)
  const [reenriching, setReenriching] = useState(false)
  const [batchDeleteConfirm, setBatchDeleteConfirm] = useState(false)
  const [batchCategoryOpen, setBatchCategoryOpen] = useState(false)
  const [isBatchDeleting, setIsBatchDeleting] = useState(false)
  const [isBatchUpdating, setIsBatchUpdating] = useState(false)
  const [validating, setValidating] = useState<string | null>(null)
  const [validationResults, setValidationResults] = useState<Record<string, ValidationIssue[]>>({})

  useEffect(() => {
    setBatchDeleteConfirm(false)
  }, [selectedIds])

  const batchDeleteSelected = async () => {
    if (selectedIds.size === 0) return

    setIsBatchDeleting(true)
    try {
      const results = await Promise.allSettled(
        Array.from(selectedIds).map(async (id) => {
          const res = await fetch(`/api/admin/characters/${encodeURIComponent(id)}`, { method: 'DELETE' })
          if (!res.ok) throw new Error(res.statusText)
        })
      )
      const succeeded = results.filter((r) => r.status === 'fulfilled').length
      const failed = results.length - succeeded

      if (succeeded > 0) {
        const suffix = succeeded === 1 ? '' : 's'
        toast.success(`Deleted ${succeeded} character${suffix}`)
      }
      if (failed > 0) {
        const suffix = failed === 1 ? '' : 's'
        toast.error(`${failed} delete${suffix} failed`)
      }

      clearSelection()
      setBatchDeleteConfirm(false)
      await refetch()
    } catch (e) {
      toast.error(`Batch delete failed: ${e instanceof Error ? e.message : 'Unknown error'}`)
    } finally {
      setIsBatchDeleting(false)
    }
  }

  const batchChangeCategory = async (nextCategory: string) => {
    if (selectedIds.size === 0) return

    setIsBatchUpdating(true)
    try {
      const results = await Promise.allSettled(
        Array.from(selectedIds).map(async (id) => {
          const res = await fetch(`/api/admin/characters/${encodeURIComponent(id)}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ category: nextCategory }),
          })
          if (!res.ok) throw new Error(res.statusText)
        })
      )
      const succeeded = results.filter((r) => r.status === 'fulfilled').length
      const failed = results.length - succeeded

      if (succeeded > 0) {
        const suffix = succeeded === 1 ? '' : 's'
        toast.success(`Updated category for ${succeeded} character${suffix}`)
      }
      if (failed > 0) {
        const suffix = failed === 1 ? '' : 's'
        toast.error(`${failed} category update${suffix} failed`)
      }

      clearSelection()
      setBatchCategoryOpen(false)
      await refetch()
    } catch (e) {
      toast.error(`Batch category update failed: ${e instanceof Error ? e.message : 'Unknown error'}`)
    } finally {
      setIsBatchUpdating(false)
    }
  }

  const batchExport = () => {
    if (selectedIds.size === 0) return
    const selectedCharacters = (data?.characters ?? []).filter((c) => selectedIds.has(c.id))
    exportAsCSV(selectedCharacters, `characters-export-${Date.now()}.csv`)
  }

  const deleteCharacter = async (id: string, name: string) => {
    if (deleteConfirm !== id) { setDeleteConfirm(id); return }
    setDeleting(true)
    try {
      const res = await fetch(`/api/admin/characters/${encodeURIComponent(id)}`, { method: 'DELETE' })
      if (!res.ok) throw new Error(res.statusText)
      toast.success(`${name} deleted`)
      removeCharacterFromList(id)
    } catch (e) {
      toast.error(`Failed to delete ${name}: ${e instanceof Error ? e.message : 'Unknown error'}`)
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
        attributes: Record<string, AttributeApiValue>
        evidence?: Record<string, string | null>
        agreement?: Record<string, { score: number | null; signals: number }>
      }
      setExpandedData({
        definitions: json.definitions,
        attributes: json.attributes,
        evidence: json.evidence ?? {},
        agreement: json.agreement ?? {},
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load attributes')
      setExpandedCharId(null)
    } finally {
      setExpandLoading(false)
    }
  }

  const patchAttr = async (charId: string, attrKey: string, currentVal: AttributeApiValue) => {
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
      toast.success('Queued for re-enrichment')
      clearSelection()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Re-enrich failed')
    } finally {
      setReenriching(false)
    }
  }

  const validateCharacter = async (id: string, name: string) => {
    if (!expandedData) return
    setValidating(id)
    try {
      const attributes: Record<string, boolean | null> = {}
      for (const [k, v] of Object.entries(expandedData.attributes)) {
        attributes[k] = toNullableBoolean(v)
      }
      const res = await fetch(`/api/admin/characters/${encodeURIComponent(id)}/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, attributes }),
      })
      if (!res.ok) throw new Error(res.statusText)
      const json = await res.json() as { issues: ValidationIssue[] }
      setValidationResults((prev) => ({ ...prev, [id]: json.issues }))
      toast.success(issueCountMessage(json.issues.length))
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Validation failed')
    } finally {
      setValidating(null)
    }
  }

  return (
    <div className="container mx-auto px-4 pb-8 max-w-5xl space-y-6">
      <AdminPageHeader
        title="Character Manager"
        subtitle={data ? `${data.total} characters` : undefined}
        sectionColor="blue"
        actions={
          <CharactersToolbar
            search={search}
            category={category}
            maxCoverage={maxCoverage}
            selectedCount={selectedIds.size}
            reenriching={reenriching}
            onSearchChange={setSearch}
            onCategoryChange={setCategory}
            onMaxCoverageChange={setMaxCoverage}
            onReenrichSelected={() => void reenrichSelected()}
          />
        }
      />

      {error && (
        <div className="rounded-lg bg-destructive/10 border border-destructive/30 px-4 py-3 text-sm text-destructive">{error}</div>
      )}

      <QuickFilterBar
        onApplyFilter={applyQuickFilter}
        selectedCount={selectedIds.size}
        onBatchDelete={() => {
          if (batchDeleteConfirm) {
            void batchDeleteSelected()
            return
          }
          setBatchDeleteConfirm(true)
        }}
        onBatchChangeCategory={() => setBatchCategoryOpen(true)}
        onBatchExport={batchExport}
        isDeletingBatch={isBatchDeleting}
      />

      {batchDeleteConfirm && selectedIds.size > 0 && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          Click Delete again to confirm removing {selectedIds.size} selected character{selectedIds.size === 1 ? '' : 's'}.
        </div>
      )}

      <RecentSearchesWidget onApplySearch={applyRecentSearch} />

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
                  Name <SortIndicator col="name" activeSort={sort} order={order} />
                </button>
              </th>
              <th className="text-center px-4 py-3 font-medium text-muted-foreground w-28">
                <button onClick={() => toggleSort('recentlyAdded')} className="hover:text-foreground">
                  Added <SortIndicator col="recentlyAdded" activeSort={sort} order={order} />
                </button>
              </th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground w-32">Category</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground w-24">Source</th>
              <th className="text-center px-4 py-3 font-medium text-muted-foreground w-32">
                <button onClick={() => toggleSort('coverage')} className="hover:text-foreground">
                  Coverage <SortIndicator col="coverage" activeSort={sort} order={order} />
                </button>
              </th>
              <th className="text-center px-4 py-3 font-medium text-muted-foreground w-24">
                <button onClick={() => toggleSort('popularity')} className="hover:text-foreground">
                  Pop. <SortIndicator col="popularity" activeSort={sort} order={order} />
                </button>
              </th>
              <th className="text-center px-4 py-3 font-medium text-muted-foreground w-28">
                <button onClick={() => toggleSort('needsWork')} className="hover:text-foreground">
                  Needs Work <SortIndicator col="needsWork" activeSort={sort} order={order} />
                </button>
              </th>
              <th className="text-center px-4 py-3 font-medium text-muted-foreground w-24">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {loading && !data
              ? SKELETON_ROW_KEYS.map((rowKey) => (
                  <tr key={rowKey}><td colSpan={9} className="px-4 py-3"><div className="h-4 bg-muted animate-pulse rounded" /></td></tr>
                ))
              : (data?.characters ?? []).map((c) => (
                  <Fragment key={c.id}>
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
                      <td className="px-4 py-3 text-center text-xs text-muted-foreground">
                        {timeSinceCreated(c.createdAt)}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">{CATEGORY_LABELS[c.category as CharacterCategory] ?? c.category}</td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">{c.source}</td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center gap-2">
                          <Progress value={c.coveragePct} className="h-1.5" />
                          <span className="text-xs text-muted-foreground w-10 text-right">{c.coveragePct}%</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center text-xs text-muted-foreground">{c.popularity.toFixed(2)}</td>
                      <td className="px-4 py-3 text-center text-xs text-muted-foreground">
                        {getNeedsWorkScore(c).toFixed(1)}
                      </td>
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
                        <td colSpan={9} className="px-4 py-4 bg-muted/20 border-b border-border">
                          <ExpandedAttributesPanel
                            characterId={c.id}
                            expandedData={expandedData}
                            expandLoading={expandLoading}
                            validating={validating}
                            validationIssues={validationResults[c.id]}
                            onValidate={() => void validateCharacter(c.id, c.name)}
                            onPatchAttr={(attrKey, currentVal) => void patchAttr(c.id, attrKey, currentVal)}
                          />
                        </td>
                      </tr>
                    )}
                  </Fragment>
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

      <BatchCategoryModal
        selectedCount={selectedIds.size}
        open={batchCategoryOpen}
        onClose={() => setBatchCategoryOpen(false)}
        onApply={(nextCategory) => void batchChangeCategory(nextCategory)}
        isLoading={isBatchUpdating}
      />
    </div>
  )
}
