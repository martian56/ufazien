import { useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

import { daylight, type CampusBuilding, type TimeOfDay } from './campusLayout'

import { facadeTexture, flagTexture, lettersTexture } from './campusTextures'
import CampusWindows from './CampusWindows'

/**
 * 183 Nizami Street: the building UFAZ actually occupies.
 *
 * The French-Azerbaijani University is not a campus of glass boxes. It is one
 * six-storey building in central Baku — a state-protected architectural
 * monument of local significance, restored and reopened in September 2016, with
 * laboratories fitted out in 2018 to University of Strasbourg standards. It
 * stands in the oil-boom terrace along Nizami Street, and those buildings have
 * a very specific vocabulary: local "Baku stone" limestone, a rusticated ground
 * floor, arched openings on the first floor, pilasters running up between the
 * bays, a heavy dentilled cornice, balustraded balconies and quoined corners.
 *
 * So that is what is modelled here, bay by bay, rather than the generic
 * extruded box every other building on the campus gets. Two flags fly over the
 * door because the university is a joint Strasbourg/ASOIU project, and the
 * parapet carries its name.
 *
 * Photographs of the real building could not be pulled into this environment —
 * outbound requests to ufaz.az and Wikipedia are blocked by the network policy
 * — so the proportions here are reconstructed from the published description
 * (six storeys, roughly 2,500 m², historic protected frontage) and from the
 * shared grammar of the street it stands on, not traced from a specific photo.
 */

const dummy = new THREE.Object3D()

/** Bays across the front. Odd, so there is a centre bay for the entrance. */
const BAYS = 11
/** Floors above the ground floor. Six storeys in total. */
const UPPER_FLOORS = 5

interface UfazBuildingProps {
  building: CampusBuilding
  timeOfDay?: TimeOfDay | string
}

export default function UfazBuilding({ building, timeOfDay = 'day' }: UfazBuildingProps) {
  const [width, height, depth] = building.size
  const config = daylight(timeOfDay)
  const lit = config.lampsOn

  const groundHeight = 6.2
  const upperHeight = (height - groundHeight - 2.2) / UPPER_FLOORS
  const bayWidth = width / BAYS
  const halfW = width / 2
  const halfD = depth / 2

  const stone = facadeTexture(building.color, 'heritage')
  const facadeMap = useMemo(() => {
    if (!stone) return null
    const clone = stone.clone()
    clone.needsUpdate = true
    clone.repeat.set(width / 9, height / 9)
    return clone
  }, [stone, width, height])

  useLayoutEffect(() => () => facadeMap?.dispose(), [facadeMap])

  /**
   * Every window on the building, sorted into the two shapes the facade uses:
   * arched on the piano nobile, rectangular above it.
   */
  const { arched, square, ground } = useMemo(() => {
    const archedItems: { x: number; y: number; z: number; ry: number }[] = []
    const squareItems: { x: number; y: number; z: number; ry: number }[] = []
    const groundItems: { x: number; y: number; z: number; ry: number }[] = []

    // The ground floor. Set into the rusticated base, and skipping the three
    // centre bays, which are the entrance.
    for (let bay = 0; bay < BAYS; bay++) {
      const x = -halfW + bayWidth * (bay + 0.5)
      if (Math.abs(bay - (BAYS - 1) / 2) <= 1) continue
      groundItems.push({ x, y: groundHeight * 0.56, z: halfD + 0.42, ry: 0 })
      groundItems.push({ x, y: groundHeight * 0.56, z: -halfD - 0.42, ry: Math.PI })
    }
    for (let bay = 0; bay < 3; bay++) {
      const z = -halfD + (depth / 4) * (bay + 1)
      groundItems.push({ x: halfW + 0.42, y: groundHeight * 0.56, z, ry: Math.PI / 2 })
      groundItems.push({ x: -halfW - 0.42, y: groundHeight * 0.56, z, ry: -Math.PI / 2 })
    }

    for (let floor = 0; floor < UPPER_FLOORS; floor++) {
      const y = groundHeight + floor * upperHeight + upperHeight / 2
      const target = floor === 0 ? archedItems : squareItems

      for (let bay = 0; bay < BAYS; bay++) {
        const x = -halfW + bayWidth * (bay + 0.5)
        target.push({ x, y, z: halfD + 0.12, ry: 0 })
        target.push({ x, y, z: -halfD - 0.12, ry: Math.PI })
      }

      // Returns down the sides. Four bays deep reads right at this footprint.
      for (let bay = 0; bay < 4; bay++) {
        const z = -halfD + (depth / 5) * (bay + 1)
        target.push({ x: halfW + 0.12, y, z, ry: Math.PI / 2 })
        target.push({ x: -halfW - 0.12, y, z, ry: -Math.PI / 2 })
      }
    }

    return { arched: archedItems, square: squareItems, ground: groundItems }
  }, [bayWidth, depth, groundHeight, halfD, halfW, upperHeight])

  return (
    <group position={building.position}>
      {/* The mass */}
      <mesh castShadow receiveShadow position={[0, height / 2, 0]}>
        <boxGeometry args={[width, height, depth]} />
        <meshStandardMaterial
          map={facadeMap ?? undefined}
          color={facadeMap ? '#ffffff' : building.color}
          roughness={0.9}
        />
      </mesh>

      <RusticatedBase width={width} depth={depth} height={groundHeight} color={building.trim} />

      <Quoins width={width} depth={depth} height={height} color={building.trim} />

      <Pilasters
        bays={BAYS}
        bayWidth={bayWidth}
        halfW={halfW}
        halfD={halfD}
        base={groundHeight}
        top={height - 2.2}
        color={building.trim}
      />

      <CampusWindows
        items={ground}
        kind="arched"
        wall={building.trim}
        size={[bayWidth * 0.44, groundHeight * 0.52]}
        lit={lit}
        seed={3}
      />
      <CampusWindows
        items={arched}
        kind="arched"
        wall={building.color}
        size={[bayWidth * 0.52, upperHeight * 0.78]}
        lit={lit}
        seed={11}
      />
      <CampusWindows
        items={square}
        kind="square"
        wall={building.color}
        size={[bayWidth * 0.46, upperHeight * 0.62]}
        lit={lit}
        seed={29}
      />

      <Balconies
        bays={BAYS}
        bayWidth={bayWidth}
        halfW={halfW}
        halfD={halfD}
        y={groundHeight}
        color={building.trim}
      />

      <Cornice width={width} depth={depth} y={height - 2.2} color={building.trim} />

      <Parapet width={width} depth={depth} y={height - 0.9} color={building.trim} />

      <Portal halfD={halfD} color={building.trim} lit={lit} />

      <Flags halfD={halfD} />

      {/* The name, incised into the parapet */}
      <NameBoard width={width} halfD={halfD} y={height - 0.2} lit={lit} />
    </group>
  )
}

/** Heavy horizontal banding on the ground floor, the way the street does it. */
function RusticatedBase({
  width,
  depth,
  height,
  color,
}: {
  width: number
  depth: number
  height: number
  color: string
}) {
  const bands = 7

  return (
    <group>
      {/* Plinth */}
      <mesh receiveShadow castShadow position={[0, 0.5, 0]}>
        <boxGeometry args={[width + 1.1, 1, depth + 1.1]} />
        <meshStandardMaterial color={color} roughness={0.95} />
      </mesh>

      {Array.from({ length: bands }, (_, i) => (
        <mesh key={i} castShadow position={[0, 1 + (i + 0.5) * ((height - 1) / bands), 0]}>
          <boxGeometry args={[width + 0.55, (height - 1) / bands - 0.14, depth + 0.55]} />
          <meshStandardMaterial color={color} roughness={0.94} />
        </mesh>
      ))}

      {/* The band that separates the ground floor from the piano nobile */}
      <mesh castShadow position={[0, height + 0.1, 0]}>
        <boxGeometry args={[width + 0.9, 0.45, depth + 0.9]} />
        <meshStandardMaterial color={color} roughness={0.9} />
      </mesh>
    </group>
  )
}

/** Dressed stone corners. Cheap, and they stop the box reading as a box. */
function Quoins({
  width,
  depth,
  height,
  color,
}: {
  width: number
  depth: number
  height: number
  color: string
}) {
  const corners: [number, number][] = [
    [width / 2, depth / 2],
    [-width / 2, depth / 2],
    [width / 2, -depth / 2],
    [-width / 2, -depth / 2],
  ]

  return (
    <group>
      {corners.map(([x, z], i) => (
        <mesh key={i} castShadow position={[x, height / 2, z]}>
          <boxGeometry args={[1.5, height, 1.5]} />
          <meshStandardMaterial color={color} roughness={0.92} />
        </mesh>
      ))}
    </group>
  )
}

/** Flat pilasters running up between the bays. */
function Pilasters({
  bays,
  bayWidth,
  halfW,
  halfD,
  base,
  top,
  color,
}: {
  bays: number
  bayWidth: number
  halfW: number
  halfD: number
  base: number
  top: number
  color: string
}) {
  const mesh = useRef<THREE.InstancedMesh>(null)
  // One between each pair of bays, on both long faces.
  const positions = useMemo(() => {
    const items: { x: number; z: number; ry: number }[] = []
    for (let i = 1; i < bays; i++) {
      const x = -halfW + bayWidth * i
      items.push({ x, z: halfD + 0.14, ry: 0 })
      items.push({ x, z: -halfD - 0.14, ry: 0 })
    }
    return items
  }, [bays, bayWidth, halfW, halfD])

  const height = top - base

  useLayoutEffect(() => {
    const target = mesh.current
    if (!target) return
    positions.forEach((item, i) => {
      dummy.position.set(item.x, base + height / 2, item.z)
      dummy.rotation.set(0, item.ry, 0)
      dummy.scale.set(1, 1, 1)
      dummy.updateMatrix()
      target.setMatrixAt(i, dummy.matrix)
    })
    target.instanceMatrix.needsUpdate = true
    target.computeBoundingSphere()
  }, [positions, base, height])

  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, positions.length]} castShadow>
      <boxGeometry args={[0.85, height, 0.32]} />
      <meshStandardMaterial color={color} roughness={0.92} />
    </instancedMesh>
  )
}

