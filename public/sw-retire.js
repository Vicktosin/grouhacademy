// Served as /sw.js on the old domains (grouhacademy.com, grouhacademy.space)
// after the move to sabirole.com (see lib/domain-move.ts). It replaces the installed app's
// old worker there: clears its caches, sends any open pages to the same page
// on the new domain, and removes itself. The installed app keeps opening;
// the old domain then redirects it to the new one.

const NEW_ORIGIN = 'https://sabirole.com'

self.addEventListener('install', () => self.skipWaiting())

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys()
    await Promise.all(keys.map((key) => caches.delete(key)))
    await self.clients.claim()
    const windows = await self.clients.matchAll({ type: 'window' })
    await Promise.all(windows.map((client) => {
      const url = new URL(client.url)
      url.searchParams.set('moved', '1')
      return client.navigate(`${NEW_ORIGIN}${url.pathname}${url.search}`).catch(() => {})
    }))
    await self.registration.unregister()
  })())
})
