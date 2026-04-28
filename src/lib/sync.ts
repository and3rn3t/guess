import { KV_CHARACTERS_CACHE, KV_QUESTIONS_CACHE, SYNC_CACHE_TTL } from './constants'
import { httpClient } from './http'
import type { Character, Question, Difficulty } from './types'

export type SyncStatus = 'synced' | 'pending' | 'error' | 'offline'

// ===== Characters =====

export async function fetchGlobalCharacters(): Promise<Character[]> {
  const cached = getCached<Character[]>(KV_CHARACTERS_CACHE)
  if (cached) return cached

  try {
    const data = await httpClient.getJson<{ characters: Array<Record<string, unknown>> }>(
      '/api/v2/characters',
    )
    const characters: Character[] = data.characters.map((raw) => {
      let attributes: Record<string, boolean | null> = {}
      if (typeof raw.attributes_json === 'string') {
        try {
          const parsed = JSON.parse(raw.attributes_json) as Record<string, number | null>
          attributes = Object.fromEntries(
            Object.entries(parsed).map(([k, v]) => [k, v === 1 ? true : v === 0 ? false : null])
          )
        } catch { /* keep empty */ }
      }
      return { ...(raw as unknown as Character), attributes }
    })
    setCache(KV_CHARACTERS_CACHE, characters)
    return characters
  } catch {
    // Offline fallback: use cache even if stale
    return getStaleCache<Character[]>(KV_CHARACTERS_CACHE) || []
  }
}

// ===== Questions =====

export async function submitCharacter(
  character: Omit<Character, 'id' | 'createdBy' | 'createdAt'>,
  newQuestions?: Array<{ text: string; attribute: string }>
): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await httpClient.request('/api/v2/characters', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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
    const questions = await httpClient.getJson<Question[]>('/api/v2/questions')
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
      await httpClient.postJson('/api/questions', q)
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
    await httpClient.postJson('/api/stats', {
      characterId,
      won,
      questionsAsked,
      difficulty,
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
    const res = await httpClient.request('/api/corrections', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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
