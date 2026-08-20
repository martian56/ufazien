import { useLayoutEffect, useMemo, useRef } from 'react'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'

/**
 * The tree scatter, drawn from a model instead of from primitives.
 *
 * Built to sit beside `TreeVariant` rather than replace it outright, so the two
 * can be photographed from the same viewpoint and measured with the same probe
 * before anything is decided. That comparison is the whole point of doing one
 * tree first: the campus's own buildings are untextured flat colour and the
 * street outside is a surveyed OpenStreetMap footprint, and a model that looks
 * wrong between them is worth finding out about now rather than after sixty of
 * them are in.
 *
 * ## Instancing
 *
 * One `InstancedMesh` per primitive of the model, sharing one set of transforms.
 * The four species shipped carry 3, 4, 2 and 3 primitives, so the whole scatter
 * is twelve instanced meshes however many trees are in it — the drawn version
 * it replaced cost nine. Anything that does not instance does not ship; see
 * CLAUDE.md.
 *
 * The matrices are written once in a layout effect, not per frame. The scatter
 * is fixed for the life of the session.
 */

const dummy = new THREE.Object3D()

export interface ScatterItem {
  x: number
  z: number
  scale: number
  rotation: number
}

export default function ModelTrees({
  items,
  urls,
  /**
   * How tall the model is meant to be, in metres.
   *
   * The pack models a tree about two units tall and the campus's are nearer
   * eight, so this is a scale and not a decoration. Passed in rather than
   * measured so that swapping species does not silently resize the wood.
   */
  height = 8,
}: {
  items: ScatterItem[]
  /**
   * The species to scatter, in order.
   *
   * More than one because a wood of a single silhouette repeated a hundred and
   * fifty times reads as wallpaper — which is the same reason the procedural
   * trees had three colour variants. Items are dealt out between them.
   */
  urls: string[]
  height?: number
}) {

  return (
    <group>
      {urls.map((url, index) => (
        <SpeciesInstances
          key={url}
          url={url}
          height={height}
          // Dealt out round-robin. The scatter is already seeded and shuffled,
          // so taking every nth item spreads the species over the campus
          // rather than planting each in its own quarter.
          items={items.filter((_, i) => i % urls.length === index)}
        />
      ))}
    </group>
  )
}

/** One species, instanced across the points it was dealt. */
function SpeciesInstances({
  items,
  url,
  height,
}: {
  items: ScatterItem[]
  url: string
  height: number
}) {
  const { scene } = useGLTF(url)

  // The model's primitives, and the factor that takes it to campus scale.
  const parts = useMemo(() => {
    const found: { geometry: THREE.BufferGeometry; material: THREE.Material }[] = []
    scene.traverse((node) => {
      if ((node as THREE.Mesh).isMesh) {
        const mesh = node as THREE.Mesh
        found.push({
          geometry: mesh.geometry,
          material: Array.isArray(mesh.material) ? mesh.material[0] : mesh.material,
        })
      }
    })

    const box = new THREE.Box3().setFromObject(scene)
    const size = new THREE.Vector3()
    box.getSize(size)
    // Guard the degenerate case rather than dividing by zero and scattering a
    // hundred and fifty infinitely large trees across the campus.
    const unit = size.y > 1e-6 ? height / size.y : 1

    return { meshes: found, unit, footY: box.min.y }
  }, [scene, height])

  const refs = useRef<(THREE.InstancedMesh | null)[]>([])

  useLayoutEffect(() => {
    for (const mesh of refs.current) {
      if (!mesh) continue
      items.forEach((item, i) => {
        const scale = parts.unit * item.scale
        // Sit the model's own base on the ground: the pack does not agree with
        // itself about where a tree's origin is, and a species whose origin is
        // at the canopy would otherwise be planted upside down in the air.
        dummy.position.set(item.x, -parts.footY * scale, item.z)
        dummy.rotation.set(0, item.rotation, 0)
        dummy.scale.setScalar(scale)
        dummy.updateMatrix()
        mesh.setMatrixAt(i, dummy.matrix)
      })
      mesh.instanceMatrix.needsUpdate = true
      mesh.computeBoundingSphere()
    }
  }, [items, parts])

  if (items.length === 0) return null

  return (
    <group>
      {parts.meshes.map((part, index) => (
        <instancedMesh
          key={index}
          ref={(mesh) => {
            refs.current[index] = mesh
          }}
          args={[part.geometry, part.material, items.length]}
          castShadow
          receiveShadow
        />
      ))}
    </group>
  )
}
