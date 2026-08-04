import React, { useState, useRef, useCallback, Suspense, useEffect, useMemo } from "react"
import { Helmet } from "react-helmet"
import { Canvas, useFrame, useThree } from "@react-three/fiber"
import { Text, Html, Sky, KeyboardControls, useKeyboardControls, PointerLockControls } from "@react-three/drei"
import { Vector3, MathUtils } from "three"
import { useNavigate, useParams } from "react-router-dom"
import { MessageCircle, Users, Settings, LogOut, Mic, MicOff, Video, VideoOff } from "lucide-react"
import { useCampusSimulator } from '../../hooks/useCampusSimulator'
import { useCampusVoice } from '../../hooks/useCampusVoice'
import VoicePanel, { ScreenShareBoard } from '../../components/campus/VoicePanel'

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

// Enhanced chat system with backend integration
function ChatSystem({ isOpen, onToggle, campusHook }) {
  const [newMessage, setNewMessage] = useState("")
  const [activeTab, setActiveTab] = useState("global")
  const [isTyping, setIsTyping] = useState(false)
  
  const { chatMessages, sendChatMessage, getNearbyPlayers } = campusHook

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
      <div className="absolute bottom-24 right-4 pointer-events-auto">
        <button
          onClick={onToggle}
          className="bg-blue-600 hover:bg-blue-700 text-white p-4 rounded-full shadow-lg transition-all transform hover:scale-105"
        >
          <MessageCircle className="w-6 h-6" />
          {chatMessages.length > 0 && (
            <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full w-6 h-6 flex items-center justify-center">
              {chatMessages.length > 9 ? "9+" : chatMessages.length}
            </span>
          )}
        </button>
      </div>
    )
  }

  return (
    <div className="absolute bottom-4 right-4 w-96 h-[500px] bg-black bg-opacity-95 backdrop-blur-sm border border-blue-500/30 rounded-xl pointer-events-auto shadow-2xl">
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
      <div className="flex-1 overflow-y-auto p-4 space-y-3 h-[350px]">
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
            onKeyPress={(e) => e.key === "Enter" && handleSend()}
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
      {/* Player Body */}
      <mesh position={[0, 0.5, 0]}>
        <cylinderGeometry args={[0.3, 0.3, 1]} />
        <meshStandardMaterial color={userData.color || "#4F46E5"} />
      </mesh>
      
      {/* Player Head */}
      <mesh position={[0, 1.2, 0]}>
        <sphereGeometry args={[0.2]} />
        <meshStandardMaterial color="#FDBCB4" />
      </mesh>

      {/* Full Name Label */}
      <Html position={[0, 2, 0]} center>
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

// First person player controller with backend position sync
function Player({ campusHook }) {
  const { camera } = useThree()
  const [, get] = useKeyboardControls()
  const playerRef = useRef()
  const velocity = useRef(new Vector3())
  const direction = useRef(new Vector3())
  const [isOnGround, setIsOnGround] = useState(true)
  
  const { updatePosition, userPosition, worldTo2D } = campusHook

  useFrame((state, delta) => {
    const { forward, backward, leftward, rightward, jump, run } = get()

    // Movement calculations
    const speed = run ? 8 : 4
    const jumpForce = 8

    // Get camera direction
    direction.current.set(0, 0, 0)
    
    if (forward) direction.current.z -= 1
    if (backward) direction.current.z += 1
    if (leftward) direction.current.x -= 1
    if (rightward) direction.current.x += 1

    // Normalize and apply speed
    if (direction.current.length() > 0) {
      direction.current.normalize()
      direction.current.multiplyScalar(speed * delta)
      
      // Apply camera rotation to movement direction
      direction.current.applyEuler(camera.rotation)
      direction.current.y = 0 // Keep movement horizontal
    }

    // Jump logic
    if (jump && isOnGround) {
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

    // Boundary constraints
    camera.position.x = MathUtils.clamp(camera.position.x, -50, 50)
    camera.position.z = MathUtils.clamp(camera.position.z, -50, 50)
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
      current_room: null // TODO: Detect current room
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
    <Html position={area.position} center>
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
  const [isMenuOpen, setIsMenuOpen] = useState(false)
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

  // Voice rides on the positions the game already streams.
  const voice = useCampusVoice({
    lobbyId,
    userPosition,
    playerPositions,
    enabled: isConnected,
  })

  // Fetch current user data
  useEffect(() => {
    const fetchCurrentUser = async () => {
      try {
        const token = localStorage.getItem('access')
        if (token) {
          const response = await fetch('/api/auth/me/', {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            }
          })
          if (response.ok) {
            const userData = await response.json()
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
        {/* Connection Status */}
        <div className="absolute top-4 left-4 z-10 pointer-events-auto">
          <div className={`px-4 py-2 rounded-lg text-sm font-medium ${
            isConnected 
            ? 'bg-green-900/80 text-green-200 border border-green-500/50' 
            : 'bg-red-900/80 text-red-200 border border-red-500/50'
        }`}>
          {isConnected ? '🟢 Connected' : '🔴 Disconnected'}
        </div>
      </div>

      {/* Voice, screen share and host controls */}
      <div className="absolute bottom-4 left-4 z-10 pointer-events-auto">
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

      {voice.screenShare && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-20 w-[60vw] h-[60vh] pointer-events-auto">
          <ScreenShareBoard screenShare={voice.screenShare} />
        </div>
      )}

      {/* Lobby Info */}
      <div className="absolute top-4 right-4 z-10 pointer-events-auto">
        <div className="bg-black bg-opacity-80 backdrop-blur-sm text-white p-4 rounded-xl border border-blue-500/30">
          <h3 className="font-bold text-lg text-blue-400">{currentLobby?.name || 'Campus Lobby'}</h3>
          <p className="text-sm text-gray-300 flex items-center gap-2">
            <Users className="w-4 h-4" />
            {lobbyMembers.length} students online
          </p>
        </div>
      </div>

      {/* Game Menu */}
      <div className="absolute bottom-4 left-4 z-10 pointer-events-auto">
        <div className="flex flex-col gap-2">
          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="bg-gray-800 hover:bg-gray-700 text-white p-3 rounded-full shadow-lg transition-all"
          >
            <Settings className="w-6 h-6" />
          </button>
          
          {isMenuOpen && (
            <div className="bg-black bg-opacity-90 backdrop-blur-sm border border-gray-600 rounded-lg p-4 min-w-[200px]">
              <div className="space-y-2">
                <button className="w-full text-left px-3 py-2 text-white hover:bg-gray-700 rounded flex items-center gap-2">
                  <Mic className="w-4 h-4" />
                  Toggle Mic
                </button>
                <button className="w-full text-left px-3 py-2 text-white hover:bg-gray-700 rounded flex items-center gap-2">
                  <Video className="w-4 h-4" />
                  Toggle Video
                </button>
                <hr className="border-gray-600" />
                <button
                  onClick={handleDisconnect}
                  className="w-full text-left px-3 py-2 text-red-400 hover:bg-red-900/30 rounded flex items-center gap-2"
                >
                  <LogOut className="w-4 h-4" />
                  Leave Campus
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 3D Canvas */}
      <KeyboardControls map={keyMap}>
        <Canvas shadows camera={{ position: [0, 1.5, 0], fov: 75 }}>
          <Suspense fallback={null}>
            {/* Environment */}
            <Sky sunPosition={[100, 20, 100]} />
            <ambientLight intensity={0.3} />
            <directionalLight position={[50, 50, 25]} intensity={1} castShadow />

            {/* Campus Ground */}
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
              <planeGeometry args={[100, 100]} />
              <meshStandardMaterial color="#2A5D31" />
            </mesh>

            {/* Campus Buildings */}
            {campusBuildings.map((building) => (
              <group key={building.id} position={building.position}>
                <mesh castShadow>
                  <boxGeometry args={building.size} />
                  <meshStandardMaterial color={building.color} />
                </mesh>
                <Html position={[0, building.size[1] + 1, 0]} center>
                  <div className="bg-black bg-opacity-75 text-white px-3 py-1 rounded text-sm whitespace-nowrap pointer-events-none">
                    {building.icon} {building.name}
                  </div>
                </Html>
              </group>
            ))}

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
            <Player campusHook={campusHook} />
            
            {/* Camera Controls */}
            <PointerLockControls />
          </Suspense>
        </Canvas>
      </KeyboardControls>

      {/* Chat System */}
      <ChatSystem
        isOpen={isChatOpen}
        onToggle={() => setIsChatOpen(!isChatOpen)}
        campusHook={campusHook}
      />

      {/* Instructions */}
      <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 pointer-events-none">
        <div className="bg-black bg-opacity-75 text-white px-4 py-2 rounded-lg text-sm">
          Use WASD to move • Space to jump • Shift to run • Click to look around
        </div>
      </div>
    </div>
    </>
  )
}

export default CampusWithBackend
