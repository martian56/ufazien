/**
 * Campus Simulator React Hook
 * Manages state and backend integration for the 3D campus simulation
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import campusWebSocket from '../services/campusWebSocket';
import campusApi from '../services/campusApi';
import { errorMessage } from '../lib/api/errors';

/**
 * Decode JWT token to get user ID
 * @returns {number|null} User ID or null if token is invalid
 */
function getCurrentUserId() {
    try {
        const token = localStorage.getItem('access');
        if (!token) return null;
        
        // JWT tokens have 3 parts: header.payload.signature
        const payload = token.split('.')[1];
        if (!payload) return null;
        
        // Decode base64 payload
        const decoded = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
        return decoded.user_id || null;
    } catch (error) {
        console.error('Failed to decode user ID from token:', error);
        return null;
    }
}


/**
 * Wire shapes from the lobby WebSocket. These are loose on purpose: the
 * consumer sends several message types down one socket and the fields vary.
 */
export interface LobbyMember {
  user_id: string | number
  username: string
  joined_at: string
  is_online: boolean
}

export interface ChatMessage {
  id: string | number
  user_id: string | number
  username: string
  message: string
  timestamp: string
  channel: string
}

/** What getNearbyPlayers returns for each player within range. */
export interface NearbyPlayer {
  userId: string | number
  username?: string
  position: PlayerPosition
  distance: number
}

export interface PlayerPosition {
  x: number
  y: number
  direction?: string
  /** Real facing angle in radians. `direction` is the four-way fallback. */
  heading?: number
  /** What the player is doing: sitting, waving, a hand up. */
  activity?: string
  /** The seat they hold, if any. Assigned by the server, never the client. */
  seat?: string | null
  is_moving?: boolean
  current_room?: string | null
  username?: string
  full_name?: string
  last_updated?: string
}

/**
 * Turns one `position_update` frame into the entry we keep for that player.
 *
 * Pulled out of the socket handler so it can be tested, because what it does
 * or does not copy across matters more than it looks. `current_room` was
 * missing here while the consumer had been sending it all along: the lobby
 * snapshot set a player's room, and then the very first step they took
 * replaced their entry with one that had no room on it at all. Since a
 * presenter's room is what decides whose projector a screen share appears on,
 * sharing worked right up until the presenter moved, and then went blank for
 * everyone watching.
 */
/**
 * How far the camera may turn before it is worth telling anybody.
 *
 * About three degrees. The heading comes off the camera, which never sits
 * perfectly still, so an exact comparison would send a frame every tick for a
 * player standing motionless.
 */
const HEADING_EPSILON = 0.05

/**
 * A frame as this hook sends it.
 *
 * Declared rather than inferred: the significance test compares `heading` and
 * `activity`, and an inferred object literal has neither, which makes those
 * comparisons a type error at best and silently constant at worst.
 */
interface SentPosition {
    x: number
    y: number
    direction: string
    heading?: number
    activity?: string
    is_moving?: boolean
    current_room?: string | null
}

export function playerPositionFromUpdate(data: {
  position: PlayerPosition
  username?: string
  full_name?: string
  /** Snapshot frames carry a server timestamp; live frames do not. */
  last_updated?: string
}): PlayerPosition {
  return {
    x: data.position.x,
    y: data.position.y,
    direction: data.position.direction || 'down',
    // Nullish rather than `||`: a heading of exactly zero is due north, and
    // `0 || fallback` throws it away. Same reasoning as `current_room`.
    heading: data.position.heading ?? 0,
    activity: data.position.activity || 'standing',
    seat: data.position.seat ?? null,
    is_moving: data.position.is_moving || false,
    current_room: data.position.current_room ?? null,
    last_updated: data.last_updated ?? new Date().toISOString(),
    username: data.username,
    // Use full_name, fallback to username
    full_name: data.full_name || data.username,
  }
}

