/**
 * Admin-only API calls that hit /api/admin/* endpoints.
 * These require Basic Auth credentials and are only used by admin components.
 * Separated from sync.ts (user-facing) to keep concerns distinct.
 */
import { httpClient } from '@/lib/http'
import type { Character, CharacterCategory } from '@/lib/types'

interface AdminCharacterRow {
  id: string
  name: string
  category: string
  imageUrl: string | null
  isCustom: boolean
  createdAt: number
}

interface AdminCharacterDetail {
  character: { id: string; name: string; category: string }
  attributes: Record<string, 0 | 1 | null>
}

/**
 * Fetch the top-N most popular characters from the admin API.
 * Returns Character objects with empty attributes (sufficient for CharacterPicker).
 * No localStorage cache — admin tools always need fresh data.
 */
export async function fetchAdminCharacters(limit: number): Promise<Character[]> {
  try {
    const params = new URLSearchParams({
      sort: 'popularity',
      order: 'desc',
      pageSize: String(Math.min(500, Math.max(50, limit))),
      page: '1',
    })
    const data = await httpClient.getJson<{ characters: AdminCharacterRow[] }>(
      `/api/admin/characters?${params.toString()}`,
    )
    return (data.characters ?? []).map((r) => ({
      id: r.id,
      name: r.name,
      category: r.category as CharacterCategory,
      attributes: {},
      imageUrl: r.imageUrl ?? undefined,
      isCustom: r.isCustom,
      createdAt: r.createdAt,
    }))
  } catch {
    return []
  }
}

/**
 * Fetch full character data (including attributes) from the admin API.
 * Used by CharacterPicker when a character is selected for detailed analysis.
 */
export async function fetchAdminCharacterById(id: string): Promise<Character | null> {
  try {
    const data = await httpClient.getJson<AdminCharacterDetail>(
      `/api/admin/characters/${encodeURIComponent(id)}`,
    )
    const attributes: Record<string, boolean | null> = Object.fromEntries(
      Object.entries(data.attributes).map(([k, v]) => [k, v === 1 ? true : v === 0 ? false : null])
    )
    return {
      id: data.character.id,
      name: data.character.name,
      category: data.character.category as CharacterCategory,
      attributes,
    }
  } catch {
    return null
  }
}
