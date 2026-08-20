import { useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Sky } from '@react-three/drei'
import * as THREE from 'three'

import {
  OUTDOOR_BUILDINGS,
  GROUND_SIZE,
  PAVEMENTS,
  QUAD_CENTRE,
  QUAD_RADIUS,
  SCENERY_BLOCKS,
  DOOR_HALF_WIDTH,
  daylight,
  campusBenches,
  campusLamps,
  campusTrees,
  type BuildingStyle,
  type DaylightConfig,
  type SceneryBlock,
  type TimeOfDay,
  type Vec3,
} from './campusLayout'
import NizamiDistrict from './NizamiDistrict'
import UfazBuilding from './UfazBuilding'
import {
  asphaltTexture,
  buildingSignTexture,
  courtTexture,
  facadeTexture,
  grassTexture,
  chatBubbleTexture,
  nameTagTexture,
  pathTexture,
  plaqueTexture,
  stoneTexture,
} from './campusTextures'
import CampusWindows from './CampusWindows'

/**
 * Procedural campus scenery.
 *
 * Everything here is generated rather than loaded, so it costs no download and
 * stays editable in code. Repeated geometry (windows, trees, lamps) is drawn
 * with instanced meshes: a building with 120 windows is one draw call, not 120.
 *
 * Two rules this file follows, because breaking them is what made the old
 * campus stutter:
 *
 * 1. Nothing allocates inside `useFrame`. A `new Vector3()` per frame per
 *    player is a garbage collection pause every few seconds.
 * 2. Nothing that only needs doing once is done in `useFrame`. Instance
 *    matrices are written in a layout effect and then left alone.
 */

/** Scratch objects, shared by every instancing pass. Never rendered. */
const dummy = new THREE.Object3D()

/**
 * The sun, and a shadow frustum that follows the player.
 *
 * A single fixed shadow camera cannot cover a 370-metre campus: stretched wide
 * enough to reach the far dorms, every shadow near you is a blurry smear, and
 * that is exactly what the old ±140 frustum did. Keeping a tight box centred on
 * the player instead gives roughly twenty shadow texels per metre wherever you
 * happen to be standing.
 *
 * The centre is snapped to a 4-unit grid. Following the camera exactly makes
 * the shadow map re-rasterise every frame, and edges visibly crawl as you walk.
 */
function Sunlight({ config }: { config: DaylightConfig }) {
  const light = useRef<THREE.DirectionalLight>(null)
  const target = useRef<THREE.Object3D>(null)

  useLayoutEffect(() => {
    if (light.current && target.current) light.current.target = target.current
  }, [])

  useFrame(({ camera }) => {
    if (!light.current || !target.current) return
    const gx = Math.round(camera.position.x / 4) * 4
    const gz = Math.round(camera.position.z / 4) * 4
    target.current.position.set(gx, 0, gz)
    target.current.updateMatrixWorld()
    light.current.position.set(gx + config.sun[0] * 0.6, config.sun[1], gz + config.sun[2] * 0.6)
  })

  return (
    <>
      <object3D ref={target} />
      <directionalLight
        ref={light}
        intensity={config.intensity}
        color={config.tint}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0006}
        shadow-normalBias={0.05}
        shadow-camera-left={-70}
        shadow-camera-right={70}
        shadow-camera-top={70}
        shadow-camera-bottom={-70}
        shadow-camera-near={1}
        shadow-camera-far={300}
      />
    </>
  )
}

/** Sky, light and fog. */
export function CampusEnvironment({ timeOfDay = 'day' }: { timeOfDay?: TimeOfDay | string }) {
  const config = daylight(timeOfDay)

  return (
    <>
      <Sky
        sunPosition={config.sun}
        turbidity={timeOfDay === 'dusk' ? 10 : 5}
        rayleigh={timeOfDay === 'dusk' ? 3 : 1.1}
        mieCoefficient={0.006}
        mieDirectionalG={0.8}
      />
      {/* Depth cue, so the far side of the campus recedes instead of popping. */}
      <fog attach="fog" args={[config.fog, config.fogNear, config.fogFar]} />

      {/* Sky/ground bounce, which a single ambient term cannot express. */}
      <hemisphereLight args={[config.sky, config.bounce, config.ambient]} />

      {/* Fill from the opposite side, so shadowed faces keep their colour.
          It casts nothing: shadows stay the sun's to draw. */}
      <directionalLight
        position={[-config.sun[0], config.sun[1] * 0.6, -config.sun[2]]}
        intensity={config.fill}
        color="#cfe0f2"
      />

      <Sunlight config={config} />
    </>
  )
}

/** A flat, textured slab lying on the ground at a given height. */
function Slab({
  position,
  size,
  texture,
  color,
  height,
  rotation = 0,
}: {
  position: [number, number]
  size: [number, number]
  texture: THREE.Texture | null
  color: string
  height: number
  rotation?: number
}) {
  // Repeat has to follow the slab's real size or a 400-metre street shows four
  // enormous stones. Cloning is cheap; the underlying image is shared.
  const mapped = useMemo(() => {
    if (!texture) return null
    const clone = texture.clone()
    clone.needsUpdate = true
    clone.repeat.set((size[0] / 100) * texture.repeat.x, (size[1] / 100) * texture.repeat.y)
    return clone
  }, [texture, size])

  useLayoutEffect(() => () => mapped?.dispose(), [mapped])

  return (
    <mesh
      rotation={[-Math.PI / 2, 0, rotation]}
      position={[position[0], height, position[1]]}
      receiveShadow
    >
      <planeGeometry args={size} />
      <meshStandardMaterial map={mapped ?? undefined} color={mapped ? '#ffffff' : color} roughness={0.95} />
    </mesh>
  )
}

