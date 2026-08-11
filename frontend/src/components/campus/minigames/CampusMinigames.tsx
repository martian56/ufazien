import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'

import type { Vec3 } from '../campusLayout'
import {
  DASH_CHECKPOINTS,
  TITRATION_BURETTE,
  TITRATION_FLOW,
  chargeFor,
  launchVelocity,
  passedThroughHoop,
  stepProjectile,
  titrationColour,
  type Point3,
  type Projectile,
} from './minigameLogic'
import type { CampusGames } from './useCampusGames'
import { NEARBY_STATIONS } from './stationProximity'

/**
 * The playable furniture: a hoop, a course of rings, a titration bench and a
 * returns desk.
 *
 * These components only draw and detect. Whether a shot counts, whether a ring
 * is the next one, and what a volume is worth are all decided in
 * `minigameLogic.ts`, which has no renderer in it and is tested directly.
 */

/** Held down to charge, released to act. Shared by the hoop and the burette. */
export interface ActionInput {
  /** True for as long as the action key or button is held. */
  held: boolean
  /** Set by the on-screen hold button, merged into `held` each frame. */
  touchHeld?: boolean
}

/* ------------------------------------------------------------------ */
/* Free throws                                                          */
/* ------------------------------------------------------------------ */

const BALL_RADIUS = 0.24
/** How long a landed ball stays where it fell before being handed back. */
const RESET_DELAY = 0.9

interface HoopProps {
  games: CampusGames
  action: React.RefObject<ActionInput>
  /** Centre of the ring. */
  hoop: Vec3
  /** Which way the backboard faces, radians about Y. */
  facing?: number
  /** How close you must stand for the station to be live. */
  range?: number
}

