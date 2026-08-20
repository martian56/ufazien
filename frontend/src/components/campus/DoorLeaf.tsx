import { useLayoutEffect, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Group, MathUtils } from 'three'

import { DOOR_SWING } from './doorState'

/**
 * A door you can see, and see swing.
 *
 * The openings used to be holes: a gap in the collider with nothing in it, so
 * there was no door to look at from outside and nothing at all from inside a
 * room, where the way out was an invisible line on the floor.
 *
 * Two leaves hinged at the jambs rather than one slab, because a double door
 * is what a building this size has, and because two leaves swinging apart
 * reads as opening from any angle. One slab pivoting on a corner only reads
 * from the side.
 */
export default function DoorLeaf({
  x,
  z,
  halfWidth,
  height = 4.4,
  sill = 0,
  swing,
  /** Which way the leaves swing away from the player. */
  facing = 1,
  glazed = false,
}: {
  x: number
  z: number
  halfWidth: number
  height?: number
  /** How far the threshold sits above the floor, so the leaf stands on it. */
  sill?: number
  /** 0 shut, 1 fully open. */
  swing: number
  facing?: 1 | -1
  /**
   * Glazed over most of the leaf, in small panes, with a solid panel at the
   * foot. The front door of the main building is like this; the doors off the
   * corridors inside are not, so it is off by default.
   */
  glazed?: boolean
}) {
  const left = useRef<Group>(null)
  const right = useRef<Group>(null)
  const placed = useRef(false)

  // Seeded once, for the same reason the target below carries the half-turn:
  // the first frame would otherwise lerp up from zero and the door would be
  // seen to assemble itself.
  //
  // In a layout effect rather than the render body. React attaches refs during
  // commit, so on the first render both were still null, the guard failed, and
  // `placed` stayed false — by the time the refs existed `useFrame` had already
  // lerped the leaves up from zero, which is the exact artefact this prevents.
  // It also mutated refs during render, which Strict Mode runs twice.
  useLayoutEffect(() => {
    if (placed.current || !left.current || !right.current) return
    placed.current = true
    left.current.rotation.y = -DOOR_SWING * swing * facing
    right.current.rotation.y = Math.PI + DOOR_SWING * swing * facing
    // Mount only: every later change is what the lerp is for.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useFrame(() => {
    // Driven per frame rather than through React state: the swing changes
    // every frame while a door moves, and re-rendering the scene graph for it
    // would cost far more than setting two rotations.
    const angle = DOOR_SWING * swing * facing
    if (left.current) left.current.rotation.y = MathUtils.lerp(left.current.rotation.y, -angle, 0.35)
    // The right leaf is mounted turned about, so that the same panel geometry
    // extends back across the opening from the far jamb. Its half-turn has to
    // be part of the target here, not a declarative `rotation` prop: r3f
    // writes array props straight onto the object, so the prop set the base
    // angle once and this line then drove it to zero — which swung the leaf
    // out of the doorway and into the pier, leaving the right half of every
    // shut door standing open.
    if (right.current) {
      right.current.rotation.y = MathUtils.lerp(right.current.rotation.y, Math.PI + angle, 0.35)
    }
  })

  const leafWidth = halfWidth
  // Where the glazing starts on a glazed leaf: a solid panel at the foot, the
  // rest glass in small panes.
  const panelTop = height * 0.28
  const columns = 2
  const rows = 4

  const panel = (
    <>
      {glazed ? (
        <>
          {/* The stiles and rails, as a frame rather than a slab, so the
              glazing is a hole in the leaf and not a sticker on it. */}
          <mesh position={[leafWidth / 2, panelTop / 2, 0]} castShadow>
            <boxGeometry args={[leafWidth, panelTop, 0.12]} />
            <meshStandardMaterial color="#5a4632" roughness={0.55} metalness={0.12} />
          </mesh>
          {[0.06, leafWidth - 0.06].map((sx) => (
            <mesh key={sx} position={[sx, (panelTop + height) / 2, 0]} castShadow>
              <boxGeometry args={[0.12, height - panelTop, 0.12]} />
              <meshStandardMaterial color="#5a4632" roughness={0.55} metalness={0.12} />
            </mesh>
          ))}
          <mesh position={[leafWidth / 2, height - 0.06, 0]} castShadow>
            <boxGeometry args={[leafWidth, 0.12, 0.12]} />
            <meshStandardMaterial color="#5a4632" roughness={0.55} metalness={0.12} />
          </mesh>

          {/* The glass. */}
          <mesh position={[leafWidth / 2, (panelTop + height) / 2, 0]}>
            <boxGeometry args={[leafWidth - 0.12, height - panelTop - 0.12, 0.03]} />
            <meshStandardMaterial
              color="#b9d9ef"
              roughness={0.12}
              metalness={0.3}
              transparent
              opacity={0.5}
            />
          </mesh>

          {/* The glazing bars that make it small panes rather than one sheet. */}
          {Array.from({ length: columns - 1 }, (_, i) => (
            <mesh
              key={`c${i}`}
              position={[(leafWidth * (i + 1)) / columns, (panelTop + height) / 2, 0]}
            >
              <boxGeometry args={[0.05, height - panelTop, 0.14]} />
              <meshStandardMaterial color="#4a3421" roughness={0.6} />
            </mesh>
          ))}
          {Array.from({ length: rows - 1 }, (_, i) => (
            <mesh
              key={`r${i}`}
              position={[leafWidth / 2, panelTop + ((height - panelTop) * (i + 1)) / rows, 0]}
            >
              <boxGeometry args={[leafWidth, 0.05, 0.14]} />
              <meshStandardMaterial color="#4a3421" roughness={0.6} />
            </mesh>
          ))}
        </>
      ) : (
        <>
          <mesh position={[leafWidth / 2, height / 2, 0]} castShadow>
            <boxGeometry args={[leafWidth, height, 0.12]} />
            <meshStandardMaterial color="#5a4632" roughness={0.55} metalness={0.12} />
          </mesh>
          {/* A glazed upper panel, so a lit room shows through a shut door. On
              both faces: the right leaf is mounted turned about, so a panel on
              one side only showed the outside world a blank slab. */}
          {[0.07, -0.07].map((face) => (
            <mesh key={face} position={[leafWidth / 2, height * 0.68, face]}>
              <boxGeometry args={[leafWidth * 0.62, height * 0.34, 0.02]} />
              <meshStandardMaterial
                color="#9fd6ff"
                roughness={0.15}
                metalness={0.35}
                transparent
                opacity={0.55}
              />
            </mesh>
          ))}
        </>
      )}
      {/* The handle, which is the thing that tells you it opens at all. */}
      {[0.1, -0.1].map((face) => (
        <mesh key={face} position={[leafWidth * 0.88, height * 0.44, face]}>
          <boxGeometry args={[0.1, 0.5, 0.08]} />
          <meshStandardMaterial color="#c9a227" roughness={0.3} metalness={0.8} />
        </mesh>
      ))}
    </>
  )

  return (
    <group position={[x, sill, z]}>
      {/* Hinged at the jambs: each group sits at its own edge of the opening
          and the panel extends inwards from there, so rotating the group
          swings the leaf about the hinge rather than about its middle. */}
      <group ref={left} position={[-halfWidth, 0, 0]}>
        {panel}
      </group>
      <group ref={right} position={[halfWidth, 0, 0]}>
        {panel}
      </group>
    </group>
  )
}
