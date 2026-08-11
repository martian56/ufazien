import React, { useState, useRef, Suspense, useCallback, useEffect, useMemo } from "react"
import { Helmet } from "react-helmet"
import { Canvas, useFrame, useThree } from "@react-three/fiber"
import { KeyboardControls, useKeyboardControls, PointerLockControls, PerformanceMonitor } from "@react-three/drei"
import { Vector3, MathUtils, ACESFilmicToneMapping } from "three"
import type { Group } from "three"
import { useNavigate, useParams } from "react-router-dom"
import { MessageCircle, Users, Settings, LogOut, MonitorUp, Sun, Sunset, Moon } from "lucide-react"
import { useCampusSimulator } from '../../hooks/useCampusSimulator'
import { useCampusVoice } from '../../hooks/useCampusVoice'
import VoicePanel, { ScreenShareStage } from '../../components/campus/VoicePanel'
import ProjectorScreen from '../../components/campus/ProjectorScreen'
import { api } from '../../lib/api/client'
import { isAuthenticated } from '../../lib/api/tokens'
import TouchControls, { createTouchState, useIsTouchDevice } from '../../components/campus/TouchControls'
import type { TouchState } from '../../components/campus/TouchControls'
import {
  CampusEnvironment,
  CampusGround,
  CampusProps,
  CampusBuildings,
  CampusSkyline,
  ChatBubble,
  CharacterModel,
  NameTag,
  SpeakingRing,
} from '../../components/campus/CampusScenery'
import {
  BUBBLE_MS,
  bubbleFor,
  inSameRoom,
  isSameParticipant,
  isSpeaking,
  statusFor,
} from '../../components/campus/playerStatus'
import { BuildingInterior } from '../../components/campus/BuildingInteriors'
import Whiteboard from '../../components/campus/Whiteboard'
import { isDrawableChat } from '../../components/campus/whiteboardStrokes'
import {
  SOLID_CAMPUS,
  blockingPlatforms,
  groundHeight,
  leanSurface,
  resolveColliders,
  type Collider,
} from '../../components/campus/campusPhysics'
import {
  SEAT_REACH,
  interiorColliders,
  interiorPlatforms,
  interiorSeats,
  nearestSeat,
  type Seat,
} from '../../components/campus/interiorPhysics'
import { EMOTE_SECONDS, type Activity } from '../../components/campus/avatarPose'
import { takenSeatIds } from '../../components/campus/seatState'
import { INTERIOR_SPECS, interiorHalfExtent } from '../../components/campus/interiorSpecs'
import {
  CAMPUS_BUILDINGS,
  CAMPUS_LIMIT,
  OUTDOOR_COURT,
  SPAWN,
  nearestEntrance,
  type CampusBuilding,
  type TimeOfDay,
} from '../../components/campus/campusLayout'
import {
  BasketballStation,
  DashCourse,
  ShelfStation,
  TitrationStation,
  type ActionInput,
} from '../../components/campus/minigames/CampusMinigames'
import MinigameHud, { Crosshair } from '../../components/campus/minigames/MinigameHud'
import { useCampusGames } from '../../components/campus/minigames/useCampusGames'

/** Everything the hook returns, so the pieces below can take it as a prop. */
type CampusHook = ReturnType<typeof useCampusSimulator>

/** A place on the campus that maps to a backend study room. */
interface StudyArea {
  id: string
  name: string
  position: [number, number, number]
  radius: number
  icon: string
  description: string
  maxUsers: number
  subject: string
  duration: string
}

/** The signed-in player, as this page needs them. Never carries an email. */
interface CampusPlayer {
  id: number | null
  name: string
  avatar: string
  year: string
  major: string
  color: string
  level: number
  achievements: string[]
}

