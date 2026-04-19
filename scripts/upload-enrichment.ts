#!/usr/bin/env npx tsx
/**
 * Upload enrichment attributes from staging DB to D1 via worker endpoint.
 * Uses /api/admin/upload-attrs which goes through the worker's D1 binding
 * (not the management API, so no rate limits).
 *
 * Usage: npx tsx scripts/upload-enrichment.ts [--dry-run] [--images-only] [--attrs-only]
 */

import Database from 'better-sqlite3'

const STAGING_DB = 'data/staging.db'
const BASE_URL = process.env.BASE_URL || 'https://guess.andernet.dev'
const ADMIN_SECRET = process.env.ADMIN_SECRET || ''
const DRY_RUN = process.argv.includes('--dry-run')
const IMAGES_ONLY = process.argv.includes('--images-only')
const ATTRS_ONLY = process.argv.includes('--attrs-only')

const BATCH_SIZE = 400  // rows per request (max 500)
const CONCURRENCY = 3   // parallel requests

interface AttrRow {
  character_id: string
  attribute_key: string
  value: string
}

interface ImageRow {
  character_id: string
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function uploadBatch(
  payload: Record<string, unknown>,
  retries = 5
): Promise<boolean> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const resp = await fetch(`${BASE_URL}/api/admin/upload-attrs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...payload, secret: ADMIN_SECRET }),
      })

      if (resp.status === 429) {
        const wait = attempt * 2
        process.stderr.write(`  429, waiting ${wait}s...\n`)
        await sleep(wait * 1000)
        continue
      }

      if (!resp.ok) {
        const text = await resp.text()
        process.stderr.write(`  Error ${resp.status}: ${text.slice(0, 200)}\n`)
        if (attempt < retries) {
          await sleep(attempt * 1000)
          continue
        }
        return false
      }

      return true
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      process.stderr.write(`  Fetch error: ${msg.slice(0, 200)}\n`)
      if (attempt < retries) {
        await sleep(attempt * 2000)
        continue
      }
      return false
    }
  }
  return false
}

async function runBatches<T>(
  items: T[],
  batchSize: number,
  concurrency: number,
  buildPayload: (batch: T[]) => Record<string, unknown>,
  label: string
): Promise<{ ok: number; fail: number }> {
  let ok = 0
  let fail = 0
  const startTime = Date.now()
  const total = items.length
  const totalBatches = Math.ceil(total / batchSize)

  for (let i = 0; i < total; i += batchSize * concurrency) {
    const promises: Promise<boolean>[] = []
    const batchItems: number[] = []

    for (let j = 0; j < concurrency && i + j * batchSize < total; j++) {
      const start = i + j * batchSize
      const batch = items.slice(start, start + batchSize)
      batchItems.push(batch.length)
      promises.push(uploadBatch(buildPayload(batch)))
    }

    const results = await Promise.all(promises)
    for (let j = 0; j < results.length; j++) {
      if (results[j]) ok += batchItems[j]
      else fail += batchItems[j]
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(0)
    const batchNum = Math.min(Math.floor(i / batchSize) + concurrency, totalBatches)
    const rate = ((ok + fail) / ((Date.now() - startTime) / 1000)).toFixed(0)
    
    if (batchNum % 10 === 0 || batchNum >= totalBatches) {
      console.log(
        `  [${label}] ${ok.toLocaleString()} ok, ${fail.toLocaleString()} fail / ${total.toLocaleString()} (${rate}/s) | ${elapsed}s`
      )
    }
  }

  return { ok, fail }
}

async function main() {
  if (!ADMIN_SECRET) {
    console.error('Set ADMIN_SECRET env var')
    process.exit(1)
  }

  console.log(`Uploading to ${BASE_URL}`)
  const db = new Database(STAGING_DB, { readonly: true })

  // ── Upload attributes ────────────────────────────────────
  if (!IMAGES_ONLY) {
    console.log('\nReading enrichment attributes from staging...')
    const attrs = db.prepare(`
      SELECT ea.character_id, ea.attribute_key, ea.value
      FROM enrichment_attributes ea
      INNER JOIN enrichment_status es ON ea.character_id = es.character_id
      WHERE es.status = 'done' AND ea.value IN ('0', '1')
      ORDER BY ea.character_id
    `).all() as AttrRow[]

    console.log(`  ${attrs.length.toLocaleString()} attribute rows to upload`)

    if (DRY_RUN) {
      console.log(`  [DRY RUN] Would send ${Math.ceil(attrs.length / BATCH_SIZE)} requests`)
    } else {
      const { ok, fail } = await runBatches(
        attrs,
        BATCH_SIZE,
        CONCURRENCY,
        (batch) => ({
          attributes: batch.map(a => ({ c: a.character_id, k: a.attribute_key, v: parseInt(a.value) })),
        }),
        'Attrs'
      )
      console.log(`\n[Attrs] Done: ${ok.toLocaleString()} uploaded, ${fail.toLocaleString()} failed`)
    }
  }

  // ── Update image URLs ────────────────────────────────────
  if (!ATTRS_ONLY) {
    console.log('\nReading image status from staging...')
    const images = db.prepare(`
      SELECT character_id FROM image_status WHERE status = 'done'
    `).all() as ImageRow[]

    console.log(`  ${images.length.toLocaleString()} image URLs to update`)

    if (DRY_RUN) {
      console.log(`  [DRY RUN] Would send ${Math.ceil(images.length / BATCH_SIZE)} requests`)
    } else {
      const { ok, fail } = await runBatches(
        images,
        BATCH_SIZE,
        CONCURRENCY,
        (batch) => ({
          images: batch.map(img => ({
            id: img.character_id,
            url: `/api/images/${img.character_id}/profile.webp`,
          })),
        }),
        'Images'
      )
      console.log(`\n[Images] Done: ${ok.toLocaleString()} updated, ${fail.toLocaleString()} failed`)
    }
  }

  db.close()
  console.log('\nAll done!')
}

main().catch(console.error)
