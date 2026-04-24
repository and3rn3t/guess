import { useEffect, useState } from 'react'
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
  const [page, setPage] = useState(1)
  const [sort, setSort] = useState<SortKey>('popularity')
  const [order, setOrder] = useState<'asc' | 'desc'>('desc')
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const pageSize = 50

  const fetchData = async () => {
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
      const res = await fetch(`/api/admin/characters?${params}`)
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
      setData(await res.json())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const timer = setTimeout(() => { setPage(1); void fetchData() }, 300)
    return () => clearTimeout(timer)
  }, [search, category])

  useEffect(() => { void fetchData() }, [page, sort, order, search, category]) // eslint-disable-line react-hooks/exhaustive-deps

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
      alert(`Failed to delete ${name}: ${e instanceof Error ? e.message : 'Unknown error'}`)
    } finally {
      setDeleting(false)
      setDeleteConfirm(null)
    }
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
          <div className="relative">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
            <Input placeholder="Search characters…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 w-56" />
          </div>
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
              <th className="text-center px-4 py-3 font-medium text-muted-foreground w-20">Delete</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {loading && !data
              ? Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i}><td colSpan={6} className="px-4 py-3"><div className="h-4 bg-muted animate-pulse rounded" /></td></tr>
                ))
              : (data?.characters ?? []).map((c) => (
                  <tr key={c.id} className="hover:bg-muted/30 transition-colors">
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
                    </td>
                  </tr>
                ))}
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