/** Placeholder until /auth/user/ answers. */
const getCurrentUser = (): CampusPlayer => {
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

// Key controls for player movement. `action` is the mini-games' hold key; it is
// separate from `interact` so charging a shot cannot also open a door.
const keyMap = [
  { name: "forward", keys: ["ArrowUp", "KeyW"] },
  { name: "backward", keys: ["ArrowDown", "KeyS"] },
  { name: "leftward", keys: ["ArrowLeft", "KeyA"] },
  { name: "rightward", keys: ["ArrowRight", "KeyD"] },
  { name: "jump", keys: ["Space"] },
  { name: "run", keys: ["ShiftLeft"] },
  { name: "interact", keys: ["KeyE"] },
  { name: "action", keys: ["KeyF"] },
  // Emotes. Number keys, because they are the ones nobody is holding down to
  // walk with, and a radial menu cannot be opened while the pointer is locked.
  { name: "sit", keys: ["KeyC"] },
  // Leaning is a posture rather than an emote, so it sits next to sitting
  // rather than on the number row, and holds until pressed again.
  { name: "lean", keys: ["KeyV"] },
  // Pick up and put down whatever is within reach; hold to throw it further.
  { name: "grab", keys: ["KeyG"] },
  { name: "light", keys: ["KeyL"] },
  { name: "wave", keys: ["Digit1"] },
  { name: "clap", keys: ["Digit2"] },
  { name: "raiseHand", keys: ["Digit3"] },
  { name: "point", keys: ["Digit4"] },
]

/** Which control triggers which pose. */
const EMOTE_KEYS: [string, Activity][] = [
  ['wave', 'waving'],
  ['clap', 'clapping'],
  ['raiseHand', 'hand_raised'],
  ['point', 'pointing'],
]

/**
 * Study areas, on the places they describe.
 *
 * These are the backend's study rooms, so their ids are load-bearing and are
 * left alone; only the coordinates moved when the campus grew.
 */
const studyAreas: StudyArea[] = [
  {
    id: "library-quiet",
    name: "Quiet Study Zone",
    position: [-64, 1, 8],
    radius: 9,
    icon: "📖",
    description: "Silent study outside the library, for focused reading and research",
    maxUsers: 12,
    subject: "General Study",
    duration: "Open 24/7",
  },
  {
    id: "lab-group",
    name: "Collaborative Lab",
    position: [62, 1, 6],
    radius: 8,
    icon: "🧪",
    description: "Group space by the laboratory building, with room to spread out",
    maxUsers: 8,
    subject: "Science & Research",
    duration: "8:00 AM - 10:00 PM",
  },
  {
    id: "center-meeting",
    name: "Meeting Point",
    position: [-70, 1, 80],
    radius: 10,
    icon: "💼",
    description: "Where groups gather before booking a room in the student centre",
    maxUsers: 6,
    subject: "Presentations",
    duration: "Bookable Slots",
  },
  {
    id: "quad-open",
    name: "The Quad",
    position: [0, 1, -9],
    radius: 12,
    icon: "🌳",
    description: "Open-air study around the fountain, when the weather allows it",
    maxUsers: 20,
    subject: "Anything",
    duration: "Daylight",
  },
]

// drei's KeyboardControls listens on the window and does not exclude text
// fields, so typing in chat also drove the player: "we need" walked forward and
// e opened a building mid-sentence.
function isTypingInField() {
  const el = typeof document !== 'undefined' ? (document.activeElement as HTMLElement | null) : null
  if (!el) return false
  const tag = el.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || el.isContentEditable
}

// Enhanced chat system with backend integration
function ChatSystem({
  isOpen,
  onToggle,
  campusHook,
  isTouchDevice = false,
}: {
  isOpen: boolean
  onToggle: () => void
  campusHook: CampusHook
  isTouchDevice?: boolean
}) {
  const [newMessage, setNewMessage] = useState("")
  const [activeTab, setActiveTab] = useState("global")
  const scrollRef = useRef<HTMLDivElement>(null)
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
  // Whiteboard strokes travel on the same channel and are not messages, so
  // counting them would ring the chat badge every time somebody drew a line.
  const spokenCount = useMemo(
    () => chatMessages.reduce((total, msg) => total + (isDrawableChat(msg.message) ? 1 : 0), 0),
    [chatMessages],
  )
  useEffect(() => {
    if (isOpen) seenCountRef.current = spokenCount
  }, [isOpen, spokenCount])
  const unread = Math.max(0, spokenCount - seenCountRef.current)

  // In backend units, and the campus is ten of those to the world unit. 400
  // covers the quad and the buildings around it, which is what "nearby" means
  // now the world is nearly four times wider than it was.
  const nearbyUsers = getNearbyPlayers(400)

  const handleSend = () => {
    if (newMessage.trim()) {
      sendChatMessage(newMessage, activeTab)
      setNewMessage("")
    }
  }

  // Filter messages by channel. Whiteboard strokes ride the same channel and
  // are not things anybody said, so they never reach the panel.
  const filteredMessages = chatMessages.filter(msg => {
    if (!isDrawableChat(msg.message)) return false
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
            onChange={(e) => setNewMessage(e.target.value)}
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

/**
 * Another player.
 *
 * The name is a sprite rather than a drei `Html` overlay. Twenty players used
 * to mean twenty absolutely-positioned DOM nodes whose transforms the browser
 * recomputed every frame; now it is twenty quads the GPU draws for free.
 */
function PlayerAvatar({
  position,
  userData,
  seed,
  bubble,
  speaking,
  isPresenting,
}: {
  position: { x: number; z: number }
  /** Loose: the same component renders both a socket payload and local state. */
  userData: Record<string, unknown>
  /** The player's user id, which decides everything about how they look. */
  seed: string | number
  /** Their most recent chat message, while it is still fresh. */
  bubble?: string | null
  /** Whether proximity voice currently hears them. */
  speaking?: boolean
  /** Whether they are the one sharing a screen. */
  isPresenting?: boolean
}) {
  const meshRef = useRef<Group>(null)
  // Allocated once. The old version constructed a Vector3 every frame for every
  // player on the campus, which is a garbage collection pause on a schedule.
  const target = useRef(new Vector3())

  useFrame((_, delta) => {
    if (!meshRef.current) return
    target.current.set(position.x, 0, position.z)
    // Framerate-independent. A fixed 0.15 per frame closed the gap more than
    // twice as fast on a 144Hz display as on a 60Hz one, so remote players
    // moved at a speed that depended on the watcher's monitor.
    const alpha = 1 - Math.exp(-REMOTE_LERP_RATE * Math.min(delta, 0.1))
    meshRef.current.position.lerp(target.current, alpha)
  })

  const name = String(userData.full_name || userData.username || userData.name || "Student")

  return (
    <group ref={meshRef} position={[position.x, 0, position.z]}>
      <CharacterModel
        color={String(userData.color ?? "#4F46E5")}
        isMoving={Boolean(userData.is_moving)}
        direction={String(userData.direction ?? "down")}
        heading={typeof userData.heading === 'number' ? userData.heading : undefined}
        activity={String(userData.activity ?? "standing")}
        speed={Boolean(userData.is_moving) ? 5.5 : 0}
        seed={seed}
      />
      <NameTag
        name={name}
        accent={String(userData.color ?? "#8fd0ff")}
        status={statusFor({
          activity: userData.activity as string | undefined,
          currentRoom: userData.current_room as string | null | undefined,
          isPresenting,
        })}
      />
      {bubble && <ChatBubble text={bubble} />}
      {speaking && <SpeakingRing accent={String(userData.color ?? "#6ee7a8")} />}
    </group>
  )
}

/**
 * Puts the camera somewhere sensible when the scene swaps.
 *
 * Entering a building replaces the world with a room built at the origin.
 * Without moving the camera the player keeps their outdoor position, which is
 * usually outside that room, so they end up looking at the back of the walls.
 */
function InteriorCameraPlacement({ insideBuilding }: { insideBuilding: CampusBuilding | null }) {
  const { camera } = useThree()
  const outsidePosition = useRef<Vector3 | null>(null)

  useEffect(() => {
    if (insideBuilding) {
      outsidePosition.current = camera.position.clone()
      const spec = INTERIOR_SPECS[insideBuilding.interior]
      // Just inside the entrance, facing into the room.
      camera.position.set(spec.spawn[0], spec.spawn[1], spec.spawn[2])
      if (spec.spawnLookAt) {
        // lookAt leaves roll at zero, so the pointer-lock controls pick this
        // up as an ordinary heading and pitch.
        camera.lookAt(spec.spawnLookAt[0], spec.spawnLookAt[1], spec.spawnLookAt[2])
      } else {
        camera.rotation.set(0, 0, 0)
      }
    } else if (outsidePosition.current) {
      camera.position.copy(outsidePosition.current)
      outsidePosition.current = null
    }
  }, [insideBuilding, camera])

  return null
}

/**
 * What the player is standing next to.
 *
 * Written into a ref rather than React state: this runs every frame, and
 * turning "am I near the library" into a state update would re-render the whole
 * page as you walk past it. The HUD samples the ref a few times a second.
 */
export interface Proximity {
  building: CampusBuilding | null
  area: StudyArea | null
}

function ProximitySensor({
  insideBuilding,
  target,
}: {
  insideBuilding: CampusBuilding | null
  target: React.RefObject<Proximity>
}) {
  const { camera } = useThree()

  useFrame(() => {
    if (!target.current) return

    if (insideBuilding) {
      target.current.building = null
      target.current.area = null
      return
    }

    target.current.building = nearestEntrance(camera.position.x, camera.position.z)?.building ?? null

    let area: StudyArea | null = null
    for (const candidate of studyAreas) {
      const distance = Math.hypot(
        camera.position.x - candidate.position[0],
        camera.position.z - candidate.position[2],
      )
      if (distance < candidate.radius) {
        area = candidate
        break
      }
    }
    target.current.area = area
  })

  return null
}

/**
 * E to enter or leave a building.
 *
 * Entering by clicking a marker in the world does not work while the pointer is
 * locked for mouse-look, which is the normal way to play, so the doors are
 * opened from wherever the player is standing instead.
 */
function ProximityInteraction({
  insideBuilding,
  onEnter,
  onExit,
  touch,
}: {
  insideBuilding: CampusBuilding | null
  onEnter: (building: CampusBuilding) => void
  onExit: () => void
  touch?: React.RefObject<TouchState | null>
}) {
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
        const found = nearestEntrance(camera.position.x, camera.position.z)
        if (found) onEnter(found.building)
      }
    }
    wasPressed.current = pressed
  })

  return null
}

