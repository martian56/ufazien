import { useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'

import type { InteriorKind, Vec3 } from './campusLayout'
import { mulberry32 } from './campusLayout'
import { INTERIOR_SPECS, type FloorKind, type InteriorSpec } from './interiorSpecs'
import {
  carpetTexture,
  ceilingTexture,
  marbleTexture,
  tileTexture,
  woodTexture,
} from './campusTextures'

/**
 * Interiors.
 *
 * Every building used to open into the same room: one 40×40 box with a lecture
 * board and four rows of identical desks, whatever door you had walked through.
 * Entering the library and the cafeteria produced pixel-identical views, which
 * made the whole idea of going inside pointless.
 *
 * Now each building has its own: its own size, floor, ceiling height, lighting
 * temperature and furniture. What they share is the shell — walls, ceiling,
 * skirting, a light rig — because that part genuinely is the same everywhere,
 * and a shared shell is what keeps the projector, the entry camera and the
 * player's boundary clamp working the same way in all of them.
 */

const dummy = new THREE.Object3D()
const color = new THREE.Color()

function floorMaterial(kind: FloorKind) {
  switch (kind) {
    case 'marble':
      return { texture: marbleTexture(), color: '#ded5c4', roughness: 0.22, metalness: 0.06 }
    case 'wood':
      return { texture: woodTexture(), color: '#8a6742', roughness: 0.55, metalness: 0 }
    case 'carpet':
      return { texture: carpetTexture(), color: '#3f4a5c', roughness: 1, metalness: 0 }
    case 'tile':
      return { texture: tileTexture(), color: '#d9d5cc', roughness: 0.35, metalness: 0 }
    case 'court':
      return { texture: woodTexture(), color: '#c19a5f', roughness: 0.4, metalness: 0 }
    case 'epoxy':
    default:
      // Poured resin: pale and slightly reflective, not the pitch green the
      // outdoor court texture gave it.
      return { texture: tileTexture('#b9c6c9', '#a9b7bb'), color: '#b9c6c9', roughness: 0.28, metalness: 0.06 }
  }
}

/**
 * Walls, floor, ceiling, skirting and the light rig.
 *
 * The ceiling is a real surface with a texture rather than a flat plane, and
 * the lights are placed as a grid rather than as one bulb at the centre, which
 * is what made every old interior look like a cave with a torch in it.
 */
function RoomShell({ spec, children }: { spec: InteriorSpec; children?: React.ReactNode }) {
  const size = spec.halfExtent * 2
  const floor = floorMaterial(spec.floor)
  const ceiling = ceilingTexture()

  // Scale texture repeats with the room, so a big hall does not get giant tiles.
  const floorMap = useMemo(() => {
    if (!floor.texture) return null
    const clone = floor.texture.clone()
    clone.needsUpdate = true
    clone.repeat.set((size / 100) * floor.texture.repeat.x, (size / 100) * floor.texture.repeat.y)
    return clone
  }, [floor.texture, size])

  useLayoutEffect(() => () => floorMap?.dispose(), [floorMap])

  const walls: [number, number, number, number][] = [
    [0, spec.ceiling / 2, -spec.halfExtent, 0],
    [0, spec.ceiling / 2, spec.halfExtent, Math.PI],
    [-spec.halfExtent, spec.ceiling / 2, 0, Math.PI / 2],
    [spec.halfExtent, spec.ceiling / 2, 0, -Math.PI / 2],
  ]

  // A grid of downlights. Three by three is enough to light a room evenly
  // without paying for a light per square metre.
  const lights = useMemo(() => {
    const spread = spec.halfExtent * 0.55
    const items: [number, number][] = []
    for (const x of [-spread, 0, spread]) {
      for (const z of [-spread, 0, spread]) items.push([x, z])
    }
    return items
  }, [spec.halfExtent])

  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[size, size]} />
        <meshStandardMaterial
          map={floorMap ?? undefined}
          color={floorMap ? '#ffffff' : floor.color}
          roughness={floor.roughness}
          metalness={floor.metalness}
        />
      </mesh>

      {walls.map(([x, y, z, ry], i) => (
        <group key={i}>
          <mesh position={[x, y, z]} rotation={[0, ry, 0]} receiveShadow>
            <planeGeometry args={[size, spec.ceiling]} />
            <meshStandardMaterial color={spec.wall} roughness={0.95} side={THREE.DoubleSide} />
          </mesh>
          {/* Skirting and a picture rail: two thin boxes that give the wall a
              scale, without which a room reads as an infinite grey field. */}
          <mesh position={[x, 0.2, z]} rotation={[0, ry, 0]}>
            <boxGeometry args={[size, 0.4, 0.3]} />
            <meshStandardMaterial color={spec.accent} roughness={0.8} />
          </mesh>
          <mesh position={[x, spec.ceiling - 0.35, z]} rotation={[0, ry, 0]}>
            <boxGeometry args={[size, 0.3, 0.35]} />
            <meshStandardMaterial color={spec.accent} roughness={0.8} />
          </mesh>
        </group>
      ))}

      <mesh position={[0, spec.ceiling, 0]} rotation={[Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[size, size]} />
        {spec.ceilingKind === 'deck' ? (
          <meshStandardMaterial color="#6f7681" roughness={0.85} metalness={0.2} side={THREE.DoubleSide} />
        ) : (
          <meshStandardMaterial
            map={ceiling ?? undefined}
            color={ceiling ? '#ffffff' : '#e8e3d8'}
            roughness={1}
            side={THREE.DoubleSide}
          />
        )}
      </mesh>

      <ambientLight intensity={0.55 * spec.lightIntensity} color={spec.lightColor} />
      {/* One shadow-casting light, so furniture is grounded, and a ring of
          cheap ones for fill. Nine shadow maps would cost more than the whole
          rest of the scene. */}
      <pointLight
        position={[0, spec.ceiling - 1.2, 0]}
        intensity={70 * spec.lightIntensity}
        distance={spec.halfExtent * 3}
        color={spec.lightColor}
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-bias={-0.001}
      />
      {lights.map(([x, z], i) => (
        <group key={i}>
          <pointLight
            position={[x, spec.ceiling - 1.2, z]}
            intensity={22 * spec.lightIntensity}
            distance={spec.halfExtent * 1.6}
            color={spec.lightColor}
          />
          {/* The fitting the light comes out of. */}
          <mesh position={[x, spec.ceiling - 0.25, z]}>
            <boxGeometry args={[2.4, 0.12, 0.7]} />
            <meshStandardMaterial
              color="#ffffff"
              emissive={spec.lightColor}
              emissiveIntensity={1.6}
              toneMapped={false}
            />
          </mesh>
        </group>
      ))}

      {children}
    </group>
  )
}

