// Service Worker for handling push notifications
const CACHE_NAME = 'ufazien-v1';

// Minimal caching - only cache the service worker itself and critical assets
const criticalAssets = [
  '/',
  '/favicon.ico'
];

// Install event - minimal caching to avoid deployment issues
self.addEventListener('install', (event) => {
  console.log('Service Worker installing...');
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Caching critical assets...');
        // Try to cache critical assets, but don't fail if they don't exist
        return Promise.allSettled(
          criticalAssets.map(url => 
            fetch(url).then(response => {
              if (response.ok) {
                return cache.put(url, response);
              }
            }).catch(error => {
              console.warn(`Skipping cache for ${url}:`, error.message);
            })
          )
        );
      })
      .then(() => {
        console.log('Service Worker installed successfully');
        return self.skipWaiting(); // Activate immediately
      })
      .catch(error => {
        console.error('Service Worker installation failed:', error);
      })
  );
});

// Fetch event - simplified for production deployment
self.addEventListener('fetch', (event) => {
  // Only handle same-origin GET requests
  if (!event.request.url.startsWith(self.location.origin) || event.request.method !== 'GET') {
    return;
  }

  // For navigation requests, try network first, fallback to cache
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .catch(() => caches.match('/') || new Response('App is offline', { 
          status: 503, 
          statusText: 'Service Unavailable' 
        }))
    );
    return;
  }

  // For other requests, try cache first, then network
  event.respondWith(
    caches.match(event.request)
      .then(response => response || fetch(event.request))
      .catch(() => new Response('Resource unavailable', { 
        status: 503, 
        statusText: 'Service Unavailable' 
      }))
  );
});

// Push event - handle incoming push notifications
self.addEventListener('push', (event) => {
  console.log('Push notification received:', event);

  let notificationData = {
    title: 'UFAZIEN Notification',
    body: 'You have a new notification',
    icon: '/favicon.ico',
    badge: '/favicon.ico',
    tag: 'default',
    data: {
      url: '/notifications'
    },
    actions: [
      {
        action: 'view',
        title: 'View',
        icon: '/favicon.ico'
      },
      {
        action: 'close',
        title: 'Close',
        icon: '/favicon.ico'
      }
    ],
    requireInteraction: false,
    silent: false
  };

  // Parse push data if available
  if (event.data) {
    try {
      const pushData = event.data.json();
      notificationData = {
        ...notificationData,
        ...pushData,
        data: {
          ...notificationData.data,
          ...(pushData.data || {})
        }
      };
    } catch (error) {
      console.error('Error parsing push data:', error);
      notificationData.body = event.data.text() || notificationData.body;
    }
  }

  // Show notification
  const promiseChain = self.registration.showNotification(
    notificationData.title,
    {
      body: notificationData.body,
      icon: notificationData.icon,
      badge: notificationData.badge,
      tag: notificationData.tag,
      data: notificationData.data,
      actions: notificationData.actions,
      requireInteraction: notificationData.requireInteraction,
      silent: notificationData.silent,
      vibrate: [200, 100, 200], // Vibration pattern
      timestamp: Date.now()
    }
  );

  event.waitUntil(promiseChain);
});

// Notification click event - handle user interaction
self.addEventListener('notificationclick', (event) => {
  console.log('Notification clicked:', event);

  event.notification.close();

  // Handle action clicks
  if (event.action === 'close') {
    return;
  }

  // Determine URL to open
  let urlToOpen = '/notifications';
  
  if (event.notification.data && event.notification.data.url) {
    urlToOpen = event.notification.data.url;
  }

  if (event.action === 'view') {
    urlToOpen = event.notification.data?.url || '/notifications';
  }

  // Open/focus the app
  const promiseChain = clients.matchAll({
    type: 'window',
    includeUncontrolled: true
  }).then((clientList) => {
    // Check if app is already open
    for (let i = 0; i < clientList.length; i++) {
      const client = clientList[i];
      const clientUrl = new URL(client.url);
      
      if (clientUrl.hostname === self.location.hostname) {
        // Focus existing window and navigate to notification
        return client.navigate(urlToOpen).then(() => client.focus());
      }
    }
    
    // Open new window if app is not open
    if (clients.openWindow) {
      return clients.openWindow(urlToOpen);
    }
  });

  event.waitUntil(promiseChain);
});

// Background sync for offline actions
self.addEventListener('sync', (event) => {
  if (event.tag === 'notification-sync') {
    event.waitUntil(syncNotifications());
  }
});

// Sync notifications when back online
async function syncNotifications() {
  try {
    // We can't access localStorage from service worker
    // Instead, we'll rely on the main app to handle notification syncing
    console.log('Background sync triggered - notification sync requested');
    
    // Send a message to all clients to sync notifications
    const clients = await self.clients.matchAll();
    clients.forEach(client => {
      client.postMessage({
        type: 'SYNC_NOTIFICATIONS',
        timestamp: Date.now()
      });
    });
  } catch (error) {
    console.error('Failed to sync notifications:', error);
  }
}

// Handle service worker updates
self.addEventListener('activate', (event) => {
  console.log('Service Worker activating...');
  
  event.waitUntil(
    Promise.all([
      // Clean up old caches
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== CACHE_NAME) {
              console.log('Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      }),
      // Take control of all clients immediately
      self.clients.claim()
    ]).then(() => {
      console.log('Service Worker activated successfully');
    })
  );
});

// Error handling
self.addEventListener('error', (event) => {
  console.error('Service Worker error:', event.error);
});

self.addEventListener('unhandledrejection', (event) => {
  console.error('Service Worker unhandled rejection:', event.reason);
});

console.log('Service Worker loaded successfully');