/** Feeds the mini-games the state of the hold key, from either input method. */
function ActionKeyBridge({ action }: { action: React.RefObject<ActionInput> }) {
  const [, get] = useKeyboardControls()

  useFrame(() => {
    if (!action.current) return
    const keyHeld = Boolean(get().action) && !isTypingInField()
    action.current.held = keyHeld || action.current.touchHeld === true
  })

  return null
}

/** First person player controller with backend position sync. */
/**
 * Camera height above the floor the player is standing on.
 *
 * Was a bare 1.5 compared against `camera.position.y`, which only worked while
 * the floor was a single plane at zero. With tiers and stairs the two have to
 * be told apart: `feet + EYE_HEIGHT` is where the camera goes.
 */
const EYE_HEIGHT = 1.5

/** Eye height above the seat pan, once you are sitting on it. */
const SEATED_EYE = 1.15

/**
 * How quickly a remote player's avatar closes on the position last received.
 *
 * Positions arrive ten times a second, so this has to cover 100 ms of travel
 * without visibly lagging or overshooting into a rubber band.
 */
const REMOTE_LERP_RATE = 12

/**
 * Which way the camera is facing, as an avatar heading.
 *
 * The camera looks down its own -Z, and the avatar's zero is +Z, so the two
 * are half a turn apart. Reading `camera.rotation.y` directly points every
 * standing player the opposite way to the one they are looking.
 */
function cameraHeading(camera: { rotation: { y: number } }): number {
  return camera.rotation.y + Math.PI
}

/**
 * Sitting down, standing up, and the emotes.
 *
 * Lives inside the canvas because it needs the camera's position every frame to
 * know which chair the player is standing at, and outside `Player` because the
 * page's DOM overlay needs the prompt too.
 *
 * The seat itself is never claimed here. `takeSeat` asks the server and the
 * answer comes back as `ownSeat`, which is what actually sits the player down —
 * two people can press the key in the same tick and only one of them gets the
 * chair.
 */