/* ------------------------------------------------------------------ */
/* Shared furniture                                                     */
/* ------------------------------------------------------------------ */

function Table({
  position,
  size = [3.4, 0.12, 1.4],
  legColor = '#4a4f57',
  topColor = '#8a6742',
}: {
  position: Vec3
  size?: Vec3
  legColor?: string
  topColor?: string
}) {
  const [w, , d] = size
  return (
    <group position={position}>
      <mesh castShadow receiveShadow position={[0, 0.75, 0]}>
        <boxGeometry args={size} />
        <meshStandardMaterial color={topColor} roughness={0.7} />
      </mesh>
      {([[-1, -1], [1, -1], [-1, 1], [1, 1]] as [number, number][]).map(([sx, sz], i) => (
        <mesh key={i} castShadow position={[sx * (w / 2 - 0.2), 0.38, sz * (d / 2 - 0.2)]}>
          <cylinderGeometry args={[0.06, 0.06, 0.75, 6]} />
          <meshStandardMaterial color={legColor} roughness={0.6} metalness={0.35} />
        </mesh>
      ))}
    </group>
  )
}

function Chair({ position, rotation = 0, seat = '#3f5b7a' }: { position: Vec3; rotation?: number; seat?: string }) {
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      <mesh castShadow position={[0, 0.45, 0]}>
        <boxGeometry args={[0.62, 0.08, 0.62]} />
        <meshStandardMaterial color={seat} roughness={0.85} />
      </mesh>
      <mesh castShadow position={[0, 0.78, -0.28]}>
        <boxGeometry args={[0.62, 0.66, 0.08]} />
        <meshStandardMaterial color={seat} roughness={0.85} />
      </mesh>
      {([[-1, -1], [1, -1], [-1, 1], [1, 1]] as [number, number][]).map(([sx, sz], i) => (
        <mesh key={i} castShadow position={[sx * 0.25, 0.22, sz * 0.25]}>
          <cylinderGeometry args={[0.035, 0.035, 0.44, 6]} />
          <meshStandardMaterial color="#3a4048" roughness={0.6} metalness={0.3} />
        </mesh>
      ))}
    </group>
  )
}

/** A wall poster or noticeboard. Flat, but it breaks up a blank wall. */
function WallPanel({
  position,
  rotation = 0,
  size = [3, 2],
  panelColor = '#f2ede2',
  frame = '#4a4f57',
}: {
  position: Vec3
  rotation?: number
  size?: [number, number]
  panelColor?: string
  frame?: string
}) {
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      <mesh castShadow>
        <boxGeometry args={[size[0] + 0.2, size[1] + 0.2, 0.12]} />
        <meshStandardMaterial color={frame} roughness={0.7} />
      </mesh>
      <mesh position={[0, 0, 0.08]}>
        <planeGeometry args={size} />
        <meshStandardMaterial color={panelColor} roughness={0.9} />
      </mesh>
    </group>
  )
}

/** A potted plant, the universal interior filler. */
function Plant({ position, scale = 1 }: { position: Vec3; scale?: number }) {
  return (
    <group position={position} scale={scale}>
      <mesh castShadow receiveShadow position={[0, 0.35, 0]}>
        <cylinderGeometry args={[0.35, 0.28, 0.7, 12]} />
        <meshStandardMaterial color="#8a5c42" roughness={0.9} />
      </mesh>
      {[0, 1, 2, 3, 4].map((i) => {
        const angle = (i / 5) * Math.PI * 2
        return (
          <mesh
            key={i}
            castShadow
            position={[Math.cos(angle) * 0.3, 1.15, Math.sin(angle) * 0.3]}
            rotation={[Math.cos(angle) * 0.45, 0, Math.sin(angle) * -0.45]}
          >
            <coneGeometry args={[0.32, 1.4, 5]} />
            <meshStandardMaterial color="#2f7a3c" roughness={0.9} flatShading />
          </mesh>
        )
      })}
    </group>
  )
}

/* ------------------------------------------------------------------ */
/* UFAZ main building: the entrance hall                                */
/* ------------------------------------------------------------------ */

