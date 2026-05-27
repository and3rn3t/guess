import { d1First, d1Query, logError, type Env } from '../../_helpers'
import type { CharactersRow } from '../../_db-types'

type CharacterRow = Pick<CharactersRow, 'id' | 'name' | 'category' | 'image_url' | 'popularity' | 'trivia'> & { attributes_json: string }

interface TriviaFallbackLogContext {
  env: Env
  requestId: string
  actorId: string
  path: string
  method: string
}

export async function queryCharacterPoolWithTriviaFallback(
  db: D1Database,
  where: string,
  params: unknown[],
  candidateLimit: number,
  ctx: TriviaFallbackLogContext,
): Promise<CharacterRow[]> {
  try {
    return await d1Query<CharacterRow>(
      db,
      `SELECT c.id, c.name, c.category, c.image_url, c.popularity, c.attributes_json, c.trivia
       FROM characters c
       ${where}
       ORDER BY c.popularity DESC
       LIMIT ?`,
      [...params, candidateLimit]
    )
  } catch (err) {
    logError(ctx.env, 'start', 'warn', 'Character query with trivia failed, falling back', err, {
      requestId: ctx.requestId,
      actorId: ctx.actorId,
      path: ctx.path,
      method: ctx.method,
      extra: { fallback: 'characters_without_trivia' },
    }).catch(() => {})

    return d1Query<CharacterRow>(
      db,
      `SELECT c.id, c.name, c.category, c.image_url, c.popularity, c.attributes_json, NULL as trivia
       FROM characters c
       ${where}
       ORDER BY c.popularity DESC
       LIMIT ?`,
      [...params, candidateLimit]
    )
  }
}

export async function queryPinnedCharacterWithTriviaFallback(
  db: D1Database,
  pinnedCharId: string,
  ctx: TriviaFallbackLogContext,
): Promise<CharacterRow | null> {
  try {
    return await d1First<CharacterRow>(
      db,
      'SELECT id, name, category, image_url, popularity, attributes_json, trivia FROM characters WHERE id = ?',
      [pinnedCharId]
    )
  } catch (err) {
    logError(ctx.env, 'start', 'warn', 'Pinned character query with trivia failed, falling back', err, {
      requestId: ctx.requestId,
      actorId: ctx.actorId,
      path: ctx.path,
      method: ctx.method,
      extra: { fallback: 'pinned_character_without_trivia' },
    }).catch(() => {})

    return d1First<CharacterRow>(
      db,
      'SELECT id, name, category, image_url, popularity, attributes_json, NULL as trivia FROM characters WHERE id = ?',
      [pinnedCharId]
    )
  }
}

export type { CharacterRow, TriviaFallbackLogContext }
