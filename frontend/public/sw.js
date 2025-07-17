// Service Worker for handling push notifications
const CACHE_NAME = 'ufazien-v1';
const urlsToCache = [
  '/',
  '/static/js/bundle.js',
  '/static/css/main.css',
  '/icon-192x192.png',
  '/icon-512x512.png'
];

// Install event - cache resources
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        return cache.addAll(urlsToCache);
      })
  );
});

// Fetch event - serve from cache when offline
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // Return cached version or fetch from network
        return response || fetch(event.request);
      })
  );
});

// Push event - handle incoming push notifications
self.addEventListener('push', (event) => {
  console.log('Push notification received:', event);

  let notificationData = {
    title: 'UFAZIEN Notification',
    body: 'You have a new notification',
    icon: '/icon-192x192.png',
    badge: '/badge-72x72.png',
    tag: 'default',
    data: {
      url: '/notifications'
    },
    actions: [
      {
        action: 'view',
        title: 'View',
        icon: '/icon-view.png'
      },
      {
        action: 'close',
        title: 'Close',
        icon: '/icon-close.png'
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
    // Fetch missed notifications
    const response = await fetch('/api/notifications/', {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('access')}`
      }
    });
    
    if (response.ok) {
      const data = await response.json();
      console.log('Synced notifications:', data);
    }
  } catch (error) {
    console.error('Failed to sync notifications:', error);
  }
}

// Handle service worker updates
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
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
