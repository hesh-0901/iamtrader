/* IAMTRADER PWA service worker.
 * Keep requests network-only: never cache authenticated pages, API responses, or trading data.
 * The fetch listener preserves network defaults while satisfying browsers that check for one.
 */
self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(self.clients.claim());
});

// Do not call respondWith(): the browser handles every request normally from the network.
self.addEventListener('fetch', () => {});
