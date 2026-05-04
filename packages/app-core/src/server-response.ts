export type ServerAnswerResponseKind =
  | 'contradiction'
  | 'guess'
  | 'question'
  | 'unknown'

export interface ServerAnswerResponseLike {
  type?: string
  question?: unknown
  reasoning?: unknown
  character?: ServerGuessCharacterLike
}

export interface ServerGuessCharacterLike {
  id: string
  name: string
  category?: string
  imageUrl?: string | null
  trivia?: string[]
}

export interface NormalizedGuessCharacter {
  id: string
  name: string
  category: string
  imageUrl?: string
  trivia?: string[]
}

export const classifyServerAnswerResponse = (
  response: ServerAnswerResponseLike,
): ServerAnswerResponseKind => {
  if (response.type === 'contradiction') {
    return 'contradiction'
  }
  if (response.type === 'guess' && response.character) {
    return 'guess'
  }
  if (response.type === 'question' && response.question && response.reasoning) {
    return 'question'
  }
  return 'unknown'
}

export const normalizeGuessCharacter = (
  character: ServerGuessCharacterLike,
): NormalizedGuessCharacter => ({
  id: character.id,
  name: character.name,
  category: character.category || 'other',
  imageUrl: character.imageUrl ?? undefined,
  trivia: character.trivia,
})