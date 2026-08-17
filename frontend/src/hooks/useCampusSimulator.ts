/**
 * Campus Simulator React Hook
 * Manages state and backend integration for the 3D campus simulation
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import campusWebSocket from '../services/campusWebSocket';
import campusApi from '../services/campusApi';
import { errorMessage } from '../lib/api/errors';
import {
    NO_SEATS,
    ownSeatFromSnapshot,
    seatAfterDenial,
    seatsFromSnapshot,
    withSeat,
    withoutPlayer,
    type SeatMap,
} from '../components/campus/seatState';

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
  /**
   * Height of the floor under their feet, in world metres.
   *
   * Deliberately not part of the `x`/`y` frame, which is the ground plane
   * scaled by ten about an offset. This is the third axis, unscaled.
   */
  elevation?: number
  /** What the player is doing: sitting, waving, a hand up. */
  activity?: string
  /** The seat they hold, if any. Assigned by the server, never the client. */
  seat?: string | null
  /** What they are carrying, if anything. Server-assigned in the same way. */
  holding?: string | null
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
    elevation?: number
    activity?: string
    is_moving?: boolean
    current_room?: string | null
}

/** Where a loose object came to rest, in the 2D frame positions use. */
export interface PropRest {
    x: number
    y: number
    room: string | null
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
    // Ground level is zero, and zero is the common case, so this is exactly
    // the field `||` would quietly discard.
    elevation: data.position.elevation ?? 0,
    activity: data.position.activity || 'standing',
    seat: data.position.seat ?? null,
    holding: data.position.holding ?? null,
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
    /**
     * Where everybody else is sitting.
     *
     * Held apart from `playerPositions` because the two have different
     * lifetimes: a seat lasts until it is released, a position frame lasts
     * until the next one. Folding seating into the frames meant somebody who
     * sat down and then waved lost their chair from this map, and the next
     * person to walk up was offered it.
     */
    const [seatedPlayers, setSeatedPlayers] = useState<SeatMap>(NO_SEATS);
    /**
     * Which floor the lift is at, and when it was last sent somewhere.
     *
     * The server owns the floor; the clock is local and only decides how far
     * through the ride this client is drawing. A car that arrived before you
     * joined has `calledAt` at zero, so it is simply parked.
     */
    const [lift, setLift] = useState<{ floor: number; calledAt: number }>({
        floor: 0,
        calledAt: 0,
    });
    /**
     * Who is carrying what.
     *
     * The same shape as the seating map, and for the same reasons: it is a
     * server-owned claim, it arrives in its own message, and it outlives any
     * single position frame.
     */
    const [carriedProps, setCarriedProps] = useState<SeatMap>(NO_SEATS);
    /** The object this player is holding, as the server sees it. */
    const [ownProp, setOwnProp] = useState<string | null>(null);
    /**
     * Where the loose objects are lying.
     *
     * Only the ones that have been moved. A prop with no entry is wherever the
     * campus layout puts it, so a fresh lobby needs no rows at all.
     */
    const [propPositions, setPropPositions] = useState<ReadonlyMap<string, PropRest>>(new Map());
    /**
     * Which rooms have had their lights turned off.
     *
     * Absence means lit, which is how every room starts, so a lobby nobody has
     * touched carries no state at all.
     */
    const [roomLights, setRoomLights] = useState<ReadonlyMap<string, boolean>>(new Map());

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
        // Start from nothing. The socket service is a module singleton and
        // keeps its callbacks across a disconnect, so joining a second lobby
        // used to leave the first lobby's handlers subscribed as well: chat
        // messages arrived once per past connection, and the stale handlers
        // went on writing to state that belonged to a dead render.
        campusWebSocket.clearListeners();

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
            // Where the car is standing. Without this somebody arriving sees it
            // at the ground floor while everybody else is looking at it on the
            // third — and `calledAt` stays zero, so it is parked rather than
            // replaying a ride that finished before they joined.
            if (data.lift) setLift({ floor: Number(data.lift.floor) || 0, calledAt: 0 });
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
            setSeatedPlayers(seatsFromSnapshot(data.positions || [], currentUserId));
            // Including our own chair, which the map above deliberately leaves
            // out. Disconnecting releases a seat, so this is usually null — but
            // the snapshot is the server's answer either way, and deriving
            // `ownSeat` from anything else is how the two disagree.
            setOwnSeat(ownSeatFromSnapshot(data.positions || [], currentUserId));