/** Balustraded balconies on the piano nobile, alternating bays. */
function Balconies({
  bays,
  bayWidth,
  halfW,
  halfD,
  y,
  color,
}: {
  bays: number
  bayWidth: number
  halfW: number
  halfD: number
  y: number
  color: string
}) {
  const slabs = useMemo(() => {
    const items: number[] = []
    for (let bay = 0; bay < bays; bay++) {
      // Not on the centre bay: that is the portal, and not on every bay
      // either, or the frontage turns into a shelf.
      if (bay === Math.floor(bays / 2)) continue
      if (bay % 2 === 1) continue
      items.push(-halfW + bayWidth * (bay + 0.5))
    }
    return items
  }, [bays, bayWidth, halfW])

  return (
    <group>
      {slabs.map((x) => (
        <group key={x} position={[x, y + 0.4, halfD + 0.55]}>
          <mesh castShadow receiveShadow>
            <boxGeometry args={[bayWidth * 0.8, 0.22, 1.1]} />
            <meshStandardMaterial color={color} roughness={0.92} />
          </mesh>
          {/* Balusters */}
          {[-0.36, -0.12, 0.12, 0.36].map((f) => (
            <mesh key={f} castShadow position={[bayWidth * 0.8 * f, 0.45, 0.45]}>
              <cylinderGeometry args={[0.08, 0.11, 0.7, 8]} />
              <meshStandardMaterial color={color} roughness={0.9} />
            </mesh>
          ))}
          <mesh castShadow position={[0, 0.85, 0.45]}>
            <boxGeometry args={[bayWidth * 0.8, 0.14, 0.28]} />
            <meshStandardMaterial color={color} roughness={0.9} />
          </mesh>
        </group>
      ))}
    </group>
  )
}

