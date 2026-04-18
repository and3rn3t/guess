import { DB_NAME, DB_VERSION } from './constants'
import type { GameHistoryEntry } from './types'

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onupgradeneeded = () => {
      const db = request.result

      if (!db.objectStoreNames.contains('gameHistory')) {
        const historyStore = db.createObjectStore('gameHistory', { keyPath: 'id' })
        historyStore.createIndex('timestamp', 'timestamp')
        historyStore.createIndex('won', 'won')
        historyStore.createIndex('difficulty', 'difficulty')
      }

      if (!db.objectStoreNames.contains('analytics')) {
        const analyticsStore = db.createObjectStore('analytics', { autoIncrement: true })
        analyticsStore.createIndex('timestamp', 'timestamp')
        analyticsStore.createIndex('event', 'event')
      }
    }

    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

// ===== Game History =====

export async function addGameEntry(entry: GameHistoryEntry): Promise<void> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction('gameHistory', 'readwrite')
    tx.objectStore('gameHistory').add(entry)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

export async function getGameHistory(): Promise<GameHistoryEntry[]> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction('gameHistory', 'readonly')
    const request = tx.objectStore('gameHistory').index('timestamp').getAll()
    request.onsuccess = () => resolve((request.result as GameHistoryEntry[]).reverse())
    request.onerror = () => reject(request.error)
  })
}

export async function clearGameHistory(): Promise<void> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction('gameHistory', 'readwrite')
    tx.objectStore('gameHistory').clear()
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

// ===== Analytics =====

export interface AnalyticsEvent {
  event: string
  timestamp: number
  data?: Record<string, string | number | boolean>
}

export async function addAnalyticsEvent(event: AnalyticsEvent): Promise<void> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction('analytics', 'readwrite')
    tx.objectStore('analytics').add(event)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

export async function getAnalyticsSince(since: number): Promise<AnalyticsEvent[]> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction('analytics', 'readonly')
    const range = IDBKeyRange.lowerBound(since)
    const request = tx.objectStore('analytics').index('timestamp').getAll(range)
    request.onsuccess = () => resolve(request.result as AnalyticsEvent[])
    request.onerror = () => reject(request.error)
  })
}

export async function clearAnalyticsDb(): Promise<void> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction('analytics', 'readwrite')
    tx.objectStore('analytics').clear()
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}
