import { useEffect, useState } from 'react'

export interface QuestionCoverageRow {
  id: string
  text: string
  attribute_key: string
  priority: number
  total_characters: number
  filled_count: number
  coverage_pct: number
}

/**
 * Lazily fetches `/api/v2/questions?coverage=true` the first time `enabled` is
 * true. Returns the rows + a loading flag. On error, resolves to an empty
 * array so consumers can render an empty state without juggling errors.
 */
export function useQuestionCoverage(enabled: boolean): {
  data: QuestionCoverageRow[] | null
  loading: boolean
} {
  const [data, setData] = useState<QuestionCoverageRow[] | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!enabled || data !== null || loading) return
    setLoading(true)
    fetch('/api/v2/questions?coverage=true')
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((rows) => setData(rows as QuestionCoverageRow[]))
      .catch(() => setData([]))
      .finally(() => setLoading(false))
  }, [enabled, data, loading])

  return { data, loading }
}
