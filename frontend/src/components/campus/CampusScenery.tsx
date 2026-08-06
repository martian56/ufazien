import { useMemo, useRef } from "react"
import { useFrame } from "@react-three/fiber"
import { Html, Sky } from "@react-three/drei"
import * as THREE from "three"

/**
 * Procedural campus scenery.
 *
 * Everything here is generated rather than loaded, so it costs no download and
 * stays editable in code. Repeated geometry (windows, trees, lamps) is drawn
 * with instanced meshes: a building with 60 windows is one draw call, not 60.
 */

const WINDOW_LIT = new THREE.Color("#ffd98a")
const WINDOW_DARK = new THREE.Color("#2d3f52")

/**
 * A three-component position. r3f accepts a plain number[] at runtime but its
 * types want a fixed-length tuple, and a `number[]` silently loses the length.
 */
type Vec3 = [number, number, number]

/** Sky, light and fog. Replaces a flat ambient + single directional setup. */
export function CampusEnvironment({ timeOfDay = "day" }: { timeOfDay?: string }) {
  const light = useRef<THREE.DirectionalLight>(null)

  const config = useMemo(() => {
    // `bounce` is the ground half of the hemisphere light. It was a dark
    // olive at low intensity, so anything facing away from the sun received
    // almost nothing and read as black rather than as its own colour: a brick
    // building in shadow was a silhouette.
    if (timeOfDay === "dusk") {
      return {
        sun: [30, 8, -60] as Vec3, intensity: 1.1, ambient: 0.85,
        sky: "#9fb6d4", bounce: "#5d5647", tint: "#ffb37a", fog: "#c98a6b",
        fill: 0.25,
      }
    }
    return {
      sun: [80, 40, 40] as Vec3, intensity: 1.6, ambient: 1.15,
      sky: "#cfe4f7", bounce: "#8a9179", tint: "#fff6e5", fog: "#cfe3f0",
      fill: 0.35,
    }
  }, [timeOfDay])

  return (
    <>
      <Sky sunPosition={config.sun} turbidity={6} rayleigh={1.2} />
      {/* Depth cue so distant buildings recede instead of popping. */}
      <fog attach="fog" args={[config.fog, 60, 260]} />

      {/* Sky/ground bounce, which a single ambient term cannot express. */}
      <hemisphereLight args={[config.sky, config.bounce, config.ambient]} />

      {/* Fill from the opposite side, so shadowed faces keep their colour.
          It casts nothing: shadows stay the sun's to draw. */}
      <directionalLight
        position={[-config.sun[0], config.sun[1] * 0.6, -config.sun[2]]}
        intensity={config.fill}
        color="#cfe0f2"
      />

      <directionalLight
        ref={light}
        position={config.sun}
        intensity={config.intensity}
        color={config.tint}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0004}
        // Default shadow frustum is tiny; without this the campus has no shadows.
        shadow-camera-left={-140}
        shadow-camera-right={140}
        shadow-camera-top={140}
        shadow-camera-bottom={-140}
        shadow-camera-near={1}
        shadow-camera-far={400}
      />
    </>
  )
}

