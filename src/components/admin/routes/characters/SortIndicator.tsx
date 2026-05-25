import { ArrowDownIcon, ArrowUpIcon } from '@phosphor-icons/react'
import type { SortKey } from './charactersHelpers'

export function SortIndicator({
  col,
  activeSort,
  order,
}: Readonly<{
  col: SortKey
  activeSort: SortKey
  order: 'asc' | 'desc'
}>): React.JSX.Element | null {
  if (activeSort !== col) return null
  return order === 'desc'
    ? <ArrowDownIcon size={12} className="inline ml-1" />
    : <ArrowUpIcon size={12} className="inline ml-1" />
}
