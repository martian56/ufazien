import { useLayoutEffect, useMemo, useRef } from 'react'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'

/**
 * One model, drawn many times, in as few draw calls as it has materials.
 *
 * The rule this project works to is that anything repeated is instanced or it
 * does not ship. Outdoors that was already true of the drawn trees; indoors it
 * was not true of anything — the cafeteria drew sixteen tables and sixty-four
 * chairs as sixteen groups of five objects, which is where the interior's draw
 * calls went.
 *
 * A model becomes one `InstancedMesh` per primitive, and a primitive is one
 * material. So a two-colour chair repeated sixty-four times is two draw calls,
 * and adding the sixty-fifth is free.
 *
 * The matrices are written once in a layout effect. These do not move.
 */

const dummy = new THREE.Object3D()

export interface Placement {
  x: number
  y?: number
  z: number
  /** Turn about Y, in radians. */
  ry?: number
  scale?: number
}

export default function InstancedModel({
  url,
  placements,
  height,
  onGround = true,
}: {
  url: string
  placements: Placement[]
  /**
   * Scale the model to this height in metres, if given.
   *
   * The packs do not agree on scale — a nature tree is about two units tall
   * and a campus tree is eight — so this is a fit and not a decoration. Left
   * out, the model is used at the size it was made.
   */
  height?: number
  /**
   * Sit the model's own base on `y`.
   *
   * The packs do not agree on where a model's origin is either, and a chair
   * whose origin is at seat height is a chair buried to the seat. Off for
   * anything positioned by its middle.
   */
  onGround?: boolean
}) {
  const { scene } = useGLTF(url)

  const parts = useMemo(() => {
    const meshes: { geometry: THREE.BufferGeometry; material: THREE.Material }[] = []
    scene.traverse((node) => {
      if ((node as THREE.Mesh).isMesh) {
        const mesh = node as THREE.Mesh
        meshes.push({
          geometry: mesh.geometry,
          material: Array.isArray(mesh.material) ? mesh.material[0] : mesh.material,
        })
      }
    })

    const box = new THREE.Box3().setFromObject(scene)
    const size = new THREE.Vector3()
    box.getSize(size)
    // Guard the degenerate case rather than dividing by zero and scattering
    // infinitely large furniture across the room.
    const unit = height && size.y > 1e-6 ? height / size.y : 1

    return { meshes, unit, footY: box.min.y }
  }, [scene, height])

  const refs = useRef<(THREE.InstancedMesh | null)[]>([])

  useLayoutEffect(() => {
    for (const mesh of refs.current) {
      if (!mesh) continue
      placements.forEach((placement, i) => {
        const scale = parts.unit * (placement.scale ?? 1)
        const base = placement.y ?? 0
        dummy.position.set(
          placement.x,
          onGround ? base - parts.footY * scale : base,
          placement.z,
        )
        dummy.rotation.set(0, placement.ry ?? 0, 0)
        dummy.scale.setScalar(scale)
        dummy.updateMatrix()
        mesh.setMatrixAt(i, dummy.matrix)
      })
      mesh.instanceMatrix.needsUpdate = true
      mesh.computeBoundingSphere()
    }
  }, [placements, parts, onGround])

  if (placements.length === 0) return null

  return (
    <group>
      {parts.meshes.map((part, index) => (
        <instancedMesh
          key={index}
          ref={(mesh) => {
            refs.current[index] = mesh
          }}
          args={[part.geometry, part.material, placements.length]}
          castShadow
          receiveShadow
        />
      ))}
    </group>
  )
}
