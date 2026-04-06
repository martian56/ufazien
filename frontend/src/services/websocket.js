class WebSocketService {
  constructor() {
    this.connections = new Map();
    this.eventHandlers = new Map();
    this.reconnectAttempts = new Map();
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 1000;
  }

  // Get WebSocket URL
  getWebSocketUrl(path) {
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsHost = process.env.REACT_APP_WS_HOST || window.location.host;
    return `${wsProtocol}//${wsHost}/ws/${path}`;
  }

  // Connect to WebSocket
  connect(connectionId, path, options = {}) {
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
      console.log(`WebSocket connected: ${connectionId}`);
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
      console.log(`WebSocket disconnected: ${connectionId}`, event.code, event.reason);
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
  reconnect(connectionId, path, options) {
    const attempts = this.reconnectAttempts.get(connectionId) || 0;
    
    if (attempts >= this.maxReconnectAttempts) {
      console.error(`Max reconnection attempts reached for ${connectionId}`);
      this.emit(connectionId, 'reconnectFailed', { connectionId, attempts });
      return;
    }

    const delay = this.reconnectDelay * Math.pow(2, attempts);
    console.log(`Reconnecting ${connectionId} in ${delay}ms (attempt ${attempts + 1})`);
    
    setTimeout(() => {
      this.reconnectAttempts.set(connectionId, attempts + 1);
      this.connect(connectionId, path, options);
    }, delay);
  }

  // Send message
  send(connectionId, data) {
    const ws = this.connections.get(connectionId);
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(data));
      return true;
    }
    console.warn(`Cannot send message to ${connectionId}: connection not available`);
    return false;
  }

  // Disconnect
  disconnect(connectionId) {
    const ws = this.connections.get(connectionId);
    if (ws) {
      ws.close(1000, 'Intentional disconnect');
      this.connections.delete(connectionId);
      this.eventHandlers.delete(connectionId);
      this.reconnectAttempts.delete(connectionId);
    }
  }

  // Event handling
  on(connectionId, event, handler) {
    if (!this.eventHandlers.has(connectionId)) {
      this.eventHandlers.set(connectionId, new Map());
    }
    
    const handlers = this.eventHandlers.get(connectionId);
    if (!handlers.has(event)) {
      handlers.set(event, []);
    }
    
    handlers.get(event).push(handler);
  }

  off(connectionId, event, handler) {
    const handlers = this.eventHandlers.get(connectionId);
    if (handlers && handlers.has(event)) {
      const eventHandlers = handlers.get(event);
      const index = eventHandlers.indexOf(handler);
      if (index > -1) {
        eventHandlers.splice(index, 1);
      }
    }
  }

  emit(connectionId, event, data) {
    const handlers = this.eventHandlers.get(connectionId);
    if (handlers && handlers.has(event)) {
      handlers.get(event).forEach(handler => {
        try {
          handler(data);
        } catch (error) {
          console.error(`Error in event handler for ${event}:`, error);
        }
      });
    }
  }

  // Connection status
  isConnected(connectionId) {
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
  connectToGroupChat(groupId, handlers = {}) {
    const connectionId = `group_${groupId}`;
    const path = `community/groups/${groupId}/chat/`;
    
    wsService.connect(connectionId, path);
    
    // Set up event handlers
    Object.entries(handlers).forEach(([event, handler]) => {
      wsService.on(connectionId, event, handler);
    });
    
    return {
      send: (message) => wsService.send(connectionId, { type: 'message', content: message }),
      sendTyping: () => wsService.send(connectionId, { type: 'typing' }),
      sendStopTyping: () => wsService.send(connectionId, { type: 'stop_typing' }),
      disconnect: () => wsService.disconnect(connectionId),
      isConnected: () => wsService.isConnected(connectionId)
    };
  },

  // Private chat
  connectToPrivateChat(chatId, handlers = {}) {
    const connectionId = `chat_${chatId}`;
    const path = `community/chats/${chatId}/`;
    
    wsService.connect(connectionId, path);
    
    // Set up event handlers
    Object.entries(handlers).forEach(([event, handler]) => {
      wsService.on(connectionId, event, handler);
    });
    
    return {
      send: (message) => wsService.send(connectionId, { type: 'message', content: message }),
      sendTyping: () => wsService.send(connectionId, { type: 'typing' }),
      sendStopTyping: () => wsService.send(connectionId, { type: 'stop_typing' }),
      markRead: () => wsService.send(connectionId, { type: 'mark_read' }),
      disconnect: () => wsService.disconnect(connectionId),
      isConnected: () => wsService.isConnected(connectionId)
    };
  },

  // Community notifications
  connectToNotifications(handlers = {}) {
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
