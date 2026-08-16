import { describe, it, expect } from 'vitest'

import {
  PROP_COLLIDERS,
  HEADROOM,
  SOLID_CAMPUS,
  collidersAt,
  STEP_UP,
  approachStep,
  blockingPlatforms,
  groundHeight,
  insideCollider,
  leanSurface,
  resolveColliders,
  sightlineBlocker,
  type Collider,
  type Platform,
} from './campusPhysics'
import {
  CAMPUS_LIMIT,
  FOUNTAIN_RADIUS,
  PLAYER_RADIUS,
  QUAD_CENTRE,
  SPAWN,
  campusBenches,
  campusLamps,
  campusTrees,
} from './campusLayout'

/**
 * The collision layer.
 *
 * Everything here was previously walk-through: a hundred and fifty trees, the
 * fountain, every bench, and all of the furniture indoors.
 */

describe('resolveColliders', () => {
  const box: Collider = { x: 0, z: 0, halfW: 2, halfD: 1 }

  it('leaves a position that is already clear alone', () => {
    expect(resolveColliders(10, 10, [box])).toEqual({ x: 10, z: 10 })
  })

  it('pushes out along the shallower axis, so you slide along a wall', () => {
    // Just inside the long face: the way out is in z, not the length of the box.
    const out = resolveColliders(0, 1.2, [box], 0.5)
    expect(out.z).toBeCloseTo(1.5)
    expect(out.x).toBeCloseTo(0)
  })

  it('clears the player radius, not just the surface', () => {
    const out = resolveColliders(0, 1.4, [box], PLAYER_RADIUS)
    expect(out.z).toBeGreaterThanOrEqual(1 + PLAYER_RADIUS - 1e-9)
  })

  it('resolves a turned box in its own frame', () => {
    // A box turned 90 degrees is 1 deep in x and 2 in z.
    const turned: Collider = { x: 0, z: 0, halfW: 2, halfD: 1, ry: Math.PI / 2 }
    const out = resolveColliders(0.5, 0, [turned], 0.2)
    expect(Math.abs(out.x)).toBeCloseTo(1.2)
    expect(out.z).toBeCloseTo(0)
  })

  it('pushes out of a circle along the radial', () => {
    const circle: Collider = { x: 0, z: 0, radius: 3 }
    const out = resolveColliders(1, 1, [circle], 0.5)
    expect(Math.hypot(out.x, out.z)).toBeCloseTo(3.5)
    // Same bearing it went in on.
    expect(out.x).toBeCloseTo(out.z)
  })

  it('does not return NaN for a position exactly on a circle centre', () => {
    // Normalising a zero-length vector is NaN, and a NaN camera ends the session.
    const out = resolveColliders(0, 0, [{ x: 0, z: 0, radius: 2 }], 0.5)
    expect(Number.isFinite(out.x)).toBe(true)
    expect(Number.isFinite(out.z)).toBe(true)
    expect(Math.hypot(out.x, out.z)).toBeCloseTo(2.5)
  })

  it('settles a position between two boxes with an alley between them', () => {
    // Note what is *not* claimed here. Two boxes sharing an edge exactly are a
    // known trap for a least-penetration resolver: on the seam each pushes you
    // into the other and no number of passes settles it. The layout avoids the
    // case rather than the resolver handling it — the street terrace is merged
    // into one collider for exactly this reason, and `interiorPhysics.test.ts`
    // forbids a pair from being placed closer than a person is wide.
    const pair: Collider[] = [
      { x: -3, z: 0, halfW: 2, halfD: 2 },
      { x: 3, z: 0, halfW: 2, halfD: 2 },
    ]
    const out = resolveColliders(0.9, 0, pair, 0.4)
    for (const rect of pair) {
      expect(insideCollider(out.x, out.z, rect, 0.4 - 1e-6)).toBe(false)
    }
  })

  it('terminates on a position that cannot be resolved', () => {
    // Boxed in on all sides. Must return rather than loop.
    const cage: Collider[] = [
      { x: -1, z: 0, halfW: 1, halfD: 4 },
      { x: 1, z: 0, halfW: 1, halfD: 4 },
      { x: 0, z: -1, halfW: 4, halfD: 1 },
      { x: 0, z: 1, halfW: 4, halfD: 1 },
    ]
    const out = resolveColliders(0, 0, cage, 0.5)
    expect(Number.isFinite(out.x)).toBe(true)
  })
})

