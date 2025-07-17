import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Bell, 
  Check, 
  CheckCheck, 
  Settings, 
    Menu,
  ArrowLeft,
  Filter,
  Trash2,
  ExternalLink
} from 'lucide-react';
import SideBar from '../components/ui/SideBar';
import notificationsAPI from '../services/notificationsAPI';
import pushNotificationService from '../services/pushNotificationService';

export default function NotificationsPage() {
  const navigate = useNavigate();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedFilter, setSelectedFilter] = useState('all');
  const [preferences, setPreferences] = useState({});
  const [showPreferences, setShowPreferences] = useState(false);
  const [pushEnabled, setPushEnabled] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  useEffect(() => {
    const access = localStorage.getItem("access");
    if (!access) {
      navigate("/auth");
      return;
    }

    fetchNotifications();
    fetchPreferences();
    checkPushStatus();
  }, [navigate, selectedFilter]);

  const fetchNotifications = async (pageNum = 1) => {
    setLoading(pageNum === 1);
    try {
      const data = await notificationsAPI.getNotifications(pageNum, 20);
      
      if (pageNum === 1) {
        setNotifications(data.results || []);
      } else {
        setNotifications(prev => [...prev, ...(data.results || [])]);
      }
      
      setHasMore(!!data.next);
      setPage(pageNum);
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchPreferences = async () => {
    try {
      const prefs = await notificationsAPI.getPreferences();
      setPreferences(prefs);
    } catch (error) {
      console.error('Failed to fetch preferences:', error);
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

  const markAsRead = async (notificationId) => {
    try {
      await notificationsAPI.markAsRead([notificationId]);
      setNotifications(prev => 
        prev.map(n => n.id === notificationId ? { ...n, is_read: true } : n)
      );
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      await notificationsAPI.markAllAsRead();
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    } catch (error) {
      console.error('Failed to mark all as read:', error);
    }
  };

  const updatePreferences = async (newPrefs) => {
    try {
      await notificationsAPI.updatePreferences(newPrefs);
      setPreferences(newPrefs);
    } catch (error) {
      console.error('Failed to update preferences:', error);
    }
  };

  const togglePushNotifications = async () => {
    try {
      if (pushEnabled) {
        await pushNotificationService.unsubscribe();
        setPushEnabled(false);
      } else {
        const hasPermission = await pushNotificationService.requestPermission();
        if (hasPermission) {
          await pushNotificationService.subscribe();
          setPushEnabled(true);
        } else {
          alert('Push notification permission denied. Please enable in browser settings.');
        }
      }
    } catch (error) {
      console.error('Failed to toggle push notifications:', error);
      alert('Failed to update push notification settings');
    }
  };

  const filteredNotifications = notifications.filter(notification => {
    if (selectedFilter === 'all') return true;
    if (selectedFilter === 'unread') return !notification.is_read;
    if (selectedFilter === 'read') return notification.is_read;
    return notification.notification_type === selectedFilter;
  });

  const getNotificationIcon = (type) => {
    switch (type) {
      case 'follow':
        return '👤';
      case 'like_post':
      case 'like_comment':
        return '❤️';
      case 'comment':
        return '💬';
      case 'new_post':
        return '📝';
      default:
        return '🔔';
    }
  };

  const getTimeAgo = (dateString) => {
    const now = new Date();
    const time = new Date(dateString);
    const diffInSeconds = Math.floor((now - time) / 1000);

    if (diffInSeconds < 60) return 'just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
    return `${Math.floor(diffInSeconds / 86400)}d ago`;
  };

  const filterOptions = [
    { value: 'all', label: 'All Notifications' },
    { value: 'unread', label: 'Unread' },
    { value: 'read', label: 'Read' },
    { value: 'follow', label: 'Followers' },
    { value: 'like_post', label: 'Likes' },
    { value: 'comment', label: 'Comments' },
    { value: 'new_post', label: 'New Posts' }
  ];

  if (loading && notifications.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading notifications...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar */}
      <SideBar
        isSidebarOpen={isSidebarOpen}
        setIsSidebarOpen={setIsSidebarOpen}
        pageTitle="Notifications"
      />

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="bg-white shadow-sm border-b border-gray-200">
          <div className="flex items-center justify-between h-16 px-4 sm:px-6 lg:px-8">
            <div className="flex items-center gap-4">
              <button 
                onClick={() => setIsSidebarOpen(true)} 
                className="lg:hidden p-2 rounded-md hover:bg-gray-100"
              >
                <Menu className="w-5 h-5" />
              </button>
              <button
                onClick={() => navigate('/dashboard')}
                className="p-2 rounded-md hover:bg-gray-100"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Notifications</h1>
                <p className="text-sm text-gray-500">
                  Manage your notifications and preferences
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowPreferences(!showPreferences)}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                title="Settings"
              >
                <Settings className="w-5 h-5" />
              </button>
              {filteredNotifications.some(n => !n.is_read) && (
                <button
                  onClick={markAllAsRead}
                  className="px-3 py-2 text-sm font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors"
                >
                  Mark All Read
                </button>
              )}
            </div>
          </div>
        </header>

        {/* Preferences Panel */}
        {showPreferences && (
          <div className="bg-white border-b border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Notification Preferences</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {/* Push Notifications */}
              <div className="space-y-4">
                <h4 className="font-medium text-gray-900">Push Notifications</h4>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-700">Browser Push</span>
                  <button
                    onClick={togglePushNotifications}
                    className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                      pushEnabled ? 'bg-blue-600' : 'bg-gray-200'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                        pushEnabled ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
              </div>

              {/* Email Notifications */}
              <div className="space-y-4">
                <h4 className="font-medium text-gray-900">Email Notifications</h4>
                {Object.entries({
                  email_on_follow: 'New Followers',
                  email_on_like: 'Likes',
                  email_on_comment: 'Comments',
                  email_on_new_post: 'New Posts'
                }).map(([key, label]) => (
                  <div key={key} className="flex items-center justify-between">
                    <span className="text-sm text-gray-700">{label}</span>
                    <button
                      onClick={() => updatePreferences({
                        ...preferences,
                        [key]: !preferences[key]
                      })}
                      className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                        preferences[key] ? 'bg-blue-600' : 'bg-gray-200'
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                          preferences[key] ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>
                ))}
              </div>

              {/* Security Notifications */}
              <div className="space-y-4">
                <h4 className="font-medium text-gray-900">Security</h4>
                {Object.entries({
                  email_on_login: 'Login Alerts',
                  email_on_registration: 'Registration Emails'
                }).map(([key, label]) => (
                  <div key={key} className="flex items-center justify-between">
                    <span className="text-sm text-gray-700">{label}</span>
                    <button
                      onClick={() => updatePreferences({
                        ...preferences,
                        [key]: !preferences[key]
                      })}
                      className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                        preferences[key] ? 'bg-blue-600' : 'bg-gray-200'
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                          preferences[key] ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="bg-white border-b border-gray-200 px-6 py-3">
          <div className="flex items-center gap-2 overflow-x-auto">
            <Filter className="w-4 h-4 text-gray-400 flex-shrink-0" />
            {filterOptions.map((option) => (
              <button
                key={option.value}
                onClick={() => setSelectedFilter(option.value)}
                className={`px-3 py-1 text-sm font-medium rounded-full whitespace-nowrap transition-colors ${
                  selectedFilter === option.value
                    ? 'bg-blue-100 text-blue-700'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        {/* Notifications List */}
        <main className="flex-1 overflow-y-auto p-6">
          {filteredNotifications.length === 0 ? (
            <div className="text-center py-12">
              <Bell className="w-16 h-16 mx-auto mb-4 text-gray-300" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No notifications</h3>
              <p className="text-gray-500">
                {selectedFilter === 'all' 
                  ? "You don't have any notifications yet."
                  : `No ${selectedFilter} notifications found.`
                }
              </p>
            </div>
          ) : (
            <div className="space-y-1">
              {filteredNotifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`p-4 rounded-lg border transition-colors hover:bg-gray-50 ${
                    !notification.is_read 
                      ? 'bg-blue-50 border-blue-200' 
                      : 'bg-white border-gray-200'
                  }`}
                >
                  <div className="flex items-start gap-4">
                    {/* Icon */}
                    <div className="flex-shrink-0 text-2xl">
                      {getNotificationIcon(notification.notification_type)}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h4 className="text-sm font-medium text-gray-900">
                            {notification.title}
                          </h4>
                          <p className="text-sm text-gray-600 mt-1">
                            {notification.message}
                          </p>
                          <p className="text-xs text-gray-400 mt-2">
                            {getTimeAgo(notification.created_at)}
                          </p>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-2 ml-4">
                          {!notification.is_read && (
                            <button
                              onClick={() => markAsRead(notification.id)}
                              className="p-1 text-gray-400 hover:text-green-600 rounded"
                              title="Mark as read"
                            >
                              <Check className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}

              {/* Load More Button */}
              {hasMore && (
                <div className="text-center py-6">
                  <button
                    onClick={() => fetchNotifications(page + 1)}
                    disabled={loading}
                    className="px-6 py-2 text-sm font-medium text-blue-600 hover:text-blue-700 disabled:opacity-50"
                  >
                    {loading ? 'Loading...' : 'Load More'}
                  </button>
                </div>
              )}
            </div>
          )}
        </main>
      </div>

      {/* Mobile Sidebar Overlay */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden" 
          onClick={() => setIsSidebarOpen(false)} 
        />
      )}
    </div>
  );
}