function UfazHall({ spec }: { spec: InteriorSpec }) {
  const half = spec.halfExtent

  return (
    <group>
      {/* Columns down both sides, which is what a hall of this period has */}
      {[-1, 1].map((side) =>
        [-14, -7, 0, 7, 14].map((z) => (
          <group key={`${side}-${z}`} position={[side * (half - 5), 0, z]}>
            <mesh castShadow receiveShadow position={[0, spec.ceiling / 2, 0]}>
              <cylinderGeometry args={[0.75, 0.85, spec.ceiling, 20]} />
              <meshStandardMaterial color="#efe6d2" roughness={0.5} />
            </mesh>
            {/* Capital and base */}
            <mesh castShadow position={[0, spec.ceiling - 0.5, 0]}>
              <boxGeometry args={[2.1, 0.7, 2.1]} />
              <meshStandardMaterial color={spec.accent} roughness={0.55} metalness={0.2} />
            </mesh>
            <mesh castShadow position={[0, 0.35, 0]}>
              <boxGeometry args={[2, 0.7, 2]} />
              <meshStandardMaterial color={spec.accent} roughness={0.6} />
            </mesh>
          </group>
        )),
      )}

      {/*
        The staircase.
        Deep treads climbing away from the door towards a landing on the back
        wall. It used to be a dozen pale steps against a pale wall in a room lit
        from directly above, and the whole flight disappeared: from the entrance
        it read as a floating slab. A dark runner and a rail with real posts
        give it edges to catch the light.
      */}
      <group position={[0, 0, -half + 12]}>
        {Array.from({ length: 14 }, (_, i) => (
          <group key={i} position={[0, 0.3 + i * 0.3, -i * 0.62]}>
            <mesh castShadow receiveShadow>
              <boxGeometry args={[11, 0.3, 0.66]} />
              <meshStandardMaterial color="#e4dac4" roughness={0.35} metalness={0.05} />
            </mesh>
            {/* Runner */}
            <mesh position={[0, 0.16, 0.02]} receiveShadow>
              <boxGeometry args={[5.2, 0.04, 0.66]} />
              <meshStandardMaterial color="#8c3b32" roughness={0.95} />
            </mesh>
          </group>
        ))}

        <mesh castShadow receiveShadow position={[0, 4.35, -9.4]}>
          <boxGeometry args={[17, 0.4, 4.4]} />
          <meshStandardMaterial color="#e4dac4" roughness={0.35} />
        </mesh>

        {/* Balustrade: a solid stepped parapet with a brass cap, built from
            the same rise and going as the treads so it can never drift out of
            line with them the way a single raking rail did. */}
        {[-5.5, 5.5].map((x) =>
          Array.from({ length: 14 }, (_, i) => (
            <group key={`${x}-${i}`} position={[x, 0.3 + i * 0.3, -i * 0.62]}>
              <mesh castShadow receiveShadow position={[0, 0.62, 0]}>
                <boxGeometry args={[0.36, 1.1, 0.66]} />
                <meshStandardMaterial color="#e4dac4" roughness={0.45} />
              </mesh>
              <mesh castShadow position={[0, 1.22, 0]}>
                <boxGeometry args={[0.46, 0.12, 0.66]} />
                <meshStandardMaterial color="#c9a227" roughness={0.3} metalness={0.8} />
              </mesh>
            </group>
          )),
        )}

        {/* Newel posts at the foot of the flight */}
        {[-5.5, 5.5].map((x) => (
          <mesh key={x} castShadow position={[x, 0.8, 0.7]}>
            <boxGeometry args={[0.7, 1.6, 0.7]} />
            <meshStandardMaterial color="#e4dac4" roughness={0.45} />
          </mesh>
        ))}
      </group>

      {/* Reception desk. The worktop was near-black, which in a cream marble
          hall read as a monolith rather than a counter. */}
      <group position={[-13, 0, 8]}>
        <mesh castShadow receiveShadow position={[0, 0.55, 0]}>
          <boxGeometry args={[5.5, 1.1, 1.4]} />
          <meshStandardMaterial color="#6d5334" roughness={0.6} />
        </mesh>
        <mesh castShadow position={[0, 1.16, 0]}>
          <boxGeometry args={[6, 0.12, 1.8]} />
          <meshStandardMaterial color="#cbbfa6" roughness={0.3} metalness={0.1} />
        </mesh>
        {/* A monitor on the counter, so somebody works here */}
        <mesh castShadow position={[1.6, 1.55, 0]} rotation={[0, -0.4, 0]}>
          <boxGeometry args={[0.9, 0.6, 0.05]} />
          <meshStandardMaterial color="#1c1f24" emissive="#3f6fa0" emissiveIntensity={0.5} />
        </mesh>
      </group>

      {/* A pendant over the middle of the hall, which is what a room this tall
          needs to stop the ceiling reading as a lid. */}
      <group position={[0, spec.ceiling - 3.6, 0]}>
        {/* A tiered brass fitting rather than one big glowing disc, which read
            as a hole in the ceiling. */}
        {([[1.3, 0], [0.95, 0.45], [0.6, 0.85]] as [number, number][]).map(([radius, y]) => (
          <mesh key={y} castShadow position={[0, y, 0]}>
            <cylinderGeometry args={[radius, radius + 0.16, 0.22, 20]} />
            <meshStandardMaterial
              color="#f6e8c8"
              emissive="#ffdfa8"
              emissiveIntensity={0.7}
              toneMapped={false}
            />
          </mesh>
        ))}
        <mesh position={[0, 2.2, 0]}>
          <cylinderGeometry args={[0.05, 0.05, 3, 8]} />
          <meshStandardMaterial color={spec.accent} roughness={0.35} metalness={0.7} />
        </mesh>
        <pointLight intensity={32} distance={26} color="#ffe9c4" />
      </group>

      {/* Flags on stands, as they stand in the real lobby */}
      {([[-3.5, '#00b5e2'], [3.5, '#000091']] as [number, string][]).map(([x, flagColor]) => (
        <group key={x} position={[x, 0, -half + 15]}>
          <mesh castShadow position={[0, 1.7, 0]}>
            <cylinderGeometry args={[0.05, 0.07, 3.4, 8]} />
            <meshStandardMaterial color="#c9c4bb" roughness={0.4} metalness={0.5} />
          </mesh>
          <mesh castShadow position={[0.55, 2.7, 0]}>
            <planeGeometry args={[1.1, 0.7]} />
            <meshStandardMaterial color={flagColor} side={THREE.DoubleSide} roughness={0.85} />
          </mesh>
          <mesh position={[0, 0.06, 0]}>
            <cylinderGeometry args={[0.4, 0.45, 0.12, 12]} />
            <meshStandardMaterial color="#2f3640" roughness={0.5} metalness={0.4} />
          </mesh>
        </group>
      ))}

      {/* Seating for people waiting, and greenery */}
      {[-6, 0, 6].map((z) => (
        <group key={z} position={[half - 6, 0, z]}>
          <mesh castShadow receiveShadow position={[0, 0.45, 0]}>
            <boxGeometry args={[1.6, 0.25, 4.4]} />
            <meshStandardMaterial color="#6d5a45" roughness={0.75} />
          </mesh>
        </group>
      ))}
      {/* An inlaid medallion, so the floor is not an unbroken sheet */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.012, 2]} receiveShadow>
        <ringGeometry args={[3.4, 4.2, 48]} />
        <meshStandardMaterial color={spec.accent} roughness={0.3} metalness={0.25} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.012, 2]} receiveShadow>
        <ringGeometry args={[0, 1.2, 32]} />
        <meshStandardMaterial color={spec.accent} roughness={0.3} metalness={0.25} />
      </mesh>

      <Plant position={[-half + 3, 0, half - 4]} scale={1.5} />
      <Plant position={[half - 3, 0, half - 4]} scale={1.5} />
      <Plant position={[-half + 3, 0, -half + 6]} scale={1.3} />
      <Plant position={[half - 3, 0, -half + 6]} scale={1.3} />

      {/* Honours boards on the side walls */}
      <WallPanel position={[-half + 0.4, 5, -6]} rotation={Math.PI / 2} size={[5, 3]} panelColor="#e8dcc0" frame={spec.accent} />
      <WallPanel position={[-half + 0.4, 5, 6]} rotation={Math.PI / 2} size={[5, 3]} panelColor="#e8dcc0" frame={spec.accent} />
      <WallPanel position={[half - 0.4, 5, 0]} rotation={-Math.PI / 2} size={[6, 3.4]} panelColor="#dfe8f0" frame={spec.accent} />
    </group>
  )
}