describe('insideCollider', () => {
  it('respects a turned box', () => {
    const turned: Collider = { x: 0, z: 0, halfW: 3, halfD: 0.5, ry: Math.PI / 2 }
    // Along the box's length, which after the turn runs in z.
    expect(insideCollider(0, 2.5, turned)).toBe(true)
    expect(insideCollider(2.5, 0, turned)).toBe(false)
  })

  it('measures a circle radially rather than as its bounding square', () => {
    const circle: Collider = { x: 0, z: 0, radius: 2 }
    expect(insideCollider(1.9, 0, circle)).toBe(true)
    // Inside the bounding box, outside the circle.
    expect(insideCollider(1.8, 1.8, circle)).toBe(false)
  })
})

describe('the props are solid', () => {
  it('makes every tree, lamp and bench collide', () => {
    const expected = campusTrees().length + campusLamps().length + campusBenches().length + 1
    expect(PROP_COLLIDERS).toHaveLength(expected)
  })

  it('stops you walking through the fountain', () => {
    const [fx, fz] = QUAD_CENTRE
    const out = resolveColliders(fx + 1, fz, SOLID_CAMPUS)
    expect(Math.hypot(out.x - fx, out.z - fz)).toBeGreaterThanOrEqual(FOUNTAIN_RADIUS)
  })

  it('keeps the spawn point out of everything solid', () => {
    const settled = resolveColliders(SPAWN[0], SPAWN[2], SOLID_CAMPUS)
    expect(settled.x).toBeCloseTo(SPAWN[0])
    expect(settled.z).toBeCloseTo(SPAWN[2])
  })

  it('leaves the campus walkable rather than fencing it off', () => {
    // A forest of solid trunks could in principle seal a route. Sample the
    // whole map and require that most of it is still open ground.
    let free = 0
    let total = 0
    for (let x = -CAMPUS_LIMIT; x <= CAMPUS_LIMIT; x += 10) {
      for (let z = -CAMPUS_LIMIT; z <= CAMPUS_LIMIT; z += 10) {
        total++
        const out = resolveColliders(x, z, SOLID_CAMPUS)
        if (Math.hypot(out.x - x, out.z - z) < 1e-6) free++
      }
    }
    expect(total).toBeGreaterThan(1000)
    expect(free / total).toBeGreaterThan(0.7)
  })
})

describe('groundHeight', () => {
  const stair: Platform[] = [
    { x: 0, z: 0, halfW: 2, halfD: 0.5, top: 0.5 },
    { x: 0, z: -1, halfW: 2, halfD: 0.5, top: 1.0 },
    { x: 0, z: -2, halfW: 2, halfD: 0.5, top: 1.5 },
  ]

  it('is zero on open floor', () => {
    expect(groundHeight(10, 10, stair)).toBe(0)
  })

  it('puts you on a step you are standing on', () => {
    expect(groundHeight(0, 0, stair, 0)).toBe(0.5)
  })

  it('lets you climb one step at a time', () => {
    expect(groundHeight(0, -1, stair, 0.5)).toBe(1.0)
    expect(groundHeight(0, -2, stair, 1.0)).toBe(1.5)
  })

  it('does not snap you onto something out of reach', () => {
    // Standing at the bottom, the third step is 1.5 up. You do not teleport.
    expect(groundHeight(0, -2, stair, 0)).toBe(0)
  })

  it('treats what you cannot step onto as a wall instead', () => {
    const blocking = blockingPlatforms(stair, 0)
    // From the floor, the two higher steps are walls; the first is walkable.
    expect(blocking.map((p) => (p as Platform).top)).toEqual([1.0, 1.5])
    expect(blockingPlatforms(stair, 1.0)).toHaveLength(0)
  })

  it('keeps every riser within a single step', () => {
    const tops = stair.map((p) => p.top).sort((a, b) => a - b)
    for (let i = 1; i < tops.length; i++) {
      expect(tops[i] - tops[i - 1]).toBeLessThanOrEqual(STEP_UP)
    }
  })
})

