import { useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { BoxGeometry, BufferGeometry, Group, MathUtils } from 'three'
// From three itself rather than `three-stdlib`, which is only here as a
// transitive dependency of drei and could vanish under a minor bump.
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

import { DOOR_SWING } from './doorState'

/**
 * A door you can see, and see swing.
 *
 * The openings used to be holes: a gap in the collider with nothing in it, so
 * there was no door to look at from outside and nothing at all from inside a
 * room, where the way out was an invisible line on the floor.
 *
 * Two leaves hinged at the jambs rather than one slab, because a double door
 * is what a building this size has, and because two leaves swinging apart
 * reads as opening from any angle. One slab pivoting on a corner only reads
 * from the side.
 *
 * ## Two kinds of door
 *
 * `plain` is a flush leaf with a glazed upper panel: every door inside the
 * building, where you are half a metre away and moving through it.
 *
 * `screen` is the front door of 183 Nizami Street, from the photograph — a
 * stile-and-rail timber screen glazed with a grid of small square panes over
 * fielded panels at the foot. That is fifty-odd separate pieces of timber, so
 * they are merged into one geometry per material and drawn as three meshes a
 * leaf. Left as separate meshes it is ninety draw calls for one doorway, on a
 * campus whose whole budget is about two hundred.
 */
export type DoorStyle = 'plain' | 'screen'

/** Stained walnut, and the near-black of glass with a lit hall behind it. */
const TIMBER = '#6b4526'
const GLASS = '#93bcd6'

/**
 * The screen, as a stack of bands up the leaf, in fractions of its height.
 *
 * Read off the photograph: solid panels at the foot, a short two-row light
 * above them, a broad middle rail, then the tall five-row light that is most of
 * the door.
 */
const BOTTOM_PANEL = [0.05, 0.27] as const
const LOWER_LIGHT = [0.32, 0.5] as const
const UPPER_LIGHT = [0.56, 0.96] as const

/**
 * The timber and the glass of one leaf of the entrance screen.
 *
 * Built in the leaf's own frame: x from 0 at the hinge to `width` at the
 * meeting stile, y from 0 at the threshold to `height`, thickness about z.
 */
function screenGeometry(width: number, height: number) {
  const timber: BufferGeometry[] = []
  const glass: BufferGeometry[] = []
  const put = (
    into: BufferGeometry[],
    w: number,
    h: number,
    d: number,
    x: number,
    y: number,
    z = 0,
  ) => {
    const box = new BoxGeometry(w, h, d)
    box.translate(x, y, z)
    into.push(box)
  }

  const stile = 0.14
  const thick = 0.13
  /** The muntin down the middle, which splits the leaf into two bays. */
  const muntin = 0.1
  const bayWidth = (width - stile * 2 - muntin) / 2
  const bays = [stile + bayWidth / 2, width - stile - bayWidth / 2]

  // Stiles and the muntin, full height.
  put(timber, stile, height, thick, stile / 2, height / 2)
  put(timber, stile, height, thick, width - stile / 2, height / 2)
  put(timber, muntin, height, thick, width / 2, height / 2)

  // Rails: the foot, under and over the lower light, and the head.
  const rails: [number, number][] = [
    [0, BOTTOM_PANEL[0] * height],
    [BOTTOM_PANEL[1] * height, LOWER_LIGHT[0] * height],
    [LOWER_LIGHT[1] * height, UPPER_LIGHT[0] * height],
    [UPPER_LIGHT[1] * height, height],
  ]
  for (const [from, to] of rails) {
    put(timber, width, to - from, thick, width / 2, (from + to) / 2)
  }

  // The panels at the foot, and the raised field on each face of them.
  //
  // The panel first, and it is not optional decoration: without it the bay
  // between the rails and the stiles is a hole, and the bottom quarter of the
  // door is somewhere you can see the porch through.
  for (const bay of bays) {
    const from = BOTTOM_PANEL[0] * height
    const to = BOTTOM_PANEL[1] * height
    put(timber, bayWidth, to - from, thick * 0.55, bay, (from + to) / 2)
    for (const face of [thick / 2, -thick / 2]) {
      put(timber, bayWidth - 0.16, to - from - 0.14, 0.045, bay, (from + to) / 2, face)
    }
  }

  // The two lights, and the glazing bars that make them a grid of small panes.
  // Two columns and a row count per bay, which comes out at eight columns
  // across the pair of leaves — which is what the photograph has.
  const lights: [readonly [number, number], number][] = [
    [LOWER_LIGHT, 2],
    [UPPER_LIGHT, 5],
  ]
  for (const [span, rows] of lights) {
    const from = span[0] * height
    const to = span[1] * height
    for (const bay of bays) {
      put(glass, bayWidth, to - from, 0.03, bay, (from + to) / 2)
      // One vertical bar per bay: two panes across.
      put(timber, 0.055, to - from, thick * 0.8, bay, (from + to) / 2)
      for (let r = 1; r < rows; r++) {
        put(timber, bayWidth, 0.055, thick * 0.8, bay, from + ((to - from) * r) / rows)
      }
    }
  }

  return {
    timber: mergeGeometries(timber, false)!,
    glass: mergeGeometries(glass, false)!,
  }
}

export default function DoorLeaf({
  x,
  z,
  halfWidth,
  height = 4.4,
  sill = 0,
  swing,
  /** Which way the leaves swing away from the player. */
  facing = 1,
  style = 'plain',
}: {
  x: number
  z: number
  halfWidth: number
  height?: number
  /** How far the threshold sits above the floor, so the leaf stands on it. */
  sill?: number
  /** 0 shut, 1 fully open. */
  swing: number
  facing?: 1 | -1
  style?: DoorStyle
}) {
  const left = useRef<Group>(null)
  const right = useRef<Group>(null)
  const placed = useRef(false)

  const leafWidth = halfWidth
  const screen = useMemo(
    () => (style === 'screen' ? screenGeometry(leafWidth, height) : null),
    [style, leafWidth, height],
  )
  useLayoutEffect(
    () => () => {
      screen?.timber.dispose()
      screen?.glass.dispose()
    },
    [screen],
  )

  // Seeded once, for the same reason the target below carries the half-turn:
  // the first frame would otherwise lerp up from zero and the door would be
  // seen to assemble itself.
  //
  // In a layout effect rather than the render body. React attaches refs during
  // commit, so on the first render both were still null, the guard failed, and
  // `placed` stayed false — by the time the refs existed `useFrame` had already
  // lerped the leaves up from zero, which is the exact artefact this prevents.
  // It also mutated refs during render, which Strict Mode runs twice.
  useLayoutEffect(() => {
    if (placed.current || !left.current || !right.current) return
    placed.current = true
    left.current.rotation.y = -DOOR_SWING * swing * facing
    right.current.rotation.y = Math.PI + DOOR_SWING * swing * facing
    // Mount only: every later change is what the lerp is for.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useFrame(() => {
    // Driven per frame rather than through React state: the swing changes
    // every frame while a door moves, and re-rendering the scene graph for it
    // would cost far more than setting two rotations.
    const angle = DOOR_SWING * swing * facing
    if (left.current) left.current.rotation.y = MathUtils.lerp(left.current.rotation.y, -angle, 0.35)
    // The right leaf is mounted turned about, so that the same panel geometry
    // extends back across the opening from the far jamb. Its half-turn has to
    // be part of the target here, not a declarative `rotation` prop: r3f
    // writes array props straight onto the object, so the prop set the base
    // angle once and this line then drove it to zero — which swung the leaf
    // out of the doorway and into the pier, leaving the right half of every
    // shut door standing open.
    if (right.current) {
      right.current.rotation.y = MathUtils.lerp(right.current.rotation.y, Math.PI + angle, 0.35)
    }
  })

  const panel = screen ? (
    <>
      <mesh geometry={screen.timber} castShadow receiveShadow>
        <meshStandardMaterial color={TIMBER} roughness={0.5} metalness={0.06} />
      </mesh>
      <mesh geometry={screen.glass}>
        <meshStandardMaterial
          color={GLASS}
          roughness={0.14}
          metalness={0.2}
          transparent
          opacity={0.42}
        />
      </mesh>
      {/* The pull, on the meeting stile. */}
      {[0.11, -0.11].map((face) => (
        <mesh key={face} position={[leafWidth - 0.16, height * 0.42, face]}>
          <sphereGeometry args={[0.075, 10, 8]} />
          <meshStandardMaterial color="#b39a55" roughness={0.35} metalness={0.6} />
        </mesh>
      ))}
    </>
  ) : (
    <>
      <mesh position={[leafWidth / 2, height / 2, 0]} castShadow>
        <boxGeometry args={[leafWidth, height, 0.12]} />
        <meshStandardMaterial color="#5a4632" roughness={0.55} metalness={0.12} />
      </mesh>
      {/* A glazed upper panel, so a lit room shows through a shut door. On
          both faces: the right leaf is mounted turned about, so a panel on one
          side only showed the outside world a blank slab. */}
      {[0.07, -0.07].map((face) => (
        <mesh key={face} position={[leafWidth / 2, height * 0.68, face]}>
          <boxGeometry args={[leafWidth * 0.62, height * 0.34, 0.02]} />
          <meshStandardMaterial
            color="#9fd6ff"
            roughness={0.15}
            metalness={0.35}
            transparent
            opacity={0.55}
          />
        </mesh>
      ))}
      {/* The handle, which is the thing that tells you it opens at all. */}
      {[0.1, -0.1].map((face) => (
        <mesh key={face} position={[leafWidth * 0.88, height * 0.44, face]}>
          <boxGeometry args={[0.1, 0.5, 0.08]} />
          <meshStandardMaterial color="#c9a227" roughness={0.3} metalness={0.8} />
        </mesh>
      ))}
    </>
  )

  return (
    <group position={[x, sill, z]}>
      {/* Hinged at the jambs: each group sits at its own edge of the opening
          and the panel extends inwards from there, so rotating the group
          swings the leaf about the hinge rather than about its middle. */}
      <group ref={left} position={[-halfWidth, 0, 0]}>
        {panel}
      </group>
      <group ref={right} position={[halfWidth, 0, 0]}>
        {panel}
      </group>
    </group>
  )
}
