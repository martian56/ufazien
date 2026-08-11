import { useState, useEffect } from 'react';
import { Bell, X, Check, Settings, Trash2, ExternalLink } from 'lucide-react';
import notificationsAPI from '../lib/api/endpoints/notifications';
import pushNotificationService from '../services/pushNotificationService';
import { useToast, ToastContainer } from '../hooks/useToast';
import type { Notification, NotificationPreferences } from '../lib/api/endpoints/notifications';
import Switch from "./ui/Switch"
import NotificationIcon from "../features/notifications/NotificationIcon"

interface NotificationDropdownProps {
  unreadCount: number
  onCountUpdate: (count: number) => void
}

export default function NotificationDropdown({ unreadCount, onCountUpdate }: NotificationDropdownProps) {
  const { notifications: toastNotifications, toast, removeNotification } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  const [showPreferences, setShowPreferences] = useState(false);
  const [pushEnabled, setPushEnabled] = useState(false);
  const [preferences, setPreferences] = useState<Partial<NotificationPreferences>>({});

  useEffect(() => {
    if (isOpen && notifications.length === 0) {
      fetchNotifications();
    }
    checkPushStatus();
  }, [isOpen]);

  const fetchNotifications = async () => {
    setLoading(true);
    try {
      const data = await notificationsAPI.getNotifications(1, 10);
      setNotifications(data.results || []);
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  const checkPushStatus = async () => {
    try {
      const status = await pushNotificationService.getSubscriptionStatus();
      setPushEnabled(status.subscribed && status.permission === 'granted');
    } catch (error) {
      console.error('Failed to check push status:', error);
    }
  };

  const markAsRead = async (notificationId: number) => {
    try {
      await notificationsAPI.markAsRead([notificationId]);
      setNotifications(prev => 
        prev.map(n => n.id === notificationId ? { ...n, is_read: true } : n)
      );
      if (onCountUpdate) {
        const { count } = await notificationsAPI.getUnreadCount();
        onCountUpdate(count);
      }
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      await notificationsAPI.markAllAsRead();
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      if (onCountUpdate) {
        onCountUpdate(0);
      }
    } catch (error) {
      console.error('Failed to mark all as read:', error);
    }
  };

  const togglePushNotifications = async () => {
    try {
      if (pushEnabled) {
        await pushNotificationService.unsubscribe();
        setPushEnabled(false);
        toast.success('Push notifications disabled');
      } else {
        const hasPermission = await pushNotificationService.requestPermission();
        if (hasPermission) {
          await pushNotificationService.subscribe();
          setPushEnabled(true);
          toast.success('Push notifications enabled');
        } else {
          toast.error('Push notification permission denied. Please enable in browser settings.');
        }
      }
    } catch (error) {
      console.error('Failed to toggle push notifications:', error);
      toast.error('Failed to update push notification settings');
    }
  };

  const getTimeAgo = (dateString: string) => {
    const diffInSeconds = Math.floor((Date.now() - new Date(dateString).getTime()) / 1000);

    if (diffInSeconds < 60) return 'just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
    return `${Math.floor(diffInSeconds / 86400)}d ago`;
  };

  return (
    <div className="relative">
      {/* Notification Bell Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Notification Dropdown */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />

      {/* Dropdown Content (responsive)
        - On small screens: fixed and centered (inset-x) so it doesn't overflow
        - On sm+ screens: positioned absolute at the right as before
      */}
          <div className="fixed inset-x-4 top-20 sm:absolute sm:inset-auto sm:right-0 sm:mt-2 w-auto sm:w-96 bg-white rounded-lg shadow-lg border border-gray-200 z-50">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Notifications</h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowPreferences(!showPreferences)}
                  className="p-1 text-gray-400 hover:text-gray-600 rounded"
                  title="Settings"
                >
                  <Settings className="w-4 h-4" />
                </button>
                {notifications.some(n => !n.is_read) && (
                  <button
                    onClick={markAllAsRead}
                    className="p-1 text-gray-400 hover:text-gray-600 rounded"
                    title="Mark all as read"
                  >
                    <Check className="w-4 h-4" />
                  </button>
                )}
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-1 text-gray-400 hover:text-gray-600 rounded"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Preferences Panel */}
            {showPreferences && (
              <div className="p-4 border-b border-gray-200 bg-gray-50">
                <h4 className="text-sm font-medium text-gray-900 mb-3">Notification Settings</h4>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-700">Push Notifications</span>
                  <Switch
                    checked={pushEnabled}
                    onCheckedChange={togglePushNotifications}
                    aria-label="Push notifications"
                  />
                </div>
              </div>
            )}

            {/* Notifications List */}
            <div className="max-h-[70vh] sm:max-h-96 overflow-y-auto">
              {loading ? (
                <div className="p-4 text-center text-gray-500">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto mb-2"></div>
                  Loading notifications...
                </div>
              ) : notifications.length === 0 ? (
                <div className="p-8 text-center text-gray-500">
                  <Bell className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                  <p>No notifications yet</p>
                  <p className="text-sm">You'll see new notifications here</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {notifications.map((notification) => (
                    <div
                      key={notification.id}
                      className={`p-4 hover:bg-gray-50 transition-colors ${
                        !notification.is_read ? 'bg-blue-50 border-l-4 border-l-blue-500' : ''
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        {/* Notification Icon */}
                        <NotificationIcon type={notification.notification_type} size="sm" />

                        {/* Notification Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <p className="text-sm font-medium text-gray-900">
                                {notification.title}
                              </p>
                              <p className="text-sm text-gray-600 mt-1">
                                {notification.message}
                              </p>
                              <p className="text-xs text-gray-400 mt-2">
                                {getTimeAgo(notification.created_at)}
                              </p>
                            </div>

                            {/* Actions */}
                            <div className="flex items-center gap-1 ml-2">
                              {!notification.is_read && (
                                <button
                                  onClick={() => markAsRead(notification.id)}
                                  className="p-1 text-gray-400 hover:text-green-600 rounded"
                                  title="Mark as read"
                                >
                                  <Check className="w-3 h-3" />
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-3 border-t border-gray-200 bg-gray-50">
              <button
                onClick={() => {
                  setIsOpen(false);
                  // Navigate to notifications page
                  window.location.href = '/notifications';
                }}
                className="w-full text-center text-sm text-blue-600 hover:text-blue-700 font-medium"
              >
                View All Notifications
              </button>
            </div>
          </div>
        </>
      )}
      
      {/* Toast Notifications */}
      <ToastContainer 
        notifications={toastNotifications} 
        removeNotification={removeNotification} 
      />
    </div>
  );
}
