/**
 * Service Worker for Warehouse Scanner PWA
 * Provides offline functionality and caching
 */

const CACHE_NAME = 'warehouse-scanner-v1.0.0';
const STATIC_CACHE_NAME = 'warehouse-scanner-static-v1.0.0';

// Files to cache for offline functionality
const STATIC_FILES = [
    './',
    './index.html',
    './styles.css',
    './scanner.js',
    './workflows.js',
    './data.js',
    './app.js',
    './test-barcodes.html',
    './manifest.json',
    'https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css',
    'https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js'
];

// Runtime cache for dynamic content
const RUNTIME_CACHE_NAME = 'warehouse-scanner-runtime-v1.0.0';

/**
 * Service Worker Installation
 */
self.addEventListener('install', event => {
    console.log('Service Worker: Installing...');
    
    event.waitUntil(
        caches.open(STATIC_CACHE_NAME)
            .then(cache => {
                console.log('Service Worker: Caching static files');
                return cache.addAll(STATIC_FILES);
            })
            .then(() => {
                console.log('Service Worker: Static files cached successfully');
                return self.skipWaiting();
            })
            .catch(error => {
                console.error('Service Worker: Failed to cache static files', error);
            })
    );
});

/**
 * Service Worker Activation
 */
self.addEventListener('activate', event => {
    console.log('Service Worker: Activating...');
    
    event.waitUntil(
        caches.keys()
            .then(cacheNames => {
                return Promise.all(
                    cacheNames.map(cacheName => {
                        // Delete old caches
                        if (cacheName !== STATIC_CACHE_NAME && cacheName !== RUNTIME_CACHE_NAME) {
                            console.log('Service Worker: Deleting old cache', cacheName);
                            return caches.delete(cacheName);
                        }
                    })
                );
            })
            .then(() => {
                console.log('Service Worker: Activated successfully');
                return self.clients.claim();
            })
    );
});

/**
 * Fetch Event Handler
 */
self.addEventListener('fetch', event => {
    const { request } = event;
    const url = new URL(request.url);
    
    // Skip non-GET requests
    if (request.method !== 'GET') {
        return;
    }
    
    // Skip chrome-extension and other non-http(s) requests
    if (!url.protocol.startsWith('http')) {
        return;
    }
    
    // Handle different types of requests
    if (STATIC_FILES.includes(url.pathname) || STATIC_FILES.includes(request.url)) {
        // Static files - cache first strategy
        event.respondWith(cacheFirstStrategy(request));
    } else if (url.origin === location.origin) {
        // Same origin - network first strategy
        event.respondWith(networkFirstStrategy(request));
    } else {
        // External resources - cache first strategy
        event.respondWith(cacheFirstStrategy(request));
    }
});

/**
 * Cache First Strategy
 * Try cache first, fallback to network
 */
async function cacheFirstStrategy(request) {
    try {
        const cachedResponse = await caches.match(request);
        if (cachedResponse) {
            return cachedResponse;
        }
        
        const networkResponse = await fetch(request);
        
        // Cache successful responses
        if (networkResponse.status === 200) {
            const cache = await caches.open(RUNTIME_CACHE_NAME);
            cache.put(request, networkResponse.clone());
        }
        
        return networkResponse;
    } catch (error) {
        console.error('Cache first strategy failed:', error);
        
        // Return offline fallback if available
        return getOfflineFallback(request);
    }
}

/**
 * Network First Strategy
 * Try network first, fallback to cache
 */
async function networkFirstStrategy(request) {
    try {
        const networkResponse = await fetch(request);
        
        // Cache successful responses
        if (networkResponse.status === 200) {
            const cache = await caches.open(RUNTIME_CACHE_NAME);
            cache.put(request, networkResponse.clone());
        }
        
        return networkResponse;
    } catch (error) {
        console.log('Network first strategy - network failed, trying cache');
        
        const cachedResponse = await caches.match(request);
        if (cachedResponse) {
            return cachedResponse;
        }
        
        // Return offline fallback
        return getOfflineFallback(request);
    }
}

/**
 * Get offline fallback response
 */
async function getOfflineFallback(request) {
    const url = new URL(request.url);
    
    // For HTML pages, return the main app
    if (request.headers.get('accept')?.includes('text/html')) {
        const cachedApp = await caches.match('./index.html');
        if (cachedApp) {
            return cachedApp;
        }
    }
    
    // For other resources, return a generic offline response
    return new Response(
        JSON.stringify({
            error: 'Offline',
            message: 'This resource is not available offline'
        }),
        {
            status: 503,
            statusText: 'Service Unavailable',
            headers: {
                'Content-Type': 'application/json'
            }
        }
    );
}

/**
 * Background Sync for offline actions
 */
self.addEventListener('sync', event => {
    console.log('Service Worker: Background sync triggered', event.tag);
    
    if (event.tag === 'workflow-sync') {
        event.waitUntil(syncWorkflowData());
    }
});

/**
 * Sync workflow data when back online
 */
