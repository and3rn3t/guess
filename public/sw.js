const CACHE_NAME = 'andernator-v1'
const API_CACHE = 'andernator-api-v1'
const FONT_CACHE = 'andernator-fonts-v1'

const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
  '/apple-touch-icon.png',
]

// Google Fonts hosts
const FONT_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com']

// Read-only API endpoints eligible for stale-while-revalidate
const CACHEABLE_API = [
  '/api/characters', '/api/questions', '/api/stats', '/api/sync',
  '/api/v2/characters', '/api/v2/questions', '/api/v2/stats',
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  )
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  const validCaches = new Set([CACHE_NAME, API_CACHE, FONT_CACHE])
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => !validCaches.has(k)).map((k) => caches.delete(k))
      )
    ).then(() => {
      // Notify all open tabs that a new SW has taken over
      return self.clients.matchAll({ includeUncontrolled: true }).then((clients) => {
        clients.forEach((client) => client.postMessage({ type: 'SW_UPDATED' }))
      })
    })
  )
  self.clients.claim()
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  // Skip non-GET requests
  if (request.method !== 'GET') return

  // Google Fonts: cache-first (fonts rarely change)
  if (FONT_HOSTS.includes(url.hostname)) {
    event.respondWith(
      caches.open(FONT_CACHE).then((cache) =>
        cache.match(request).then((cached) => {
          if (cached) return cached
          return fetch(request).then((response) => {
            if (response.ok) cache.put(request, response.clone())
            return response
          })
        })
      )
    )
    return
  }

  // Cacheable API endpoints: stale-while-revalidate
  if (CACHEABLE_API.some((path) => url.pathname === path)) {
    event.respondWith(
      caches.open(API_CACHE).then((cache) =>
        cache.match(request).then((cached) => {
          const fetchPromise = fetch(request)
            .then((response) => {
              if (response.ok) cache.put(request, response.clone())
              return response
            })
            .catch(() => cached)
          return cached || fetchPromise
        })
      )
    )
    return
  }

  // Skip other API/LLM requests
  if (url.pathname.startsWith('/api/')) return

  // Navigation requests: network-first with offline fallback
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone()
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone))
          }
          return response
        })
        .catch(() => caches.match('/index.html'))
    )
    return
  }

  // Static assets: stale-while-revalidate
  event.respondWith(
    caches.match(request).then((cached) => {
      const fetchPromise = fetch(request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone()
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone))
          }
          return response
        })
        .catch(() => cached)

      return cached || fetchPromise
    })
  )
})
