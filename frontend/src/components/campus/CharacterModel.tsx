import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Detailed } from '@react-three/drei'
import * as THREE from 'three'

import { avatarLook, type AvatarLook } from './avatarAppearance'
import { faceTexture } from './campusTextures'

/**
 * A student.
 *
 * Two things drive the design. It has to read as a *person* — the old model was
 * a capsule, a bare sphere for a head and no face at all, which at any distance
 * was a coloured pill — and it has to survive a full lobby, which is twenty of
 * them on screen at once.
 *
 * ## How it stays cheap
 *
 * Geometry and materials are created once at module scope and shared by every
 * avatar in the scene. Written the obvious way, r3f builds a fresh
 * `SphereGeometry` and a fresh `MeshStandardMaterial` for every `<mesh>` in
 * every avatar — twenty students would allocate three hundred geometries and as
 * many materials, and every one of them is a separate GPU upload and a separate
 * shader compile.
 *
 * On top of that the whole model swaps for a simpler one with distance, so the
 * students across the quad cost four meshes rather than sixteen. You cannot see
 * a face at forty metres; there is no reason to be drawing one.
 */

/* ------------------------------------------------------------------ */
/* Shared resources                                                     */
/* ------------------------------------------------------------------ */

const GEO = {
  // Shoulders roughly two and a half heads wide. The first pass had a 0.46
  // head on a 0.54 torso, which is a toddler's proportions, and it showed.
  torso: new THREE.CapsuleGeometry(0.28, 0.52, 4, 14),
  hips: new THREE.CapsuleGeometry(0.235, 0.14, 4, 12),
  neck: new THREE.CylinderGeometry(0.085, 0.105, 0.14, 10),
  head: new THREE.SphereGeometry(0.21, 20, 16),
  face: new THREE.PlaneGeometry(0.28, 0.28),
  // Hair sits on the crown, not over the face. Swept to a hemisphere it
  // reached the equator of the head — which is eye level — and every student
  // looked like they were wearing a swimming cap.
  hairCap: new THREE.SphereGeometry(0.222, 20, 14, 0, Math.PI * 2, 0, Math.PI / 2.6),
  hairCrop: new THREE.SphereGeometry(0.224, 18, 12, 0, Math.PI * 2, 0, Math.PI / 3.2),
  hairBun: new THREE.SphereGeometry(0.105, 12, 10),
  arm: new THREE.CapsuleGeometry(0.085, 0.42, 4, 10),
  hand: new THREE.SphereGeometry(0.08, 10, 8),
  leg: new THREE.CapsuleGeometry(0.105, 0.42, 4, 10),
  shoe: new THREE.BoxGeometry(0.16, 0.1, 0.26),
  backpack: new THREE.BoxGeometry(0.38, 0.46, 0.18),
  strap: new THREE.BoxGeometry(0.06, 0.36, 0.05),
  // Distant stand-in: one capsule for the whole body.
  blob: new THREE.CapsuleGeometry(0.3, 0.9, 4, 8),
}

const materials = new Map<string, THREE.MeshStandardMaterial>()

/**
 * One material per colour, shared by everyone wearing it.
 *
 * Keyed on the values that actually change the shader's inputs, so two students
 * in the same shirt cost one material between them.
 */
function material(color: string, roughness = 0.8, metalness = 0): THREE.MeshStandardMaterial {
  const key = `${color}|${roughness}|${metalness}`
  const hit = materials.get(key)
  if (hit) return hit
  const made = new THREE.MeshStandardMaterial({ color, roughness, metalness })
  materials.set(key, made)
  return made
}

const faceMaterials = new Map<number, THREE.MeshBasicMaterial>()

function faceMaterial(variant: 0 | 1 | 2): THREE.MeshBasicMaterial | null {
  const hit = faceMaterials.get(variant)
  if (hit) return hit
  const map = faceTexture(variant)
  if (!map) return null
  // Basic, not standard: a face drawn as a texture should not also be shaded,
  // or the eyes go dark whenever the student turns away from the sun.
  const made = new THREE.MeshBasicMaterial({ map, transparent: true, depthWrite: false })
  faceMaterials.set(variant, made)
  return made
}

/* ------------------------------------------------------------------ */