/** The crowning cornice, with a run of dentils under it. */
function Cornice({
  width,
  depth,
  y,
  color,
}: {
  width: number
  depth: number
  y: number
  color: string
}) {
  const dentils = useRef<THREE.InstancedMesh>(null)

  const teeth = useMemo(() => {
    const items: { x: number; z: number }[] = []
    const step = 1.1
    for (let x = -width / 2 + 0.6; x <= width / 2 - 0.6; x += step) {
      items.push({ x, z: depth / 2 + 0.45 })
      items.push({ x, z: -depth / 2 - 0.45 })
    }
    return items
  }, [width, depth])

  useLayoutEffect(() => {
    const target = dentils.current
    if (!target) return
    teeth.forEach((tooth, i) => {
      dummy.position.set(tooth.x, y - 0.35, tooth.z)
      dummy.rotation.set(0, 0, 0)
      dummy.scale.set(1, 1, 1)
      dummy.updateMatrix()
      target.setMatrixAt(i, dummy.matrix)
    })
    target.instanceMatrix.needsUpdate = true
    target.computeBoundingSphere()
  }, [teeth, y])

  return (
    <group>
      <instancedMesh ref={dentils} args={[undefined, undefined, teeth.length]} castShadow>
        <boxGeometry args={[0.5, 0.5, 0.5]} />
        <meshStandardMaterial color={color} roughness={0.9} />
      </instancedMesh>

      <mesh castShadow position={[0, y + 0.35, 0]}>
        <boxGeometry args={[width + 2.4, 0.7, depth + 2.4]} />
        <meshStandardMaterial color={color} roughness={0.88} />
      </mesh>
      <mesh castShadow position={[0, y + 0.85, 0]}>
        <boxGeometry args={[width + 1.6, 0.4, depth + 1.6]} />
        <meshStandardMaterial color={color} roughness={0.88} />
      </mesh>
    </group>
  )
}

