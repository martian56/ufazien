import { useLayoutEffect, useMemo } from 'react'
import { Instance, Instances } from '@react-three/drei'
import * as THREE from 'three'

import { daylight, type TimeOfDay } from './campusLayout'
import {
  DISTRICT_BUILDINGS,
  DISTRICT_STREETS,
  type DistrictBuilding,
  type DistrictStreet,
  type Footprint,
} from './nizamiDistrict'

/**
 * The city around the university.
 *
 * Draws the district in `nizamiDistrict.ts` — surveyed street centrelines and
 * building footprints from OpenStreetMap, projected into world metres. What
 * stood here before was one asphalt strip and six identical terrace boxes, and
 * the thing it most obviously was not was Baku: the real quarter is a dense
 * grid of nineteenth-century blocks built solid to the pavement edge, with
 * Nizami Street running past the front door and Puşkin, Fikrət Əmirov, 28 May
 * and Azadlıq boxing in the block behind.
 *
 * None of it is enterable. It is there to be walked around and looked at, and
 * to stop the world ending in a field fifty metres past the landmark.
 *
 * ## Why it is drawn like this
 *
 * Footprints are extruded from their outlines rather than approximated with
 * boxes, because a Baku block is not a box — it follows the street, and the
 * corners where two streets meet at eighty degrees are most of what makes the
 * grid read as a real one.
 *
 * Windows are a single instanced mesh for the whole district. Drawn as
 * individual meshes there are several thousand of them and the frame rate goes
 * with them; as instances they cost one draw call.
 */

const LIMESTONE = ['#d8cbaf', '#d0c2a4', '#ded2b8', '#c9bb9d'] as const
const TOWER_GLASS = '#7f95a8'
const CORNICE = '#b8a888'
const PLINTH = '#9d9280'
const ROAD = '#33363b'
const PAVING = '#9c9483'

/** Storey height, matching the generator's. Windows are laid out on it. */
const STOREY = 3.6

interface DistrictProps {
  timeOfDay?: TimeOfDay | string
}

/**
 * A footprint as a `THREE.Shape`, ready to extrude.
 *
 * Extrusion runs along +Z and the result is laid flat by rotating -90° about X,
 * which sends shape (x, y) to world (x, y→height, -y). So the shape carries the
 * world z negated; get that backwards and the whole district is mirrored, which
 * looks almost right and is completely wrong.
 */
function footprintShape(footprint: Footprint): THREE.Shape {
  const shape = new THREE.Shape()
  footprint.forEach(([x, z], i) => {
    if (i === 0) shape.moveTo(x, -z)
    else shape.lineTo(x, -z)
  })
  shape.closePath()
  return shape
}

/** Whether a ring is wound anticlockwise, which decides which way is out. */
function isAnticlockwise(footprint: Footprint): boolean {
  let sum = 0
  for (let i = 0; i < footprint.length; i++) {
    const [x1, z1] = footprint[i]
    const [x2, z2] = footprint[(i + 1) % footprint.length]
    sum += (x2 - x1) * (z2 + z1)
  }
  return sum < 0
}

interface WindowSpot {
  x: number
  y: number
  z: number
  ry: number
  lit: boolean
  /** Ground floor. Baku's blocks are shops and cafes at street level. */
  shop: boolean
}

/**
 * Where every window in the district goes.
 *
 * Walks each footprint edge, steps along it at a fixed bay spacing, and stacks
 * a window at each floor. Edges shorter than a bay get none: a window on a
 * two-metre chamfer at the corner of a block reads as a mistake.
 */
function windowSpots(buildings: readonly DistrictBuilding[], lampsOn: boolean): WindowSpot[] {
  const spots: WindowSpot[] = []

  buildings.forEach((building, index) => {
    if (building.style === 'infill') return
    const outward = isAnticlockwise(building.footprint) ? -1 : 1
    const floors = Math.max(1, Math.floor(building.height / STOREY))

    for (let e = 0; e < building.footprint.length; e++) {
      const [x1, z1] = building.footprint[e]
      const [x2, z2] = building.footprint[(e + 1) % building.footprint.length]
      const dx = x2 - x1
      const dz = z2 - z1
      const length = Math.hypot(dx, dz)
      if (length < 5) continue

      const ux = dx / length
      const uz = dz / length
      // Outward normal, and the heading a window on this wall faces.
      const nx = -uz * outward
      const nz = ux * outward
      const ry = Math.atan2(nx, nz)

      const bays = Math.max(1, Math.floor(length / 4.2))
      for (let b = 0; b < bays; b++) {
        const t = ((b + 0.5) / bays) * length
        for (let floor = 0; floor < floors; floor++) {
          // Deterministic, so the district does not flicker on re-render.
          const shop = floor === 0
          const lit = lampsOn && (shop || (index * 13 + b * 7 + floor * 5) % 7 < 3)
          spots.push({
            x: x1 + ux * t + nx * 0.12,
            y: shop ? STOREY * 0.5 : floor * STOREY + STOREY * 0.62,
            z: z1 + uz * t + nz * 0.12,
            ry,
            lit,
            shop,
          })
        }
      }
    }
  })

  return spots
}