/* ------------------------------------------------------------------ */
/* Library                                                              */
/* ------------------------------------------------------------------ */

/** Where the stacks stand. Module scope, so the book layout memo is stable. */
const STACK_ROWS = [-15, -9, -3, 3]

/**
 * Books, instanced.
 *
 * Every shelf on both sides of every stack, roughly two thousand spines, in a
 * single draw call with a per-instance colour. Modelling them as meshes would
 * be two thousand objects for the renderer to sort.
 */
function Books({ count, layout }: { count: number; layout: { x: number; y: number; z: number; ry: number; w: number }[] }) {
  const mesh = useRef<THREE.InstancedMesh>(null)

  useLayoutEffect(() => {
    const target = mesh.current
    if (!target) return
    const random = mulberry32(90210)
    const palette = ['#8c3b32', '#2f5d7c', '#3f6b47', '#7a5c2e', '#5b3a63', '#2f3f4f', '#96682f']
    layout.forEach((book, i) => {
      dummy.position.set(book.x, book.y, book.z)
      dummy.rotation.set(0, book.ry, 0)
      dummy.scale.set(book.w, 0.9 + random() * 0.28, 1)
      dummy.updateMatrix()
      target.setMatrixAt(i, dummy.matrix)
      color.set(palette[Math.floor(random() * palette.length)])
      // A little shade variation per spine, or the palette reads as stripes.
      color.multiplyScalar(0.82 + random() * 0.36)
      target.setColorAt(i, color)
    })
    target.instanceMatrix.needsUpdate = true
    if (target.instanceColor) target.instanceColor.needsUpdate = true
    target.computeBoundingSphere()
  }, [layout])

  if (!count) return null

  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, count]} castShadow receiveShadow>
      <boxGeometry args={[1, 0.32, 0.24]} />
      <meshStandardMaterial roughness={0.85} />
    </instancedMesh>
  )
}

function LibraryInterior({ spec }: { spec: InteriorSpec }) {
  const half = spec.halfExtent

  const books = useMemo(() => {
    const random = mulberry32(1337)
    const items: { x: number; y: number; z: number; ry: number; w: number }[] = []
    for (const z of STACK_ROWS) {
      for (let shelf = 0; shelf < 5; shelf++) {
        const y = 0.75 + shelf * 1.05
        for (const side of [-1, 1]) {
          let x = -half + 4
          while (x < half - 4) {
            const w = 0.16 + random() * 0.14
            // Leave the occasional gap: a shelf packed edge to edge looks
            // painted on, and someone always has a book out.
            if (random() > 0.08) {
              items.push({ x: x + w / 2, y: y + 0.2, z: z + side * 0.42, ry: 0, w })
            }
            x += w + 0.02
          }
        }
      }
    }
    return items
  }, [half])

  return (
    <group>
      {/* Stacks */}
      {STACK_ROWS.map((z) => (
        <group key={z} position={[0, 0, z]}>
          <mesh castShadow receiveShadow position={[0, 2.9, 0]}>
            <boxGeometry args={[(half - 4) * 2, 5.8, 0.7]} />
            <meshStandardMaterial color="#6d4f32" roughness={0.8} />
          </mesh>
          {/* Shelf boards, both faces */}
          {[0, 1, 2, 3, 4].map((shelf) =>
            [-1, 1].map((side) => (
              <mesh
                key={`${shelf}-${side}`}
                castShadow
                receiveShadow
                position={[0, 0.7 + shelf * 1.05, side * 0.5]}
              >
                <boxGeometry args={[(half - 4) * 2, 0.09, 0.35]} />
                <meshStandardMaterial color="#7d5c3d" roughness={0.8} />
              </mesh>
            )),
          )}
        </group>
      ))}

      <Books count={books.length} layout={books} />

      {/* Reading tables under the windows, with green lamps */}
      {[10, 15, 20].map((z) => (
        <group key={z}>
          {[-9, 9].map((x) => (
            <group key={x} position={[x, 0, z]}>
              <Table position={[0, 0, 0]} size={[5, 0.12, 2]} topColor="#7d5c3d" />
              <Chair position={[-1.3, 0, 1.5]} rotation={Math.PI} seat="#5a4630" />
              <Chair position={[1.3, 0, 1.5]} rotation={Math.PI} seat="#5a4630" />
              <Chair position={[-1.3, 0, -1.5]} seat="#5a4630" />
              <Chair position={[1.3, 0, -1.5]} seat="#5a4630" />
              {/* Banker's lamp */}
              <group position={[0, 0.82, 0]}>
                <mesh castShadow>
                  <cylinderGeometry args={[0.18, 0.22, 0.08, 12]} />
                  <meshStandardMaterial color="#c9a227" roughness={0.3} metalness={0.8} />
                </mesh>
                <mesh position={[0, 0.28, 0]}>
                  <cylinderGeometry args={[0.03, 0.03, 0.5, 6]} />
                  <meshStandardMaterial color="#c9a227" roughness={0.3} metalness={0.8} />
                </mesh>
                <mesh position={[0, 0.55, 0]} rotation={[Math.PI, 0, 0]}>
                  <cylinderGeometry args={[0.34, 0.2, 0.24, 14, 1, true]} />
                  <meshStandardMaterial
                    color="#1f6b3f"
                    side={THREE.DoubleSide}
                    emissive="#8fffc0"
                    emissiveIntensity={0.35}
                    roughness={0.5}
                  />
                </mesh>
                <pointLight position={[0, 0.4, 0]} intensity={7} distance={5.5} color="#ffe9b0" />
              </group>
            </group>
          ))}
        </group>
      ))}

      {/* Issue desk by the door */}
      <group position={[0, 0, half - 4]}>
        <mesh castShadow receiveShadow position={[0, 0.6, 0]}>
          <boxGeometry args={[7, 1.2, 1.5]} />
          <meshStandardMaterial color="#5d452c" roughness={0.7} />
        </mesh>
        <mesh castShadow position={[0, 1.26, 0]}>
          <boxGeometry args={[7.4, 0.12, 1.9]} />
          <meshStandardMaterial color="#3a2f24" roughness={0.5} />
        </mesh>
      </group>

      <Plant position={[-half + 2.5, 0, half - 3]} scale={1.3} />
      <Plant position={[half - 2.5, 0, half - 3]} scale={1.3} />
      <WallPanel position={[half - 0.4, 5, 0]} rotation={-Math.PI / 2} size={[6, 3]} panelColor="#efe6d0" frame={spec.accent} />
    </group>
  )
}

