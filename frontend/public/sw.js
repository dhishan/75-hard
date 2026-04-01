const CACHE = 'seventy5hard-v1'

// Cache app shell on install
self.addEventListener('install', (e) => {
  self.skipWaiting()
  e.waitUntil(
    caches.open(CACHE).then((cache) =>
      cache.addAll(['/', '/dashboard', '/manifest.json'])
    )
  )
})

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  )
  self.clients.claim()
})

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url)

  // Network-only for API calls
  if (url.hostname.includes('api.75hard') || url.pathname.startsWith('/api')) {
    return
  }

  // Cache-first for everything else (app shell, assets)
  e.respondWith(
    caches.match(e.request).then((cached) => {
      if (cached) return cached
      return fetch(e.request).then((response) => {
        if (response.ok && e.request.method === 'GET') {
          const clone = response.clone()
          caches.open(CACHE).then((cache) => cache.put(e.request, clone))
        }
        return response
      })
    })
  )
})
