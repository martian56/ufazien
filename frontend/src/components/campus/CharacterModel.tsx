import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Detailed } from '@react-three/drei'
import * as THREE from 'three'

import { avatarLook, type AvatarLook } from './avatarAppearance'
import {
  TURN_RATE,
  WALK_SPEED,
  approachAngle,
  gaitFor,
  poseFrame,
  toActivity,
  type Activity,
  type PoseFrame,
} from './avatarPose'
import { faceTexture, type Expression } from './campusTextures'

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
  /**
   * A torso that tapers.
   *
   * Capsules were the first pass and a capsule has one radius: chest and waist
   * came out the same width, which is a barrel rather than a person. A cone
   * section has two, and the collar and belt cover the flat ends.
   */
  chest: new THREE.CylinderGeometry(0.185, 0.232, 0.32, 20, 1, true),
  chestTop: new THREE.SphereGeometry(0.185, 18, 12, 0, Math.PI * 2, 0, Math.PI / 2),
  // Closed at both ends: open-ended, the hem showed the inside of the shirt
  // as a dark notch wherever the belt did not quite reach.
  waist: new THREE.CylinderGeometry(0.232, 0.212, 0.2, 20),
  hips: new THREE.CylinderGeometry(0.214, 0.204, 0.24, 18),

  neck: new THREE.CylinderGeometry(0.082, 0.098, 0.18, 12),
  collar: new THREE.CylinderGeometry(0.125, 0.19, 0.1, 16),

  /**
   * The skull, and a jaw under it.
   *
   * One sphere is a ball with a face drawn on it. A second, narrower and
   * lower, gives a chin and cheeks — the taper from cheekbone to jaw is most
   * of what makes a head read as a head at this level of detail.
   */
  skull: new THREE.SphereGeometry(0.2, 24, 18),
  jaw: new THREE.SphereGeometry(0.163, 20, 14),
  ear: new THREE.SphereGeometry(0.042, 10, 8),
  face: new THREE.PlaneGeometry(0.29, 0.29),

  /**
   * Hair as a solid mass, not a film on the skull.
   *
   * The old version was a hemisphere shell a couple of millimetres proud of
   * the head, which reads as a swimming cap because that is exactly what it
   * is. Hair has volume: it stands off the skull, it is thicker at the back
   * than at the crown, and it has an edge you can see. So these are bodies
   * rather than shells, and every style is built from them.
   */
  /**
   * The crown, stopping at the hairline.
   *
   * It used to sweep down to eighty-four degrees from the pole, which on a
   * head this size is below the brow — so it covered the eyebrows outright,
   * and no amount of choosing a brow colour could make them visible.
   */
  hairCrown: new THREE.SphereGeometry(0.222, 24, 16, 0, Math.PI * 2, 0, Math.PI / 2.9),
  /**
   * The back and sides, with the face left open.
   *
   * The gap is put over the face by construction rather than by turning the
   * mesh afterwards. In three.js a sphere's phi runs from -X at zero through
   * +Z at a quarter turn, so a gap centred on the face is centred on phi =
   * pi/2 — which means the hair itself starts on the far side of it. Rotating
   * a group instead is how the parting ended up running down one ear.
   */
  hairBack: new THREE.SphereGeometry(0.228, 24, 18, Math.PI * 0.84, Math.PI * 1.32, 0, Math.PI / 1.7),
  // A fringe, overhanging the brow. Without one the hairline runs straight
  // across the forehead like a drawn line.
  hairFringe: new THREE.SphereGeometry(0.1, 14, 10),
  // Length down the back of the neck, for the long style.
  hairFall: new THREE.SphereGeometry(0.13, 14, 12),
  hairBun: new THREE.SphereGeometry(0.098, 14, 12),

  // Split at the elbow and the knee. A single-segment limb cannot sit down:
  // rotating one capsule at the hip puts the whole leg out horizontally in
  // front, like a doll propped against a wall.
  shoulder: new THREE.SphereGeometry(0.087, 14, 12),
  upperArm: new THREE.CapsuleGeometry(0.078, 0.2, 4, 12),
  foreArm: new THREE.CapsuleGeometry(0.069, 0.2, 4, 12),
  hand: new THREE.SphereGeometry(0.072, 12, 10),
  belt: new THREE.CylinderGeometry(0.216, 0.212, 0.12, 18),
  thigh: new THREE.CapsuleGeometry(0.105, 0.22, 4, 12),
  shin: new THREE.CapsuleGeometry(0.088, 0.22, 4, 12),
  // Kept for the mid-detail body, which has no joints.
  leg: new THREE.CapsuleGeometry(0.105, 0.42, 4, 10),
  shoe: new THREE.BoxGeometry(0.15, 0.09, 0.25),
  toe: new THREE.SphereGeometry(0.075, 12, 8),
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

