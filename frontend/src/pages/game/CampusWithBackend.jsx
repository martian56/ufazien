import React, { useState, useRef, useCallback, Suspense, useEffect, useMemo } from "react"
import { Helmet } from "react-helmet"
import { Canvas, useFrame, useThree } from "@react-three/fiber"
import { Text, Html, Sky, KeyboardControls, useKeyboardControls, PointerLockControls } from "@react-three/drei"
import { Vector3, MathUtils } from "three"
import { useNavigate, useParams } from "react-router-dom"
import { MessageCircle, Users, Settings, LogOut, Mic, MicOff, Video, VideoOff, MonitorUp } from "lucide-react"
import { useCampusSimulator } from '../../hooks/useCampusSimulator'
import { useCampusVoice } from '../../hooks/useCampusVoice'
import VoicePanel, { ScreenShareStage } from '../../components/campus/VoicePanel'
import ProjectorScreen from '../../components/campus/ProjectorScreen'
import { api } from '../../lib/api/client'
import { isAuthenticated } from '../../lib/api/tokens'
import TouchControls, { createTouchState, useIsTouchDevice } from '../../components/campus/TouchControls'
import {
  CampusEnvironment,
  CampusGround,
  Building,
  CampusProps,
  BuildingInterior,
  CharacterModel,
} from '../../components/campus/CampusScenery'

// User data will be fetched from backend
const getCurrentUser = () => {
  // This will be replaced with actual user data from the backend
  return {
    id: null,
    name: "Loading...",
    avatar: "👤",
    year: "Student",
    major: "UFAZ",
    color: "#4F46E5",
    level: 1,
    achievements: [],
  }
}

// Key controls for player movement
const keyMap = [
  { name: "forward", keys: ["ArrowUp", "KeyW"] },
  { name: "backward", keys: ["ArrowDown", "KeyS"] },
  { name: "leftward", keys: ["ArrowLeft", "KeyA"] },
  { name: "rightward", keys: ["ArrowRight", "KeyD"] },
  { name: "jump", keys: ["Space"] },
  { name: "run", keys: ["ShiftLeft"] },
  { name: "interact", keys: ["KeyE"] },
]

// Campus buildings and areas
const campusBuildings = [
  { id: 1, name: "Library", position: [-20, 0, -15], size: [15, 8, 12], color: "#8B5A2B", icon: "📚" },
  { id: 2, name: "Science Lab", position: [15, 0, 8], size: [12, 6, 10], color: "#2D5016", icon: "🔬" },
  { id: 3, name: "Student Center", position: [0, 0, 25], size: [20, 10, 15], color: "#4A1A5C", icon: "🏢" },
  { id: 4, name: "Art Studio", position: [-25, 0, 10], size: [10, 5, 8], color: "#8B2C1B", icon: "🎨" },
  { id: 5, name: "Cafeteria", position: [25, 0, -10], size: [18, 6, 12], color: "#2F4F4F", icon: "🍽️" },
]

// Enhanced study areas with more interactive features
const studyAreas = [
  {
    id: "library-quiet",
    name: "Quiet Study Zone",
    position: [-20, 1, -15],
    radius: 8,
    icon: "📖",
    description: "Silent study environment perfect for focused reading and research",
    maxUsers: 12,
    subject: "General Study",
    duration: "Open 24/7",
    features: ["Silent", "WiFi", "Power Outlets"]
  },
  {
    id: "lab-group",
    name: "Collaborative Lab",
    position: [15, 1, 8],
    radius: 6,
    icon: "🧪",
    description: "Group study space with lab equipment and collaborative tools",
    maxUsers: 8,
    subject: "Science & Research",
    duration: "8:00 AM - 10:00 PM",
    features: ["Lab Equipment", "Whiteboard", "Group Tables"]
  },
  {
    id: "center-meeting",
    name: "Meeting Rooms",
    position: [0, 1, 25],
    radius: 10,
    icon: "💼",
    description: "Private study rooms for small groups and presentations",
    maxUsers: 6,
    subject: "Presentations",
    duration: "Bookable Slots",
    features: ["Projector", "Soundproof", "Video Conferencing"]
  },
  {
    id: "art-creative",
    name: "Creative Workshop",
    position: [-25, 1, 10],
    radius: 5,
    icon: "🎭",
    description: "Open creative space for artistic projects and brainstorming",
    maxUsers: 10,
    subject: "Creative Arts",
    duration: "9:00 AM - 9:00 PM",
    features: ["Art Supplies", "Natural Light", "Flexible Seating"]
  },
]