/** Ground: lawn, streets, pavements, paths, the quad and the court. */
export function CampusGround() {
  const grass = grassTexture()
  const asphalt = asphaltTexture()
  const stone = stoneTexture()
  const path = pathTexture()
  const court = courtTexture()

  const surfaces = { asphalt, stone, path, court }
  const fallbacks = { asphalt: '#3a3d42', stone: '#8f8778', path: '#b4a88f', court: '#1f6f5c' }
  // Stacked in a fixed order so coplanar surfaces never fight in the depth
  // buffer. Streets sit lowest, the quad highest.
  const heights = { asphalt: 0.01, stone: 0.02, path: 0.03, court: 0.04 }

  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[GROUND_SIZE, GROUND_SIZE]} />
        <meshStandardMaterial map={grass ?? undefined} color={grass ? '#ffffff' : '#4a7a3f'} roughness={1} />
      </mesh>

      {PAVEMENTS.map((pavement, i) => (
        <Slab
          key={i}
          position={pavement.position}
          size={pavement.size}
          texture={surfaces[pavement.kind]}
          color={fallbacks[pavement.kind]}
          height={heights[pavement.kind]}
          rotation={pavement.rotation}
        />
      ))}

      {/* The quad: a stone ring with a lawn inside it, rather than one more
          rectangle. It is what the two axes cross on. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[QUAD_CENTRE[0], 0.05, QUAD_CENTRE[1]]} receiveShadow>
        <ringGeometry args={[QUAD_RADIUS - 5, QUAD_RADIUS, 64]} />
        <meshStandardMaterial map={stone ?? undefined} color={stone ? '#ffffff' : '#8f8778'} roughness={0.95} />
      </mesh>

      <Fountain position={[QUAD_CENTRE[0], 0, QUAD_CENTRE[1]]} />

      {/* Court markings, drawn as geometry: painted lines have to stay put
          while the acrylic beneath them tiles. */}
      <CourtMarkings />
    </group>
  )
}

function Fountain({ position }: { position: Vec3 }) {
  const water = useRef<THREE.Mesh>(null)

  useFrame(({ clock }) => {
    if (!water.current) return
    // A slow breathe, so the quad is not completely static.
    water.current.position.y = 0.92 + Math.sin(clock.elapsedTime * 0.8) * 0.03
  })

  return (
    <group position={position}>
      <mesh castShadow receiveShadow position={[0, 0.45, 0]}>
        <cylinderGeometry args={[7, 7.4, 0.9, 32]} />
        <meshStandardMaterial color="#a89c86" roughness={0.9} />
      </mesh>
      <mesh ref={water} position={[0, 0.92, 0]}>
        <cylinderGeometry args={[6.5, 6.5, 0.1, 32]} />
        <meshStandardMaterial
          color="#4d90b8"
          roughness={0.08}
          metalness={0.35}
          transparent
          opacity={0.85}
        />
      </mesh>
      <mesh castShadow position={[0, 1.9, 0]}>
        <cylinderGeometry args={[0.4, 0.9, 2.4, 16]} />
        <meshStandardMaterial color="#b3a894" roughness={0.85} />
      </mesh>
      <mesh castShadow position={[0, 3.3, 0]}>
        <sphereGeometry args={[0.85, 20, 16]} />
        <meshStandardMaterial color="#8fc6e0" roughness={0.15} metalness={0.2} transparent opacity={0.75} />
      </mesh>
    </group>
  )
}

/** White lines on the outdoor court, at the court slab's height. */
function CourtMarkings() {
  const court = PAVEMENTS.find((p) => p.kind === 'court')
  if (!court) return null
  const [cx, cz] = court.position
  const [w, d] = court.size
  const line = { color: '#f2f4f2', roughness: 0.9 }

  return (
    <group position={[cx, 0.05, cz]}>
      {/* Perimeter, plus the halfway line */}
      {([
        [0, -d / 2 + 0.2, w, 0.35],
        [0, d / 2 - 0.2, w, 0.35],
        [-w / 2 + 0.2, 0, 0.35, d],
        [w / 2 - 0.2, 0, 0.35, d],
        [0, 0, w, 0.3],
      ] as [number, number, number, number][]).map(([x, z, sw, sd], i) => (
        <mesh key={i} rotation={[-Math.PI / 2, 0, 0]} position={[x, 0, z]}>
          <planeGeometry args={[sw, sd]} />
          <meshStandardMaterial {...line} />
        </mesh>
      ))}
      {/* Centre circle */}
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[2.6, 2.9, 40]} />
        <meshStandardMaterial {...line} />
      </mesh>
    </group>
  )
}

/** Which window shape a facade style uses. */
function windowKind(style: BuildingStyle): 'arched' | 'square' | 'strip' {
  if (style === 'heritage') return 'arched'
  if (style === 'glass') return 'strip'
  return 'square'
}

function windowSize(style: BuildingStyle): [number, number] {
  if (style === 'heritage') return [1.5, 2.5]
  if (style === 'glass') return [2.2, 2.0]
  return [1.6, 1.9]
}

interface FacadeLayout {
  windows: { x: number; y: number; z: number; ry: number }[]
  floors: number
  floorHeight: number
}

/** Where every window on a building goes. */
function useFacadeLayout(width: number, height: number, depth: number, style: BuildingStyle): FacadeLayout {
  return useMemo(() => {
    // Heritage floors are tall; a modern block packs them tighter.
    const floorHeight = style === 'heritage' ? 4.1 : 3.4
    // Floor, not round. Rounding up fits one more storey than the wall has
    // room for, and the same count drives the string courses: a 21-metre
    // terrace got its top course at y 22.1, inside the crowning cornice.
    const floors = Math.max(1, Math.floor((height - 1.6) / floorHeight))
    const spacing = style === 'glass' ? 3.0 : 3.6
    const perFront = Math.max(2, Math.floor(width / spacing) - 1)
    const perSide = Math.max(1, Math.floor(depth / spacing) - 1)

    const windows: FacadeLayout['windows'] = []
    for (let floor = 0; floor < floors; floor++) {
      // Sit windows in the middle of their floor band, above the plinth.
      const y = 1.6 + floor * floorHeight + floorHeight / 2

      for (let i = 0; i < perFront; i++) {
        const x = -width / 2 + (width / (perFront + 1)) * (i + 1)
        // The ground-floor centre is the doorway; skip it.
        const isDoorway = floor === 0 && Math.abs(x) < 3.6
        if (isDoorway) continue
        windows.push({ x, y, z: depth / 2 + 0.08, ry: 0 })
        windows.push({ x, y, z: -depth / 2 - 0.08, ry: Math.PI })
      }

      for (let i = 0; i < perSide; i++) {
        const z = -depth / 2 + (depth / (perSide + 1)) * (i + 1)
        windows.push({ x: width / 2 + 0.08, y, z, ry: Math.PI / 2 })
        windows.push({ x: -width / 2 - 0.08, y, z, ry: -Math.PI / 2 })
      }
    }
    return { windows, floors, floorHeight }
  }, [width, height, depth, style])
}