const faceMaterials = new Map<string, THREE.MeshBasicMaterial>()

/**
 * Which face somebody wears while doing a given thing.
 *
 * Two students clapping look pleased, somebody pointing is concentrating, and
 * a raised hand is a question. The pose alone carried all of this before, and
 * an unchanging face under a waving arm is most of what made the avatars read
 * as mannequins.
 */
export function expressionFor(activity: Activity, speaking = false): Expression {
  if (speaking) return 'talk'
  switch (activity) {
    case 'waving':
    case 'clapping':
      return 'smile'
    case 'pointing':
      return 'focus'
    case 'hand_raised':
      return 'surprise'
    default:
      return 'neutral'
  }
}

function faceMaterial(
  variant: 0 | 1 | 2,
  expression: Expression,
  skin: string,
  hair: string,
): THREE.MeshBasicMaterial | null {
  const key = `${variant}:${expression}:${skin}:${hair}`
  const hit = faceMaterials.get(key)
  if (hit) return hit
  const map = faceTexture(variant, expression, skin, hair)
  if (!map) return null
  // Basic, not standard: a face drawn as a texture should not also be shaded,
  // or the eyes go dark whenever the student turns away from the sun.
  const made = new THREE.MeshBasicMaterial({ map, transparent: true, depthWrite: false })
  faceMaterials.set(key, made)
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
   * Whether they are talking on the proximity voice.
   *
   * Drives the mouth. The speaking ring on the floor already said who was
   * making the noise; this says it on the person, which is where you look.
   */
  speaking?: boolean
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
  speaking = false,
  seed = 0,
}: CharacterModelProps) {
  const look = useMemo(() => avatarLook(seed), [seed])
  const body = useRef<THREE.Group>(null)
  const placed = useRef(false)

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
      ? WALK_SPEED
      : 0

  // Turned towards the heading rather than snapped to it, and never the long
  // way round. Sitting locks the body to the seat's facing.
  useFrame((_, delta) => {
    const group = body.current
    if (!group) return
    // Face the right way on the first frame rather than swinging round from
    // zero when an avatar first appears.
    if (!placed.current) {
      placed.current = true
      group.rotation.y = target
      return
    }
    group.rotation.y =
      pose === 'sitting'
        ? target
        : approachAngle(group.rotation.y, target, TURN_RATE * Math.min(delta, 0.1))
  })

  // No `rotation` prop. r3f writes an array prop straight onto the object, so
  // a changing `rotation={[0, target, 0]}` overwrote `rotation.y` on every
  // render — which is exactly the value `useFrame` above is interpolating, so
  // a remote player snapped to a new heading instead of turning at TURN_RATE.
  return (
    <group ref={body} scale={look.height}>
      <Detailed distances={[0, 22, 55]}>
        <FullBody color={color} look={look} activity={pose} speed={ground} speaking={speaking} />
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
  speaking,
}: {
  color: string
  look: AvatarLook
  activity: Activity
  speed: number
  speaking: boolean
}) {
  const rig = useRef<Rig>({})
  usePose(rig, activity, speed)

  const shirt = material(color, 0.78)
  const skin = material(look.skin, 0.85)
  const face = faceMaterial(look.face, expressionFor(activity, speaking), look.skin, look.hair)
  const trousers = material(look.trousers, 0.85)

  return (
    <group ref={(node) => { rig.current.root = node ?? undefined }}>
      <group ref={(node) => { rig.current.upper = node ?? undefined }}>
        {/* Chest to waist, tapering. Open-ended cones with the collar and the
            belt over the joins, so no cap is ever seen. */}
        <mesh castShadow geometry={GEO.chest} material={shirt} position={[0, 1.235, 0]} scale={[1.12, 1, 0.72]} />
        <mesh castShadow geometry={GEO.chestTop} material={shirt} position={[0, 1.395, 0]} scale={[1.12, 0.62, 0.72]} />
        <mesh castShadow geometry={GEO.waist} material={shirt} position={[0, 0.975, 0]} scale={[1.12, 1, 0.72]} />
        <mesh
          castShadow
          geometry={GEO.hips}
          material={trousers}
          position={[0, 0.78, 0]}
          scale={[1.1, 1, 0.8]}
        />
        {/* The neck was buried: the torso capsule's top sat above the head's
            bottom, so the head grew straight out of the collar. */}
        <mesh castShadow geometry={GEO.neck} material={skin} position={[0, 1.5, 0]} />
        {/* A collar, which is what a shirt has where it meets a neck. */}
        <mesh castShadow geometry={GEO.collar} material={shirt} position={[0, 1.42, 0]} scale={[1.1, 1, 0.74]} />

        <group ref={(node) => { rig.current.head = node ?? undefined }} position={[0, 1.82, 0]}>
          {/* Skull and jaw. One sphere is a ball with a face drawn on it; the
              taper from cheekbone to chin is what makes it a head. */}
          <mesh castShadow geometry={GEO.skull} material={skin} scale={[1, 1.08, 0.97]} />
          <mesh castShadow geometry={GEO.jaw} material={skin} position={[0, -0.075, 0.012]} scale={[0.94, 0.86, 1]} />
          {[-1, 1].map((side) => (
            <mesh
              key={side}
              castShadow
              geometry={GEO.ear}
              material={skin}
              position={[side * 0.196, -0.012, -0.005]}
              scale={[0.55, 1.15, 0.85]}
            />
          ))}
          {face && <mesh geometry={GEO.face} material={face} position={[0, -0.004, 0.196]} />}
          <Hair look={look} />
        </group>

        {/* The waist. The shirt and the trousers are different silhouettes as
            well as different colours, so where they met there was a visible
            step; a belt is what a person has there anyway. */}
        <mesh castShadow geometry={GEO.belt} material={material(look.shoes, 0.55)} position={[0, 0.885, 0]} scale={[1.14, 1, 0.78]} />

        {/* Shoulders and elbows. Both arms are built the same way and told
            apart by which ref they take, so a wave only moves one of them.
            Brought in from 0.325 to the surface of the torso: at the old
            offset the upper arms hung in the air beside the body with a
            visible gap between. */}
        {([['left', -0.248], ['right', 0.248]] as const).map(([side, x]) => (
          <group
            key={side}
            position={[x, 1.272, 0]}
            ref={(node) => {
              rig.current[side === 'left' ? 'leftShoulder' : 'rightShoulder'] = node ?? undefined
            }}
          >
            {/* The deltoid, which closes the joint at the top of the arm. */}
            <mesh castShadow geometry={GEO.shoulder} material={shirt} />
            <mesh castShadow geometry={GEO.upperArm} material={shirt} position={[0, -0.14, 0]} />
            <group
              position={[0, -0.28, 0]}
              ref={(node) => {
                rig.current[side === 'left' ? 'leftElbow' : 'rightElbow'] = node ?? undefined
              }}
            >
              <mesh castShadow geometry={GEO.foreArm} material={skin} position={[0, -0.13, 0]} />
              {/* Flattened: a sphere on the end of an arm is a mitten. */}
              <mesh castShadow geometry={GEO.hand} material={skin} position={[0, -0.28, 0]} scale={[0.86, 1.2, 0.62]} />
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
              <mesh castShadow geometry={GEO.shoe} material={material(look.shoes, 0.6)} position={[0, -0.32, 0.04]} />
              {/* A rounded toe, so the foot is not a brick. */}
              <mesh castShadow geometry={GEO.toe} material={material(look.shoes, 0.6)} position={[0, -0.325, 0.15]} scale={[1, 0.62, 0.95]} />
            </group>
          </group>
        ))}
      </group>
    </group>
  )
}