// drei's KeyboardControls listens on the window and does not exclude text
// fields, so typing in chat also drove the player: "we need" walked forward and
// e opened a building mid-sentence.
function isTypingInField() {
  const el = typeof document !== 'undefined' ? document.activeElement : null
  if (!el) return false
  const tag = el.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || el.isContentEditable
}

// Enhanced chat system with backend integration
function ChatSystem({ isOpen, onToggle, campusHook, isTouchDevice = false }) {
  const [newMessage, setNewMessage] = useState("")
  const [activeTab, setActiveTab] = useState("global")
  const [isTyping, setIsTyping] = useState(false)
  const scrollRef = useRef(null)
  const seenCountRef = useRef(0)

  const { chatMessages, sendChatMessage, getNearbyPlayers } = campusHook

  // New messages were appended below the fold with nothing scrolling the list,
  // so a conversation silently disappeared downwards.
  useEffect(() => {
    if (!isOpen) return
    const node = scrollRef.current
    if (node) node.scrollTop = node.scrollHeight
  }, [chatMessages.length, isOpen, activeTab])

  // The badge counted every message ever received, so it sat on "9+" forever.
  useEffect(() => {
    if (isOpen) seenCountRef.current = chatMessages.length
  }, [isOpen, chatMessages.length])
  const unread = Math.max(0, chatMessages.length - seenCountRef.current)

  const nearbyUsers = getNearbyPlayers(50) // Get users within 50 units

  const handleSend = () => {
    if (newMessage.trim()) {
      sendChatMessage(newMessage, activeTab)
      setNewMessage("")
      setIsTyping(false)
    }
  }

  const handleTyping = (e) => {
    setNewMessage(e.target.value)
    setIsTyping(e.target.value.length > 0)
  }

  // Filter messages by channel
  const filteredMessages = chatMessages.filter(msg => {
    if (activeTab === "global") return msg.channel === "global" || !msg.channel
    if (activeTab === "nearby") return nearbyUsers.some(user => user.userId === msg.user_id)
    return msg.channel === activeTab
  })

  if (!isOpen) {
    return (
      <div className={`absolute z-30 pointer-events-auto ${isTouchDevice ? "bottom-5 right-24" : "bottom-24 right-4"}`}>
        <button
          onClick={onToggle}
          className="bg-blue-600 hover:bg-blue-700 text-white p-4 rounded-full shadow-lg transition-all transform hover:scale-105"
        >
          <MessageCircle className="w-6 h-6" />
          {unread > 0 && (
            <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full w-6 h-6 flex items-center justify-center">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </button>
      </div>
    )
  }

  return (
    // z-40 puts it above the touch controls. Without a layer of its own it
    // sat under the joystick and the jump and enter buttons, which are z-30,
    // so they were drawn across the message list and the input.
    <div className="absolute inset-x-2 bottom-2 h-[min(70vh,500px)] sm:inset-x-auto sm:right-4 sm:bottom-4 sm:w-96 sm:h-[min(80vh,500px)] z-40 bg-black bg-opacity-95 backdrop-blur-sm border border-blue-500/30 rounded-xl pointer-events-auto shadow-2xl">
      {/* Chat Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-700 bg-gradient-to-r from-blue-600/20 to-purple-600/20">
        <div className="flex space-x-2">
          {[
            {
              key: "global",
              icon: "🌍",
              label: "Global",
              count: filteredMessages.filter((m) => m.channel === "global").length,
            },
            {
              key: "nearby",
              icon: "📍",
              label: "Nearby",
              count: nearbyUsers.length,
            },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                activeTab === tab.key
                  ? "bg-blue-600 text-white shadow-lg"
                  : "text-gray-400 hover:text-white hover:bg-gray-700"
              }`}
            >
              {tab.icon} {tab.label}
              {tab.count > 0 && (
                <span className="ml-1 bg-blue-500 text-white text-xs rounded-full px-1">
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>
        <button
          onClick={onToggle}
          className="text-gray-400 hover:text-white transition-colors"
        >
          ✕
        </button>
      </div>

      {/* Messages Area */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3 h-[calc(min(70vh,500px)-9.5rem)] sm:h-[calc(min(80vh,500px)-9.5rem)]">
        {filteredMessages.length === 0 ? (
          <div className="text-center text-gray-500 py-8">
            <MessageCircle className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p>No messages yet</p>
            <p className="text-sm">Start a conversation!</p>
          </div>
        ) : (
          filteredMessages.map((message) => (
            <div key={message.id} className="group">
              <div className="flex items-start space-x-3">
                <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white text-sm font-bold">
                  {message.username?.[0]?.toUpperCase() || "?"}
                </div>
                <div className="flex-1">
                  <div className="flex items-center space-x-2">
                    <span className="text-sm font-medium text-blue-400">
                      {message.username}
                    </span>
                    <span className="text-xs text-gray-500">
                      {new Date(message.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                  <p className="text-gray-300 text-sm mt-1">{message.message}</p>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Message Input */}
      <div className="p-4 border-t border-gray-700 bg-gray-900/50">
        <div className="flex space-x-2">
          <input
            type="text"
            value={newMessage}
            onChange={handleTyping}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleSend() } }}
            placeholder={`Message ${activeTab === "global" ? "everyone" : activeTab}...`}
            className="flex-1 bg-gray-800 text-white px-4 py-3 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
          />
          <button
            onClick={handleSend}
            disabled={!newMessage.trim()}
            className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white px-4 py-3 rounded-lg text-sm transition-all transform hover:scale-105 disabled:transform-none"
          >
            Send
          </button>
        </div>
        <div className="flex items-center justify-between mt-2 text-xs text-gray-400">
          <span>Press Enter to send</span>
          <span>{nearbyUsers.length} nearby users</span>
        </div>
      </div>
    </div>
  )
}

// Player avatar component with backend position sync
function PlayerAvatar({ position, userData, isCurrentUser = false }) {
  const meshRef = useRef()

  useFrame((state) => {
    if (meshRef.current && !isCurrentUser) {
      // Smooth position interpolation for other players
      const targetPosition = new Vector3(position.x, 0.5, position.z)
      meshRef.current.position.lerp(targetPosition, 0.1)
    }
  })

  return (
    <group ref={meshRef} position={isCurrentUser ? [0, 0, 0] : [position.x, 0.5, position.z]}>
      <CharacterModel
        color={userData.color || "#4F46E5"}
        isMoving={Boolean(userData.is_moving)}
        direction={userData.direction || "down"}
      />

      {/* Full Name Label */}
      <Html position={[0, 2, 0]} center zIndexRange={[9, 0]}>
        <div className="bg-black bg-opacity-75 text-white px-2 py-1 rounded text-xs whitespace-nowrap pointer-events-none">
          {userData.full_name || userData.username || userData.name}
          {userData.activity && (
            <div className="text-green-400 text-xs">{userData.activity}</div>
          )}
        </div>
      </Html>
    </group>
  )
}

// Entering a building swaps in a room built at the world origin. Without moving
// the camera the player keeps their outdoor position, which is usually outside
// that room, so they end up looking at the back of the walls.
function InteriorCameraPlacement({ insideBuilding }) {
  const { camera } = useThree()
  const outsidePosition = useRef(null)

  useEffect(() => {
    if (insideBuilding) {
      outsidePosition.current = camera.position.clone()
      // Just inside the entrance, facing the board on the far wall.
      camera.position.set(0, 1.7, 14)
      camera.rotation.set(0, 0, 0)
    } else if (outsidePosition.current) {
      camera.position.copy(outsidePosition.current)
      outsidePosition.current = null
    }
  }, [insideBuilding, camera])

  return null
}

// Entering by clicking a DOM button does not work while the pointer is locked
// for mouse-look, which is the normal way to play. E does the same thing from
// wherever the player is standing.
function ProximityInteraction({ buildings, insideBuilding, onEnter, onExit, touch }) {
  const { camera } = useThree()
  const [, get] = useKeyboardControls()
  const wasPressed = useRef(false)

  useFrame(() => {
    const pressed = (Boolean(get().interact) && !isTypingInField()) || Boolean(touch?.current?.interact)
    if (touch?.current?.interact) touch.current.interact = false
    // Edge trigger: holding E must not toggle every frame.
    if (pressed && !wasPressed.current) {
      if (insideBuilding) {
        onExit()
      } else {
        let nearest = null
        let nearestDistance = Infinity
        for (const building of buildings) {
          const [bx, , bz] = building.position
          const distance = Math.hypot(camera.position.x - bx, camera.position.z - bz)
          const reach = Math.max(building.size[0], building.size[2]) / 2 + 6
          if (distance < reach && distance < nearestDistance) {
            nearest = building
            nearestDistance = distance
          }
        }
        if (nearest) onEnter(nearest)
      }
    }
    wasPressed.current = pressed
  })

  return null
}

// First person player controller with backend position sync
function Player({ campusHook, insideBuilding, touch }) {
  const { camera } = useThree()
  const [, get] = useKeyboardControls()
  const playerRef = useRef()
  const velocity = useRef(new Vector3())
  const direction = useRef(new Vector3())
  const [isOnGround, setIsOnGround] = useState(true)
  
  const { updatePosition, userPosition, worldTo2D } = campusHook

  // r3f aims the default camera at the scene origin. This camera sits directly
  // above the origin, so that meant starting the game looking straight at the
  // floor. Level the pitch once so the player starts facing the horizon.
  useEffect(() => {
    camera.rotation.set(0, 0, 0)
    camera.position.set(0, 1.7, 12)
  }, [camera])

  useFrame((state, delta) => {
    const typing = isTypingInField()
    const raw = get()
    const { forward, backward, leftward, rightward, jump, run } = typing
      ? { forward: false, backward: false, leftward: false, rightward: false, jump: false, run: false }
      : raw

    // Movement calculations
    const speed = run ? 8 : 4
    const jumpForce = 8

    // Get camera direction
    direction.current.set(0, 0, 0)
    
    if (forward) direction.current.z -= 1
    if (backward) direction.current.z += 1
    if (leftward) direction.current.x -= 1
    if (rightward) direction.current.x += 1

    // Touch joystick contributes to the same vector as the keys.
    if (touch?.current) {
      direction.current.x += touch.current.move.x
      direction.current.z -= touch.current.move.y

      // Drag-to-look, consumed each frame so it does not accumulate.
      const { dx, dy } = touch.current.look
      if (dx || dy) {
        camera.rotation.order = 'YXZ'
        camera.rotation.y -= dx * 0.004
        camera.rotation.x = MathUtils.clamp(camera.rotation.x - dy * 0.004, -1.2, 1.2)
        touch.current.look.dx = 0
        touch.current.look.dy = 0
      }
    }

    // Normalize and apply speed
    if (direction.current.length() > 0) {
      direction.current.normalize()
      direction.current.multiplyScalar(speed * delta)
      
      // Apply camera rotation to movement direction
      direction.current.applyEuler(camera.rotation)
      direction.current.y = 0 // Keep movement horizontal
    }

    // Jump logic
    if ((jump || touch?.current?.jump) && isOnGround) {
      velocity.current.y = jumpForce
      setIsOnGround(false)
    }

    // Apply gravity
    velocity.current.y -= 20 * delta
    if (camera.position.y <= 1.5 && velocity.current.y < 0) {
      velocity.current.y = 0
      camera.position.y = 1.5
      setIsOnGround(true)
    }

    // Apply movement
    camera.position.add(direction.current)
    camera.position.y += velocity.current.y * delta

    // Boundary constraints. Indoors the room is 40x40 with walls at +-20, so
    // keep the player just inside them; there is no collision mesh to stop
    // them walking out otherwise.
    const limit = insideBuilding ? 18.5 : 50
    camera.position.x = MathUtils.clamp(camera.position.x, -limit, limit)
    camera.position.z = MathUtils.clamp(camera.position.z, -limit, limit)
    camera.position.y = Math.max(camera.position.y, 1.5)

    // Always update backend position (even when not moving, to send final position on stop)
    const backendCoords = worldTo2D(camera.position.x, camera.position.z)
    const isMoving = direction.current.length() > 0
    
    // Determine direction based on movement
    let playerDirection = 'down'
    if (isMoving) {
      if (Math.abs(direction.current.x) > Math.abs(direction.current.z)) {
        playerDirection = direction.current.x > 0 ? 'right' : 'left'
      } else if (Math.abs(direction.current.z) > 0.1) {
        playerDirection = direction.current.z > 0 ? 'down' : 'up'
      }
    }

    // Update position every frame - the hook will throttle and handle sending updates
    updatePosition({
      x: backendCoords.x,
      y: backendCoords.y,
      direction: playerDirection,
      is_moving: isMoving,
      // Was hardcoded null, so the server never knew which building anyone
      // was standing in, and neither did anyone else's client.
      current_room: insideBuilding?.name ?? null,
    })
  })

  return null
}

// Study area interaction component
function StudyAreaInteraction({ area, campusHook }) {
  const { camera } = useThree()
  const [isInArea, setIsInArea] = useState(false)
  const [showUI, setShowUI] = useState(false)
  
  const { joinStudyRoom, leaveStudyRoom, lobbyMembers } = campusHook

  useFrame(() => {
    const distance = camera.position.distanceTo(new Vector3(...area.position))
    const wasInArea = isInArea
    const nowInArea = distance < area.radius

    setIsInArea(nowInArea)
    
    if (nowInArea && !wasInArea) {
      setShowUI(true)
    } else if (!nowInArea && wasInArea) {
      setShowUI(false)
      leaveStudyRoom(area.id)
    }
  })

  const handleJoinArea = () => {
    joinStudyRoom(area.id)
  }

  const handleLeaveArea = () => {
    leaveStudyRoom(area.id)
    setShowUI(false)
  }

  if (!showUI) return null

  // Get members in this study area (simplified - you might want to track this differently)
  const studyMembers = lobbyMembers.slice(0, Math.floor(Math.random() * area.maxUsers))

  return (
    <Html position={area.position} center zIndexRange={[9, 0]}>
      <div className="bg-black bg-opacity-95 backdrop-blur-sm border border-blue-500/30 rounded-xl p-6 text-white text-center min-w-[350px] shadow-2xl pointer-events-auto">
        <div className="text-3xl mb-3">{area.icon}</div>
        <h3 className="text-xl font-bold text-blue-400 mb-2">{area.name}</h3>
        <p className="text-gray-300 mb-4 text-sm leading-relaxed">{area.description}</p>

        <div className="bg-gray-800 rounded-lg p-3 mb-4">
          <div className="text-xs text-gray-400 mb-1">Current Activity</div>
          <div className="text-sm font-semibold text-green-400">
            👥 {studyMembers.length}/{area.maxUsers} students
          </div>
          <div className="text-xs text-blue-400 mt-1">
            📚 {area.subject} • ⏱️ {area.duration}
          </div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={handleJoinArea}
            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-lg text-sm font-medium transition-colors"
          >
            Join Study
          </button>
          <button
            onClick={handleLeaveArea}
            className="flex-1 bg-gray-600 hover:bg-gray-700 text-white py-2 px-4 rounded-lg text-sm font-medium transition-colors"
          >
            Leave Area
          </button>
        </div>
      </div>
    </Html>
  )
}

// Main Campus component with backend integration
const CampusWithBackend = () => {
  const navigate = useNavigate()
  const { lobbyId: rawLobbyId } = useParams()
  // Sanitize route param: some callers may accidentally navigate to '/campus-simulator/null'
  const lobbyId = (rawLobbyId === 'null' || rawLobbyId === 'undefined') ? null : rawLobbyId;
  const [isChatOpen, setIsChatOpen] = useState(false)
  const [insideBuilding, setInsideBuilding] = useState(null)
  const isTouchDevice = useIsTouchDevice()
  const touchState = useRef(createTouchState())
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [shareExpanded, setShareExpanded] = useState(false)
  const [currentUser, setCurrentUser] = useState(getCurrentUser())

  // Initialize campus simulation hook
  const campusHook = useCampusSimulator(lobbyId)
  
  const {
    isConnected,
    isLoading,
    error,
    currentLobby,
    lobbyMembers,
    playerPositions,
    userPosition,
    disconnect,
    coordsTo3D
  } = campusHook

  // Release the pointer when any panel opens: while it is locked the cursor is
  // hidden and clicks go to the 3D view instead of the UI.
  useEffect(() => {
    if ((isChatOpen || isMenuOpen || insideBuilding) && document.pointerLockElement) {
      document.exitPointerLock()
    }
  }, [isChatOpen, isMenuOpen, insideBuilding])

  // Voice rides on the positions the game already streams.
  const voice = useCampusVoice({
    lobbyId,
    userPosition,
    playerPositions,
    enabled: isConnected,
  })

  // LiveKit identities are "user-<id>", which is not a name to put on screen.
  const sharerName = useMemo(() => {
    const identity = voice.screenShare?.identity
    if (!identity) return 'Someone'
    const userId = identity.replace(/^user-/, '')
    const member = (voice.permissions?.members || []).find(
      (m) => String(m.user_id) === userId,
    )
    return member?.full_name || 'Someone'
  }, [voice.screenShare?.identity, voice.permissions])

  /**
   * A share belongs to the room it is being given in.
   *
   * The projector used to draw whatever was being shared in the lobby onto
   * whichever building the viewer happened to walk into, so a presentation in
   * the library appeared on the lecture hall wall to someone who was never in
   * the room. Now the presenter's own building has to match yours.
   *
   * Your own share always shows: you are, by definition, in your own room.
   */
  const shareIsInThisRoom = useMemo(() => {
    if (!voice.screenShare || !insideBuilding) return false
    if (voice.screenShare.isLocal) return true

    const userId = String(voice.screenShare.identity || '').replace(/^user-/, '')
    const presenter = playerPositions?.get?.(userId) ?? playerPositions?.get?.(Number(userId))
    // Without a position for the presenter their room is unknown, and showing
    // the share everywhere is the behaviour being fixed.
    return Boolean(presenter && presenter.current_room === insideBuilding.name)
  }, [voice.screenShare, insideBuilding, playerPositions])

  const sharerRoom = useMemo(() => {
    if (!voice.screenShare || voice.screenShare.isLocal) return null
    const userId = String(voice.screenShare.identity || '').replace(/^user-/, '')
    const presenter = playerPositions?.get?.(userId) ?? playerPositions?.get?.(Number(userId))
    return presenter?.current_room || null
  }, [voice.screenShare, playerPositions])

  // Nothing to zoom into once the share stops, or once it is out of the room.
  useEffect(() => {
    if (!voice.screenShare || !shareIsInThisRoom) setShareExpanded(false)
  }, [voice.screenShare, shareIsInThisRoom])


  // Fetch current user data
  useEffect(() => {
    const fetchCurrentUser = async () => {
      try {
        // Was fetch('/api/auth/me/'): a relative path, so it hit the web server
        // rather than the API and came back as index.html, and that endpoint
        // does not exist either. The current user is /auth/user/.
        if (isAuthenticated()) {
          const userData = await api.get('/auth/user/')
          setCurrentUser({
            id: userData.id,
            name: userData.full_name || userData.username,
            avatar: "👤",
            year: userData.year || "Student",
            major: userData.major || "UFAZ",
            color: `hsl(${userData.id * 137.5 % 360}, 70%, 60%)`,
            level: 1,
            achievements: [],
          })
        }
      } catch (error) {
        console.error('Failed to fetch user data:', error)
      }
    }

    fetchCurrentUser()
  }, [])

  // Handle disconnect and navigation
  const handleDisconnect = () => {
    disconnect()
    navigate('/campus-simulator')
  }

  // Convert backend player positions to 3D world coordinates
  // Filter out current user's position since they control their own camera (first-person view)
  const playerAvatars = useMemo(() => {
    const avatars = []
    const currentUserId = currentUser?.id
    playerPositions.forEach((position, userId) => {
      // Skip current user's position - they control their own camera, not a separate avatar
      if (userId === currentUserId) {
        return
      }
      const worldPos = coordsTo3D(position.x, position.y)
      avatars.push({
        id: userId,
        position: { x: worldPos.x, z: worldPos.z },
        userData: {
          username: position.username,
          full_name: position.full_name || position.username,  // Use full_name, fallback to username
          color: `hsl(${userId * 137.5 % 360}, 70%, 60%)` // Generate color from user ID
        }
      })
    })
    return avatars
  }, [playerPositions, coordsTo3D, currentUser?.id])

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-indigo-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <h2 className="text-2xl font-bold text-white mb-2">Connecting to Campus...</h2>
          <p className="text-gray-400">Joining lobby {lobbyId}</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-red-900 to-gray-900 flex items-center justify-center">
        <div className="text-center bg-gray-800 p-8 rounded-xl border border-red-500">
          <h2 className="text-2xl font-bold text-red-400 mb-4">Connection Failed</h2>
          <p className="text-gray-300 mb-6">{error}</p>
          <div className="flex gap-4 justify-center">
            <button
              onClick={() => window.location.reload()}
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium transition-colors"
            >
              Retry
            </button>
            <button
              onClick={() => navigate('/campus-simulator')}
              className="bg-gray-600 hover:bg-gray-700 text-white px-6 py-3 rounded-lg font-medium transition-colors"
            >
              Back to Lobbies
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <>
      <Helmet>
        <title>Ufazien | Campus id: {lobbyId}</title>
        <meta name="description" content="Build and explore virtual campuses with friends in real-time 3D environments." />
      </Helmet>
      <div className="h-screen w-screen relative overflow-hidden">
        {/* Connection status. A dot on touch, where the label wastes scarce width. */}
        <div className="absolute top-4 left-4 z-10 pointer-events-auto">
          {isTouchDevice ? (
            <span
              title={isConnected ? 'Connected' : 'Disconnected'}
              className={`block w-3 h-3 rounded-full ring-2 ring-black/40 ${
                isConnected ? 'bg-green-400' : 'bg-red-400'
              }`}
            />
          ) : (
            <div className={`px-4 py-2 rounded-lg text-sm font-medium ${
              isConnected
                ? 'bg-green-900/80 text-green-200 border border-green-500/50'
                : 'bg-red-900/80 text-red-200 border border-red-500/50'
            }`}>
              {isConnected ? '🟢 Connected' : '🔴 Disconnected'}
            </div>
          )}
      </div>

      {insideBuilding && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 pointer-events-auto flex items-center gap-3 bg-black/80 text-white px-4 py-2 rounded-xl border border-blue-500/30">
          <span className="text-sm">Inside {insideBuilding.icon} {insideBuilding.name}</span>
          <button
            onClick={() => setInsideBuilding(null)}
            className="px-3 py-1 rounded bg-blue-600 hover:bg-blue-500 text-xs"
          >
            Leave building
          </button>
        </div>
      )}

      {/* Chat takes over the bottom of a phone screen, which is exactly where
          the controls live. Nobody steers while typing, so they stand down. */}
      {isTouchDevice && !isChatOpen && (
        <TouchControls
          stateRef={touchState}
          insideBuilding={insideBuilding}
          canInteract
        />
      )}

      {/* Voice, screen share and host controls. On touch these live inside the
          settings menu instead, so the playfield stays clear. */}
      {!isTouchDevice && (
      <div className="absolute z-20 pointer-events-auto bottom-4 left-4">
        <VoicePanel
          connected={voice.connected}
          error={voice.error}
          participants={voice.participants}
          micEnabled={voice.micEnabled}
          mayScreenShare={voice.mayScreenShare}
          isHost={voice.isHost}
          permissions={voice.permissions}
          onToggleMic={voice.toggleMic}
          onToggleScreenShare={voice.toggleScreenShare}
          onSetMemberMuted={voice.setMemberMuted}
          onSetMemberScreenShare={voice.setMemberScreenShare}
        />
      </div>
      )}

      {/* A share belongs on the projector screen inside a building, not pasted
          over the player's view. Out on the campus there is no screen to put it
          on, so all they get is a nudge to go and watch it. */}
      {voice.screenShare && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-20 pointer-events-auto">
          <div className="bg-black/75 backdrop-blur-sm border border-blue-500/30 text-white rounded-full pl-3 pr-1.5 py-1 flex items-center gap-2 text-xs">
            <MonitorUp className="w-3.5 h-3.5 text-blue-300 shrink-0" />
            <span className="truncate max-w-[38vw]">
              {voice.screenShare.isLocal
                ? 'You are sharing your screen'
                : shareIsInThisRoom
                  ? `${sharerName} is sharing a screen`
                  : sharerRoom
                    ? `${sharerName} is presenting in ${sharerRoom}`
                    : `${sharerName} is sharing a screen elsewhere`}
            </span>
            {/* Only offered where the share is actually happening. A button
                that opened it from across the campus would put the projector
                back to being lobby-wide. */}
            {shareIsInThisRoom && (
              <button
                onClick={() => setShareExpanded(true)}
                className="px-2 py-0.5 rounded-full bg-blue-600 hover:bg-blue-700 shrink-0"
              >
                Zoom in
              </button>
            )}
          </div>
        </div>
      )}

      <ScreenShareStage
        screenShare={shareIsInThisRoom ? voice.screenShare : null}
        expanded={shareExpanded && shareIsInThisRoom}
        onClose={() => setShareExpanded(false)}
      />


      {/* Lobby info. One compact line on touch; the full card wastes the width. */}
      <div className="absolute top-4 right-4 z-10 pointer-events-auto max-w-[45vw]">
        {isTouchDevice ? (
          <div className="bg-black/70 backdrop-blur-sm text-white px-2.5 py-1 rounded-lg border border-blue-500/30 flex items-center gap-1.5 text-xs">
            <span className="truncate max-w-[26vw] text-blue-300 font-medium">
              {currentLobby?.name || 'Campus'}
            </span>
            <span className="flex items-center gap-1 text-gray-300 shrink-0">
              <Users className="w-3 h-3" />
              {lobbyMembers.length}
            </span>
          </div>
        ) : (
          <div className="bg-black bg-opacity-80 backdrop-blur-sm text-white p-4 rounded-xl border border-blue-500/30">
            <h3 className="font-bold text-lg text-blue-400">{currentLobby?.name || 'Campus Lobby'}</h3>
            <p className="text-sm text-gray-300 flex items-center gap-2">
              <Users className="w-4 h-4" />
              {lobbyMembers.length} students online
            </p>
          </div>
        )}
      </div>

      {/* Game Menu */}
      {/* Top-left, under the connection pill: bottom-left belongs to the voice
          panel, and the two overlapped each other. The Toggle Mic and Toggle
          Video entries had no handlers and duplicated the voice panel, so they
          are gone; Leave Campus is the only thing this menu actually did. */}
      <div className="absolute top-16 left-4 z-20 pointer-events-auto">
        <div className="flex flex-col gap-2 items-start">
          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            aria-label="Campus menu"
            className="bg-gray-800 hover:bg-gray-700 text-white p-2.5 rounded-full shadow-lg transition-all"
          >
            <Settings className="w-5 h-5" />
          </button>

          {isMenuOpen && (
            <div className="bg-black bg-opacity-90 backdrop-blur-sm border border-gray-600 rounded-lg p-3 w-[min(17rem,80vw)] max-h-[70vh] overflow-y-auto space-y-3">
              {isTouchDevice && (
                <VoicePanel
                  connected={voice.connected}
                  error={voice.error}
                  participants={voice.participants}
                  micEnabled={voice.micEnabled}
                  mayScreenShare={voice.mayScreenShare}
                  isHost={voice.isHost}
                  permissions={voice.permissions}
                  onToggleMic={voice.toggleMic}
                  onToggleScreenShare={voice.toggleScreenShare}
                  onSetMemberMuted={voice.setMemberMuted}
                  onSetMemberScreenShare={voice.setMemberScreenShare}
                  embedded
                />
              )}
              <button
                onClick={handleDisconnect}
                className="w-full text-left px-3 py-2 text-red-400 hover:bg-red-900/30 rounded flex items-center gap-2 text-sm"
              >
                <LogOut className="w-4 h-4" />
                Leave Campus
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 3D Canvas */}
      <KeyboardControls map={keyMap}>
        <Canvas id="campus-canvas" shadows camera={{ position: [0, 1.5, 0], fov: 75 }}>
          <Suspense fallback={null}>
            {insideBuilding ? (
              <BuildingInterior
                name={insideBuilding.name}
                onExit={() => setInsideBuilding(null)}
              >
                <ProjectorScreen video={shareIsInThisRoom ? voice.screenShare?.element || null : null} />
              </BuildingInterior>
            ) : (
              <>
                <CampusEnvironment />
                <CampusGround />
                <CampusProps />

                {campusBuildings.map((building) => (
                  <Building
                    key={building.id}
                    position={building.position}
                    size={building.size}
                    color={building.color}
                    name={building.name}
                    icon={building.icon}
                    onEnter={() => setInsideBuilding(building)}
                  />
                ))}
              </>
            )}

            {/* Study Areas */}
            {studyAreas.map((area) => (
              <group key={area.id}>
                {/* Area Visual Indicator */}
                <mesh position={area.position}>
                  <cylinderGeometry args={[area.radius, area.radius, 0.1, 32]} />
                  <meshStandardMaterial color="#4F46E5" transparent opacity={0.2} />
                </mesh>
                
                {/* Study Area Interaction */}
                <StudyAreaInteraction area={area} campusHook={campusHook} />
              </group>
            ))}

            {/* Other Players */}
            {playerAvatars.map((avatar) => (
              <PlayerAvatar
                key={avatar.id}
                position={avatar.position}
                userData={avatar.userData}
                isCurrentUser={false}
              />
            ))}

            {/* First Person Player Controller */}
            <InteriorCameraPlacement insideBuilding={insideBuilding} />
            <ProximityInteraction
              buildings={campusBuildings}
              insideBuilding={insideBuilding}
              onEnter={setInsideBuilding}
              onExit={() => setInsideBuilding(null)}
              touch={touchState}
            />
            <Player campusHook={campusHook} insideBuilding={insideBuilding} touch={touchState} />
            
            {/* Camera Controls */}
            {/* Without a selector drei binds the lock handler to document, so every
   HUD click grabbed the pointer and the next click never landed. */}
            {!isTouchDevice && <PointerLockControls selector="#campus-canvas" />}
          </Suspense>
        </Canvas>
      </KeyboardControls>

      {/* Chat System */}
      <ChatSystem
        isOpen={isChatOpen}
        onToggle={() => setIsChatOpen(!isChatOpen)}
        campusHook={campusHook}
        isTouchDevice={isTouchDevice}
      />

      {/* Instructions */}
      <div className={`absolute left-1/2 transform -translate-x-1/2 pointer-events-none z-10 max-w-[90vw] ${isTouchDevice ? "hidden" : "bottom-4"}`}>
        <div className="bg-black bg-opacity-75 text-white px-4 py-2 rounded-lg text-sm">
          <span className="hidden sm:inline">WASD to move • Space to jump • Shift to run • Click to look around • E to enter or leave a building</span>
          <span className="sm:hidden">Drag to look • Joystick to move</span>
        </div>
      </div>
    </div>
    </>
  )
}

export default CampusWithBackend