/** Cornices, string courses and a plinth: the horizontals that give scale. */
function FacadeTrim({
  width,
  height,
  depth,
  floors,
  floorHeight,
  trim,
  style,
}: {
  width: number
  height: number
  depth: number
  floors: number
  floorHeight: number
  trim: string
  style: BuildingStyle
}) {
  return (
    <>
      {/* Plinth */}
      <mesh receiveShadow castShadow position={[0, 0.8, 0]}>
        <boxGeometry args={[width + 0.7, 1.6, depth + 0.7]} />
        <meshStandardMaterial color={trim} roughness={0.95} />
      </mesh>

      {/* Crowning cornice */}
      <mesh castShadow position={[0, height + 0.45, 0]}>
        <boxGeometry args={[width + 1.6, 0.9, depth + 1.6]} />
        <meshStandardMaterial color={trim} roughness={0.9} />
      </mesh>
      <mesh castShadow position={[0, height + 1.15, 0]}>
        <boxGeometry args={[width + 0.9, 0.5, depth + 0.9]} />
        <meshStandardMaterial color={trim} roughness={0.9} />
      </mesh>

      {/* A string course between floors. Heritage fronts get one per floor;
          everything else only gets the one over the ground floor, which is
          what stops a modern block reading as an extruded rectangle. */}
      {Array.from({ length: style === 'heritage' ? floors : 1 }, (_, i) => (
        <mesh key={i} castShadow position={[0, 1.6 + (i + 1) * floorHeight, 0]}>
          <boxGeometry args={[width + 0.45, 0.3, depth + 0.45]} />
          <meshStandardMaterial color={trim} roughness={0.9} />
        </mesh>
      ))}
    </>
  )
}

/** The doorway on the +Z face, which is the face every building presents. */
/**
 * How deep the lobby behind a doorway is.
 *
 * The building's own box is shortened by this much at the front and the wall
 * is rebuilt around the opening, so this is real space rather than a painted
 * one: stand in front of an open door and you are looking into a room.
 */
export const PORCH_DEPTH = 3.4

/** The clear opening, matching the gap left in the collider exactly. */
export const OPENING_HALF_W = DOOR_HALF_WIDTH

/** How tall the swinging leaves are; fixed glazing fills the rest. */
export const LEAF_HEIGHT = 2.72

/** Where the arch springs from, and how far it rises: a true semicircle. */
export const SPRING_HEIGHT = 4.0
export const ARCH_RISE = OPENING_HALF_W
export const OPENING_HEIGHT = SPRING_HEIGHT + ARCH_RISE

/**
 * Height of the threshold above the ground.
 *
 * Nothing: you walk straight in off the pavement, which is what the building
 * does. There were three steps up to a sill at 0.89 and they were wrong twice
 * over. The real entrance on Nizami Street has no steps at all — the threshold
 * is flush with the paving — and ours had no colliders either, so they were a
 * flight you could not climb, standing in front of a door whose lower half was
 * buried in the plinth behind them.
 *
 * Everything in the opening is still measured from here, so that the constant
 * keeps saying what it says rather than being deleted from a dozen sums.
 */
export const THRESHOLD = 0

/**
 * The lobby you can see through an open door.
 *
 * The whole point of the exercise. An open door used to show a flat glazed
 * panel — the facade had no hole in it, so there was nothing behind the leaves
 * but more wall, and opening one revealed that rather than an interior.
 *
 * It is deliberately a lobby and not the room itself. Rendering an interior
 * through every door would mean either a second render pass per doorway or
 * seven full rooms resident in the outdoor scene, and neither is worth paying
 * for something you glance at on your way past — you cannot see the whole
 * library through its front door in life either. Six static meshes and no
 * light: the ceiling panel is emissive, so the lobby reads as lit without
 * adding a seventh shadow-casting source to the campus.
 */
