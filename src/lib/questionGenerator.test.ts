import { describe, it, expect } from 'vitest'
import { getQuestionGenerationInsight } from './questionGenerator'
import type { Character, Question } from './types'

const CHARS: Character[] = [
  {
    id: 'char1',
    name: 'Character 1',
    category: 'movies',
    attributes: { isHuman: true, canFly: false, hasMagic: true },
  },
  {
    id: 'char2',
    name: 'Character 2',
    category: 'movies',
    attributes: { isHuman: false, canFly: true, hasMagic: false },
  },
]

const EXISTING_QUESTIONS: Question[] = [
  { id: 'q1', text: 'Is this character human?', attribute: 'isHuman' },
]

describe('getQuestionGenerationInsight', () => {
  it('reports new discriminating attributes', () => {
    const insight = getQuestionGenerationInsight(CHARS, EXISTING_QUESTIONS)
    // canFly and hasMagic are new, and they split 1/1 — both are discriminating
    expect(insight).toContain('2')
    expect(insight).toContain('discriminating')
  })

  it('reports all covered when questions match all attributes', () => {
    const allQuestions: Question[] = [
      { id: 'q1', text: 'Human?', attribute: 'isHuman' },
      { id: 'q2', text: 'Fly?', attribute: 'canFly' },
      { id: 'q3', text: 'Magic?', attribute: 'hasMagic' },
    ]
    const insight = getQuestionGenerationInsight(CHARS, allQuestions)
    expect(insight).toContain('covered')
  })
})
