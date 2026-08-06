import { useState, useCallback } from 'react';
import { CheckCircle, AlertCircle, Info, AlertTriangle, X } from 'lucide-react';

/**
 * Custom hook for toast notifications
 * Provides a clean API for showing success, error, info, and warning toasts
 */
export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface Toast {
  id: number;
  message: string;
  type: ToastType;
  duration: number;
}

export const useToast = () => {
  const [notifications, setNotifications] = useState<Toast[]>([]);

  const addNotification = useCallback((message: string, type: ToastType = 'success', duration: number = 4000) => {
    const id = Date.now() + Math.random();
    const notification: Toast = { id, message, type, duration };
    
    setNotifications(prev => [...prev, notification]);
    
    // Auto-remove after specified duration
    setTimeout(() => {
      removeNotification(id);
    }, duration);

    return id;
  }, []);

  const removeNotification = useCallback((id: number) => {
    setNotifications(prev => prev.filter(notif => notif.id !== id));
  }, []);

  const toast = {
    success: (message: string, duration?: number) => addNotification(message, 'success', duration),
    error: (message: string, duration?: number) => addNotification(message, 'error', duration),
    info: (message: string, duration?: number) => addNotification(message, 'info', duration),
    warning: (message: string, duration?: number) => addNotification(message, 'warning', duration),
  };

  return {
    notifications,
    toast,
    removeNotification
  };
};

/**
 * Toast Container Component
 * Renders all active toast notifications with animations
 */
export interface ToastContainerProps {
  notifications: Toast[];
  removeNotification: (id: number) => void;
}

export const ToastContainer = ({ notifications, removeNotification }: ToastContainerProps) => {
  const getToastIcon = (type: string) => {
    switch (type) {
      case 'success':
        return <CheckCircle className="w-5 h-5 text-green-600" />;
      case 'error':
        return <AlertCircle className="w-5 h-5 text-red-600" />;
      case 'warning':
        return <AlertTriangle className="w-5 h-5 text-yellow-600" />;
      case 'info':
        return <Info className="w-5 h-5 text-blue-600" />;
      default:
        return <CheckCircle className="w-5 h-5 text-green-600" />;
    }
  };

  const getToastStyles = (type: string) => {
    switch (type) {
      case 'success':
        return 'bg-green-50 border-green-400 text-green-800';
      case 'error':
        return 'bg-red-50 border-red-400 text-red-800';
      case 'warning':
        return 'bg-yellow-50 border-yellow-400 text-yellow-800';
      case 'info':
        return 'bg-blue-50 border-blue-400 text-blue-800';
      default:
        return 'bg-green-50 border-green-400 text-green-800';
    }
  };

  if (notifications.length === 0) return null;

  return (
    <>
      {/* Toast CSS Animation Styles */}
      <style>{`
        @keyframes slideInFromRight {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
        
        @keyframes slideOutToRight {
          from {
            transform: translateX(0);
            opacity: 1;
          }
          to {
            transform: translateX(100%);
            opacity: 0;
          }
        }
        
        .toast-enter {
          animation: slideInFromRight 0.3s ease-out forwards;
        }
        
        .toast-exit {
          animation: slideOutToRight 0.3s ease-in forwards;
        }
      `}</style>

      {/* Toast Container */}
      <div className="fixed top-4 right-4 z-50 space-y-2 max-w-sm w-full">
        {notifications.map((notification: any) => (
          <div
            key={notification.id}
            className={`toast-enter flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg border-l-4 transition-all duration-300 transform ${getToastStyles(notification.type)}`}
          >
            {getToastIcon(notification.type)}
            <span className="font-medium flex-1 text-sm">{notification.message}</span>
            <button
              onClick={() => removeNotification(notification.id)}
              className="ml-2 text-gray-400 hover:text-gray-600 transition-colors flex-shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
    </>
  );
};

export default useToast;
