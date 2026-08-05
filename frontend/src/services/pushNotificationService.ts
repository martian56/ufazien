import notificationsApi from '../lib/api/endpoints/notifications';

// Push notification service for handling browser push notifications

/** ArrayBuffer to base64, for the push subscription keys. */
function encodeKey(key: ArrayBuffer | null): string {
  if (!key) return ''
  return btoa(String.fromCharCode(...new Uint8Array(key)))
}

class PushNotificationService {
  registration: ServiceWorkerRegistration | null = null;
  subscription: PushSubscription | null = null;
  isSupported: boolean;

  constructor() {
    this.registration = null;
    this.subscription = null;
    this.isSupported = 'serviceWorker' in navigator && 'PushManager' in window;
  }

  /**
   * Check if push notifications are supported.
   * Renamed from isSupported: a method and a field cannot share a name, and
   * the field shadowed the method anyway.
   */
  checkSupported() {
    return this.isSupported;
  }

  /**
   * Initialize service worker and check existing subscription
   */
  async initialize() {
    if (!this.isSupported) {
      console.warn('Push notifications are not supported in this browser');
      return false;
    }

    try {
      // Register service worker with better error handling
      this.registration = await navigator.serviceWorker.register('/sw.js', {
        scope: '/'
      });
      

      // Wait for service worker to be ready
      await navigator.serviceWorker.ready;

      // Listen for service worker messages
      navigator.serviceWorker.addEventListener('message', this.handleServiceWorkerMessage.bind(this));

      // Check if already subscribed
      this.subscription = (await this.registration?.pushManager.getSubscription()) ?? null;
      
      return true;
    } catch (error) {
      console.error('Service Worker registration failed:', error);
      return false;
    }
  }

  /**
   * Handle messages from service worker
   */
  handleServiceWorkerMessage(event: MessageEvent) {
    const { data } = event;
    
    if (data.type === 'SYNC_NOTIFICATIONS') {
      // Trigger notification sync in main app
      window.dispatchEvent(new CustomEvent('sync-notifications'));
    }
  }

  /**
   * Request notification permission from user
   */
  async requestPermission() {
    if (!this.isSupported) return false;

    const permission = await Notification.requestPermission();
    return permission === 'granted';
  }

  /**
   * Subscribe to push notifications
   */
  async subscribe() {
    if (!this.registration) {
      await this.initialize();
    }

    if (!this.registration) {
      throw new Error('Service Worker not registered');
    }

    try {
      // Get VAPID public key from backend
      const { publicKey } = await notificationsApi.getVapidKey();

      // Subscribe to push notifications
      this.subscription = await this.registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: this.urlBase64ToUint8Array(publicKey)
      });

      // Send subscription to backend
      await this.sendSubscriptionToBackend(this.subscription);

      return this.subscription;
    } catch (error) {
      console.error('Failed to subscribe to push notifications:', error);
      throw error;
    }
  }

  /**
   * Unsubscribe from push notifications
   */
  async unsubscribe() {
    if (!this.subscription) return;

    try {
      // Unsubscribe from browser
      await this.subscription.unsubscribe();
      
      // Remove subscription from backend
      await this.removeSubscriptionFromBackend(this.subscription);
      
      this.subscription = null;
    } catch (error) {
      console.error('Failed to unsubscribe from push notifications:', error);
      throw error;
    }
  }

  /**
   * Check if currently subscribed
   */
  isSubscribed() {
    return this.subscription !== null;
  }

  /**
   * Get current subscription status
   */
  async getSubscriptionStatus() {
    if (!this.registration) {
      await this.initialize();
    }

    if (this.registration) {
      this.subscription = (await this.registration?.pushManager.getSubscription()) ?? null;
    }

    return {
      supported: this.isSupported,
      subscribed: this.isSubscribed(),
      permission: Notification.permission
    };
  }

  /**
   * Send subscription details to backend
   */
  async sendSubscriptionToBackend(subscription: any) {
    const subscriptionData = {
      endpoint: subscription.endpoint,
      auth: encodeKey(subscription.getKey('auth')),
      p256dh: encodeKey(subscription.getKey('p256dh'))
    };

    await notificationsApi.subscribePush(subscriptionData);
  }

  /**
   * Remove subscription from backend
   */
  async removeSubscriptionFromBackend(subscription: any) {
    await notificationsApi.unsubscribePush(subscription.endpoint);
  }

  /**
   * Convert VAPID key to Uint8Array
   */
  urlBase64ToUint8Array(base64String: string) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
      .replace(/-/g, '+')
      .replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  }

  /**
   * Show a test notification
   */
  async showTestNotification() {
    if (Notification.permission === 'granted') {
      new Notification('UFAZIEN Test Notification', {
        body: 'Push notifications are working correctly!',
        icon: '/icon-192x192.png',
        badge: '/badge-72x72.png'
      });
    }
  }
}

// Create singleton instance
const pushNotificationService = new PushNotificationService();

export default pushNotificationService;