export function BasketballStation({ games, action, hoop, facing = 0, range = 22 }: HoopProps) {
  const { camera } = useThree()
  const ballMesh = useRef<THREE.Mesh>(null)
  const ball = useRef<Projectile | null>(null)
  const heldSince = useRef<number | null>(null)
  const settled = useRef(0)
  const hoopPoint = useMemo<Point3>(() => ({ x: hoop[0], y: hoop[1], z: hoop[2] }), [hoop])

  // Scratch, so aiming does not allocate a vector sixty times a second.
  const aim = useRef(new THREE.Vector3())

  const isActive = games.active === 'basketball'

  useFrame((_, rawDelta) => {
    // A tab that has been in the background hands back an enormous delta, and
    // a ball integrated over half a second of it teleports through the hoop.
    const delta = Math.min(rawDelta, 0.05)
    const mesh = ballMesh.current
    if (!mesh) return

    if (!isActive) {
      ball.current = null
      heldSince.current = null
      mesh.visible = false
      games.live.current.charge = 0
      return
    }
    mesh.visible = true

    // --- in flight -------------------------------------------------
    if (ball.current) {
      const previous = ball.current.position
      const next = stepProjectile(ball.current, delta)

      if (passedThroughHoop(previous, next.position, hoopPoint)) {
        games.takeShot(true)
        ball.current = null
        settled.current = RESET_DELAY
        mesh.position.set(next.position.x, next.position.y, next.position.z)
        return
      }

      if (next.position.y <= BALL_RADIUS) {
        games.takeShot(false)
        ball.current = null
        settled.current = RESET_DELAY
        mesh.position.set(next.position.x, BALL_RADIUS, next.position.z)
        return
      }

      ball.current = next
      mesh.position.set(next.position.x, next.position.y, next.position.z)
      mesh.rotation.x += delta * 6
      return
    }

    // --- between shots ---------------------------------------------
    if (settled.current > 0) {
      settled.current -= delta
      return
    }

    // Held in front of the camera, slightly right and low, like a ball is.
    camera.getWorldDirection(aim.current)
    mesh.position.copy(camera.position).addScaledVector(aim.current, 0.85)
    mesh.position.y -= 0.35

    const holding = Boolean(action.current?.held)
    if (holding) {
      if (heldSince.current === null) heldSince.current = 0
      heldSince.current += delta
      games.live.current.charge = chargeFor(heldSince.current)
      games.live.current.holding = true
      return
    }

    // Released: launch, aimed where the camera looks but lofted, because
    // nobody makes a free throw on a flat line.
    if (heldSince.current !== null) {
      const charge = chargeFor(heldSince.current)
      heldSince.current = null
      games.live.current.charge = 0
      games.live.current.holding = false

      camera.getWorldDirection(aim.current)
      const direction = {
        x: aim.current.x,
        y: aim.current.y + 0.55,
        z: aim.current.z,
      }
      ball.current = {
        position: { x: mesh.position.x, y: mesh.position.y, z: mesh.position.z },
        velocity: launchVelocity(direction, charge),
      }
    }
  })

  return (
    <group>
      <group position={hoop} rotation={[0, facing, 0]}>
        {/* Backboard */}
        <mesh castShadow position={[0, 0.6, -0.75]}>
          <boxGeometry args={[3.6, 2.1, 0.12]} />
          <meshStandardMaterial color="#f2f4f6" roughness={0.25} transparent opacity={0.88} />
        </mesh>
        <mesh position={[0, 0.35, -0.67]}>
          <boxGeometry args={[1.2, 0.9, 0.04]} />
          <meshStandardMaterial color="#d9403a" roughness={0.6} />
        </mesh>

        {/* The ring */}
        <mesh castShadow rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.55, 0.045, 10, 28]} />
          <meshStandardMaterial color="#e8622a" roughness={0.35} metalness={0.6} />
        </mesh>

        {/* Net, as a cone of open geometry */}
        <mesh position={[0, -0.28, 0]}>
          <coneGeometry args={[0.52, 0.6, 14, 1, true]} />
          <meshStandardMaterial
            color="#f4f4f2"
            wireframe
            transparent
            opacity={0.75}
            side={THREE.DoubleSide}
          />
        </mesh>

        {/* Post and arm */}
        <mesh castShadow position={[0, -1.4, -1.9]}>
          <cylinderGeometry args={[0.14, 0.18, 3.4, 10]} />
          <meshStandardMaterial color="#39424b" roughness={0.5} metalness={0.5} />
        </mesh>
        <mesh castShadow position={[0, 0.55, -1.35]}>
          <boxGeometry args={[0.2, 0.2, 1.3]} />
          <meshStandardMaterial color="#39424b" roughness={0.5} metalness={0.5} />
        </mesh>
      </group>

      {/* The free-throw line, so there is somewhere to stand */}
      <mesh
        rotation={[-Math.PI / 2, 0, facing]}
        position={[hoop[0] + Math.sin(facing) * 4.6, 0.06, hoop[2] + Math.cos(facing) * 4.6]}
      >
        <planeGeometry args={[4.2, 0.22]} />
        <meshStandardMaterial color="#f2f4f2" roughness={0.7} />
      </mesh>

      <mesh ref={ballMesh} castShadow visible={false}>
        <sphereGeometry args={[BALL_RADIUS, 20, 16]} />
        <meshStandardMaterial color="#d4682a" roughness={0.85} />
      </mesh>

      {/* Same trigonometry as the free-throw line above. Special-casing a
          facing of zero dropped the marker onto the hoop for every other one. */}
      <StationMarker
        position={[hoop[0] + Math.sin(facing) * 5.5, 0, hoop[2] + Math.cos(facing) * 5.5]}
        game="basketball"
        games={games}
        range={range}
      />
    </group>
  )
}

/* ------------------------------------------------------------------ */
/* Campus dash                                                          */
/* ------------------------------------------------------------------ */