/**
 * Hair, as a shape rather than a film.
 *
 * The old version was a hemisphere two millimetres proud of the skull, which
 * reads as a swimming cap because that is what it is. Real hair has volume: it
 * stands off the head, it is deeper at the back than at the crown, and it has
 * an edge. Each style here is a mass built from three or four bodies —
 * a crown, a back that comes down over the ears, a fringe that overhangs the
 * brow, and for the long style a fall down the neck.
 *
 * `hairBack` leaves a gap in its sweep. The group is turned so the gap sits
 * over the face; without the turn the parting would run down one ear.
 */
function Hair({ look }: { look: AvatarLook }) {
  const hair = material(look.hair, 0.92)

  // Turned so the opening in the back piece faces forward, and tipped back a
  // little so the hairline sits above the brow rather than on it.
  const back = (
    <mesh
      castShadow
      geometry={GEO.hairBack}
      material={hair}
      position={[0, -0.005, 0]}
      scale={[1.02, 1.04, 1.06]}
    />
  )

  const fringe = (
    <mesh
      castShadow
      geometry={GEO.hairFringe}
      material={hair}
      // Above the brow line, not over it. Hanging lower it covered the brows
      // outright, which is why they could not be seen no matter what colour
      // they were drawn in.
      position={[0, 0.142, 0.088]}
      scale={[1.7, 0.58, 0.78]}
    />
  )

  if (look.hairStyle === 1) {
    // Cropped. Still a solid mass — short hair has a thickness and an edge,
    // and it is the edge that stops it looking like paint.
    return (
      <group>
        <mesh castShadow geometry={GEO.hairCrown} material={hair} position={[0, 0.006, -0.004]} scale={[1.01, 0.9, 1.02]} />
        <mesh castShadow geometry={GEO.hairBack} material={hair} position={[0, 0.012, 0]} scale={[0.99, 0.8, 1.0]} />
      </group>
    )
  }

  if (look.hairStyle === 2) {
    // Tied back: smooth over the crown, gathered into a bun behind.
    return (
      <group>
        <mesh castShadow geometry={GEO.hairCrown} material={hair} position={[0, 0.008, -0.004]} scale={[1.03, 1.02, 1.04]} />
        {back}
        <mesh castShadow geometry={GEO.hairBun} material={hair} position={[0, 0.03, -0.235]} scale={[1, 1.05, 0.95]} />
        {/* The gather between the crown and the bun. */}
        <mesh castShadow geometry={GEO.hairFall} material={hair} position={[0, 0.055, -0.17]} scale={[0.72, 0.5, 0.7]} />
      </group>
    )
  }

  // The default: a full head of hair with a fringe and length at the back.
  return (
    <group>
      <mesh castShadow geometry={GEO.hairCrown} material={hair} position={[0, 0.01, -0.006]} scale={[1.04, 1.06, 1.05]} />
      {back}
      {fringe}
      <mesh castShadow geometry={GEO.hairFall} material={hair} position={[0, -0.11, -0.13]} scale={[1.32, 1.05, 0.86]} />
    </group>
  )
}

