import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  MagnifyingGlassIcon,
  PencilSimpleIcon,
  CheckIcon,
  XIcon,
  ToggleLeftIcon,
  ToggleRightIcon,
  ArrowLeftIcon,
  ArrowRightIcon,
} from '@phosphor-icons/react'

interface AdminQuestion {
  key: string
  displayText: string
  questionText: string | null
  isActive: boolean
  usageCount: number
}

interface PageData {
  questions: AdminQuestion[]
  total: number
  page: number
  pageSize: number
}

export default function QuestionsRoute(): React.JSX.Element {
  const [data, setData] = useState<PageData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const pageSize = 50

  const [editingKey, setEditingKey] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  const [saving, setSaving] = useState(false)
  const editRef = useRef<HTMLInputElement>(null)

  const fetchData = async (searchVal: string, pageVal: number) => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({ search: searchVal, page: String(pageVal), pageSize: String(pageSize) })
      const res = await fetch(`/api/admin/questions?${params}`)
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
      setData(await res.json())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const timer = setTimeout(() => { setPage(1); void fetchData(search, 1) }, 300)
    return () => clearTimeout(timer)
  }, [search])

  useEffect(() => { void fetchData(search, page) }, [page]) // eslint-disable-line react-hooks/exhaustive-deps

  const startEdit = (q: AdminQuestion) => {
    setEditingKey(q.key)
    setEditValue(q.questionText ?? '')
    setTimeout(() => editRef.current?.focus(), 50)
  }
  const cancelEdit = () => { setEditingKey(null); setEditValue('') }

  const saveEdit = async (key: string) => {
    setSaving(true)
    try {
      const res = await fetch(`/api/admin/questions/${encodeURIComponent(key)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questionText: editValue }),
      })
      if (!res.ok) {
        const body = await res.json() as { error?: string }
        throw new Error(body.error ?? res.statusText)
      }
      setData((prev) => prev ? { ...prev, questions: prev.questions.map((q) => q.key === key ? { ...q, questionText: editValue } : q) } : prev)
      cancelEdit()
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const toggleActive = async (q: AdminQuestion) => {
    const next = !q.isActive
    setData((prev) => prev ? { ...prev, questions: prev.questions.map((item) => item.key === q.key ? { ...item, isActive: next } : item) } : prev)
    try {
      const res = await fetch(`/api/admin/questions/${encodeURIComponent(q.key)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: next }),
      })
      if (!res.ok) throw new Error(res.statusText)
    } catch {
      setData((prev) => prev ? { ...prev, questions: prev.questions.map((item) => item.key === q.key ? { ...item, isActive: q.isActive } : item) } : prev)
    }
  }

  const totalPages = data ? Math.ceil(data.total / pageSize) : 1

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Question Manager</h1>
          {data && <p className="text-sm text-muted-foreground mt-1">{data.total} attribute definitions</p>}
        </div>
        <div className="relative w-72">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
          <Input placeholder="Search questions…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
      </div>

      {error && (
        <div className="rounded-lg bg-destructive/10 border border-destructive/30 px-4 py-3 text-sm text-destructive">{error}</div>
      )}

      <div className="rounded-xl border bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground w-40">Key</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Question text</th>
              <th className="text-center px-4 py-3 font-medium text-muted-foreground w-20">Uses</th>
              <th className="text-center px-4 py-3 font-medium text-muted-foreground w-20">Active</th>
              <th className="text-center px-4 py-3 font-medium text-muted-foreground w-16">Edit</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {loading && !data
              ? Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i}><td colSpan={5} className="px-4 py-3"><div className="h-4 bg-muted animate-pulse rounded" /></td></tr>
                ))
              : (data?.questions ?? []).map((q) => (
                  <tr key={q.key} className={`hover:bg-muted/30 transition-colors ${!q.isActive ? 'opacity-50' : ''}`}>
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{q.key}</td>
                    <td className="px-4 py-3">
                      {editingKey === q.key ? (
                        <div className="flex items-center gap-2">
                          <Input ref={editRef} value={editValue} onChange={(e) => setEditValue(e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter') void saveEdit(q.key); if (e.key === 'Escape') cancelEdit() }}
                            className="h-7 text-sm" />
                          <Button size="icon" variant="ghost" className="h-7 w-7 text-green-500" onClick={() => void saveEdit(q.key)} disabled={saving}><CheckIcon size={14} /></Button>
                          <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground" onClick={cancelEdit}><XIcon size={14} /></Button>
                        </div>
                      ) : (
                        <span>{q.questionText ?? <span className="text-muted-foreground italic">No question text</span>}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center"><Badge variant="secondary" className="text-xs">{q.usageCount}</Badge></td>
                    <td className="px-4 py-3 text-center">
                      <button onClick={() => void toggleActive(q)} className="text-muted-foreground hover:text-foreground transition-colors" aria-label={q.isActive ? 'Disable' : 'Enable'}>
                        {q.isActive ? <ToggleRightIcon size={24} className="text-green-500" /> : <ToggleLeftIcon size={24} />}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => startEdit(q)}><PencilSimpleIcon size={14} /></Button>
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
