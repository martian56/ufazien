import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

/**
 * A flag that moves.
 *
 * The flags on the campus were single-quad planes: rigid rectangles held out
 * from their poles, which reads as a signboard rather than as cloth. This is
 * the same rectangle cut into a grid and pushed about per frame by a travelling
 * wave, so it ripples along its length and hangs slack at the fly.
 *
 * The displacement is applied on the CPU rather than in a shader. It is a few
 * hundred vertices twice a scene, the geometry is not shared with anything, and
 * a vertex shader here would mean either patching a standard material's
 * `onBeforeCompile` or losing lighting — both a worse trade than this arithmetic
 * at sixty frames a second.
 */
export default function WavingFlag({
  width,
  height,
  texture,
  color,
  /** How hard the wind blows: scales both the ripple and the sag. */
  wind = 1,
  /** Offsets the wave so two flags on the same pole do not move as one. */
  phase = 0,
  segments = 24,
}: {
  width: number
  height: number
  texture?: THREE.Texture | null
  color?: string
  wind?: number
  phase?: number
  segments?: number
}) {
  const mesh = useRef<THREE.Mesh>(null)

  // The flat cloth, kept so the wave is always computed from the rest shape.
  // Reading the live positions and adding to them compounds every frame, and
  // the flag tears itself apart within seconds.
  const geometry = useMemo(
    () => new THREE.PlaneGeometry(width, height, segments, Math.max(2, Math.round(segments / 2))),
    [width, height, segments],
  )
  const rest = useMemo(
    () => Float32Array.from(geometry.attributes.position.array),
    [geometry],
  )

  // The geometry is made here rather than declared as JSX, so nothing disposes
  // it when the flag goes. The interior flags mount and unmount every time a
  // player enters or leaves a room, and the buffers would pile up for the
  // length of a session.
  useEffect(() => () => geometry.dispose(), [geometry])

  useFrame(({ clock }) => {
    const target = mesh.current
    if (!target) return
    const position = target.geometry.attributes.position
    const time = clock.elapsedTime * 2.4 + phase

    for (let i = 0; i < position.count; i += 1) {
      const x = rest[i * 3]
      const y = rest[i * 3 + 1]

      // Nothing moves at the hoist and everything moves at the fly, which is
      // what being nailed to a pole at one edge means. Squared, so the first
      // hand's width stays near enough still rather than shearing away.
      const along = (x + width / 2) / width
      const grip = along * along

      const wave = Math.sin(along * 7 - time) * 0.14 + Math.sin(along * 4.3 - time * 0.7 + y * 2) * 0.06

      position.setZ(i, wave * grip * wind)
      // Cloth pulled into a wave is shorter than cloth laid flat, and it also
      // droops towards the fly. Without this the flag visibly stretches.
      position.setX(i, x - grip * wind * 0.06)
      position.setY(i, y - grip * wind * 0.05 * (1 - Math.abs(y) / (height / 2 + 1e-6)))
    }
    position.needsUpdate = true
    target.geometry.computeVertexNormals()
  })

  return (
    <mesh ref={mesh} geometry={geometry} castShadow>
      <meshStandardMaterial
        map={texture ?? undefined}
        color={texture ? undefined : color}
        side={THREE.DoubleSide}
        roughness={0.82}
      />
    </mesh>
  )
}
