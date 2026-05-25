import { ArrowsClockwiseIcon, MagnifyingGlassIcon } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { addRecentSearch } from '@/lib/admin/characterFilters'
import type { CharacterCategory } from '@/lib/types'
import { CATEGORY_LABELS } from '@/lib/types'

const CATEGORIES = Object.keys(CATEGORY_LABELS) as CharacterCategory[]

interface CharactersToolbarProps {
  search: string
  category: string
  maxCoverage: string
  selectedCount: number
  reenriching: boolean
  onSearchChange: (value: string) => void
  onCategoryChange: (value: string) => void
  onMaxCoverageChange: (value: string) => void
  onReenrichSelected: () => void
}

export function CharactersToolbar({
  search,
  category,
  maxCoverage,
  selectedCount,
  reenriching,
  onSearchChange,
  onCategoryChange,
  onMaxCoverageChange,
  onReenrichSelected,
}: Readonly<CharactersToolbarProps>): React.JSX.Element {
  return (
    <div className="flex gap-2 flex-wrap">
      {selectedCount > 0 && (
        <Button
          size="sm"
          variant="outline"
          onClick={onReenrichSelected}
          disabled={reenriching}
          className="text-violet-400 border-violet-500/40 hover:bg-violet-500/10"
        >
          <ArrowsClockwiseIcon size={14} className="mr-1.5" />
          Re-enrich {selectedCount} selected
        </Button>
      )}
      <div className="relative">
        <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
        <Input
          placeholder="Search characters..."
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          onBlur={() => {
            if (search.trim().length > 0) {
              addRecentSearch(search.trim())
            }
          }}
          className="pl-9 w-56"
        />
      </div>
      <Input
        type="number"
        placeholder="Max coverage %"
        value={maxCoverage}
        onChange={(e) => onMaxCoverageChange(e.target.value)}
        className="w-36"
        min={0}
        max={100}
      />
      <select
        value={category}
        onChange={(e) => onCategoryChange(e.target.value)}
        aria-label="Filter by category"
        title="Filter by category"
        className="h-9 rounded-md border border-input bg-background px-3 text-sm"
      >
        <option value="">All categories</option>
        {CATEGORIES.map((c) => (
          <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>
        ))}
      </select>
    </div>
  )
}
