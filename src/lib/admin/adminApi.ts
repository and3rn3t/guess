/**
 * Admin-only API calls that hit /api/admin/* endpoints.
 * These require Basic Auth credentials and are only used by admin components.
 * Separated from sync.ts (user-facing) to keep concerns distinct.
 */
import { httpClient, JSON_CONTENT_TYPE } from '@/lib/http'
import { ADMIN_API_ENDPOINTS, adminCharacterPath } from '@/lib/constants'
import type { Character, CharacterCategory } from '@/lib/types'

type AttributeApiValue = 0 | 1 | null
type AttributeValue = boolean | null

function apiValueToAttribute(value: AttributeApiValue): AttributeValue {
  if (value === 1) return true
  if (value === 0) return false
  return null
}

function attributeToApiValue(value: AttributeValue): AttributeApiValue {
  if (value === true) return 1
  if (value === false) return 0
  return null
}

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
  attributes: Record<string, AttributeApiValue>
}

interface PatchCharacterAttributeBody {
  attributeKey: string
  value: AttributeApiValue
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
      `${ADMIN_API_ENDPOINTS.characters}?${params.toString()}`,
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
      adminCharacterPath(id),
    )
    const attributes: Record<string, boolean | null> = Object.fromEntries(
      Object.entries(data.attributes).map(([k, v]) => [k, apiValueToAttribute(v)])
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

export async function patchAdminCharacterAttribute(
  characterId: string,
  attributeKey: string,
  value: AttributeValue,
): Promise<void> {
  const body: PatchCharacterAttributeBody = {
    attributeKey,
    value: attributeToApiValue(value),
  }

  await httpClient.requestOrThrow(adminCharacterPath(characterId), {
    method: 'PATCH',
    headers: JSON_CONTENT_TYPE,
    body: JSON.stringify(body),
  })
}

export async function saveAdminCharacterAttributeDiff(
  characterId: string,
  previousAttributes: Record<string, AttributeValue>,
  nextAttributes: Record<string, AttributeValue>,
): Promise<number> {
  const keys = new Set<string>([
    ...Object.keys(previousAttributes),
    ...Object.keys(nextAttributes),
  ])

  const changed = Array.from(keys).filter((key) => {
    const prev = previousAttributes[key] ?? null
    const next = nextAttributes[key] ?? null
    return prev !== next
  })

  for (const key of changed) {
    await patchAdminCharacterAttribute(characterId, key, nextAttributes[key] ?? null)
  }

  return changed.length
}