/** One block: the mass, a plinth at pavement level, and a cornice on top. */
function Block({ building, index }: { building: DistrictBuilding; index: number }) {
  const geometry = useMemo(() => {
    const shape = footprintShape(building.footprint)
    const geo = new THREE.ExtrudeGeometry(shape, {
      depth: building.height,
      bevelEnabled: false,
    })
    geo.rotateX(-Math.PI / 2)
    return geo
  }, [building])

  const cornice = useMemo(() => {
    // Scaled about the footprint's centroid rather than offset properly.
    // Polygon offsetting is a real algorithm and this is a 25-centimetre lip on
    // a building the player never gets closer than a pavement's width to.
    const centre = building.footprint.reduce(
      (acc, [x, z]) => [acc[0] + x / building.footprint.length, acc[1] + z / building.footprint.length],
      [0, 0],
    )
    const grown = building.footprint.map(
      ([x, z]) => [centre[0] + (x - centre[0]) * 1.02, centre[1] + (z - centre[1]) * 1.02] as const,
    )
    const geo = new THREE.ExtrudeGeometry(footprintShape(grown), {
      depth: 0.9,
      bevelEnabled: false,
    })
    geo.rotateX(-Math.PI / 2)
    return geo
  }, [building])

  useLayoutEffect(
    () => () => {
      geometry.dispose()
      cornice.dispose()
    },
    [geometry, cornice],
  )

  const wall =
    building.style === 'tower' ? TOWER_GLASS : LIMESTONE[index % LIMESTONE.length]

  return (
    <group>
      <mesh geometry={geometry} castShadow receiveShadow>
        <meshStandardMaterial
          color={wall}
          roughness={building.style === 'tower' ? 0.3 : 0.94}
          metalness={building.style === 'tower' ? 0.45 : 0}
        />
      </mesh>
      {/* The cornice, sitting just under the eaves rather than on top of them,
          so the roofline reads as a moulding and not as a hat. */}
      <mesh geometry={cornice} position={[0, building.height - 0.9, 0]} castShadow>
        <meshStandardMaterial color={CORNICE} roughness={0.9} />
      </mesh>
      <mesh geometry={cornice} position={[0, 0, 0]} receiveShadow>
        <meshStandardMaterial color={PLINTH} roughness={0.95} />
      </mesh>
    </group>
  )
}

/**
 * The carriageways and their pavements.
 *
 * One slab per segment, laid flat and turned to the segment's heading. Drawn
 * from the centreline rather than as axis-aligned rectangles because the grid
 * is not square: Nizami runs twenty-one degrees off east and every street that
 * crosses it inherits the angle.
 */
function Street({ street }: { street: DistrictStreet }) {
  const segments = useMemo(() => {
    const out: { x: number; z: number; length: number; angle: number }[] = []
    for (let i = 0; i < street.points.length - 1; i++) {
      const [x1, z1] = street.points[i]
      const [x2, z2] = street.points[i + 1]
      const length = Math.hypot(x2 - x1, z2 - z1)
      if (length < 0.5) continue
      out.push({
        x: (x1 + x2) / 2,
        z: (z1 + z2) / 2,
        // Overlapped a little at each end so the joints at a bend do not show
        // as a wedge of grass through the road surface.
        length: length + street.width * 0.5,
        angle: Math.atan2(z2 - z1, x2 - x1),
      })
    }
    return out
  }, [street])

  const pavement = 4

  return (
    <group>
      {segments.map((segment, i) => (
        <group key={i} position={[segment.x, 0, segment.z]} rotation={[0, -segment.angle, 0]}>
          {/* Pavement first and lower, carriageway on top of it: two coplanar
              surfaces at the same height flicker, and the road is the one that
              has to win. */}
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.012, 0]} receiveShadow>
            <planeGeometry args={[segment.length, street.width + pavement * 2]} />
            <meshStandardMaterial color={PAVING} roughness={0.95} />
          </mesh>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.022, 0]} receiveShadow>
            <planeGeometry args={[segment.length, street.width]} />
            <meshStandardMaterial
              color={street.kind === 'pedestrian' ? PAVING : ROAD}
              roughness={street.kind === 'pedestrian' ? 0.95 : 0.85}
            />
          </mesh>
        </group>
      ))}
    </group>
  )
}

