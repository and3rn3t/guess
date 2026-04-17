import type { Difficulty, GameHistoryStep } from '@/lib/types'

export interface SharePayload {
  characterId: string
  characterName: string
  won: boolean
  difficulty: Difficulty
  questionCount: number
  steps: GameHistoryStep[]
}

/**
 * Encode a game result into a URL-safe base64 string for the hash fragment.
 * Format: compact JSON → base64url
 */
export function encodeChallenge(payload: SharePayload): string {
  const compact = {
    c: payload.characterId,
    n: payload.characterName,
    w: payload.won ? 1 : 0,
    d: payload.difficulty[0], // e/m/h
    q: payload.questionCount,
    s: payload.steps.map((s) => ({
      a: s.attribute,
      v: s.answer[0],
    })),
  }
  const json = JSON.stringify(compact)
  return btoa(json).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/**
 * Decode a base64url hash back into a SharePayload, or null if invalid.
 */
export function decodeChallenge(hash: string): SharePayload | null {
  try {
    const padded = hash.replace(/-/g, '+').replace(/_/g, '/') + '=='.slice(0, (4 - (hash.length % 4)) % 4)
    const json = atob(padded)
    const compact = JSON.parse(json)

    if (!compact.c || !compact.n || compact.d === undefined) return null

    const difficultyMap: Record<string, Difficulty> = { e: 'easy', m: 'medium', h: 'hard' }
    const difficulty = difficultyMap[compact.d]
    if (!difficulty) return null

    const answerMap: Record<string, 'yes' | 'no' | 'maybe' | 'unknown'> = {
      y: 'yes',
      n: 'no',
      m: 'maybe',
      u: 'unknown',
    }
    const steps: GameHistoryStep[] = (Array.isArray(compact.s) ? compact.s : []).map((step: { a?: string; v?: string }) => ({
      questionText: '',
      attribute: step.a || '',
      answer: answerMap[step.v || ''] || 'unknown',
    }))

    return {
      characterId: compact.c,
      characterName: compact.n,
      won: compact.w === 1,
      difficulty,
      questionCount: compact.q,
      steps,
    }
  } catch {
    return null
  }
}

/**
 * Build a shareable URL with the challenge hash.
 */
export function buildShareUrl(payload: SharePayload): string {
  const encoded = encodeChallenge(payload)
  return `${window.location.origin}${window.location.pathname}#c=${encoded}`
}

/**
 * Generate share text with emoji summary.
 */
export function generateShareText(payload: SharePayload): string {
  const emoji = payload.won ? '🔮' : '🤔'
  const result = payload.won ? 'guessed it' : 'was stumped'
  const bar = payload.steps
    .map((s) => {
      switch (s.answer) {
        case 'yes': return '🟢'
        case 'no': return '🔴'
        case 'maybe': return '🟡'
        default: return '⚪'
      }
    })
    .join('')

  return [
    `${emoji} Mystic Guesser ${result} in ${payload.steps.length} questions!`,
    `${bar}`,
    `Difficulty: ${payload.difficulty.charAt(0).toUpperCase() + payload.difficulty.slice(1)}`,
    `Can you do better?`,
  ].join('\n')
}

/**
 * Check if current URL has a challenge hash and return it.
 */
export function parseUrlChallenge(): SharePayload | null {
  const hash = window.location.hash
  if (!hash.startsWith('#c=')) return null
  return decodeChallenge(hash.slice(3))
}