export function DashCourse({ games }: { games: CampusGames }) {
  const { camera } = useThree()
  const rings = useRef<THREE.Group>(null)
  const isActive = games.active === 'dash'

  useFrame((_, delta) => {
    if (!isActive) return
    games.dashProgress(camera.position.x, camera.position.z)

    // Spin the ring you are heading for, so it reads as live from a distance.
    const group = rings.current
    if (!group) return
    group.children.forEach((child, i) => {
      child.rotation.z += i === games.dash.index ? delta * 1.2 : 0
    })
  })

  return (
    <group>
      <group ref={rings}>
        {DASH_CHECKPOINTS.map((point, i) => {
          const done = isActive && i < games.dash.index
          const next = isActive && i === games.dash.index
          return (
            // The ring you run through is deliberately smaller than the
            // radius that counts as clearing it: DASH_RADIUS is the detection
            // distance, and drawing the torus at that size put a nine-metre
            // hoop across the quad and another one over the basketball court.
            <mesh key={i} position={[point[0], 2.9, point[2]]}>
              <torusGeometry args={[2.4, 0.22, 10, 36]} />
              <meshStandardMaterial
                color={done ? '#3f7f5f' : next ? '#ffd166' : '#5f6b7a'}
                emissive={done ? '#2f6f4f' : next ? '#ffb703' : '#2f3947'}
                emissiveIntensity={next ? 1.6 : 0.35}
                roughness={0.4}
                metalness={0.3}
                transparent
                opacity={done ? 0.35 : 0.92}
                toneMapped={false}
              />
            </mesh>
          )
        })}
      </group>

      <StationMarker position={[0, 0, 22]} game="dash" games={games} range={9} />
    </group>
  )
}

/* ------------------------------------------------------------------ */
/* Titration                                                            */
/* ------------------------------------------------------------------ */

export function TitrationStation({
  games,
  action,
  position = [0, 0, 8],
}: {
  games: CampusGames
  action: React.RefObject<ActionInput>
  position?: Vec3
}) {
  const liquid = useRef<THREE.Mesh>(null)
  const flask = useRef<THREE.Mesh>(null)
  const stream = useRef<THREE.Mesh>(null)
  const wasHeld = useRef(false)
  const isActive = games.active === 'titration'
  const target = games.titration?.target ?? 25

  useFrame((_, rawDelta) => {
    const delta = Math.min(rawDelta, 0.05)
    const holding = isActive && Boolean(action.current?.held)

    if (holding) {
      games.live.current.delivered = Math.min(
        TITRATION_BURETTE,
        games.live.current.delivered + TITRATION_FLOW * delta,
      )
      games.live.current.holding = true
    } else if (wasHeld.current && isActive) {
      // Released: that is the round marked.
      games.live.current.holding = false
      games.pourStop()
    }
    wasHeld.current = holding

    const delivered = isActive ? games.live.current.delivered : 0

    // Burette empties as it pours.
    if (liquid.current) {
      const remaining = 1 - delivered / TITRATION_BURETTE
      liquid.current.scale.y = Math.max(0.02, remaining)
      liquid.current.position.y = 2.55 - (1 - remaining) * 0.6
    }
    // The flask turns pink at the endpoint, which is the whole tell.
    if (flask.current) {
      const material = flask.current.material as THREE.MeshStandardMaterial
      material.color.set(titrationColour(delivered, target))
    }
    if (stream.current) stream.current.visible = holding
  })

  return (
    <group position={position}>
      {/* Bench */}
      <mesh castShadow receiveShadow position={[0, 0.5, 0]}>
        <boxGeometry args={[5, 1, 2]} />
        <meshStandardMaterial color="#e6e9ec" roughness={0.6} />
      </mesh>
      <mesh castShadow receiveShadow position={[0, 1.03, 0]}>
        <boxGeometry args={[5.3, 0.12, 2.3]} />
        <meshStandardMaterial color="#33393f" roughness={0.35} />
      </mesh>

      {/* Retort stand */}
      <mesh castShadow position={[-0.9, 1.15, -0.5]}>
        <boxGeometry args={[0.9, 0.12, 0.7]} />
        <meshStandardMaterial color="#5c646b" roughness={0.4} metalness={0.6} />
      </mesh>
      <mesh castShadow position={[-0.9, 2.3, -0.5]}>
        <cylinderGeometry args={[0.045, 0.045, 2.3, 8]} />
        <meshStandardMaterial color="#8d959c" roughness={0.3} metalness={0.8} />
      </mesh>
      <mesh castShadow position={[-0.5, 2.6, -0.5]}>
        <boxGeometry args={[0.8, 0.08, 0.1]} />
        <meshStandardMaterial color="#8d959c" roughness={0.3} metalness={0.8} />
      </mesh>

      {/* Burette: glass tube with the titrant inside it */}
      <mesh position={[0, 2.35, -0.5]}>
        <cylinderGeometry args={[0.09, 0.09, 1.6, 14, 1, true]} />
        <meshStandardMaterial
          color="#cfe8f5"
          transparent
          opacity={0.35}
          roughness={0.05}
          side={THREE.DoubleSide}
        />
      </mesh>
      <mesh ref={liquid} position={[0, 2.55, -0.5]}>
        <cylinderGeometry args={[0.075, 0.075, 1.2, 12]} />
        <meshStandardMaterial color="#7fd4ff" transparent opacity={0.85} roughness={0.15} />
      </mesh>
      {/* Tap */}
      <mesh position={[0, 1.5, -0.5]}>
        <boxGeometry args={[0.24, 0.1, 0.1]} />
        <meshStandardMaterial color="#d9d9d9" roughness={0.3} metalness={0.5} />
      </mesh>

      {/* The falling stream, visible only while pouring */}
      <mesh ref={stream} position={[0, 1.28, -0.5]} visible={false}>
        <cylinderGeometry args={[0.012, 0.012, 0.42, 6]} />
        <meshStandardMaterial color="#a8e6ff" emissive="#7fd4ff" emissiveIntensity={0.5} />
      </mesh>

      {/* Conical flask under the burette */}
      <mesh ref={flask} castShadow position={[0, 1.22, -0.5]}>
        <coneGeometry args={[0.32, 0.44, 18]} />
        <meshStandardMaterial color="#dff3ff" transparent opacity={0.82} roughness={0.12} />
      </mesh>
      <mesh position={[0, 1.53, -0.5]}>
        <cylinderGeometry args={[0.07, 0.07, 0.22, 12]} />
        <meshStandardMaterial color="#e8f6ff" transparent opacity={0.5} roughness={0.1} />
      </mesh>

      <StationMarker position={[0, 0, 1.8]} game="titration" games={games} range={4.5} />
    </group>
  )
}

