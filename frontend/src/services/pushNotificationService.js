// Push notification service for handling browser push notifications
class PushNotificationService {
  constructor() {
    this.registration = null;
    this.subscription = null;
    this.isSupported = 'serviceWorker' in navigator && 'PushManager' in window;
    this.apiUrl = import.meta.env.VITE_API_URL;
  }

  /**
   * Check if push notifications are supported
   */
  isSupported() {
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
      // Register service worker
      this.registration = await navigator.serviceWorker.register('/sw.js');
      console.log('Service Worker registered successfully');

      // Check if already subscribed
      this.subscription = await this.registration.pushManager.getSubscription();
      
      return true;
    } catch (error) {
      console.error('Service Worker registration failed:', error);
      return false;
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
      const response = await fetch(`${this.apiUrl}/api/notifications/vapid-key/`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('access')}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to get VAPID key');
      }

      const { publicKey } = await response.json();

      // Subscribe to push notifications
      this.subscription = await this.registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: this.urlBase64ToUint8Array(publicKey)
      });

      // Send subscription to backend
      await this.sendSubscriptionToBackend(this.subscription);

      console.log('Successfully subscribed to push notifications');
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
      console.log('Successfully unsubscribed from push notifications');
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
      this.subscription = await this.registration.pushManager.getSubscription();
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
  async sendSubscriptionToBackend(subscription) {
    const subscriptionData = {
      endpoint: subscription.endpoint,
      auth: btoa(String.fromCharCode.apply(null, new Uint8Array(subscription.getKey('auth')))),
      p256dh: btoa(String.fromCharCode.apply(null, new Uint8Array(subscription.getKey('p256dh'))))
    };

    const response = await fetch(`${this.apiUrl}/api/notifications/push/subscribe/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('access')}`
      },
      body: JSON.stringify(subscriptionData)
    });

    if (!response.ok) {
      throw new Error('Failed to save subscription to backend');
    }
  }

  /**
   * Remove subscription from backend
   */
  async removeSubscriptionFromBackend(subscription) {
    const response = await fetch(`${this.apiUrl}/api/notifications/push/unsubscribe/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('access')}`
      },
      body: JSON.stringify({ endpoint: subscription.endpoint })
    });

    if (!response.ok) {
      throw new Error('Failed to remove subscription from backend');
    }
  }

  /**
   * Convert VAPID key to Uint8Array
   */
  urlBase64ToUint8Array(base64String) {
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
