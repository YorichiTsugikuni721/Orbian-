// =============================================
// ORBIAN AI — Service Worker (PWA)
// =============================================

const CACHE_NAME = 'orbian-ai-v4';

// Files to cache for offline use
const STATIC_ASSETS = [
    '/',
    '/app',
    '/orbian-live',
    '/ppt-studio',
    '/developer',
    '/pricing',
    '/about',
    '/privacy',
    '/auth/login',
    '/auth/account',
    '/styles.css',
    '/script.js',
    '/charts.js',
    '/logo.png',
    '/manifest.json'
];

// ── INSTALL: Cache core assets ──
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            console.log('[SW] Caching core assets...');
            return cache.addAll(STATIC_ASSETS);
        }).catch((err) => {
            console.warn('[SW] Some assets failed to cache:', err);
        })
    );
    self.skipWaiting();
});

// ── ACTIVATE: Clean old caches ──
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) =>
            Promise.all(
                keys
                    .filter((key) => key !== CACHE_NAME)
                    .map((key) => {
                        console.log('[SW] Deleting old cache:', key);
                        return caches.delete(key);
                    })
            )
        )
    );
    self.clients.claim();
});

// ── FETCH: Network first, cache fallback ──
self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    // Don't intercept: API calls, external requests, POST requests
    if (
        url.hostname !== self.location.hostname ||
        url.pathname.startsWith('/api/') ||
        event.request.method !== 'GET'
    ) {
        return;
    }

    event.respondWith(
        fetch(event.request)
            .then((response) => {
                // Cache successful responses
                if (response && response.status === 200) {
                    const cloned = response.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(event.request, cloned);
                    });
                }
                return response;
            })
            .catch(() => {
                // Network failed → serve from cache
                return caches.match(event.request).then((cached) => {
                    if (cached) return cached;
                    // Fallback for navigation requests
                    if (event.request.mode === 'navigate') {
                        return caches.match('/app');
                    }
                });
            })
    );
});

// ── PUSH NOTIFICATIONS (future use) ──
self.addEventListener('push', (event) => {
    const data = event.data?.json() || {};
    self.registration.showNotification(data.title || 'Orbian AI', {
        body: data.body || 'You have a new message.',
        icon: '/logo.png',
        badge: '/logo.png',
        vibrate: [200, 100, 200]
    });
});
