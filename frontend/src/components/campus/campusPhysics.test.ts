import { describe, it, expect } from 'vitest'

import {
  PROP_COLLIDERS,
  SOLID_CAMPUS,
  STEP_UP,
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
