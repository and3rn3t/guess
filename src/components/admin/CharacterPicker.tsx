import { useState } from 'react'
import type { Character } from '@/lib/types'
import { useAdminData } from './AdminDataContext'
import { fetchAdminCharacterById } from '@/lib/adminApi'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

interface CharacterPickerProps {
  onSelect: (character: Character) => void
}

export function CharacterPicker({ onSelect }: CharacterPickerProps): React.JSX.Element {
  const { characters, loading } = useAdminData()
  const [query, setQuery] = useState('')
  const [loadingId, setLoadingId] = useState<string | null>(null)

  const filtered = characters.filter((c) =>
    c.name.toLowerCase().includes(query.toLowerCase())
  )

  const handleSelect = async (c: Character) => {
    setLoadingId(c.id)
    try {
      const full = await fetchAdminCharacterById(c.id)
      onSelect(full ?? c)
    } finally {
      setLoadingId(null)
    }
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-lg">
      <h2 className="text-lg font-semibold mb-4">Select a character</h2>
      <Input
        placeholder="Search characters…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="mb-4"
        disabled={loading}
      />
      {loading ? (
        <p className="text-muted-foreground text-sm">Loading characters…</p>
      ) : (
        <ul className="space-y-1 max-h-[60vh] overflow-y-auto">
          {(query.trim() ? filtered : filtered.slice(0, 100)).map((c) => (
            <li key={c.id}>
              <Button
                variant="ghost"
                className="w-full justify-start text-sm"
                onClick={() => { void handleSelect(c) }}
                disabled={loadingId === c.id}
              >
                {loadingId === c.id ? 'Loading…' : c.name}
                <span className="ml-2 text-xs text-muted-foreground">{c.category}</span>
              </Button>
            </li>
          ))}
          {filtered.length === 0 && (
            <p className="text-muted-foreground text-sm px-2">No characters found.</p>
          )}
        </ul>
      )}
    </div>
  )
}
