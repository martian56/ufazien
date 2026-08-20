import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
// From three itself rather than `three-stdlib`, which is only here as a
// transitive dependency of drei and could vanish under a minor bump.
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js'

import { AVATAR_CATALOGUE, characterFor, packIndex } from './avatarCatalogue'

import {
  RUN_SPEED,
  TURN_RATE,
  WALK_SPEED,
  approachAngle,
  toActivity,
  type Activity,
} from './avatarPose'

/**
 * Cardinal fallback for a client that sends no heading.
 *
 * A Map rather than an object literal for the reason the old model documents:
 * `direction` arrives off the socket unvalidated, and on an object literal
 * `FACING['constructor']` returns a function rather than undefined, so the `??`
 * never fires and a function reaches `Euler.y` as NaN.
 *
 * The angles are the avatar convention — zero faces +Z, so a heading turns the
 * forward vector to `(sin, cos)`. The sender classifies a step by the sign of
 * its components: `headingX > 0` is 'right', which is +X, which is `+PI/2`.
 * Left and right were the other way round, so every client that fell back to
 * these drew a walking player mirrored. Exported so the test can hold the two
 * ends of the wire to the same convention.
 */
export const FACING = new Map<string, number>([
  ['down', 0],
  ['up', Math.PI],
  ['left', -Math.PI / 2],
  ['right', Math.PI / 2],
])

/**
 * A student, as a rigged model.
 *
 * The previous avatar was built from primitives — cones for a torso, spheres
 * for a skull, a sphere with a wedge taken out of it for hair. It went a long
 * way and it is still the best you can do without an artist, but it was always
 * going to stop short of a person, and it cost six hundred lines of geometry to
 * stay where it was.
 *
 * These are Quaternius's Ultimate Modular Characters, CC0. One skeleton of
 * sixty-two named joints and clips baked by somebody who does this properly.
 * They matter here for a reason beyond looking better: the materials are flat
 * colours with no textures, so they stand next to this campus's untextured
 * buildings without looking pasted in from another game.
 *
 * ## Why the model is cloned
 *
 * `useGLTF` caches one parsed scene per URL, and every avatar sharing it would
 * share its skeleton — twenty students would move as one. `SkeletonUtils.clone`
 * is the deep copy that rebinds `SkinnedMesh` to its own bones; a plain
 * `.clone()` copies the meshes and leaves them all pointing at the original's
 * skeleton, which looks fine standing still and falls apart the moment two
 * players do different things.
 */

/**
 * The packs the campus ships, built by `scripts/build-avatars.mjs`.
 *
 * Derived from the catalogue rather than listed again, so the picker, the
 * server's whitelist and what actually loads cannot disagree.
 */
export const AVATAR_MODELS = AVATAR_CATALOGUE.map((entry) => entry.file)

/**
 * The clips kept in the built assets.
 *
 * The packs carry twenty-four; the build keeps these six, and anything asking
 * for a name outside this list is a bug rather than a silent fallback.
 */
type Clip = 'Idle' | 'Idle_Neutral' | 'Walk' | 'Run' | 'Wave' | 'Interact'

/**
 * How tall the pack's characters are, and how tall the campus expects a player
 * to be.
 *
 * The seat heights, the camera, the name tags and the door openings were all
 * built around the old avatar. Scaling the model to match is a great deal safer
 * than moving all of those.
 */
const MODEL_HEIGHT = 1.78
const PLAYER_HEIGHT = 1.72

export interface GltfCharacterProps {
  /**
   * Which of the packs to draw.
   *
   * Takes whatever the campus already uses to keep a player's appearance
   * stable — a numeric seed or a username — and hashes it into range, so a
   * given player wears the same thing every session rather than being
   * reshuffled on reconnect.
   */
  variant?: number | string
  /**
   * The body this player picked, if they have picked one.
   *
   * Overrides `variant`. Absent or unknown falls back to the seed, so a
   * player who has never chosen looks exactly as they always have.
   */
  character?: string | null
  activity?: Activity | string
  /** Whether the player is travelling, which the campus tracks separately. */
  isMoving?: boolean
  /** Facing, in radians. Preferred over `direction` when the client sends it. */
  heading?: number
  /** Cardinal fallback for clients that predate `heading`. */
  direction?: string
  /** Metres per second, for choosing between walk and run. */
  speed?: number
  /** Shirt colour, applied to the body material only. */
  color?: string
}

/**
 * The clip that matches what a player is doing.
 *
 * Movement wins over activity: a player waving while they walk is walking, and
 * playing the wave would slide them across the floor in a standing pose. The
 * emotes that are not in the pack — clapping and pointing — borrow `Interact`,
 * which is a torso-and-arm gesture and reads as *doing something* rather than
 * as the wrong thing.
 */
