const CACHE_NAME = 'grouh-academy-v3'

// The installable app covers app pages only, never the public website.
// Keep in step with isPwaRoute() in lib/app-routes.ts.
const APP_SECTIONS = [
  '/app', '/admin', '/instructor', '/mentor', '/student', '/auth', '/dev',
  '/login', '/register', '/courses/login', '/courses/register', '/welcome',
  '/forgot-password', '/otp', '/reset-password', '/reset-password-success',
  '/offline',
]
function isAppPath(pathname) {
  if (pathname.startsWith('/internship/')) return true
  return APP_SECTIONS.some((section) => pathname === section || pathname.startsWith(section + '/'))
}
const APP_SHELL = [
  '/offline',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
]

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)))
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))),
    ).then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return

  const url = new URL(request.url)

  // Never cache API responses or personalized pages. When offline, a page
  // navigation gets a purpose-built fallback instead of stale account data.
  if (request.mode === 'navigate') {
    // Public website pages load normally, with no offline handling.
    if (url.origin !== self.location.origin || !isAppPath(url.pathname)) return

    if (url.pathname === '/offline') {
      event.respondWith(fetch(request).catch(() => caches.match('/offline')))
      return
    }

    // Redirect (rather than serving the fallback in place) so the address bar
    // shows /offline, and remember the page so it can be retried later.
    event.respondWith(
      fetch(request).catch(() => {
        const offlineUrl = new URL('/offline', self.location.origin)
        offlineUrl.searchParams.set('from', url.pathname + url.search)
        return Response.redirect(offlineUrl.href, 302)
      }),
    )
    return
  }

  const isAppAsset = url.origin === self.location.origin && (
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.startsWith('/icons/') ||
    request.destination === 'style' ||
    request.destination === 'script' ||
    request.destination === 'font'
  )

  if (!isAppAsset) return

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached
      return fetch(request).then((response) => {
        if (response.ok) {
          const copy = response.clone()
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy))
        }
        return response
      })
    }),
  )
})
