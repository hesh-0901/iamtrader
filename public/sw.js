/* IAMTRADER PWA service worker.
 * Never cache authenticated pages, API responses, or trading data.
 */
self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(self.clients.claim());
});

// Keep requests network-only.
self.addEventListener('fetch', () => {});

// Display server-delivered Web Push notifications while the app is backgrounded or closed.
self.addEventListener('push', event => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { body: event.data ? event.data.text() : '' };
  }

  const notificationPayload = payload.notification && typeof payload.notification === 'object' ? payload.notification : {};
  const dataPayload = payload.data && typeof payload.data === 'object' ? payload.data : {};
  const titleValue = payload.title || notificationPayload.title;
  const bodyValue = payload.body || notificationPayload.body;
  const title = typeof titleValue === 'string' && titleValue.trim() ? titleValue.trim() : 'Nouveau message · IAMTRADER';
  const body = typeof bodyValue === 'string' && bodyValue.trim() ? bodyValue.trim() : 'Vous avez reçu un nouveau message sur PipTalk.';
  const conversationId = typeof payload.conversationId === 'string' ? payload.conversationId : (typeof dataPayload.conversationId === 'string' ? dataPayload.conversationId : '');
  const options = {
    body,
    icon: '/brand/favicon-iamtrader-192.png',
    badge: '/brand/favicon-iamtrader-192.png',
    tag: conversationId ? 'piptalk-' + conversationId : 'iamtrader-piptalk',
    renotify: true,
    data: { url: typeof payload.url === 'string' ? payload.url : (typeof dataPayload.url === 'string' ? dataPayload.url : '/?section=piptalk'), conversationId }
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const targetUrl = new URL(
    event.notification.data && typeof event.notification.data.url === 'string'
      ? event.notification.data.url
      : '/?section=piptalk',
    self.location.origin
  ).href;

  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of windows) {
      if (new URL(client.url).origin === self.location.origin && 'focus' in client) {
        await client.focus();
        if ('navigate' in client && client.url !== targetUrl) await client.navigate(targetUrl);
        return;
      }
    }
    await self.clients.openWindow(targetUrl);
  })());
});