/** Ground with paths, rather than one flat green plane. */
export function CampusGround({ size = 300 }) {
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[size, size]} />
        <meshStandardMaterial color="#3f6b3a" roughness={1} />
      </mesh>

      {/* Two crossing paths so the space reads as a campus, not a field. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]} receiveShadow>
        <planeGeometry args={[14, size]} />
        <meshStandardMaterial color="#b9ae97" roughness={0.95} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, Math.PI / 2]} position={[0, 0.02, 0]} receiveShadow>
        <planeGeometry args={[14, size]} />
        <meshStandardMaterial color="#b9ae97" roughness={0.95} />
      </mesh>

      {/* Central quad. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]} receiveShadow>
        <circleGeometry args={[16, 48]} />
        <meshStandardMaterial color="#a8b98a" roughness={0.9} />
      </mesh>
    </group>
  )
}

/**
 * A building with a facade rather than a painted box: floor bands, a recessed
 * entrance, a roof lip, and instanced windows that light up at dusk.
 */
interface BuildingProps {
  position?: Vec3
  size?: Vec3
  color?: string
  name?: string
  icon?: string
  timeOfDay?: string
  onEnter?: () => void
  canEnter?: boolean
}

export function Building({
  position = [0, 0, 0],
  size = [14, 12, 10],
  color = "#9aa4b1",
  name,
  icon,
  timeOfDay = "day",
  onEnter,
  canEnter = true,
}: BuildingProps) {
  const [width, height, depth] = size
  const floors = Math.max(2, Math.round(height / 3.2))

  // One instanced mesh for every window on the building.
  const windows = useMemo(() => {
    const perRow = Math.max(2, Math.floor(width / 2.6))
    const items: { x: number; y: number; z: number; ry: number }[] = []
    for (let floor = 1; floor <= floors; floor++) {
      const y = (height / (floors + 1)) * floor
      for (let i = 0; i < perRow; i++) {
        const x = -width / 2 + (width / (perRow + 1)) * (i + 1)
        items.push({ x, y, z: depth / 2 + 0.06, ry: 0 })
        items.push({ x, y, z: -depth / 2 - 0.06, ry: Math.PI })
      }
    }
    return items
  }, [width, height, depth, floors])

  const meshRef = useRef<THREE.InstancedMesh>(null)

  useFrame(() => {
    const mesh = meshRef.current
    if (!mesh || mesh.userData.done) return
    const dummy = new THREE.Object3D()
    windows.forEach((w, i) => {
      dummy.position.set(w.x, w.y, w.z)
      dummy.rotation.set(0, w.ry, 0)
      dummy.updateMatrix()
      mesh.setMatrixAt(i, dummy.matrix)
      // Deterministic per-window so lit windows don't flicker between frames.
      const lit = timeOfDay === "dusk" && (i * 2654435761) % 3 !== 0
      mesh.setColorAt(i, lit ? WINDOW_LIT : WINDOW_DARK)
    })
    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
    mesh.userData.done = true
  })

  return (
    <group position={position}>
      {/* Main mass */}
      <mesh castShadow receiveShadow position={[0, height / 2, 0]}>
        <boxGeometry args={[width, height, depth]} />
        <meshStandardMaterial color={color} roughness={0.85} metalness={0.05} />
      </mesh>

      {/* Roof lip, so the silhouette is not a bare cuboid */}
      <mesh castShadow position={[0, height + 0.35, 0]}>
        <boxGeometry args={[width + 0.8, 0.7, depth + 0.8]} />
        <meshStandardMaterial color="#5c6472" roughness={0.9} />
      </mesh>

      {/* Ground-floor plinth */}
      <mesh receiveShadow position={[0, 0.4, 0]}>
        <boxGeometry args={[width + 0.5, 0.8, depth + 0.5]} />
        <meshStandardMaterial color="#7b8496" roughness={0.95} />
      </mesh>

      <instancedMesh
        ref={meshRef}
        args={[undefined, undefined, windows.length]}
        castShadow={false}
      >
        <planeGeometry args={[1.1, 1.5]} />
        <meshStandardMaterial
          emissiveIntensity={timeOfDay === "dusk" ? 0.9 : 0.05}
          emissive="#ffd98a"
          roughness={0.25}
          metalness={0.1}
          toneMapped={false}
        />
      </instancedMesh>

      {/* Recessed entrance on the +Z face */}
      <group position={[0, 0, depth / 2 + 0.05]}>
        <mesh position={[0, 1.6, 0]}>
          <boxGeometry args={[3.4, 3.2, 0.3]} />
          <meshStandardMaterial color="#33404f" roughness={0.6} metalness={0.2} />
        </mesh>
        <mesh position={[0, 1.5, 0.18]}>
          <boxGeometry args={[2.6, 2.8, 0.1]} />
          <meshStandardMaterial
            color="#8fd0ff"
            roughness={0.1}
            metalness={0.4}
            transparent
            opacity={0.65}
          />
        </mesh>

        {canEnter && (
          <Html position={[0, 3.6, 0]} center distanceFactor={18} zIndexRange={[9, 0]}>
            <button
              onClick={(e) => {
                e.stopPropagation()
                onEnter?.()
              }}
              className="px-2 py-1 rounded bg-blue-600/90 hover:bg-blue-500 text-white text-xs whitespace-nowrap"
            >
              Enter {name} (E)
            </button>
          </Html>
        )}
      </group>

      {name && (
        <Html position={[0, height + 2, 0]} center distanceFactor={26} zIndexRange={[9, 0]}>
          <div className="bg-black/70 text-white px-3 py-1 rounded text-sm whitespace-nowrap pointer-events-none">
            {icon} {name}
          </div>
        </Html>
      )}
    </group>
  )
}

/** Trees, lamps and benches as instanced meshes. */
export function CampusProps({
  count = 26,
  radius = 120,
  timeOfDay = "day",
}: {
  count?: number
  radius?: number
  timeOfDay?: string
}) {
  const trunks = useRef<THREE.InstancedMesh>(null)
  const canopies = useRef<THREE.InstancedMesh>(null)

  const layout = useMemo(() => {
    // Deterministic layout: a re-render must not teleport the scenery.
    const items: { x: number; z: number; scale: number }[] = []
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2 + (i % 3) * 0.35
      const distance = 40 + ((i * 37) % (radius - 40))
      items.push({
        x: Math.cos(angle) * distance,
        z: Math.sin(angle) * distance,
        scale: 0.8 + ((i * 13) % 7) / 10,
      })
    }
    // Keep the crossing paths clear.
    return items.filter((t) => Math.abs(t.x) > 10 && Math.abs(t.z) > 10)
  }, [count, radius])

  useFrame(() => {
    // Tuples, not a plain array: inference otherwise widens the element type
    // to the union of a ref and a number, and `yOffset * t.scale` stops
    // typechecking.
    const parts: [React.RefObject<THREE.InstancedMesh | null>, number, number][] = [
      [trunks, 1.6, 1],
      [canopies, 4.2, 1],
    ]
    for (const [ref, yOffset, scaleAxis] of parts) {
      const mesh = ref.current
      if (!mesh || mesh.userData.done) continue
      const dummy = new THREE.Object3D()
      layout.forEach((t, i) => {
        dummy.position.set(t.x, yOffset * t.scale, t.z)
        dummy.scale.setScalar(t.scale * scaleAxis)
        dummy.updateMatrix()
        mesh.setMatrixAt(i, dummy.matrix)
      })
      mesh.instanceMatrix.needsUpdate = true
      mesh.userData.done = true
    }
  })

  return (
    <group>
      <instancedMesh ref={trunks} args={[undefined, undefined, layout.length]} castShadow>
        <cylinderGeometry args={[0.28, 0.38, 3.2, 6]} />
        <meshStandardMaterial color="#5b432c" roughness={1} />
      </instancedMesh>

      <instancedMesh ref={canopies} args={[undefined, undefined, layout.length]} castShadow>
        <icosahedronGeometry args={[2.4, 0]} />
        <meshStandardMaterial color={timeOfDay === "dusk" ? "#26401f" : "#3f7a34"} roughness={1} flatShading />
      </instancedMesh>
    </group>
  )
}