/** A low attic wall above the cornice, hiding the roof. */
function Parapet({
  width,
  depth,
  y,
  color,
}: {
  width: number
  depth: number
  y: number
  color: string
}) {
  return (
    <group>
      {([
        [0, depth / 2 + 0.6, width + 1.4, 0.5],
        [0, -depth / 2 - 0.6, width + 1.4, 0.5],
      ] as [number, number, number, number][]).map(([x, z, w, d], i) => (
        <mesh key={i} castShadow position={[x, y + 0.7, z]}>
          <boxGeometry args={[w, 1.4, d]} />
          <meshStandardMaterial color={color} roughness={0.9} />
        </mesh>
      ))}
      {/* Pedestals at the ends, which is how these parapets terminate */}
      {[-1, 1].map((side) => (
        <mesh key={side} castShadow position={[side * (width / 2 + 0.4), y + 1.1, depth / 2 + 0.6]}>
          <boxGeometry args={[1.5, 2.2, 1.2]} />
          <meshStandardMaterial color={color} roughness={0.9} />
        </mesh>
      ))}
    </group>
  )
}

/** The entrance: arch, keystone, pediment and lamps. */
function Portal({ halfD, color, lit }: { halfD: number; color: string; lit: boolean }) {
  return (
    <group position={[0, 0, halfD + 0.1]}>
      {/* Steps */}
      {[0, 1, 2, 3].map((i) => (
        <mesh key={i} receiveShadow castShadow position={[0, 0.16 + i * 0.3, 2.6 - i * 0.55]}>
          <boxGeometry args={[11 - i * 0.5, 0.32, 1.2]} />
          <meshStandardMaterial color={color} roughness={0.95} />
        </mesh>
      ))}

      {/* Surround */}
      <mesh castShadow position={[0, 3.4, 0.2]}>
        <boxGeometry args={[9.4, 6.8, 0.6]} />
        <meshStandardMaterial color={color} roughness={0.9} />
      </mesh>

      {/* The arch head over the doors */}
      <mesh castShadow position={[0, 5.2, 0.5]}>
        <torusGeometry args={[2.85, 0.3, 10, 28, Math.PI]} />
        <meshStandardMaterial color={color} roughness={0.9} />
      </mesh>

      {/* Keystone, sitting on the crown of the arch */}
      <mesh castShadow position={[0, 8.15, 0.55]}>
        <boxGeometry args={[0.9, 1.2, 0.55]} />
        <meshStandardMaterial color={color} roughness={0.9} />
      </mesh>

      {/* Dark reveal, then the doors themselves */}
      <mesh position={[0, 2.9, 0.5]}>
        <boxGeometry args={[6.2, 5.6, 0.2]} />
        <meshStandardMaterial color="#2b2118" roughness={0.7} />
      </mesh>
      <mesh position={[0, 2.7, 0.64]}>
        <boxGeometry args={[5.4, 5, 0.16]} />
        <meshStandardMaterial color="#4a3a28" roughness={0.6} metalness={0.15} />
      </mesh>
      {/* Glazed fanlight, filling the arch above the doors */}
      <mesh position={[0, 5.25, 0.52]}>
        <circleGeometry args={[2.6, 24, 0, Math.PI]} />
        <meshStandardMaterial
          color="#9fd6ff"
          roughness={0.1}
          metalness={0.4}
          transparent
          opacity={0.72}
          emissive="#8fc0ff"
          emissiveIntensity={lit ? 0.7 : 0.1}
          side={THREE.DoubleSide}
        />
      </mesh>
      {/* Door mullion */}
      <mesh position={[0, 2.7, 0.73]}>
        <boxGeometry args={[0.16, 5, 0.1]} />
        <meshStandardMaterial color="#2f2519" roughness={0.6} />
      </mesh>

      {/* Carriage lamps either side */}
      {[-4.2, 4.2].map((x) => (
        <group key={x} position={[x, 4.2, 0.7]}>
          <mesh castShadow>
            <boxGeometry args={[0.5, 0.8, 0.5]} />
            <meshStandardMaterial
              color="#f6e2b4"
              emissive="#ffcf7a"
              emissiveIntensity={lit ? 2.2 : 0.25}
              toneMapped={false}
            />
          </mesh>
          <mesh position={[0, 0.55, 0]}>
            <coneGeometry args={[0.42, 0.4, 4]} />
            <meshStandardMaterial color="#2f3640" roughness={0.6} metalness={0.4} />
          </mesh>
        </group>
      ))}

      {lit && <pointLight position={[0, 4.5, 2]} intensity={25} distance={18} color="#ffd9a0" />}
    </group>
  )
}