/* ------------------------------------------------------------------ */
/* Laboratory                                                           */
/* ------------------------------------------------------------------ */

function LabInterior({ spec }: { spec: InteriorSpec }) {
  const half = spec.halfExtent

  return (
    <group>
      {/* Island benches with sinks and taps */}
      {[-9, -2, 5].map((z) => (
        <group key={z} position={[0, 0, z]}>
          <mesh castShadow receiveShadow position={[0, 0.45, 0]}>
            <boxGeometry args={[22, 0.9, 2.2]} />
            <meshStandardMaterial color="#e6e9ec" roughness={0.6} />
          </mesh>
          <mesh castShadow receiveShadow position={[0, 0.95, 0]}>
            <boxGeometry args={[22.4, 0.14, 2.5]} />
            <meshStandardMaterial color="#33393f" roughness={0.35} metalness={0.15} />
          </mesh>
          {/* Reagent shelf down the spine of the bench */}
          <mesh castShadow position={[0, 1.55, 0]}>
            <boxGeometry args={[22, 0.08, 0.6]} />
            <meshStandardMaterial color="#c3ccd3" roughness={0.5} />
          </mesh>
          {[-9, -5, -1, 3, 7].map((x) => (
            <group key={x}>
              {/* Tap */}
              <mesh castShadow position={[x, 1.3, 0.7]}>
                <cylinderGeometry args={[0.045, 0.045, 0.65, 8]} />
                <meshStandardMaterial color="#8d959c" roughness={0.25} metalness={0.85} />
              </mesh>
              {/* Sink */}
              <mesh position={[x + 1.2, 1.0, 0.7]}>
                <boxGeometry args={[0.8, 0.06, 0.6]} />
                <meshStandardMaterial color="#5c646b" roughness={0.3} metalness={0.6} />
              </mesh>
              {/* Bottles on the shelf */}
              <mesh castShadow position={[x + 0.4, 1.85, 0]}>
                <cylinderGeometry args={[0.13, 0.13, 0.5, 10]} />
                <meshStandardMaterial
                  color={x % 8 === 0 ? '#7fd4a8' : '#d4a87f'}
                  transparent
                  opacity={0.8}
                  roughness={0.15}
                />
              </mesh>
            </group>
          ))}
        </group>
      ))}

      {/* Fume cupboards along the back wall */}
      {[-13, -4.5, 4, 12.5].map((x) => (
        <group key={x} position={[x, 0, -half + 1.4]}>
          <mesh castShadow receiveShadow position={[0, 1.9, 0]}>
            <boxGeometry args={[7.6, 3.8, 2.2]} />
            <meshStandardMaterial color="#cfd6dc" roughness={0.6} />
          </mesh>
          {/* Sash: the glass front, raised */}
          <mesh position={[0, 2.4, 1.16]}>
            <boxGeometry args={[6.8, 1.9, 0.08]} />
            <meshStandardMaterial
              color="#a8d8f0"
              transparent
              opacity={0.42}
              roughness={0.06}
              metalness={0.3}
            />
          </mesh>
          <mesh position={[0, 1.2, 1.15]}>
            <boxGeometry args={[6.8, 0.1, 0.5]} />
            <meshStandardMaterial color="#4c5560" roughness={0.4} metalness={0.5} />
          </mesh>
          {/* Interior strip light, so the cabinet glows */}
          <mesh position={[0, 3.5, 0]}>
            <boxGeometry args={[6.4, 0.08, 0.4]} />
            <meshStandardMaterial color="#ffffff" emissive="#dff2ff" emissiveIntensity={2} toneMapped={false} />
          </mesh>
        </group>
      ))}

      {/* Eyewash and safety shower in the corner */}
      <group position={[half - 2.5, 0, half - 3]}>
        <mesh castShadow position={[0, 2.2, 0]}>
          <cylinderGeometry args={[0.06, 0.06, 4.4, 8]} />
          <meshStandardMaterial color="#c8ccd0" roughness={0.3} metalness={0.7} />
        </mesh>
        <mesh castShadow position={[0, 4.3, 0]}>
          <cylinderGeometry args={[0.55, 0.35, 0.18, 14]} />
          <meshStandardMaterial color="#2f9b4f" roughness={0.5} />
        </mesh>
      </group>

      {/* Periodic table and safety notices */}
      <WallPanel position={[-half + 0.4, 4.6, 0]} rotation={Math.PI / 2} size={[9, 4.5]} panelColor="#e9f1f6" frame="#39424b" />
      <WallPanel position={[half - 0.4, 4.6, -6]} rotation={-Math.PI / 2} size={[3.4, 2.4]} panelColor="#ffe066" frame="#39424b" />
      <WallPanel position={[half - 0.4, 4.6, 2]} rotation={-Math.PI / 2} size={[3.4, 2.4]} panelColor="#8fd0ff" frame="#39424b" />
    </group>
  )
}

/* ------------------------------------------------------------------ */
/* Amphitheatre                                                         */
/* ------------------------------------------------------------------ */

