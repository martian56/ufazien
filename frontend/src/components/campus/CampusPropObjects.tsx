/**
 * The objects you can pick up, carry and throw.
 *
 * Drawn from two sources: where the server says a loose object came to rest,
 * and whose hand it is in when somebody is carrying it. Both arrive as state,
 * so this component only animates between them — the flight of a thrown object
 * is interpolation between the place it left and the place it landed, not a
 * simulation anybody could disagree about.
 */

import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import type { Group } from 'three'

import {
  CARRY_HEIGHT,
  THROW_SECONDS,
  throwArc,
  type PropSpec,
} from './campusProps'

export interface PropPlacement {
  spec: PropSpec
  /** Where it is now, in world coordinates. */
  x: number
  z: number
  /** Height above the floor: resting on it, or held at hand height. */
  y: number
  /** True while somebody is carrying it, which suppresses the throw arc. */
  carried: boolean
}

/**
 * One object.
 *
 * The arc is driven from the mesh's own last position rather than from a
 * launch point in state: a client that joins mid-flight has no launch point,
 * and one that misses the release frame would otherwise never animate at all.
 */
function PropObject({ placement }: { placement: PropPlacement }) {
  const group = useRef<Group>(null)
  const from = useRef<{ x: number; y: number; z: number } | null>(null)
  const elapsed = useRef(0)
  const target = useRef({ x: placement.x, y: placement.y, z: placement.z })

  useFrame((_, delta) => {
    if (!group.current) return

    const wanted = { x: placement.x, y: placement.y, z: placement.z }
    const moved =
      Math.abs(wanted.x - target.current.x) > 1e-4 ||
      Math.abs(wanted.z - target.current.z) > 1e-4 ||
      Math.abs(wanted.y - target.current.y) > 1e-4

    if (moved) {
      target.current = wanted
      // A carried object follows the hand, so it must not arc: only a thrown
      // one leaves from somewhere and arrives somewhere else.
      if (placement.carried) {
        from.current = null
        elapsed.current = 0
      } else {
        from.current = {
          x: group.current.position.x,
          y: group.current.position.y,
          z: group.current.position.z,
        }
        elapsed.current = 0
      }
    }

    if (from.current) {
      elapsed.current += delta
      const t = elapsed.current / THROW_SECONDS
      const at = throwArc(from.current, target.current, t)
      group.current.position.set(at.x, at.y, at.z)
      // Spin while in the air, which is most of what makes a throw read as one.
      group.current.rotation.x += delta * 7
      if (t >= 1) from.current = null
      return
    }

    group.current.position.set(target.current.x, target.current.y, target.current.z)
    group.current.rotation.x = 0
  })

  return (
    <group ref={group} position={[placement.x, placement.y, placement.z]}>
      <PropMesh spec={placement.spec} />
    </group>
  )
}

function PropMesh({ spec }: { spec: PropSpec }) {
  switch (spec.kind) {
    case 'ball':
      return (
        <mesh castShadow>
          <sphereGeometry args={[spec.radius, 20, 16]} />
          <meshStandardMaterial color="#d1662b" roughness={0.85} />
        </mesh>
      )
    case 'frisbee':
      return (
        <mesh castShadow rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[spec.radius, spec.radius * 0.92, 0.05, 24]} />
          <meshStandardMaterial color="#4fb3a4" roughness={0.5} />
        </mesh>
      )
    case 'book':
      return (
        <mesh castShadow>
          <boxGeometry args={[spec.radius * 1.4, spec.radius * 0.4, spec.radius * 2]} />
          <meshStandardMaterial color="#7a4b2a" roughness={0.9} />
        </mesh>
      )
    case 'cup':
      return (
        <mesh castShadow>
          <cylinderGeometry args={[spec.radius, spec.radius * 0.78, spec.radius * 2.1, 16]} />
          <meshStandardMaterial color="#f2ede4" roughness={0.7} />
        </mesh>
      )
    default:
      return null
  }
}

export default function CampusPropObjects({
  placements,
}: {
  placements: readonly PropPlacement[]
}) {
  return (
    <>
      {placements.map((placement) => (
        <PropObject key={placement.spec.id} placement={placement} />
      ))}
    </>
  )
}

export { CARRY_HEIGHT }