/** Desks, chairs, a podium and a board frame, so the room is not a bare box. */
function LectureRoomFurniture() {
  const rows = [-6, -1, 4, 9]
  const columns = [-10, -5, 5, 10]

  return (
    <group>
      {/* Board frame on the far wall, behind whatever screen share is mounted */}
      <mesh position={[0, 5, -19.6]} receiveShadow>
        <boxGeometry args={[24, 10, 0.3]} />
        <meshStandardMaterial color="#1f2733" roughness={0.6} />
      </mesh>

      {/* Podium */}
      <group position={[-9, 0, -15]}>
        <mesh castShadow position={[0, 0.55, 0]}>
          <boxGeometry args={[1.6, 1.1, 0.9]} />
          <meshStandardMaterial color="#6b4f34" roughness={0.8} />
        </mesh>
        <mesh castShadow position={[0, 1.15, 0]} rotation={[-0.3, 0, 0]}>
          <boxGeometry args={[1.7, 0.08, 0.9]} />
          <meshStandardMaterial color="#7d5c3d" roughness={0.75} />
        </mesh>
      </group>

      {rows.map((z) =>
        columns.map((x) => (
          <group key={`${x}-${z}`} position={[x, 0, z]}>
            {/* Desk top */}
            <mesh castShadow receiveShadow position={[0, 0.75, 0]}>
              <boxGeometry args={[3.4, 0.12, 1.2]} />
              <meshStandardMaterial color="#8a6742" roughness={0.8} />
            </mesh>
            {/* Legs */}
            {[[-1.5, -0.45], [1.5, -0.45], [-1.5, 0.45], [1.5, 0.45]].map(([lx, lz], i) => (
              <mesh key={i} castShadow position={[lx, 0.38, lz]}>
                <cylinderGeometry args={[0.06, 0.06, 0.75, 6]} />
                <meshStandardMaterial color="#4a4f57" roughness={0.7} metalness={0.3} />
              </mesh>
            ))}
            {/* Two chairs per desk */}
            {[-0.85, 0.85].map((cx) => (
              <group key={cx} position={[cx, 0, 1.1]}>
                <mesh castShadow position={[0, 0.45, 0]}>
                  <boxGeometry args={[0.7, 0.08, 0.7]} />
                  <meshStandardMaterial color="#3f5b7a" roughness={0.85} />
                </mesh>
                <mesh castShadow position={[0, 0.8, 0.31]}>
                  <boxGeometry args={[0.7, 0.7, 0.08]} />
                  <meshStandardMaterial color="#3f5b7a" roughness={0.85} />
                </mesh>
              </group>
            ))}
          </group>
        )),
      )}
    </group>
  )
}

