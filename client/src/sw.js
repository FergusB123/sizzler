/* Sizzler service worker (injectManifest source).
   Handles: precache + offline shell, runtime caching of recipe images,
   Web Push display, and notification click routing. */
import { precacheAndRoute } from 'workbox-precaching'
import { registerRoute } from 'workbox-routing'
import { CacheFirst, StaleWhileRevalidate } from 'workbox-strategies'
import { ExpirationPlugin } from 'workbox-expiration'

self.skipWaiting()
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()))

// Precache the built app shell (Workbox injects the manifest here).
precacheAndRoute(self.__WB_MANIFEST || [])

// Recipe images (Supabase storage + generated) — cache-first, capped.
// Recipe images: local uploads, Cloudinary, and app icons — cache-first, capped.
registerRoute(
  ({ url }) =>
    url.pathname.startsWith('/uploads/') ||
    url.pathname.startsWith('/icons/') ||
    url.hostname.includes('res.cloudinary.com'),
  new CacheFirst({
    cacheName: 'sizzler-images',
    plugins: [new ExpirationPlugin({ maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 30 })],
  }),
)

// API GETs — stale-while-revalidate so the library opens offline.
registerRoute(
  ({ url, request }) => url.pathname.startsWith('/api/') && request.method === 'GET',
  new StaleWhileRevalidate({ cacheName: 'sizzler-api' }),
)

// Offline fallback for navigations.
const OFFLINE_URL = '/offline.html'
self.addEventListener('fetch', (event) => {
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() => caches.match(OFFLINE_URL) || Response.error()),
    )
  }
})

// ── Web Push ────────────────────────────────────────────────
self.addEventListener('push', (event) => {
  let data = { title: 'Sizzler', body: '', url: '/' }
  try {
    if (event.data) data = { ...data, ...event.data.json() }
  } catch {
    if (event.data) data.body = event.data.text()
  }
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      tag: data.tag || 'sizzler',
      data: { url: data.url || '/' },
      vibrate: [60, 40, 60],
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const target = event.notification.data?.url || '/'
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const c of clients) {
        if ('focus' in c) {
          c.navigate(target)
          return c.focus()
        }
      }
      return self.clients.openWindow(target)
    }),
  )
})
