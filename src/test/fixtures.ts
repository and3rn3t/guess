import type { Character, Question, Answer, GameHistoryEntry, Difficulty, AnswerValue } from '@/lib/types'

// ── Character Fixtures ──

export const MARIO: Character = {
  id: 'mario',
  name: 'Mario',
  category: 'video-games',
  attributes: { isHuman: true, canFly: false, usesWeapons: false, isMale: true },
}

export const LINK: Character = {
  id: 'link',
  name: 'Link',
  category: 'video-games',
  attributes: { isHuman: true, canFly: false, usesWeapons: true, isMale: true },
}

export const PIKACHU: Character = {
  id: 'pikachu',
  name: 'Pikachu',
  category: 'video-games',
  attributes: { isHuman: false, canFly: false, usesWeapons: false, isMale: null },
}

export const KIRBY: Character = {
  id: 'kirby',
  name: 'Kirby',
  category: 'video-games',
  attributes: { isHuman: false, canFly: true, usesWeapons: false, isMale: null },
}

export const ALL_CHARS: Character[] = [MARIO, LINK, PIKACHU, KIRBY]

// ── Question Fixtures ──

export const Q_HUMAN: Question = { id: 'q1', text: 'Is this character human?', attribute: 'isHuman' }
export const Q_FLY: Question = { id: 'q2', text: 'Can this character fly?', attribute: 'canFly' }
export const Q_WEAPONS: Question = { id: 'q3', text: 'Does this character use weapons?', attribute: 'usesWeapons' }
export const Q_MALE: Question = { id: 'q4', text: 'Is this character male?', attribute: 'isMale' }

export const ALL_QUESTIONS: Question[] = [Q_HUMAN, Q_FLY, Q_WEAPONS, Q_MALE]

// ── Answer Helpers ──

export function answer(questionId: string, value: AnswerValue): Answer {
  return { questionId, value }
}

// ── Game History Fixtures ──

export function createGameHistoryEntry(overrides?: Partial<GameHistoryEntry>): GameHistoryEntry {
  return {
    id: crypto.randomUUID(),
    characterId: 'mario',
    characterName: 'Mario',
    won: true,
    timestamp: Date.now(),
    difficulty: 'medium' as Difficulty,
    totalQuestions: 5,
    steps: [
      { questionText: 'Is this character human?', attribute: 'isHuman', answer: 'yes' },
      { questionText: 'Can this character fly?', attribute: 'canFly', answer: 'no' },
    ],
    ...overrides,
  }
}

// ── Character Factory ──

export function createCharacter(overrides?: Partial<Character>): Character {
  return {
    id: `char-${Math.random().toString(36).slice(2, 8)}`,
    name: 'Test Character',
    category: 'movies',
    attributes: {},
    ...overrides,
  }
}
