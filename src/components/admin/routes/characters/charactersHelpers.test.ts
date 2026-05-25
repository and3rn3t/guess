import { describe, it, expect } from 'vitest'
import {
  toNullableBoolean,
  issueCountMessage,
  nextAttrValue,
} from './charactersHelpers'

describe('charactersHelpers', () => {
  describe('toNullableBoolean', () => {
    it('maps 1 → true', () => {
      expect(toNullableBoolean(1)).toBe(true)
    })

    it('maps 0 → false', () => {
      expect(toNullableBoolean(0)).toBe(false)
    })

    it('maps null → null', () => {
      expect(toNullableBoolean(null)).toBe(null)
    })
  })

  describe('issueCountMessage', () => {
    it('returns the clean-state message for 0 issues', () => {
      expect(issueCountMessage(0)).toBe('No issues found')
    })

    it('uses singular grammar for 1 issue', () => {
      expect(issueCountMessage(1)).toBe('1 issue found')
    })

    it('uses plural grammar for >1 issues', () => {
      expect(issueCountMessage(2)).toBe('2 issues found')
      expect(issueCountMessage(17)).toBe('17 issues found')
    })
  })

  describe('nextAttrValue (cycle null → 1 → 0 → null)', () => {
    it('null advances to 1', () => {
      expect(nextAttrValue(null)).toBe(1)
    })

    it('1 advances to 0', () => {
      expect(nextAttrValue(1)).toBe(0)
    })

    it('0 advances back to null', () => {
      expect(nextAttrValue(0)).toBe(null)
    })

    it('three cycles return to the original value', () => {
      let v: ReturnType<typeof nextAttrValue> = null
      v = nextAttrValue(v)
      v = nextAttrValue(v)
      v = nextAttrValue(v)
      expect(v).toBe(null)
    })
  })
})
