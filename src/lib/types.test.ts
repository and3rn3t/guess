import { describe, it, expect } from 'vitest'
import { CHARACTER_CATEGORIES, isCharacterCategory, sanitizeCategories } from './types'

describe('isCharacterCategory', () => {
  it('returns true for every declared category', () => {
    for (const cat of CHARACTER_CATEGORIES) {
      expect(isCharacterCategory(cat)).toBe(true)
    }
  })

  it('returns false for unknown strings', () => {
    expect(isCharacterCategory('musicals')).toBe(false)
    expect(isCharacterCategory('')).toBe(false)
    expect(isCharacterCategory('Movies')).toBe(false) // case-sensitive
  })

  it('returns false for non-strings', () => {
    expect(isCharacterCategory(null)).toBe(false)
    expect(isCharacterCategory(undefined)).toBe(false)
    expect(isCharacterCategory(123)).toBe(false)
    expect(isCharacterCategory({})).toBe(false)
    expect(isCharacterCategory([])).toBe(false)
  })
})

describe('sanitizeCategories', () => {
  it('returns [] for non-array input', () => {
    expect(sanitizeCategories(null)).toEqual([])
    expect(sanitizeCategories(undefined)).toEqual([])
    expect(sanitizeCategories('movies')).toEqual([])
    expect(sanitizeCategories({ movies: true })).toEqual([])
  })

  it('preserves the order of valid categories', () => {
    expect(sanitizeCategories(['movies', 'anime'])).toEqual(['movies', 'anime'])
  })

  it('drops invalid entries silently', () => {
    expect(sanitizeCategories(['movies', 'musicals', 'anime', null, 42])).toEqual([
      'movies',
      'anime',
    ])
  })

  it('returns [] when no entries are valid', () => {
    expect(sanitizeCategories(['foo', 'bar'])).toEqual([])
  })
})
