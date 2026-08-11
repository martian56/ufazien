import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Detailed } from '@react-three/drei'
import * as THREE from 'three'

import { avatarLook, type AvatarLook } from './avatarAppearance'
import {
  TURN_RATE,
  approachAngle,
  gaitFor,
  poseFrame,
  toActivity,
  type Activity,
  type PoseFrame,
} from './avatarPose'
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
  // Split at the elbow and the knee. A single-segment limb cannot sit down:
  // rotating one capsule at the hip puts the whole leg out horizontally in
  // front, like a doll propped against a wall.
  upperArm: new THREE.CapsuleGeometry(0.082, 0.2, 4, 10),
  foreArm: new THREE.CapsuleGeometry(0.075, 0.2, 4, 10),
  hand: new THREE.SphereGeometry(0.08, 10, 8),
  thigh: new THREE.CapsuleGeometry(0.108, 0.2, 4, 10),
  shin: new THREE.CapsuleGeometry(0.093, 0.2, 4, 10),
  // Kept for the mid-detail body, which has no joints.
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
  /** Cardinal fallback, for a client that sends no heading. */
  direction?: string
  /** Where the player is actually looking, in radians. */
  heading?: number
  /** What they are doing: sitting, waving, a hand up. */
  activity?: string
  /** Ground speed, which decides whether this is a walk or a run. */
  speed?: number
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
  heading,
  activity = 'standing',
  speed,
  seed = 0,
}: CharacterModelProps) {
  const look = useMemo(() => avatarLook(seed), [seed])
  const body = useRef<THREE.Group>(null)

  // A real angle if the client sent one, otherwise the old four-way enum. The
  // enum is why every remote student used to face north, south, east or west
  // no matter which way they were walking.
  const target = heading !== undefined && Number.isFinite(heading)
    ? heading
    : FACING.get(direction) ?? 0

  const pose = toActivity(activity)
  // Speed drives the gait. Without one, fall back to the boolean the socket
  // has always carried, so an older client still animates.
  const ground = speed !== undefined && Number.isFinite(speed)
    ? speed
    : isMoving
      ? 5.5
      : 0

  // Turned towards the heading rather than snapped to it, and never the long
  // way round. Sitting locks the body to the seat's facing.
  useFrame((_, delta) => {
    const group = body.current
    if (!group) return
    group.rotation.y =
      pose === 'sitting'
        ? target
        : approachAngle(group.rotation.y, target, TURN_RATE * Math.min(delta, 0.1))
  })

  return (
    <group ref={body} rotation={[0, target, 0]} scale={look.height}>
      <Detailed distances={[0, 22, 55]}>
        <FullBody color={color} look={look} activity={pose} speed={ground} />
        <SimpleBody color={color} look={look} activity={pose} speed={ground} />
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
  activity,
  speed,
}: {
  color: string
  look: AvatarLook
  activity: Activity
  speed: number
}) {
  const rig = useRef<Rig>({})
  usePose(rig, activity, speed)

  const shirt = material(color, 0.78)
  const skin = material(look.skin, 0.85)
  const face = faceMaterial(look.face)
  const trousers = material(look.trousers, 0.85)

  return (
    <group ref={(node) => { rig.current.root = node ?? undefined }}>
      <group ref={(node) => { rig.current.upper = node ?? undefined }}>
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
          material={trousers}
          position={[0, 0.71, 0]}
          scale={[1, 1, 0.78]}
        />
        <mesh castShadow geometry={GEO.neck} material={skin} position={[0, 1.5, 0]} />

        <group ref={(node) => { rig.current.head = node ?? undefined }} position={[0, 1.7, 0]}>
          <mesh castShadow geometry={GEO.head} material={skin} scale={[1, 1.1, 0.95]} />
          {face && <mesh geometry={GEO.face} material={face} position={[0, 0.012, 0.207]} />}
          <Hair look={look} />
        </group>

        {/* Shoulders and elbows. Both arms are built the same way and told
            apart by which ref they take, so a wave only moves one of them. */}
        {([['left', -0.325], ['right', 0.325]] as const).map(([side, x]) => (
          <group
            key={side}
            position={[x, 1.3, 0]}
            ref={(node) => {
              rig.current[side === 'left' ? 'leftShoulder' : 'rightShoulder'] = node ?? undefined
            }}
          >
            <mesh castShadow geometry={GEO.upperArm} material={shirt} position={[0, -0.14, 0]} />
            <group
              position={[0, -0.28, 0]}
              ref={(node) => {
                rig.current[side === 'left' ? 'leftElbow' : 'rightElbow'] = node ?? undefined
              }}
            >
              <mesh castShadow geometry={GEO.foreArm} material={skin} position={[0, -0.13, 0]} />
              <mesh castShadow geometry={GEO.hand} material={skin} position={[0, -0.27, 0]} />
            </group>
          </group>
        ))}

        {look.backpack && (
          <group>
            <mesh castShadow geometry={GEO.backpack} material={material('#3a4657', 0.92)} position={[0, 1.08, -0.27]} />
            {[-0.14, 0.14].map((x) => (
              <mesh key={x} geometry={GEO.strap} material={material('#2b3340', 0.92)} position={[x, 1.18, -0.13]} />
            ))}
          </group>
        )}
      </group>

      {/* Hips and knees. The knee is what makes sitting possible at all. */}
      <group position={[0, 0.66, 0]}>
        {([['left', -0.135], ['right', 0.135]] as const).map(([side, x]) => (
          <group
            key={side}
            position={[x, 0, 0]}
            ref={(node) => {
              rig.current[side === 'left' ? 'leftHip' : 'rightHip'] = node ?? undefined
            }}
          >
            <mesh castShadow geometry={GEO.thigh} material={trousers} position={[0, -0.15, 0]} />
            <group
              position={[0, -0.31, 0]}
              ref={(node) => {
                rig.current[side === 'left' ? 'leftKnee' : 'rightKnee'] = node ?? undefined
              }}
            >
              <mesh castShadow geometry={GEO.shin} material={trousers} position={[0, -0.14, 0]} />
              <mesh castShadow geometry={GEO.shoe} material={material(look.shoes, 0.6)} position={[0, -0.3, 0.05]} />
            </group>
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
/** No face, no hands, no shoes, no bag. None of it resolves at this range. */
function SimpleBody({
  color,
  look,
  activity,
  speed,
}: {
  color: string
  look: AvatarLook
  activity: Activity
  speed: number
}) {
  const rig = useRef<Rig>({})
  usePose(rig, activity, speed)

  const trousers = material(look.trousers, 0.85)

  return (
    <group ref={(node) => { rig.current.root = node ?? undefined }}>
      <group ref={(node) => { rig.current.upper = node ?? undefined }}>
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
        {/* Shoulders only. At this distance an elbow is under a pixel. */}
        {([['left', -0.3], ['right', 0.3]] as const).map(([side, x]) => (
          <group
            key={side}
            position={[x, 1.3, 0]}
            ref={(node) => {
              rig.current[side === 'left' ? 'leftShoulder' : 'rightShoulder'] = node ?? undefined
            }}
          >
            <mesh castShadow geometry={GEO.upperArm} material={material(color, 0.78)} position={[0, -0.25, 0]} scale={[1, 2.1, 1]} />
          </group>
        ))}
      </group>
      <group position={[0, 0.66, 0]}>
        {([['left', -0.135], ['right', 0.135]] as const).map(([side, x]) => (
          <group
            key={side}
            position={[x, 0, 0]}
            ref={(node) => {
              rig.current[side === 'left' ? 'leftHip' : 'rightHip'] = node ?? undefined
            }}
          >
            <mesh castShadow geometry={GEO.thigh} material={trousers} position={[0, -0.15, 0]} />
            <group
              position={[0, -0.31, 0]}
              ref={(node) => {
                rig.current[side === 'left' ? 'leftKnee' : 'rightKnee'] = node ?? undefined
              }}
            >
              <mesh castShadow geometry={GEO.shin} material={trousers} position={[0, -0.14, 0]} />
            </group>
          </group>
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
 * The joints, as whichever of them a given level of detail actually built.
 *
 * All optional: the mid-detail body has shoulders but no elbows, and skipping
 * a joint it does not have is cheaper than giving it one nobody can see.
 */
interface Rig {
  root?: THREE.Group
  upper?: THREE.Group
  head?: THREE.Group
  leftShoulder?: THREE.Group
  rightShoulder?: THREE.Group
  leftElbow?: THREE.Group
  rightElbow?: THREE.Group
  leftHip?: THREE.Group
  rightHip?: THREE.Group
  leftKnee?: THREE.Group
  rightKnee?: THREE.Group
}

/**
 * Drives the rig from `poseFrame`.
 *
 * Shared by both animated levels of detail so they cannot drift apart, and it
 * touches only rotations and one position — no allocation, nothing to clean up.
 * All of the actual reasoning lives in `avatarPose.ts`, where it can be tested
 * without a canvas.
 */
function usePose(rig: React.RefObject<Rig>, activity: Activity, speed: number) {
  useFrame((state) => {
    const parts = rig.current
    if (!parts) return

    const time = state.clock.elapsedTime
    const frame = poseFrame(activity, time, speed)
    const gait = gaitFor(speed)

    apply(parts.leftHip, frame.leftHip)
    apply(parts.rightHip, frame.rightHip)
    apply(parts.leftKnee, frame.leftKnee)
    apply(parts.rightKnee, frame.rightKnee)
    apply(parts.leftElbow, frame.leftElbow)
    apply(parts.rightElbow, frame.rightElbow)
    apply(parts.leftShoulder, frame.leftShoulder, frame.leftShoulderZ)
    apply(parts.rightShoulder, frame.rightShoulder, frame.rightShoulderZ)

    if (parts.root) {
      // Sitting drops the whole body by a seat height, so an avatar placed on
      // the floor in front of a chair ends up on it.
      parts.root.position.y = -frame.hipDrop
    }

    if (parts.upper) {
      // A bob on each stride. Zero when the cadence is, so a standing student
      // does not hover.
      parts.upper.position.y =
        gait.cadence > 0 ? Math.abs(Math.sin(time * gait.cadence)) * gait.bob : 0
      parts.upper.rotation.x = frame.torsoLean
      parts.upper.rotation.y = gait.cadence > 0 ? Math.sin(time * gait.cadence) * 0.06 : 0
    }

    if (parts.head) {
      parts.head.rotation.y = frame.headTurn
      parts.head.rotation.x = frame.headNod
    }
  })
}

function apply(joint: THREE.Group | undefined, x: number, z = 0) {
  if (!joint) return
  joint.rotation.x = x
  joint.rotation.z = z
}

export default CharacterModel
