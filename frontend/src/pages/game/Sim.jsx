"use client"

import { useState, useRef, useCallback, Suspense, useEffect, useMemo } from "react"
import { Canvas, useFrame, useThree } from "@react-three/fiber"
import { Text, Html, Sky, KeyboardControls, useKeyboardControls, PointerLockControls } from "@react-three/drei"
import { Vector3 } from "three"
import { useNavigate } from "react-router-dom"

// Mock user data - replace with real authentication
const currentUser = {
  id: 1,
  name: "Sarah Johnson",
  avatar: "👩‍🎓",
  year: "3rd Year",
  major: "Computer Science",
  color: "#4F46E5",
}

// Online users simulation
const mockOnlineUsers = [
  { id: 2, name: "Ahmed Hassan", avatar: "👨‍💻", position: [5, 0.5, 3], color: "#EF4444" },
  { id: 3, name: "Maria Rodriguez", avatar: "👩‍🔬", position: [-3, 0.5, -5], color: "#10B981" },
  { id: 4, name: "David Kim", avatar: "👨‍🎓", position: [8, 0.5, -2], color: "#F59E0B" },
  { id: 5, name: "Elena Petrov", avatar: "👩‍💼", position: [-6, 0.5, 4], color: "#8B5CF6" },
]

// Chat system component
function ChatSystem({ isOpen, onToggle, messages, onSendMessage }) {
  const [newMessage, setNewMessage] = useState("")
  const [activeTab, setActiveTab] = useState("global") // global, study-group, nearby

  const handleSend = () => {
    if (newMessage.trim()) {
      onSendMessage(newMessage, activeTab)
      setNewMessage("")
    }
  }

  if (!isOpen) {
    return (
      <div className="absolute bottom-20 right-4 pointer-events-auto">
        <button
          onClick={onToggle}
          className="bg-blue-600 hover:bg-blue-700 text-white p-3 rounded-full shadow-lg transition-colors"
        >
          💬 Chat ({messages.length})
        </button>
      </div>
    )
  }

  return (
    <div className="absolute bottom-4 right-4 w-80 h-96 bg-black bg-opacity-90 backdrop-blur-sm border border-blue-500/30 rounded-lg pointer-events-auto">
      {/* Chat Header */}
      <div className="flex items-center justify-between p-3 border-b border-gray-700">
        <div className="flex space-x-2">
          {["global", "study-group", "nearby"].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                activeTab === tab ? "bg-blue-600 text-white" : "text-gray-400 hover:text-white"
              }`}
            >
              {tab === "global" ? "🌍 Global" : tab === "study-group" ? "📚 Study" : "📍 Nearby"}
            </button>
          ))}
        </div>
        <button onClick={onToggle} className="text-gray-400 hover:text-white">
          ✕
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 p-3 h-64 overflow-y-auto space-y-2">
        {messages
          .filter((msg) => msg.channel === activeTab)
          .map((message, index) => (
            <div key={index} className="text-sm">
              <span className="text-blue-400 font-medium">{message.user}:</span>
              <span className="text-white ml-2">{message.text}</span>
              <div className="text-xs text-gray-500">{message.time}</div>
            </div>
          ))}
      </div>

      {/* Input */}
      <div className="p-3 border-t border-gray-700">
        <div className="flex space-x-2">
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyPress={(e) => e.key === "Enter" && handleSend()}
            placeholder={`Message ${activeTab}...`}
            className="flex-1 bg-gray-800 text-white px-3 py-2 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={handleSend}
            className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded text-sm transition-colors"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  )
}

// Study area interaction component
function StudyAreaUI({ area, onJoin, onLeave, isInArea }) {
  if (!isInArea) return null

  return (
    <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 pointer-events-auto">
      <div className="bg-black bg-opacity-90 backdrop-blur-sm border border-blue-500/30 rounded-lg p-6 text-white text-center min-w-[300px]">
        <h3 className="text-xl font-bold text-blue-400 mb-2">{area.name}</h3>
        <p className="text-gray-300 mb-4">{area.description}</p>
        <div className="text-sm text-gray-400 mb-4">
          👥 {area.currentUsers}/{area.maxUsers} students
        </div>
        <div className="space-y-2">
          <button
            onClick={onJoin}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded transition-colors"
          >
            Join Study Session
          </button>
          <button
            onClick={onLeave}
            className="w-full bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded transition-colors"
          >
            Leave Area
          </button>
        </div>
      </div>
    </div>
  )
}

// Enhanced Game UI with social features
function GameUI({
  showMenu,
  onToggleMenu,
  onExitGame,
  onlineUsers,
  chatOpen,
  onToggleChat,
  messages,
  onSendMessage,
  studyArea,
  onJoinStudy,
  onLeaveStudy,
  isInStudyArea,
}) {
  return (
    <div className="absolute top-0 left-0 w-full h-full pointer-events-none z-10">
      {/* Top HUD */}
      <div className="absolute top-4 left-4 bg-black bg-opacity-80 text-white p-4 rounded-lg pointer-events-auto backdrop-blur-sm border border-blue-500/30">
        <h3 className="text-lg font-bold text-blue-400 mb-2">🏛️ UFAZ University Campus</h3>
        <div className="text-sm space-y-1">
          <div className="text-gray-300">Welcome, {currentUser.name}!</div>
          <div className="text-green-400">👥 {onlineUsers.length + 1} students online</div>
          <div className="text-yellow-400">📚 3 study groups active</div>
        </div>
      </div>

      {/* Online Users List */}
      <div className="absolute top-4 right-4 bg-black bg-opacity-80 text-white p-4 rounded-lg pointer-events-auto backdrop-blur-sm border border-blue-500/30 max-w-xs">
        <h4 className="text-sm font-bold text-blue-400 mb-2">👥 Online Students</h4>
        <div className="space-y-1 text-xs">
          <div className="flex items-center space-x-2">
            <span>{currentUser.avatar}</span>
            <span className="text-green-400">{currentUser.name} (You)</span>
          </div>
          {onlineUsers.map((user) => (
            <div key={user.id} className="flex items-center space-x-2">
              <span>{user.avatar}</span>
              <span className="text-gray-300">{user.name}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Movement Instructions */}
      <div className="absolute bottom-4 left-4 bg-black bg-opacity-70 text-white p-3 rounded-lg pointer-events-auto">
        <div className="text-sm space-y-1">
          <div>
            <strong className="text-blue-400">Movement:</strong>
          </div>
          <div>WASD: Move • Space: Jump • Mouse: Look</div>
          <div>
            <strong className="text-green-400">Social:</strong>
          </div>
          <div>T: Chat • E: Interact • Tab: Players</div>
          <div>ESC: Menu</div>
        </div>
      </div>

      {/* Study Area Interaction */}
      <StudyAreaUI area={studyArea} onJoin={onJoinStudy} onLeave={onLeaveStudy} isInArea={isInStudyArea} />

      {/* Chat System */}
      <ChatSystem isOpen={chatOpen} onToggle={onToggleChat} messages={messages} onSendMessage={onSendMessage} />

      {/* ESC Menu */}
      {showMenu && (
        <div className="absolute inset-0 bg-black bg-opacity-80 flex items-center justify-center pointer-events-auto">
          <div className="bg-gray-900 border border-blue-500/30 rounded-lg p-8 text-white min-w-[400px] backdrop-blur-sm">
            <h2 className="text-2xl font-bold text-blue-400 mb-6 text-center">Campus Menu</h2>
            <div className="space-y-4">
              <button
                onClick={onToggleMenu}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-lg transition-colors"
              >
                Resume Exploration
              </button>
              <button className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-6 rounded-lg transition-colors">
                Study Groups
              </button>
              <button className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 px-6 rounded-lg transition-colors">
                Campus Map
              </button>
              <button className="w-full bg-yellow-600 hover:bg-yellow-700 text-white font-bold py-3 px-6 rounded-lg transition-colors">
                Settings
              </button>
              <button
                onClick={onExitGame}
                className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-6 rounded-lg transition-colors"
              >
                Exit to Dashboard
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Crosshair */}
      {!showMenu && (
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 pointer-events-none">
          <div className="w-4 h-4 border-2 border-white rounded-full opacity-70"></div>
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-2 h-2 bg-white rounded-full"></div>
        </div>
      )}

      {/* Mini Map */}
      <div className="absolute bottom-20 right-4 w-32 h-32 bg-black bg-opacity-80 border border-blue-500/30 rounded-lg pointer-events-auto">
        <div className="p-2 text-white text-xs text-center">
          <div className="text-blue-400 font-bold mb-1">Campus Map</div>
          <div className="relative w-full h-20 bg-gray-800 rounded">
            {/* Simple mini-map representation */}
            <div className="absolute top-1/2 left-1/2 w-2 h-2 bg-blue-400 rounded-full transform -translate-x-1/2 -translate-y-1/2"></div>
            {onlineUsers.map((user) => (
              <div
                key={user.id}
                className="absolute w-1 h-1 rounded-full"
                style={{
                  backgroundColor: user.color,
                  left: `${50 + (user.position[0] / 20) * 40}%`,
                  top: `${50 + (user.position[2] / 20) * 40}%`,
                }}
              ></div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// Other player avatars
function OtherPlayer({ user, currentPlayerPosition }) {
  const meshRef = useRef()
  const [isNearby, setIsNearby] = useState(false)

  useFrame(() => {
    if (meshRef.current && currentPlayerPosition) {
      const distance = meshRef.current.position.distanceTo(currentPlayerPosition)
      setIsNearby(distance < 5)

      // Simple idle animation
      meshRef.current.rotation.y += 0.01
    }
  })

  return (
    <group position={user.position}>
      {/* Player body */}
      <mesh ref={meshRef} position={[0, 1, 0]} castShadow>
        <capsuleGeometry args={[0.3, 1.4]} />
        <meshStandardMaterial color={user.color} />
      </mesh>

      {/* Name tag */}
      <Html position={[0, 2.5, 0]} center>
        <div
          className={`bg-black bg-opacity-80 text-white px-2 py-1 rounded text-xs whitespace-nowrap ${
            isNearby ? "border border-green-400" : ""
          }`}
        >
          {user.avatar} {user.name}
          {isNearby && <div className="text-green-400 text-xs">Press E to interact</div>}
        </div>
      </Html>

      {/* Interaction indicator */}
      {isNearby && (
        <mesh position={[0, 0.1, 0]}>
          <cylinderGeometry args={[1.5, 1.5, 0.1]} />
          <meshStandardMaterial color="#10B981" transparent opacity={0.3} />
        </mesh>
      )}
    </group>
  )
}

// Enhanced Player Character with interaction system
function PlayerCharacter({ isMenuOpen, onPositionChange, onAreaEnter, onAreaLeave }) {
  const meshRef = useRef()
  const { camera } = useThree()
  const [, get] = useKeyboardControls()

  const speed = 6
  const jumpForce = 8
  const gravity = -20
  const height = 1.8
  const groundLevel = 0.5

  const velocityY = useRef(0)
  const isGrounded = useRef(true)
  const currentArea = useRef(null)

  // Study areas definitions
  const studyAreas = useMemo(
    () => [
      {
        id: 1,
        name: "Library Study Hall",
        position: [10, 0, 10],
        radius: 3,
        description: "Quiet study area for focused learning",
      },
      {
        id: 2,
        name: "Computer Lab",
        position: [-10, 0, -10],
        radius: 3,
        description: "Collaborative coding and research",
      },
      {
        id: 3,
        name: "Discussion Circle",
        position: [0, 0, -15],
        radius: 4,
        description: "Group discussions and presentations",
      },
    ],
    [],
  )

  useFrame((state, delta) => {
    if (!meshRef.current || isMenuOpen) return

    const { forward, backward, left, right, jump } = get()

    // Movement logic (same as before)
    const direction = new Vector3()
    camera.getWorldDirection(direction)
    direction.y = 0
    direction.normalize()

    const rightDirection = new Vector3()
    rightDirection.crossVectors(direction, new Vector3(0, 1, 0))

    const velocity = new Vector3(0, 0, 0)

    if (forward) velocity.add(direction.clone().multiplyScalar(speed * delta))
    if (backward) velocity.add(direction.clone().multiplyScalar(-speed * delta))
    if (left) velocity.add(rightDirection.clone().multiplyScalar(-speed * delta))
    if (right) velocity.add(rightDirection.clone().multiplyScalar(speed * delta))

    meshRef.current.position.add(velocity)

    if (jump && isGrounded.current) {
      velocityY.current = jumpForce
      isGrounded.current = false
    }

    velocityY.current += gravity * delta
    meshRef.current.position.y += velocityY.current * delta

    if (meshRef.current.position.y <= groundLevel) {
      meshRef.current.position.y = groundLevel
      velocityY.current = 0
      isGrounded.current = true
    }

    const bounds = 25
    meshRef.current.position.x = Math.max(-bounds, Math.min(bounds, meshRef.current.position.x))
    meshRef.current.position.z = Math.max(-bounds, Math.min(bounds, meshRef.current.position.z))

    const playerPosition = meshRef.current.position
    camera.position.copy(playerPosition)
    camera.position.y = playerPosition.y + height

    // Check for study area interactions
    const playerPos = meshRef.current.position
    let inArea = null

    studyAreas.forEach((area) => {
      const distance = playerPos.distanceTo(new Vector3(...area.position))
      if (distance < area.radius) {
        inArea = area
      }
    })

    if (inArea && currentArea.current?.id !== inArea.id) {
      currentArea.current = inArea
      onAreaEnter(inArea)
    } else if (!inArea && currentArea.current) {
      onAreaLeave()
      currentArea.current = null
    }

    // Update position for other components
    onPositionChange(playerPosition)
  })

  return (
    <mesh ref={meshRef} position={[0, groundLevel, 0]} castShadow visible={false}>
      <capsuleGeometry args={[0.3, 1.4]} />
      <meshStandardMaterial color={currentUser.color} />
    </mesh>
  )
}

// Custom University Campus Model
function UniversityCampus() {
  return (
    <group>
      {/* Campus Ground */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.5, 0]} receiveShadow>
        <planeGeometry args={[60, 60]} />
        <meshStandardMaterial color="#2D5016" />
      </mesh>

      {/* Main Academic Building */}
      <group position={[0, 0, 0]}>
        {/* Main structure */}
        <mesh position={[0, 3, 0]} castShadow receiveShadow>
          <boxGeometry args={[12, 6, 8]} />
          <meshStandardMaterial color="#8B4513" />
        </mesh>
        {/* Roof */}
        <mesh position={[0, 6.5, 0]} castShadow>
          <coneGeometry args={[8, 2, 4]} />
          <meshStandardMaterial color="#654321" />
        </mesh>
        {/* Entrance */}
        <mesh position={[0, 1.5, 4.1]} castShadow receiveShadow>
          <boxGeometry args={[3, 3, 0.2]} />
          <meshStandardMaterial color="#4A4A4A" />
        </mesh>
        {/* Windows */}
        {[-4, -2, 2, 4].map((x, i) => (
          <mesh key={i} position={[x, 4, 4.1]} castShadow>
            <boxGeometry args={[1, 1.5, 0.1]} />
            <meshStandardMaterial color="#87CEEB" />
          </mesh>
        ))}
      </group>

      {/* Library Building */}
      <group position={[15, 0, 5]}>
        <mesh position={[0, 2.5, 0]} castShadow receiveShadow>
          <boxGeometry args={[8, 5, 6]} />
          <meshStandardMaterial color="#A0522D" />
        </mesh>
        <Text position={[0, 4, 3.1]} fontSize={0.8} color="#FFFFFF" anchorX="center" anchorY="middle">
          📚 LIBRARY
        </Text>
      </group>

      {/* Computer Science Building */}
      <group position={[-15, 0, -5]}>
        <mesh position={[0, 3, 0]} castShadow receiveShadow>
          <boxGeometry args={[10, 6, 7]} />
          <meshStandardMaterial color="#2F4F4F" />
        </mesh>
        <Text position={[0, 5, 3.6]} fontSize={0.6} color="#00FFFF" anchorX="center" anchorY="middle">
          💻 COMPUTER LAB
        </Text>
      </group>

      {/* Student Center */}
      <group position={[0, 0, -20]}>
        <mesh position={[0, 2, 0]} castShadow receiveShadow>
          <cylinderGeometry args={[6, 6, 4]} />
          <meshStandardMaterial color="#8A2BE2" />
        </mesh>
        <Text position={[0, 3, 6.1]} fontSize={0.7} color="#FFFFFF" anchorX="center" anchorY="middle">
          🎓 STUDENT CENTER
        </Text>
      </group>

      {/* Cafeteria */}
      <group position={[20, 0, -15]}>
        <mesh position={[0, 2, 0]} castShadow receiveShadow>
          <boxGeometry args={[8, 4, 8]} />
          <meshStandardMaterial color="#FF6347" />
        </mesh>
        <Text position={[0, 3, 4.1]} fontSize={0.6} color="#FFFFFF" anchorX="center" anchorY="middle">
          🍽️ CAFETERIA
        </Text>
      </group>

      {/* Sports Complex */}
      <group position={[-20, 0, 15]}>
        <mesh position={[0, 1.5, 0]} castShadow receiveShadow>
          <boxGeometry args={[12, 3, 10]} />
          <meshStandardMaterial color="#228B22" />
        </mesh>
        <Text position={[0, 2.5, 5.1]} fontSize={0.6} color="#FFFFFF" anchorX="center" anchorY="middle">
          ⚽ SPORTS CENTER
        </Text>
      </group>

      {/* Main Pathways */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.4, 0]}>
        <planeGeometry args={[3, 60]} />
        <meshStandardMaterial color="#696969" />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.4, 0]}>
        <planeGeometry args={[60, 3]} />
        <meshStandardMaterial color="#696969" />
      </mesh>

      {/* Study Area Indicators */}
      <mesh position={[10, 0.1, 10]} receiveShadow>
        <cylinderGeometry args={[3, 3, 0.2]} />
        <meshStandardMaterial color="#4169E1" transparent opacity={0.3} />
      </mesh>
      <mesh position={[-10, 0.1, -10]} receiveShadow>
        <cylinderGeometry args={[3, 3, 0.2]} />
        <meshStandardMaterial color="#32CD32" transparent opacity={0.3} />
      </mesh>
      <mesh position={[0, 0.1, -15]} receiveShadow>
        <cylinderGeometry args={[4, 4, 0.2]} />
        <meshStandardMaterial color="#FF69B4" transparent opacity={0.3} />
      </mesh>

      {/* Trees and Landscaping */}
      {[
        [8, 0, 8],
        [-8, 0, 8],
        [8, 0, -8],
        [-8, 0, -8],
        [12, 0, 0],
        [-12, 0, 0],
        [0, 0, 12],
        [0, 0, -12],
      ].map((pos, i) => (
        <group key={i} position={pos}>
          {/* Tree trunk */}
          <mesh position={[0, 1, 0]} castShadow>
            <cylinderGeometry args={[0.3, 0.3, 2]} />
            <meshStandardMaterial color="#8B4513" />
          </mesh>
          {/* Tree foliage */}
          <mesh position={[0, 2.5, 0]} castShadow>
            <sphereGeometry args={[1.5]} />
            <meshStandardMaterial color="#228B22" />
          </mesh>
        </group>
      ))}

      {/* Benches */}
      {[
        [5, 0, 5],
        [-5, 0, -5],
        [5, 0, -5],
        [-5, 0, 5],
      ].map((pos, i) => (
        <mesh key={i} position={[...pos, 0.25]} castShadow receiveShadow>
          <boxGeometry args={[2, 0.5, 0.8]} />
          <meshStandardMaterial color="#8B4513" />
        </mesh>
      ))}

      {/* Fountain in center */}
      <group position={[0, 0, 0]}>
        <mesh position={[0, 0.5, 0]} castShadow receiveShadow>
          <cylinderGeometry args={[2, 2, 1]} />
          <meshStandardMaterial color="#708090" />
        </mesh>
        <mesh position={[0, 1.5, 0]} castShadow>
          <sphereGeometry args={[0.3]} />
          <meshStandardMaterial color="#4169E1" />
        </mesh>
      </group>
    </group>
  )
}

// Loading component
function LoadingScreen() {
  return (
    <Html center>
      <div className="text-white text-xl text-center">
        <div className="animate-spin w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
        <div className="text-2xl font-bold mb-2">Loading UFAZ Campus...</div>
        <div className="text-sm text-gray-300">Preparing your virtual university experience</div>
      </div>
    </Html>
  )
}

// Main Simulation Component
export default function UfazSimulation() {
  const navigate = useNavigate()
  const [showMenu, setShowMenu] = useState(false)
  const [chatOpen, setChatOpen] = useState(false)
  const [messages, setMessages] = useState([
    { user: "System", text: "Welcome to UFAZ Campus! 🎓", time: "10:00", channel: "global" },
    { user: "Ahmed Hassan", text: "Anyone want to study for the algorithms exam?", time: "10:05", channel: "global" },
    {
      user: "Maria Rodriguez",
      text: "I'm in the library if anyone wants to join!",
      time: "10:07",
      channel: "study-group",
    },
  ])
  const [playerPosition, setPlayerPosition] = useState(new Vector3(0, 0.5, 0))
  const [currentStudyArea, setCurrentStudyArea] = useState(null)
  const [isInStudyArea, setIsInStudyArea] = useState(false)

  const keyboardMap = [
    { name: "forward", keys: ["ArrowUp", "KeyW"] },
    { name: "backward", keys: ["ArrowDown", "KeyS"] },
    { name: "left", keys: ["ArrowLeft", "KeyA"] },
    { name: "right", keys: ["ArrowRight", "KeyD"] },
    { name: "jump", keys: ["Space"] },
  ]

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.code === "Escape") {
        setShowMenu((prev) => !prev)
      } else if (event.code === "KeyT" && !showMenu) {
        setChatOpen((prev) => !prev)
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [showMenu])

  const handleToggleMenu = useCallback(() => {
    setShowMenu((prev) => !prev)
  }, [])

  const handleExitGame = useCallback(() => {
    navigate("/dashboard")
  }, [navigate])

  const handleSendMessage = useCallback((message, channel) => {
    const newMessage = {
      user: currentUser.name,
      text: message,
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      channel: channel,
    }
    setMessages((prev) => [...prev, newMessage])
  }, [])

  const handleAreaEnter = useCallback((area) => {
    setCurrentStudyArea(area)
    setIsInStudyArea(true)
  }, [])

  const handleAreaLeave = useCallback(() => {
    setIsInStudyArea(false)
    setCurrentStudyArea(null)
  }, [])

  const handleJoinStudy = useCallback(() => {
    if (currentStudyArea) {
      const message = `${currentUser.name} joined ${currentStudyArea.name}`
      setMessages((prev) => [
        ...prev,
        {
          user: "System",
          text: message,
          time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          channel: "study-group",
        },
      ])
    }
  }, [currentStudyArea])

  const handleLeaveStudy = useCallback(() => {
    setIsInStudyArea(false)
    setCurrentStudyArea(null)
  }, [])

  return (
    <div className="w-full h-screen relative bg-gradient-to-b from-blue-400 to-blue-600" id="canvas-container">
      <KeyboardControls map={keyboardMap}>
        <Canvas camera={{ position: [0, 1.8, 5], fov: 75 }} shadows>
          {/* Enhanced Lighting */}
          <ambientLight intensity={0.3} />
          <directionalLight
            position={[20, 20, 10]}
            intensity={1}
            castShadow
            shadow-mapSize-width={4096}
            shadow-mapSize-height={4096}
            shadow-camera-far={50}
            shadow-camera-left={-30}
            shadow-camera-right={30}
            shadow-camera-top={30}
            shadow-camera-bottom={-30}
          />
          <pointLight position={[0, 15, 0]} intensity={0.4} />
          <pointLight position={[15, 10, 15]} intensity={0.3} color="#FFE4B5" />
          <pointLight position={[-15, 10, -15]} intensity={0.3} color="#E6E6FA" />

          {/* Environment */}
          <Sky sunPosition={[100, 20, 100]} />
          <fog attach="fog" args={["#87CEEB", 40, 120]} />

          {/* FPS Controls */}
          {!showMenu && <PointerLockControls selector="#canvas-container" />}

          {/* 3D Content */}
          <Suspense fallback={<LoadingScreen />}>
            <UniversityCampus />
            <PlayerCharacter
              isMenuOpen={showMenu}
              onPositionChange={setPlayerPosition}
              onAreaEnter={handleAreaEnter}
              onAreaLeave={handleAreaLeave}
            />
            {mockOnlineUsers.map((user) => (
              <OtherPlayer key={user.id} user={user} currentPlayerPosition={playerPosition} />
            ))}
          </Suspense>
        </Canvas>
      </KeyboardControls>

      {/* Enhanced Game UI */}
      <GameUI
        showMenu={showMenu}
        onToggleMenu={handleToggleMenu}
        onExitGame={handleExitGame}
        onlineUsers={mockOnlineUsers}
        chatOpen={chatOpen}
        onToggleChat={() => setChatOpen((prev) => !prev)}
        messages={messages}
        onSendMessage={handleSendMessage}
        studyArea={currentStudyArea}
        onJoinStudy={handleJoinStudy}
        onLeaveStudy={handleLeaveStudy}
        isInStudyArea={isInStudyArea}
      />
    </div>
  )
}
