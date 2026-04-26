import { createContext, useContext } from 'react'
import { DEFAULT_CHARACTERS, DEFAULT_QUESTIONS } from '@/lib/database'
import type { Character, Question } from '@/lib/types'

interface AdminDataContextValue {
  characters: Character[]
  questions: Question[]
  loading: boolean
  refresh: () => void
  characterLimit: number
  setCharacterLimit: (limit: number) => void
}

export const AdminDataContext = createContext<AdminDataContextValue>({
  characters: DEFAULT_CHARACTERS,
  questions: DEFAULT_QUESTIONS,
  loading: false,
  refresh: () => {},
  characterLimit: 200,
  setCharacterLimit: () => {},
})

export function useAdminData(): AdminDataContextValue {
  return useContext(AdminDataContext)
}
