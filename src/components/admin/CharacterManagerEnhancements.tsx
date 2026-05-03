/**
 * Character Manager UI Enhancements
 * Provides quick filters, search presets, and bulk operations UI.
 */

import { Button } from '@/components/ui/button'
import { CATEGORY_LABELS } from '@/lib/types'
import {
  FunnelIcon,
  DownloadIcon,
  PencilIcon,
  TrashIcon,
  ClockIcon,
} from '@phosphor-icons/react'
import {
  QUICK_FILTER_PRESETS,
  loadRecentSearches,
  type QuickFilterPreset,
} from '@/lib/admin/characterFilters'

interface QuickFilterBarProps {
  onApplyFilter: (preset: QuickFilterPreset) => void
  selectedCount: number
  onBatchDelete: () => void
  onBatchChangeCategory: () => void
  onBatchExport: () => void
  isDeletingBatch?: boolean
}

export function QuickFilterBar({
  onApplyFilter,
  selectedCount,
  onBatchDelete,
  onBatchChangeCategory,
  onBatchExport,
  isDeletingBatch,
}: QuickFilterBarProps): React.JSX.Element {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
          <FunnelIcon size={14} /> Quick Filters
        </div>
        <div className="flex flex-wrap gap-2">
          {QUICK_FILTER_PRESETS.map((preset) => (
            <Button
              key={preset.id}
              size="sm"
              variant="outline"
              onClick={() => onApplyFilter(preset)}
              className="h-8 text-xs"
            >
              {preset.label}
            </Button>
          ))}
        </div>
      </div>

      {selectedCount > 0 ? (
        <div className="space-y-2 rounded-lg border border-violet-500/20 bg-violet-500/10 p-3">
          <div className="text-sm font-medium text-violet-400">{selectedCount} selected</div>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={onBatchChangeCategory}
              className="h-8 border-violet-500/40 text-xs text-violet-400 hover:bg-violet-500/10"
            >
              <PencilIcon size={12} className="mr-1.5" /> Change Category
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={onBatchExport}
              className="h-8 border-blue-500/40 text-xs text-blue-400 hover:bg-blue-500/10"
            >
              <DownloadIcon size={12} className="mr-1.5" /> Export
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={onBatchDelete}
              disabled={isDeletingBatch}
              className="h-8 border-red-500/40 text-xs text-red-400 hover:bg-red-500/10"
            >
              <TrashIcon size={12} className="mr-1.5" /> Delete
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  )
}

interface RecentSearchesProps {
  onApplySearch: (query: string) => void
}

export function RecentSearchesWidget({ onApplySearch }: RecentSearchesProps): React.JSX.Element | null {
  const recentSearches = loadRecentSearches()

  if (recentSearches.length === 0) {
    return null
  }

  return (
    <div className="space-y-2 rounded-lg border border-border bg-muted/30 p-3">
      <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
        <ClockIcon size={14} /> Recent Searches
      </div>
      <div className="flex flex-wrap gap-2">
        {recentSearches.slice(0, 3).map((search) => (
          <button
            key={search.timestamp}
            onClick={() => onApplySearch(search.query)}
            className="rounded border border-border bg-background px-2 py-1 text-xs text-foreground transition-colors hover:bg-muted"
          >
            {search.query.length > 20 ? `${search.query.slice(0, 20)}...` : search.query}
          </button>
        ))}
      </div>
    </div>
  )
}

interface BatchCategoryModalProps {
  selectedCount: number
  open: boolean
  onClose: () => void
  onApply: (category: string) => void
  isLoading?: boolean
}

export function BatchCategoryModal({
  selectedCount,
  open,
  onClose,
  onApply,
  isLoading,
}: BatchCategoryModalProps): React.JSX.Element | null {
  if (!open) {
    return null
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="mx-4 w-96 max-w-full space-y-4 rounded-lg border border-border bg-card p-6">
        <div>
          <h2 className="text-lg font-semibold">Change Category</h2>
          <p className="text-sm text-muted-foreground">
            Update category for {selectedCount} character{selectedCount === 1 ? '' : 's'}
          </p>
        </div>
        <div className="space-y-2">
          {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
            <button
              key={key}
              onClick={() => onApply(key)}
              disabled={isLoading}
              className="w-full rounded border border-border bg-background px-3 py-2 text-left text-sm transition-colors hover:bg-muted disabled:opacity-50"
            >
              {label}
            </button>
          ))}
        </div>
        <div className="flex justify-end gap-2">
          <Button size="sm" variant="outline" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
        </div>
      </div>
    </div>
  )
}
