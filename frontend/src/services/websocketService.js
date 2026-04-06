// WebSocket Service for Real-time Messaging
class WebSocketService {
  constructor() {
    this.connections = new Map() // chatId -> WebSocket connection
    this.listeners = new Map() // chatId -> Set of listener functions
    this.reconnectAttempts = new Map() // chatId -> attempt count
    this.maxReconnectAttempts = 5
    this.reconnectDelay = 1000 // ms
  }

  // Get WebSocket URL for chat type
  getWebSocketUrl(chatType, chatId) {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const host = window.location.host.includes('localhost') 
      ? 'localhost:8000' 
      : window.location.host
    
    if (chatType === 'group') {
      return `${protocol}//${host}/ws/community/groups/${chatId}/chat/`
    } else if (chatType === 'private') {
      return `${protocol}//${host}/ws/community/chats/${chatId}/`
    } else if (chatType === 'notifications') {
      return `${protocol}//${host}/ws/community/notifications/`
    }
    
    throw new Error(`Invalid chat type: ${chatType}`)
  }

  // Connect to a specific chat
  connect(chatType, chatId, token) {
    const connectionKey = `${chatType}_${chatId}`
    
    // Don't create duplicate connections
    if (this.connections.has(connectionKey)) {
      return this.connections.get(connectionKey)
    }

    const url = this.getWebSocketUrl(chatType, chatId)
    const ws = new WebSocket(`${url}?token=${token}`)
    
    ws.onopen = () => {
      console.log(`WebSocket connected to ${chatType} chat ${chatId}`)
      this.reconnectAttempts.set(connectionKey, 0)
    }

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        this.notifyListeners(connectionKey, data)
      } catch (error) {
        console.error('Error parsing WebSocket message:', error)
      }
    }

    ws.onclose = (event) => {
      console.log(`WebSocket disconnected from ${chatType} chat ${chatId}:`, event.code, event.reason)
      this.connections.delete(connectionKey)
      
      // Attempt to reconnect if not intentionally closed
      if (event.code !== 1000) {
        this.attemptReconnect(chatType, chatId, token, connectionKey)
      }
    }

    ws.onerror = (error) => {
      console.error(`WebSocket error for ${chatType} chat ${chatId}:`, error)
    }

    this.connections.set(connectionKey, ws)
    return ws
  }

  // Attempt to reconnect with exponential backoff
  attemptReconnect(chatType, chatId, token, connectionKey) {
    const attempts = this.reconnectAttempts.get(connectionKey) || 0
    
    if (attempts >= this.maxReconnectAttempts) {
      console.error(`Max reconnection attempts reached for ${connectionKey}`)
      return
    }

    const delay = this.reconnectDelay * Math.pow(2, attempts)
    console.log(`Attempting to reconnect to ${connectionKey} in ${delay}ms (attempt ${attempts + 1})`)
    
    setTimeout(() => {
      this.reconnectAttempts.set(connectionKey, attempts + 1)
      this.connect(chatType, chatId, token)
    }, delay)
  }

  // Disconnect from a specific chat
  disconnect(chatType, chatId) {
    const connectionKey = `${chatType}_${chatId}`
    const ws = this.connections.get(connectionKey)
    
    if (ws) {
      ws.close(1000, 'Client disconnecting')
      this.connections.delete(connectionKey)
      this.listeners.delete(connectionKey)
      this.reconnectAttempts.delete(connectionKey)
    }
  }

  // Disconnect from all chats
  disconnectAll() {
    for (const [connectionKey, ws] of this.connections) {
      ws.close(1000, 'Client disconnecting')
    }
    this.connections.clear()
    this.listeners.clear()
    this.reconnectAttempts.clear()
  }

  // Send a message
  sendMessage(chatType, chatId, content) {
    const connectionKey = `${chatType}_${chatId}`
    const ws = this.connections.get(connectionKey)
    
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: 'chat_message',
        message: content
      }))
    } else {
      console.error(`WebSocket not connected for ${connectionKey}`)
      throw new Error('WebSocket not connected')
    }
  }

  // Send typing indicator
  sendTyping(chatType, chatId) {
    const connectionKey = `${chatType}_${chatId}`
    const ws = this.connections.get(connectionKey)
    
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: 'typing',
        typing: true
      }))
    }
  }

  // Send stop typing indicator
  sendStopTyping(chatType, chatId) {
    const connectionKey = `${chatType}_${chatId}`
    const ws = this.connections.get(connectionKey)
    
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: 'typing',
        typing: false
      }))
    }
  }

  // Add event listener for a specific chat
  addListener(chatType, chatId, callback) {
    const connectionKey = `${chatType}_${chatId}`
    
    if (!this.listeners.has(connectionKey)) {
      this.listeners.set(connectionKey, new Set())
    }
    
    this.listeners.get(connectionKey).add(callback)
    
    // Return unsubscribe function
    return () => {
      const listeners = this.listeners.get(connectionKey)
      if (listeners) {
        listeners.delete(callback)
        if (listeners.size === 0) {
          this.listeners.delete(connectionKey)
        }
      }
    }
  }

  // Notify all listeners for a connection
  notifyListeners(connectionKey, data) {
    const listeners = this.listeners.get(connectionKey)
    if (listeners) {
      listeners.forEach(callback => {
        try {
          callback(data)
        } catch (error) {
          console.error('Error in WebSocket listener:', error)
        }
      })
    }
  }

  // Check if connected to a chat
  isConnected(chatType, chatId) {
    const connectionKey = `${chatType}_${chatId}`
    const ws = this.connections.get(connectionKey)
    return ws && ws.readyState === WebSocket.OPEN
  }

  // Get connection status
  getConnectionStatus(chatType, chatId) {
    const connectionKey = `${chatType}_${chatId}`
    const ws = this.connections.get(connectionKey)
    
    if (!ws) return 'disconnected'
    
    switch (ws.readyState) {
      case WebSocket.CONNECTING: return 'connecting'
      case WebSocket.OPEN: return 'connected'
      case WebSocket.CLOSING: return 'closing'
      case WebSocket.CLOSED: return 'closed'
      default: return 'unknown'
    }
  }
}

// Create singleton instance
const websocketService = new WebSocketService()

export default websocketService
