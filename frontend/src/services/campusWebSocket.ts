/**
 * Campus Simulator WebSocket Service
 * Handles real-time communication with the Django Channels backend
 */

class CampusWebSocketService {
    ws: WebSocket | null = null;
    lobbyId: string | null = null;
    isConnected = false;
    listeners: Record<string, ((payload: any) => void)[]> = {};
    reconnectAttempts = 0;
    maxReconnectAttempts = 5;
    reconnectTimer: ReturnType<typeof setTimeout> | null = null;

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
            seatUpdate: [],
            seatDenied: [],
            chatMessage: [],
            studyRoomJoin: [],
            studyRoomLeave: [],
            error: []
        };
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
    this.reconnectTimer = null;
    }

    /**
     * Connect to a lobby WebSocket
     * @param {string} lobbyId - The 8-digit lobby ID
     */
    connect(lobbyId: string) {
        if (!lobbyId) {
            console.warn('campusWebSocket.connect called without lobbyId, skipping');
            return;
        }

        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.disconnect();
        }

        this.lobbyId = lobbyId;
        // Prefer connecting to the API host (VITE_API_URL) when configured, otherwise fall back to window.location.host
        const API_URL = import.meta.env.VITE_API_URL || '';
        let protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        let host;
        try {
            if (API_URL) {
                const parsed = new URL(API_URL);
                host = parsed.host;
                protocol = parsed.protocol === 'https:' ? 'wss:' : 'ws:';
            } else {
                host = import.meta.env.PROD ? window.location.host : 'localhost:8000';
            }
        } catch (e) {
            // Fallback
            host = import.meta.env.PROD ? window.location.host : 'localhost:8000';
        }
        
        // Get JWT token from localStorage
        const token = localStorage.getItem('access');
        const tokenParam = token ? `?token=${encodeURIComponent(token)}` : '';
        
        const wsUrl = `${protocol}//${host}/ws/game/lobby/${lobbyId}/${tokenParam}`;

        try {
            this.ws = new WebSocket(wsUrl);
            this.setupEventHandlers();
        } catch (error) {
            console.error('Failed to create WebSocket connection:', error);
            this.emit('error', { message: 'Failed to connect to lobby', detail: String(error) });
        }
    }

    /**
     * Set up WebSocket event handlers
     */
    setupEventHandlers() {
        if (!this.ws) return;

        this.ws.onopen = () => {
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
            this.isConnected = false;
            this.emit('disconnected', { code: event.code, reason: event.reason });
            
            // Handle specific error codes
            if (event.code === 4001) {
                this.emit('error', { message: 'Authentication failed. Please log in again.' });
                return;
            } else if (event.code === 4003) {
                this.emit('error', { message: 'You are not a member of this lobby.' });
                return;
            } else if (event.code === 4004) {
                this.emit('error', { message: 'Lobby not found or inactive.' });
                return;
            }
            
            // Attempt to reconnect unless it was a normal closure
            if (event.code !== 1000 && this.reconnectAttempts < this.maxReconnectAttempts) {
                const idToReconnect = this.lobbyId;
                if (!idToReconnect) {
                    return;
                }

                // clear any existing timer
                if (this.reconnectTimer) {
                    clearTimeout(this.reconnectTimer);
                    this.reconnectTimer = null;
                }

                this.reconnectTimer = setTimeout(() => {
                    this.reconnectAttempts++;
                    this.reconnectTimer = null;
                    this.connect(idToReconnect);
                }, 2000 * Math.max(1, this.reconnectAttempts));
            } else if (this.reconnectAttempts >= this.maxReconnectAttempts) {
                this.emit('error', { message: 'Max reconnection attempts reached. Please refresh the page.' });
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
    handleMessage(data: any) {
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
            case 'seat_update':
                this.emit('seatUpdate', data);
                break;
            case 'seat_denied':
                this.emit('seatDenied', data);
                break;
            case 'prop_update':
                this.emit('propUpdate', data);
                break;
            case 'prop_denied':
                this.emit('propDenied', data);
                break;
            case 'light_update':
                this.emit('lightUpdate', data);
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
    sendPositionUpdate(position: any) {
        if (!this.isConnected) return;

        this.send({
            type: 'player_position',
            x: position.x,
            y: position.y,
            direction: position.direction || 'down',
            // The real facing angle. `direction` is four cardinal values, which
            // draws anyone walking diagonally as facing north.
            heading: position.heading ?? 0,
            // How high the floor is under them, in world metres. Without it
            // every remote player is drawn at ground level, so a lecture
            // audience sits buried in the tiers.
            elevation: position.elevation ?? 0,
            activity: position.activity || 'standing',
            is_moving: position.is_moving || false,
            current_room: position.current_room || null
        });
    }

    /**
     * Ask for a seat.
     *
     * The server decides. Two players can press the key in the same tick and
     * both see an empty chair, so a client that granted itself the seat would
     * put them both in it.
     */
    takeSeat(seat: string) {
        if (!this.isConnected) return;
        this.send({ type: 'take_seat', seat });
    }

    /** Stand up, releasing the seat for whoever wants it next. */
    leaveSeat() {
        if (!this.isConnected) return;
        this.send({ type: 'leave_seat' });
    }

    /**
     * Reach for something. The answer is `propUpdate` or `propDenied`.
     *
     * Asked rather than assumed, for the same reason a chair is: a ball two
     * clients each believe they are holding is two balls.
     */
    takeProp(prop: string) {
        if (!this.isConnected) return;
        this.send({ type: 'take_prop', prop });
    }

    /**
     * Put it down, or throw it, at a point in the 2D frame.
     *
     * The client simulated the arc, so it names where the object came to rest;
     * the server bounds how far that may be from the thrower.
     */
    dropProp(prop: string, x: number, y: number) {
        if (!this.isConnected) return;
        this.send({ type: 'drop_prop', prop, x, y });
    }

    /** Flick a room's lights, for everybody in it. */
    setLight(room: string, on: boolean) {
        if (!this.isConnected) return;
        this.send({ type: 'set_light', room, on });
    }

    /**
     * Send chat message
     * @param {string} message - The chat message
     * @param {string} room - Optional room identifier for room-specific chat
     */
    sendChatMessage(message: string, room: string | null = null) {
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
    joinStudyRoom(roomId: string) {
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
    leaveStudyRoom(roomId: string) {
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
    send(data: any) {
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
    on(event: string, callback: (...args: any[]) => void) {
        // Create the bucket rather than dropping the registration. The map used
        // to be a fixed list, so subscribing to an event that was not in it
        // silently did nothing — which is how the seating events shipped
        // completely inert: the server sent them, the hook subscribed, and
        // neither end ever noticed the other was not there.
        if (!this.listeners[event]) {
            this.listeners[event] = [];
        }
        this.listeners[event].push(callback);
    }

    /**
     * Remove event listener
     * @param {string} event - Event type
     * @param {Function} callback - Callback function to remove
     */
    off(event: string, callback: (...args: any[]) => void) {
        if (this.listeners[event]) {
            this.listeners[event] = this.listeners[event].filter(cb => cb !== callback);
        }
    }

    /**
     * Forget every listener.
     *
     * This is a module singleton, so it outlives the component that subscribes
     * to it. `disconnect()` closes the socket and leaves the callbacks in
     * place, so joining a second lobby — or the page unmounting and mounting
     * again — registered a second full set on top of the first. Every chat
     * message then arrived twice, and the first set went on calling setState
     * on a component that no longer existed.
     *
     * Called by the one subscriber before it registers, rather than exposing
     * an unsubscribe per listener that twelve call sites would have to thread
     * back out.
     */
    clearListeners() {
        this.listeners = {};
    }

    /**
     * Emit event to all listeners
     * @param {string} event - Event type
     * @param {Object} data - Event data
     */
    emit(event: string, data: any) {
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
        }

        // Clear pending reconnect attempts and clear stored lobby id
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }

        this.lobbyId = null;
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
