import { d1First, d1Query, type Env } from '../../_helpers'

export interface DailyCharacter {
  id: string
  name: string
  image_url: string | null
}

function hashDateToSeed(dateKey: string): number {
  let hash = 2166136261
  for (let i = 0; i < dateKey.length; i++) {
    hash ^= dateKey.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

export function getUtcDateKey(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10)
}

export async function pickDailyCharacter(db: D1Database, dateKey: string): Promise<DailyCharacter | null> {
  const candidates = await d1Query<DailyCharacter>(
    db,
    `SELECT id, name, image_url
       FROM characters
      WHERE attribute_count >= ?
      ORDER BY popularity DESC
      LIMIT 500`,
    [20],
  )

  if (candidates.length === 0) return null

  const seed = hashDateToSeed(dateKey)
  const idx = seed % candidates.length
  return candidates[idx] ?? null
}

export async function getDailyCompletion(
  db: D1Database,
  dateKey: string,
  userId: string,
): Promise<{ won: number; questions_asked: number; completed_at: number } | null> {
  try {
    return await d1First<{ won: number; questions_asked: number; completed_at: number }>(
      db,
      `SELECT won, questions_asked, completed_at
         FROM daily_results
        WHERE date = ? AND user_id = ?`,
      [dateKey, userId],
    )
  } catch (error) {
    // Gracefully degrade if the deployment database is missing the daily_results migration.
    const message = error instanceof Error ? error.message : String(error)
    if (message.includes('no such table: daily_results')) return null
    throw error
  }
}

export function toUserLabel(userId: string): string {
  return `Player ${userId.slice(0, 8)}`
}

export type DailyEnv = Pick<Env, 'GUESS_DB' | 'GUESS_KV' | 'COOKIE_SECRET' | 'RATE_LIMITER'>