async function syncWorkflowData() {
    try {
        // Get pending workflow data from IndexedDB or localStorage
        const pendingData = await getPendingWorkflowData();
        
        if (pendingData && pendingData.length > 0) {
            console.log('Service Worker: Syncing workflow data', pendingData);
            
            // Process each pending workflow action
            for (const data of pendingData) {
                await processWorkflowData(data);
            }
            
            // Clear pending data after successful sync
            await clearPendingWorkflowData();
            
            // Notify the main app
            self.clients.matchAll().then(clients => {
                clients.forEach(client => {
                    client.postMessage({
                        type: 'WORKFLOW_SYNC_COMPLETE',
                        data: pendingData
                    });
                });
            });
        }
    } catch (error) {
        console.error('Service Worker: Failed to sync workflow data', error);
    }
}

/**
 * Get pending workflow data (placeholder implementation)
 */
async function getPendingWorkflowData() {
    // In a real implementation, this would read from IndexedDB
    // For now, return empty array as we're using mock data
    return [];
}

/**
 * Process workflow data (placeholder implementation)
 */
async function processWorkflowData(data) {
    // In a real implementation, this would send data to server
    console.log('Processing workflow data:', data);
    return Promise.resolve();
}

/**
 * Clear pending workflow data (placeholder implementation)
 */
async function clearPendingWorkflowData() {
    // In a real implementation, this would clear IndexedDB
    return Promise.resolve();
}

/**
 * Push notification handler
 */
self.addEventListener('push', event => {
    console.log('Service Worker: Push notification received');
    
    const options = {
        body: 'New warehouse task available',
        icon: './manifest.json',
        badge: './manifest.json',
        vibrate: [200, 100, 200],
        data: {
            dateOfArrival: Date.now(),
            primaryKey: 1
        },
        actions: [
            {
                action: 'open',
                title: 'Open Scanner',
                icon: './manifest.json'
            },
            {
                action: 'close',
                title: 'Dismiss'
            }
        ]
    };
    
    event.waitUntil(
        self.registration.showNotification('Warehouse Scanner', options)
    );
});

/**
 * Notification click handler
 */
self.addEventListener('notificationclick', event => {
    console.log('Service Worker: Notification clicked', event.action);
    
    event.notification.close();
    
    if (event.action === 'open') {
        event.waitUntil(
            self.clients.matchAll().then(clients => {
                // Check if app is already open
                const client = clients.find(c => c.visibilityState === 'visible');
                
                if (client) {
                    client.focus();
                } else {
                    // Open new window/tab
                    self.clients.openWindow('./index.html');
                }
            })
        );
    }
});

/**
 * Message handler for communication with main app
 */
self.addEventListener('message', event => {
    console.log('Service Worker: Message received', event.data);
    
    const { type, data } = event.data;
    
    switch (type) {
        case 'SKIP_WAITING':
            self.skipWaiting();
            break;
            
        case 'CACHE_WORKFLOW_DATA':
            cacheWorkflowData(data);
            break;
            
        case 'GET_CACHE_STATUS':
            getCacheStatus().then(status => {
                event.ports[0].postMessage(status);
            });
            break;
            
        default:
            console.log('Service Worker: Unknown message type', type);
    }
});

/**
 * Cache workflow data for offline use
 */
async function cacheWorkflowData(data) {
    try {
        const cache = await caches.open(RUNTIME_CACHE_NAME);
        const response = new Response(JSON.stringify(data), {
            headers: { 'Content-Type': 'application/json' }
        });
        await cache.put('/workflow-data', response);
        console.log('Service Worker: Workflow data cached');
    } catch (error) {
        console.error('Service Worker: Failed to cache workflow data', error);
    }
}

/**
 * Get cache status information
 */
async function getCacheStatus() {
    try {
        const cacheNames = await caches.keys();
        const status = {
            staticCacheExists: cacheNames.includes(STATIC_CACHE_NAME),
            runtimeCacheExists: cacheNames.includes(RUNTIME_CACHE_NAME),
            totalCaches: cacheNames.length,
            cacheNames: cacheNames
        };
        
        // Get cache sizes
        for (const cacheName of cacheNames) {
            const cache = await caches.open(cacheName);
            const keys = await cache.keys();
            status[`${cacheName}_size`] = keys.length;
        }
        
        return status;
    } catch (error) {
        console.error('Service Worker: Failed to get cache status', error);
        return { error: error.message };
    }
}

/**
 * Periodic background sync (if supported)
 */
if ('periodicSync' in self.registration) {
    self.addEventListener('periodicsync', event => {
        console.log('Service Worker: Periodic sync triggered', event.tag);
        
        if (event.tag === 'workflow-cleanup') {
            event.waitUntil(cleanupOldWorkflowData());
        }
    });
}

/**
 * Cleanup old workflow data
 */
async function cleanupOldWorkflowData() {
    try {
        // Clean up old cache entries
        const cache = await caches.open(RUNTIME_CACHE_NAME);
        const keys = await cache.keys();
        
        // Remove entries older than 24 hours
        const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000);
        
        for (const request of keys) {
            const response = await cache.match(request);
            const dateHeader = response.headers.get('date');
            
            if (dateHeader) {
                const responseDate = new Date(dateHeader).getTime();
                if (responseDate < oneDayAgo) {
                    await cache.delete(request);
                    console.log('Service Worker: Cleaned up old cache entry', request.url);
                }
            }
        }
    } catch (error) {
        console.error('Service Worker: Failed to cleanup old data', error);
    }
}

console.log('Service Worker: Script loaded successfully');