/* ------------------------------------------------------------------ */
/* Mid and far                                                          */
/* ------------------------------------------------------------------ */

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
          geometry={GEO.chest}
          material={material(color, 0.78)}
          position={[0, 1.24, 0]}
          scale={[1.18, 2.0, 0.74]}
        />
        <mesh castShadow geometry={GEO.skull} material={material(look.skin, 0.85)} position={[0, 1.78, 0]} scale={[1, 1.08, 0.97]} />
        <mesh
          geometry={GEO.hairCrown}
          material={material(look.hair, 0.95)}
          position={[0, 1.79, -0.006]}
          scale={[1.05, 1.06, 1.05]}
        />
        {/* Shoulders only. At this distance an elbow is under a pixel. */}
        {([['left', -0.3], ['right', 0.3]] as const).map(([side, x]) => (
          <group
            key={side}
            position={[x, 1.272, 0]}
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
      <mesh geometry={GEO.skull} material={material(look.hair, 0.9)} position={[0, 1.72, 0]} />
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
  // Speed only changes when a new position frame arrives, so recomputing the
  // gait per frame per avatar per level of detail is pure waste.
  const gait = useMemo(() => gaitFor(speed), [speed])

  useFrame((state) => {
    const parts = rig.current
    if (!parts) return

    const time = state.clock.elapsedTime
    const frame = poseFrame(activity, time, speed)

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
