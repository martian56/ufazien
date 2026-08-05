import { logger } from '../lib/logger';

class WebSocketService {
  connections = new Map<string, WebSocket>();
  eventHandlers = new Map<string, Map<string, ((payload: any) => void)[]>>();
  reconnectAttempts = new Map<string, number>();
  maxReconnectAttempts = 5;
  reconnectDelay = 1000;

  constructor() {
    this.connections = new Map();
    this.eventHandlers = new Map();
    this.reconnectAttempts = new Map();
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 1000;
  }

  /**
   * Build the WebSocket URL from the API origin.
   *
   * This read process.env.REACT_APP_WS_HOST, which is Create React App's
   * convention. Vite does not define `process`, so evaluating it threw
   * "process is not defined" and every community chat connection died here
   * before it opened a socket.
   */
  getWebSocketUrl(path: string) {
    const apiUrl = import.meta.env.VITE_API_URL;
    let host = window.location.host;
    let protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';

    if (apiUrl) {
      try {
        const parsed = new URL(apiUrl, window.location.origin);
        host = parsed.host;
        protocol = parsed.protocol === 'https:' ? 'wss:' : 'ws:';
      } catch {
        // Fall back to the page's own origin.
      }
    }

    return `${protocol}//${host}/ws/${path}`;
  }

  // Connect to WebSocket
  connect(connectionId: string, path: string, options: { autoReconnect?: boolean } = {}) {
    if (this.connections.has(connectionId)) {
      console.warn(`WebSocket connection ${connectionId} already exists`);
      return this.connections.get(connectionId);
    }

    const url = this.getWebSocketUrl(path);
    const token = localStorage.getItem('access');
    
    // Add token to URL if available
    const wsUrl = token ? `${url}?token=${token}` : url;
    
    const ws = new WebSocket(wsUrl);
    
    ws.onopen = () => {
      this.reconnectAttempts.set(connectionId, 0);
      this.emit(connectionId, 'connected', { connectionId });
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        this.emit(connectionId, 'message', data);
        
        // Emit specific event types
        if (data.type) {
          this.emit(connectionId, data.type, data);
        }
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    };

    ws.onclose = (event) => {
      this.connections.delete(connectionId);
      this.emit(connectionId, 'disconnected', { connectionId, code: event.code, reason: event.reason });
      
      // Auto-reconnect if not intentional close
      if (event.code !== 1000 && options.autoReconnect !== false) {
        this.reconnect(connectionId, path, options);
      }
    };

    ws.onerror = (error) => {
      console.error(`WebSocket error: ${connectionId}`, error);
      this.emit(connectionId, 'error', { connectionId, error });
    };

    this.connections.set(connectionId, ws);
    return ws;
  }

  // Reconnect with exponential backoff
  reconnect(connectionId: string, path: string, options: { autoReconnect?: boolean }) {
    const attempts = this.reconnectAttempts.get(connectionId) || 0;
    
    if (attempts >= this.maxReconnectAttempts) {
      console.error(`Max reconnection attempts reached for ${connectionId}`);
      this.emit(connectionId, 'reconnectFailed', { connectionId, attempts });
      return;
    }

    const delay = this.reconnectDelay * Math.pow(2, attempts);
    
    setTimeout(() => {
      this.reconnectAttempts.set(connectionId, attempts + 1);
      this.connect(connectionId, path, options);
    }, delay);
  }

  // Send message
  send(connectionId: string, data: any) {
    const ws = this.connections.get(connectionId);
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(data));
      return true;
    }
    console.warn(`Cannot send message to ${connectionId}: connection not available`);
    return false;
  }

  // Disconnect
  disconnect(connectionId: string) {
    const ws = this.connections.get(connectionId);
    if (ws) {
      ws.close(1000, 'Intentional disconnect');
      this.connections.delete(connectionId);
      this.eventHandlers.delete(connectionId);
      this.reconnectAttempts.delete(connectionId);
    }
  }

  // Event handling
  on(connectionId: string, event: string, handler: (...args: any[]) => void) {
    let handlers = this.eventHandlers.get(connectionId);
    if (!handlers) {
      handlers = new Map();
      this.eventHandlers.set(connectionId, handlers);
    }

    const forEvent = handlers.get(event) ?? [];
    forEvent.push(handler);
    handlers.set(event, forEvent);
  }

  off(connectionId: string, event: string, handler: (...args: any[]) => void) {
    const forEvent = this.eventHandlers.get(connectionId)?.get(event);
    if (!forEvent) return;

    const index = forEvent.indexOf(handler);
    if (index > -1) forEvent.splice(index, 1);
  }

  emit(connectionId: string, event: string, data: any) {
    const forEvent = this.eventHandlers.get(connectionId)?.get(event);
    if (!forEvent) return;

    forEvent.forEach((handler) => {
      try {
        handler(data);
      } catch (error) {
        logger.error(`Error in event handler for ${event}:`, error);
      }
    });
  }

  // Connection status
  isConnected(connectionId: string) {
    const ws = this.connections.get(connectionId);
    return ws && ws.readyState === WebSocket.OPEN;
  }

  // Disconnect all
  disconnectAll() {
    this.connections.forEach((ws, connectionId) => {
      this.disconnect(connectionId);
    });
  }
}

// Create singleton instance
const wsService = new WebSocketService();

// Community-specific WebSocket methods
export const communityWS = {
  // Group chat
  connectToGroupChat(groupId: string, handlers: Record<string, (...args: any[]) => void> = {}) {
    const connectionId = `group_${groupId}`;
    const path = `community/groups/${groupId}/chat/`;
    
    wsService.connect(connectionId, path);
    
    // Set up event handlers
    Object.entries(handlers).forEach(([event, handler]) => {
      wsService.on(connectionId, event, handler);
    });
    
    return {
      send: (message: string) => wsService.send(connectionId, { type: 'message', content: message }),
      sendTyping: () => wsService.send(connectionId, { type: 'typing' }),
      sendStopTyping: () => wsService.send(connectionId, { type: 'stop_typing' }),
      disconnect: () => wsService.disconnect(connectionId),
      isConnected: () => wsService.isConnected(connectionId)
    };
  },

  // Private chat
  connectToPrivateChat(chatId: string, handlers: Record<string, (...args: any[]) => void> = {}) {
    const connectionId = `chat_${chatId}`;
    const path = `community/chats/${chatId}/`;
    
    wsService.connect(connectionId, path);
    
    // Set up event handlers
    Object.entries(handlers).forEach(([event, handler]) => {
      wsService.on(connectionId, event, handler);
    });
    
    return {
      send: (message: string) => wsService.send(connectionId, { type: 'message', content: message }),
      sendTyping: () => wsService.send(connectionId, { type: 'typing' }),
      sendStopTyping: () => wsService.send(connectionId, { type: 'stop_typing' }),
      markRead: () => wsService.send(connectionId, { type: 'mark_read' }),
      disconnect: () => wsService.disconnect(connectionId),
      isConnected: () => wsService.isConnected(connectionId)
    };
  },

  // Community notifications
  connectToNotifications(handlers: Record<string, (...args: any[]) => void> = {}) {
    const connectionId = 'notifications';
    const path = 'community/notifications/';
    
    wsService.connect(connectionId, path);
    
    // Set up event handlers
    Object.entries(handlers).forEach(([event, handler]) => {
      wsService.on(connectionId, event, handler);
    });
    
    return {
      disconnect: () => wsService.disconnect(connectionId),
      isConnected: () => wsService.isConnected(connectionId)
    };
  },

  // Disconnect all community connections
  disconnectAll() {
    wsService.disconnectAll();
  }
};

export default wsService;