/* ------------------------------------------------------------------ */
/* Shelf order                                                          */
/* ------------------------------------------------------------------ */

const BOOK_COLORS = ['#8c3b32', '#2f5d7c', '#3f6b47', '#7a5c2e', '#5b3a63', '#96682f']

/**
 * The returns desk.
 *
 * Books are picked by looking at one and pressing the action key rather than
 * by clicking. While the pointer is locked for mouse-look there is no cursor to
 * click with, and unlocking it for one mini-game would drop the player out of
 * the game every time they wanted to shelve a book.
 */
export function ShelfStation({
  games,
  action,
  position = [0, 0, 14],
}: {
  games: CampusGames
  action: React.RefObject<ActionInput>
  position?: Vec3
}) {
  const { camera } = useThree()
  const books = useRef<(THREE.Mesh | null)[]>([])
  const raycaster = useMemo(() => new THREE.Raycaster(), [])
  const centre = useMemo(() => new THREE.Vector2(0, 0), [])
  const wasHeld = useRef(false)
  const [looking, setLooking] = useState<number | null>(null)

  const isActive = games.active === 'booksort'
  const run = games.shelf

  useFrame(() => {
    if (!isActive || !run) {
      if (looking !== null) setLooking(null)
      wasHeld.current = false
      return
    }

    raycaster.setFromCamera(centre, camera)
    const meshes = books.current.filter((mesh): mesh is THREE.Mesh => Boolean(mesh))
    const hit = raycaster.intersectObjects(meshes, false)[0]
    const id = hit ? (hit.object.userData.bookId as number) : null

    // Only touch state when the highlight actually changes.
    if (id !== looking) setLooking(id ?? null)

    const holding = Boolean(action.current?.held)
    // Edge-triggered: holding the key must shelve one book, not the lot.
    if (holding && !wasHeld.current && id !== null) games.pick(id)
    wasHeld.current = holding
  })

  return (
    <group position={position}>
      {/* Desk */}
      <mesh castShadow receiveShadow position={[0, 0.5, 0]}>
        <boxGeometry args={[6.5, 1, 1.8]} />
        <meshStandardMaterial color="#5d452c" roughness={0.7} />
      </mesh>
      <mesh castShadow receiveShadow position={[0, 1.04, 0]}>
        <boxGeometry args={[6.9, 0.1, 2.1]} />
        <meshStandardMaterial color="#3a2f24" roughness={0.5} />
      </mesh>

      {run?.books.map((book, i) => {
        const picked = run.state.picked.includes(book.id)
        const wanted = games.shelfExpecting === book.id
        const highlighted = looking === book.id
        return (
          <group key={book.id} position={[-2.7 + book.slot * 1.08, 1.2, 0]}>
            <mesh
              ref={(mesh) => {
                books.current[i] = mesh
              }}
              castShadow
              userData={{ bookId: book.id }}
              rotation={[0, 0, picked ? Math.PI / 2 : 0]}
              position={[0, picked ? -0.18 : 0, picked ? 0.6 : 0]}
            >
              <boxGeometry args={[0.22, 0.9, 0.6]} />
              <meshStandardMaterial
                color={picked ? '#4b5560' : BOOK_COLORS[book.id % BOOK_COLORS.length]}
                emissive={highlighted ? '#ffd166' : wanted ? '#3f7f5f' : '#000000'}
                emissiveIntensity={highlighted ? 0.85 : wanted ? 0.3 : 0}
                roughness={0.85}
              />
            </mesh>
            {/* Spine label, so the call number can be read off the shelf */}
            <mesh position={[0.12, 0.1, 0]} rotation={[0, Math.PI / 2, 0]}>
              <planeGeometry args={[0.42, 0.16]} />
              <meshStandardMaterial color="#f0ead8" roughness={0.9} />
            </mesh>
          </group>
        )
      })}

      <StationMarker position={[0, 0, 2.2]} game="booksort" games={games} range={4.5} />
    </group>
  )
}