export function clipFor(activity: Activity, speed: number, isMoving: boolean): Clip {
  if (isMoving || speed > 0.4) {
    return speed > (WALK_SPEED + RUN_SPEED) / 2 ? 'Run' : 'Walk'
  }
  if (activity === 'waving') return 'Wave'
  // Clapping, a raised hand and pointing are posed by hand over a still idle —
  // the pack has no clip for any of them, and borrowing `Wave` for a raised
  // hand or `Interact` for a clap plays a different gesture rather than a near
  // miss. See `EMOTE_POSES`.
  if (activity === 'clapping' || activity === 'hand_raised' || activity === 'pointing') {
    return 'Idle_Neutral'
  }
  // Sitting and leaning are posed on top of a still idle: the pack has no clip
  // for either, and a seated character playing a breathing idle sways.
  if (activity === 'sitting' || activity === 'leaning') return 'Idle_Neutral'
  return 'Idle'
}

/**
 * Materials that keep their own colour whatever the player's is.
 *
 * Skin, eyes, hair and the whites of a shirt collar. Tinting these turns a
 * player blue from the neck up.
 */
const KEEP_COLOUR = /^(Skin|Skin_Darker|Eye|Eyebrows|Hair|White|Black|Grey|DarkBrown|Tie)$/i

/**
 * Joint names, with the punctuation taken out.
 *
 * The pack calls a joint `UpperLeg.L`. three.js will not: a dot is a separator
 * in an animation property path, so `GLTFLoader` sanitises it away and the bone
 * arrives called `UpperLeg_L`. Looking up the name from the file finds nothing,
 * silently — sixty-two bones in the map and not one of them under the name the
 * glTF gave it, which is why the seated pose did nothing at all for a while.
 */
function joint(name: string): string {
  return name.replace(/[^a-z0-9]/gi, '').toLowerCase()
}

/**
 * Extra rotation applied on top of the clip, in radians, by joint.
 *
 * The pack has no sitting animation, so sitting is a still idle with the hips
 * and knees folded. Done as an override rather than a separate clip because it
 * has to compose with whatever the mixer just wrote: the mixer runs first and
 * this runs after it, every frame, or the animation overwrites the pose and the
 * player stands up through the chair.
 */
const SEATED: [string, number, 'parent' | 'local'][] = [
  // Hips swing in the parent's frame, which for a thigh is the pelvis and is
  // near enough world-aligned.
  [joint('UpperLeg.L'), -1.45, 'parent'],
  [joint('UpperLeg.R'), -1.45, 'parent'],
  // Knees hinge about their own axis. In the parent's frame the two legs bend
  // in opposite directions and cross over each other, which is a yoga pose
  // rather than a person on a chair.
  [joint('LowerLeg.L'), 1.5, 'local'],
  [joint('LowerLeg.R'), 1.5, 'local'],
  [joint('Foot.L'), 0.25, 'local'],
  [joint('Foot.R'), 0.25, 'local'],
]

/**
 * Arm poses for the emotes the pack has no clip for.
 *
 * The pack ships twenty-four animations and not one of them is a clap, a raised
 * hand or a point — the rest are combat. So these are posed by hand over a
 * still `Idle_Neutral`, the way sitting is.
 *
 * ## Aimed, not rotated by an angle
 *
 * A bone is pointed *at a direction* rather than turned by so many radians
 * about some axis. These bones rest in an A-pose and their parents are twisted
 * with them — the right shoulder's rest quaternion is nowhere near
 * axis-aligned — so "rotate the upper arm 2.5 about Z" swings it somewhere
 * nobody can predict, and tuning it is guessing. The first attempt at a raised
 * hand put the arm straight out sideways. Asking for "point this bone up" is
 * exact, and it reads as what it is.
 *
 * Directions are in the body's own space: `+Y` up, `+Z` the way they are
 * facing, `+X` to their left. So a raised hand is up whichever way the player
 * has turned, and a point is forward from *their* shoulder rather than towards
 * a fixed corner of the campus.
 */
interface ArmAim {
  joint: string
  /** Where the bone should point, in body space. */
  aim: [number, number, number]
  /** A second direction it moves towards on the beat, for emotes with one. */
  beat?: [number, number, number]
}

