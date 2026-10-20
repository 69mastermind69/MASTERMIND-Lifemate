
"use strict";

const CACHE_NAME = "lifemate-mastermind-v3";

const APP_FILES = [
  "./",
  "./index.html",
  "./style.css",
  "./app.js",
  "./manifest.json",
  "./icon.svg",
  "./qrcode.min.js"
];

/* Install: cache the app shell for offline use */
self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(APP_FILES))
      .then(() => self.skipWaiting())
  );
});

/* Activate: remove older LifeMate caches */
self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys =>
        Promise.all(
          keys
            .filter(key =>
              key.startsWith("lifemate-mastermind-") &&
              key !== CACHE_NAME
            )
            .map(key => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

/* Allow the page to request immediate activation */
self.addEventListener("message", event => {
  if (event.data === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

/* Offline-first navigation and local asset handling */
self.addEventListener("fetch", event => {
  const request = event.request;

  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // Do not intercept external websites or requests.
  if (url.origin !== self.location.origin) return;

  // Navigation: try the network, then use the cached app page.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then(response => {
          if (response && response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then(cache =>
              cache.put("./index.html", copy)
            );
          }
          return response;
        })
        .catch(async () => {
          const cache = await caches.open(CACHE_NAME);
          return (
            await cache.match(request) ||
            await cache.match("./index.html") ||
            await cache.match("./")
          );
        })
    );
    return;
  }

  // Local app assets: cache first, then network.
  event.respondWith(
    caches.match(request).then(cachedResponse => {
      if (cachedResponse) return cachedResponse;

      return fetch(request).then(response => {
        if (response && response.ok && response.type === "basic") {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache =>
            cache.put(request, copy)
          );
        }
        return response;
      });
    })
  );
});
