// Notifications API service
const API_URL = import.meta.env.VITE_API_URL;

class NotificationsAPI {
  constructor() {
    this.baseUrl = `${API_URL}/api/notifications`;
  }

  /**
   * Get authentication headers
   */
  getAuthHeaders() {
    const token = localStorage.getItem('access');
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    };
  }

  /**
   * Fetch user notifications with pagination
   */
  async getNotifications(page = 1, pageSize = 20) {
    try {
      const response = await fetch(
        `${this.baseUrl}/?page=${page}&page_size=${pageSize}`,
        {
          headers: this.getAuthHeaders()
        }
      );

      if (!response.ok) {
        throw new Error('Failed to fetch notifications');
      }

      return await response.json();
    } catch (error) {
      console.error('Error fetching notifications:', error);
      throw error;
    }
  }

  /**
   * Get unread notification count
   */
  async getUnreadCount() {
    try {
      const response = await fetch(`${this.baseUrl}/count/`, {
        headers: this.getAuthHeaders()
      });

      if (!response.ok) {
        throw new Error('Failed to fetch unread count');
      }

      const data = await response.json();
      return data.unread_count;
    } catch (error) {
      console.error('Error fetching unread count:', error);
      return 0;
    }
  }

  /**
   * Mark notifications as read
   */
  async markAsRead(notificationIds = []) {
    try {
      const response = await fetch(`${this.baseUrl}/mark-read/`, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify({
          notification_ids: notificationIds
        })
      });

      if (!response.ok) {
        throw new Error('Failed to mark notifications as read');
      }

      return await response.json();
    } catch (error) {
      console.error('Error marking notifications as read:', error);
      throw error;
    }
  }

  /**
   * Mark all notifications as read
   */
  async markAllAsRead() {
    return this.markAsRead([]);
  }

  /**
   * Get notification preferences
   */
  async getPreferences() {
    try {
      const response = await fetch(`${this.baseUrl}/preferences/`, {
        headers: this.getAuthHeaders()
      });

      if (!response.ok) {
        throw new Error('Failed to fetch preferences');
      }

      return await response.json();
    } catch (error) {
      console.error('Error fetching preferences:', error);
      throw error;
    }
  }

  /**
   * Update notification preferences
   */
  async updatePreferences(preferences) {
    try {
      const response = await fetch(`${this.baseUrl}/preferences/`, {
        method: 'PUT',
        headers: this.getAuthHeaders(),
        body: JSON.stringify(preferences)
      });

      if (!response.ok) {
        throw new Error('Failed to update preferences');
      }

      return await response.json();
    } catch (error) {
      console.error('Error updating preferences:', error);
      throw error;
    }
  }

  /**
   * Get VAPID public key for push notifications
   */
  async getVapidKey() {
    try {
      const response = await fetch(`${this.baseUrl}/vapid-key/`, {
        headers: this.getAuthHeaders()
      });

      if (!response.ok) {
        throw new Error('Failed to get VAPID key');
      }

      return await response.json();
    } catch (error) {
      console.error('Error fetching VAPID key:', error);
      throw error;
    }
  }

  /**
   * Subscribe to push notifications
   */
  async subscribePush(subscription) {
    try {
      const response = await fetch(`${this.baseUrl}/subscribe-push/`, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify(subscription)
      });

      if (!response.ok) {
        throw new Error('Failed to subscribe to push notifications');
      }

      return await response.json();
    } catch (error) {
      console.error('Error subscribing to push notifications:', error);
      throw error;
    }
  }

  /**
   * Unsubscribe from push notifications
   */
  async unsubscribePush(endpoint) {
    try {
      const response = await fetch(`${this.baseUrl}/unsubscribe-push/`, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify({ endpoint })
      });

      if (!response.ok) {
        throw new Error('Failed to unsubscribe from push notifications');
      }

      return await response.json();
    } catch (error) {
      console.error('Error unsubscribing from push notifications:', error);
      throw error;
    }
  }
}

// Create singleton instance
const notificationsAPI = new NotificationsAPI();

export default notificationsAPI;
