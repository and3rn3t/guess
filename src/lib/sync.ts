import type { Character, Question, Difficulty } from './types'

export type SyncStatus = 'synced' | 'pending' | 'error' | 'offline'

const CACHE_TTL = 10 * 60 * 1000 // 10 minutes
const CHARACTERS_CACHE_KEY = 'kv:characters-cache'
const QUESTIONS_CACHE_KEY = 'kv:questions-cache'
const USER_ID_KEY = 'kv:user-id'

// ===== User ID =====

export function getUserId(): string {
  let id = localStorage.getItem(USER_ID_KEY)
  if (!id) {
    id = crypto.randomUUID()
    localStorage.setItem(USER_ID_KEY, id)
  }
  return id
}

function headers(): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    'X-User-Id': getUserId(),
  }
}

// ===== Characters =====

export async function fetchGlobalCharacters(): Promise<Character[]> {
  const cached = getCached<Character[]>(CHARACTERS_CACHE_KEY)
  if (cached) return cached

  try {
    const res = await fetch('/api/characters', { headers: headers() })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const characters = (await res.json()) as Character[]
    setCache(CHARACTERS_CACHE_KEY, characters)
    return characters
  } catch {
    // Offline fallback: use cache even if stale
    return getStaleCache<Character[]>(CHARACTERS_CACHE_KEY) || []
  }
}

export async function submitCharacter(
  character: Omit<Character, 'id' | 'createdBy' | 'createdAt'>,
  newQuestions?: Array<{ text: string; attribute: string }>
): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch('/api/characters', {
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
    invalidateCache(CHARACTERS_CACHE_KEY)
    return { success: true }
  } catch {
    return { success: false, error: 'Network error — character saved locally only' }
  }
}

// ===== Questions =====

export async function fetchGlobalQuestions(): Promise<Question[]> {
  const cached = getCached<Question[]>(QUESTIONS_CACHE_KEY)
  if (cached) return cached

  try {
    const res = await fetch('/api/questions', { headers: headers() })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const questions = (await res.json()) as Question[]
    setCache(QUESTIONS_CACHE_KEY, questions)
    return questions
  } catch {
    return getStaleCache<Question[]>(QUESTIONS_CACHE_KEY) || []
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

export async function fetchCharacterStats(characterId: string): Promise<{
  timesPlayed: number
  wins: number
  losses: number
  totalQuestions: number
} | null> {
  try {
    const res = await fetch(`/api/stats?characterId=${encodeURIComponent(characterId)}`, {
      headers: headers(),
    })
    if (!res.ok) return null
    return (await res.json()) as { timesPlayed: number; wins: number; losses: number; totalQuestions: number }
  } catch {
    return null
  }
}

export async function fetchLeaderboard(): Promise<Array<{
  characterId: string
  timesPlayed: number
  wins: number
}>> {
  try {
    const res = await fetch('/api/stats?leaderboard=true', { headers: headers() })
    if (!res.ok) return []
    return (await res.json()) as Array<{ characterId: string; timesPlayed: number; wins: number }>
  } catch {
    return []
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

export async function fetchCorrections(characterId: string): Promise<Array<{
  attribute: string
  suggestedValue: boolean
  userId: string
}>> {
  try {
    const res = await fetch(`/api/corrections?characterId=${encodeURIComponent(characterId)}`, {
      headers: headers(),
    })
    if (!res.ok) return []
    return (await res.json()) as Array<{ attribute: string; suggestedValue: boolean; userId: string }>
  } catch {
    return []
  }
}

// ===== User Data Sync =====

export async function pushUserData(
  settings: Record<string, unknown>,
  gameStats: Record<string, unknown>
): Promise<void> {
  try {
    await fetch('/api/sync', {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ userId: getUserId(), settings, gameStats }),
    })
  } catch {
    // Fire-and-forget
  }
}

export async function pullUserData(): Promise<{
  settings: Record<string, unknown>
  gameStats: Record<string, unknown>
} | null> {
  try {
    const res = await fetch(`/api/sync?userId=${encodeURIComponent(getUserId())}`, {
      headers: headers(),
    })
    if (!res.ok) return null
    return (await res.json()) as { settings: Record<string, unknown>; gameStats: Record<string, unknown> }
  } catch {
    return null
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
    if (Date.now() - ts > CACHE_TTL) return null // stale
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
