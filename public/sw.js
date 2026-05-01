/**
 * Service Worker — QuotingAgent PWA
 * Stack contract: frontend.pwa=true, mobile_first=true
 *
 * Strategy:
 * - App shell (HTML, CSS, JS): StaleWhileRevalidate
 * - API calls: NetworkFirst (fresh data preferred)
 * - Images/photos: CacheFirst (GCS photos are immutable)
 * - Offline fallback: cached app shell
 */

const CACHE_VERSION = "v1";
const APP_SHELL_CACHE = `qa-shell-${CACHE_VERSION}`;
const API_CACHE = `qa-api-${CACHE_VERSION}`;

const APP_SHELL_URLS = [
  "/",
  "/leads",
  "/manifest.json",
];

// ---------------------------------------------------------------------------
// Install — pre-cache app shell
// ---------------------------------------------------------------------------
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(APP_SHELL_CACHE).then((cache) =>
      cache.addAll(APP_SHELL_URLS)
    )
  );
  self.skipWaiting();
});

// ---------------------------------------------------------------------------
// Activate — clean old caches
// ---------------------------------------------------------------------------
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter(
            (key) =>
              key !== APP_SHELL_CACHE && key !== API_CACHE
          )
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// ---------------------------------------------------------------------------
// Fetch — routing strategy
// ---------------------------------------------------------------------------
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests and cross-origin
  if (request.method !== "GET") return;
  if (url.origin !== self.location.origin) return;

  // API routes — NetworkFirst
  if (url.pathname.startsWith("/api/")) {
    event.respondWith(networkFirst(request, API_CACHE));
    return;
  }

  // Static assets (_next/static) — CacheFirst
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(cacheFirst(request, APP_SHELL_CACHE));
    return;
  }

  // App pages — StaleWhileRevalidate
  event.respondWith(staleWhileRevalidate(request, APP_SHELL_CACHE));
});

// ---------------------------------------------------------------------------
// Push notifications — FR-032
// ---------------------------------------------------------------------------
self.addEventListener("push", (event) => {
  if (!event.data) return;

  let payload;
  try {
    payload = event.data.json();
  } catch {
    payload = { title: "QuotingAgent", body: event.data.text() };
  }

  const { title = "QuotingAgent", body = "", url = "/" } = payload;

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      data: { url },
      tag: "quotingagent-notification",
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url ?? "/";
  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clients) => {
        const existing = clients.find((c) => c.url === url);
        if (existing) return existing.focus();
        return self.clients.openWindow(url);
      })
  );
});

// ---------------------------------------------------------------------------
// Cache strategies
// ---------------------------------------------------------------------------
async function networkFirst(request, cacheName) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    return cached ?? new Response(JSON.stringify({ error: "Offline" }), {
      status: 503,
      headers: { "Content-Type": "application/json" },
    });
  }
}

async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) {
    const cache = await caches.open(cacheName);
    cache.put(request, response.clone());
  }
  return response;
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);

  const fetchPromise = fetch(request)
    .then((response) => {
      if (response.ok) cache.put(request, response.clone());
      return response;
    })
    .catch(() => null);

  return cached ?? (await fetchPromise) ?? new Response("Offline", { status: 503 });
}