export const EMOTE_POSES: Record<string, ArmAim[]> = {
  // One arm straight up, the other left alone. A raised hand is a question,
  // and a question is one arm.
  hand_raised: [
    { joint: joint('UpperArm.R'), aim: [0.25, 1, 0] },
    { joint: joint('LowerArm.R'), aim: [0.1, 1, 0] },
  ],
  // Forearms in towards the middle, meeting and parting on the beat. The upper
  // arms stay down and forward, which is where hands meet to clap.
  clapping: [
    { joint: joint('UpperArm.L'), aim: [-0.55, -0.35, 0.75] },
    { joint: joint('UpperArm.R'), aim: [0.55, -0.35, 0.75] },
    { joint: joint('LowerArm.L'), aim: [-0.15, 0.1, 1], beat: [0.3, 0.1, 1] },
    { joint: joint('LowerArm.R'), aim: [0.15, 0.1, 1], beat: [-0.3, 0.1, 1] },
  ],
  // One arm out in front, level, elbow straight.
  pointing: [
    { joint: joint('UpperArm.R'), aim: [0.2, 0, 1] },
    { joint: joint('LowerArm.R'), aim: [0.1, 0, 1] },
  ],
}

/** How fast a clap claps, in radians per second of phase. */
const CLAP_RATE = 7.5

/**
 * Picks a pack from a seed of either shape, deterministically.
 *
 * Re-exported from the catalogue, which owns it now that a player can also
 * choose. Kept here because this is where callers and tests have always found
 * it.
 */
export { packIndex }

/** Scratch objects, so a seated player does not allocate two per joint per frame. */
const HINGE = new THREE.Vector3(1, 0, 0)
const FOLD = new THREE.Quaternion()
const AXIS = new THREE.Vector3()
const BEAT = new THREE.Vector3()
const BONE_AXIS = new THREE.Vector3(0, 1, 0)
const WORLD_AIM = new THREE.Quaternion()
const PARENT_QUAT = new THREE.Quaternion()
const BODY_QUAT = new THREE.Quaternion()
const IDENTITY = new THREE.Quaternion()

