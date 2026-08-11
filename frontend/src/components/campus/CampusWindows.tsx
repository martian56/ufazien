import { useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'

import { windowTexture } from './campusTextures'
import { splitLitWindows, type WindowKind, type WindowPlacement } from './windowLighting'

export type { WindowKind, WindowPlacement }

/**
 * Instanced windows.
 *
 * Its own module because both the generic `Building` and the UFAZ landmark
 * need it, and having one import the other would be a cycle. The lit/dark
 * split, and why there is one, lives in `windowLighting.ts`.
 */

const dummy = new THREE.Object3D()

function Instances({
  items,
  kind,
  wall,
  size,
  glow,
}: {
  items: WindowPlacement[]
  kind: WindowKind
  wall: string
  size: [number, number]
  glow: number
}) {
  const mesh = useRef<THREE.InstancedMesh>(null)
  const texture = windowTexture(kind, wall)

  useLayoutEffect(() => {
    const target = mesh.current
    if (!target) return
    items.forEach((item, i) => {
      dummy.position.set(item.x, item.y, item.z)
      dummy.rotation.set(0, item.ry, 0)
      dummy.scale.set(1, 1, 1)
      dummy.updateMatrix()
      target.setMatrixAt(i, dummy.matrix)
    })
    target.instanceMatrix.needsUpdate = true
    target.computeBoundingSphere()
  }, [items])

  if (!items.length) return null

  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, items.length]} receiveShadow>
      <planeGeometry args={size} />
      <meshStandardMaterial
        map={texture ?? undefined}
        color={texture ? '#ffffff' : '#5d7f9e'}
        emissive="#ffc266"
        // The lit half keeps its glass texture under the glow rather than
        // washing out to a flat rectangle.
        emissiveIntensity={glow}
        emissiveMap={glow > 0 ? (texture ?? undefined) : undefined}
        roughness={0.22}
        metalness={0.15}
      />
    </instancedMesh>
  )
}

export default function CampusWindows({
  items,
  kind,
  wall,
  size,
  lit,
  seed,
}: {
  items: WindowPlacement[]
  kind: WindowKind
  wall: string
  size: [number, number]
  lit: boolean
  seed: number
}) {
  const { onItems, offItems } = useMemo(() => splitLitWindows(items, lit, seed), [items, lit, seed])

  return (
    <>
      <Instances items={offItems} kind={kind} wall={wall} size={size} glow={0} />
      <Instances items={onItems} kind={kind} wall={wall} size={size} glow={2.6} />
    </>
  )
}