/**
 * One instanced pass over a subset of the windows.
 *
 * Instanced meshes share a single material, so anything that needs a different
 * colour needs its own pass. Four of them — surrounds, dark glass, lit glass,
 * shopfronts — is still four draw calls for the whole district, against several
 * thousand if each window were a mesh.
 */
function WindowPass({
  spots,
  size,
  offset = 0,
  children,
}: {
  spots: WindowSpot[]
  size: [number, number]
  offset?: number
  children: React.ReactNode
}) {
  if (!spots.length) return null
  return (
    <Instances limit={spots.length} range={spots.length}>
      <planeGeometry args={size} />
      {children}
      {spots.map((spot, i) => (
        <Instance
          key={i}
          position={[
            spot.x + Math.sin(spot.ry) * offset,
            spot.y,
            spot.z + Math.cos(spot.ry) * offset,
          ]}
          rotation={[0, spot.ry, 0]}
        />
      ))}
    </Instances>
  )
}

/**
 * The pavement each block stands on.
 *
 * The streets carry their own footway, but a surveyed footprint does not sit at
 * the generator's tidy setback from the centreline — it sits where the building
 * sits — so between the two there was a ribbon of lawn running along the front
 * of every block in central Baku. This is the block's own apron: its outline,
 * grown, laid on the ground.
 */
function Apron({ footprint }: { footprint: Footprint }) {
  const geometry = useMemo(() => {
    const centre = footprint.reduce(
      (acc, [x, z]) => [acc[0] + x / footprint.length, acc[1] + z / footprint.length],
      [0, 0],
    )
    const grown = footprint.map(
      ([x, z]) =>
        [centre[0] + (x - centre[0]) * 1.35 + 0.5, centre[1] + (z - centre[1]) * 1.35 + 0.5] as const,
    )
    const geo = new THREE.ShapeGeometry(footprintShape(grown))
    geo.rotateX(-Math.PI / 2)
    return geo
  }, [footprint])

  useLayoutEffect(() => () => geometry.dispose(), [geometry])

  return (
    <mesh geometry={geometry} position={[0, 0.018, 0]} receiveShadow>
      <meshStandardMaterial color={PAVING} roughness={0.95} />
    </mesh>
  )
}

/**
 * Where the street trees and lamp standards go.
 *
 * Down both footways of every named street, alternating so a lamp never shares
 * a spot with a tree. The photographs of Nizami Street are more tree than
 * building — the carriageway runs under a continuous canopy — and a bare road
 * between two rows of blocks is the one thing that most obviously was not Baku.
 */
function streetFurniture(streets: readonly DistrictStreet[]) {
  const trees: { x: number; z: number; scale: number }[] = []
  const lamps: { x: number; z: number }[] = []

  for (const street of streets) {
    if (!street.name) continue
    for (let i = 0; i < street.points.length - 1; i++) {
      const [x1, z1] = street.points[i]
      const [x2, z2] = street.points[i + 1]
      const run = Math.hypot(x2 - x1, z2 - z1)
      if (run < 16) continue
      const ux = (x2 - x1) / run
      const uz = (z2 - z1) / run
      const offset = street.width / 2 + 2.2

      const count = Math.floor(run / 13)
      for (let n = 0; n < count; n++) {
        const t = ((n + 0.5) / count) * run
        for (const side of [-1, 1]) {
          const x = x1 + ux * t + -uz * side * offset
          const z = z1 + uz * t + ux * side * offset
          // Hashed off the position so the row is varied and identical every
          // run; `Math.random()` here would reshuffle the street on re-render.
          const hash = Math.abs(Math.round(x * 31 + z * 17))
          if (hash % 4 === 0) lamps.push({ x, z })
          else trees.push({ x, z, scale: 0.85 + (hash % 5) * 0.09 })
        }
      }
    }
  }

  return { trees, lamps }
}

