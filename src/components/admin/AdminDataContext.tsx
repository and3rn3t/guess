import { createContext, useContext } from 'react'
import { DEFAULT_CHARACTERS, DEFAULT_QUESTIONS } from '@/lib/database'
import type { Character, Question } from '@/lib/types'

interface AdminDataContextValue {
  characters: Character[]
  questions: Question[]
  loading: boolean
  refresh: () => void
}

export const AdminDataContext = createContext<AdminDataContextValue>({
  characters: DEFAULT_CHARACTERS,
  questions: DEFAULT_QUESTIONS,
  loading: false,
  refresh: () => {},
})

export function useAdminData(): AdminDataContextValue {
  return useContext(AdminDataContext)
}