function LectureInterior({ spec }: { spec: InteriorSpec }) {
  const half = spec.halfExtent
  const rows = [0, 1, 2, 3, 4, 5]

  return (
    <group>
      {/* Raked seating: each row on its own step, rising towards the back.
          The old room put flat desks on a flat floor, which is not what an
          amphitheatre is. */}
      {rows.map((row) => {
        const z = -4 + row * 4.6
        const y = row * 0.75
        return (
          <group key={row} position={[0, y, z]}>
            {/* The step itself */}
            <mesh castShadow receiveShadow position={[0, -0.375, 0]}>
              <boxGeometry args={[half * 1.85, 0.75, 4.6]} />
              <meshStandardMaterial color="#8f8a7c" roughness={0.95} />
            </mesh>
            {/* Continuous desk */}
            <mesh castShadow receiveShadow position={[0, 0.75, -1.5]}>
              <boxGeometry args={[half * 1.7, 0.1, 1.3]} />
              <meshStandardMaterial color="#8a6742" roughness={0.75} />
            </mesh>
            <mesh castShadow position={[0, 0.4, -2.1]}>
              <boxGeometry args={[half * 1.7, 0.7, 0.08]} />
              <meshStandardMaterial color="#7a5c3d" roughness={0.8} />
            </mesh>
            {/* Tip-up seats */}
            {Array.from({ length: 9 }, (_, i) => {
              const x = -half * 0.78 + i * ((half * 1.56) / 8)
              return (
                <group key={i} position={[x, 0, 0.4]}>
                  <mesh castShadow position={[0, 0.45, 0]}>
                    <boxGeometry args={[0.66, 0.1, 0.6]} />
                    <meshStandardMaterial color={spec.accent} roughness={0.85} />
                  </mesh>
                  <mesh castShadow position={[0, 0.82, 0.3]}>
                    <boxGeometry args={[0.66, 0.75, 0.1]} />
                    <meshStandardMaterial color={spec.accent} roughness={0.85} />
                  </mesh>
                </group>
              )
            })}
          </group>
        )
      })}

      {/* Lectern down at the front */}
      <group position={[-7, 0, -half + 6]}>
        <mesh castShadow position={[0, 0.6, 0]}>
          <boxGeometry args={[1.5, 1.2, 0.9]} />
          <meshStandardMaterial color="#6b4f34" roughness={0.8} />
        </mesh>
        <mesh castShadow position={[0, 1.24, 0]} rotation={[-0.3, 0, 0]}>
          <boxGeometry args={[1.7, 0.08, 0.95]} />
          <meshStandardMaterial color="#7d5c3d" roughness={0.75} />
        </mesh>
        <mesh position={[0, 1.35, 0.1]} rotation={[-0.3, 0, 0]}>
          <boxGeometry args={[0.7, 0.02, 0.45]} />
          <meshStandardMaterial color="#1c1f24" emissive="#3f6fa0" emissiveIntensity={0.6} />
        </mesh>
      </group>

      {/* Whiteboards flanking the projector screen */}
      {[-13, 13].map((x) => (
        <mesh key={x} castShadow position={[x, 4.4, -half + 0.5]}>
          <boxGeometry args={[7.5, 4, 0.2]} />
          <meshStandardMaterial color="#f4f6f4" roughness={0.25} />
        </mesh>
      ))}

      {/* A dark band behind the screen, so a projected image has contrast */}
      <mesh position={[0, 5.6, -half + 0.42]} receiveShadow>
        <boxGeometry args={[19, 9, 0.3]} />
        <meshStandardMaterial color="#1f2733" roughness={0.7} />
      </mesh>
    </group>
  )
}

/* ------------------------------------------------------------------ */
/* Student centre                                                       */
/* ------------------------------------------------------------------ */

function Sofa({ position, rotation = 0, fabric = '#3f8f7f' }: { position: Vec3; rotation?: number; fabric?: string }) {
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      <mesh castShadow receiveShadow position={[0, 0.4, 0]}>
        <boxGeometry args={[3.2, 0.55, 1.3]} />
        <meshStandardMaterial color={fabric} roughness={0.95} />
      </mesh>
      <mesh castShadow position={[0, 0.95, -0.58]}>
        <boxGeometry args={[3.2, 0.95, 0.28]} />
        <meshStandardMaterial color={fabric} roughness={0.95} />
      </mesh>
      {[-1.6, 1.6].map((x) => (
        <mesh key={x} castShadow position={[x, 0.75, 0]}>
          <boxGeometry args={[0.26, 0.85, 1.3]} />
          <meshStandardMaterial color={fabric} roughness={0.95} />
        </mesh>
      ))}
      {/* Feet. Without them the whole thing hovered a hand's width off the floor. */}
      {([[-1.4, -0.5], [1.4, -0.5], [-1.4, 0.5], [1.4, 0.5]] as [number, number][]).map(([x, z], i) => (
        <mesh key={i} castShadow position={[x, 0.07, z]}>
          <cylinderGeometry args={[0.07, 0.07, 0.14, 6]} />
          <meshStandardMaterial color="#2f2a26" roughness={0.7} />
        </mesh>
      ))}
    </group>
  )
}

