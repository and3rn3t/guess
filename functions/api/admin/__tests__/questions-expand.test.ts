import { describe, expect, it } from 'vitest'
import { buildEnv, createTestDb, invokeHandler, seedAttributeDefinition, seedCharacter } from './harness'
import { onRequestGet, onRequestPost } from '../questions/expand'

describe('POST /api/admin/questions/expand', () => {
  it('returns 503 when D1 is missing', async () => {
    const res = await invokeHandler(onRequestPost, {
      method: 'POST',
      env: buildEnv(),
      body: { dryRun: true },
    })

    expect(res.status).toBe(503)
  })

  it('returns candidate questions in dry-run mode without inserting', async () => {
    const db = createTestDb()
    try {
      seedAttributeDefinition(db, 'isTimeTraveler', {
        display_text: 'Is Time Traveler',
        question_text: 'Is this character a time traveler?',
      })
      for (let i = 0; i < 3; i++) {
        const id = `c-${i}`
        seedCharacter(db, id)
        db.raw.prepare(
          `INSERT INTO character_attributes (character_id, attribute_key, value, confidence)
           VALUES (?, ?, ?, ?)`
        ).run(id, 'isTimeTraveler', i % 2, 0.9)
      }

      const before = db.raw.prepare('SELECT COUNT(*) as c FROM questions').get() as { c: number }

      const res = await invokeHandler<{
        ok: boolean
        dryRun: boolean
        candidates: number
        inserted: number
      }>(onRequestPost, {
        method: 'POST',
        env: buildEnv({ db }),
        body: {
          dryRun: true,
          limit: 10,
          minCharacterCount: 1,
        },
      })

      const after = db.raw.prepare('SELECT COUNT(*) as c FROM questions').get() as { c: number }

      expect(res.status).toBe(200)
      expect(res.body.ok).toBe(true)
      expect(res.body.dryRun).toBe(true)
      expect(res.body.candidates).toBeGreaterThan(0)
      expect(res.body.inserted).toBe(0)
      expect(after.c).toBe(before.c)

      const history = await invokeHandler<{ runs: Array<{ dryRun: boolean; status: string }> }>(onRequestGet, {
        method: 'GET',
        env: buildEnv({ db }),
      })
      expect(history.status).toBe(200)
      expect(history.body.runs).toHaveLength(1)
      expect(history.body.runs[0]?.dryRun).toBe(true)
      expect(history.body.runs[0]?.status).toBe('success')
    } finally {
      db.close()
    }
  })

  it('inserts generated questions in apply mode', async () => {
    const db = createTestDb()
    try {
      seedAttributeDefinition(db, 'hasSignatureWeapon', {
        display_text: 'Has Signature Weapon',
        question_text: 'Does this character have a signature weapon?',
      })
      for (let i = 0; i < 4; i++) {
        const id = `d-${i}`
        seedCharacter(db, id)
        db.raw.prepare(
          `INSERT INTO character_attributes (character_id, attribute_key, value, confidence)
           VALUES (?, ?, ?, ?)`
        ).run(id, 'hasSignatureWeapon', i % 2, 0.9)
      }

      const before = db.raw.prepare(
        `SELECT COUNT(*) as c FROM questions WHERE attribute_key = ?`
      ).get('hasSignatureWeapon') as { c: number }

      const res = await invokeHandler<{
        ok: boolean
        dryRun: boolean
        candidates: number
        inserted: number
      }>(onRequestPost, {
        method: 'POST',
        env: buildEnv({ db }),
        body: {
          dryRun: false,
          limit: 10,
          minCharacterCount: 1,
        },
      })

      const after = db.raw.prepare(
        `SELECT COUNT(*) as c FROM questions WHERE attribute_key = ?`
      ).get('hasSignatureWeapon') as { c: number }

      expect(res.status).toBe(200)
      expect(res.body.ok).toBe(true)
      expect(res.body.dryRun).toBe(false)
      expect(res.body.inserted).toBeGreaterThan(0)
      expect(after.c).toBeGreaterThan(before.c)

      const history = await invokeHandler<{ runs: Array<{ dryRun: boolean; inserted: number; status: string }> }>(onRequestGet, {
        method: 'GET',
        env: buildEnv({ db }),
      })
      expect(history.status).toBe(200)
      expect(history.body.runs).toHaveLength(1)
      expect(history.body.runs[0]?.dryRun).toBe(false)
      expect(history.body.runs[0]?.inserted).toBeGreaterThan(0)
      expect(history.body.runs[0]?.status).toBe('success')
    } finally {
      db.close()
    }
  })

  it('returns empty history when no runs exist', async () => {
    const db = createTestDb()
    try {
      const res = await invokeHandler<{ ok: boolean; runs: unknown[] }>(onRequestGet, {
        method: 'GET',
        env: buildEnv({ db }),
      })
      expect(res.status).toBe(200)
      expect(res.body.ok).toBe(true)
      expect(res.body.runs).toEqual([])
    } finally {
      db.close()
    }
  })
})