function SeatController({
  campusHook,
  insideBuilding,
  ownSeat,
  onCandidate,
  onEmote,
  leaning,
  onLean,
}: {
  campusHook: CampusHook
  insideBuilding: CampusBuilding | null
  ownSeat: string | null
  onCandidate: (seat: Seat | null) => void
  onEmote: (activity: Activity | null) => void
  leaning: boolean
  onLean: (leaning: boolean) => void
}) {
  const { camera } = useThree()
  const [, get] = useKeyboardControls()
  const { takeSeat, leaveSeat, seatedPlayers } = campusHook
  const held = useRef({ sit: false, lean: false, emote: '' })
  const candidate = useRef<Seat | null>(null)
  const emoteUntil = useRef(0)

  /**
   * Whether the player has their back to something they could lean on.
   *
   * Read from the camera every time rather than captured, because both terms
   * change as the player moves: which colliders apply depends on the room, and
   * a room's own walls are a clamp rather than geometry.
   */
  const wallBehind = useCallback(() => {
    const solid = insideBuilding ? interiorColliders(insideBuilding.interior) : SOLID_CAMPUS
    const limit = insideBuilding ? interiorHalfExtent(insideBuilding.interior) : undefined
    return leanSurface(
      camera.position.x,
      camera.position.z,
      cameraHeading(camera),
      solid,
      limit,
    )
  }, [camera, insideBuilding])

  // Seats other people are in. Offering an occupied chair and having the
  // server refuse it reads as the key not working.
  //
  // Read from the hook's seating map rather than scanned out of the position
  // frames: a frame is a snapshot of where somebody is, not a record of what
  // they hold, and building the set from frames lost a chair every time its
  // occupant did anything that sent one.
  const taken = useMemo(() => takenSeatIds(seatedPlayers), [seatedPlayers])

  useFrame((state) => {
    const typing = isTypingInField()
    const controls = get()

    // What is within reach, so the prompt can name it.
    const seats = insideBuilding ? interiorSeats(insideBuilding.interior) : []
    const feet = camera.position.y - EYE_HEIGHT
    const near = ownSeat
      ? null
      : nearestSeat(camera.position.x, camera.position.z, seats, SEAT_REACH, taken, feet)
    if (near?.id !== candidate.current?.id) {
      candidate.current = near
      onCandidate(near)
    }

    // Edge-triggered: holding the key must not sit and stand every frame.
    const sitPressed = !typing && controls.sit
    if (sitPressed && !held.current.sit) {
      if (ownSeat) leaveSeat()
      else if (near) takeSeat(near.id)
    }
    held.current.sit = sitPressed

    // Leaning. A posture rather than an emote: it holds until pressed again,
    // and unlike a chair there is nothing to claim, because two people can
    // lean on the same wall.
    const leanPressed = !typing && Boolean(controls.lean)
    if (leanPressed && !held.current.lean) {
      if (leaning) {
        onLean(false)
      } else if (!ownSeat && wallBehind()) {
        onLean(true)
      }
    }
    held.current.lean = leanPressed

    // Walking away from the wall stands you up. Without this a player leans
    // on nothing all the way across the quad.
    if (leaning && !wallBehind()) onLean(false)

    // Emotes are one-shot and release themselves, so a wave does not last
    // until the player thinks to press something else.
    let pressed: Activity | '' = ''
    for (const [key, activity] of EMOTE_KEYS) {
      if (!typing && controls[key as keyof typeof controls]) {
        pressed = activity
        break
      }
    }
    if (pressed && pressed !== held.current.emote) {
      emoteUntil.current = state.clock.elapsedTime + EMOTE_SECONDS
      onEmote(pressed)
    }
    held.current.emote = pressed

    if (emoteUntil.current && state.clock.elapsedTime > emoteUntil.current) {
      emoteUntil.current = 0
      onEmote(null)
    }
  })

  return null
}

function Player({
  campusHook,
  insideBuilding,
  touch,
  seated,
  emote,
  leaning,
}: {
  campusHook: CampusHook
  insideBuilding: CampusBuilding | null
  touch?: React.RefObject<TouchState | null>
  /** The seat the player is in, if any. Movement is off while they are. */
  seated: Seat | null
  /** A one-shot pose, or null. Held poses come through `seated`. */
  emote: Activity | null
  /** Propped against a wall, which is a posture rather than an emote. */
  leaning: boolean
}) {
  const { camera } = useThree()
  const [, get] = useKeyboardControls()
  const velocity = useRef(new Vector3())
  const direction = useRef(new Vector3())
  const isOnGround = useRef(true)

  const { updatePosition, worldTo2D } = campusHook

  // r3f aims the default camera at the scene origin, so a camera above the
  // origin starts the game looking at the floor. Level the pitch once and put
  // the player on the spine, facing the main building.
  useEffect(() => {
    camera.rotation.set(0, 0, 0)
    camera.position.set(SPAWN[0], SPAWN[1], SPAWN[2])
  }, [camera])

  useFrame((state, rawDelta) => {
    // A backgrounded tab hands back a delta of whole seconds. Left unclamped,
    // one frame of it teleports the player through a wall and past the far
    // side of the campus.
    const delta = Math.min(rawDelta, 0.1)
    const typing = isTypingInField()
    const raw = get()
    const { forward, backward, leftward, rightward, jump, run } = typing
      ? { forward: false, backward: false, leftward: false, rightward: false, jump: false, run: false }
      : raw

    // Faster than it was: the campus is now nearly four times wider, and the
    // old 4 m/s walk made crossing it a chore.
    const speed = run ? 11 : 5.5
    const jumpForce = 8

    direction.current.set(0, 0, 0)

    // Sitting down parks the camera on the chair and stops taking input. It
    // still reports position every frame, so anyone watching sees the pose.
    if (seated) {
      camera.position.set(seated.x, seated.y + seated.seatHeight + SEATED_EYE, seated.z)
      const backend = worldTo2D(camera.position.x, camera.position.z)
      updatePosition({
        x: backend.x,
        y: backend.y,
        direction: 'down',
        heading: seated.ry,
        // An emote wins over the seat. Raising a hand from a chair in a lecture
        // is the whole point of having both; the server keeps the seat either
        // way, because only leave_seat releases it.
        activity: emote ?? 'sitting',
        is_moving: false,
        current_room: insideBuilding ? String(insideBuilding.id) : null,
      })
      return
    }

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

    const moving = direction.current.lengthSq() > 0
    // The heading, kept as a unit vector before the frame scale goes on.
    // Deriving the facing from the scaled vector made it depend on frame rate:
    // one step at 5.5 m/s and 60fps is 0.09 units, which failed the 0.1 test
    // below, so a player walking forwards was reported as facing 'down' to
    // everyone else — but the same input at 30fps passed.
    let headingX = 0
    let headingZ = 0
    if (moving) {
      direction.current.normalize()
      direction.current.multiplyScalar(speed * delta)

      // Apply camera rotation to movement direction
      direction.current.applyEuler(camera.rotation)
      direction.current.y = 0 // Keep movement horizontal

      const length = Math.hypot(direction.current.x, direction.current.z) || 1
      headingX = direction.current.x / length
      headingZ = direction.current.z / length
    }

    // Jump logic
    if ((jump || touch?.current?.jump) && isOnGround.current) {
      velocity.current.y = jumpForce
      isOnGround.current = false
    }

    // Apply gravity
    velocity.current.y -= 20 * delta

    camera.position.add(direction.current)
    camera.position.y += velocity.current.y * delta

    // What is solid here, and what can be stood on. Both change on the
    // threshold of a building, which is why they are read per frame rather
    // than captured once.
    const platforms = insideBuilding ? interiorPlatforms(insideBuilding.interior) : []
    const feet = camera.position.y - EYE_HEIGHT

    // Anything too high to step onto is a wall rather than a ramp: a stage
    // edge stops you from the floor, and once you are up there you walk about
    // on top of it freely.
    const solid: Collider[] = insideBuilding
      ? [...interiorColliders(insideBuilding.interior), ...blockingPlatforms(platforms, feet)]
      : SOLID_CAMPUS

    if (insideBuilding) {
      // The room's own walls, which are a clamp rather than geometry.
      const limit = interiorHalfExtent(insideBuilding.interior)
      camera.position.x = MathUtils.clamp(camera.position.x, -limit, limit)
      camera.position.z = MathUtils.clamp(camera.position.z, -limit, limit)
    } else {
      camera.position.x = MathUtils.clamp(camera.position.x, -CAMPUS_LIMIT, CAMPUS_LIMIT)
      camera.position.z = MathUtils.clamp(camera.position.z, -CAMPUS_LIMIT, CAMPUS_LIMIT)
    }

    // Everything solid, indoors and out: buildings, trees, the fountain, and
    // now every table, shelf and counter. None of it used to stop you.
    const resolved = resolveColliders(camera.position.x, camera.position.z, solid)
    camera.position.x = resolved.x
    camera.position.z = resolved.z

    // The floor under the player, which is not always zero: the amphitheatre
    // is raked, the sports hall has bleachers, and the entrance hall has a
    // staircase. All three used to pass straight through the player's head.
    const floor = groundHeight(camera.position.x, camera.position.z, platforms, feet)
    const standing = floor + EYE_HEIGHT
    if (camera.position.y <= standing && velocity.current.y <= 0) {
      velocity.current.y = 0
      camera.position.y = standing
      isOnGround.current = true
    }

    // Always update backend position (even when not moving, to send final
    // position on stop). The hook throttles the sending.
    const backendCoords = worldTo2D(camera.position.x, camera.position.z)

    let playerDirection = 'down'
    if (moving) {
      if (Math.abs(headingX) > Math.abs(headingZ)) {
        playerDirection = headingX > 0 ? 'right' : 'left'
      } else if (Math.abs(headingZ) > 0.1) {
        playerDirection = headingZ > 0 ? 'down' : 'up'
      }
    }

    // The real angle, not one of four. Taken from the camera when standing
    // still so that turning on the spot is visible to everyone else, and from
    // the movement vector when walking so a player strafing is drawn facing
    // the way they are actually travelling.
    const heading = moving ? Math.atan2(headingX, headingZ) : cameraHeading(camera)

    updatePosition({
      x: backendCoords.x,
      y: backendCoords.y,
      direction: playerDirection,
      heading,
      // An emote wins over the posture, the posture over standing: waving
      // from a wall is still waving, and stopping is still leaning.
      activity: emote ?? (leaning ? 'leaning' : 'standing'),
      is_moving: moving,
      // Was hardcoded null, so the server never knew which building anyone
      // was standing in, and neither did anyone else's client. Sent as the
      // building's id rather than its name: two buildings could be given the
      // same name, and they would then share a projector.
      current_room: insideBuilding ? String(insideBuilding.id) : null,
    })
  })

  return null
}

