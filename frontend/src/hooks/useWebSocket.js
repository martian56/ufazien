import { useEffect, useRef, useCallback } from 'react'
import websocketService from '../services/websocketService'

// Hook for using WebSocket in React components
export function useWebSocket(chatType, chatId, token) {
  const listenersRef = useRef([])

  // Connect to WebSocket when hook is used
  useEffect(() => {
    if (!chatType || !chatId || !token) return

    console.log(`Connecting to WebSocket: ${chatType} chat ${chatId}`)
    websocketService.connect(chatType, chatId, token)

    // Cleanup on unmount
    return () => {
      // Clean up listeners
      listenersRef.current.forEach(unsubscribe => unsubscribe())
      listenersRef.current = []
      
      // Disconnect from WebSocket
      websocketService.disconnect(chatType, chatId)
    }
  }, [chatType, chatId, token])

  // Send message function
  const sendMessage = useCallback((content) => {
    if (!chatType || !chatId) return
    try {
      websocketService.sendMessage(chatType, chatId, content)
    } catch (error) {
      console.error('Failed to send message:', error)
      throw error
    }
  }, [chatType, chatId])

  // Send typing indicator
  const sendTyping = useCallback(() => {
    if (!chatType || !chatId) return
    websocketService.sendTyping(chatType, chatId)
  }, [chatType, chatId])

  // Send stop typing indicator
  const sendStopTyping = useCallback(() => {
    if (!chatType || !chatId) return
    websocketService.sendStopTyping(chatType, chatId)
  }, [chatType, chatId])

  // Add event listener
  const addListener = useCallback((callback) => {
    if (!chatType || !chatId) return () => {}
    
    const unsubscribe = websocketService.addListener(chatType, chatId, callback)
    listenersRef.current.push(unsubscribe)
    
    return unsubscribe
  }, [chatType, chatId])

  // Check connection status
  const isConnected = useCallback(() => {
    if (!chatType || !chatId) return false
    return websocketService.isConnected(chatType, chatId)
  }, [chatType, chatId])

  const getConnectionStatus = useCallback(() => {
    if (!chatType || !chatId) return 'disconnected'
    return websocketService.getConnectionStatus(chatType, chatId)
  }, [chatType, chatId])

  return {
    sendMessage,
    sendTyping,
    sendStopTyping,
    addListener,
    isConnected,
    getConnectionStatus
  }
}

// Hook for real-time messages
export function useRealTimeMessages(chatType, chatId, token, onNewMessage, onTypingChange) {
  const webSocket = useWebSocket(chatType, chatId, token)

  useEffect(() => {
    if (!chatType || !chatId) return

    const unsubscribe = webSocket.addListener((data) => {
      switch (data.type) {
        case 'chat_message':
          if (onNewMessage) {
            onNewMessage(data.message)
          }
          break
          
        case 'typing':
          if (onTypingChange) {
            onTypingChange(data.user, data.typing)
          }
          break
          
        case 'user_joined':
          console.log(`${data.user.name} joined the chat`)
          break
          
        case 'user_left':
          console.log(`${data.user.name} left the chat`)
          break
          
        case 'error':
          console.error('WebSocket error:', data.message)
          break
          
        default:
          console.log('Unknown WebSocket message type:', data.type, data)
      }
    })

    return unsubscribe
  }, [chatType, chatId, webSocket, onNewMessage, onTypingChange])

  return webSocket
}
