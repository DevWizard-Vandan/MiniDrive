/**
 * MiniDrive Service Worker
 * 
 * Provides offline support with caching strategies:
 * - Cache-first for static assets (JS, CSS, images)
 * - Network-first for API calls
 * - Stale-while-revalidate for folder structure
 */

const CACHE_NAME = 'sanchaycloud-v1';
const STATIC_CACHE = 'sanchaycloud-static-v1';
const API_CACHE = 'sanchaycloud-api-v1';

// Static assets to cache on install
const STATIC_ASSETS = [
    '/',
    '/index.html',
    '/manifest.json',
    '/favicon.ico',
    '/logo192.png',
    '/logo512.png'
];

// API routes to cache for offline access
const CACHEABLE_API_ROUTES = [
    '/api/drive/content',
    '/api/drive/stats'
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
    console.log('[SW] Installing...');
    event.waitUntil(
        caches.open(STATIC_CACHE)
            .then((cache) => {
                console.log('[SW] Caching static assets');
                return cache.addAll(STATIC_ASSETS);
            })
            .then(() => self.skipWaiting())
    );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
    console.log('[SW] Activating...');
    event.waitUntil(
        caches.keys()
            .then((keys) => {
                return Promise.all(
                    keys
                        .filter((key) => key !== STATIC_CACHE && key !== API_CACHE)
                        .map((key) => {
                            console.log('[SW] Deleting old cache:', key);
                            return caches.delete(key);
                        })
                );
            })
            .then(() => self.clients.claim())
    );
});

// Fetch event - implement caching strategies
self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);

    // Skip non-GET requests
    if (request.method !== 'GET') return;

    // Skip cross-origin requests
    if (url.origin !== location.origin) return;

    // API requests - Network first, cache fallback
    if (url.pathname.startsWith('/api/')) {
        event.respondWith(networkFirst(request));
        return;
    }

    // Static assets - Cache first
    event.respondWith(cacheFirst(request));
});

/**
 * Cache-first strategy for static assets.
 */
async function cacheFirst(request) {
    const cached = await caches.match(request);
    if (cached) {
        return cached;
    }

    try {
        const response = await fetch(request);
        if (response.ok) {
            const cache = await caches.open(STATIC_CACHE);
            cache.put(request, response.clone());
        }
        return response;
    } catch (error) {
        // Return offline fallback for navigation requests
        if (request.mode === 'navigate') {
            return caches.match('/index.html');
        }
        throw error;
    }
}

/**
 * Network-first strategy for API calls.
 */
async function networkFirst(request) {
    try {
        const response = await fetch(request);

        // Cache successful GET responses
        if (response.ok && isCacheableApiRoute(request.url)) {
            const cache = await caches.open(API_CACHE);
            cache.put(request, response.clone());
        }

        return response;
    } catch (error) {
        // Fall back to cache
        const cached = await caches.match(request);
        if (cached) {
            console.log('[SW] Serving from cache (offline):', request.url);
            return cached;
        }

        // Return offline response for known API routes
        return new Response(
            JSON.stringify({ error: 'Offline', cached: false }),
            {
                status: 503,
                headers: { 'Content-Type': 'application/json' }
            }
        );
    }
}

/**
 * Check if an API route should be cached.
 */
function isCacheableApiRoute(url) {
    return CACHEABLE_API_ROUTES.some(route => url.includes(route));
}

// Listen for messages from the app
self.addEventListener('message', (event) => {
    if (event.data === 'SKIP_WAITING') {
        self.skipWaiting();
    }

    if (event.data === 'CLEAR_CACHE') {
        caches.keys().then((keys) => {
            keys.forEach((key) => caches.delete(key));
        });
    }
});

// Background sync for offline uploads (if supported)
self.addEventListener('sync', (event) => {
    if (event.tag === 'upload-sync') {
        console.log('[SW] Background sync: upload-sync');
        // Future: implement offline upload queue
    }
});

// Push notifications (if needed later)
self.addEventListener('push', (event) => {
    if (event.data) {
        const data = event.data.json();
        self.registration.showNotification(data.title, {
            body: data.body,
            icon: '/logo192.png',
            badge: '/favicon.ico'
        });
    }
});
