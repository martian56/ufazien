/**
 * Campus Simulator React Hook
 * Manages state and backend integration for the 3D campus simulation
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import campusWebSocket from '../services/campusWebSocket';
import campusApi from '../services/campusApi';

export const useCampusSimulator = (lobbyId = null) => {
    // Defensive: ignore string values that may come from route params like 'null' or 'undefined'
    if (typeof lobbyId === 'string' && (lobbyId === 'null' || lobbyId === 'undefined')) {
        lobbyId = null;
    }
    // Connection state
    const [isConnected, setIsConnected] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);

    // Lobby state
    const [currentLobby, setCurrentLobby] = useState(null);
    const [lobbyMembers, setLobbyMembers] = useState([]);
    const [playerPositions, setPlayerPositions] = useState(new Map());
    const [studyRooms, setStudyRooms] = useState([]);

    // Chat state
    const [chatMessages, setChatMessages] = useState([]);
    const [isTyping, setIsTyping] = useState(false);

    // User state
    const [currentUser, setCurrentUser] = useState(null);
    const [userPosition, setUserPosition] = useState({ x: 0, y: 0, direction: 'down', is_moving: false });

    // Refs for preventing stale closures
    const positionRef = useRef(userPosition);
    const lastSentPositionRef = useRef({ x: 0, y: 0, direction: 'down' });
    const positionThrottleRef = useRef(null);
        const wsEverConnectedRef = useRef(false);

    // Update position ref when userPosition changes
    useEffect(() => {
        positionRef.current = userPosition;
    }, [userPosition]);

    /**
     * Initialize lobby connection
     */
    const connectToLobby = useCallback(async (targetLobbyId) => {
        if (!targetLobbyId) return;
        
        console.log('Attempting to connect to lobby:', targetLobbyId);
        setIsLoading(true);
        setError(null);

        try {
            // First, join the lobby via REST API
            console.log('Calling joinLobby API with ID:', targetLobbyId);
            let lobbyData;
            try {
                lobbyData = await campusApi.joinLobby(targetLobbyId);
            } catch (err) {
                const msg = String(err.message || '').toLowerCase();
                if (msg.includes('already in this lobby') || msg.includes('you are already in this lobby')) {
                    console.warn('Backend says user already in lobby; fetching lobby details instead');
                    const lobbyObj = await campusApi.getLobby(targetLobbyId);
                    lobbyData = { lobby: lobbyObj };
                } else {
                    throw err;
                }
            }

            console.log('Successfully joined or retrieved lobby:', lobbyData);
            // Accept both shapes: { lobby: ... } or raw lobby object
            const lobbyObj = lobbyData && lobbyData.lobby ? lobbyData.lobby : lobbyData;
            setCurrentLobby(lobbyObj);

            // Then connect to WebSocket
            campusWebSocket.connect(targetLobbyId);

            // Set up WebSocket event listeners
            setupWebSocketListeners();

        } catch (err) {
            console.error('Failed to connect to lobby:', err);
            setError(err.message || 'Failed to connect to lobby');
        } finally {
            setIsLoading(false);
        }
    }, []);

    /**
     * Set up WebSocket event listeners
     */
    const setupWebSocketListeners = useCallback(() => {
        // Connection status events
        campusWebSocket.on('connected', () => {
            console.log('WebSocket connected');
            setIsConnected(true);
            setError(null);
                wsEverConnectedRef.current = true;
        });

        campusWebSocket.on('disconnected', () => {
            console.log('WebSocket disconnected');
            setIsConnected(false);
                // Do not immediately force-leave the lobby here; only mark disconnected
        });

        // Lobby state received
        campusWebSocket.on('lobbyState', (data) => {
            console.log('Received lobby state:', data);
            setCurrentLobby(data.lobby);
            setLobbyMembers(data.members || []);
            setChatMessages(data.messages || []);
            
            // Update player positions
            const positionsMap = new Map();
            (data.positions || []).forEach(pos => {
                positionsMap.set(pos.user_id, {
                    x: pos.x,
                    y: pos.y,
                    direction: pos.direction || 'down',
                    is_moving: pos.is_moving || false,
                    last_updated: pos.last_updated,
                    username: pos.username
                });
            });
            setPlayerPositions(positionsMap);
        });

        // User joined lobby
        campusWebSocket.on('userJoined', (data) => {
            console.log('User joined:', data);
            setLobbyMembers(prev => {
                const exists = prev.some(member => member.user_id === data.user_id);
                if (!exists) {
                    return [...prev, {
                        user_id: data.user_id,
                        username: data.username,
                        joined_at: new Date().toISOString(),
                        is_online: true
                    }];
                }
                return prev;
            });
        });

        // User left lobby
        campusWebSocket.on('userLeft', (data) => {
            console.log('User left:', data);
            setLobbyMembers(prev => prev.filter(member => member.user_id !== data.user_id));
            setPlayerPositions(prev => {
                const newPositions = new Map(prev);
                newPositions.delete(data.user_id);
                return newPositions;
            });
        });

        // Position update received
        campusWebSocket.on('positionUpdate', (data) => {
            setPlayerPositions(prev => {
                const newPositions = new Map(prev);
                newPositions.set(data.user_id, {
                    x: data.position.x,
                    y: data.position.y,
                    direction: data.position.direction || 'down',
                    is_moving: data.position.is_moving || false,
                    last_updated: new Date().toISOString(),
                    username: data.username
                });
                return newPositions;
            });
        });

        // Chat message received
        campusWebSocket.on('chatMessage', (data) => {
            console.log('Chat message received:', data);
            setChatMessages(prev => [...prev, {
                id: data.message_id,
                user_id: data.user_id,
                username: data.username,
                message: data.message,
                timestamp: data.timestamp,
                channel: data.room || 'global'
            }]);
        });

        // Study room events
        campusWebSocket.on('studyRoomJoin', (data) => {
            console.log('User joined study room:', data);
            // Handle study room join logic
        });

        campusWebSocket.on('studyRoomLeave', (data) => {
            console.log('User left study room:', data);
            // Handle study room leave logic
        });

        // Error handling
        campusWebSocket.on('error', (data) => {
            console.error('WebSocket error:', data);
            setError(data.message || 'Connection error');
        });
    }, []);

    /**
     * Update user position (throttled)
     */
    const updatePosition = useCallback((newPosition) => {
        setUserPosition(newPosition);

        // Throttle position updates to backend (max 10 updates per second)
        if (positionThrottleRef.current) {
            clearTimeout(positionThrottleRef.current);
        }

        positionThrottleRef.current = setTimeout(() => {
            const currentPos = positionRef.current;
            const lastPos = lastSentPositionRef.current;

            // Only send if position actually changed significantly
            const hasMovedSignificantly = 
                Math.abs(currentPos.x - lastPos.x) > 0.5 ||
                Math.abs(currentPos.y - lastPos.y) > 0.5 ||
                currentPos.direction !== lastPos.direction;

            if (hasMovedSignificantly && campusWebSocket.getConnectionStatus()) {
                campusWebSocket.sendPositionUpdate(currentPos);
                lastSentPositionRef.current = { ...currentPos };
            }
        }, 100); // 100ms throttle
    }, []);

    /**
     * Send chat message
     */
    const sendChatMessage = useCallback((message, channel = 'global') => {
        if (!message.trim() || !campusWebSocket.getConnectionStatus()) return;

        campusWebSocket.sendChatMessage(message, channel === 'global' ? null : channel);
    }, []);

    /**
     * Join study room
     */
    const joinStudyRoom = useCallback((roomId) => {
        if (campusWebSocket.getConnectionStatus()) {
            campusWebSocket.joinStudyRoom(roomId);
        }
    }, []);

    /**
     * Leave study room
     */
    const leaveStudyRoom = useCallback((roomId) => {
        if (campusWebSocket.getConnectionStatus()) {
            campusWebSocket.leaveStudyRoom(roomId);
        }
    }, []);

    /**
     * Leave current lobby
     */
    const leaveLobby = useCallback(async () => {
        try {
            if (currentLobby?.id) {
                console.log('Leaving lobby:', currentLobby.id);
                    // Only call API leave if the WebSocket had previously connected (to avoid leaving on handshake failures)
                    if (wsEverConnectedRef.current) {
                        await campusApi.leaveLobby(currentLobby.id);
                    } else {
                        console.log('Skipping API leave because WebSocket never connected');
                    }
                
                // Clean up lobby-specific state
                setCurrentLobby(null);
                setLobbyMembers([]);
                setPlayerPositions(new Map());
                setChatMessages([]);
                
                // Disconnect WebSocket
                campusWebSocket.disconnect();
                setIsConnected(false);
            }
        } catch (error) {
            console.error('Failed to leave lobby:', error);
            setError(`Failed to leave lobby: ${error.message}`);
        }
    }, [currentLobby]);

    /**
     * Disconnect from lobby
     */
    const disconnect = useCallback(async () => {
        try {
            // First, leave the lobby via API if we're in one
            if (currentLobby?.id) {
                console.log('Leaving lobby via API:', currentLobby.id);
                await campusApi.leaveLobby(currentLobby.id);
            }
        } catch (error) {
            console.warn('Failed to leave lobby via API:', error);
            // Continue with disconnect even if API call fails
        }
        
        // Then disconnect WebSocket and clean up state
        campusWebSocket.disconnect();
        setIsConnected(false);
        setCurrentLobby(null);
        setLobbyMembers([]);
        setPlayerPositions(new Map());
        setChatMessages([]);
        setError(null);
    }, [currentLobby]);

    /**
     * Get nearby players based on distance
     */
    const getNearbyPlayers = useCallback((maxDistance = 50) => {
        const nearby = [];
        const userPos = positionRef.current;

        playerPositions.forEach((position, userId) => {
            const distance = Math.sqrt(
                Math.pow(position.x - userPos.x, 2) + 
                Math.pow(position.y - userPos.y, 2)
            );
            
            if (distance <= maxDistance) {
                nearby.push({
                    userId,
                    username: position.username,
                    position,
                    distance
                });
            }
        });

        return nearby.sort((a, b) => a.distance - b.distance);
    }, [playerPositions]);

    /**
     * Convert 3D world coordinates to 2D backend coordinates
     */
    const worldTo2D = useCallback((worldX, worldZ) => {
        // Convert Three.js world coordinates to 2D coordinates
        // Adjust these scaling factors based on your campus layout
        const scale = 10; // 1 world unit = 10 backend units
        const offsetX = 400; // Center offset
        const offsetY = 300; // Center offset

        return {
            x: Math.round(worldX * scale + offsetX),
            y: Math.round(-worldZ * scale + offsetY) // Flip Z to Y axis
        };
    }, []);

    /**
     * Convert 2D backend coordinates to 3D world coordinates
     */
    const coordsTo3D = useCallback((backendX, backendY) => {
        const scale = 10;
        const offsetX = 400;
        const offsetY = 300;

        return {
            x: (backendX - offsetX) / scale,
            z: -((backendY - offsetY) / scale) // Flip Y back to Z axis
        };
    }, []);

    // Auto-connect if lobbyId provided
    useEffect(() => {
        if (lobbyId && campusApi.isAuthenticated()) {
            connectToLobby(lobbyId);
        }

        return () => {
            if (positionThrottleRef.current) {
                clearTimeout(positionThrottleRef.current);
            }
        };
    }, [lobbyId, connectToLobby]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            disconnect();
        };
    }, [disconnect]);

    return {
        // Connection state
        isConnected,
        isLoading,
        error,

        // Lobby data
        currentLobby,
        lobbyMembers,
        playerPositions,
        studyRooms,

        // Chat
        chatMessages,
        isTyping,

        // User state
        currentUser,
        userPosition,

        // Actions
        connectToLobby,
        leaveLobby,
        disconnect,
        updatePosition,
        sendChatMessage,
        joinStudyRoom,
        leaveStudyRoom,
        getNearbyPlayers,

        // Utilities
        worldTo2D,
        coordsTo3D
    };
};

export default useCampusSimulator;