describe('walking under things', () => {
  /**
   * A platform used to block from below however high it was, which fenced 84
   * square metres of the entrance hall off under a staircase you can see
   * through — and, more fundamentally, meant a room could never have two
   * floors in it, because the upper slab became a wall across the whole plan.
   */
  const slab = (top: number, walkUnder = false): Platform => ({
    x: 0,
    z: 0,
    halfW: 20,
    halfD: 20,
    top,
    walkUnder,
  })

  it('still stops you at the edge of anything solid, however high', () => {
    // An amphitheatre tier is a block of concrete. Its edge stops you from the
    // floor whether it is one step up or five metres up, and that is right.
    expect(blockingPlatforms([slab(1.5)], 0)).toHaveLength(1)
    expect(blockingPlatforms([slab(4.55)], 0)).toHaveLength(1)
    expect(blockingPlatforms([slab(12)], 0)).toHaveLength(1)
  })

  it('lets you walk under a surface that says there is room beneath it', () => {
    expect(blockingPlatforms([slab(4.55, true)], 0)).toHaveLength(0)
  })

  it('still stops you ducking under something lower than a door', () => {
    // There is no room under a step a metre off the ground, whatever it says.
    expect(blockingPlatforms([slab(1.05, true)], 0)).toHaveLength(1)
    expect(blockingPlatforms([slab(HEADROOM - 0.01, true)], 0)).toHaveLength(1)
    expect(blockingPlatforms([slab(HEADROOM + 0.01, true)], 0)).toHaveLength(0)
  })

  it('is measured from the feet, not from the ground', () => {
    // Standing on the first floor, the second floor's slab is over your head
    // in exactly the same way the first one was from the ground.
    expect(blockingPlatforms([slab(9.1, true)], 4.55)).toHaveLength(0)
    // And the floor you are standing on is not a wall.
    expect(blockingPlatforms([slab(4.55, true)], 4.55)).toHaveLength(0)
  })

  it('lets a room have a floor above it at all', () => {
    // The case that made this necessary: two slabs a storey apart. Before, the
    // upper one was a 40 x 40 m wall and the resolver pushed the player out of
    // the building through its own ceiling.
    const storeys = [slab(0, true), slab(4.55, true)]
    const solid = blockingPlatforms(storeys, 0)
    expect(solid).toHaveLength(0)
    expect(resolveColliders(0, 0, solid)).toEqual({ x: 0, z: 0 })
  })

  it('still lands you on the floor you are under, not the one above', () => {
    // `groundHeight` was already right about this; the change must not alter it.
    const storeys = [slab(0, true), slab(4.55, true)]
    expect(groundHeight(0, 0, storeys, 0)).toBe(0)
    expect(groundHeight(0, 0, storeys, 4.55)).toBe(4.55)
  })
})

describe('sightlineBlocker', () => {
  const eye = { x: 0, y: 1.6, z: 10 }
  const screen = { x: 0, y: 5, z: -10 }

  it('reports nothing across an empty room', () => {
    expect(sightlineBlocker(eye, screen, [])).toBeNull()
  })

  it('reports a wall standing in the way', () => {
    const wall: Collider = { x: 0, z: 0, halfW: 5, halfD: 0.5, height: 6 }
    expect(sightlineBlocker(eye, screen, [wall])).toBe(wall)
  })

  it('ignores something too low to reach the line of sight', () => {
    // A dining table on the floor plan sits between the seat and the screen and
    // hides nothing at all. Height is the whole reason colliders carry one.
    const table: Collider = { x: 0, z: 0, halfW: 5, halfD: 0.5, height: 0.8 }
    expect(sightlineBlocker(eye, screen, [table])).toBeNull()
  })

  it('ignores something off to the side', () => {
    const aside: Collider = { x: 12, z: 0, halfW: 2, halfD: 2, height: 6 }
    expect(sightlineBlocker(eye, screen, [aside])).toBeNull()
  })

  it('treats a collider that declares no height as a wall', () => {
    // Failing to declare a height must block the view, not silently pass.
    const unknown: Collider = { x: 0, z: 0, halfW: 5, halfD: 0.5 }
    expect(sightlineBlocker(eye, screen, [unknown])).toBe(unknown)
  })

  it('does not report the obstruction at either end of the line', () => {
    // The screen's own backing board is at the far end and is not in the way.
    const atTarget: Collider = { x: 0, z: -10, halfW: 5, halfD: 0.4, height: 9 }
    expect(sightlineBlocker(eye, screen, [atTarget])).toBeNull()
  })
})

describe('leaning', () => {
  const wall: Collider = { x: 0, z: -2, halfW: 6, halfD: 0.5 }

  it('finds a wall at the player’s back', () => {
    // Heading zero faces +Z, so the wall wanted is the one at -Z.
    expect(leanSurface(0, -1, 0, [wall])).toBe(true)
  })

  it('does not lean on a wall the player is facing', () => {
    // Turned around, the same wall is in front of them, and leaning backwards
    // onto nothing is how an avatar ends up lying in the air.
    expect(leanSurface(0, -1, Math.PI, [wall])).toBe(false)
  })

  it('does not reach across a room', () => {
    expect(leanSurface(0, 6, 0, [wall])).toBe(false)
  })

  it('leans on the room’s own wall', () => {
    // Interior walls are a clamp on the camera, not colliders. Checking only
    // the collider list refuses the one surface every room is guaranteed to
    // have, which is most of the walls anybody would want to lean on.
    // Backed up against the clamp at -Z, which means facing +Z.
    expect(leanSurface(0, -20, 0, [], 20)).toBe(true)
    // And against the one at -X, which means facing +X.
    expect(leanSurface(-20, 0, Math.PI / 2, [], 20)).toBe(true)
    // A pace off the wall is still within reach, two paces is not.
    expect(leanSurface(0, -19.5, 0, [], 20)).toBe(true)
    expect(leanSurface(0, -18, 0, [], 20)).toBe(false)
    expect(leanSurface(0, 0, 0, [], 20)).toBe(false)
  })

  it('finds a pillar behind the player', () => {
    const column: Collider = { x: 0, z: -1.5, radius: 0.6 }
    expect(leanSurface(0, -0.7, 0, [column])).toBe(true)
  })
})