function StudentCentreInterior({ spec }: { spec: InteriorSpec }) {
  const half = spec.halfExtent

  return (
    <group>
      {/* Lounge clusters */}
      {([[-12, 10], [12, 10], [-12, -4], [12, -4], [0, 4]] as [number, number][]).map(([x, z], i) => (
        <group key={i} position={[x, 0, z]}>
          <Sofa position={[0, 0, 2]} rotation={Math.PI} fabric={i === 1 ? '#8a5f7f' : '#3f8f7f'} />
          <Sofa position={[0, 0, -2]} fabric={i === 1 ? '#8a5f7f' : '#3f8f7f'} />
          <Table position={[0, 0, 0]} size={[2.2, 0.1, 1.1]} topColor="#4a4038" legColor="#2f3640" />
        </group>
      ))}

      {/* Table football, which is what a student centre is actually for */}
      <group position={[8, 0, -14]}>
        <mesh castShadow receiveShadow position={[0, 0.5, 0]}>
          <boxGeometry args={[4.2, 1, 2.4]} />
          <meshStandardMaterial color="#2f4a3f" roughness={0.7} />
        </mesh>
        <mesh position={[0, 1.02, 0]}>
          <boxGeometry args={[3.9, 0.05, 2.1]} />
          <meshStandardMaterial color="#2f7a4a" roughness={0.9} />
        </mesh>
        {[-1.5, -0.5, 0.5, 1.5].map((x) => (
          <group key={x}>
            <mesh castShadow position={[x, 1.25, 0]} rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.05, 0.05, 3.2, 8]} />
              <meshStandardMaterial color="#b9c0c7" roughness={0.3} metalness={0.8} />
            </mesh>
            {[-0.7, 0, 0.7].map((z) => (
              <mesh key={z} castShadow position={[x, 1.25, z]}>
                <boxGeometry args={[0.18, 0.42, 0.16]} />
                <meshStandardMaterial color={x < 0 ? '#d94f4f' : '#3f7fd9'} roughness={0.6} />
              </mesh>
            ))}
          </group>
        ))}
      </group>

      {/* Vending machines */}
      {[-6, -2.5].map((x) => (
        <group key={x} position={[x, 0, -half + 1.2]}>
          <mesh castShadow receiveShadow position={[0, 1.5, 0]}>
            <boxGeometry args={[2.4, 3, 1.1]} />
            <meshStandardMaterial color="#26303c" roughness={0.6} metalness={0.2} />
          </mesh>
          <mesh position={[0, 1.8, 0.58]}>
            <planeGeometry args={[1.9, 2]} />
            <meshStandardMaterial
              color="#8fd0ff"
              emissive="#8fd0ff"
              emissiveIntensity={0.9}
              transparent
              opacity={0.75}
            />
          </mesh>
        </group>
      ))}

      {/* Coffee bar along the side wall */}
      <group position={[-half + 2.6, 0, -12]} rotation={[0, Math.PI / 2, 0]}>
        <mesh castShadow receiveShadow position={[0, 0.6, 0]}>
          <boxGeometry args={[10, 1.2, 1.6]} />
          <meshStandardMaterial color="#4a3a2c" roughness={0.7} />
        </mesh>
        <mesh castShadow position={[0, 1.27, 0]}>
          <boxGeometry args={[10.4, 0.14, 2]} />
          <meshStandardMaterial color="#22272d" roughness={0.3} metalness={0.3} />
        </mesh>
        <mesh castShadow position={[-2, 1.75, 0]}>
          <boxGeometry args={[1.4, 0.85, 0.9]} />
          <meshStandardMaterial color="#8d959c" roughness={0.25} metalness={0.8} />
        </mesh>
      </group>

      {/* Ping-pong table, because there is always one */}
      <group position={[-9, 0, 16]}>
        <mesh castShadow receiveShadow position={[0, 0.74, 0]}>
          <boxGeometry args={[4.6, 0.08, 2.6]} />
          <meshStandardMaterial color="#1f4f8f" roughness={0.6} />
        </mesh>
        <mesh position={[0, 0.9, 0]}>
          <boxGeometry args={[0.04, 0.3, 2.8]} />
          <meshStandardMaterial color="#e8ebee" roughness={0.9} transparent opacity={0.85} />
        </mesh>
        {([[-2.1, -1.1], [2.1, -1.1], [-2.1, 1.1], [2.1, 1.1]] as [number, number][]).map(([x, z], i) => (
          <mesh key={i} castShadow position={[x, 0.36, z]}>
            <boxGeometry args={[0.1, 0.72, 0.1]} />
            <meshStandardMaterial color="#2f3640" roughness={0.6} metalness={0.3} />
          </mesh>
        ))}
      </group>

      {/* Booths along the far corner, so the back of the room is not dead space */}
      {[-16, -10.5].map((z) => (
        <group key={z} position={[15, 0, z]}>
          <mesh castShadow receiveShadow position={[0, 0.75, 0]}>
            <boxGeometry args={[2.6, 0.1, 1.3]} />
            <meshStandardMaterial color="#7a5c3d" roughness={0.75} />
          </mesh>
          {[-1, 1].map((side) => (
            <mesh key={side} castShadow position={[0, 0.7, side * 1.1]}>
              <boxGeometry args={[2.6, 1.4, 0.4]} />
              <meshStandardMaterial color="#3f8f7f" roughness={0.95} />
            </mesh>
          ))}
        </group>
      ))}

      <Plant position={[half - 3, 0, half - 4]} scale={1.6} />
      <Plant position={[-half + 3, 0, half - 4]} scale={1.4} />
      <Plant position={[half - 3, 0, -half + 5]} scale={1.2} />
      <Plant position={[-half + 3, 0, -half + 5]} scale={1.3} />
      <Plant position={[-half + 3, 0, 4]} scale={1.1} />

      <WallPanel position={[half - 0.4, 5, 6]} rotation={-Math.PI / 2} size={[5, 3]} panelColor="#eef3f6" frame={spec.accent} />
      <WallPanel position={[-half + 0.4, 5, 12]} rotation={Math.PI / 2} size={[5, 3]} panelColor="#eef3f6" frame={spec.accent} />
    </group>
  )
}

/* ------------------------------------------------------------------ */
/* Cafeteria                                                            */
/* ------------------------------------------------------------------ */

function CafeteriaInterior({ spec }: { spec: InteriorSpec }) {
  const half = spec.halfExtent

  return (
    <group>
      {/* Servery along the back wall: counter, sneeze guard, hot trays */}
      <group position={[0, 0, -half + 3]}>
        <mesh castShadow receiveShadow position={[0, 0.55, 0]}>
          <boxGeometry args={[26, 1.1, 2.2]} />
          <meshStandardMaterial color="#b5b9bd" roughness={0.45} metalness={0.35} />
        </mesh>
        <mesh castShadow position={[0, 1.16, 0]}>
          <boxGeometry args={[26.4, 0.12, 2.6]} />
          <meshStandardMaterial color="#8d959c" roughness={0.25} metalness={0.75} />
        </mesh>
        {/* Glass guard */}
        <mesh position={[0, 1.85, 0.9]}>
          <boxGeometry args={[26, 1.2, 0.06]} />
          <meshStandardMaterial color="#cfe8f5" transparent opacity={0.32} roughness={0.05} metalness={0.2} />
        </mesh>
        {/* Gastronorm trays of food */}
        {[-10, -7, -4, -1, 2, 5, 8, 11].map((x, i) => (
          <mesh key={x} position={[x, 1.24, 0]} receiveShadow>
            <boxGeometry args={[2.4, 0.14, 1.5]} />
            <meshStandardMaterial
              color={['#c2703f', '#d9b44a', '#7f9c4a', '#b04a3a'][i % 4]}
              roughness={0.7}
            />
          </mesh>
        ))}
        {/* Heat lamps */}
        {[-8, -2, 4, 10].map((x) => (
          <mesh key={x} position={[x, 2.7, 0]}>
            <boxGeometry args={[3, 0.12, 0.8]} />
            <meshStandardMaterial color="#ffb066" emissive="#ff9a3c" emissiveIntensity={1.8} toneMapped={false} />
          </mesh>
        ))}
      </group>

      {/* Tray rail */}
      <mesh castShadow position={[0, 0.95, -half + 4.6]}>
        <boxGeometry args={[26, 0.08, 0.5]} />
        <meshStandardMaterial color="#8d959c" roughness={0.3} metalness={0.8} />
      </mesh>

      {/* Dining tables */}
      {[-8, -1, 6, 13].map((z) =>
        [-11, -3.5, 4, 11.5].map((x) => (
          <group key={`${x}-${z}`} position={[x, 0, z]}>
            <Table position={[0, 0, 0]} size={[3, 0.1, 1.5]} topColor="#c8a27a" legColor="#5c646b" />
            <Chair position={[-0.8, 0, 1.4]} rotation={Math.PI} seat="#c2703f" />
            <Chair position={[0.8, 0, 1.4]} rotation={Math.PI} seat="#c2703f" />
            <Chair position={[-0.8, 0, -1.4]} seat="#c2703f" />
            <Chair position={[0.8, 0, -1.4]} seat="#c2703f" />
          </group>
        )),
      )}

      {/* Menu boards over the servery */}
      {[-9, 0, 9].map((x) => (
        <WallPanel
          key={x}
          position={[x, 5.4, -half + 0.4]}
          size={[6, 2.4]}
          panelColor="#1f2733"
          frame="#0f141a"
        />
      ))}

      {/* Bins and a water station by the door */}
      {[-3, 0, 3].map((x) => (
        <mesh key={x} castShadow receiveShadow position={[x, 0.6, half - 2.5]}>
          <boxGeometry args={[1, 1.2, 1]} />
          <meshStandardMaterial color={x === 0 ? '#3f7f4a' : x < 0 ? '#3f6f9f' : '#7f6f3f'} roughness={0.8} />
        </mesh>
      ))}

      <Plant position={[half - 2.5, 0, half - 3]} scale={1.3} />
      <Plant position={[-half + 2.5, 0, half - 3]} scale={1.3} />
    </group>
  )
}

