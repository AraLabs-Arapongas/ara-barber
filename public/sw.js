// Service Worker para push notifications e bootstrap PWA.
// Não faz caching — apenas recebe push e abre URL ao clicar.

self.addEventListener('push', (event) => {
  if (!event.data) return
  let payload
  try {
    payload = event.data.json()
  } catch {
    payload = { title: 'Aviso', body: event.data.text(), url: '/' }
  }
  const { title, body, url, tag } = payload
  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      data: { url: url ?? '/' },
      icon: '/icon-192.png',
      badge: '/badge-72.png',
      tag,
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = event.notification.data?.url ?? '/'
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ('focus' in client && client.url.includes(url)) {
          return client.focus()
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(url)
    }),
  )
})

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()))