export function GltfCharacter({
  variant = 0,
  character = null,
  activity = 'standing',
  isMoving = false,
  heading,
  direction = 'down',
  speed,
  color,
}: GltfCharacterProps) {
  const pose = toActivity(activity)
  const target =
    heading !== undefined && Number.isFinite(heading) ? heading : (FACING.get(direction) ?? 0)
  // Speed drives the gait. Without one, fall back to the boolean the socket
  // has always carried, so an older client still animates.
  const ground =
    speed !== undefined && Number.isFinite(speed) ? speed : isMoving ? WALK_SPEED : 0
  const body = useRef<THREE.Group>(null)
  const placed = useRef(false)
  // What this player chose, or what their id has always given them. The
  // choice wins; nothing chosen means nothing changes.
  const url = characterFor(character, variant).file
  const gltf = useGLTF(url)

  // One clone per avatar, rebound to its own skeleton.
  const scene = useMemo(() => cloneSkinned(gltf.scene), [gltf.scene])

  const mixer = useMemo(() => new THREE.AnimationMixer(scene), [scene])
  const actions = useMemo(() => {
    const map = new Map<string, THREE.AnimationAction>()
    for (const clip of gltf.animations) map.set(clip.name, mixer.clipAction(clip, scene))
    return map
  }, [gltf.animations, mixer, scene])

  const bones = useMemo(() => {
    const map = new Map<string, { bone: THREE.Object3D; rest: THREE.Quaternion }>()
    scene.traverse((object) => {
      if ((object as THREE.Bone).isBone) {
        // The rest orientation is captured here, once, before any clip has run.
        // An emote needs it: composing an arm angle onto whatever `Idle_Neutral`
        // happened to leave the shoulder at means the angle is off by however
        // far the clip had moved it, which for these arms is most of a right
        // angle. Sitting can compose, because folding a hip by a fixed amount
        // from wherever it is reads correctly; an arm pointing somewhere
        // specific cannot.
        map.set(joint(object.name), { bone: object, rest: object.quaternion.clone() })
      }
    })
    return map
  }, [scene])

  const current = useRef<string | null>(null)

  // Shadows, and the shirt colour. Cloned materials, because the cache hands
  // every avatar the same material instance and tinting one would tint all.
  useEffect(() => {
    scene.traverse((object) => {
      const mesh = object as THREE.Mesh
      if (!mesh.isMesh) return
      mesh.castShadow = true
      mesh.receiveShadow = true
      if (!color) return
      // Keep the material's *shape*. Wrapping a single material in a
      // one-element array — which is what mapping over `[mesh.material]` and
      // assigning the result does — leaves a mesh whose geometry has no groups
      // with an array it cannot index, and three.js draws nothing at all. Every
      // avatar was invisible and neither the console nor the loader said a word.
      // Only the garment on the torso. The packs name their materials by
      // colour rather than by role — `Purple`, `LightBlue`, `Suit` — so the
      // test is which mesh it is on and which materials are *not* clothing.
      const onBody = /_Body$/.test(mesh.name) || /_Body$/.test(mesh.parent?.name ?? '')
      const tint = (material: THREE.Material) => {
        const clone = (material as THREE.MeshStandardMaterial).clone()
        if (onBody && !KEEP_COLOUR.test(clone.name)) clone.color.set(color)
        return clone
      }
      mesh.material = Array.isArray(mesh.material)
        ? mesh.material.map(tint)
        : tint(mesh.material)
    })
  }, [scene, color])

  useEffect(() => {
    // A new mixer has nothing playing on it, so the name of the clip the
    // previous one was running must not survive into the frame loop. It is a
    // ref, so it does: changing `variant` swaps the URL, the scene, the mixer
    // and the actions, and the frame loop then saw `want === current` and
    // started nothing. The new model stood in its bind pose.
    current.current = null
    return () => {
      mixer.stopAllAction()
    }
  }, [mixer])

  useFrame((state, delta) => {
    const want = clipFor(pose, ground, isMoving)
    if (want !== current.current) {
      const next = actions.get(want)
      const previous = current.current ? actions.get(current.current) : undefined
      if (next) {
        next.reset().fadeIn(0.18).play()
        previous?.fadeOut(0.18)
        current.current = want
      }
    }

    mixer.update(delta)

    // After the mixer, never before: it writes the whole skeleton each frame.

    // Composed onto what the clip wrote, not substituted for it. Assigning the
    // rotation outright throws away the joint's rest orientation — the pack's
    // leg bones do not sit axis-aligned — and the legs come out twisted into
    // sticks rather than folded.
    // Turned towards the heading rather than snapped to it, and never the long
    // way round. Sitting locks the body to the seat's facing.
    const group = body.current
    if (group) {
      if (!placed.current) {
        placed.current = true
        group.rotation.y = target
      } else {
        group.rotation.y =
          pose === 'sitting'
            ? target
            : approachAngle(group.rotation.y, target, TURN_RATE * Math.min(delta, 0.1))
      }
    }

    if (pose === 'sitting') {
      for (const [name, angle, frame] of SEATED) {
        const found = bones.get(name)
        if (!found) continue
        FOLD.setFromAxisAngle(HINGE, angle)
        if (frame === 'parent') found.bone.quaternion.premultiply(FOLD)
        else found.bone.quaternion.multiply(FOLD)
      }
      return
    }

    // The emotes the pack has no clip for. Posed from the rest orientation
    // rather than composed onto the clip — see `EMOTE_POSES` — and after the
    // mixer, which has just written the whole skeleton.
    const aims = EMOTE_POSES[pose]
    if (!aims) return

    // Nought to one and back, so a clap closes and opens rather than swinging
    // through and out the other side.
    const beat = (Math.sin(state.clock.elapsedTime * CLAP_RATE) + 1) / 2
    const bodyQuat = group ? group.getWorldQuaternion(BODY_QUAT) : IDENTITY

    for (const aim of aims) {
      const found = bones.get(aim.joint)
      if (!found) continue

      AXIS.set(aim.aim[0], aim.aim[1], aim.aim[2])
      if (aim.beat) {
        BEAT.set(aim.beat[0], aim.beat[1], aim.beat[2])
        AXIS.lerp(BEAT, beat)
      }
      if (AXIS.lengthSq() < 1e-8) continue
      // Body space to world, so "up" survives the player turning round.
      AXIS.normalize().applyQuaternion(bodyQuat)

      // The rotation that takes the bone's own axis to where it should point.
      // A bone runs down its local +Y here — the pack parents each joint at
      // [0, length, 0] from the last — so that is the vector being aimed.
      WORLD_AIM.setFromUnitVectors(BONE_AXIS, AXIS)
      found.bone.parent?.getWorldQuaternion(PARENT_QUAT)
      found.bone.quaternion.copy(PARENT_QUAT).invert().multiply(WORLD_AIM)
    }
  })

  // No `rotation` prop: r3f writes an array prop straight onto the object, so
  // a changing `rotation={[0, target, 0]}` would overwrite the value `useFrame`
  // is interpolating and a remote player would snap round instead of turning.
  return (
    <group ref={body}>
      <primitive object={scene} scale={PLAYER_HEIGHT / MODEL_HEIGHT} />
    </group>
  )
}

for (const url of AVATAR_MODELS) useGLTF.preload(url)

export default GltfCharacter
