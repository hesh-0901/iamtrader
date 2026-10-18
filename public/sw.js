/* IAMTRADER PWA service worker.
 * Intentionally does not cache authenticated pages, API responses, or trading data.
 * Updates are detected by the browser; application data always comes from the network.
 */
self.addEventListener('install', () => {
  // Activate the new worker without introducing a stale offline app shell.
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(self.clients.claim());
});