function DoorLobby({ trim, accent, sill }: { trim: string; accent: string; sill: number }) {
  const width = OPENING_HALF_W * 2
  // Slightly wider than the opening so the side walls are never seen edge-on
  // through the gap between the reveal and the jamb.
  const inner = width + 0.5

  return (
    <group position={[0, 0, -PORCH_DEPTH / 2]}>
      {/* Floor, level with the top step outside. At ground level it sat below
          the threshold and the lobby read as a lit box with no bottom.
          Every surface in here carries a little emissive: a lobby lit by real
          lights would mean a seventh light source per building on a campus
          that already pays for a hundred and fifty trees, and self-lit
          surfaces cost nothing at all to sample. */}
      <mesh position={[0, sill, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[inner, PORCH_DEPTH]} />
        <meshStandardMaterial
          color="#6b6459"
          emissive="#3a3630"
          emissiveIntensity={0.55}
          roughness={0.75}
        />
      </mesh>
      {/* Ceiling, emissive so the lobby is lit without costing a light. */}
      <mesh position={[0, sill + OPENING_HEIGHT - 0.05, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <planeGeometry args={[inner, PORCH_DEPTH]} />
        <meshStandardMaterial
          color="#fbf3e4"
          emissive="#ffeacb"
          emissiveIntensity={1.25}
          toneMapped={false}
        />
      </mesh>
      {/* Side walls. */}
      {[-1, 1].map((side) => (
        <mesh key={side} position={[(side * inner) / 2, sill + OPENING_HEIGHT / 2, 0]} rotation={[0, side * -Math.PI / 2, 0]}>
          <planeGeometry args={[PORCH_DEPTH, OPENING_HEIGHT]} />
          <meshStandardMaterial
            color="#e6e0d3"
            emissive="#6a6458"
            emissiveIntensity={0.5}
            roughness={0.9}
            side={THREE.DoubleSide}
          />
        </mesh>
      ))}
      {/* The far wall, with a band of the building's own colour on it so each
          lobby looks like it belongs to its building rather than to a kit. */}
      <mesh position={[0, sill + OPENING_HEIGHT / 2, -PORCH_DEPTH / 2 + 0.02]}>
        <planeGeometry args={[inner, OPENING_HEIGHT]} />
        <meshStandardMaterial
          color="#efe9dc"
          emissive="#6f6a5e"
          emissiveIntensity={0.5}
          roughness={0.92}
        />
      </mesh>
      <mesh position={[0, sill + 2.1, -PORCH_DEPTH / 2 + 0.05]}>
        <planeGeometry args={[inner * 0.62, 1.1]} />
        <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={0.3} roughness={0.7} />
      </mesh>
      {/* A counter, which is what makes the depth readable: without something
          standing in it, a box with a lit ceiling reads as a painted panel. */}
      <mesh position={[inner / 2 - 0.75, sill + 0.5, -0.5]} castShadow receiveShadow>
        <boxGeometry args={[1.1, 1, 0.6]} />
        <meshStandardMaterial color={trim} emissive={trim} emissiveIntensity={0.25} roughness={0.8} />
      </mesh>
    </group>
  )
}

/**
 * Steps, a surround, a canopy — and a hole in the wall behind them.
 *
 * The glazed slab that used to sit here was the whole of the "door": a flat
 * panel on an unbroken facade. The opening is real now, and `Building` builds
 * the wall around it rather than as one box.
 */
/** How many facets the arch is cut into. Enough that it reads as a curve. */
const ARCH_FACETS = 20

/** Points along the arch's centreline, from one springing to the other. */
function archPoints(radius: number): { x: number; y: number; angle: number }[] {
  return Array.from({ length: ARCH_FACETS }, (_, i) => {
    const angle = (Math.PI * (i + 0.5)) / ARCH_FACETS
    return {
      x: Math.cos(angle) * radius,
      y: SPRING_HEIGHT + Math.sin(angle) * radius,
      angle,
    }
  })
}

/**
 * The moulded arch over the door, cut into flat facets.
 *
 * A ring of small boxes set along the arc rather than a torus: the surround
 * either side is square in section and the arch has to match it, and a torus
 * is round in section, so the two met at the springing with a step in the
 * profile.
 */
function Archivolt({ trim }: { trim: string }) {
  const radius = OPENING_HALF_W + 0.35
  const facetWidth = (Math.PI * radius) / ARCH_FACETS + 0.04

  return (
    <group>
      {archPoints(radius).map(({ x, y, angle }, i) => (
        <mesh key={i} castShadow position={[x, y, 0.05]} rotation={[0, 0, angle - Math.PI / 2]}>
          <boxGeometry args={[0.7, facetWidth, 0.45]} />
          <meshStandardMaterial color={trim} roughness={0.85} />
        </mesh>
      ))}
    </group>
  )
}

/**
 * The fanlight in the head of the arch.
 *
 * Glass with bars radiating from the centre of the springing line and a
 * semicircular rib partway up, which is the pattern in the doorway's
 * photograph.
 *
 * The bars stop short of the centre rather than meeting at it. Nine of them
 * converging on a point made a dark rosette the eye read as a spider, and no
 * fanlight is built that way — the joinery runs to a small solid hub, because
 * that is where the bars would otherwise have to be jointed into each other.
 */
function Fanlight() {
  const radius = OPENING_HALF_W - 0.06
  const hub = 0.22
  const bars = 7
  const rib = radius * 0.58
  const timber = '#5b4225'

  return (
    <group position={[0, 0, -0.06]}>
      <mesh position={[0, SPRING_HEIGHT, 0]}>
        <circleGeometry args={[radius, 40, 0, Math.PI]} />
        <meshStandardMaterial
          color="#c3dcee"
          roughness={0.1}
          metalness={0.2}
          transparent
          opacity={0.45}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* The radiating bars, from the hub out to the rim. */}
      {Array.from({ length: bars }, (_, i) => {
        const angle = (Math.PI * (i + 1)) / (bars + 1)
        const mid = (hub + radius) / 2
        return (
          <mesh
            key={i}
            position={[Math.cos(angle) * mid, SPRING_HEIGHT + Math.sin(angle) * mid, 0.02]}
            rotation={[0, 0, angle - Math.PI / 2]}
          >
            <boxGeometry args={[0.05, radius - hub, 0.05]} />
            <meshStandardMaterial color={timber} roughness={0.6} />
          </mesh>
        )
      })}

      {/* The hub they run to, and the rib they cross. */}
      <mesh position={[0, SPRING_HEIGHT, 0.02]}>
        <cylinderGeometry args={[hub, hub, 0.06, 16, 1, false, 0, Math.PI]} />
        <meshStandardMaterial color={timber} roughness={0.6} />
      </mesh>
      {archPoints(rib).map(({ x, y, angle }, i) => (
        <mesh key={`rib${i}`} position={[x, y, 0.02]} rotation={[0, 0, angle - Math.PI / 2]}>
          <boxGeometry args={[0.05, (Math.PI * rib) / ARCH_FACETS + 0.03, 0.05]} />
          <meshStandardMaterial color={timber} roughness={0.6} />
        </mesh>
      ))}
      {/* And the rim, so the glazing ends in joinery rather than in air. */}
      {archPoints(radius).map(({ x, y, angle }, i) => (
        <mesh key={`rim${i}`} position={[x, y, 0.02]} rotation={[0, 0, angle - Math.PI / 2]}>
          <boxGeometry args={[0.08, (Math.PI * radius) / ARCH_FACETS + 0.03, 0.06]} />
          <meshStandardMaterial color={timber} roughness={0.6} />
        </mesh>
      ))}
    </group>
  )
}

/**
 * The transom: fixed glazing between the door leaves and the springing line.
 *
 * The leaves are two and a bit metres, the opening is four before the arch
 * even starts, and without this the difference is an empty gap over the doors.
 */
function Transom({ from, to }: { from: number; to: number }) {
  const height = to - from
  const bays = 4

  return (
    <group position={[0, 0, -0.06]}>
      <mesh position={[0, (from + to) / 2, 0]}>
        <planeGeometry args={[OPENING_HALF_W * 2 - 0.08, height]} />
        <meshStandardMaterial
          color="#b9d9ef"
          roughness={0.12}
          metalness={0.25}
          transparent
          opacity={0.5}
          side={THREE.DoubleSide}
        />
      </mesh>
      {/* The rail under it and the mullions across it. */}
      <mesh position={[0, from, 0.03]}>
        <boxGeometry args={[OPENING_HALF_W * 2, 0.16, 0.12]} />
        <meshStandardMaterial color="#5b4225" roughness={0.6} />
      </mesh>
      {Array.from({ length: bays - 1 }, (_, i) => (
        <mesh
          key={i}
          position={[(-OPENING_HALF_W * 2 * (i + 1)) / bays + OPENING_HALF_W, (from + to) / 2, 0.03]}
        >
          <boxGeometry args={[0.06, height, 0.09]} />
          <meshStandardMaterial color="#5b4225" roughness={0.6} />
        </mesh>
      ))}
      {/* Crossed by horizontals as well: without them the transom is four tall
          slots rather than the small panes the door is glazed in. */}
      {Array.from({ length: 2 }, (_, i) => (
        <mesh key={`h${i}`} position={[0, from + (height * (i + 1)) / 3, 0.03]}>
          <boxGeometry args={[OPENING_HALF_W * 2 - 0.08, 0.06, 0.09]} />
          <meshStandardMaterial color="#5b4225" roughness={0.6} />
        </mesh>
      ))}
    </group>
  )
}

/**
 * The two plaques either side of the door.
 *
 * Left in Azerbaijani, right in French, as they are on the building. Mounted
 * on the wall face rather than the surround, clear of the plinth's head.
 */
function EntrancePlaques() {
  const left = plaqueTexture('Azərbaycan Respublikası Təhsil Nazirliyi', [
    'Azərbaycan-',
    'Fransız',
    'Universiteti',
  ])
  const right = plaqueTexture("Ministère de l'Éducation de la République d'Azerbaïdjan", [
    'Université',
    'Franco-',
    'Azerbaïdjanaise',
  ])

  return (
    <group>
      {([[-1, left], [1, right]] as [number, THREE.Texture | null][]).map(([side, map]) =>
        map ? (
          <group key={side} position={[side * (OPENING_HALF_W + 2.35), 2.85, 0.16]}>
            <mesh castShadow>
              <boxGeometry args={[1.5, 1.85, 0.05]} />
              <meshStandardMaterial color="#e9eaec" roughness={0.35} metalness={0.05} />
            </mesh>
            <mesh position={[0, 0, 0.031]}>
              <planeGeometry args={[1.5, 1.85]} />
              <meshStandardMaterial map={map} roughness={0.35} />
            </mesh>
            {/* Standoff fixings, one at each corner. */}
            {[[-0.62, 0.76], [0.62, 0.76], [-0.62, -0.76], [0.62, -0.76]].map(([px, py]) => (
              <mesh key={`${px},${py}`} position={[px, py, 0.05]} rotation={[Math.PI / 2, 0, 0]}>
                <cylinderGeometry args={[0.045, 0.045, 0.05, 8]} />
                <meshStandardMaterial color="#9aa0a6" roughness={0.3} metalness={0.8} />
              </mesh>
            ))}
          </group>
        ) : null,
      )}
    </group>
  )
}

export function Entrance({ depth, trim, accent }: { depth: number; trim: string; accent: string }) {
  return (
    <group position={[0, 0, depth / 2 + 0.06]}>
      {/* No steps. You walk in off the paving — see `THRESHOLD`. */}

      {/* The surround: two jambs to the springing line, and an archivolt
          turning over them. A frame around the opening rather than a slab
          across it, so the doorway stays clear.

          The jambs run to the ground rather than stopping at the sill. Stone
          standing on paving is what the photograph shows, and it is what stops
          the doorway dissolving into the plinth — see the note on the plinth
          in `UfazBuilding`. */}
      {[-1, 1].map((side) => (
        <mesh
          key={side}
          castShadow
          position={[side * (OPENING_HALF_W + 0.35), SPRING_HEIGHT / 2, 0.05]}
        >
          <boxGeometry args={[0.7, SPRING_HEIGHT, 0.45]} />
          <meshStandardMaterial color={trim} roughness={0.85} />
        </mesh>
      ))}
      <Archivolt trim={trim} />

      {/* The reveal: the thickness of the wall, seen from outside. */}
      {[-1, 1].map((side) => (
        <mesh key={`r${side}`} position={[side * OPENING_HALF_W, THRESHOLD + OPENING_HEIGHT / 2, -PORCH_DEPTH / 2]} rotation={[0, side * -Math.PI / 2, 0]}>
          <planeGeometry args={[PORCH_DEPTH, OPENING_HEIGHT]} />
          <meshStandardMaterial color="#c8c1b4" roughness={0.9} side={THREE.DoubleSide} />
        </mesh>
      ))}
      <mesh position={[0, THRESHOLD + OPENING_HEIGHT, -PORCH_DEPTH / 2]} rotation={[Math.PI / 2, 0, 0]}>
        <planeGeometry args={[OPENING_HALF_W * 2, PORCH_DEPTH]} />
        <meshStandardMaterial color="#bdb6a9" roughness={0.9} side={THREE.DoubleSide} />
      </mesh>

      <Transom from={LEAF_HEIGHT} to={SPRING_HEIGHT} />
      <Fanlight />
      <EntrancePlaques />

      <DoorLobby trim={trim} accent={accent} sill={THRESHOLD} />

    </group>
  )
}

interface BuildingProps {
  position?: Vec3
  size?: Vec3
  color?: string
  trim?: string
  name?: string
  icon?: string
  style?: BuildingStyle
  timeOfDay?: TimeOfDay | string
  /** Kept for callers that still pass it; the sign is geometry now, not a button. */
  onEnter?: () => void
  canEnter?: boolean
}

/**
 * An enterable building: textured facade, instanced windows, cornices, a
 * recessed entrance and a sign board over the door.
 *
 * The "Enter" button used to be a drei `Html` node floating at each doorway.
 * Two DOM overlays per building meant the browser was transforming a couple of
 * dozen absolutely-positioned elements every frame, and they were unclickable
 * anyway while the pointer was locked for mouse-look — which is how the game is
 * actually played. The prompt now lives in the HUD, driven by proximity.
 */
export function Building({
  position = [0, 0, 0],
  size = [14, 12, 10],
  color = '#9aa4b1',
  trim = '#5c6472',
  name,
  icon,
  style = 'modern',
  timeOfDay = 'day',
}: BuildingProps) {
  const [width, height, depth] = size
  const layout = useFacadeLayout(width, height, depth, style)
  const facade = facadeTexture(color, style)
  const sign = name ? buildingSignTexture(name, icon ?? '') : null
  const lit = daylight(timeOfDay).lampsOn
  // Stable per building, so its lit windows do not change when React re-renders.
  const seed = useMemo(() => Math.abs(Math.round(position[0] * 7 + position[2] * 13)), [position])

  const facadeMap = useMemo(() => {
    if (!facade) return null
    const clone = facade.clone()
    clone.needsUpdate = true
    clone.repeat.set(width / 9, height / 9)
    return clone
  }, [facade, width, height])

  useLayoutEffect(() => () => facadeMap?.dispose(), [facadeMap])

  /**
   * The front wall, as the pieces left over once the doorway is taken out.
   *
   * Two piers and a lintel. A building narrower than its own doorway gets one
   * solid piece instead — there is nothing left to build an opening out of,
   * and half a doorway is worse than none.
   */
  const facadePieces = useMemo(() => {
    const pierWidth = width / 2 - OPENING_HALF_W
    if (pierWidth <= 0.5) return [{ x: 0, y: height / 2, w: width, h: height }]
    return [
      { x: -(OPENING_HALF_W + pierWidth / 2), y: height / 2, w: pierWidth, h: height },
      { x: OPENING_HALF_W + pierWidth / 2, y: height / 2, w: pierWidth, h: height },
      {
        x: 0,
        y: THRESHOLD + OPENING_HEIGHT + (height - THRESHOLD - OPENING_HEIGHT) / 2,
        w: OPENING_HALF_W * 2,
        h: height - THRESHOLD - OPENING_HEIGHT,
      },
      // And the plinth under the threshold. Without it the opening runs to the
      // ground and the doorway is a hole you can see daylight under.
      { x: 0, y: THRESHOLD / 2, w: OPENING_HALF_W * 2, h: THRESHOLD },
    ]
  }, [width, height])

  return (
    <group position={position}>
      {/* The body, shortened at the front by the depth of the lobby, and the
          front wall rebuilt around the opening in three pieces. One box cannot
          have a hole in it, and a hole is the entire difference between a door
          you can see through and a picture of one. The back, sides and roof
          are unchanged, so the silhouette is exactly what it was. */}
      <mesh castShadow receiveShadow position={[0, height / 2, -PORCH_DEPTH / 2]}>
        <boxGeometry args={[width, height, depth - PORCH_DEPTH]} />
        <meshStandardMaterial
          map={facadeMap ?? undefined}
          color={facadeMap ? '#ffffff' : color}
          roughness={style === 'glass' ? 0.4 : 0.88}
          metalness={style === 'glass' ? 0.25 : 0.04}
        />
      </mesh>

      {facadePieces.map((piece, i) => (
        <mesh
          key={i}
          castShadow
          receiveShadow
          position={[piece.x, piece.y, depth / 2 - PORCH_DEPTH / 2]}
        >
          <boxGeometry args={[piece.w, piece.h, PORCH_DEPTH]} />
          <meshStandardMaterial
            map={facadeMap ?? undefined}
            color={facadeMap ? '#ffffff' : color}
            roughness={style === 'glass' ? 0.4 : 0.88}
            metalness={style === 'glass' ? 0.25 : 0.04}
          />
        </mesh>
      ))}

      <FacadeTrim
        width={width}
        height={height}
        depth={depth}
        floors={layout.floors}
        floorHeight={layout.floorHeight}
        trim={trim}
        style={style}
      />

      <CampusWindows
        items={layout.windows}
        kind={windowKind(style)}
        wall={color}
        size={windowSize(style)}
        lit={lit}
        seed={seed}
      />

      <Entrance depth={depth} trim={trim} accent={color} />

      {sign && (
        <mesh position={[0, 6.2, depth / 2 + 0.35]}>
          <planeGeometry args={[10, 2.5]} />
          <meshStandardMaterial
            map={sign}
            roughness={0.6}
            emissive="#ffffff"
            emissiveMap={sign}
            emissiveIntensity={lit ? 0.55 : 0.12}
          />
        </mesh>
      )}
    </group>
  )
}

/** A building you cannot go into. Same facade treatment, no door, no sign. */
export function SceneryBuilding({
  block,
  timeOfDay = 'day',
}: {
  block: SceneryBlock
  timeOfDay?: TimeOfDay | string
}) {
  const [width, height, depth] = block.size
  const style: BuildingStyle = block.arched ? 'heritage' : block.style
  const layout = useFacadeLayout(width, height, depth, style)
  const facade = facadeTexture(block.color, style)
  const lit = daylight(timeOfDay).lampsOn
  const seed = useMemo(
    () => Math.abs(Math.round(block.position[0] * 3 + block.position[2] * 11)),
    [block.position],
  )

  const facadeMap = useMemo(() => {
    if (!facade) return null
    const clone = facade.clone()
    clone.needsUpdate = true
    clone.repeat.set(width / 9, height / 9)
    return clone
  }, [facade, width, height])

  useLayoutEffect(() => () => facadeMap?.dispose(), [facadeMap])

  return (
    <group position={block.position}>
      <mesh castShadow receiveShadow position={[0, height / 2, 0]}>
        <boxGeometry args={[width, height, depth]} />
        <meshStandardMaterial
          map={facadeMap ?? undefined}
          color={facadeMap ? '#ffffff' : block.color}
          roughness={0.88}
        />
      </mesh>

      <FacadeTrim
        width={width}
        height={height}
        depth={depth}
        floors={layout.floors}
        floorHeight={layout.floorHeight}
        trim={block.trim}
        style={style}
      />

      <CampusWindows
        items={layout.windows}
        kind={windowKind(style)}
        wall={block.color}
        size={windowSize(style)}
        lit={lit}
        seed={seed}
      />
    </group>
  )
}

/** The whole non-enterable backdrop, in one component. */
export function CampusSkyline({ timeOfDay = 'day' }: { timeOfDay?: TimeOfDay | string }) {
  return (
    <group>
      {/* The real city on UFAZ's side of Nizami Street: surveyed streets and
          footprints, none of them enterable. */}
      <NizamiDistrict timeOfDay={timeOfDay} />
      {SCENERY_BLOCKS.map((block, i) => (
        <SceneryBuilding key={i} block={block} timeOfDay={timeOfDay} />
      ))}
    </group>
  )
}

const TRUNK_COLORS = ['#5b432c', '#4d3a26', '#66502f']
const CANOPY_DAY = ['#3f7a34', '#4c8a3c', '#356b2c']
const CANOPY_DUSK = ['#26401f', '#2d4a24', '#1f3619']

/**
 * Trees, lamps and benches.
 *
 * All instanced, all placed by the layout module's seeded scatter, and all
 * written once in a layout effect. The old version re-checked a `done` flag on
 * every single frame for the life of the session.
 */
export function CampusProps({
  treeCount = 150,
  timeOfDay = 'day',
}: {
  treeCount?: number
  timeOfDay?: TimeOfDay | string
}) {
  // All three come from the layout module rather than being placed here. They
  // are solid now, and a tree the renderer puts in one place and the collision
  // system in another is worse than a tree you can walk through.
  const trees = useMemo(() => campusTrees(treeCount), [treeCount])
  const lamps = useMemo(() => campusLamps(), [])
  const benches = useMemo(() => campusBenches(), [])

  const config = daylight(timeOfDay)
  const canopyColors = config.lampsOn ? CANOPY_DUSK : CANOPY_DAY

  // Split once. Filtering inline handed TreeVariant a new array on every
  // render, and that array is the only dependency of the effect that writes
  // the instance matrices — so every unrelated re-render rewrote the matrices
  // of all 150 trees, which is exactly what this file claims not to do.
  const treesByVariant = useMemo(
    () => TRUNK_COLORS.map((_, variant) => trees.filter((t) => t.variant === variant)),
    [trees],
  )

  return (
    <group>
      {/* One instanced mesh per colour variant: instanceColor would also work,
          but three separate meshes keep flat shading crisp and are still only
          three draw calls each. */}
      {TRUNK_COLORS.map((trunkColor, variant) => (
        <TreeVariant
          key={variant}
          items={treesByVariant[variant]}
          trunkColor={trunkColor}
          canopyColor={canopyColors[variant]}
        />
      ))}

      <Lamps items={lamps} on={config.lampsOn} />
      <Benches items={benches} />
    </group>
  )
}

function TreeVariant({
  items,
  trunkColor,
  canopyColor,
}: {
  items: { x: number; z: number; scale: number; rotation: number }[]
  trunkColor: string
  canopyColor: string
}) {
  const trunks = useRef<THREE.InstancedMesh>(null)
  const canopies = useRef<THREE.InstancedMesh>(null)
  const tops = useRef<THREE.InstancedMesh>(null)

  useLayoutEffect(() => {
    const parts: [React.RefObject<THREE.InstancedMesh | null>, number, number][] = [
      [trunks, 1.9, 1],
      [canopies, 4.6, 1],
      // A second, smaller ball above the first so a tree has a silhouette
      // instead of being a lollipop.
      [tops, 6.6, 0.62],
    ]
    for (const [ref, yOffset, scaleFactor] of parts) {
      const mesh = ref.current
      if (!mesh) continue
      items.forEach((item, i) => {
        dummy.position.set(item.x, yOffset * item.scale, item.z)
        dummy.rotation.set(0, item.rotation, 0)
        dummy.scale.setScalar(item.scale * scaleFactor)
        dummy.updateMatrix()
        mesh.setMatrixAt(i, dummy.matrix)
      })
      mesh.instanceMatrix.needsUpdate = true
      mesh.computeBoundingSphere()
    }
  }, [items])

  if (!items.length) return null

  return (
    <group>
      <instancedMesh ref={trunks} args={[undefined, undefined, items.length]} castShadow>
        <cylinderGeometry args={[0.3, 0.45, 3.8, 6]} />
        <meshStandardMaterial color={trunkColor} roughness={1} />
      </instancedMesh>

      <instancedMesh ref={canopies} args={[undefined, undefined, items.length]} castShadow>
        <icosahedronGeometry args={[2.7, 0]} />
        <meshStandardMaterial color={canopyColor} roughness={1} flatShading />
      </instancedMesh>

      <instancedMesh ref={tops} args={[undefined, undefined, items.length]} castShadow>
        <icosahedronGeometry args={[2.7, 0]} />
        <meshStandardMaterial color={canopyColor} roughness={1} flatShading />
      </instancedMesh>
    </group>
  )
}

function Lamps({ items, on }: { items: { x: number; z: number }[]; on: boolean }) {
  const posts = useRef<THREE.InstancedMesh>(null)
  const heads = useRef<THREE.InstancedMesh>(null)

  useLayoutEffect(() => {
    const parts: [React.RefObject<THREE.InstancedMesh | null>, number][] = [
      [posts, 2.6],
      [heads, 5.4],
    ]
    for (const [ref, y] of parts) {
      const mesh = ref.current
      if (!mesh) continue
      items.forEach((item, i) => {
        dummy.position.set(item.x, y, item.z)
        dummy.rotation.set(0, 0, 0)
        dummy.scale.setScalar(1)
        dummy.updateMatrix()
        mesh.setMatrixAt(i, dummy.matrix)
      })
      mesh.instanceMatrix.needsUpdate = true
      mesh.computeBoundingSphere()
    }
  }, [items])

  if (!items.length) return null

  return (
    <group>
      <instancedMesh ref={posts} args={[undefined, undefined, items.length]} castShadow>
        <cylinderGeometry args={[0.12, 0.18, 5.2, 8]} />
        <meshStandardMaterial color="#2f3640" roughness={0.6} metalness={0.5} />
      </instancedMesh>

      {/* The glow is emissive rather than a real light. Three hundred point
          lights would be three hundred extra shading passes; this reads the
          same from the ground and costs one draw call. */}
      <instancedMesh ref={heads} args={[undefined, undefined, items.length]}>
        <sphereGeometry args={[0.36, 12, 10]} />
        <meshStandardMaterial
          color={on ? '#fff0c4' : '#cfd4d9'}
          emissive="#ffcf7a"
          emissiveIntensity={on ? 2.4 : 0}
          toneMapped={false}
        />
      </instancedMesh>
    </group>
  )
}

function Benches({ items }: { items: { x: number; z: number; ry: number }[] }) {
  const seats = useRef<THREE.InstancedMesh>(null)
  const backs = useRef<THREE.InstancedMesh>(null)
  // Without these the seat and back hung in the air with nothing under them.
  const legs = useRef<THREE.InstancedMesh>(null)

  useLayoutEffect(() => {
    const parts: [React.RefObject<THREE.InstancedMesh | null>, number, number, number][] = [
      [seats, 0.55, 0, 0],
      [backs, 0.95, -0.32, -0.3],
    ]
    for (const [ref, y, z, tilt] of parts) {
      const mesh = ref.current
      if (!mesh) continue
      items.forEach((item, i) => {
        dummy.position.set(item.x, y, item.z)
        // YXZ, not the default XYZ: with XYZ the backrest's lean is applied
        // before the bench's heading, so a bench facing sideways leaned
        // sideways instead of backwards. Around a circular quad that meant
        // every bench but two was tipping over.
        dummy.rotation.set(tilt, item.ry, 0, 'YXZ')
        dummy.scale.setScalar(1)
        dummy.translateZ(z)
        dummy.updateMatrix()
        mesh.setMatrixAt(i, dummy.matrix)
      })
      mesh.instanceMatrix.needsUpdate = true
      mesh.computeBoundingSphere()
    }

    // Two cast-iron end frames per bench, so it stands on something.
    const legMesh = legs.current
    if (legMesh) {
      items.forEach((item, i) => {
        for (const side of [-1, 1]) {
          dummy.position.set(item.x, 0.28, item.z)
          dummy.rotation.set(0, item.ry, 0)
          dummy.scale.set(1, 1, 1)
          dummy.translateX(side * 1.05)
          dummy.updateMatrix()
          legMesh.setMatrixAt(i * 2 + (side === -1 ? 0 : 1), dummy.matrix)
        }
      })
      legMesh.instanceMatrix.needsUpdate = true
      legMesh.computeBoundingSphere()
    }
  }, [items])

  if (!items.length) return null

  return (
    <group>
      <instancedMesh ref={seats} args={[undefined, undefined, items.length]} castShadow receiveShadow>
        <boxGeometry args={[2.6, 0.16, 0.7]} />
        <meshStandardMaterial color="#7a5a3a" roughness={0.9} />
      </instancedMesh>
      <instancedMesh ref={backs} args={[undefined, undefined, items.length]} castShadow>
        <boxGeometry args={[2.6, 0.7, 0.14]} />
        <meshStandardMaterial color="#7a5a3a" roughness={0.9} />
      </instancedMesh>
      <instancedMesh ref={legs} args={[undefined, undefined, items.length * 2]} castShadow>
        <boxGeometry args={[0.14, 0.56, 0.62]} />
        <meshStandardMaterial color="#2f3640" roughness={0.7} metalness={0.4} />
      </instancedMesh>
    </group>
  )
}

/**
 * A player's name, as a sprite.
 *
 * Sprites attenuate with distance by default, and that is kept: a campus this
 * size would otherwise be a wall of full-size labels stacked over each other
 * from the far end of the spine. Distance culling is the LOD's job, not the
 * tag's.
 */
export function NameTag({
  name,
  accent,
  position = [0, 2.25, 0],
  status,
}: {
  name: string
  accent?: string
  position?: Vec3
  /** What they are doing, under the name. Omitted when there is nothing to say. */
  status?: string | null
}) {
  const texture = nameTagTexture(name, accent)
  // Only when there is something to say. Called unconditionally it built a
  // 512-pixel canvas for an empty label and stored it in the bounded name-tag
  // cache, where every status-less avatar then kept touching that one entry
  // and pushing real name tags towards eviction.
  const statusTexture = status ? nameTagTexture(`· ${status} ·`, '#7f8ea3') : null
  if (!texture) return null

  return (
    <group position={position}>
      <sprite scale={[1.6, 0.4, 1]}>
        <spriteMaterial map={texture} transparent depthTest depthWrite={false} toneMapped={false} />
      </sprite>
      {status && statusTexture && (
        <sprite position={[0, -0.28, 0]} scale={[1.15, 0.29, 1]}>
          <spriteMaterial
            map={statusTexture}
            transparent
            opacity={0.85}
            depthTest
            depthWrite={false}
            toneMapped={false}
          />
        </sprite>
      )}
    </group>
  )
}

/**
 * A chat message over its author's head.
 *
 * Chat was a DOM panel with no connection to the world, so a room full of
 * people talking looked completely silent.
 */
export function ChatBubble({ text, position = [0, 2.95, 0] }: { text: string; position?: Vec3 }) {
  const texture = chatBubbleTexture(text)
  if (!texture) return null

  return (
    <sprite position={position} scale={[2.6, 1.3, 1]}>
      <spriteMaterial map={texture} transparent depthTest depthWrite={false} toneMapped={false} />
    </sprite>
  )
}

/**
 * A ring on the floor under whoever is talking.
 *
 * Proximity voice had no visible sign at all: you could hear somebody perfectly
 * well and have no idea which of the twenty students in the quad it was.
 */
export function SpeakingRing({ accent = '#6ee7a8' }: { accent?: string }) {
  const ring = useRef<THREE.Mesh>(null)

  useFrame((state) => {
    const mesh = ring.current
    if (!mesh) return
    // A slow pulse, so it reads as live rather than as a painted marker.
    const pulse = 1 + Math.sin(state.clock.elapsedTime * 5) * 0.08
    mesh.scale.set(pulse, pulse, 1)
  })

  return (
    <mesh ref={ring} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]}>
      <ringGeometry args={[0.52, 0.68, 32]} />
      <meshBasicMaterial color={accent} transparent opacity={0.75} toneMapped={false} />
    </mesh>
  )
}

/**
 * The enterable buildings, drawn from the layout.
 *
 * The main building gets its own component. It is the one real building on
 * this campus and deserves more than an extruded box with windows on it.
 */
export function CampusBuildings({ timeOfDay = 'day' }: { timeOfDay?: TimeOfDay | string }) {
  return (
    <group>
      {/* Only what stands on the campus. The library, the labs, the
          amphitheatre, the student centre, the cafeteria and the sports hall
          are rooms inside the main building now, and a room has no facade. */}
      {OUTDOOR_BUILDINGS.map((building) =>
        building.interior === 'ufaz-core' ? (
          <UfazBuilding key={building.id} building={building} timeOfDay={timeOfDay} />
        ) : (
          <Building
            key={building.id}
            position={building.position}
            size={building.size}
            color={building.color}
            trim={building.trim}
            name={building.name}
            icon={building.icon}
            style={building.style}
            timeOfDay={timeOfDay}
          />
        ),
      )}
    </group>
  )
}