/** Main Campus component with backend integration */
const CampusWithBackend = () => {
  const navigate = useNavigate()
  const { lobbyId: rawLobbyId } = useParams()
  // Sanitize route param: some callers may accidentally navigate to '/campus-simulator/null'
  const lobbyId = (rawLobbyId === 'null' || rawLobbyId === 'undefined') ? null : rawLobbyId;
  const [isChatOpen, setIsChatOpen] = useState(false)
  const [insideBuilding, setInsideBuilding] = useState<CampusBuilding | null>(null)
  /** The chair within reach, for the prompt. Not the one being sat in. */
  const [seatCandidate, setSeatCandidate] = useState<Seat | null>(null)
  const [emote, setEmote] = useState<Activity | null>(null)
  /**
   * Propped against a wall.
   *
   * Held here rather than in the controller that sets it because the pose has
   * to reach the position frames, and those are sent from the player
   * controller — a posture nobody else can see is a posture that does not
   * exist.
   */
  const [leaning, setLeaning] = useState(false)
  /**
   * A clock for expiring chat bubbles.
   *
   * Ticks once a second rather than per frame: a bubble that vanishes a second
   * late is invisible, and re-deriving every avatar's bubble sixty times a
   * second is the sort of thing this page has already been fixed for once.
   */
  /**
   * Whether the pointer is captured.
   *
   * The whiteboard needs a cursor, and the campus is played with the pointer
   * locked — which is also the only state in which the player could not aim at
   * the board anyway. So drawing is live exactly when looking around is not.
   */
  const [pointerLocked, setPointerLocked] = useState(false)
  const [bubbleClock, setBubbleClock] = useState(() => Date.now())
  useEffect(() => {
    const timer = setInterval(() => setBubbleClock(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [])
  const isTouchDevice = useIsTouchDevice()
  const touchState = useRef(createTouchState())
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [shareExpanded, setShareExpanded] = useState(false)
  const [currentUser, setCurrentUser] = useState<CampusPlayer>(getCurrentUser())
  const [timeOfDay, setTimeOfDay] = useState<TimeOfDay>('day')
  // Scaled back automatically on a machine that cannot keep up.
  const [dpr, setDpr] = useState(1.5)

  const games = useCampusGames()
  const actionInput = useRef<ActionInput>({ held: false, touchHeld: false })

  const proximity = useRef<Proximity>({ building: null, area: null })
  const [nearBuilding, setNearBuilding] = useState<CampusBuilding | null>(null)
  const [nearArea, setNearArea] = useState<StudyArea | null>(null)

  // Sampled rather than pushed: the sensor writes a ref every frame, and this
  // turns it into React state only when the answer actually changes.
  useEffect(() => {
    const timer = setInterval(() => {
      setNearBuilding((current) =>
        current?.id === proximity.current.building?.id ? current : proximity.current.building,
      )
      setNearArea((current) =>
        current?.id === proximity.current.area?.id ? current : proximity.current.area,
      )
    }, 160)
    return () => clearInterval(timer)
  }, [])

  // Initialize campus simulation hook
  const campusHook = useCampusSimulator(lobbyId)

  /**
   * The room this player is in, in the form it travels in.
   *
   * The same value that goes out on every position frame, so that comparing it
   * against another player's `current_room` is comparing like with like.
   */
  const myRoom = useMemo(
    () => (insideBuilding ? String(insideBuilding.id) : null),
    [insideBuilding],
  )

  /**
   * The seat the player is actually in.
   *
   * Resolved from the id the server handed back rather than from the chair they
   * walked up to: the two differ whenever somebody else got there first, and
   * trusting the local one would sit them in an occupied chair.
   */
  const seatedOn = useMemo(() => {
    if (!campusHook.ownSeat || !insideBuilding) return null
    return interiorSeats(insideBuilding.interior).find((s) => s.id === campusHook.ownSeat) ?? null
  }, [campusHook.ownSeat, insideBuilding])

  // Walking out of the room gives up the chair. `seatedOn` goes null on its own
  // when the building does, so the player stands up locally and gets their
  // movement back — but the server holds a seat until it is released, and both
  // ways out of a building (the button and walking through the door) went
  // straight past that. The chair stayed occupied for everybody else until the
  // tab closed, and the prompt that teaches C is hidden once you are outside.
  const { ownSeat, leaveSeat } = campusHook
  useEffect(() => {
    if (!insideBuilding && ownSeat) leaveSeat()
  }, [insideBuilding, ownSeat, leaveSeat])

  // Whiteboard strokes ride the chat channel and are not things anybody said.
  // The chat panel and the unread badge already filter them; without this the
  // encoded payload appears in a speech bubble over whoever drew it.
  const spokenMessages = useMemo(
    () => campusHook.chatMessages.filter((m) => isDrawableChat(m.message)),
    [campusHook.chatMessages],
  )

  const {
    isConnected,
    isLoading,
    error,
    currentLobby,
    lobbyMembers,
    playerPositions,
    userPosition,
    disconnect,
    coordsTo3D,
    joinStudyRoom,
    leaveStudyRoom,
  } = campusHook

  // Release the pointer when any panel opens: while it is locked the cursor is
  // hidden and clicks go to the 3D view instead of the UI.
  useEffect(() => {
    if ((isChatOpen || isMenuOpen || games.result) && document.pointerLockElement) {
      document.exitPointerLock()
    }
  }, [isChatOpen, isMenuOpen, games.result])

  // Leaving the area you joined should also leave the room on the server.
  const joinedArea = useRef<string | null>(null)
  // Mirrored into state purely so the button's label repaints. Writing a ref
  // schedules nothing, so it kept reading "Join study" after a join.
  const [joinedAreaId, setJoinedAreaId] = useState<string | null>(null)
  useEffect(() => {
    if (joinedArea.current && joinedArea.current !== nearArea?.id) {
      leaveStudyRoom(joinedArea.current)
      joinedArea.current = null
      setJoinedAreaId(null)
    }
  }, [nearArea, leaveStudyRoom])

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
      (m: { user_id?: string | number; full_name?: string }) => String(m.user_id) === userId,
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
    return Boolean(presenter && presenter.current_room === String(insideBuilding.id))
  }, [voice.screenShare, insideBuilding, playerPositions])

  const sharerRoom = useMemo(() => {
    if (!voice.screenShare || voice.screenShare.isLocal) return null
    const userId = String(voice.screenShare.identity || '').replace(/^user-/, '')
    const presenter = playerPositions?.get?.(userId) ?? playerPositions?.get?.(Number(userId))
    // The id is what travels; the name is what a person can read.
    const room = presenter?.current_room
    return CAMPUS_BUILDINGS.find((b) => String(b.id) === room)?.name || null
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
          const userData = await api.get<{
            id: number
            username: string
            full_name?: string
            year?: string
            major?: string
          }>('/auth/user/')
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
  /**
   * Everyone else, and the room each of them is standing in.
   *
   * The room matters because a position means different things in different
   * places. Indoors the camera is in room space — every interior is built at
   * the origin — and that is what gets sent. Drawn without checking the room,
   * somebody sitting in the library appeared to everyone outdoors as an avatar
   * wandering around the middle of the quad.
   */
  const playerAvatars = useMemo(() => {
    const avatars: {
      id: string | number
      room: string | null
      position: { x: number; z: number }
      userData: Record<string, unknown>
    }[] = []
    const currentUserId = currentUser?.id
    playerPositions.forEach((position, userId) => {
      // Skip current user's position - they control their own camera, not a separate avatar
      if (userId === currentUserId) {
        return
      }
      const worldPos = coordsTo3D(position.x, position.y)
      avatars.push({
        id: userId,
        room: position.current_room ?? null,
        position: { x: worldPos.x, z: worldPos.z },
        userData: {
          username: position.username,
          full_name: position.full_name || position.username,  // Use full_name, fallback to username
          direction: position.direction,
          // Without these three, everything this page draws for a remote player
          // falls back to standing and facing one of four ways: the heading is
          // unused, every pose reads as 'standing', and the status line is
          // always null. The socket carries them; only this mapping dropped them.
          heading: position.heading,
          activity: position.activity,
          current_room: position.current_room,
          is_moving: position.is_moving,
          color: `hsl(${(Number(userId) * 137.5) % 360}, 70%, 60%)`, // Generate colour from user id
        }
      })
    })
    return avatars
  }, [playerPositions, coordsTo3D, currentUser?.id])

  /**
   * The ones you can actually see from where you are standing.
   *
   * A room is a shared place now, not a local view of one: walk into the
   * cafeteria with somebody and you are both in it. Outdoors this hides
   * everybody who is indoors, whose coordinates would otherwise land them on
   * the quad.
   */
  const visibleAvatars = useMemo(
    () => playerAvatars.filter((avatar) => inSameRoom(avatar.room, myRoom)),
    [playerAvatars, myRoom],
  )

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

  const interiorSpec = insideBuilding ? INTERIOR_SPECS[insideBuilding.interior] : null

  return (
    <>
      <Helmet>
        <title>Ufazien | Campus id: {lobbyId}</title>
        <meta name="description" content="Explore a 3D UFAZ campus with friends in real time: walk the Nizami Street frontage, go inside the buildings, and play." />
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

      {/* Walking up to a door offers to open it. This used to be a floating
          HTML button in the 3D scene, which could not be clicked at all while
          the pointer was locked for mouse-look. */}
      {!insideBuilding && nearBuilding && !games.active && (
        <div className="absolute left-1/2 -translate-x-1/2 bottom-32 sm:bottom-16 z-30 pointer-events-none max-w-[92vw]">
          <div className="bg-black/80 backdrop-blur-sm border border-blue-500/30 rounded-xl px-4 py-2.5 text-white text-center">
            <div className="text-sm font-semibold">
              {nearBuilding.icon} {nearBuilding.name}
            </div>
            <div className="text-xs text-gray-300 mt-0.5">{nearBuilding.blurb}</div>
            <div className="text-xs text-blue-300 mt-1">
              {isTouchDevice ? 'Tap Enter to go inside' : 'Press E to go inside'}
            </div>
          </div>
        </div>
      )}

      {/* Sitting down. The prompt names the chair you are actually standing at,
          and only offers one nobody else is in. */}
      {!games.active && (insideBuilding || leaning) && (seatCandidate || campusHook.ownSeat || leaning) && (
        <div className="absolute left-1/2 -translate-x-1/2 bottom-32 sm:bottom-16 z-30 pointer-events-none max-w-[92vw]">
          <div className="bg-black/80 backdrop-blur-sm border border-emerald-500/30 rounded-xl px-4 py-2.5 text-white text-center">
            <div className="text-xs text-emerald-300">
              {leaning
                ? 'Press V to stand up straight'
                : campusHook.ownSeat
                  ? 'Press C to stand up'
                  : 'Press C to sit down'}
            </div>
            <div className="text-[11px] text-gray-400 mt-1">
              V lean · 1 wave · 2 clap · 3 raise hand · 4 point
            </div>
          </div>
        </div>
      )}

      {/* Chat takes over the bottom of a phone screen, which is exactly where
          the controls live. Nobody steers while typing, so they stand down. */}
      {isTouchDevice && !isChatOpen && (
        <TouchControls
          stateRef={touchState}
          insideBuilding={insideBuilding}
          canInteract={Boolean(nearBuilding)}
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

      {/* Standing in a study area offers to join it. Also DOM rather than a
          panel in the scene, for the same pointer-lock reason as the doors. */}
      {nearArea && !games.active && !nearBuilding && (
        <div className="absolute right-4 top-32 z-20 pointer-events-auto w-[min(18rem,80vw)]">
          <div className="bg-black/85 backdrop-blur-sm border border-blue-500/30 rounded-xl p-4 text-white">
            <div className="text-2xl">{nearArea.icon}</div>
            <h3 className="font-bold text-blue-400">{nearArea.name}</h3>
            <p className="text-xs text-gray-300 mt-1 leading-relaxed">{nearArea.description}</p>
            <p className="text-[11px] text-blue-300 mt-2">
              📚 {nearArea.subject} · ⏱️ {nearArea.duration} · up to {nearArea.maxUsers}
            </p>
            <button
              onClick={() => {
                joinStudyRoom(nearArea.id)
                joinedArea.current = nearArea.id
                setJoinedAreaId(nearArea.id)
              }}
              className="mt-3 w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg text-sm font-medium"
            >
              {joinedAreaId === nearArea.id ? 'Joined' : 'Join study'}
            </button>
          </div>
        </div>
      )}

      {/* Game Menu */}
      {/* Top-left, under the connection pill: bottom-left belongs to the voice
          panel, and the two overlapped each other. */}
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
              {/* Time of day. The lighting rig has three presets and they
                  change the campus completely, so they are worth exposing. */}
              <div>
                <div className="text-xs text-gray-400 mb-1.5">Time of day</div>
                <div className="grid grid-cols-3 gap-1.5">
                  {([
                    ['day', Sun, 'Day'],
                    ['dusk', Sunset, 'Dusk'],
                    ['night', Moon, 'Night'],
                  ] as [TimeOfDay, typeof Sun, string][]).map(([key, Icon, label]) => (
                    <button
                      key={key}
                      onClick={() => setTimeOfDay(key)}
                      className={`flex flex-col items-center gap-1 py-2 rounded text-[11px] transition-colors ${
                        timeOfDay === key
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      {label}
                    </button>
                  ))}
                </div>
              </div>

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
        <Canvas
          id="campus-canvas"
          shadows
          dpr={dpr}
          gl={{
            antialias: true,
            powerPreference: 'high-performance',
            // Filmic response rather than a linear clip, so a sunlit limestone
            // wall stops blowing out to flat white.
            toneMapping: ACESFilmicToneMapping,
            toneMappingExposure: 1.05,
          }}
          camera={{ position: SPAWN, fov: 70, near: 0.1, far: 2200 }}
        >
          {/* Drops the resolution on a machine that cannot hold frame rate,
              and puts it back when it can. Better than picking one number and
              hoping it suits both a laptop and a phone. */}
          <PerformanceMonitor
            onDecline={() => setDpr(1)}
            onIncline={() => setDpr(Math.min(2, window.devicePixelRatio))}
          />

          <Suspense fallback={null}>
            {insideBuilding && interiorSpec ? (
              <BuildingInterior
                kind={insideBuilding.interior}
                whiteboard={
                  insideBuilding.interior === 'lecture' ? (
                    <Whiteboard
                      board="lecture"
                      position={[-13, 4.4, -INTERIOR_SPECS.lecture.halfExtent + 0.65]}
                      size={[7.5, 4]}
                      messages={campusHook.chatMessages}
                      onStroke={(encoded) => campusHook.sendChatMessage(encoded, 'global')}
                      enabled={!pointerLocked}
                    />
                  ) : undefined
                }
              >
                {/* No name plate in the scene: the page header already says
                    which building you are inside, and the way out is the
                    overlay button, because a marker behind the spawn point
                    cannot be seen. */}
                <ProjectorScreen
                  video={shareIsInThisRoom ? voice.screenShare?.element || null : null}
                  position={interiorSpec.projector}
                  ceiling={interiorSpec.ceiling}
                />

                {/* Whichever mini-game lives in this building. */}
                {insideBuilding.interior === 'lab' && (
                  <TitrationStation games={games} action={actionInput} position={[0, 0, 8]} />
                )}
                {insideBuilding.interior === 'library' && (
                  <ShelfStation games={games} action={actionInput} position={[0, 0, 14]} />
                )}
                {insideBuilding.interior === 'sports' && (
                  <BasketballStation
                    games={games}
                    action={actionInput}
                    hoop={[0, 3.05, -20]}
                    range={24}
                  />
                )}
                {/* The people in the room with you. A room used to be a local
                    view that nobody else appeared in, so walking into the
                    cafeteria with a friend put you both somewhere empty. The
                    coordinates need no conversion: inside, everyone's camera
                    is already in this room's space. */}
                {visibleAvatars.map((avatar) => (
                  <PlayerAvatar
                    key={avatar.id}
                    position={avatar.position}
                    userData={avatar.userData}
                    seed={avatar.id}
                    bubble={bubbleFor(avatar.id, spokenMessages, bubbleClock)}
                    speaking={isSpeaking(avatar.id, voice.participants)}
                    isPresenting={isSameParticipant(voice.screenShare?.identity, avatar.id)}
                  />
                ))}
              </BuildingInterior>
            ) : (
              <>
                <CampusEnvironment timeOfDay={timeOfDay} />
                <CampusGround />
                <CampusProps timeOfDay={timeOfDay} />
                <CampusBuildings timeOfDay={timeOfDay} />
                <CampusSkyline timeOfDay={timeOfDay} />

                {/* Study area markers on the ground */}
                {studyAreas.map((area) => (
                  <mesh key={area.id} position={[area.position[0], 0.07, area.position[2]]} rotation={[-Math.PI / 2, 0, 0]}>
                    <ringGeometry args={[area.radius - 0.7, area.radius, 48]} />
                    <meshStandardMaterial color="#4F46E5" transparent opacity={0.35} />
                  </mesh>
                ))}

                {/* Outdoor mini-games */}
                <BasketballStation
                  games={games}
                  action={actionInput}
                  hoop={[OUTDOOR_COURT[0], 3.05, OUTDOOR_COURT[2] - 9]}
                />
                <DashCourse games={games} />

                {/* Everybody else who is also outdoors. Anyone inside a
                    building is sending room coordinates, which drawn out here
                    put them in the middle of the quad. */}
                {visibleAvatars.map((avatar) => (
                  <PlayerAvatar
                    key={avatar.id}
                    position={avatar.position}
                    userData={avatar.userData}
                    seed={avatar.id}
                    bubble={bubbleFor(avatar.id, spokenMessages, bubbleClock)}
                    speaking={isSpeaking(avatar.id, voice.participants)}
                    isPresenting={isSameParticipant(voice.screenShare?.identity, avatar.id)}
                  />
                ))}
              </>
            )}

            <InteriorCameraPlacement insideBuilding={insideBuilding} />
            <ProximitySensor insideBuilding={insideBuilding} target={proximity} />
            <ProximityInteraction
              insideBuilding={insideBuilding}
              onEnter={setInsideBuilding}
              onExit={() => setInsideBuilding(null)}
              touch={touchState}
            />
            <ActionKeyBridge action={actionInput} />
            <Player
              campusHook={campusHook}
              insideBuilding={insideBuilding}
              touch={touchState}
              seated={seatedOn}
              emote={emote}
              leaning={leaning}
            />
            <SeatController
              campusHook={campusHook}
              insideBuilding={insideBuilding}
              ownSeat={campusHook.ownSeat}
              onCandidate={setSeatCandidate}
              onEmote={setEmote}
              leaning={leaning}
              onLean={setLeaning}
            />

            {/* Without a selector drei binds the lock handler to document, so every
                HUD click grabbed the pointer and the next click never landed. */}
            {!isTouchDevice && (
              <PointerLockControls
                selector="#campus-canvas"
                onLock={() => setPointerLocked(true)}
                onUnlock={() => setPointerLocked(false)}
              />
            )}
          </Suspense>
        </Canvas>
      </KeyboardControls>

      <Crosshair visible={games.active === 'booksort'} />

      <MinigameHud
        games={games}
        isTouchDevice={isTouchDevice}
        onAction={(held) => {
          actionInput.current.touchHeld = held
        }}
      />

      {/* Chat System */}
      <ChatSystem
        isOpen={isChatOpen}
        onToggle={() => setIsChatOpen(!isChatOpen)}
        campusHook={campusHook}
        isTouchDevice={isTouchDevice}
      />

      {/* Instructions */}
      {!games.active && (
        <div className={`absolute left-1/2 transform -translate-x-1/2 pointer-events-none z-10 max-w-[90vw] ${isTouchDevice ? "hidden" : "bottom-4"}`}>
          <div className="bg-black bg-opacity-75 text-white px-4 py-2 rounded-lg text-sm">
            <span className="hidden sm:inline">WASD to move • Shift to run • Space to jump • Click to look • E to enter a building • F to play</span>
            <span className="sm:hidden">Drag to look • Joystick to move</span>
          </div>
        </div>
      )}
    </div>
    </>
  )
}

export default CampusWithBackend