export const useCampusSimulator = (lobbyId: string | null = null) => {
    // Defensive: ignore string values that may come from route params like 'null' or 'undefined'
    if (typeof lobbyId === 'string' && (lobbyId === 'null' || lobbyId === 'undefined')) {
        lobbyId = null;
    }
    // Connection state
    const [isConnected, setIsConnected] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Lobby state
    const [currentLobby, setCurrentLobby] = useState<any>(null);
    const [lobbyMembers, setLobbyMembers] = useState<LobbyMember[]>([]);
    const [playerPositions, setPlayerPositions] = useState<Map<string | number, PlayerPosition>>(new Map());
    /**
     * The seat this player holds, as the server sees it.
     *
     * Set only from a `seat_update` addressed to us, never optimistically: the
     * whole reason the server owns seating is that two clients can both believe
     * a chair is free, and a client that sat down before hearing back would put
     * the player in a chair somebody else is already in.
     */
    const [ownSeat, setOwnSeat] = useState<string | null>(null);
    const [studyRooms, setStudyRooms] = useState<any[]>([]);

    // Chat state
    const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
    const [isTyping, setIsTyping] = useState(false);

    // User state
    const [currentUser, setCurrentUser] = useState<any>(null);
    const [userPosition, setUserPosition] = useState<SentPosition>({
        x: 0, y: 0, direction: 'down', is_moving: false,
    });

    // Refs for preventing stale closures
    const positionRef = useRef(userPosition);
    /** The last frame actually put on the wire. */
    const lastSentPositionRef = useRef<SentPosition>({ x: 0, y: 0, direction: 'down' });
    const positionThrottleRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const positionIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const isMovingRef = useRef(false);
    const wsEverConnectedRef = useRef(false);
    const currentLobbyIdRef = useRef<string | null>(null);
    const currentUserIdRef = useRef<string | number | null>(null);

    // Get current user ID on mount
    useEffect(() => {
        currentUserIdRef.current = getCurrentUserId();
    }, []);

    // Update position ref when userPosition changes
    useEffect(() => {
        positionRef.current = userPosition;
    }, [userPosition]);

    /**
     * Initialize lobby connection
     */
    const connectToLobby = useCallback(async (targetLobbyId: string) => {
        if (!targetLobbyId) return;
        
        setIsLoading(true);
        setError(null);

        try {
            // First, join the lobby via REST API
            let lobbyData;
            try {
                lobbyData = await campusApi.joinLobby(targetLobbyId);
            } catch (err) {
                const msg = String(errorMessage(err) || '').toLowerCase();
                if (msg.includes('already in this lobby') || msg.includes('you are already in this lobby')) {
                    console.warn('Backend says user already in lobby; fetching lobby details instead');
                    const lobbyObj = await campusApi.getLobby(targetLobbyId);
                    lobbyData = { lobby: lobbyObj };
                } else {
                    throw err;
                }
            }

            // Accept both shapes: { lobby: ... } or raw lobby object
            const lobbyObj = lobbyData && lobbyData.lobby ? lobbyData.lobby : lobbyData;
            setCurrentLobby(lobbyObj);
            // Store lobby ID in ref for cleanup
            currentLobbyIdRef.current = targetLobbyId;

            // Then connect to WebSocket
            campusWebSocket.connect(targetLobbyId);

            // Set up WebSocket event listeners
            setupWebSocketListeners();

        } catch (err) {
            console.error('Failed to connect to lobby:', err);
            setError(errorMessage(err) || 'Failed to connect to lobby');
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
            setIsConnected(true);
            setError(null);
            wsEverConnectedRef.current = true;
        });

        campusWebSocket.on('disconnected', () => {
            setIsConnected(false);
                // Do not immediately force-leave the lobby here; only mark disconnected
        });

        // Lobby state received
        campusWebSocket.on('lobbyState', (data: any) => {
            setCurrentLobby(data.lobby);
            setLobbyMembers(data.members || []);
            setChatMessages(data.messages || []);
            
            // Update player positions (exclude current user's position - we control our own camera)
            const currentUserId = currentUserIdRef.current;
            const positionsMap = new Map();
            (data.positions || []).forEach((pos: any) => {
                // Filter out current user's position - they control their own camera in first-person view
                if (pos.user_id !== currentUserId) {
                    // Same mapping as the live path. Two hand-written copies of
                    // this is what lost `current_room` in the first place: the
                    // snapshot set it and the live frame did not, so a
                    // presenter's room survived exactly until they moved.
                    positionsMap.set(pos.user_id, playerPositionFromUpdate({
                        position: pos,
                        username: pos.username,
                        full_name: pos.full_name,
                        last_updated: pos.last_updated,
                    }));
                }
            });
            setPlayerPositions(positionsMap);
        });

        // User joined lobby
        campusWebSocket.on('userJoined', (data: any) => {
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
        campusWebSocket.on('userLeft', (data: any) => {
            setLobbyMembers(prev => prev.filter(member => member.user_id !== data.user_id));
            setPlayerPositions(prev => {
                const newPositions = new Map(prev);
                newPositions.delete(data.user_id);
                return newPositions;
            });
        });

        // Position update received
        campusWebSocket.on('positionUpdate', (data: any) => {
            // Filter out current user's position updates - we control our own camera
            const currentUserId = currentUserIdRef.current;
            if (data.user_id === currentUserId) {
                return; // Ignore our own position updates
            }
            
            setPlayerPositions(prev => {
                const newPositions = new Map(prev);
                newPositions.set(data.user_id, playerPositionFromUpdate(data));
                return newPositions;
            });
        });

        // Somebody sat down or stood up. Carried separately from position
        // because the server owns it: a seat is claimed, not announced.
        campusWebSocket.on('seatUpdate', (data: any) => {
            if (data.user_id === currentUserIdRef.current) {
                setOwnSeat(data.seat ?? null);
                return;
            }
            setPlayerPositions(prev => {
                const existing = prev.get(data.user_id);
                if (!existing) return prev;
                const next = new Map(prev);
                next.set(data.user_id, {
                    ...existing,
                    seat: data.seat ?? null,
                    activity: data.activity || 'standing',
                });
                return next;
            });
        });

        // Somebody else got the chair first.
        campusWebSocket.on('seatDenied', () => {
            setOwnSeat(null);
        });

        // Chat message received
        campusWebSocket.on('chatMessage', (data: any) => {
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
        campusWebSocket.on('studyRoomJoin', (data: any) => {
            // Handle study room join logic
        });

        campusWebSocket.on('studyRoomLeave', (data: any) => {
            // Handle study room leave logic
        });

        // Error handling
        campusWebSocket.on('error', (data: any) => {
            console.error('WebSocket error:', data);
            setError(data.message || 'Connection error');
        });
    }, []);

    /**
     * Update user position (throttled)
     * Uses setInterval for continuous updates while moving, instead of debouncing
     */
    const updatePosition = useCallback((newPosition: any) => {
        setUserPosition(newPosition);
        // Update positionRef immediately for interval to use
        positionRef.current = newPosition;

        const isMoving = newPosition.is_moving || false;
        const wasMoving = isMovingRef.current;

        // A pose is not a movement. The interval below only runs while the
        // player is walking, so an emote pressed standing still — or a turn on
        // the spot, which is what the heading is read from the camera for —
        // produced no frame at all and stayed purely local.
        if (!isMoving && !wasMoving) {
            const last = lastSentPositionRef.current;
            const posed = newPosition.activity !== last.activity;
            const turned = Math.abs((newPosition.heading ?? 0) - (last.heading ?? 0)) > HEADING_EPSILON;
            if ((posed || turned) && campusWebSocket.getConnectionStatus()) {
                campusWebSocket.sendPositionUpdate(newPosition);
                lastSentPositionRef.current = { ...newPosition };
            }
        }

        // Only manage interval when movement state changes (starting or stopping)
        if (isMoving && !wasMoving) {
            // Movement just started - send initial update and start interval
            if (campusWebSocket.getConnectionStatus()) {
                campusWebSocket.sendPositionUpdate(newPosition);
                lastSentPositionRef.current = { ...newPosition };
            }

            // Set up interval to send position updates every 100ms while moving
            positionIntervalRef.current = setInterval(() => {
                if (!campusWebSocket.getConnectionStatus()) {
                    if (positionIntervalRef.current) clearInterval(positionIntervalRef.current);
                    positionIntervalRef.current = null;
                    isMovingRef.current = false;
                    return;
                }

                const currentPos = positionRef.current;
                const lastPos = lastSentPositionRef.current;

                // Check if still moving - if not, clear interval and send final position
                if (!currentPos.is_moving) {
                    if (positionIntervalRef.current) clearInterval(positionIntervalRef.current);
                    positionIntervalRef.current = null;
                    isMovingRef.current = false;
                    // Send final position when movement stops
                    campusWebSocket.sendPositionUpdate(currentPos);
                    lastSentPositionRef.current = { ...currentPos };
                    return;
                }

                // Only send if position actually changed significantly.
                // Heading is in here with a tolerance rather than an exact
                // compare: it comes off the camera, which never sits perfectly
                // still, so an equality test would send every single tick.
                const hasMovedSignificantly = 
                    Math.abs(currentPos.x - lastPos.x) > 0.5 ||
                    Math.abs(currentPos.y - lastPos.y) > 0.5 ||
                    currentPos.direction !== lastPos.direction ||
                    currentPos.activity !== lastPos.activity ||
                    Math.abs((currentPos.heading ?? 0) - (lastPos.heading ?? 0)) > HEADING_EPSILON;

                if (hasMovedSignificantly) {
                    campusWebSocket.sendPositionUpdate(currentPos);
                    lastSentPositionRef.current = { ...currentPos };
                }
            }, 100); // Send updates every 100ms (10 updates per second) while moving
            
            isMovingRef.current = true;
        }
        // If stopping movement (isMoving = false and wasMoving = true)
        else if (!isMoving && wasMoving) {
            // Clear the interval if it exists
            if (positionIntervalRef.current) {
                if (positionIntervalRef.current) clearInterval(positionIntervalRef.current);
                positionIntervalRef.current = null;
            }
            // Send final position when movement stops
            if (campusWebSocket.getConnectionStatus()) {
                campusWebSocket.sendPositionUpdate(newPosition);
                lastSentPositionRef.current = { ...newPosition };
            }
            isMovingRef.current = false;
        }
        // If still moving (isMoving = true and wasMoving = true), interval is already running
        // The interval will check positionRef.current on each tick and send updates
        // If still stopped (isMoving = false and wasMoving = false), do nothing
    }, []);

    /**
     * Send chat message
     */
    const sendChatMessage = useCallback((message: string, channel = 'global') => {
        if (!message.trim() || !campusWebSocket.getConnectionStatus()) return;

        campusWebSocket.sendChatMessage(message, channel === 'global' ? null : channel);
    }, []);

    /**
     * Join study room
     */
    /** Ask for a seat. The answer arrives as `seat_update` or `seat_denied`. */
    const takeSeat = useCallback((seat: string) => {
        campusWebSocket.takeSeat(seat);
    }, []);

    const leaveSeat = useCallback(() => {
        campusWebSocket.leaveSeat();
        setOwnSeat(null);
    }, []);

    const joinStudyRoom = useCallback((roomId: string) => {
        if (campusWebSocket.getConnectionStatus()) {
            campusWebSocket.joinStudyRoom(roomId);
        }
    }, []);

    /**
     * Leave study room
     */
    const leaveStudyRoom = useCallback((roomId: string) => {
        if (campusWebSocket.getConnectionStatus()) {
            campusWebSocket.leaveStudyRoom(roomId);
        }
    }, []);

    /**
     * Leave current lobby
     */
    const leaveLobby = useCallback(async () => {
        try {
            const lobbyIdToLeave = currentLobbyIdRef.current;
            if (lobbyIdToLeave) {
                // Only call API leave if the WebSocket had previously connected (to avoid leaving on handshake failures)
                if (wsEverConnectedRef.current) {
                    await campusApi.leaveLobby(lobbyIdToLeave);
                } else {
                }
                
                // Clean up lobby-specific state
                setCurrentLobby(null);
                currentLobbyIdRef.current = null;
                wsEverConnectedRef.current = false;
                setLobbyMembers([]);
                setPlayerPositions(new Map());
                setChatMessages([]);
                
                // Disconnect WebSocket
                campusWebSocket.disconnect();
                setIsConnected(false);
            }
        } catch (error) {
            console.error('Failed to leave lobby:', error);
            setError(`Failed to leave lobby: ${errorMessage(error)}`);
        }
    }, []);

    /**
     * Disconnect from lobby
     */
    const disconnect = useCallback(async () => {
        try {
            // First, leave the lobby via API if we're in one and WebSocket was connected
            // Only leave if WebSocket was successfully connected (to avoid leaving on handshake failures)
            const lobbyIdToLeave = currentLobbyIdRef.current;
            if (lobbyIdToLeave && wsEverConnectedRef.current) {
                await campusApi.leaveLobby(lobbyIdToLeave);
            } else if (lobbyIdToLeave) {
            }
        } catch (error) {
            console.warn('Failed to leave lobby via API:', error);
            // Continue with disconnect even if API call fails
        }
        
        // Then disconnect WebSocket and clean up state
        campusWebSocket.disconnect();
        setIsConnected(false);
        setCurrentLobby(null);
        currentLobbyIdRef.current = null;
        wsEverConnectedRef.current = false;
        setLobbyMembers([]);
        setPlayerPositions(new Map());
        setChatMessages([]);
        setError(null);
    }, []);

    /**
     * Get nearby players based on distance
     */
    const getNearbyPlayers = useCallback((maxDistance = 50) => {
        const nearby: NearbyPlayer[] = [];
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
    const worldTo2D = useCallback((worldX: number, worldZ: number) => {
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
    const coordsTo3D = useCallback((backendX: number, backendY: number) => {
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
                if (positionThrottleRef.current) clearTimeout(positionThrottleRef.current);
            }
        };
    }, [lobbyId, connectToLobby]);

    // Cleanup on unmount only (not when disconnect function changes)
    useEffect(() => {
        return () => {
            // Clear position update interval
            if (positionIntervalRef.current) {
                if (positionIntervalRef.current) clearInterval(positionIntervalRef.current);
                positionIntervalRef.current = null;
            }
            
            // Clear position throttle timeout if any
            if (positionThrottleRef.current) {
                if (positionThrottleRef.current) clearTimeout(positionThrottleRef.current);
                positionThrottleRef.current = null;
            }
            
            // Only leave lobby on actual unmount if WebSocket was connected
            const lobbyIdToLeave = currentLobbyIdRef.current;
            if (lobbyIdToLeave && wsEverConnectedRef.current) {
                campusApi.leaveLobby(lobbyIdToLeave).catch(error => {
                    console.warn('Failed to leave lobby on unmount:', error);
                });
            }
            // Always disconnect WebSocket on unmount
            campusWebSocket.disconnect();
        };
        // Empty dependency array ensures this only runs on mount/unmount, not when other state changes
    }, []);

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
        ownSeat,
        takeSeat,
        leaveSeat,
        getNearbyPlayers,

        // Utilities
        worldTo2D,
        coordsTo3D
    };
};

export default useCampusSimulator;