/* ------------------------------------------------------------------ */
/* Sports hall                                                          */
/* ------------------------------------------------------------------ */

function SportsInterior({ spec }: { spec: InteriorSpec }) {
  const half = spec.halfExtent
  const line = { color: '#e8e2d2', roughness: 0.6 }

  return (
    <group>
      {/* Court markings, painted on the boards just above the floor */}
      <group position={[0, 0.02, 0]}>
        {([
          [0, -half + 3, (half - 3) * 2, 0.22],
          [0, half - 3, (half - 3) * 2, 0.22],
          [-(half - 3), 0, 0.22, (half - 3) * 2],
          [half - 3, 0, 0.22, (half - 3) * 2],
          [0, 0, (half - 3) * 2, 0.22],
        ] as [number, number, number, number][]).map(([x, z, w, d], i) => (
          <mesh key={i} rotation={[-Math.PI / 2, 0, 0]} position={[x, 0, z]}>
            <planeGeometry args={[w, d]} />
            <meshStandardMaterial {...line} />
          </mesh>
        ))}
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[3.4, 3.62, 48]} />
          <meshStandardMaterial {...line} />
        </mesh>
        {/* Keys at both ends */}
        {[-1, 1].map((side) => (
          <mesh key={side} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, side * (half - 6.5)]}>
            <ringGeometry args={[5.6, 5.82, 48, 1, 0, Math.PI]} />
            <meshStandardMaterial {...line} />
          </mesh>
        ))}
      </group>

      {/* Bleachers down one side */}
      {[0, 1, 2, 3].map((tier) => (
        <group key={tier} position={[-half + 1.2 + tier * 1.4, tier * 0.7, 0]}>
          <mesh castShadow receiveShadow position={[0, 0.35, 0]}>
            <boxGeometry args={[1.4, 0.7, half * 1.5]} />
            <meshStandardMaterial color="#9aa2ab" roughness={0.9} />
          </mesh>
          <mesh castShadow position={[0, 0.74, 0]}>
            <boxGeometry args={[1.3, 0.1, half * 1.5]} />
            <meshStandardMaterial color={spec.accent} roughness={0.8} />
          </mesh>
        </group>
      ))}

      {/* Wall bars on the far side */}
      {Array.from({ length: 10 }, (_, i) => (
        <mesh key={i} castShadow position={[half - 0.7, 1.2 + i * 0.55, 6]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.07, 0.07, 5, 8]} />
          <meshStandardMaterial color="#c2954f" roughness={0.7} />
        </mesh>
      ))}

      {/* Scoreboard */}
      <group position={[0, 9.5, -half + 0.6]}>
        <mesh castShadow>
          <boxGeometry args={[9, 3.4, 0.4]} />
          <meshStandardMaterial color="#171c22" roughness={0.7} />
        </mesh>
        <mesh position={[0, 0, 0.22]}>
          <planeGeometry args={[8.2, 2.6]} />
          <meshStandardMaterial color="#0d1116" roughness={0.8} />
        </mesh>
        {/* Segments, so it reads as a scoreboard rather than a lit panel */}
        {[-2.6, -1.6, 1.6, 2.6].map((x) => (
          <mesh key={x} position={[x, -0.2, 0.25]}>
            <planeGeometry args={[0.7, 1.2]} />
            <meshStandardMaterial
              color="#ff7a3c"
              emissive="#ff7a3c"
              emissiveIntensity={1.5}
              toneMapped={false}
            />
          </mesh>
        ))}
        <mesh position={[0, -0.2, 0.25]}>
          <planeGeometry args={[0.9, 0.9]} />
          <meshStandardMaterial color="#ffd166" emissive="#ffd166" emissiveIntensity={1.2} toneMapped={false} />
        </mesh>
      </group>

      {/* Roof trusses, which is what you actually look at in a sports hall */}
      {[-14, -7, 0, 7, 14].map((z) => (
        <mesh key={z} castShadow position={[0, spec.ceiling - 1.2, z]}>
          <boxGeometry args={[half * 2 - 1, 0.5, 0.4]} />
          <meshStandardMaterial color="#8d959c" roughness={0.5} metalness={0.5} />
        </mesh>
      ))}
    </group>
  )
}

/* ------------------------------------------------------------------ */

const CONTENTS: Record<InteriorKind, (props: { spec: InteriorSpec }) => React.ReactElement> = {
  ufaz: UfazHall,
  library: LibraryInterior,
  lab: LabInterior,
  lecture: LectureInterior,
  'student-center': StudentCentreInterior,
  cafeteria: CafeteriaInterior,
  sports: SportsInterior,
}

/**
 * The interior of one building.
 *
 * `children` is whatever the page wants to mount inside — the projector screen,
 * and a mini-game station where the building has one.
 */
export function BuildingInterior({
  kind = 'lecture',
  children,
}: {
  kind?: InteriorKind
  children?: React.ReactNode
}) {
  const spec = INTERIOR_SPECS[kind] ?? INTERIOR_SPECS.lecture
  const Contents = CONTENTS[kind] ?? LectureInterior

  return (
    <RoomShell spec={spec}>
      <Contents spec={spec} />
      {children}
    </RoomShell>
  )
}