/**
 * A Map, not an object literal.
 *
 * `direction` arrives off the socket as an arbitrary string and the consumer
 * does not validate it. An object literal inherits `Object.prototype`, so
 * `FACING['constructor']` returns a function rather than undefined, the `??`
 * fallback never fires, and a function assigned to `Euler.y` produces a NaN
 * matrix that silently removes the avatar from the scene.
 */
const FACING = new Map<string, number>([
  ['down', 0],
  ['up', Math.PI],
  ['left', Math.PI / 2],
  ['right', -Math.PI / 2],
])

export interface CharacterModelProps {
  /** Shirt colour. Matches the hue shown beside the player's name. */
  color?: string
  isMoving?: boolean
  direction?: string
  /**
   * The user id. Everything except the shirt is derived from it, so a student
   * looks the same to everyone and stays the same between sessions.
   */
  seed?: string | number
}

export function CharacterModel({
  color = '#4F46E5',
  isMoving = false,
  direction = 'down',
  seed = 0,
}: CharacterModelProps) {
  const look = useMemo(() => avatarLook(seed), [seed])
  const facing = FACING.get(direction) ?? 0

  return (
    <group rotation={[0, facing, 0]} scale={look.height}>
      <Detailed distances={[0, 22, 55]}>
        <FullBody color={color} look={look} isMoving={isMoving} />
        <SimpleBody color={color} look={look} isMoving={isMoving} />
        <DistantBody color={color} look={look} />
      </Detailed>
    </group>
  )
}

/* ------------------------------------------------------------------ */
/* Near                                                                 */
/* ------------------------------------------------------------------ */

function FullBody({
  color,
  look,
  isMoving,
}: {
  color: string
  look: AvatarLook
  isMoving: boolean
}) {
  const legs = useRef<THREE.Group>(null)
  const arms = useRef<THREE.Group>(null)
  const upper = useRef<THREE.Group>(null)
  const head = useRef<THREE.Group>(null)

  useWalk({ legs, arms, upper, head, isMoving })

  const shirt = material(color, 0.78)
  const skin = material(look.skin, 0.85)
  const face = faceMaterial(look.face)

  return (
    <group>
      <group ref={upper}>
        <mesh
          castShadow
          geometry={GEO.torso}
          material={shirt}
          position={[0, 1.05, 0]}
          scale={[1, 1, 0.72]}
        />
        <mesh
          castShadow
          geometry={GEO.hips}
          material={material(look.trousers, 0.85)}
          position={[0, 0.71, 0]}
          scale={[1, 1, 0.78]}
        />
        <mesh castShadow geometry={GEO.neck} material={skin} position={[0, 1.5, 0]} />

        <group ref={head} position={[0, 1.7, 0]}>
          <mesh castShadow geometry={GEO.head} material={skin} scale={[1, 1.1, 0.95]} />
          {face && <mesh geometry={GEO.face} material={face} position={[0, 0.012, 0.207]} />}
          <Hair look={look} />
        </group>

        <group ref={arms}>
          {[-0.325, 0.325].map((x) => (
            <group key={x} position={[x, 1.3, 0]}>
              <mesh castShadow geometry={GEO.arm} material={shirt} position={[0, -0.25, 0]} />
              <mesh castShadow geometry={GEO.hand} material={skin} position={[0, -0.53, 0]} />
            </group>
          ))}
        </group>

        {look.backpack && (
          <group>
            <mesh castShadow geometry={GEO.backpack} material={material('#3a4657', 0.92)} position={[0, 1.08, -0.27]} />
            {[-0.14, 0.14].map((x) => (
              <mesh key={x} geometry={GEO.strap} material={material('#2b3340', 0.92)} position={[x, 1.18, -0.13]} />
            ))}
          </group>
        )}
      </group>

      <group ref={legs} position={[0, 0.66, 0]}>
        {[-0.135, 0.135].map((x) => (
          <group key={x} position={[x, 0, 0]}>
            <mesh castShadow geometry={GEO.leg} material={material(look.trousers, 0.85)} position={[0, -0.3, 0]} />
            <mesh castShadow geometry={GEO.shoe} material={material(look.shoes, 0.6)} position={[0, -0.6, 0.05]} />
          </group>
        ))}
      </group>
    </group>
  )
}

