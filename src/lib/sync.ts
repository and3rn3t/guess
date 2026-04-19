import { KV_CHARACTERS_CACHE, KV_QUESTIONS_CACHE, KV_USER_ID, SYNC_CACHE_TTL } from './constants'
import type { Character, Question, Difficulty } from './types'

export type SyncStatus = 'synced' | 'pending' | 'error' | 'offline'

// ===== User ID =====

export function getUserId(): string {
  try {
    let id = localStorage.getItem(KV_USER_ID)
    if (!id) {
      id = crypto.randomUUID()
      localStorage.setItem(KV_USER_ID, id)
    }
    return id
  } catch {
    return 'anonymous'
  }
}

function headers(): Record<string, string> {
  return {
    'Content-Type': 'application/json',
  }
}

// ===== Characters =====

export async function fetchGlobalCharacters(): Promise<Character[]> {
  const cached = getCached<Character[]>(KV_CHARACTERS_CACHE)
  if (cached) return cached

  try {
    const res = await fetch('/api/characters', { headers: headers() })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const characters = (await res.json()) as Character[]
    setCache(KV_CHARACTERS_CACHE, characters)
    return characters
  } catch {
    // Offline fallback: use cache even if stale
    return getStaleCache<Character[]>(KV_CHARACTERS_CACHE) || []
  }
}

export async function submitCharacter(
  character: Omit<Character, 'id' | 'createdBy' | 'createdAt'>,
  newQuestions?: Array<{ text: string; attribute: string }>
): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch('/api/v2/characters', {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({
        name: character.name,
        category: character.category,
        attributes: character.attributes,
      }),
    })

    if (!res.ok) {
      const data = (await res.json().catch(() => ({ error: 'Unknown error' }))) as { error?: string }
      return { success: false, error: data.error || `HTTP ${res.status}` }
    }

    // Submit any associated new questions
    if (newQuestions?.length) {
      await submitQuestions(newQuestions)
    }

    // Invalidate cache
    invalidateCache(KV_CHARACTERS_CACHE)
    return { success: true }
  } catch {
    return { success: false, error: 'Network error — character saved locally only' }
  }
}

// ===== Questions =====

export async function fetchGlobalQuestions(): Promise<Question[]> {
  const cached = getCached<Question[]>(KV_QUESTIONS_CACHE)
  if (cached) return cached

  try {
    const res = await fetch('/api/questions', { headers: headers() })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const questions = (await res.json()) as Question[]
    setCache(KV_QUESTIONS_CACHE, questions)
    return questions
  } catch {
    return getStaleCache<Question[]>(KV_QUESTIONS_CACHE) || []
  }
}

export async function submitQuestions(
  questions: Array<{ text: string; attribute: string }>
): Promise<void> {
  for (const q of questions) {
    try {
      await fetch('/api/questions', {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify(q),
      })
    } catch {
      // Fire-and-forget — don't block on individual question failures
    }
  }
}

// ===== Stats =====

export async function recordGameResult(
  characterId: string,
  won: boolean,
  questionsAsked: number,
  difficulty: Difficulty
): Promise<void> {
  try {
    await fetch('/api/stats', {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ characterId, won, questionsAsked, difficulty }),
    })
  } catch {
    // Fire-and-forget
  }
}



// ===== Corrections =====

export async function submitCorrection(
  characterId: string,
  attribute: string,
  currentValue: boolean | null,
  suggestedValue: boolean
): Promise<{ success: boolean; autoApplied?: boolean; error?: string }> {
  try {
    const res = await fetch('/api/corrections', {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ characterId, attribute, currentValue, suggestedValue }),
    })
    if (!res.ok) {
      const data = (await res.json().catch(() => ({ error: 'Unknown error' }))) as { error?: string }
      return { success: false, error: data.error }
    }
    return (await res.json()) as { success: boolean; autoApplied?: boolean }
  } catch {
    return { success: false, error: 'Network error' }
  }
}



// ===== Sync Status =====

let syncStatus: SyncStatus = 'synced'
const listeners = new Set<(status: SyncStatus) => void>()

export function getSyncStatus(): SyncStatus {
  return syncStatus
}

export function onSyncStatusChange(listener: (status: SyncStatus) => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function setSyncStatus(status: SyncStatus): void {
  syncStatus = status
  for (const listener of listeners) {
    listener(status)
  }
}

// ===== Cache Helpers =====

function getCached<T>(key: string): T | null {
  try {
    const tsRaw = localStorage.getItem(`${key}:ts`)
    if (!tsRaw) return null
    const ts = Number.parseInt(tsRaw, 10)
    if (Date.now() - ts > SYNC_CACHE_TTL) return null // stale
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}

function getStaleCache<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}

function setCache(key: string, data: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(data))
    localStorage.setItem(`${key}:ts`, String(Date.now()))
  } catch {
    // Storage full — ignore
  }
}

function invalidateCache(key: string): void {
  localStorage.removeItem(`${key}:ts`)
}

// ===== Initial Sync =====

export async function initialSync(): Promise<void> {
  setSyncStatus('pending')
  try {
    await Promise.all([
      fetchGlobalCharacters(),
      fetchGlobalQuestions(),
    ])
    setSyncStatus('synced')
  } catch {
    setSyncStatus(navigator.onLine ? 'error' : 'offline')
  }
}