/** A plane tree, as the street is planted with. */
function StreetTree({ x, z, scale, canopy }: { x: number; z: number; scale: number; canopy: string }) {
  return (
    <group position={[x, 0, z]} scale={scale}>
      <mesh position={[0, 2.4, 0]} castShadow>
        <cylinderGeometry args={[0.22, 0.34, 4.8, 6]} />
        <meshStandardMaterial color="#5b432c" roughness={0.95} />
      </mesh>
      <mesh position={[0, 5.9, 0]} castShadow>
        <icosahedronGeometry args={[2.5, 0]} />
        <meshStandardMaterial color={canopy} roughness={0.95} flatShading />
      </mesh>
      <mesh position={[1.1, 4.9, 0.5]} castShadow>
        <icosahedronGeometry args={[1.6, 0]} />
        <meshStandardMaterial color={canopy} roughness={0.95} flatShading />
      </mesh>
    </group>
  )
}

/**
 * A Baku lamp standard: a fluted column on a swelled base with a globe.
 *
 * The campus lamps are a pole and a ball. These are the ones that actually
 * stand on Nizami Street, and the base is most of what distinguishes them.
 */
function StreetLamp({ x, z, lit }: { x: number; z: number; lit: boolean }) {
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, 0.45, 0]} castShadow>
        <cylinderGeometry args={[0.32, 0.46, 0.9, 8]} />
        <meshStandardMaterial color="#232830" roughness={0.7} metalness={0.35} />
      </mesh>
      <mesh position={[0, 2.6, 0]} castShadow>
        <cylinderGeometry args={[0.1, 0.16, 3.4, 8]} />
        <meshStandardMaterial color="#232830" roughness={0.7} metalness={0.35} />
      </mesh>
      <mesh position={[0, 4.55, 0]}>
        <sphereGeometry args={[0.42, 12, 10]} />
        <meshStandardMaterial
          color={lit ? '#fff0c8' : '#d8d8d2'}
          emissive={lit ? '#ffdc96' : '#000000'}
          emissiveIntensity={lit ? 1.5 : 0}
          roughness={0.3}
        />
      </mesh>
    </group>
  )
}

export function NizamiDistrict({ timeOfDay = 'day' }: DistrictProps) {
  const lampsOn = daylight(timeOfDay).lampsOn
  const spots = useMemo(() => windowSpots(DISTRICT_BUILDINGS, lampsOn), [lampsOn])

  const upper = spots.filter((s) => !s.shop)
  const dark = upper.filter((s) => !s.lit)
  const glowing = upper.filter((s) => s.lit)
  const shops = spots.filter((s) => s.shop)
  const { trees, lamps } = useMemo(() => streetFurniture(DISTRICT_STREETS), [])
  const canopy = lampsOn ? '#26401f' : '#3f7a34'

  return (
    <group>
      {DISTRICT_STREETS.map((street, i) => (
        <Street key={i} street={street} />
      ))}

      {trees.map((tree, i) => (
        <StreetTree key={`t${i}`} {...tree} canopy={canopy} />
      ))}
      {lamps.map((lamp, i) => (
        <StreetLamp key={`l${i}`} {...lamp} lit={lampsOn} />
      ))}

      {DISTRICT_BUILDINGS.map((building, i) => (
        <Apron key={`a${i}`} footprint={building.footprint} />
      ))}

      {DISTRICT_BUILDINGS.map((building, i) => (
        <Block key={i} building={building} index={i} />
      ))}

      {/* Cream architraves, set a little behind the glass. Without them every
          opening is a black hole punched in a beige wall, which is what the
          district looked like on the first pass — the surround is most of what
          you actually read on a limestone facade from across the street. */}
      <WindowPass spots={upper} size={[2.05, 2.6]} offset={-0.06}>
        <meshStandardMaterial color={CORNICE} roughness={0.9} />
      </WindowPass>

      <WindowPass spots={dark} size={[1.5, 2.1]}>
        <meshStandardMaterial color="#2c333c" roughness={0.35} metalness={0.4} />
      </WindowPass>

      <WindowPass spots={glowing} size={[1.5, 2.1]}>
        <meshStandardMaterial
          color="#f7e3b6"
          emissive="#ffd894"
          emissiveIntensity={0.8}
          roughness={0.4}
        />
      </WindowPass>

      {/* Ground floor. This quarter is shops and cafes at street level and has
          been since it was built, so the bottom storey is glazed nearly to the
          pavement rather than being another row of windows. */}
      <WindowPass spots={shops} size={[3.2, 3.1]}>
        <meshStandardMaterial
          color={lampsOn ? '#ffe6b0' : '#38424e'}
          emissive={lampsOn ? '#ffcf80' : '#0e1319'}
          emissiveIntensity={lampsOn ? 0.9 : 0.15}
          roughness={0.2}
          metalness={0.5}
        />
      </WindowPass>
    </group>
  )
}

export default NizamiDistrict