/* ------------------------------------------------------------------ */
/* Shared                                                               */
/* ------------------------------------------------------------------ */

/**
 * The pad you stand on to start a game.
 *
 * Publishes "the player is close enough to play this" into the games hook, so
 * the HUD can offer the right prompt without every station rendering a DOM
 * node of its own.
 */
function StationMarker({
  position,
  game,
  games,
  range,
}: {
  position: Vec3
  game: 'basketball' | 'dash' | 'titration' | 'booksort'
  games: CampusGames
  range: number
}) {
  const { camera } = useThree()
  const ring = useRef<THREE.Mesh>(null)
  const near = useRef(false)

  useFrame(({ clock }) => {
    const distance = Math.hypot(camera.position.x - position[0], camera.position.z - position[2])
    const isNear = distance <= range

    if (isNear !== near.current) {
      near.current = isNear
      // A plain mutable set: this is read once per frame by the HUD sampler,
      // and routing it through React state would re-render on every step.
      if (isNear) NEARBY_STATIONS.add(game)
      else NEARBY_STATIONS.delete(game)
    }

    if (ring.current) {
      const material = ring.current.material as THREE.MeshStandardMaterial
      const pulse = 0.55 + Math.sin(clock.elapsedTime * 2.4) * 0.25
      material.emissiveIntensity = games.active === game ? 1.6 : isNear ? pulse + 0.5 : pulse * 0.5
    }
  })

  useLayoutEffect(() => () => {
    NEARBY_STATIONS.delete(game)
  }, [game])

  return (
    <mesh ref={ring} rotation={[-Math.PI / 2, 0, 0]} position={[position[0], 0.08, position[2]]}>
      <ringGeometry args={[1.5, 2.1, 32]} />
      <meshStandardMaterial
        color="#ffd166"
        emissive="#ffb703"
        emissiveIntensity={0.6}
        transparent
        opacity={0.8}
        toneMapped={false}
      />
    </mesh>
  )
}