            // What everybody is carrying, and where the things nobody is
            // carrying have been left. Both are what the world remembers
            // between visits: without them somebody arriving sees the room as
            // it was built rather than as the last person left it.
            const carried = new Map<string | number, string>();
            (data.positions || []).forEach((pos: any) => {
                if (pos.holding) carried.set(pos.user_id, pos.holding);
            });
            setCarriedProps(carried);
            setOwnProp(
                (data.positions || []).find((pos: any) => pos.user_id === currentUserId)?.holding
                    || null,
            );

            const rested = new Map<string, PropRest>();
            (data.props || []).forEach((prop: any) => {
                rested.set(prop.prop, { x: prop.x, y: prop.y, room: prop.room ?? null });
            });
            setPropPositions(rested);

            const lights = new Map<string, boolean>();
            (data.lights || []).forEach((light: any) => {
                lights.set(String(light.room), Boolean(light.on));
            });
            setRoomLights(lights);
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
            // Their chair is free again. The server releases it on disconnect;
            // this is the same fact reaching the people still in the room.
            setSeatedPlayers(prev => withoutPlayer(prev, data.user_id));
            setCarriedProps(prev => withoutPlayer(prev, data.user_id));
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
            // The frame carries the seat the server row holds, not one the
            // sender chose. Kept in step here so a player who sat down before
            // we ever saw them still occupies their chair in this map.
            setSeatedPlayers(prev => withSeat(prev, data.user_id, data.position?.seat));
            setCarriedProps(prev => withSeat(prev, data.user_id, data.position?.holding));
        });

        // Somebody sat down or stood up. Carried separately from position
        // because the server owns it: a seat is claimed, not announced.
        campusWebSocket.on('seatUpdate', (data: any) => {
            if (data.user_id === currentUserIdRef.current) {
                setOwnSeat(data.seat ?? null);
                return;
            }
            // Unconditionally, and before the pose: this is the record of who
            // holds which chair, and it has to be right even for a player we
            // have no position for yet.
            setSeatedPlayers(prev => withSeat(prev, data.user_id, data.seat));
            setPlayerPositions(prev => {
                // Only the pose. Somebody with no position frame yet has
                // nowhere to be drawn, and inventing coordinates for them
                // would stand an avatar in the middle of the quad.
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
        campusWebSocket.on('seatDenied', (data: any) => {
            setOwnSeat(prev => seatAfterDenial(prev, data?.seat));
        });

        // Somebody picked something up or put it down. Carried in its own
        // message for the same reasons seating is: the server decides it, and
        // it has to survive the next position frame.
        campusWebSocket.on('propUpdate', (data: any) => {
            const held = Boolean(data.held);
            if (data.user_id === currentUserIdRef.current) {
                setOwnProp(held ? (data.prop ?? null) : null);
            }
            // `withSeat` is the generic "this player holds this token" update;
            // a chair and a ball are the same shape of claim.
            setCarriedProps(prev => withSeat(prev, data.user_id, held ? data.prop : null));

            if (!held && data.prop && typeof data.x === 'number' && typeof data.y === 'number') {
                setPropPositions(prev => {
                    const next = new Map(prev);
                    next.set(data.prop, { x: data.x, y: data.y, room: data.room ?? null });
                    return next;
                });
            }
        });

        campusWebSocket.on('propDenied', (data: any) => {
            // Same rule as a refused chair: only give up the one it names.
            setOwnProp(prev => seatAfterDenial(prev, data?.prop));
        });

        campusWebSocket.on('lightUpdate', (data: any) => {
            if (!data?.room) return;
            setRoomLights(prev => {
                const next = new Map(prev);
                next.set(String(data.room), Boolean(data.on));
                return next;
            });
        });

        // Chat message received
        campusWebSocket.on('liftUpdate', (data: any) => {
            // `performance.now()` rather than the server's clock: this only
            // times the animation, and the two clocks need not agree for that.
            setLift({ floor: Number(data.floor) || 0, calledAt: performance.now() });
        });

        campusWebSocket.on('chatMessage', (data: any) => {
            setChatMessages(prev => [...prev, {
                id: data.message_id,
                user_id: data.user_id,
                username: data.username,
                message: data.message,
                timestamp: data.timestamp,
                // `room` is what the message was said on. The consumer used to
                // drop it, so everything came back labelled 'global' whatever
                // tab it was typed in.
                channel: data.room || 'global'
            }]);
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
            // Sitting down on a tier changes nothing on the ground plane and
            // three metres of height, so without this the pose reaches
            // everybody and the height it happens at does not.
            const rose = Math.abs((newPosition.elevation ?? 0) - (last.elevation ?? 0)) > 0.05;
            if ((posed || turned || rose) && campusWebSocket.getConnectionStatus()) {
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
                    Math.abs((currentPos.elevation ?? 0) - (lastPos.elevation ?? 0)) > 0.05 ||
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
        // No optimistic clear. Standing up is the server's to confirm, exactly
        // as sitting down is: if the socket is down the message never lands,
        // and clearing here would show a player on their feet while the server
        // still holds their chair against everybody else.
        campusWebSocket.leaveSeat();
    }, []);

    /** Reach for something. The answer is `propUpdate` or `propDenied`. */
    const takeProp = useCallback((prop: string) => {
        campusWebSocket.takeProp(prop);
    }, []);

    /**
     * Put down or throw what is being carried, at a point in the 2D frame.
     *
     * No optimistic clear, exactly as with standing up: the server decides
     * where it landed, and it may move the landing place to bring an
     * over-long throw back within range.
     */
    const dropProp = useCallback((prop: string, x: number, y: number) => {
        campusWebSocket.dropProp(prop, x, y);
    }, []);

    /** Flick a room's lights for everybody in it. */
    /** Send the lift to a floor. The server decides; this only asks. */
    const callLift = useCallback((floor: number) => {
        campusWebSocket.callLift(floor);
    }, []);

    const setRoomLight = useCallback((room: string, on: boolean) => {
        campusWebSocket.setLight(room, on);
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
                setSeatedPlayers(NO_SEATS);
                setOwnSeat(null);
                setCarriedProps(NO_SEATS);
                setOwnProp(null);
                setPropPositions(new Map());
                setRoomLights(new Map());
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
        setSeatedPlayers(NO_SEATS);
        setOwnSeat(null);
        setCarriedProps(NO_SEATS);
        setOwnProp(null);
        setPropPositions(new Map());
        setRoomLights(new Map());
        setChatMessages([]);
        setError(null);
    }, []);

    /**
     * Get nearby players based on distance
     */
    /**
     * Who is close enough to count as nearby.
     *
     * Room first, then distance. Every interior is built at the origin and
     * shares one coordinate frame with the outdoors, so somebody standing in
     * the middle of the library and somebody standing in the middle of the
     * cafeteria are at the same `x` and `y` — comparing those alone made
     * "nearby" mean "at the same spot in some room, anywhere in the building".
     *
     * Height counts too, now that the main building has four floors in one
     * space: two people one above the other are not near each other.
     */
    const getNearbyPlayers = useCallback((maxDistance = 50) => {
        const nearby: NearbyPlayer[] = [];
        const userPos = positionRef.current;
        const myRoom = userPos.current_room ?? null;

        playerPositions.forEach((position, userId) => {
            if ((position.current_room ?? null) !== myRoom) return;

            // Elevation is world metres and the ground plane is scaled by ten,
            // so it is brought into the same units before being compared.
            const rise = ((position.elevation ?? 0) - (userPos.elevation ?? 0)) * 10;
            const distance = Math.sqrt(
                Math.pow(position.x - userPos.x, 2) +
                Math.pow(position.y - userPos.y, 2) +
                Math.pow(rise, 2)
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
        ownSeat,
        seatedPlayers,
        takeSeat,
        leaveSeat,
        ownProp,
        carriedProps,
        propPositions,
        takeProp,
        dropProp,
        roomLights,
        setRoomLight,
        lift,
        callLift,
        getNearbyPlayers,

        // Utilities
        worldTo2D,
        coordsTo3D
    };
};

export default useCampusSimulator;
