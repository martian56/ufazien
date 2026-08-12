import { useRef } from 'react'
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
  swing,
  /** Which way the leaves swing away from the player. */
  facing = 1,
}: {
  x: number
  z: number
  halfWidth: number
  height?: number
  /** 0 shut, 1 fully open. */
  swing: number
  facing?: 1 | -1
}) {
  const left = useRef<Group>(null)
  const right = useRef<Group>(null)

  useFrame(() => {
    // Driven per frame rather than through React state: the swing changes
    // every frame while a door moves, and re-rendering the scene graph for it
    // would cost far more than setting two rotations.
    const angle = DOOR_SWING * swing * facing
    if (left.current) left.current.rotation.y = MathUtils.lerp(left.current.rotation.y, -angle, 0.35)
    if (right.current) right.current.rotation.y = MathUtils.lerp(right.current.rotation.y, angle, 0.35)
  })

  const leafWidth = halfWidth
  const panel = (
    <>
      <mesh position={[leafWidth / 2, height / 2, 0]} castShadow>
        <boxGeometry args={[leafWidth, height, 0.12]} />
        <meshStandardMaterial color="#5a4632" roughness={0.55} metalness={0.12} />
      </mesh>
      {/* A glazed upper panel, so a lit room shows through a shut door. */}
      <mesh position={[leafWidth / 2, height * 0.68, 0.07]}>
        <boxGeometry args={[leafWidth * 0.62, height * 0.34, 0.02]} />
        <meshStandardMaterial
          color="#9fd6ff"
          roughness={0.15}
          metalness={0.35}
          transparent
          opacity={0.55}
        />
      </mesh>
      {/* The handle, which is the thing that tells you it opens at all. */}
      <mesh position={[leafWidth * 0.88, height * 0.44, 0.1]}>
        <boxGeometry args={[0.1, 0.5, 0.08]} />
        <meshStandardMaterial color="#c9a227" roughness={0.3} metalness={0.8} />
      </mesh>
    </>
  )

  return (
    <group position={[x, 0, z]}>
      {/* Hinged at the jambs: each group sits at its own edge of the opening
          and the panel extends inwards from there, so rotating the group
          swings the leaf about the hinge rather than about its middle. */}
      <group ref={left} position={[-halfWidth, 0, 0]}>
        {panel}
      </group>
      <group ref={right} position={[halfWidth, 0, 0]} rotation={[0, Math.PI, 0]}>
        {panel}
      </group>
    </group>
  )
}
