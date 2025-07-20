"use client"

import { useState, useRef, useCallback, Suspense, useEffect, useMemo } from "react"
import { Canvas, useFrame, useThree } from "@react-three/fiber"
import { Text, Html, Sky, KeyboardControls, useKeyboardControls, PointerLockControls } from "@react-three/drei"
import { Vector3, MathUtils } from "three"
import { useNavigate } from "react-router-dom"

// Enhanced user data with more details
const currentUser = {
  id: 1,
  name: "Sarah Johnson",
  avatar: "👩‍🎓",
  year: "3rd Year",
  major: "Computer Science",
  color: "#4F46E5",
  level: 15,
  achievements: ["Explorer", "Study Buddy", "Campus Guide"],
}

// Expanded online users with more variety
const mockOnlineUsers = [
  { id: 2, name: "Ahmed Hassan", avatar: "👨‍💻", position: [15, 0.5, 8], color: "#EF4444", activity: "Studying" },
  { id: 3, name: "Maria Rodriguez", avatar: "👩‍🔬", position: [-12, 0.5, -15], color: "#10B981", activity: "In Lab" },
  { id: 4, name: "David Kim", avatar: "👨‍🎓", position: [25, 0.5, -8], color: "#F59E0B", activity: "Library" },
  { id: 5, name: "Elena Petrov", avatar: "👩‍💼", position: [-18, 0.5, 12], color: "#8B5CF6", activity: "Cafeteria" },
  { id: 6, name: "James Wilson", avatar: "👨‍🏫", position: [8, 0.5, 20], color: "#06B6D4", activity: "Teaching" },
  { id: 7, name: "Aisha Patel", avatar: "👩‍🎨", position: [-25, 0.5, -5], color: "#F97316", activity: "Art Studio" },
  { id: 8, name: "Carlos Silva", avatar: "👨‍⚕️", position: [30, 0.5, 15], color: "#84CC16", activity: "Med Center" },
  { id: 9, name: "Yuki Tanaka", avatar: "👩‍🔬", position: [-8, 0.5, -25], color: "#EC4899", activity: "Research" },
]