describe('following somebody', () => {
  it('steps towards them', () => {
    const step = approachStep({ x: 0, z: 0 }, { x: 0, z: 10 }, 1, 2.6)
    expect(step).not.toBeNull()
    expect(step!.z).toBeCloseTo(1)
    expect(step!.x).toBeCloseTo(0)
  })

  it('stops short rather than standing inside them', () => {
    // The avatar is drawn at the position it reports, so closing to zero puts
    // the follower's camera inside somebody's head.
    expect(approachStep({ x: 0, z: 0 }, { x: 0, z: 2 }, 1, 2.6)).toBeNull()
  })

  it('does not overshoot on the last step', () => {
    // Arriving should be standing next to them, not sailing past and turning
    // round to come back.
    const step = approachStep({ x: 0, z: 0 }, { x: 0, z: 3 }, 5, 2.6)
    expect(step!.z).toBeCloseTo(0.4)
  })

  it('survives being exactly on top of the target', () => {
    // The direction is undefined there. Normalising a zero vector gives NaN,
    // which puts the follower at NaN and takes the camera off the campus.
    expect(approachStep({ x: 4, z: 4 }, { x: 4, z: 4 }, 1, 0)).toBeNull()
  })

  it('walks diagonally when they are diagonal', () => {
    const step = approachStep({ x: 0, z: 0 }, { x: 10, z: 10 }, 1, 0)
    expect(step!.x).toBeCloseTo(Math.SQRT1_2)
    expect(step!.z).toBeCloseTo(Math.SQRT1_2)
  })
})


describe('colliders know which floor they are on', () => {
  /**
   * A `Collider` used to be a plan shape and nothing else: whatever height it
   * declared, it stopped you at every height. Harmless while a room had one
   * floor, and the reason a room could not have four — a bench in a
   * second-floor window bay stopped somebody in the entrance hall below it,
   * and a rail round a stairwell on the top floor railed the ground floor too.
   */
  const bench = (base: number): Collider => ({
    x: 0,
    z: 0,
    halfW: 1,
    halfD: 1,
    base,
    height: base + 0.6,
  })

  it('stops you when you are level with it', () => {
    expect(collidersAt([bench(0)], 0)).toHaveLength(1)
    expect(collidersAt([bench(4.55)], 4.55)).toHaveLength(1)
  })

  it('does not stop you from a different floor', () => {
    // The case that made this necessary.
    expect(collidersAt([bench(4.55)], 0)).toHaveLength(0)
    expect(collidersAt([bench(0)], 4.55)).toHaveLength(0)
    expect(collidersAt([bench(9.1)], 4.55)).toHaveLength(0)
  })

  it('lets you walk under something above your head', () => {
    const beam: Collider = { x: 0, z: 0, halfW: 1, halfD: 1, base: 2.4, height: 3 }
    expect(collidersAt([beam], 0)).toHaveLength(0)
    expect(collidersAt([beam], 1.2)).toHaveLength(1)
  })

  it('leaves everything that came before it alone', () => {
    // No base and no height is a wall standing on the ground: that is what the
    // whole campus already assumed, and it must not change.
    const wall: Collider = { x: 0, z: 0, halfW: 1, halfD: 1 }
    for (const feet of [0, 1, 3.75, 12]) {
      expect(collidersAt([wall], feet), `at ${feet}`).toHaveLength(1)
    }
    // And a desk with a height but no base still stops you at floor level.
    const desk: Collider = { x: 0, z: 0, halfW: 1, halfD: 1, height: 1.25 }
    expect(collidersAt([desk], 0)).toHaveLength(1)
  })

  it('does not treat the floor you are standing on as a wall', () => {
    // A kerb whose top is exactly at your feet is something you are on top of.
    const kerb: Collider = { x: 0, z: 0, halfW: 1, halfD: 1, height: 0.2 }
    expect(collidersAt([kerb], 0.2)).toHaveLength(0)
    expect(collidersAt([kerb], 0)).toHaveLength(1)
  })
})
