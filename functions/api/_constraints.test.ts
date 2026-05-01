import { describe, expect, it } from 'vitest'
import {
  validateAttributes,
  violationToDisputeReason,
  type ConstraintSet,
} from './_constraints'

const SET: ConstraintSet = {
  version: 1,
  constraints: [
    {
      id: 'mutex-alignment',
      type: 'mutex',
      keys: ['isHero', 'isVillain', 'isAntiHero', 'isNeutral'],
      reason: 'Alignment is mutually exclusive.',
    },
    {
      id: 'requires-alignment',
      type: 'requiresOneOf',
      keys: ['isHero', 'isVillain', 'isAntiHero', 'isNeutral'],
      reason: 'A character needs at least one alignment.',
    },
    {
      id: 'implies-vampire',
      type: 'implies',
      if: { key: 'isVampire', value: true },
      then: {
        anyOf: [
          { key: 'isMythical', value: true },
          { key: 'isHuman', value: false },
        ],
      },
      reason: 'isVampire implies isMythical=true or isHuman=false.',
    },
    {
      id: 'implies-robot-not-human',
      type: 'implies',
      if: { key: 'isRobot', value: true },
      then: { allOf: [{ key: 'isHuman', value: false }] },
      reason: 'isRobot implies isHuman=false.',
    },
  ],
}

describe('validateAttributes — mutex', () => {
  it('passes when at most one mutex key is true', () => {
    expect(
      validateAttributes({ isHero: true, isVillain: false }, SET)
    ).toEqual(
      expect.not.arrayContaining([expect.objectContaining({ constraintId: 'mutex-alignment' })])
    )
  })

  it('flags every conflicting key when more than one is true', () => {
    const v = validateAttributes(
      { isHero: true, isVillain: true, isAntiHero: false, isNeutral: false },
      SET
    )
    const mutex = v.filter((x) => x.constraintId === 'mutex-alignment')
    expect(mutex.map((x) => x.attributeKey).sort()).toEqual(['isHero', 'isVillain'])
  })

  it('does not fire when all keys are null/missing', () => {
    expect(
      validateAttributes({ isHero: null }, SET).filter((x) => x.constraintId === 'mutex-alignment')
    ).toHaveLength(0)
  })
})

describe('validateAttributes — requiresOneOf', () => {
  it('fires only when every key is decided and all are false', () => {
    const v = validateAttributes(
      { isHero: false, isVillain: false, isAntiHero: false, isNeutral: false },
      SET
    )
    expect(v.some((x) => x.constraintId === 'requires-alignment')).toBe(true)
  })

  it('does not fire when at least one key is unknown (sparse map)', () => {
    const v = validateAttributes(
      { isHero: false, isVillain: false, isAntiHero: false, isNeutral: null },
      SET
    )
    expect(v.some((x) => x.constraintId === 'requires-alignment')).toBe(false)
  })

  it('does not fire when at least one key is true', () => {
    const v = validateAttributes(
      { isHero: true, isVillain: false, isAntiHero: false, isNeutral: false },
      SET
    )
    expect(v.some((x) => x.constraintId === 'requires-alignment')).toBe(false)
  })
})

describe('validateAttributes — implies (anyOf)', () => {
  it('passes when isVampire=true and isMythical=true', () => {
    const v = validateAttributes({ isVampire: true, isMythical: true, isHuman: true }, SET)
    expect(v.some((x) => x.constraintId === 'implies-vampire')).toBe(false)
  })

  it('flags when isVampire=true and both consequents fail', () => {
    const v = validateAttributes({ isVampire: true, isMythical: false, isHuman: true }, SET)
    expect(v.some((x) => x.constraintId === 'implies-vampire')).toBe(true)
  })

  it('skips when isVampire is unknown', () => {
    const v = validateAttributes({ isVampire: null, isMythical: false }, SET)
    expect(v.some((x) => x.constraintId === 'implies-vampire')).toBe(false)
  })

  it('skips when antecedent is true but every consequent is unknown (partial enrichment)', () => {
    const v = validateAttributes({ isVampire: true }, SET)
    expect(v.some((x) => x.constraintId === 'implies-vampire')).toBe(false)
  })
})

describe('validateAttributes — implies (allOf)', () => {
  it('passes when isRobot=true and isHuman=false', () => {
    const v = validateAttributes({ isRobot: true, isHuman: false }, SET)
    expect(v.some((x) => x.constraintId === 'implies-robot-not-human')).toBe(false)
  })

  it('flags when isRobot=true and isHuman=true', () => {
    const v = validateAttributes({ isRobot: true, isHuman: true }, SET)
    const hit = v.find((x) => x.constraintId === 'implies-robot-not-human')
    expect(hit?.attributeKey).toBe('isRobot')
    expect(hit?.currentValue).toBe(true)
  })

  it('passes vacuously when isHuman is unknown', () => {
    const v = validateAttributes({ isRobot: true, isHuman: null }, SET)
    expect(v.some((x) => x.constraintId === 'implies-robot-not-human')).toBe(false)
  })
})

describe('violationToDisputeReason', () => {
  it('prefixes the constraint id', () => {
    const reason = violationToDisputeReason({
      constraintId: 'mutex-alignment',
      reason: 'Alignment is mutually exclusive.',
      attributeKey: 'isHero',
      currentValue: true,
    })
    expect(reason).toBe('[constraint:mutex-alignment] Alignment is mutually exclusive.')
  })
})

describe('shipped attribute-constraints.json', () => {
  // Smoke-loads the bundled constraints file so a malformed JSON breaks CI.
  it('parses and runs against an empty map without throwing', async () => {
    const fs = await import('node:fs/promises')
    const url = new URL('../../data/attribute-constraints.json', import.meta.url)
    const raw = await fs.readFile(url, 'utf8')
    const parsed = JSON.parse(raw) as ConstraintSet
    expect(parsed.version).toBe(1)
    expect(Array.isArray(parsed.constraints)).toBe(true)
    expect(parsed.constraints.length).toBeGreaterThan(0)
    // Empty attribute map → no violations (everything is unknown).
    expect(validateAttributes({}, parsed)).toEqual([])
  })
})