/**
 * Interior shown when a player enters a building. A simple lit room with a
 * lecture board, so entering leads somewhere rather than being a no-op.
 */
export function BuildingInterior({
  children,
}: {
  children?: React.ReactNode
}) {
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[40, 40]} />
        <meshStandardMaterial color="#8d8577" roughness={0.9} />
      </mesh>

      {/* Walls */}
      {([
        [0, 5, -20, 0],
        [0, 5, 20, Math.PI],
        [-20, 5, 0, Math.PI / 2],
        [20, 5, 0, -Math.PI / 2],
      ] as [number, number, number, number][]).map(([x, y, z, ry], i) => (
        <mesh key={i} position={[x, y, z]} rotation={[0, ry, 0]} receiveShadow>
          <planeGeometry args={[40, 10]} />
          <meshStandardMaterial color="#cfc7b8" roughness={0.95} side={THREE.DoubleSide} />
        </mesh>
      ))}

      <mesh position={[0, 10, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <planeGeometry args={[40, 40]} />
        <meshStandardMaterial color="#e8e3d8" roughness={1} side={THREE.DoubleSide} />
      </mesh>

      <ambientLight intensity={0.7} />
      <pointLight position={[0, 8, 0]} intensity={80} distance={45} castShadow />
      <pointLight position={[-12, 7, -12]} intensity={30} distance={30} />
      <pointLight position={[12, 7, 12]} intensity={30} distance={30} />

      <LectureRoomFurniture />

      {children}

      {/* No name plate in the scene. It landed on the projector screen, and the
          page already shows which building you are inside.

          The way out is a fixed overlay in the page too, not an Html marker:
          the player spawns facing the board, so anything placed behind them is
          off screen and they cannot find it. */}
    </group>
  )
}

/** Better character: capsule torso, head, arms and legs, and it casts a shadow. */
export function CharacterModel({
  color = "#4F46E5",
  isMoving = false,
  direction = "down",
}: {
  color?: string
  isMoving?: boolean
  direction?: string
}) {
  const legs = useRef<THREE.Group>(null)

  useFrame((state) => {
    if (!legs.current) return
    // Simple walk cycle; still cheap, but remote players stop looking static.
    const t = state.clock.elapsedTime * 9
    const swing = isMoving ? Math.sin(t) * 0.5 : 0
    legs.current.children.forEach((leg, i) => {
      leg.rotation.x = i === 0 ? swing : -swing
    })
  })

  const facing =
    ({ down: 0, up: Math.PI, left: Math.PI / 2, right: -Math.PI / 2 } as Record<string, number>)[direction] ?? 0

  return (
    <group rotation={[0, facing, 0]}>
      <mesh castShadow position={[0, 1.05, 0]}>
        <capsuleGeometry args={[0.28, 0.5, 4, 12]} />
        <meshStandardMaterial color={color} roughness={0.7} />
      </mesh>

      <mesh castShadow position={[0, 1.6, 0]}>
        <sphereGeometry args={[0.23, 20, 16]} />
        <meshStandardMaterial color="#f2c4a8" roughness={0.8} />
      </mesh>

      {/* Hair, so heads are not featureless spheres */}
      <mesh position={[0, 1.7, -0.02]}>
        <sphereGeometry args={[0.235, 20, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color="#3a2b23" roughness={1} />
      </mesh>

      {[-0.36, 0.36].map((x) => (
        <mesh key={x} castShadow position={[x, 1.05, 0]} rotation={[0, 0, x > 0 ? -0.15 : 0.15]}>
          <capsuleGeometry args={[0.09, 0.42, 4, 8]} />
          <meshStandardMaterial color={color} roughness={0.7} />
        </mesh>
      ))}

      <group ref={legs} position={[0, 0.62, 0]}>
        {[-0.14, 0.14].map((x) => (
          <mesh key={x} castShadow position={[x, -0.3, 0]}>
            <capsuleGeometry args={[0.11, 0.4, 4, 8]} />
            <meshStandardMaterial color="#2f3a4a" roughness={0.85} />
          </mesh>
        ))}
      </group>
    </group>
  )
}
