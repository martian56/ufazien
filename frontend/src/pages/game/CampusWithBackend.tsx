import React, { useState, useRef, Suspense, useCallback, useEffect, useMemo, type MutableRefObject } from "react"
import { Helmet } from "react-helmet"
import { Canvas, useFrame, useThree } from "@react-three/fiber"
import { KeyboardControls, useKeyboardControls, PointerLockControls, PerformanceMonitor } from "@react-three/drei"
import { Vector3, MathUtils, ACESFilmicToneMapping, type PerspectiveCamera } from "three"
import type { Group } from "three"
import { useNavigate, useParams } from "react-router-dom"
import { BookOpen, Clock, DoorOpen, Globe, MapPin, MessageCircle, MonitorUp, Send, Users, X } from "lucide-react"
import { useCampusSimulator } from '../../hooks/useCampusSimulator'
import {
  DOOR_REACH,
  closedDoorColliders,
  doorSwing,
  doorWithinReach,
  exteriorDoorId,
  interiorDoorId,
  isDoorOpen,
  openDoor,
  pruneDoors,
  type DoorState,
} from '../../components/campus/doorState'
import DoorLeaf from '../../components/campus/DoorLeaf'
import { useCampusVoice } from '../../hooks/useCampusVoice'
import VoicePanel, { ScreenShareStage } from '../../components/campus/VoicePanel'
import HudDock from '../../components/campus/HudDock'
import CampusSettings from '../../components/campus/CampusSettings'
import { CAMPUS_KEY_MAP, hudActionFor } from '../../components/campus/keyBindings'
import type { Pose } from '../../components/campus/mapProjection'
import { useFullscreen } from '../../hooks/useFullscreen'
import ProjectorScreen from '../../components/campus/ProjectorScreen'
import { api } from '../../lib/api/client'
import { isAuthenticated } from '../../lib/api/tokens'
import { errorMessage } from '../../lib/api/errors'
import gpaApi from '../../lib/api/endpoints/gpa'
import TouchControls, { createTouchState, useIsTouchDevice } from '../../components/campus/TouchControls'
import type { TouchState } from '../../components/campus/TouchControls'
import {
  CampusEnvironment,
  CampusGround,
  CampusProps,
  CampusBuildings,
  CampusSkyline,
  ChatBubble,
  NameTag,
  SpeakingRing,
  THRESHOLD,
} from '../../components/campus/CampusScenery'
import { GltfCharacter } from '../../components/campus/GltfCharacter'
import { CORRIDOR_OF, exitOf, isCorridor, portalAt } from '../../components/campus/verticalCirculation'
import {
  LIFT_DOOR_SECONDS,
  floorAt,
  floorLevel,
  insideLiftCar,
  liftFloorPlatform,
  liftHeightAt,
  liftFloorNames,
} from '../../components/campus/ufazCore'
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
  approachStep,
  blockingPlatforms,
  collidersAt,
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
import { EMOTE_SECONDS, seatedHeading, type Activity } from '../../components/campus/avatarPose'
import { takenSeatIds } from '../../components/campus/seatState'
import {
  CAMPUS_DOORS,
  doorCrossed,
  doorstep,
  doorwayFor,
  interiorDoorFor,
  interiorLimit,
  leavingThroughDoor,
} from '../../components/campus/doorways'
import {
  nearestProp,
  propsIn,
  throwTarget,
  CARRY_HEIGHT,
  type PropSpec,
} from '../../components/campus/campusProps'
import CampusPropObjects from '../../components/campus/CampusPropObjects'
import {
  type TerminalStatistics,
  LibraryTerminalDesk,
  LibraryTerminalKey,
  LibraryTerminalPanel,
  LibraryTerminalSensor,
} from '../../components/campus/LibraryTerminal'
import { INTERIOR_SPECS, interiorHalfExtent } from '../../components/campus/interiorSpecs'
import {
  CAMPUS_BUILDINGS,
  CAMPUS_LIMIT,
  verticalFov,
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
  focusToken = 0,
}: {
  isOpen: boolean
  onToggle: () => void
  campusHook: CampusHook
  focusToken?: number
}) {
  const [newMessage, setNewMessage] = useState("")
  const [activeTab, setActiveTab] = useState("global")
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const seenCountRef = useRef(0)

  useEffect(() => {
    if (isOpen && focusToken > 0) inputRef.current?.focus()
  }, [isOpen, focusToken])

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
      <div className="pointer-events-auto absolute bottom-0 right-0 z-30 p-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pr-[max(0.5rem,env(safe-area-inset-right))] sm:p-4 short:left-0 short:right-auto short:pl-[max(0.5rem,env(safe-area-inset-left))]">
        <button
          onClick={onToggle}
          aria-label="Open the chat"
          title="Chat (T)"
          className="relative flex h-9 w-9 items-center justify-center rounded-lg border border-white/15 bg-slate-950/70 text-slate-200 shadow-lg shadow-black/40 backdrop-blur transition hover:border-white/35 hover:bg-slate-900/80 sm:h-10 sm:w-10"
        >
          <MessageCircle className="h-4 w-4 sm:h-[18px] sm:w-[18px]" />
          {unread > 0 && (
            <span className="absolute -right-1 -top-1 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-blue-500 px-1 text-[10px] font-semibold text-white">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </button>
      </div>
    )
  }

  return (
    <div className="pointer-events-auto absolute bottom-2 left-2 right-2 z-40 flex max-h-[min(58dvh,26rem)] flex-col overflow-hidden rounded-xl border border-white/10 bg-slate-950/95 shadow-2xl backdrop-blur sm:bottom-4 sm:left-auto sm:right-4 sm:max-h-[min(80dvh,32rem)] sm:w-96 short:right-auto short:top-12 short:max-h-none short:w-[min(19rem,46vw)] short:sm:left-2 short:sm:right-auto">
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-white/10 px-2 py-1.5">
        <div className="flex gap-1">
          {[
            {
              key: "global",
              Icon: Globe,
              label: "Global",
              count: filteredMessages.filter((m) => m.channel === "global").length,
            },
            {
              key: "nearby",
              Icon: MapPin,
              label: "Nearby",
              count: nearbyUsers.length,
            },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              aria-selected={activeTab === tab.key}
              role="tab"
              className={`flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium transition ${
                activeTab === tab.key
                  ? "bg-white/10 text-white"
                  : "text-slate-400 hover:bg-white/5 hover:text-slate-200"
              }`}
            >
              <tab.Icon className="h-3.5 w-3.5" />
              {tab.label}
              {tab.count > 0 && (
                <span className="rounded-full bg-white/15 px-1.5 text-[10px] tabular-nums">
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>
        <button
          onClick={onToggle}
          aria-label="Close the chat"
          className="rounded-md p-1.5 text-slate-400 transition hover:bg-white/10 hover:text-white"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Messages Area */}
      <div ref={scrollRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
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

      <div className="shrink-0 border-t border-white/10 p-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
        <div className="flex gap-1.5">
          <input
            ref={inputRef}
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleSend() } }}
            placeholder={`Message ${activeTab === "global" ? "everyone" : activeTab}`}
            className="min-w-0 flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-slate-500"
          />
          <button
            onClick={handleSend}
            disabled={!newMessage.trim()}
            aria-label="Send"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-white transition hover:bg-blue-500 disabled:bg-white/10 disabled:text-slate-500"
          >
            <Send className="h-4 w-4" />
          </button>
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
  /**
   * Where they are, including how high.
   *
   * `y` was hardcoded to zero here, which is right on a flat floor and wrong
   * everywhere else on the campus: a player on the amphitheatre's back tier is
   * three and three-quarter metres up, one on the sports hall's top bleacher is
   * two point eight, and one on the main stair is anywhere up to four and a
   * half. All of them were drawn sunk into the floor.
   */
  position: { x: number; y: number; z: number }
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
    target.current.set(position.x, position.y, position.z)
    // Framerate-independent. A fixed 0.15 per frame closed the gap more than
    // twice as fast on a 144Hz display as on a 60Hz one, so remote players
    // moved at a speed that depended on the watcher's monitor.
    const alpha = 1 - Math.exp(-REMOTE_LERP_RATE * Math.min(delta, 0.1))
    meshRef.current.position.lerp(target.current, alpha)
  })

  const name = String(userData.full_name || userData.username || userData.name || "Student")

  return (
    <group ref={meshRef} position={[position.x, position.y, position.z]}>
      <GltfCharacter
        color={String(userData.color ?? "#4F46E5")}
        isMoving={Boolean(userData.is_moving)}
        direction={String(userData.direction ?? "down")}
        heading={typeof userData.heading === 'number' ? userData.heading : undefined}
        activity={String(userData.activity ?? "standing")}
        speed={Boolean(userData.is_moving) ? 5.5 : 0}
        // Which of the CC0 packs this player wears. Derived from the same seed
        // the old model used for its appearance, so a given player keeps the
        // same look between sessions instead of being reshuffled on reconnect.
        variant={seed}
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
 *
 * Both ends are placed at the door rather than at a remembered position. The
 * old code restored wherever the player stood when they entered, which now
 * means the point at which they crossed the facade — inside the alcove, on the
 * far side of the plane that decides you are going in. Walking out put them
 * back there and they walked straight in again.
 */
function InteriorCameraPlacement({
  insideBuilding,
  arrival,
}: {
  insideBuilding: CampusBuilding | null
  /**
   * Where to put the player down, when they got here by stair, lift or an
   * inner door rather than through the front of the building.
   *
   * Without it every arrival lands at the front door of the room, so stepping
   * out of the lift on the fourth floor drops you at the foot of the stairs.
   */
  arrival: { x: number; z: number } | null
}) {
  const { camera } = useThree()
  const previous = useRef<CampusBuilding | null>(null)

  useEffect(() => {
    if (insideBuilding) {
      const spec = INTERIOR_SPECS[insideBuilding.interior]
      const door = interiorDoorFor(insideBuilding.interior)
      // Just inside the door you came through, which is now a real place in
      // the room rather than a spawn point chosen per interior.
      if (arrival) camera.position.set(arrival.x, spec.spawn[1], arrival.z)
      else camera.position.set(door.x, spec.spawn[1], door.z - 1.5)
      const look = spec.spawnLookAt ?? spec.projector
      // lookAt leaves roll at zero, so the pointer-lock controls pick this up
      // as an ordinary heading and pitch.
      camera.lookAt(look[0], look[1], look[2])
    } else if (previous.current) {
      const door = doorstep(doorwayFor(previous.current))
      camera.position.set(door.x, EYE_HEIGHT, door.z)
      // Facing away from the building, which is the direction you were walking.
      camera.lookAt(door.x, EYE_HEIGHT, door.z + 10)
    }
    previous.current = insideBuilding
    // Keyed on the *interior*, not the room. The four levels of the main
    // building are one interior with four `current_room` ids, and walking up
    // the stair changes the id — placing the camera on that would teleport the
    // player to the front door every time they reached a landing.
    //
    // `arrival` deliberately absent for the same shape of reason: it is set in
    // the same tick as the room and re-running this when it clears would put
    // them back at the door.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [insideBuilding?.interior, camera])

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
 * Picking things up, throwing them, and the light switch.
 *
 * Held down, G charges a throw; tapped, it drops the object at your feet. The
 * charge is the only reason this needs a frame loop rather than a key handler:
 * the power has to be read at the moment of release.
 */
function PropController({
  campusHook,
  insideBuilding,
  myRoom,
  onCandidate,
  onCharge,
}: {
  campusHook: CampusHook
  insideBuilding: CampusBuilding | null
  myRoom: string | null
  onCandidate: (prop: PropSpec | null) => void
  onCharge: (power: number) => void
}) {
  const { camera } = useThree()
  const [, get] = useKeyboardControls()
  const {
    ownProp,
    carriedProps,
    propPositions,
    takeProp,
    dropProp,
    roomLights,
    setRoomLight,
    worldTo2D,
    coordsTo3D,
  } = campusHook
  const held = useRef({ grab: false, light: false })
  const chargedAt = useRef(0)
  const candidate = useRef<PropSpec | null>(null)

  // Where each object in this room is, in world coordinates. Anything the
  // server has no record of is still at home.
  const here = useMemo(() => propsIn(insideBuilding?.interior ?? null), [insideBuilding])
  const restingPlaces = useMemo(() => {
    const places = new Map<string, { x: number; z: number }>()
    for (const prop of here) {
      const moved = propPositions.get(prop.id)
      places.set(prop.id, moved ? coordsTo3D(moved.x, moved.y) : { x: prop.home[0], z: prop.home[1] })
    }
    return places
  }, [here, propPositions, coordsTo3D])

  const inHands = useMemo(() => new Set(carriedProps.values()), [carriedProps])

  useFrame((state) => {
    const typing = isTypingInField()
    const controls = get()

    // What is within reach, so the prompt can name it.
    const near = ownProp
      ? null
      : nearestProp(camera.position.x, camera.position.z, here, restingPlaces, inHands)
    if (near?.id !== candidate.current?.id) {
      candidate.current = near
      onCandidate(near)
    }

    const grabbing = !typing && Boolean(controls.grab)
    if (grabbing && !held.current.grab) {
      if (ownProp) chargedAt.current = state.clock.elapsedTime
      else if (near) takeProp(near.id)
    }

    // The charge, so the HUD can show it filling.
    if (grabbing && ownProp && chargedAt.current) {
      onCharge(Math.min(1, (state.clock.elapsedTime - chargedAt.current) / THROW_CHARGE_SECONDS))
    }

    if (!grabbing && held.current.grab && ownProp && chargedAt.current) {
      const power = Math.min(1, (state.clock.elapsedTime - chargedAt.current) / THROW_CHARGE_SECONDS)
      const landing = throwTarget(
        camera.position.x,
        camera.position.z,
        cameraHeading(camera),
        power,
      )
      const sent = worldTo2D(landing.x, landing.z)
      dropProp(ownProp, sent.x, sent.y)
      chargedAt.current = 0
      onCharge(0)
    }
    held.current.grab = grabbing

    // The light switch, which is a room-wide toggle rather than anything held.
    const switching = !typing && Boolean(controls.light)
    if (switching && !held.current.light && myRoom) {
      setRoomLight(myRoom, !(roomLights.get(myRoom) ?? true))
    }
    held.current.light = switching
  })

  return null
}

/** How long G must be held for a throw at full power, in seconds. */
const THROW_CHARGE_SECONDS = 1.1

/**
 * How close following gets you before it stops.
 *
 * Far enough not to stand inside them — the avatar is drawn at the position it
 * reports, and a follower closing to zero ends up looking at the inside of a
 * head.
 */
const FOLLOW_DISTANCE = 2.6

/**
 * Holds the horizontal field of view steady as the window changes shape.
 *
 * three.js takes a vertical FOV, so a fixed one narrows as the window gets
 * taller. At 70 degrees vertical that is about 96 across on a desktop and
 * about 36 on a phone held in portrait — a third of the view, on the device
 * with the touch joystick, where turning to look at something is the
 * expensive part.
 */
function FieldOfView() {
  const camera = useThree((state) => state.camera) as PerspectiveCamera
  const size = useThree((state) => state.size)

  useEffect(() => {
    if (!camera.isPerspectiveCamera || !size.height) return
    const wanted = verticalFov(size.width / size.height)
    if (Math.abs(camera.fov - wanted) < 0.01) return
    camera.fov = wanted
    camera.updateProjectionMatrix()
  }, [camera, size.width, size.height])

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
    const feet = camera.position.y - EYE_HEIGHT
    const solid = insideBuilding
      ? collidersAt(interiorColliders(insideBuilding.interior), feet)
      : SOLID_CAMPUS
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

/**
 * The inside face of a room's door, as a collider while it is shut.
 *
 * The room boundary is a clamp rather than geometry, so without this the
 * player would be stopped by the wall either way and a shut door would feel
 * identical to an open one from inside.
 */
/**
 * Every door on the campus, and the one inside the room you are in.
 *
 * Rendered from the same state the collisions read, so what you see is what
 * stops you: a leaf that looks shut is shut.
 */
function CampusDoors({
  doors,
  insideBuilding,
}: {
  doors: DoorState
  insideBuilding: CampusBuilding | null
}) {
  const [, force] = useState(0)

  // The swing is a function of elapsed time, so this has to be sampled per
  // frame rather than only when the door state changes.
  useFrame(() => {
    if (Object.keys(doors).length > 0) force((n) => (n + 1) % 1000)
  })

  const now = performance.now()

  if (insideBuilding) {
    const inner = interiorDoorFor(insideBuilding.interior)
    return (
      <DoorLeaf
        x={inner.x}
        z={inner.z}
        halfWidth={inner.halfW}
        swing={doorSwing(doors, interiorDoorId(insideBuilding.id), now)}
        facing={-1}
      />
    )
  }

  return (
    <>
      {CAMPUS_DOORS.map((door) => (
        <DoorLeaf
          key={door.id}
          x={door.x}
          z={door.z}
          halfWidth={door.halfW}
          sill={THRESHOLD}
          swing={doorSwing(doors, exteriorDoorId(door.id), now)}
        />
      ))}
    </>
  )
}

function interiorClosedDoor(
  building: CampusBuilding,
  doors: DoorState,
  now: number,
): Collider[] {
  if (isDoorOpen(doors, interiorDoorId(building.id), now)) return []
  const door = interiorDoorFor(building.interior)
  return [{ x: door.x, z: door.z, halfW: door.halfW, halfD: 0.2 }]
}

function Player({
  campusHook,
  insideBuilding,
  touch,
  seated,
  emote,
  leaning,
  follow,
  onEnter,
  onTravel,
  onFloorChange,
  onLeave,
  liftHeight,
  onInLift,
  doors,
  onOpenDoor,
  poseRef,
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
  /** Walked in through a door. */
  onEnter: (building: CampusBuilding) => void
  /** Moving between rooms of the same building, by lift or inner door. */
  onTravel: (building: CampusBuilding, spawn: { x: number; z: number }) => void
  /** Arriving on another floor by walking there, which moves nothing. */
  onFloorChange: (building: CampusBuilding) => void
  /** Where the lift car is this instant, in metres. */
  liftHeight: () => number
  /** Whether the player is standing in the car, so the panel can appear. */
  onInLift: (inside: boolean) => void
  /** Walked back out through one. */
  onLeave: (building: CampusBuilding) => void
  /** Which doors are open, and since when. */
  doors: DoorState
  /** Work the handle on a door in reach. */
  onOpenDoor: (id: string) => void
  /** Where the player is, for the map, written rather than rendered. */
  poseRef: MutableRefObject<Pose>
  /**
   * Somebody to walk towards, in world coordinates, or null.
   *
   * Only ever set for a player in the same room, because a position means
   * different things in different rooms.
   */
  follow: { x: number; z: number } | null
}) {
  const { camera } = useThree()
  const [, get] = useKeyboardControls()
  const velocity = useRef(new Vector3())
  const direction = useRef(new Vector3())
  const isOnGround = useRef(true)
  /** Where the player was at the top of this frame, for the door test. */
  const before = useRef({ x: 0, z: 0 })
  /** Edge detection: holding E must not re-open a door every frame. */
  const doorHeld = useRef(false)
  /** The seat the camera has already been aimed for, so it is aimed once. */
  const satOn = useRef<string | null>(null)
  /** Where the lift was last frame, so a rider can be carried by the difference. */
  const lastCarY = useRef(0)

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

      // Turn to face the way the chair does, once, on sitting down. Sitting
      // moved the camera and left its rotation alone, so taking a seat in the
      // amphitheatre left you looking at whatever you happened to be looking
      // at — usually the back of the room you had just walked in through.
      if (satOn.current !== seated.id) {
        satOn.current = seated.id
        camera.rotation.order = 'YXZ'
        // `cameraHeading` is the camera's own yaw plus half a turn, so this is
        // the rotation that makes the player face along the seat.
        camera.rotation.set(0, seated.ry - Math.PI, 0)
      }

      // Where they are actually looking, held to what a person can turn to in
      // a chair. Broadcasting the seat's own facing froze a seated player
      // solid however much they looked around; broadcasting the raw camera
      // twists their folded legs through the back of the chair.
      const seatedFacing = seatedHeading(seated.ry, cameraHeading(camera))
      const backend = worldTo2D(camera.position.x, camera.position.z)
      poseRef.current = {
        x: camera.position.x,
        z: camera.position.z,
        heading: seatedFacing,
        room: insideBuilding ? String(insideBuilding.id) : null,
      }
      updatePosition({
        x: backend.x,
        y: backend.y,
        direction: 'down',
        heading: seatedFacing,
        // The floor the chair stands on, not the seat pan: the same number a
        // standing player sends, so a chair at floor level draws exactly as it
        // did before and a seat on the fourth tier draws three metres up.
        elevation: seated.y,
        // An emote wins over the seat. Raising a hand from a chair in a lecture
        // is the whole point of having both; the server keeps the seat either
        // way, because only leave_seat releases it.
        activity: emote ?? 'sitting',
        is_moving: false,
        current_room: insideBuilding ? String(insideBuilding.id) : null,
      })
      return
    }

    // On their feet, so the next time they sit the camera is aimed again.
    satOn.current = null

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

    const driving = direction.current.lengthSq() > 0
    // The heading, kept as a unit vector before the frame scale goes on.
    // Deriving the facing from the scaled vector made it depend on frame rate:
    // one step at 5.5 m/s and 60fps is 0.09 units, which failed the 0.1 test
    // below, so a player walking forwards was reported as facing 'down' to
    // everyone else — but the same input at 30fps passed.
    let headingX = 0
    let headingZ = 0
    let moving = driving

    if (driving) {
      direction.current.normalize()
      direction.current.multiplyScalar(speed * delta)

      // Apply camera rotation to movement direction
      direction.current.applyEuler(camera.rotation)
      direction.current.y = 0 // Keep movement horizontal

      const length = Math.hypot(direction.current.x, direction.current.z) || 1
      headingX = direction.current.x / length
      headingZ = direction.current.z / length
    } else if (follow) {
      // Following somebody, which is the same movement by a different input.
      // Steering the same vector rather than moving the camera separately is
      // what gives follow its collision, its gravity and its position frames
      // for free. Only when the player is not driving: their own input has to
      // win, or the follow fights them for the controls.
      //
      // Already in world axes, so unlike key input it must not be rotated by
      // the camera — the target is a place, not a direction relative to a face.
      const step = approachStep(camera.position, follow, speed * delta, FOLLOW_DISTANCE)
      if (step) {
        direction.current.set(step.x, 0, step.z)
        moving = true
        const length = Math.hypot(step.x, step.z) || 1
        headingX = step.x / length
        headingZ = step.z / length
      }
    }

    // Jump logic
    if ((jump || touch?.current?.jump) && isOnGround.current) {
      velocity.current.y = jumpForce
      isOnGround.current = false
    }

    // Apply gravity
    velocity.current.y -= 20 * delta

    before.current.x = camera.position.x
    before.current.z = camera.position.z
    camera.position.add(direction.current)
    camera.position.y += velocity.current.y * delta

    // The handle. A door has to be opened before it can be walked through,
    // and only from arm's reach: the key that used to teleport you inside
    // worked from anywhere along a fifty metre facade, which is what made it
    // feel like a menu rather than a door.
    const wantsDoor = Boolean(raw.interact) || Boolean(touch?.current?.interact)
    if (wantsDoor && !doorHeld.current && !typing) {
      const now = performance.now()
      if (insideBuilding) {
        const inner = interiorDoorFor(insideBuilding.interior)
        const near =
          Math.abs(camera.position.x - inner.x) <= inner.halfW + DOOR_REACH &&
          Math.abs(camera.position.z - inner.z) <= DOOR_REACH
        if (near) onOpenDoor(interiorDoorId(insideBuilding.id))
      } else {
        const door = doorWithinReach(camera.position.x, camera.position.z)
        if (door) onOpenDoor(exteriorDoorId(door.id))
      }
    }
    doorHeld.current = wantsDoor

    // What is solid here, and what can be stood on. Both change on the
    // threshold of a building, which is why they are read per frame rather
    // than captured once.
    //
    // The lift's floor is one of them and it moves, so it is appended rather
    // than baked in: `liftY` is where the car is this instant, and standing on
    // it is standing on a platform like any other.
    const carY = liftHeight()
    const platforms = insideBuilding
      ? [...interiorPlatforms(insideBuilding.interior), liftFloorPlatform(carY)]
      : []
    const feet = camera.position.y - EYE_HEIGHT

    // Riding it. The platform under the player rises on its own, and gravity
    // would leave them standing in mid-air for a frame and then falling; this
    // carries them with it, which is what makes it a lift rather than a hole
    // that happens to be the right height.
    if (insideBuilding && insideLiftCar(camera.position.x, camera.position.z, feet, lastCarY.current)) {
      camera.position.y += carY - lastCarY.current
    }
    lastCarY.current = carY

    // Anything too high to step onto is a wall rather than a ramp: a stage
    // edge stops you from the floor, and once you are up there you walk about
    // on top of it freely.
    // A shut door fills its own opening. Without this the key would be
    // decoration and you could walk through a door you never opened.
    const doorNow = performance.now()
    const solid: Collider[] = insideBuilding
      ? [
          // Only what the player is level with. Indoors that matters now the
          // main building has four floors in one room: a bench on the second
          // floor is not something you walk into in the entrance hall.
          ...collidersAt(interiorColliders(insideBuilding.interior), feet),
          ...blockingPlatforms(platforms, feet),
          ...interiorClosedDoor(insideBuilding, doors, doorNow),
        ]
      : [...SOLID_CAMPUS, ...closedDoorColliders(doors, doorNow)]

    if (insideBuilding) {
      // Walking out through the door, which has to be asked before the clamp:
      // afterwards the position has already been pulled back inside the room
      // and there is nothing left to detect.
      const door = interiorDoorFor(insideBuilding.interior)
      if (
        isDoorOpen(doors, interiorDoorId(insideBuilding.id), doorNow) &&
        leavingThroughDoor(camera.position.x, camera.position.z, door)
      ) {
        // A room inside the building opens onto its corridor; only the ground
        // floor opens onto the street. Walking out of the library on the
        // fourth floor and finding yourself on Nizami Street is the sort of
        // thing that makes a building feel like a menu.
        const back = exitOf(insideBuilding.id)
        const corridor = back && CAMPUS_BUILDINGS.find((b) => b.id === back.room)
        if (back && corridor) {
          onTravel(corridor, back.spawn)
          return
        }
        if (insideBuilding.outdoor) {
          onLeave(insideBuilding)
          return
        }
      }

      // The lift, and the doors along a corridor. Checked before the clamp for
      // the same reason the door is: afterwards the position has already been
      // pulled back and there is nothing left to detect.
      const portal = portalAt(
        insideBuilding.id,
        camera.position.x,
        camera.position.z,
        camera.position.y - EYE_HEIGHT,
      )
      if (portal) {
        const target = CAMPUS_BUILDINGS.find((b) => b.id === portal.to)
        if (target) {
          onTravel(target, portal.spawn)
          return
        }
      }

      // The room's own walls, which are a clamp rather than geometry. The
      // limit opens out to the wall inside the doorway, so a player can walk
      // into the opening instead of stopping at an invisible line in front of
      // it — which is what the door being in the wall means.
      const side = interiorHalfExtent(insideBuilding.interior)
      const ahead = interiorLimit(insideBuilding.interior, camera.position.x, camera.position.z)
      camera.position.x = MathUtils.clamp(camera.position.x, -side, side)
      camera.position.z = MathUtils.clamp(camera.position.z, -side, ahead)
    } else {
      camera.position.x = MathUtils.clamp(camera.position.x, -CAMPUS_LIMIT, CAMPUS_LIMIT)
      camera.position.z = MathUtils.clamp(camera.position.z, -CAMPUS_LIMIT, CAMPUS_LIMIT)

      // And walking in through one. Measured across the step rather than at
      // the end of it, so a fast frame that clears the whole alcove still
      // counts as going inside rather than stopping against the back wall.
      const entered = doorCrossed(
        { x: before.current.x, z: before.current.z },
        { x: camera.position.x, z: camera.position.z },
      )
      if (entered && isDoorOpen(doors, exteriorDoorId(entered.id), doorNow)) {
        const building = CAMPUS_BUILDINGS.find((b) => b.id === entered.id)
        if (building) {
          onEnter(building)
          return
        }
      }
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

    // Which floor we are on, read off the surface we are standing on. The main
    // building is one stacked space, so there is no trigger to walk into and
    // nothing to spawn: climbing past a slab is arriving on the floor above.
    // The room id still has to change, because it is what scopes who you can
    // see, who you can hear and whose projector a screen share lands on.
    //
    // Read from `floor` and not from the camera, and after the snap rather
    // than before it. The camera is a frame of gravity below where the player
    // is standing — about five millimetres at 60fps and twenty centimetres at
    // ten — and `floorAt` divides by the storey height, so a player standing on
    // the first floor reads as 4.545 m and rounds down to the ground. The room
    // never changed. It is the same sag that made the old landing unclimbable.
    if (insideBuilding && isCorridor(insideBuilding.id)) {
      const arrived = CORRIDOR_OF[floorAt(floor)]
      if (arrived !== insideBuilding.id) {
        const level = CAMPUS_BUILDINGS.find((b) => b.id === arrived)
        // No spawn and no camera move: the player is already standing where
        // they should be. `onFloorChange` only relabels the room.
        if (level) onFloorChange(level)
      }
    }

    // Whether the panel should be up. Edge-detected in the page, so this can
    // be called every frame without re-rendering anything.
    onInLift(
      Boolean(insideBuilding) &&
        insideLiftCar(camera.position.x, camera.position.z, camera.position.y - EYE_HEIGHT, carY),
    )

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

    // Where the player is looking, and nothing else.
    //
    // This used to send the *movement* vector whenever the player was moving,
    // and the camera only when they stood still — so the avatar everyone else
    // saw and the view the player had were two different directions for as
    // long as they were walking anything but straight ahead. Strafing drew
    // them turned ninety degrees from where they were looking, walking
    // backwards turned them right round, and stopping snapped them back.
    //
    // Read once and used for both, because the giveaway was that the local
    // minimap and the remote avatar disagreed about the same player.
    const heading = cameraHeading(camera)

    poseRef.current = {
      x: camera.position.x,
      z: camera.position.z,
      heading,
      room: insideBuilding ? String(insideBuilding.id) : null,
    }

    updatePosition({
      x: backendCoords.x,
      y: backendCoords.y,
      direction: playerDirection,
      heading,
      // Where the floor is under them. `floor` is what the height field just
      // resolved, so it is a tier, a bleacher or a stair tread rather than the
      // camera's own height, and it lands the avatar's feet where the player's
      // are.
      elevation: floor,
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
  /** Where an inner door put the player down. */
  const [arrival, setArrival] = useState<{ x: number; z: number } | null>(null)
  /** Whether the player is standing in the lift, so the panel can appear. */
  const [inLift, setInLift] = useState(false)
  /**
   * Which doors are open. Held here rather than in the scene because both the
   * player's collisions and the door meshes need it, and they live in
   * different parts of the tree.
   */
  const [doors, setDoors] = useState<DoorState>({})
  const openDoorById = useCallback((id: string) => {
    setDoors((current) => openDoor(current, id, performance.now()))
  }, [])

  // Doors close themselves. Polled rather than timed per door: one interval
  // for all of them, and pruneDoors returns the same object when nothing
  // expired so this does not re-render the scene every second.
  useEffect(() => {
    if (Object.keys(doors).length === 0) return
    const id = window.setInterval(() => {
      setDoors((current) => pruneDoors(current, performance.now()))
    }, 250)
    return () => window.clearInterval(id)
  }, [doors])
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
  /** What is within reach to pick up, so the prompt can name it. */
  const [propCandidate, setPropCandidate] = useState<PropSpec | null>(null)
  /** How far a throw is wound up, 0 to 1. */
  const [throwCharge, setThrowCharge] = useState(0)
  /** Whoever the player is walking after, if anybody. */
  const [followingId, setFollowingId] = useState<string | number | null>(null)
  /** The library's calculator terminal: standing at it, and using it. */
  const [atTerminal, setAtTerminal] = useState(false)
  const [terminalOpen, setTerminalOpen] = useState(false)
  const [terminalStats, setTerminalStats] = useState<TerminalStatistics | null>(null)
  const [terminalLoading, setTerminalLoading] = useState(false)
  const [terminalError, setTerminalError] = useState<string | null>(null)
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
  const [isMapOpen, setIsMapOpen] = useState(false)
  const [chatFocus, setChatFocus] = useState(0)
  const selfPose = useRef<Pose>({ x: 0, z: 0, heading: 0, room: null })
  const fullscreen = useFullscreen()
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
   * Where the lift car is, this instant.
   *
   * A function rather than state: it is read every frame by the controller and
   * by the car itself, and turning a ride into sixty re-renders a second would
   * cost more than the ride is worth. The floor it is going to is the server's;
   * how far through the journey we are is this client's clock.
   *
   * The doors take `LIFT_DOOR_SECONDS` to close before it moves, which is why
   * the elapsed time is offset — a car that starts moving the instant somebody
   * presses a button reads as a teleport with extra steps.
   */
  const liftFrom = useRef(0)
  const liftTo = useRef(0)
  const { lift } = campusHook
  useEffect(() => {
    liftFrom.current = liftTo.current
    liftTo.current = lift.floor
  }, [lift.floor, lift.calledAt])

  const liftHeight = useCallback(() => {
    if (!lift.calledAt) return floorLevel(lift.floor as 0 | 1 | 2 | 3)
    const elapsed = (performance.now() - lift.calledAt) / 1000 - LIFT_DOOR_SECONDS
    return liftHeightAt(
      liftFrom.current as 0 | 1 | 2 | 3,
      liftTo.current as 0 | 1 | 2 | 3,
      elapsed,
    )
  }, [lift.floor, lift.calledAt])

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
    if ((isChatOpen || isMenuOpen || isMapOpen || games.result) && document.pointerLockElement) {
      document.exitPointerLock()
    }
  }, [isChatOpen, isMenuOpen, isMapOpen, games.result])

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
      position: { x: number; y: number; z: number }
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
        // `position.y` is the second ground-plane axis, which `coordsTo3D`
        // turns into z. The height is its own field and needs no conversion:
        // it is already world metres.
        position: { x: worldPos.x, y: position.elevation ?? 0, z: worldPos.z },
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

  const mapPeers = useMemo(
    () =>
      visibleAvatars.map((avatar) => ({
        id: avatar.id,
        room: avatar.room,
        position: avatar.position,
        color: typeof avatar.userData.color === 'string' ? avatar.userData.color : undefined,
      })),
    [visibleAvatars],
  )

  // Every panel has a key, and every key closes what it opened. Bound here
  // rather than through drei because these are not movement: KeyboardControls
  // reports a held state, and a panel wants the press.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.repeat || event.altKey || event.ctrlKey || event.metaKey) return

      if (event.key === 'Escape') {
        setIsMapOpen(false)
        setIsMenuOpen(false)
        setIsChatOpen(false)
        return
      }

      // Typing must never reach a binding, or writing "type" in chat opens the
      // map twice and mutes you.
      if (isTypingInField()) return

      const action = hudActionFor(event.code)
      if (!action) return
      event.preventDefault()

      if (action === 'chat') {
        setIsChatOpen(true)
        setChatFocus((token) => token + 1)
      } else if (action === 'map') {
        setIsMapOpen((open) => !open)
      } else if (action === 'settings') {
        setIsMenuOpen((open) => !open)
      } else if (action === 'mute') {
        voice.toggleMic()
      } else if (action === 'fullscreen') {
        fullscreen.toggle()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [voice, fullscreen])

  /**
   * The loose objects in this room, wherever they have got to.
   *
   * A carried one rides at its carrier's position, which is why this is built
   * from the avatars rather than only from the resting places: an object in
   * somebody's hand has no resting place until they put it down.
   */
  const propPlacements = useMemo(() => {
    const carrierOf = new Map<string, { x: number; z: number }>()
    for (const avatar of visibleAvatars) {
      const carrying = campusHook.carriedProps.get(avatar.id)
      if (carrying) carrierOf.set(carrying, avatar.position)
    }

    return propsIn(insideBuilding?.interior ?? null).map((spec) => {
      const carried = carrierOf.get(spec.id)
      if (carried) {
        return { spec, x: carried.x, z: carried.z, y: CARRY_HEIGHT, carried: true }
      }
      const moved = campusHook.propPositions.get(spec.id)
      const at = moved
        ? campusHook.coordsTo3D(moved.x, moved.y)
        : { x: spec.home[0], z: spec.home[1] }
      return { spec, x: at.x, z: at.z, y: spec.radius, carried: false }
    })
    // The player's own object is deliberately not placed: in first person
    // there is no avatar to hang it from, and drawing it at the camera puts it
    // inside the near plane.
  }, [
    visibleAvatars,
    insideBuilding,
    campusHook.carriedProps,
    campusHook.propPositions,
    campusHook.coordsTo3D,
  ])

  /**
   * Where the person being followed is, or null.
   *
   * Resolved from the visible list rather than from every player, so following
   * stops of its own accord the moment they walk into a building: their
   * coordinates are room space from then on, and walking to them would send
   * the follower across the quad to a place nobody is standing.
   */
  const followTarget = useMemo(() => {
    if (followingId === null) return null
    const target = visibleAvatars.find((avatar) => String(avatar.id) === String(followingId))
    return target ? target.position : null
  }, [followingId, visibleAvatars])

  // Give up when they are no longer somewhere we can walk to, rather than
  // holding a follow that silently does nothing.
  useEffect(() => {
    if (followingId !== null && !followTarget) setFollowingId(null)
  }, [followingId, followTarget])

  // Read on first opening rather than on entering the library: a student who
  // walks past the desk should not be charged a request for it.
  useEffect(() => {
    if (!terminalOpen || terminalStats || terminalLoading) return
    let cancelled = false
    setTerminalLoading(true)
    setTerminalError(null)
    gpaApi
      .statistics()
      .then((stats) => {
        if (!cancelled) setTerminalStats(stats)
      })
      .catch((err) => {
        if (!cancelled) setTerminalError(errorMessage(err, 'Could not read your record.'))
      })
      .finally(() => {
        if (!cancelled) setTerminalLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [terminalOpen, terminalStats, terminalLoading])

  /** Whether the room the player is standing in has its lights on. */
  const roomLit = useMemo(
    () => (myRoom ? (campusHook.roomLights.get(myRoom) ?? true) : true),
    [myRoom, campusHook.roomLights],
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
        {/* Where you are, who is here, and whether the socket is up. One strip
            rather than three floating cards, which on a phone stacked on top of
            each other. */}
        <div className="pointer-events-auto absolute left-0 top-0 z-20 flex max-w-[52vw] items-center gap-2 p-2 pl-[max(0.5rem,env(safe-area-inset-left))] pt-[max(0.5rem,env(safe-area-inset-top))] sm:max-w-sm sm:p-3">
          <div className="flex min-w-0 items-center gap-2 rounded-lg border border-white/15 bg-slate-950/70 px-2.5 py-1.5 shadow-lg shadow-black/40 backdrop-blur">
            <span
              role="status"
              aria-label={isConnected ? 'Connected' : 'Disconnected'}
              title={isConnected ? 'Connected' : 'Reconnecting'}
              className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                isConnected ? 'bg-emerald-400' : 'animate-pulse bg-amber-400'
              }`}
            />
            <span className="truncate text-xs font-medium text-white">
              {insideBuilding ? insideBuilding.name : currentLobby?.name || 'Campus'}
            </span>
            {insideBuilding ? (
              <button
                onClick={() => setInsideBuilding(null)}
                className="flex shrink-0 items-center gap-1 border-l border-white/10 pl-2 text-xs text-slate-400 transition hover:text-white"
              >
                <DoorOpen className="h-3.5 w-3.5" />
                Leave
              </button>
            ) : (
              <span className="flex shrink-0 items-center gap-1 border-l border-white/10 pl-2 text-xs tabular-nums text-slate-400">
                <Users className="h-3 w-3" />
                {lobbyMembers.length}
              </span>
            )}
          </div>
        </div>

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
              Walk in through the doors
            </div>
          </div>
        </div>
      )}

      {/* The lift's own panel.
          DOM rather than buttons in the world, for the same reason the library
          terminal is: while the pointer is locked for mouse-look — the normal
          way to play — a click in the world never lands on anything. */}
      {inLift && (
        <div className="pointer-events-auto absolute left-1/2 top-1/2 z-30 -translate-x-1/2 -translate-y-1/2 rounded-xl border border-white/15 bg-slate-950/85 p-3 shadow-xl shadow-black/50 backdrop-blur">
          <div className="mb-2 text-center text-[11px] uppercase tracking-widest text-slate-400">
            Lift
          </div>
          <div className="flex flex-col gap-1.5">
            {liftFloorNames().map(({ floor, label }) => (
              <button
                key={floor}
                onClick={() => campusHook.callLift(floor)}
                aria-label={`Go to the ${label}`}
                aria-pressed={campusHook.lift.floor === floor}
                className={`flex items-center gap-2.5 rounded-lg px-3 py-1.5 text-left text-sm transition ${
                  campusHook.lift.floor === floor
                    ? 'bg-amber-500/20 text-amber-200'
                    : 'text-slate-200 hover:bg-white/10'
                }`}
              >
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-white/20 text-xs font-semibold">
                  {floor}
                </span>
                {label}
              </button>
            ))}
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

      {/* Objects, and the light switch. Separate from the seating prompt
          because the two are reachable at the same time and a single box
          would have to pick one of them to hide. */}
      {!games.active && (propCandidate || campusHook.ownProp || insideBuilding) && (
        <div className="absolute right-4 bottom-32 sm:bottom-16 z-30 pointer-events-none max-w-[45vw]">
          <div className="bg-black/80 backdrop-blur-sm border border-amber-500/30 rounded-xl px-3 py-2 text-white">
            {campusHook.ownProp ? (
              <>
                <div className="text-xs text-amber-300">
                  Hold G to throw · tap to drop
                </div>
                {/* The wind-up, so a throw is aimed rather than guessed. */}
                <div className="mt-1.5 h-1.5 w-full bg-white/15 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-amber-400 transition-[width] duration-75"
                    style={{ width: `${Math.round(throwCharge * 100)}%` }}
                  />
                </div>
              </>
            ) : propCandidate ? (
              <div className="text-xs text-amber-300">Press G to pick up the {propCandidate.label}</div>
            ) : null}
            {insideBuilding && (
              <div className="text-[11px] text-gray-400 mt-1">
                L · turn the lights {roomLit ? 'off' : 'on'}
              </div>
            )}
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

      <HudDock
        poseRef={selfPose}
        peers={mapPeers}
        mapOpen={isMapOpen}
        onToggleMap={() => setIsMapOpen((open) => !open)}
        onCloseMap={() => setIsMapOpen(false)}
        voiceConnected={voice.connected}
        micEnabled={voice.micEnabled}
        onToggleMic={voice.toggleMic}
        mayScreenShare={voice.mayScreenShare}
        isSharing={Boolean(voice.screenShare?.isLocal)}
        onToggleScreenShare={voice.toggleScreenShare}
        onOpenSettings={() => setIsMenuOpen(true)}
        isFullscreen={fullscreen.isFullscreen}
        fullscreenSupported={fullscreen.supported}
        onToggleFullscreen={fullscreen.toggle}
      />

      {/* Who is here with you, and the follow button.
          DOM rather than a panel in the scene for the same pointer-lock reason
          as the doors: a click in the world never lands while the pointer is
          locked, which is the normal way to play. */}
      {visibleAvatars.length > 0 && !games.active && (
        <div className="pointer-events-auto absolute left-2 top-14 z-10 w-[min(15rem,52vw)] sm:left-3 sm:top-16 short:hidden">
          <div className="bg-black/75 backdrop-blur-sm border border-blue-500/25 rounded-xl px-3 py-2 text-white">
            <div className="text-[11px] uppercase tracking-wide text-blue-300/80 mb-1">
              {myRoom ? 'In this room' : 'On the campus'}
            </div>
            <ul className="space-y-1">
              {visibleAvatars.slice(0, 6).map((avatar) => {
                const followingThem = String(followingId) === String(avatar.id)
                return (
                  <li key={avatar.id} className="flex items-center justify-between gap-2">
                    <span className="text-xs truncate">
                      {String(avatar.userData.full_name || avatar.userData.username || 'Student')}
                    </span>
                    <button
                      onClick={() => setFollowingId(followingThem ? null : avatar.id)}
                      className={`text-[10px] px-2 py-0.5 rounded-md shrink-0 transition-colors ${
                        followingThem
                          ? 'bg-blue-500 text-white'
                          : 'bg-white/10 text-blue-200 hover:bg-white/20'
                      }`}
                    >
                      {followingThem ? 'Stop' : 'Follow'}
                    </button>
                  </li>
                )
              })}
            </ul>
            {followingId !== null && (
              <div className="text-[10px] text-gray-400 mt-1.5">
                Walking after them. Any movement key takes back the controls.
              </div>
            )}
          </div>
        </div>
      )}

      {/* The library terminal. */}
      {atTerminal && !terminalOpen && !games.active && (
        <div className="absolute left-1/2 -translate-x-1/2 bottom-44 sm:bottom-28 z-30 pointer-events-none">
          <div className="bg-black/80 backdrop-blur-sm border border-sky-500/30 rounded-xl px-4 py-2 text-white text-center">
            <div className="text-xs text-sky-300">Press E to use the terminal</div>
          </div>
        </div>
      )}

      {terminalOpen && (
        <LibraryTerminalPanel
          statistics={terminalStats}
          loading={terminalLoading}
          error={terminalError}
          onClose={() => setTerminalOpen(false)}
          onOpenCalculator={() => navigate('/gpa-calculator')}
        />
      )}

      {/* Standing in a study area offers to join it. Also DOM rather than a
          panel in the scene, for the same pointer-lock reason as the doors. */}
      {nearArea && !games.active && !nearBuilding && (
        <div className="pointer-events-auto absolute bottom-32 left-1/2 z-20 w-[min(18rem,86vw)] -translate-x-1/2 sm:bottom-16">
          <div className="rounded-xl border border-white/10 bg-slate-950/90 p-3 text-white backdrop-blur">
            <h3 className="text-sm font-semibold text-white">{nearArea.name}</h3>
            <p className="mt-0.5 text-xs leading-relaxed text-slate-400">{nearArea.description}</p>
            <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-400">
              <span className="flex items-center gap-1">
                <BookOpen className="h-3 w-3" />
                {nearArea.subject}
              </span>
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {nearArea.duration}
              </span>
              <span>up to {nearArea.maxUsers}</span>
            </p>
            <button
              onClick={() => {
                joinStudyRoom(nearArea.id)
                joinedArea.current = nearArea.id
                setJoinedAreaId(nearArea.id)
              }}
              className="mt-3 w-full rounded-lg bg-blue-600 py-2 text-sm font-medium text-white transition hover:bg-blue-500"
            >
              {joinedAreaId === nearArea.id ? 'Joined' : 'Join study'}
            </button>
          </div>
        </div>
      )}

      <CampusSettings
        open={isMenuOpen}
        onClose={() => setIsMenuOpen(false)}
        timeOfDay={timeOfDay}
        onTimeOfDay={setTimeOfDay}
        isFullscreen={fullscreen.isFullscreen}
        fullscreenSupported={fullscreen.supported}
        onToggleFullscreen={fullscreen.toggle}
        onLeave={handleDisconnect}
        voice={
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
        }
      />

      {/* 3D Canvas */}
      <KeyboardControls map={CAMPUS_KEY_MAP}>
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
          {/* Keeps the view the same width whatever shape the window is. */}
          <FieldOfView />
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
                lit={roomLit}
                liftHeight={liftHeight}
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
                  <>
                    <ShelfStation games={games} action={actionInput} position={[0, 0, 14]} />
                    <LibraryTerminalDesk awake={atTerminal} />
                    <LibraryTerminalSensor active onNear={setAtTerminal} />
                    <LibraryTerminalKey
                      enabled={atTerminal && !terminalOpen && !games.active}
                      onOpen={() => setTerminalOpen(true)}
                    />
                  </>
                )}
                {insideBuilding.interior === 'sports' && (
                  <BasketballStation
                    games={games}
                    action={actionInput}
                    hoop={[0, 3.05, -20]}
                    range={24}
                  />
                )}
                <CampusPropObjects placements={propPlacements} />

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

                <CampusPropObjects placements={propPlacements} />

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

            <CampusDoors doors={doors} insideBuilding={insideBuilding} />
            <InteriorCameraPlacement insideBuilding={insideBuilding} arrival={arrival} />
            <ProximitySensor insideBuilding={insideBuilding} target={proximity} />
            <ActionKeyBridge action={actionInput} />
            <Player
              campusHook={campusHook}
              insideBuilding={insideBuilding}
              touch={touchState}
              seated={seatedOn}
              emote={emote}
              leaning={leaning}
              follow={followTarget}
              onEnter={(building) => {
                setArrival(null)
                setInsideBuilding(building)
              }}
              onTravel={(building, spawn) => {
                setArrival(spawn)
                setInsideBuilding(building)
              }}
              onFloorChange={(building) => {
                // Only the label. No arrival, so the camera placement — which
                // is keyed on the interior — does not fire and the player keeps
                // walking from wherever the stair left them.
                setInsideBuilding(building)
              }}
              liftHeight={liftHeight}
              onInLift={(inside) => setInLift((was) => (was === inside ? was : inside))}
              onLeave={() => {
                setArrival(null)
                setInsideBuilding(null)
              }}
              doors={doors}
              onOpenDoor={openDoorById}
              poseRef={selfPose}
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
            <PropController
              campusHook={campusHook}
              insideBuilding={insideBuilding}
              myRoom={myRoom}
              onCandidate={setPropCandidate}
              onCharge={setThrowCharge}
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
        focusToken={chatFocus}
      />

    </div>
    </>
  )
}

export default CampusWithBackend
