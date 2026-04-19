import { describe, it, expect } from 'vitest'
import { findDuplicateCandidates } from './dataCleanup'
import type { Character } from './types'

function char(id: string, name: string): Character {
  return { id, name, category: 'movies', attributes: {} }
}

describe('findDuplicateCandidates', () => {
  it('returns empty for no characters', () => {
    expect(findDuplicateCandidates([])).toEqual([])
  })

  it('returns empty for a single character', () => {
    expect(findDuplicateCandidates([char('a', 'Mario')])).toEqual([])
  })

  it('finds exact name duplicates', () => {
    const chars = [char('a', 'Mario'), char('b', 'Mario')]
    const pairs = findDuplicateCandidates(chars)
    expect(pairs).toHaveLength(1)
    expect(pairs[0][0].id).toBe('a')
    expect(pairs[0][1].id).toBe('b')
  })

  it('normalizes case, spaces, punctuation', () => {
    const chars = [char('a', 'Spider-Man'), char('b', 'spider man'), char('c', "Spider Man")]
    const pairs = findDuplicateCandidates(chars)
    // All three normalize to "spiderman" → 3 pairs: (a,b), (a,c), (b,c)
    expect(pairs).toHaveLength(3)
  })

  it('finds near-duplicates within Levenshtein distance 2', () => {
    const chars = [char('a', 'Gandalf'), char('b', 'Gandlf')]
    const pairs = findDuplicateCandidates(chars)
    expect(pairs).toHaveLength(1)
  })

  it('does not match distant names', () => {
    const chars = [char('a', 'Mario'), char('b', 'Pikachu')]
    const pairs = findDuplicateCandidates(chars)
    expect(pairs).toHaveLength(0)
  })

  it('handles special characters in names', () => {
    const chars = [char('a', "R2-D2"), char('b', 'R2D2')]
    const pairs = findDuplicateCandidates(chars)
    expect(pairs).toHaveLength(1)
  })

  it('handles large batches efficiently', () => {
    // Use names that are sufficiently different (Levenshtein distance >= 3)
    const names = [
      'Mario', 'Pikachu', 'Gandalf', 'Batman', 'Spongebob',
      'Wolverine', 'Dumbledore', 'Goku', 'Kirby', 'Zelda',
      'Ironman', 'Thanos', 'Yoda', 'Shrek', 'Rapunzel',
      'Naruto', 'Sonic', 'Dracula', 'Hercules', 'Cleopatra',
    ]
    const chars = names.map((n, i) => char(`c${i}`, n))
    const pairs = findDuplicateCandidates(chars)
    expect(pairs).toHaveLength(0)
  })
})