// Enhanced chat system with more features
function ChatSystem({ isOpen, onToggle, messages, onSendMessage, nearbyUsers }) {
  const [newMessage, setNewMessage] = useState("")
  const [activeTab, setActiveTab] = useState("global")
  const [isTyping, setIsTyping] = useState(false)

  const handleSend = () => {
    if (newMessage.trim()) {
      onSendMessage(newMessage, activeTab)
      setNewMessage("")
      setIsTyping(false)
    }
  }

  const handleTyping = (e) => {
    setNewMessage(e.target.value)
    setIsTyping(e.target.value.length > 0)
  }

  if (!isOpen) {
    return (
      <div className="absolute bottom-24 right-4 pointer-events-auto">
        <button
          onClick={onToggle}
          className="bg-blue-600 hover:bg-blue-700 text-white p-4 rounded-full shadow-lg transition-all transform hover:scale-105"
        >
          💬 Chat
          {messages.length > 0 && (
            <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full w-6 h-6 flex items-center justify-center">
              {messages.length > 9 ? "9+" : messages.length}
            </span>
          )}
        </button>
      </div>
    )
  }

  return (
    <div className="absolute bottom-4 right-4 w-96 h-[500px] bg-black bg-opacity-95 backdrop-blur-sm border border-blue-500/30 rounded-xl pointer-events-auto shadow-2xl">
      {/* Enhanced Chat Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-700 bg-gradient-to-r from-blue-600/20 to-purple-600/20">
        <div className="flex space-x-2">
          {[
            {
              key: "global",
              icon: "🌍",
              label: "Global",
              count: messages.filter((m) => m.channel === "global").length,
            },
            {
              key: "study-group",
              icon: "📚",
              label: "Study",
              count: messages.filter((m) => m.channel === "study-group").length,
            },
            { key: "nearby", icon: "📍", label: "Nearby", count: nearbyUsers.length },
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
                <span className="ml-1 bg-red-500 text-white text-xs rounded-full px-1">{tab.count}</span>
              )}
            </button>
          ))}
        </div>
        <button onClick={onToggle} className="text-gray-400 hover:text-white transition-colors">
          ✕
        </button>
      </div>

      {/* Enhanced Messages Area */}
      <div className="flex-1 p-4 h-80 overflow-y-auto space-y-3 scrollbar-thin scrollbar-thumb-blue-600 scrollbar-track-gray-800">
        {messages
          .filter((msg) => msg.channel === activeTab)
          .map((message, index) => (
            <div key={index} className="group">
              <div className="flex items-start space-x-2">
                <div className="w-8 h-8 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 flex items-center justify-center text-sm">
                  {message.avatar || "👤"}
                </div>
                <div className="flex-1">
                  <div className="flex items-center space-x-2">
                    <span className="text-blue-400 font-medium text-sm">{message.user}</span>
                    <span className="text-xs text-gray-500">{message.time}</span>
                    {message.isSystem && (
                      <span className="bg-green-500 text-white text-xs px-2 py-0.5 rounded-full">System</span>
                    )}
                  </div>
                  <p className="text-white text-sm mt-1 leading-relaxed">{message.text}</p>
                  {message.reactions && (
                    <div className="flex space-x-1 mt-2">
                      {Object.entries(message.reactions).map(([emoji, count]) => (
                        <button
                          key={emoji}
                          className="bg-gray-700 hover:bg-gray-600 px-2 py-1 rounded text-xs transition-colors"
                        >
                          {emoji} {count}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        {isTyping && <div className="text-gray-400 text-sm italic">Someone is typing...</div>}
      </div>

      {/* Enhanced Input Area */}
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

// Enhanced study area interaction
function StudyAreaUI({ area, onJoin, onLeave, isInArea, studyMembers }) {
  if (!isInArea) return null

  return (
    <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 pointer-events-auto">
      <div className="bg-black bg-opacity-95 backdrop-blur-sm border border-blue-500/30 rounded-xl p-8 text-white text-center min-w-[400px] shadow-2xl">
        <div className="text-4xl mb-4">{area.icon}</div>
        <h3 className="text-2xl font-bold text-blue-400 mb-2">{area.name}</h3>
        <p className="text-gray-300 mb-4 leading-relaxed">{area.description}</p>

        <div className="bg-gray-800 rounded-lg p-4 mb-6">
          <div className="text-sm text-gray-400 mb-2">Current Activity</div>
          <div className="text-lg font-semibold text-green-400">
            👥 {studyMembers.length}/{area.maxUsers} students
          </div>
          <div className="text-sm text-blue-400 mt-2">
            📚 {area.subject} • ⏱️ {area.duration}
          </div>
        </div>

        {studyMembers.length > 0 && (
          <div className="mb-6">
            <div className="text-sm text-gray-400 mb-2">Study Members</div>
            <div className="flex flex-wrap justify-center gap-2">
              {studyMembers.map((member, index) => (
                <div key={index} className="bg-blue-600 text-white px-3 py-1 rounded-full text-sm">
                  {member.avatar} {member.name}
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="space-y-3">
          <button
            onClick={onJoin}
            className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-bold py-3 px-6 rounded-lg transition-all transform hover:scale-105 shadow-lg"
          >
            🚀 Join Study Session
          </button>
          <button
            onClick={onLeave}
            className="w-full bg-gray-600 hover:bg-gray-700 text-white font-bold py-3 px-6 rounded-lg transition-all"
          >
            👋 Leave Area
          </button>
        </div>
      </div>
    </div>
  )
}

// Door component with interaction
function Door({ position, rotation, isOpen, onInteract, label }) {
  const meshRef = useRef()
  const [hovered, setHovered] = useState(false)

  useFrame((state) => {
    if (meshRef.current) {
      // Smooth door opening animation
      const targetRotation = isOpen ? Math.PI / 2 : 0
      meshRef.current.rotation.y = MathUtils.lerp(meshRef.current.rotation.y, targetRotation, 0.1)

      // Hover effect
      if (hovered) {
        meshRef.current.scale.setScalar(1.02)
      } else {
        meshRef.current.scale.setScalar(1)
      }
    }
  })

  return (
    <group position={position} rotation={rotation}>
      {/* Door frame */}
      <mesh position={[0, 1.5, 0]}>
        <boxGeometry args={[2.2, 3.2, 0.2]} />
        <meshStandardMaterial color="#8B4513" />
      </mesh>

      {/* Door */}
      <mesh
        ref={meshRef}
        position={[0.9, 1.5, 0]}
        onClick={onInteract}
        onPointerEnter={() => setHovered(true)}
        onPointerLeave={() => setHovered(false)}
        castShadow
        receiveShadow
      >
        <boxGeometry args={[1.8, 2.8, 0.1]} />
        <meshStandardMaterial color={hovered ? "#A0522D" : "#654321"} />
      </mesh>

      {/* Door handle */}
      <mesh position={[1.6, 1.5, 0.1]}>
        <sphereGeometry args={[0.05]} />
        <meshStandardMaterial color="#FFD700" />
      </mesh>

      {/* Door label */}
      {label && (
        <Text position={[0, 2.8, 0.1]} fontSize={0.3} color="#FFFFFF" anchorX="center" anchorY="middle">
          {label}
        </Text>
      )}

      {/* Interaction prompt */}
      {hovered && (
        <Html position={[0, 3.5, 0]} center>
          <div className="bg-black bg-opacity-80 text-white px-3 py-1 rounded text-sm whitespace-nowrap">
            Press E to {isOpen ? "close" : "open"} door
          </div>
        </Html>
      )}
    </group>
  )
}

// Enhanced Game UI with more features
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
  playerStats,
  nearbyUsers,
  studyMembers,
  timeOfDay,
  weather,
}) {
  const [showPlayerList, setShowPlayerList] = useState(false)
  const [showMap, setShowMap] = useState(false)

  return (
    <div className="absolute top-0 left-0 w-full h-full pointer-events-none z-10">
      {/* Enhanced Top HUD */}
      <div className="absolute top-4 left-4 bg-black bg-opacity-90 text-white p-6 rounded-xl pointer-events-auto backdrop-blur-sm border border-blue-500/30 shadow-2xl">
        <div className="flex items-center space-x-4 mb-4">
          <div className="w-12 h-12 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 flex items-center justify-center text-xl">
            {currentUser.avatar}
          </div>
          <div>
            <h3 className="text-xl font-bold text-blue-400">🏛️ UFAZ University</h3>
            <div className="text-sm text-gray-300">Welcome back, {currentUser.name}!</div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <div className="text-green-400 font-semibold">👥 Online: {onlineUsers.length + 1}</div>
            <div className="text-yellow-400">📚 Study Groups: 5</div>
            <div className="text-purple-400">🎯 Level: {playerStats.level}</div>
          </div>
          <div>
            <div className="text-blue-400">🌤️ {weather}</div>
            <div className="text-orange-400">🕐 {timeOfDay}</div>
            <div className="text-pink-400">📍 {nearbyUsers.length} Nearby</div>
          </div>
        </div>
      </div>

      {/* Enhanced Online Users Panel */}
      <div className="absolute top-4 right-4 pointer-events-auto">
        <button
          onClick={() => setShowPlayerList(!showPlayerList)}
          className="bg-black bg-opacity-90 text-white p-4 rounded-xl backdrop-blur-sm border border-blue-500/30 shadow-2xl hover:bg-opacity-100 transition-all"
        >
          👥 Players ({onlineUsers.length + 1})
        </button>

        {showPlayerList && (
          <div className="absolute top-16 right-0 w-80 bg-black bg-opacity-95 backdrop-blur-sm border border-blue-500/30 rounded-xl p-4 shadow-2xl">
            <h4 className="text-lg font-bold text-blue-400 mb-4">🌟 Campus Community</h4>
            <div className="space-y-3 max-h-80 overflow-y-auto">
              <div className="flex items-center space-x-3 p-3 bg-blue-600/20 rounded-lg border border-blue-500/30">
                <span className="text-2xl">{currentUser.avatar}</span>
                <div className="flex-1">
                  <div className="text-green-400 font-semibold">{currentUser.name} (You)</div>
                  <div className="text-xs text-gray-400">
                    {currentUser.major} • Level {currentUser.level}
                  </div>
                </div>
                <div className="text-green-400 text-xs">Online</div>
              </div>

              {onlineUsers.map((user) => (
                <div
                  key={user.id}
                  className="flex items-center space-x-3 p-3 bg-gray-800/50 rounded-lg hover:bg-gray-700/50 transition-colors"
                >
                  <span className="text-2xl">{user.avatar}</span>
                  <div className="flex-1">
                    <div className="text-white font-medium">{user.name}</div>
                    <div className="text-xs text-gray-400">{user.activity}</div>
                  </div>
                  <div className="text-green-400 text-xs">Online</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Enhanced Controls Guide */}
      <div className="absolute bottom-4 left-4 bg-black bg-opacity-90 text-white p-4 rounded-xl pointer-events-auto backdrop-blur-sm border border-blue-500/30 shadow-2xl">
        <div className="text-sm space-y-2">
          <div className="text-blue-400 font-bold mb-2">🎮 Controls</div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-yellow-400 font-semibold">Movement</div>
              <div>WASD: Move</div>
              <div>Space: Jump</div>
              <div>Shift: Run</div>
              <div>Mouse: Look</div>
            </div>
            <div>
              <div className="text-green-400 font-semibold">Interaction</div>
              <div>E: Interact</div>
              <div>T: Chat</div>
              <div>Tab: Players</div>
              <div>M: Map</div>
            </div>
          </div>
          <div className="text-purple-400 text-xs mt-2">ESC: Menu</div>
        </div>
      </div>

      {/* Study Area Interaction */}
      <StudyAreaUI
        area={studyArea}
        onJoin={onJoinStudy}
        onLeave={onLeaveStudy}
        isInArea={isInStudyArea}
        studyMembers={studyMembers}
      />

      {/* Enhanced Chat System */}
      <ChatSystem
        isOpen={chatOpen}
        onToggle={onToggleChat}
        messages={messages}
        onSendMessage={onSendMessage}
        nearbyUsers={nearbyUsers}
      />

      {/* Enhanced Menu */}
      {showMenu && (
        <div className="absolute inset-0 bg-black bg-opacity-90 flex items-center justify-center pointer-events-auto">
          <div className="bg-gradient-to-br from-gray-900 to-gray-800 border border-blue-500/30 rounded-2xl p-10 text-white min-w-[500px] backdrop-blur-sm shadow-2xl">
            <h2 className="text-3xl font-bold text-blue-400 mb-8 text-center">🎓 Campus Menu</h2>

            <div className="grid grid-cols-2 gap-4 mb-8">
              <button
                onClick={onToggleMenu}
                className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 px-6 rounded-xl transition-all transform hover:scale-105 shadow-lg"
              >
                🚀 Resume Exploration
              </button>
              <button className="bg-green-600 hover:bg-green-700 text-white font-bold py-4 px-6 rounded-xl transition-all transform hover:scale-105 shadow-lg">
                📚 Study Groups
              </button>
              <button className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-4 px-6 rounded-xl transition-all transform hover:scale-105 shadow-lg">
                🗺️ Campus Map
              </button>
              <button className="bg-yellow-600 hover:bg-yellow-700 text-white font-bold py-4 px-6 rounded-xl transition-all transform hover:scale-105 shadow-lg">
                ⚙️ Settings
              </button>
              <button className="bg-pink-600 hover:bg-pink-700 text-white font-bold py-4 px-6 rounded-xl transition-all transform hover:scale-105 shadow-lg">
                🏆 Achievements
              </button>
              <button
                onClick={onExitGame}
                className="bg-red-600 hover:bg-red-700 text-white font-bold py-4 px-6 rounded-xl transition-all transform hover:scale-105 shadow-lg"
              >
                🚪 Exit Campus
              </button>
            </div>

            <div className="text-center text-gray-400">
              <div className="mb-2">
                🎯 Level {playerStats.level} • 🏆 {currentUser.achievements.length} Achievements
              </div>
              <div className="text-sm">Press ESC again to resume</div>
            </div>
          </div>
        </div>
      )}

      {/* Enhanced Crosshair */}
      {!showMenu && (
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 pointer-events-none">
          <div className="w-6 h-6 border-2 border-white rounded-full opacity-80 animate-pulse"></div>
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-2 h-2 bg-blue-400 rounded-full"></div>
        </div>
      )}

      {/* Enhanced Mini Map */}
      <div className="absolute bottom-24 right-4 w-48 h-48 bg-black bg-opacity-90 border border-blue-500/30 rounded-xl pointer-events-auto backdrop-blur-sm shadow-2xl">
        <div className="p-3 text-white text-center">
          <div className="text-blue-400 font-bold mb-2">🗺️ Campus Map</div>
          <div className="relative w-full h-32 bg-gray-800 rounded-lg overflow-hidden">
            {/* Campus buildings on minimap */}
            <div className="absolute top-1/2 left-1/2 w-3 h-3 bg-blue-400 rounded-full transform -translate-x-1/2 -translate-y-1/2 animate-pulse"></div>

            {/* Buildings */}
            <div className="absolute top-4 left-4 w-2 h-2 bg-yellow-500 rounded"></div>
            <div className="absolute top-4 right-4 w-2 h-2 bg-green-500 rounded"></div>
            <div className="absolute bottom-4 left-4 w-2 h-2 bg-purple-500 rounded"></div>
            <div className="absolute bottom-4 right-4 w-2 h-2 bg-red-500 rounded"></div>

            {/* Other players */}
            {onlineUsers.map((user) => (
              <div
                key={user.id}
                className="absolute w-1.5 h-1.5 rounded-full animate-pulse"
                style={{
                  backgroundColor: user.color,
                  left: `${50 + (user.position[0] / 40) * 40}%`,
                  top: `${50 + (user.position[2] / 40) * 40}%`,
                }}
                title={user.name}
              ></div>
            ))}
          </div>
          <div className="text-xs text-gray-400 mt-1">You are the blue dot</div>
        </div>
      </div>
    </div>
  )
}

// Enhanced other player component
function OtherPlayer({ user, currentPlayerPosition }) {
  const meshRef = useRef()
  const [isNearby, setIsNearby] = useState(false)
  const [distance, setDistance] = useState(0)

  useFrame((state) => {
    if (meshRef.current && currentPlayerPosition) {
      const dist = meshRef.current.position.distanceTo(currentPlayerPosition)
      setDistance(dist)
      setIsNearby(dist < 8)

      // Enhanced idle animation
      meshRef.current.rotation.y = Math.sin(state.clock.elapsedTime + user.id) * 0.1
      meshRef.current.position.y = 0.5 + Math.sin(state.clock.elapsedTime * 2 + user.id) * 0.05
    }
  })

  return (
    <group position={user.position}>
      {/* Enhanced player body */}
      <mesh ref={meshRef} position={[0, 1, 0]} castShadow receiveShadow>
        <capsuleGeometry args={[0.4, 1.6]} />
        <meshStandardMaterial color={user.color} />
      </mesh>

      {/* Player head */}
      <mesh position={[0, 2.2, 0]} castShadow>
        <sphereGeometry args={[0.3]} />
        <meshStandardMaterial color="#FFDBAC" />
      </mesh>

      {/* Enhanced name tag */}
      <Html position={[0, 3, 0]} center>
        <div
          className={`bg-black bg-opacity-90 text-white px-3 py-2 rounded-lg text-sm whitespace-nowrap backdrop-blur-sm transition-all ${
            isNearby ? "border-2 border-green-400 shadow-lg" : "border border-gray-600"
          }`}
        >
          <div className="flex items-center space-x-2">
            <span className="text-lg">{user.avatar}</span>
            <div>
              <div className="font-semibold">{user.name}</div>
              <div className="text-xs text-gray-400">{user.activity}</div>
              {isNearby && (
                <div className="text-xs text-green-400">📍 {distance.toFixed(1)}m • Press E to interact</div>
              )}
            </div>
          </div>
        </div>
      </Html>

      {/* Enhanced interaction indicator */}
      {isNearby && (
        <>
          <mesh position={[0, 0.1, 0]}>
            <cylinderGeometry args={[2, 2, 0.1]} />
            <meshStandardMaterial color="#10B981" transparent opacity={0.4} />
          </mesh>

          {/* Floating interaction icon */}
          <Html position={[0, 3.5, 0]} center>
            <div className="animate-bounce text-2xl">💬</div>
          </Html>
        </>
      )}

      {/* Activity indicator */}
      <mesh position={[0, 0.05, 0]}>
        <cylinderGeometry args={[0.8, 0.8, 0.05]} />
        <meshStandardMaterial color={user.color} transparent opacity={0.2} />
      </mesh>
    </group>
  )
}

// Enhanced Player Character with better physics and interactions
function PlayerCharacter({ isMenuOpen, onPositionChange, onAreaEnter, onAreaLeave, onDoorInteract, doors }) {
  const meshRef = useRef()
  const { camera } = useThree()
  const [, get] = useKeyboardControls()

  const speed = useRef(8)
  const runSpeed = 12
  const walkSpeed = 8
  const jumpForce = 10
  const gravity = -25
  const height = 1.8
  const groundLevel = 0.5

  const velocityY = useRef(0)
  const isGrounded = useRef(true)
  const currentArea = useRef(null)
  const isRunning = useRef(false)

  // Enhanced study areas with more details
  const studyAreas = useMemo(
    () => [
      {
        id: 1,
        name: "Central Library",
        position: [20, 0, 15],
        radius: 5,
        description: "Quiet study environment with extensive resources",
        icon: "📚",
        subject: "General Studies",
        duration: "2-4 hours",
        maxUsers: 12,
      },
      {
        id: 2,
        name: "Computer Science Lab",
        position: [-25, 0, -20],
        radius: 4,
        description: "High-tech lab for programming and research",
        icon: "💻",
        subject: "Computer Science",
        duration: "1-3 hours",
        maxUsers: 8,
      },
      {
        id: 3,
        name: "Discussion Circle",
        position: [0, 0, -30],
        radius: 6,
        description: "Open space for group discussions and presentations",
        icon: "🗣️",
        subject: "Communication",
        duration: "1-2 hours",
        maxUsers: 15,
      },
      {
        id: 4,
        name: "Science Laboratory",
        position: [30, 0, -10],
        radius: 4,
        description: "Fully equipped lab for scientific experiments",
        icon: "🔬",
        subject: "Sciences",
        duration: "2-3 hours",
        maxUsers: 10,
      },
      {
        id: 5,
        name: "Art Studio",
        position: [-30, 0, 10],
        radius: 5,
        description: "Creative space for artistic projects",
        icon: "🎨",
        subject: "Arts",
        duration: "2-5 hours",
        maxUsers: 6,
      },
    ],
    [],
  )

  useFrame((state, delta) => {
    if (!meshRef.current || isMenuOpen) return

    const { forward, backward, left, right, jump, run } = get()

    // Enhanced movement with running
    isRunning.current = run
    speed.current = isRunning.current ? runSpeed : walkSpeed

    const direction = new Vector3()
    camera.getWorldDirection(direction)
    direction.y = 0
    direction.normalize()

    const rightDirection = new Vector3()
    rightDirection.crossVectors(direction, new Vector3(0, 1, 0))

    const velocity = new Vector3(0, 0, 0)

    if (forward) velocity.add(direction.clone().multiplyScalar(speed.current * delta))
    if (backward) velocity.add(direction.clone().multiplyScalar(-speed.current * delta))
    if (left) velocity.add(rightDirection.clone().multiplyScalar(-speed.current * delta))
    if (right) velocity.add(rightDirection.clone().multiplyScalar(speed.current * delta))

    meshRef.current.position.add(velocity)

    // Enhanced jumping
    if (jump && isGrounded.current) {
      velocityY.current = jumpForce
      isGrounded.current = false
    }

    // Enhanced gravity and physics
    velocityY.current += gravity * delta
    meshRef.current.position.y += velocityY.current * delta

    // Ground collision with better detection
    if (meshRef.current.position.y <= groundLevel) {
      meshRef.current.position.y = groundLevel
      velocityY.current = 0
      isGrounded.current = true
    }

    // Enhanced boundaries for larger map
    const bounds = 45
    meshRef.current.position.x = Math.max(-bounds, Math.min(bounds, meshRef.current.position.x))
    meshRef.current.position.z = Math.max(-bounds, Math.min(bounds, meshRef.current.position.z))

    const playerPosition = meshRef.current.position
    camera.position.copy(playerPosition)
    camera.position.y = playerPosition.y + height

    // Enhanced area detection
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

    // Door interaction detection
    Object.entries(doors).forEach(([doorId, door]) => {
      // Define door positions for interaction detection
      const doorPositions = {
        main: [0, 0, 6.1],
        westWing: [-12, 0, 5.1],
        eastWing: [12, 0, 5.1],
        library: [25, 0, 25.1],
        computerLab: [-30, 0, -18.9],
        studentCenter: [0, 0, -26.9],
        scienceLab: [35, 0, -7.9],
        artStudio: [-35, 0, 21.1],
        sportsCenter: [-25, 0, 42.6],
        cafeteria: [30, 0, 31.1],
      }
      
      const doorPosition = doorPositions[doorId]
      if (doorPosition) {
        const doorDistance = playerPos.distanceTo(new Vector3(...doorPosition))
        if (doorDistance < 3) {
          // Show interaction prompt handled by Door component
        }
      }
    })

    onPositionChange(playerPosition)
  })

  return (
    <mesh ref={meshRef} position={[0, groundLevel, 0]} castShadow visible={false}>
      <capsuleGeometry args={[0.4, 1.6]} />
      <meshStandardMaterial color={currentUser.color} />
    </mesh>
  )
}

// Massive Enhanced University Campus
function UniversityCampus({ doors, onDoorInteract }) {
  return (
    <group>
      {/* Massive Campus Ground */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.5, 0]} receiveShadow>
        <planeGeometry args={[100, 100]} />
        <meshStandardMaterial color="#1a4d1a" />
      </mesh>

      {/* Enhanced Main Academic Complex */}
      <group position={[0, 0, 0]}>
        {/* Main Building */}
        <mesh position={[0, 4, 0]} castShadow receiveShadow>
          <boxGeometry args={[16, 8, 12]} />
          <meshStandardMaterial color="#8B4513" />
        </mesh>

        {/* Building Wings */}
        <mesh position={[-12, 3, 0]} castShadow receiveShadow>
          <boxGeometry args={[8, 6, 10]} />
          <meshStandardMaterial color="#A0522D" />
        </mesh>
        <mesh position={[12, 3, 0]} castShadow receiveShadow>
          <boxGeometry args={[8, 6, 10]} />
          <meshStandardMaterial color="#A0522D" />
        </mesh>

        {/* Enhanced Roof System */}
        <mesh position={[0, 8.5, 0]} castShadow>
          <coneGeometry args={[10, 3, 4]} />
          <meshStandardMaterial color="#654321" />
        </mesh>

        {/* Multiple Entrances with Doors */}
        <Door
          position={[0, 0, 6.1]}
          rotation={[0, 0, 0]}
          isOpen={doors.main?.isOpen || false}
          onInteract={() => onDoorInteract("main")}
          label="Main Entrance"
        />
        <Door
          position={[-12, 0, 5.1]}
          rotation={[0, 0, 0]}
          isOpen={doors.westWing?.isOpen || false}
          onInteract={() => onDoorInteract("westWing")}
          label="West Wing"
        />
        <Door
          position={[12, 0, 5.1]}
          rotation={[0, 0, 0]}
          isOpen={doors.eastWing?.isOpen || false}
          onInteract={() => onDoorInteract("eastWing")}
          label="East Wing"
        />

        {/* Enhanced Windows */}
        {[-6, -3, 0, 3, 6].map((x, i) => (
          <group key={i}>
            {[2, 4, 6].map((y, j) => (
              <mesh key={j} position={[x, y, 6.1]} castShadow>
                <boxGeometry args={[1.5, 1.8, 0.1]} />
                <meshStandardMaterial color="#87CEEB" transparent opacity={0.8} />
              </mesh>
            ))}
          </group>
        ))}
      </group>

      {/* Enhanced Library Complex */}
      <group position={[25, 0, 20]}>
        <mesh position={[0, 3.5, 0]} castShadow receiveShadow>
          <boxGeometry args={[12, 7, 10]} />
          <meshStandardMaterial color="#8B0000" />
        </mesh>

        {/* Library Tower */}
        <mesh position={[0, 8, 0]} castShadow receiveShadow>
          <cylinderGeometry args={[3, 3, 8]} />
          <meshStandardMaterial color="#A0522D" />
        </mesh>

        <Door
          position={[0, 0, 5.1]}
          rotation={[0, 0, 0]}
          isOpen={doors.library?.isOpen || false}
          onInteract={() => onDoorInteract("library")}
          label="📚 Central Library"
        />

        <Text position={[0, 6, 5.5]} fontSize={1} color="#FFFFFF" anchorX="center" anchorY="middle">
          📚 CENTRAL LIBRARY
        </Text>
      </group>

      {/* Enhanced Computer Science Complex */}
      <group position={[-30, 0, -25]}>
        <mesh position={[0, 4, 0]} castShadow receiveShadow>
          <boxGeometry args={[14, 8, 12]} />
          <meshStandardMaterial color="#2F4F4F" />
        </mesh>

        {/* Server Room */}
        <mesh position={[8, 2, 0]} castShadow receiveShadow>
          <boxGeometry args={[4, 4, 8]} />
          <meshStandardMaterial color="#1C1C1C" />
        </mesh>

        <Door
          position={[0, 0, 6.1]}
          rotation={[0, 0, 0]}
          isOpen={doors.computerLab?.isOpen || false}
          onInteract={() => onDoorInteract("computerLab")}
          label="💻 Computer Lab"
        />

        <Text position={[0, 7, 6.5]} fontSize={0.8} color="#00FFFF" anchorX="center" anchorY="middle">
          💻 COMPUTER SCIENCE
        </Text>
      </group>

      {/* Enhanced Student Center */}
      <group position={[0, 0, -35]}>
        <mesh position={[0, 3, 0]} castShadow receiveShadow>
          <cylinderGeometry args={[8, 8, 6]} />
          <meshStandardMaterial color="#8A2BE2" />
        </mesh>

        {/* Dome */}
        <mesh position={[0, 6.5, 0]} castShadow>
          <sphereGeometry args={[6, 16, 8]} />
          <meshStandardMaterial color="#9932CC" />
        </mesh>

        <Door
          position={[0, 0, 8.1]}
          rotation={[0, 0, 0]}
          isOpen={doors.studentCenter?.isOpen || false}
          onInteract={() => onDoorInteract("studentCenter")}
          label="🎓 Student Center"
        />

        <Text position={[0, 4, 8.5]} fontSize={1} color="#FFFFFF" anchorX="center" anchorY="middle">
          🎓 STUDENT CENTER
        </Text>
      </group>

      {/* Enhanced Science Complex */}
      <group position={[35, 0, -15]}>
        <mesh position={[0, 3.5, 0]} castShadow receiveShadow>
          <boxGeometry args={[12, 7, 14]} />
          <meshStandardMaterial color="#228B22" />
        </mesh>

        {/* Laboratory Wings */}
        <mesh position={[-8, 2.5, 0]} castShadow receiveShadow>
          <boxGeometry args={[6, 5, 10]} />
          <meshStandardMaterial color="#32CD32" />
        </mesh>
        <mesh position={[8, 2.5, 0]} castShadow receiveShadow>
          <boxGeometry args={[6, 5, 10]} />
          <meshStandardMaterial color="#32CD32" />
        </mesh>

        <Door
          position={[0, 0, 7.1]}
          rotation={[0, 0, 0]}
          isOpen={doors.scienceLab?.isOpen || false}
          onInteract={() => onDoorInteract("scienceLab")}
          label="🔬 Science Labs"
        />

        <Text position={[0, 6, 7.5]} fontSize={0.8} color="#FFFFFF" anchorX="center" anchorY="middle">
          🔬 SCIENCE COMPLEX
        </Text>
      </group>

      {/* Enhanced Arts Building */}
      <group position={[-35, 0, 15]}>
        <mesh position={[0, 3, 0]} castShadow receiveShadow>
          <boxGeometry args={[10, 6, 12]} />
          <meshStandardMaterial color="#FF6347" />
        </mesh>

        {/* Art Studios */}
        <mesh position={[0, 6, 0]} castShadow receiveShadow>
          <boxGeometry args={[8, 2, 10]} />
          <meshStandardMaterial color="#FF4500" />
        </mesh>

        <Door
          position={[0, 0, 6.1]}
          rotation={[0, 0, 0]}
          isOpen={doors.artStudio?.isOpen || false}
          onInteract={() => onDoorInteract("artStudio")}
          label="🎨 Art Studios"
        />

        <Text position={[0, 5, 6.5]} fontSize={0.8} color="#FFFFFF" anchorX="center" anchorY="middle">
          🎨 ARTS BUILDING
        </Text>
      </group>

      {/* Enhanced Sports Complex */}
      <group position={[-25, 0, 35]}>
        <mesh position={[0, 2.5, 0]} castShadow receiveShadow>
          <boxGeometry args={[20, 5, 15]} />
          <meshStandardMaterial color="#4169E1" />
        </mesh>

        {/* Gymnasium Dome */}
        <mesh position={[0, 5.5, 0]} castShadow>
          <sphereGeometry args={[8, 16, 8]} />
          <meshStandardMaterial color="#0000CD" />
        </mesh>

        <Door
          position={[0, 0, 7.6]}
          rotation={[0, 0, 0]}
          isOpen={doors.sportsCenter?.isOpen || false}
          onInteract={() => onDoorInteract("sportsCenter")}
          label="⚽ Sports Center"
        />

        <Text position={[0, 3, 8]} fontSize={1} color="#FFFFFF" anchorX="center" anchorY="middle">
          ⚽ SPORTS COMPLEX
        </Text>
      </group>

      {/* Enhanced Cafeteria */}
      <group position={[30, 0, 25]}>
        <mesh position={[0, 2.5, 0]} castShadow receiveShadow>
          <boxGeometry args={[15, 5, 12]} />
          <meshStandardMaterial color="#DAA520" />
        </mesh>

        {/* Outdoor Seating */}
        <mesh position={[0, 0.5, 8]} castShadow receiveShadow>
          <boxGeometry args={[12, 1, 6]} />
          <meshStandardMaterial color="#F4A460" />
        </mesh>

        <Door
          position={[0, 0, 6.1]}
          rotation={[0, 0, 0]}
          isOpen={doors.cafeteria?.isOpen || false}
          onInteract={() => onDoorInteract("cafeteria")}
          label="🍽️ Cafeteria"
        />

        <Text position={[0, 4, 6.5]} fontSize={0.8} color="#FFFFFF" anchorX="center" anchorY="middle">
          🍽️ CAFETERIA
        </Text>
      </group>

      {/* Enhanced Pathway System */}
      {/* Main Cross Paths */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.4, 0]}>
        <planeGeometry args={[4, 100]} />
        <meshStandardMaterial color="#696969" />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.4, 0]}>
        <planeGeometry args={[100, 4]} />
        <meshStandardMaterial color="#696969" />
      </mesh>

      {/* Diagonal Paths */}
      <mesh rotation={[-Math.PI / 2, 0, Math.PI / 4]} position={[0, -0.4, 0]}>
        <planeGeometry args={[3, 70]} />
        <meshStandardMaterial color="#808080" />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, -Math.PI / 4]} position={[0, -0.4, 0]}>
        <planeGeometry args={[3, 70]} />
        <meshStandardMaterial color="#808080" />
      </mesh>

      {/* Enhanced Study Area Indicators */}
      <mesh position={[20, 0.1, 15]} receiveShadow>
        <cylinderGeometry args={[5, 5, 0.2]} />
        <meshStandardMaterial color="#4169E1" transparent opacity={0.4} />
      </mesh>
      <mesh position={[-25, 0.1, -20]} receiveShadow>
        <cylinderGeometry args={[4, 4, 0.2]} />
        <meshStandardMaterial color="#32CD32" transparent opacity={0.4} />
      </mesh>
      <mesh position={[0, 0.1, -30]} receiveShadow>
        <cylinderGeometry args={[6, 6, 0.2]} />
        <meshStandardMaterial color="#FF69B4" transparent opacity={0.4} />
      </mesh>
      <mesh position={[30, 0.1, -10]} receiveShadow>
        <cylinderGeometry args={[4, 4, 0.2]} />
        <meshStandardMaterial color="#FFD700" transparent opacity={0.4} />
      </mesh>
      <mesh position={[-30, 0.1, 10]} receiveShadow>
        <cylinderGeometry args={[5, 5, 0.2]} />
        <meshStandardMaterial color="#FF6347" transparent opacity={0.4} />
      </mesh>

      {/* Enhanced Landscaping */}
      {/* Tree Groves */}
      {[
        [15, 0, 10],
        [-15, 0, 10],
        [15, 0, -10],
        [-15, 0, -10],
        [25, 0, 5],
        [-25, 0, 5],
        [25, 0, -5],
        [-25, 0, -5],
        [10, 0, 25],
        [-10, 0, 25],
        [10, 0, -25],
        [-10, 0, -25],
        [35, 0, 0],
        [-35, 0, 0],
        [0, 0, 35],
        [0, 0, -35],
        [20, 0, 20],
        [-20, 0, 20],
        [20, 0, -20],
        [-20, 0, -20],
      ].map((pos, i) => (
        <group key={i} position={pos}>
          {/* Enhanced Tree */}
          <mesh position={[0, 1.5, 0]} castShadow>
            <cylinderGeometry args={[0.4, 0.4, 3]} />
            <meshStandardMaterial color="#8B4513" />
          </mesh>
          <mesh position={[0, 3.5, 0]} castShadow>
            <sphereGeometry args={[2]} />
            <meshStandardMaterial color="#228B22" />
          </mesh>

          {/* Tree Shadow */}
          <mesh position={[0, 0.05, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
            <circleGeometry args={[2.5]} />
            <meshStandardMaterial color="#1a4d1a" transparent opacity={0.3} />
          </mesh>
        </group>
      ))}

      {/* Enhanced Seating Areas */}
      {[
        [8, 0, 8],
        [-8, 0, -8],
        [8, 0, -8],
        [-8, 0, 8],
        [15, 0, 0],
        [-15, 0, 0],
        [0, 0, 15],
        [0, 0, -15],
      ].map((pos, i) => (
        <group key={i} position={pos}>
          <mesh position={[0, 0.3, 0]} castShadow receiveShadow>
            <boxGeometry args={[3, 0.6, 1]} />
            <meshStandardMaterial color="#8B4513" />
          </mesh>
          <mesh position={[0, 0.6, 0.4]} castShadow receiveShadow>
            <boxGeometry args={[3, 0.2, 0.8]} />
            <meshStandardMaterial color="#A0522D" />
          </mesh>
        </group>
      ))}

      {/* Enhanced Central Plaza */}
      <group position={[0, 0, 0]}>
        {/* Main Fountain */}
        <mesh position={[0, 0.8, 0]} castShadow receiveShadow>
          <cylinderGeometry args={[4, 4, 1.6]} />
          <meshStandardMaterial color="#708090" />
        </mesh>

        {/* Fountain Center */}
        <mesh position={[0, 2.5, 0]} castShadow>
          <sphereGeometry args={[0.8]} />
          <meshStandardMaterial color="#4169E1" />
        </mesh>

        {/* Water Effect */}
        <mesh position={[0, 1.6, 0]}>
          <cylinderGeometry args={[3.5, 3.5, 0.1]} />
          <meshStandardMaterial color="#87CEEB" transparent opacity={0.7} />
        </mesh>

        {/* Plaza Seating */}
        {[0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2].map((rotation, i) => (
          <mesh
            key={i}
            position={[Math.cos(rotation) * 6, 0.3, Math.sin(rotation) * 6]}
            rotation={[0, rotation, 0]}
            castShadow
            receiveShadow
          >
            <boxGeometry args={[2, 0.6, 1]} />
            <meshStandardMaterial color="#8B4513" />
          </mesh>
        ))}
      </group>

      {/* Enhanced Lighting Fixtures */}
      {[
        [10, 0, 10],
        [-10, 0, 10],
        [10, 0, -10],
        [-10, 0, -10],
        [20, 0, 0],
        [-20, 0, 0],
        [0, 0, 20],
        [0, 0, -20],
      ].map((pos, i) => (
        <group key={i} position={pos}>
          <mesh position={[0, 2.5, 0]} castShadow>
            <cylinderGeometry args={[0.1, 0.1, 5]} />
            <meshStandardMaterial color="#2F4F4F" />
          </mesh>
          <mesh position={[0, 5.2, 0]} castShadow>
            <sphereGeometry args={[0.3]} />
            <meshStandardMaterial color="#FFD700" emissive="#FFD700" emissiveIntensity={0.2} />
          </mesh>
          <pointLight position={[0, 5, 0]} intensity={0.5} distance={15} color="#FFD700" />
        </group>
      ))}
    </group>
  )
}

// Enhanced loading screen
function LoadingScreen() {
  return (
    <Html center>
      <div className="text-white text-center">
        <div className="relative">
          <div className="animate-spin w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-6"></div>
          <div className="absolute inset-0 animate-ping w-16 h-16 border-4 border-blue-300 border-t-transparent rounded-full mx-auto opacity-20"></div>
        </div>
        <div className="text-3xl font-bold mb-4 bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
          Loading UFAZ Campus
        </div>
        <div className="text-lg text-gray-300 mb-2">Preparing your virtual university experience</div>
        <div className="text-sm text-gray-400">Building the future of education...</div>

        <div className="mt-6 w-64 bg-gray-700 rounded-full h-2 mx-auto">
          <div
            className="bg-gradient-to-r from-blue-500 to-purple-500 h-2 rounded-full animate-pulse"
            style={{ width: "75%" }}
          ></div>
        </div>
      </div>
    </Html>
  )
}

// Main Enhanced Simulation Component
export default function CampusSimulation() {
  const navigate = useNavigate()
  const [showMenu, setShowMenu] = useState(false)
  const [chatOpen, setChatOpen] = useState(false)
  const [messages, setMessages] = useState([
    {
      user: "System",
      text: "🎓 Welcome to UFAZ Campus! Explore, learn, and connect with fellow students.",
      time: "10:00",
      channel: "global",
      isSystem: true,
      avatar: "🤖",
    },
    {
      user: "Ahmed Hassan",
      text: "Anyone want to study for the algorithms exam? I'm in the CS lab!",
      time: "10:05",
      channel: "global",
      avatar: "👨‍💻",
    },
    {
      user: "Maria Rodriguez",
      text: "Starting a chemistry study group in the science lab. Join us!",
      time: "10:07",
      channel: "study-group",
      avatar: "👩‍🔬",
    },
    {
      user: "David Kim",
      text: "The library is perfect for focused studying today. Great atmosphere!",
      time: "10:10",
      channel: "global",
      avatar: "👨‍🎓",
    },
  ])

  const [playerPosition, setPlayerPosition] = useState(new Vector3(0, 0.5, 0))
  const [currentStudyArea, setCurrentStudyArea] = useState(null)
  const [isInStudyArea, setIsInStudyArea] = useState(false)
  const [nearbyUsers, setNearbyUsers] = useState([])
  const [studyMembers, setStudyMembers] = useState([
    { name: "Ahmed Hassan", avatar: "👨‍💻" },
    { name: "Elena Petrov", avatar: "👩‍💼" },
  ])

  // Door states
  const [doors, setDoors] = useState({
    main: { isOpen: false },
    westWing: { isOpen: false },
    eastWing: { isOpen: false },
    library: { isOpen: false },
    computerLab: { isOpen: false },
    studentCenter: { isOpen: false },
    scienceLab: { isOpen: false },
    artStudio: { isOpen: false },
    sportsCenter: { isOpen: false },
    cafeteria: { isOpen: false },
  })

  // Enhanced player stats
  const [playerStats] = useState({
    level: 15,
    experience: 2450,
    studyHours: 127,
    friendsCount: 23,
    achievementsUnlocked: 8,
  })

  // Time and weather system
  const [timeOfDay] = useState("Morning")
  const [weather] = useState("Sunny")

  const keyboardMap = [
    { name: "forward", keys: ["ArrowUp", "KeyW"] },
    { name: "backward", keys: ["ArrowDown", "KeyS"] },
    { name: "left", keys: ["ArrowLeft", "KeyA"] },
    { name: "right", keys: ["ArrowRight", "KeyD"] },
    { name: "jump", keys: ["Space"] },
    { name: "run", keys: ["ShiftLeft", "ShiftRight"] },
    { name: "interact", keys: ["KeyE"] },
  ]

  // Enhanced keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.code === "Escape") {
        setShowMenu((prev) => !prev)
      } else if (event.code === "KeyT" && !showMenu) {
        setChatOpen((prev) => !prev)
      } else if (event.code === "Tab" && !showMenu) {
        event.preventDefault()
        // Toggle player list or other features
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [showMenu])

  // Update nearby users based on player position
  useEffect(() => {
    const nearby = mockOnlineUsers.filter((user) => {
      const userPos = new Vector3(...user.position)
      const distance = playerPosition.distanceTo(userPos)
      return distance < 10
    })
    setNearbyUsers(nearby)
  }, [playerPosition])

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
      avatar: currentUser.avatar,
    }
    setMessages((prev) => [...prev, newMessage])
  }, [])

  const handleAreaEnter = useCallback(
    (area) => {
      setCurrentStudyArea(area)
      setIsInStudyArea(true)

      // Add system message about entering area
      const systemMessage = {
        user: "System",
        text: `You entered ${area.name}. ${studyMembers.length} students are currently studying here.`,
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        channel: "nearby",
        isSystem: true,
        avatar: "🏛️",
      }
      setMessages((prev) => [...prev, systemMessage])
    },
    [studyMembers],
  )

  const handleAreaLeave = useCallback(() => {
    setIsInStudyArea(false)
    setCurrentStudyArea(null)
  }, [])

  const handleJoinStudy = useCallback(() => {
    if (currentStudyArea) {
      const message = `${currentUser.name} joined the study session at ${currentStudyArea.name}`
      const newMessage = {
        user: "System",
        text: message,
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        channel: "study-group",
        isSystem: true,
        avatar: "📚",
      }
      setMessages((prev) => [...prev, newMessage])

      // Add current user to study members
      setStudyMembers((prev) => [...prev, { name: currentUser.name, avatar: currentUser.avatar }])
    }
  }, [currentStudyArea])

  const handleLeaveStudy = useCallback(() => {
    setIsInStudyArea(false)
    setCurrentStudyArea(null)

    // Remove current user from study members
    setStudyMembers((prev) => prev.filter((member) => member.name !== currentUser.name))
  }, [])

  const handleDoorInteract = useCallback(
    (doorId) => {
      setDoors((prev) => ({
        ...prev,
        [doorId]: { isOpen: !prev[doorId]?.isOpen },
      }))

      // Add sound effect or animation feedback here
      const doorAction = doors[doorId]?.isOpen ? "closed" : "opened"
      console.log(`Door ${doorId} ${doorAction}`)
    },
    [doors],
  )

  return (
    <div
      className="w-full h-screen relative bg-gradient-to-b from-blue-400 via-blue-500 to-blue-600"
      id="canvas-container"
    >
      <KeyboardControls map={keyboardMap}>
        <Canvas camera={{ position: [0, 1.8, 5], fov: 75 }} shadows>
          {/* Enhanced Lighting System */}
          <ambientLight intensity={0.3} color="#ffffff" />

          {/* Main Sun Light */}
          <directionalLight
            position={[50, 50, 25]}
            intensity={1.2}
            castShadow
            shadow-mapSize-width={4096}
            shadow-mapSize-height={4096}
            shadow-camera-far={100}
            shadow-camera-left={-50}
            shadow-camera-right={50}
            shadow-camera-top={50}
            shadow-camera-bottom={-50}
            color="#FFF8DC"
          />

          {/* Secondary Lighting */}
          <directionalLight position={[-30, 40, -20]} intensity={0.6} color="#E6E6FA" />

          {/* Atmospheric Lighting */}
          <pointLight position={[0, 25, 0]} intensity={0.4} distance={60} color="#87CEEB" />
          <pointLight position={[25, 15, 25]} intensity={0.3} distance={40} color="#FFE4B5" />
          <pointLight position={[-25, 15, -25]} intensity={0.3} distance={40} color="#E6E6FA" />

          {/* Campus Area Lighting */}
          <pointLight position={[20, 10, 15]} intensity={0.5} distance={25} color="#4169E1" />
          <pointLight position={[-25, 10, -20]} intensity={0.5} distance={25} color="#32CD32" />
          <pointLight position={[30, 10, -10]} intensity={0.5} distance={25} color="#FFD700" />
          <pointLight position={[-30, 10, 10]} intensity={0.5} distance={25} color="#FF6347" />

          {/* Enhanced Environment */}
          <Sky sunPosition={[100, 20, 100]} inclination={0.6} azimuth={0.25} turbidity={2} rayleigh={0.5} />
          <fog attach="fog" args={["#87CEEB", 60, 150]} />

          {/* FPS Controls */}
          {!showMenu && <PointerLockControls selector="#canvas-container" camera-position={[0, 1.8, 5]} />}

          {/* Enhanced 3D Content */}
          <Suspense fallback={<LoadingScreen />}>
            <UniversityCampus doors={doors} onDoorInteract={handleDoorInteract} />
            <PlayerCharacter
              isMenuOpen={showMenu}
              onPositionChange={setPlayerPosition}
              onAreaEnter={handleAreaEnter}
              onAreaLeave={handleAreaLeave}
              onDoorInteract={handleDoorInteract}
              doors={doors}
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
        playerStats={playerStats}
        nearbyUsers={nearbyUsers}
        studyMembers={studyMembers}
        timeOfDay={timeOfDay}
        weather={weather}
      />
    </div>
  )
}
