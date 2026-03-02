const CACHE_NAME = 'ai-assistant-test-v1';
const ASSETS_TO_CACHE = [
    './',
    './app',
    './styles.css',
    './script.js'
];

// 1. Install Event (Cache Assets)
self.addEventListener('install', (event) => {
    console.log('[Service Worker] Installing...');
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            console.log('[Service Worker] Caching all assets');
            return cache.addAll(ASSETS_TO_CACHE);
        })
    );
});

// 2. Activate Event (Cleanup Old Caches)
self.addEventListener('activate', (event) => {
    console.log('[Service Worker] Activating...');
    event.waitUntil(
        caches.keys().then((keyList) => {
            return Promise.all(keyList.map((key) => {
                if (key !== CACHE_NAME) {
                    console.log('[Service Worker] Removing old cache', key);
                    return caches.delete(key);
                }
            }));
        })
    );
    return self.clients.claim();
});

// 3. Fetch Event (Network First, Fallback to Cache)
self.addEventListener('fetch', (event) => {
    // console.log('[Service Worker] Fetching resource:', event.request.url);
    event.respondWith(
        fetch(event.request)
            .catch(() => {
                return caches.match(event.request);
            })
    );
});
