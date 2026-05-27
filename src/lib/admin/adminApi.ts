/**
 * Admin-only API calls that hit /api/admin/* endpoints.
 * These require Basic Auth credentials and are only used by admin components.
 * Separated from sync.ts (user-facing) to keep concerns distinct.
 *
 * Request/response shapes are derived from the OpenAPI-generated client at
 * `src/lib/api.generated.ts`. Wire transport stays on `httpClient` so retry /
 * 429 / SSE concerns remain owned by `src/lib/http.ts`.
 */
import { httpClient, JSON_CONTENT_TYPE } from '@/lib/http'
import { ADMIN_API_ENDPOINTS, adminCharacterPath } from '@/lib/constants'
import type { Character, CharacterCategory } from '@/lib/types'
import type { paths } from '@/lib/api.generated'

// ── Generated-type aliases ───────────────────────────────────

type AdminCharactersGetResponse =
  paths['/api/admin/characters']['get']['responses']['200']['content']['application/json']
type AdminCharactersGetQuery = NonNullable<
  paths['/api/admin/characters']['get']['parameters']['query']
>

type AdminCharacterByIdGetResponse =
  paths['/api/admin/characters/{id}']['get']['responses']['200']['content']['application/json']

type AdminCharacterByIdPatchBody =
  paths['/api/admin/characters/{id}']['patch']['requestBody']['content']['application/json']

export type AdminAutomationStatus =
  paths['/api/admin/automation-status']['get']['responses']['200']['content']['application/json']

// Public re-export kept for consumers that previously imported this name.
export type AdminAutomationReport = NonNullable<AdminAutomationStatus['report']>

type AttributeApiValue = AdminCharacterByIdGetResponse['attributes'][string]
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

/**
 * Fetch the top-N most popular characters from the admin API.
 * Returns Character objects with empty attributes (sufficient for CharacterPicker).
 * No localStorage cache — admin tools always need fresh data.
 */
export async function fetchAdminCharacters(limit: number): Promise<Character[]> {
  try {
    const query: AdminCharactersGetQuery = {
      sort: 'popularity',
      order: 'desc',
      pageSize: Math.min(500, Math.max(50, limit)),
      page: 1,
    }
    const params = new URLSearchParams()
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined) params.set(key, String(value))
    }
    const data = await httpClient.getJson<AdminCharactersGetResponse>(
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
    const data = await httpClient.getJson<AdminCharacterByIdGetResponse>(
      adminCharacterPath(id),
    )
    const attributes: Record<string, AttributeValue> = Object.fromEntries(
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
  const body: AdminCharacterByIdPatchBody = {
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

export async function fetchAdminAutomationStatus(): Promise<AdminAutomationStatus | null> {
  try {
    return await httpClient.getJson<AdminAutomationStatus>(
      ADMIN_API_ENDPOINTS.automationStatus,
    )
  } catch {
    return null
  }
}
