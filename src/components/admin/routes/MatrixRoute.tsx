import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { ArrowsClockwiseIcon, DnaIcon } from '@phosphor-icons/react'

interface MatrixCharacter {
  id: string
  name: string
  category: string
  popularity: number
}

interface MatrixAttribute {
  key: string
  displayText: string
}

interface MatrixData {
  characters: MatrixCharacter[]
  attributes: MatrixAttribute[]
  values: Record<string, Record<string, number | null>>
}

const CELL_SIZE = 14
const HEADER_HEIGHT = 80
const LABEL_WIDTH = 140

const VALUE_COLORS = {
  1: '#10b981',      // green-500 — true
  0: '#ef4444',      // red-500 — false
  null: '#374151',   // gray-700 — unknown
}

function MatrixCanvas({ data }: { data: MatrixData }): React.JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const { characters, attributes, values } = data
    const W = LABEL_WIDTH + attributes.length * CELL_SIZE
    const H = HEADER_HEIGHT + characters.length * CELL_SIZE

    canvas.width = W
    canvas.height = H

    ctx.clearRect(0, 0, W, H)

    // Background
    ctx.fillStyle = '#111827'
    ctx.fillRect(0, 0, W, H)

    // Draw column headers (attribute names, rotated)
    ctx.save()
    ctx.font = '9px monospace'
    ctx.fillStyle = '#9ca3af'
    for (let j = 0; j < attributes.length; j++) {
      const x = LABEL_WIDTH + j * CELL_SIZE + CELL_SIZE / 2
      ctx.save()
      ctx.translate(x, HEADER_HEIGHT - 4)
      ctx.rotate(-Math.PI / 2)
      const label = attributes[j].displayText ?? attributes[j].key
      ctx.fillText(label.length > 14 ? label.slice(0, 13) + '\u2026' : label, 0, 0)
      ctx.restore()
    }
    ctx.restore()

    // Draw rows
    ctx.font = '9px system-ui, sans-serif'
    for (let i = 0; i < characters.length; i++) {
      const char = characters[i]
      const y = HEADER_HEIGHT + i * CELL_SIZE

      // Row background (alternating)
      ctx.fillStyle = i % 2 === 0 ? '#1f2937' : '#111827'
      ctx.fillRect(0, y, W, CELL_SIZE)

      // Character name label
      ctx.fillStyle = '#d1d5db'
      ctx.fillText(
        char.name.length > 17 ? char.name.slice(0, 16) + '\u2026' : char.name,
        4,
        y + CELL_SIZE - 4
      )

      // Cells
      const charValues = values[char.id] ?? {}
      for (let j = 0; j < attributes.length; j++) {
        const attrKey = attributes[j].key
        const val = attrKey in charValues ? charValues[attrKey] : null
        const color = VALUE_COLORS[val as 0 | 1] ?? VALUE_COLORS.null
        ctx.fillStyle = color
        ctx.fillRect(LABEL_WIDTH + j * CELL_SIZE + 1, y + 1, CELL_SIZE - 2, CELL_SIZE - 2)
      }
    }
  }, [data])

  const W = LABEL_WIDTH + data.attributes.length * CELL_SIZE
  const H = HEADER_HEIGHT + data.characters.length * CELL_SIZE

  return (
    <div className="overflow-auto rounded-xl border">
      <canvas ref={canvasRef} width={W} height={H} style={{ display: 'block' }} />
    </div>
  )
}

export default function MatrixRoute(): React.JSX.Element {
  const [data, setData] = useState<MatrixData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/matrix?chars=40&attrs=50')
      if (!res.ok) throw new Error(`${res.status}`)
      setData(await res.json())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void fetchData() }, [])

  const empty = !loading && (!data?.characters.length || !data?.attributes.length)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">DNA Matrix</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Character × attribute heatmap — green=true, red=false, dark=unknown
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void fetchData()} disabled={loading}>
          <ArrowsClockwiseIcon size={14} className={`mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {error && (
        <div className="rounded-lg bg-destructive/10 border border-destructive/30 px-4 py-3 text-sm text-destructive">{error}</div>
      )}

      {loading && (
        <div className="rounded-xl border bg-card p-8 animate-pulse h-64" />
      )}

      {empty && (
        <div className="rounded-xl border bg-card px-6 py-12 text-center space-y-3">
          <DnaIcon size={40} className="mx-auto text-muted-foreground/40" />
          <p className="text-muted-foreground text-sm">No enriched characters or attributes found.</p>
        </div>
      )}

      {!loading && !empty && data && (
        <>
          <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
            <span>{data.characters.length} characters</span>
            <span>{data.attributes.length} attributes</span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-3 h-3 rounded bg-green-500" /> true
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-3 h-3 rounded bg-red-500" /> false
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-3 h-3 rounded" style={{ background: '#374151' }} /> unknown
            </span>
          </div>
          <MatrixCanvas data={data} />
        </>
      )}
    </div>
  )
}