/**
 * The French and Azerbaijani flags, on poles either side of the door.
 *
 * The cloth is a plane whose vertices are displaced by a travelling sine wave,
 * which is about fifteen lines and looks far better than a rigid rectangle. The
 * displacement is strongest at the free edge and zero at the pole, so the flag
 * stays attached to it.
 */
function Flags({ halfD }: { halfD: number }) {
  return (
    <group>
      <Flag country="az" position={[-11.5, 0, halfD + 1.2]} />
      <Flag country="fr" position={[11.5, 0, halfD + 1.2]} />
    </group>
  )
}

function Flag({ country, position }: { country: 'az' | 'fr'; position: [number, number, number] }) {
  const cloth = useRef<THREE.Mesh>(null)
  const texture = flagTexture(country)
  const rest = useRef<Float32Array | null>(null)
  // Offsets the wave per flag, so the pair do not ripple in lockstep.
  const phase = country === 'az' ? 0 : 1.7

  useLayoutEffect(() => {
    const geometry = cloth.current?.geometry
    if (!geometry) return
    rest.current = Float32Array.from(geometry.attributes.position.array)
  }, [])

  useFrame(({ clock }) => {
    const geometry = cloth.current?.geometry
    const base = rest.current
    if (!geometry || !base) return

    const position = geometry.attributes.position
    const t = clock.elapsedTime * 3 + phase
    for (let i = 0; i < position.count; i++) {
      const x = base[i * 3]
      const y = base[i * 3 + 1]
      // 0 at the pole edge, 1 at the free edge.
      const grip = (x + 1.6) / 3.2
      position.setZ(i, Math.sin(t + x * 2.6 + y) * 0.32 * grip * grip)
    }
    position.needsUpdate = true
    geometry.computeVertexNormals()
  })

  return (
    <group position={position}>
      <mesh castShadow position={[0, 5, 0]}>
        <cylinderGeometry args={[0.09, 0.13, 10, 8]} />
        <meshStandardMaterial color="#d8d4cc" roughness={0.5} metalness={0.4} />
      </mesh>
      <mesh position={[0, 10.2, 0]}>
        <sphereGeometry args={[0.2, 12, 10]} />
        <meshStandardMaterial color="#c9a227" roughness={0.35} metalness={0.7} />
      </mesh>

      <mesh ref={cloth} position={[1.7, 8.4, 0]} castShadow>
        <planeGeometry args={[3.2, 1.9, 16, 8]} />
        <meshStandardMaterial
          map={texture ?? undefined}
          color={texture ? '#ffffff' : '#cccccc'}
          side={THREE.DoubleSide}
          roughness={0.85}
        />
      </mesh>
    </group>
  )
}

/** "UFAZ · 183 NİZAMİ" across the parapet. */
function NameBoard({
  width,
  halfD,
  y,
  lit,
}: {
  width: number
  halfD: number
  y: number
  lit: boolean
}) {
  const texture = lettersTexture('UFAZ')
  const address = lettersTexture('183 NİZAMİ KÜÇƏSİ', '#7a6a4e')

  return (
    <group>
      {texture && (
        <mesh position={[0, y + 0.75, halfD + 0.9]}>
          <planeGeometry args={[width * 0.34, width * 0.34 * (192 / 1024) * 1.9]} />
          <meshStandardMaterial
            map={texture}
            transparent
            roughness={0.85}
            emissive="#ffe9b8"
            emissiveMap={texture}
            emissiveIntensity={lit ? 0.7 : 0.08}
          />
        </mesh>
      )}
      {address && (
        <group position={[6.2, 3.1, halfD + 0.45]}>
          <mesh castShadow>
            <boxGeometry args={[3.4, 0.9, 0.12]} />
            <meshStandardMaterial color="#8a6b2f" roughness={0.3} metalness={0.75} />
          </mesh>
          <mesh position={[0, 0, 0.07]}>
            <planeGeometry args={[3.1, 3.1 * (192 / 1024) * 1.6]} />
            <meshStandardMaterial map={address} transparent roughness={0.5} metalness={0.3} />
          </mesh>
        </group>
      )}
    </group>
  )
}
