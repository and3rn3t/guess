import { useEffect, useState } from 'react'
import { AdminDataContext } from './AdminDataContext'
import { DEFAULT_CHARACTERS, DEFAULT_QUESTIONS } from '@/lib/database'
import { fetchGlobalCharacters, fetchGlobalQuestions } from '@/lib/sync'
import type { Character, Question } from '@/lib/types'

export function AdminDataProvider({ children }: { children: React.ReactNode }): React.JSX.Element {
  const [characters, setCharacters] = useState<Character[]>(DEFAULT_CHARACTERS)
  const [questions, setQuestions] = useState<Question[]>(DEFAULT_QUESTIONS)
  const [loading, setLoading] = useState(true)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    let cancelled = false
    setLoading(true)

    Promise.all([fetchGlobalCharacters(), fetchGlobalQuestions()])
      .then(([chars, qs]) => {
        if (cancelled) return
        if (chars.length > 0) setCharacters(chars)
        if (qs.length > 0) setQuestions(qs)
      })
      .catch(() => { /* keep defaults on error */ })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => { cancelled = true }
  }, [tick])

  const refresh = () => setTick((t) => t + 1)

  return (
    <AdminDataContext.Provider value={{ characters, questions, loading, refresh }}>
      {children}
    </AdminDataContext.Provider>
  )
}
