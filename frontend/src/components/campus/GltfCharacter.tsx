import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
// From three itself rather than `three-stdlib`, which is only here as a
// transitive dependency of drei and could vanish under a minor bump.
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js'

import {
  RUN_SPEED,
  TURN_RATE,
  WALK_SPEED,
  approachAngle,
  gaitFor,
  isPosedEmote,
  poseTurns,
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
 */
const FACING = new Map<string, number>([
  ['down', 0],
  ['up', Math.PI],
  ['left', Math.PI / 2],
  ['right', -Math.PI / 2],
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

/** The packs the campus ships, built by `scripts/build-avatars.mjs`. */
export const AVATAR_MODELS = [
  '/avatars/Casual_Hoodie.glb',
  '/avatars/Casual_2.glb',
  '/avatars/Suit.glb',
] as const

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
 * playing the wave would slide them across the floor in a standing pose.
 *
 * Everything the pack has no clip for is a still idle with the joints posed
 * over it, which `poseTurns` supplies. It used to borrow instead: clapping and
 * pointing took `Interact`, which is a reach for a switch, and a raised hand
 * took `Wave`. Borrowing is fine when the substitute is vague and wrong when it
 * is specific — a wave is unmistakably a wave, so asking for a raised hand and
 * getting one is not a near miss, it is a different gesture.
 */
export function clipFor(activity: Activity, speed: number, isMoving: boolean): Clip {
  if (isMoving || speed > 0.4) {
    return speed > (WALK_SPEED + RUN_SPEED) / 2 ? 'Run' : 'Walk'
  }
  // The one emote the pack does have, and its own is better than six angles.
  if (activity === 'waving') return 'Wave'
  if (isPosedEmote(activity) || activity === 'sitting' || activity === 'leaning') {
    return 'Idle_Neutral'
  }
  return 'Idle'
}

/**
 * How fast to play a gait clip so the feet do not skate.
 *
 * The clips are baked at one speed each. Played at that speed they are right,
 * and played at any other the stride length is wrong by exactly the ratio —
 * a player creeping forward at a metre a second used to march. Normalised so
 * that the nominal speed is 1, and following the same square-root law `gaitFor`
 * documents: going twice as fast is mostly a longer stride, not twice as many
 * steps.
 */
export function clipRate(clip: Clip, speed: number): number {
  if (clip !== 'Walk' && clip !== 'Run') return 1
  const nominal = clip === 'Run' ? RUN_SPEED : WALK_SPEED
  const rate = gaitFor(speed).cadence / gaitFor(nominal).cadence
  return Math.min(1.8, Math.max(0.55, rate))
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

/** Picks a pack from a seed of either shape, deterministically. */
export function packIndex(variant: number | string): number {
  if (typeof variant === 'number' && Number.isFinite(variant)) {
    return Math.abs(Math.trunc(variant)) % AVATAR_MODELS.length
  }
  let hash = 0
  for (const character of String(variant)) {
    hash = (hash * 31 + character.charCodeAt(0)) | 0
  }
  return Math.abs(hash) % AVATAR_MODELS.length
}

/** Scratch objects, so a posed player does not allocate two per joint per frame. */
const AXES = {
  x: new THREE.Vector3(1, 0, 0),
  y: new THREE.Vector3(0, 1, 0),
  z: new THREE.Vector3(0, 0, 1),
} as const
const FOLD = new THREE.Quaternion()

export function GltfCharacter({
  variant = 0,
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
  const url = AVATAR_MODELS[packIndex(variant)]
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
    const map = new Map<string, THREE.Object3D>()
    scene.traverse((object) => {
      if ((object as THREE.Bone).isBone) map.set(joint(object.name), object)
    })
    return map
  }, [scene])

  /**
   * Every joint's rest orientation, taken before anything animates it.
   *
   * A pose is measured against the pack's A-pose and has to be applied against
   * it too. Composed onto whatever the clip happened to write instead, the
   * angles are all off by however far that clip had moved the joint — which for
   * `Idle_Neutral`'s arms is most of a right angle, and turned a clap into a
   * pair of arms held straight out sideways and a raised hand into an arm
   * pointing at the wall.
   *
   * Safe to read here: `useGLTF` hands back one parsed scene per URL and never
   * animates it, and every mixer runs on a clone, so this clone is still at
   * rest until the frame loop starts.
   */
  const restPose = useMemo(() => {
    const map = new Map<string, THREE.Quaternion>()
    scene.traverse((object) => {
      if ((object as THREE.Bone).isBone) map.set(joint(object.name), object.quaternion.clone())
    })
    return map
  }, [scene])

  /** Which joints this frame has already reset, so two turns compose. */
  const reset = useRef(new Set<string>())

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
    // Every frame rather than on the change, because the speed moves
    // continuously within a clip and the stride has to follow it.
    const playing = actions.get(want)
    if (playing) playing.timeScale = clipRate(want, ground)

    mixer.update(delta)

    // After the mixer, never before: it writes the whole skeleton each frame.

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

    // The joints an emote poses, over the clip the mixer just wrote.
    //
    // Each posed joint goes back to its rest orientation first and the turn is
    // composed onto that — never assigned outright, which would throw the rest
    // orientation away, and none of the pack's limb bones sit axis-aligned, so
    // the limbs come out twisted into sticks rather than folded.
    //
    // Only the joints an emote names: everything else is still playing the
    // clip, which is what keeps a clapping student breathing.
    //
    // Skipped while travelling, for the same reason `clipFor` puts movement
    // first: a player clapping on the move is walking, and holding their arms
    // in front of their chest through the walk cycle reads as a bug.
    if (isMoving || ground > 0.4) return
    const turns = poseTurns(pose, state.clock.elapsedTime)
    if (turns.length === 0) return

    reset.current.clear()
    for (const turn of turns) {
      const name = joint(turn.joint)
      const bone = bones.get(name)
      if (!bone) continue
      if (!reset.current.has(name)) {
        const rest = restPose.get(name)
        if (rest) bone.quaternion.copy(rest)
        reset.current.add(name)
      }
      FOLD.setFromAxisAngle(AXES[turn.axis], turn.angle)
      if (turn.frame === 'parent') bone.quaternion.premultiply(FOLD)
      else bone.quaternion.multiply(FOLD)
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