function Hair({ look }: { look: AvatarLook }) {
  const hair = material(look.hair, 0.95)

  // Scaled to the head's own ellipsoid so it sits on the skull rather than
  // hovering off it at the sides.
  const fit: [number, number, number] = [1.03, 1.09, 1.02]

  if (look.hairStyle === 1) {
    // Cropped: barely more than a shadow on the crown.
    return <mesh geometry={GEO.hairCrop} material={hair} position={[0, 0.004, -0.004]} scale={fit} />
  }

  if (look.hairStyle === 2) {
    // Tied back.
    return (
      <group>
        <mesh geometry={GEO.hairCap} material={hair} position={[0, 0.004, -0.006]} scale={fit} />
        <mesh castShadow geometry={GEO.hairBun} material={hair} position={[0, 0.035, -0.215]} />
      </group>
    )
  }

  return <mesh geometry={GEO.hairCap} material={hair} position={[0, 0.004, -0.008]} scale={fit} />
}

/* ------------------------------------------------------------------ */
/* Mid and far                                                          */
/* ------------------------------------------------------------------ */

/** No face, no hands, no shoes, no bag. None of it resolves at this range. */
function SimpleBody({
  color,
  look,
  isMoving,
}: {
  color: string
  look: AvatarLook
  isMoving: boolean
}) {
  const legs = useRef<THREE.Group>(null)
  const upper = useRef<THREE.Group>(null)

  useWalk({ legs, upper, isMoving })

  return (
    <group>
      <group ref={upper}>
        <mesh
          castShadow
          geometry={GEO.torso}
          material={material(color, 0.78)}
          position={[0, 1.05, 0]}
          scale={[1, 1, 0.72]}
        />
        <mesh castShadow geometry={GEO.head} material={material(look.skin, 0.85)} position={[0, 1.7, 0]} />
        <mesh
          geometry={GEO.hairCap}
          material={material(look.hair, 0.95)}
          position={[0, 1.704, -0.008]}
          scale={[1.03, 1.09, 1.02]}
        />
      </group>
      <group ref={legs} position={[0, 0.66, 0]}>
        {[-0.135, 0.135].map((x) => (
          <mesh
            key={x}
            castShadow
            geometry={GEO.leg}
            material={material(look.trousers, 0.85)}
            position={[x, -0.3, 0]}
          />
        ))}
      </group>
    </group>
  )
}

/** Two meshes. Enough to say "somebody is over there, and they are in blue". */
function DistantBody({ color, look }: { color: string; look: AvatarLook }) {
  return (
    <group>
      <mesh castShadow geometry={GEO.blob} material={material(color, 0.8)} position={[0, 0.92, 0]} />
      <mesh geometry={GEO.head} material={material(look.hair, 0.9)} position={[0, 1.68, 0]} />
    </group>
  )
}

/* ------------------------------------------------------------------ */
/* Animation                                                            */
/* ------------------------------------------------------------------ */

/**
 * The walk cycle, and a breath when standing still.
 *
 * Shared by both animated levels of detail so they cannot drift apart, and it
 * touches only rotations and one position — no allocation, nothing that has to
 * be cleaned up.
 */
function useWalk({
  legs,
  arms,
  upper,
  head,
  isMoving,
}: {
  legs: React.RefObject<THREE.Group | null>
  arms?: React.RefObject<THREE.Group | null>
  upper?: React.RefObject<THREE.Group | null>
  head?: React.RefObject<THREE.Group | null>
  isMoving: boolean
}) {
  useFrame((state) => {
    const t = state.clock.elapsedTime * 9
    const swing = isMoving ? Math.sin(t) * 0.55 : 0

    if (legs.current) {
      legs.current.children.forEach((leg, i) => {
        leg.rotation.x = i === 0 ? swing : -swing
      })
    }
    if (arms?.current) {
      arms.current.children.forEach((arm, i) => {
        arm.rotation.x = i === 0 ? -swing * 0.75 : swing * 0.75
      })
    }
    if (upper?.current) {
      // A bob on each stride, and a slow breath when idle.
      upper.current.position.y = isMoving
        ? Math.abs(Math.sin(t)) * 0.045
        : Math.sin(state.clock.elapsedTime * 1.5) * 0.012
      upper.current.rotation.y = isMoving ? Math.sin(t) * 0.06 : 0
    }
    if (head?.current) {
      // The head lags the shoulders very slightly, which is most of what makes
      // a walk look like a walk rather than a slide.
      head.current.rotation.y = isMoving ? -Math.sin(t) * 0.05 : 0
    }
  })
}

export default CharacterModel
