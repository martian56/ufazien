/**
 * Campus Simulator WebSocket Service
 * Handles real-time communication with the Django Channels backend
 */

class CampusWebSocketService {
    constructor() {
        this.ws = null;
        this.lobbyId = null;
        this.isConnected = false;
        this.listeners = {
            connected: [],
            disconnected: [],
            lobbyState: [],
            userJoined: [],
            userLeft: [],
            positionUpdate: [],
            chatMessage: [],
            studyRoomJoin: [],
            studyRoomLeave: [],
            error: []
        };
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
    }

    /**
     * Connect to a lobby WebSocket
     * @param {string} lobbyId - The 8-digit lobby ID
     */
    connect(lobbyId) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.disconnect();
        }

        this.lobbyId = lobbyId;
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const host = process.env.NODE_ENV === 'production' 
            ? window.location.host 
            : 'localhost:8000';
        
        // Get JWT token from localStorage
        const token = localStorage.getItem('access');
        const tokenParam = token ? `?token=${encodeURIComponent(token)}` : '';
        
        const wsUrl = `${protocol}//${host}/ws/game/lobby/${lobbyId}/${tokenParam}`;
        
        try {
            this.ws = new WebSocket(wsUrl);
            this.setupEventHandlers();
        } catch (error) {
            console.error('Failed to create WebSocket connection:', error);
            this.emit('error', { message: 'Failed to connect to lobby' });
        }
    }

    /**
     * Set up WebSocket event handlers
     */
    setupEventHandlers() {
        this.ws.onopen = () => {
            console.log(`Connected to lobby ${this.lobbyId}`);
            this.isConnected = true;
            this.reconnectAttempts = 0;
            this.emit('connected', { lobbyId: this.lobbyId });
        };

        this.ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                this.handleMessage(data);
            } catch (error) {
                console.error('Failed to parse WebSocket message:', error);
            }
        };

        this.ws.onclose = (event) => {
            console.log('WebSocket connection closed:', event.code, event.reason);
            this.isConnected = false;
            this.emit('disconnected', { code: event.code, reason: event.reason });
            
            if (event.code !== 1000 && this.reconnectAttempts < this.maxReconnectAttempts) {
                // Attempt to reconnect unless it was a normal closure
                setTimeout(() => {
                    this.reconnectAttempts++;
                    console.log(`Reconnection attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts}`);
                    this.connect(this.lobbyId);
                }, 2000 * this.reconnectAttempts);
            }
        };

        this.ws.onerror = (error) => {
            console.error('WebSocket error:', error);
            this.emit('error', { message: 'Connection error occurred' });
        };
    }

    /**
     * Handle incoming WebSocket messages
     * @param {Object} data - Parsed message data
     */
    handleMessage(data) {
        switch (data.type) {
            case 'lobby_state':
                this.emit('lobbyState', data);
                break;
            case 'user_joined':
                this.emit('userJoined', data);
                break;
            case 'user_left':
                this.emit('userLeft', data);
                break;
            case 'position_update':
                this.emit('positionUpdate', data);
                break;
            case 'chat_message':
                this.emit('chatMessage', data);
                break;
            case 'study_room_join':
                this.emit('studyRoomJoin', data);
                break;
            case 'study_room_leave':
                this.emit('studyRoomLeave', data);
                break;
            case 'error':
                this.emit('error', data);
                break;
            default:
                console.warn('Unknown message type:', data.type);
        }
    }

    /**
     * Send player position update
     * @param {Object} position - Player position data
     * @param {number} position.x - X coordinate
     * @param {number} position.y - Y coordinate
     * @param {string} position.direction - Player direction (up, down, left, right)
     * @param {boolean} position.is_moving - Whether player is currently moving
     */
    sendPositionUpdate(position) {
        if (!this.isConnected) return;

        this.send({
            type: 'player_position',
            x: position.x,
            y: position.y,
            direction: position.direction || 'down',
            is_moving: position.is_moving || false,
            current_room: position.current_room || null
        });
    }

    /**
     * Send chat message
     * @param {string} message - The chat message
     * @param {string} room - Optional room identifier for room-specific chat
     */
    sendChatMessage(message, room = null) {
        if (!this.isConnected || !message.trim()) return;

        this.send({
            type: 'chat_message',
            message: message.trim(),
            room: room
        });
    }

    /**
     * Send study room join event
     * @param {string} roomId - The study room identifier
     */
    joinStudyRoom(roomId) {
        if (!this.isConnected) return;

        this.send({
            type: 'study_room_join',
            room_id: roomId
        });
    }

    /**
     * Send study room leave event
     * @param {string} roomId - The study room identifier
     */
    leaveStudyRoom(roomId) {
        if (!this.isConnected) return;

        this.send({
            type: 'study_room_leave',
            room_id: roomId
        });
    }

    /**
     * Send raw message to WebSocket
     * @param {Object} data - Data to send
     */
    send(data) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(data));
        } else {
            console.warn('WebSocket not connected, cannot send message:', data);
        }
    }

    /**
     * Add event listener
     * @param {string} event - Event type
     * @param {Function} callback - Callback function
     */
    on(event, callback) {
        if (this.listeners[event]) {
            this.listeners[event].push(callback);
        }
    }

    /**
     * Remove event listener
     * @param {string} event - Event type
     * @param {Function} callback - Callback function to remove
     */
    off(event, callback) {
        if (this.listeners[event]) {
            this.listeners[event] = this.listeners[event].filter(cb => cb !== callback);
        }
    }

    /**
     * Emit event to all listeners
     * @param {string} event - Event type
     * @param {Object} data - Event data
     */
    emit(event, data) {
        if (this.listeners[event]) {
            this.listeners[event].forEach(callback => {
                try {
                    callback(data);
                } catch (error) {
                    console.error('Error in event listener:', error);
                }
            });
        }
    }

    /**
     * Disconnect from WebSocket
     */
    disconnect() {
        if (this.ws) {
            this.ws.close(1000, 'User disconnected');
            this.ws = null;
            this.isConnected = false;
            this.lobbyId = null;
        }
    }

    /**
     * Get connection status
     * @returns {boolean} Connection status
     */
    getConnectionStatus() {
        return this.isConnected && this.ws && this.ws.readyState === WebSocket.OPEN;
    }

    /**
     * Get current lobby ID
     * @returns {string|null} Current lobby ID
     */
    getCurrentLobbyId() {
        return this.lobbyId;
    }
}

// Create singleton instance
const campusWebSocket = new CampusWebSocketService();

export default campusWebSocket;
