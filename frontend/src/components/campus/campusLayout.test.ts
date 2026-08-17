import { describe, it, expect } from 'vitest'
import {
  CAMPUS_BUILDINGS,
  CAMPUS_COLLIDERS,
  CAMPUS_LIMIT,
  CAMPUS_HORIZONTAL_FOV,
  verticalFov,
  KEEP_CLEAR,
  PLAYER_RADIUS,
  QUAD_CENTRE,
  SCENERY_BLOCKS,
  SPAWN,
  buildingRect,
  clampToCampus,
  insideRect,
  mulberry32,
  nearestEntrance,
  resolveCollision,
  scatterProps,
} from './campusLayout'

describe('mulberry32', () => {
  it('gives the same sequence for the same seed', () => {
    const a = mulberry32(1234)
    const b = mulberry32(1234)
    expect([a(), a(), a()]).toEqual([b(), b(), b()])
  })

  it('gives different sequences for different seeds', () => {
    expect(mulberry32(1)()).not.toBe(mulberry32(2)())
  })

  it('stays in [0, 1)', () => {
    const random = mulberry32(99)
    for (let i = 0; i < 500; i++) {
      const value = random()
      expect(value).toBeGreaterThanOrEqual(0)
      expect(value).toBeLessThan(1)
    }
  })
})

describe('resolveCollision', () => {
  const box = [{ x: 0, z: 0, halfW: 10, halfD: 5 }]

  it('leaves a position outside everything alone', () => {
    expect(resolveCollision(40, 40, box, 0.5)).toEqual({ x: 40, z: 40 })
  })

  it('pushes out along the shallower axis', () => {
    // Deep in x, barely in z: the way out is z.
    const out = resolveCollision(1, 4.9, box, 0.5)
    expect(out.x).toBe(1)
    expect(out.z).toBeCloseTo(5.5)
  })

  it('pushes out sideways when that is the shallower axis', () => {
    const out = resolveCollision(9.8, 0, box, 0.5)
    expect(out.z).toBe(0)
    expect(out.x).toBeCloseTo(10.5)
  })

  it('keeps the sign of the approach, so you exit the side you entered', () => {
    expect(resolveCollision(-9.8, 0, box, 0.5).x).toBeCloseTo(-10.5)
    expect(resolveCollision(0, -4.9, box, 0.5).z).toBeCloseTo(-5.5)
  })

  it('accounts for the player radius', () => {
    const tight = resolveCollision(10.2, 0, box, 0.5)
    const wide = resolveCollision(10.2, 0, box, 2)
    expect(tight.x).toBeCloseTo(10.5)
    expect(wide.x).toBeCloseTo(12)
  })

  it('never lets a step from open ground end inside a wall', () => {
    // The invariant that matters at runtime: the player is always somewhere
    // legal, and one frame of movement cannot put them inside a building. A
    // sprint frame is about 0.13 units, so 2 is a generous step.
    const isFree = (x: number, z: number) =>
      !CAMPUS_COLLIDERS.some((rect) => insideRect(x, z, rect, PLAYER_RADIUS))
    const steps = [
      [2, 0], [-2, 0], [0, 2], [0, -2],
      [1.4, 1.4], [1.4, -1.4], [-1.4, 1.4], [-1.4, -1.4],
    ]

    // Failures are collected rather than asserted inside the loop. An expect()
    // per step meant more than ten thousand of them, which took longer than
    // the five second timeout on a slower machine: the invariant held, but the
    // test went red anyway, and only on some people's laptops.
    const failures: string[] = []
    let checked = 0
    for (let x = -CAMPUS_LIMIT; x <= CAMPUS_LIMIT; x += 3) {
      for (let z = -CAMPUS_LIMIT; z <= CAMPUS_LIMIT; z += 3) {
        if (!isFree(x, z)) continue
        for (const [dx, dz] of steps) {
          const out = resolveCollision(x + dx, z + dz)
          const stuck = CAMPUS_COLLIDERS.find((rect) =>
            insideRect(out.x, out.z, rect, PLAYER_RADIUS - 0.01),
          )
          if (stuck) failures.push(`stepped from ${x},${z} by ${dx},${dz} into a wall`)
          checked++
        }
      }
    }
    expect(failures.slice(0, 5)).toEqual([])
    // Guard against the loop silently skipping everything.
    expect(checked).toBeGreaterThan(10000)
  })

  it('leaves no gap between colliders too narrow to walk down', () => {
    // Why this matters: a least-penetration resolver ejects you along the
    // shallower axis, so two blocks that touch — or that sit a hair apart —
    // bounce you between them forever. Every gap has to be either nothing
    // (merge the colliders) or wide enough to be a real alley.
    const MIN_ALLEY = PLAYER_RADIUS * 2 + 1

    for (let i = 0; i < CAMPUS_COLLIDERS.length; i++) {
      for (let j = i + 1; j < CAMPUS_COLLIDERS.length; j++) {
        const a = CAMPUS_COLLIDERS[i]
        const b = CAMPUS_COLLIDERS[j]
        const gapX = Math.abs(a.x - b.x) - (a.halfW + b.halfW)
        const gapZ = Math.abs(a.z - b.z) - (a.halfD + b.halfD)
        // Only pairs that face each other can form a slot; two blocks offset
        // on both axes are just diagonal neighbours.
        if (gapX > 0 && gapZ > 0) continue
        const gap = Math.max(gapX, gapZ)
        expect(
          gap <= -MIN_ALLEY || gap >= MIN_ALLEY,
          `colliders ${i} and ${j} are ${gap.toFixed(2)} apart, which is a wedge`,
        ).toBe(true)
      }
    }
  })

  it('settles a position wedged between two blocks instead of looping', () => {
    // Two walls with no room between them. There is no correct answer; the
    // contract is only that it returns.
    const vice = [
      { x: -2, z: 0, halfW: 2, halfD: 20 },
      { x: 2, z: 0, halfW: 2, halfD: 20 },
    ]
    expect(() => resolveCollision(0, 0, vice, PLAYER_RADIUS)).not.toThrow()
    expect(Number.isFinite(resolveCollision(0, 0, vice, PLAYER_RADIUS).x)).toBe(true)
  })
})

describe('clampToCampus', () => {
  it('passes through a position already inside', () => {
    expect(clampToCampus(10, -20)).toEqual({ x: 10, z: -20 })
  })

  it('clamps both axes at the limit', () => {
    expect(clampToCampus(9999, -9999)).toEqual({ x: CAMPUS_LIMIT, z: -CAMPUS_LIMIT })
  })

  it('is a much larger world than the 50-unit box it replaced', () => {
    expect(CAMPUS_LIMIT).toBeGreaterThan(150)
  })
})

describe('nearestEntrance', () => {
  const main = CAMPUS_BUILDINGS[0]

  it('finds the building you are standing at the door of', () => {
    const doorZ = main.position[2] + main.size[2] / 2
    const found = nearestEntrance(main.position[0], doorZ + 2)
    expect(found?.building.id).toBe(main.id)
  })

  it('measures from the facade, so a wide building opens along its whole front', () => {
    const doorZ = main.position[2] + main.size[2] / 2
    // 24 units off centre is still against the wall of a 54-unit frontage.
    const found = nearestEntrance(main.position[0] + 24, doorZ + 2)
    expect(found?.building.id).toBe(main.id)
  })

  it('returns nothing out in the open', () => {
    expect(nearestEntrance(0, 20)).toBeNull()
  })

  it('does not open a door you are standing behind', () => {
    const backZ = main.position[2] - main.size[2] / 2 - 4
    expect(nearestEntrance(main.position[0], backZ)).toBeNull()
  })

  it('prefers the closer of two candidates', () => {
    // Explicit list: only one building stands outdoors now, so the default
    // has nothing to choose between and this is testing the choosing.
    const [near, far] = [CAMPUS_BUILDINGS[1], CAMPUS_BUILDINGS[2]]
    const doorZ = near.position[2] + near.size[2] / 2
    const found = nearestEntrance(near.position[0], doorZ + 1, [far, near])
    expect(found?.building.id).toBe(near.id)
  })

  it('only offers a door to something that has one', () => {
    // The rooms inside the main building have no exterior. Walking across the
    // lawn where the library used to stand must not offer to open it.
    for (const building of CAMPUS_BUILDINGS.filter((b) => !b.outdoor)) {
      const doorZ = building.position[2] + building.size[2] / 2
      const found = nearestEntrance(building.position[0], doorZ + 1)
      expect(found?.building.outdoor ?? true).toBe(true)
    }
  })
})

describe('campus data', () => {
  it('gives every building a unique id', () => {
    const ids = CAMPUS_BUILDINGS.map((b) => b.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('gives every room its own interior, except the floors that share one', () => {
    // The three upper corridors are deliberately the same room design — in the
    // building they are the same corridor. Everything else is its own place.
    const shared = CAMPUS_BUILDINGS.filter((b) => b.interior === 'ufaz-core')
    const rest = CAMPUS_BUILDINGS.filter((b) => b.interior !== 'ufaz-core')
    expect(new Set(rest.map((b) => b.interior)).size).toBe(rest.length)
    expect(shared.length).toBeGreaterThan(1)
  })

  it('gives every room a distinct id, because ids travel as current_room', () => {
    // Two rooms sharing an id put their occupants in each other's screen
    // share, which is the one thing in this file that reaches other people.
    const ids = CAMPUS_BUILDINGS.map((b) => b.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('keeps ids numeric, because they travel as current_room', () => {
    for (const building of CAMPUS_BUILDINGS) {
      expect(Number.isInteger(building.id)).toBe(true)
    }
  })

  it('does not overlap any two footprints', () => {
    // Outdoor buildings only. The rooms inside the main building carry its
    // footprint so that anything asking for a rect gets a sane one, and of
    // course they overlap it — they are inside it.
    const rects = [...CAMPUS_BUILDINGS.filter((b) => b.outdoor), ...SCENERY_BLOCKS].map(
      buildingRect,
    )
    for (let i = 0; i < rects.length; i++) {
      for (let j = i + 1; j < rects.length; j++) {
        const a = rects[i]
        const b = rects[j]
        const overlapX = a.halfW + b.halfW - Math.abs(a.x - b.x)
        const overlapZ = a.halfD + b.halfD - Math.abs(a.z - b.z)
        expect(
          overlapX > 0 && overlapZ > 0,
          `${i} overlaps ${j}`,
        ).toBe(false)
      }
    }
  })

  it('keeps every building inside the playable area', () => {
    for (const building of CAMPUS_BUILDINGS) {
      const rect = buildingRect(building)
      expect(Math.abs(rect.x) + rect.halfW).toBeLessThanOrEqual(CAMPUS_LIMIT)
      expect(Math.abs(rect.z) + rect.halfD).toBeLessThanOrEqual(CAMPUS_LIMIT)
    }
  })

  it('leaves the spawn point clear of walls', () => {
    expect(resolveCollision(SPAWN[0], SPAWN[2])).toEqual({ x: SPAWN[0], z: SPAWN[2] })
  })

  it('does not spawn the player inside the fountain', () => {
    // The fountain basin is 7.4 across and sits at the centre of the quad.
    const distance = Math.hypot(SPAWN[0] - QUAD_CENTRE[0], SPAWN[2] - QUAD_CENTRE[1])
    expect(distance).toBeGreaterThan(10)
  })
})

describe('scatterProps', () => {
  it('is deterministic for a seed', () => {
    const a = scatterProps({ count: 40, seed: 7 })
    const b = scatterProps({ count: 40, seed: 7 })
    expect(a).toEqual(b)
  })

  it('changes with the seed', () => {
    const a = scatterProps({ count: 40, seed: 7 })
    const b = scatterProps({ count: 40, seed: 8 })
    expect(a).not.toEqual(b)
  })

  it('stays inside the limit', () => {
    for (const item of scatterProps({ count: 120, seed: 3, limit: 100 })) {
      expect(Math.abs(item.x)).toBeLessThanOrEqual(100)
      expect(Math.abs(item.z)).toBeLessThanOrEqual(100)
    }
  })

  it('never drops a tree through a building or across a path', () => {
    const items = scatterProps({ count: 200, seed: 11, blocked: KEEP_CLEAR, clearance: 4 })
    for (const item of items) {
      expect(KEEP_CLEAR.some((rect) => insideRect(item.x, item.z, rect, 4))).toBe(false)
    }
  })

  it('terminates instead of hanging when there is nowhere to stand', () => {
    const everywhere = [{ x: 0, z: 0, halfW: 1000, halfD: 1000 }]
    expect(scatterProps({ count: 50, seed: 1, blocked: everywhere })).toEqual([])
  })

  it('assigns variants within range', () => {
    for (const item of scatterProps({ count: 60, seed: 5, variants: 3 })) {
      expect(item.variant).toBeGreaterThanOrEqual(0)
      expect(item.variant).toBeLessThan(3)
    }
  })
})


describe('how wide the view is', () => {
  /**
   * three.js takes a *vertical* field of view, so a fixed one narrows as the
   * window gets taller. At the 70 degrees the campus used, that is about 96
   * across on a desktop and about 36 on a phone held in portrait — a third of
   * the view, on the device with the touch joystick and drag-to-look, where
   * turning to see something is the expensive part.
   */
  const across = (vertical: number, aspect: number) =>
    (2 * Math.atan(Math.tan((vertical * Math.PI) / 180 / 2) * aspect) * 180) / Math.PI

  const SHAPES: [string, number, number][] = [
    ['desktop', 1920, 1080],
    ['tablet', 1024, 768],
    ['phone landscape', 844, 390],
    ['phone portrait', 390, 844],
    ['a very tall window', 400, 1400],
  ]

  it('never gives anybody a narrower view than they had', () => {
    // The floor at 70 is what guarantees this: a widescreen window already got
    // more than the target across, and must keep it.
    for (const [name, w, h] of SHAPES) {
      const aspect = w / h
      const before = across(70, aspect)
      const after = across(verticalFov(aspect), aspect)
      expect(after, `${name}: ${before.toFixed(0)} -> ${after.toFixed(0)}`).toBeGreaterThanOrEqual(
        before - 0.01,
      )
    }
  })

  it('reaches the target on anything that is not taller than it is wide', () => {
    for (const [name, w, h] of SHAPES.filter(([, w, h]) => w / h >= 1)) {
      const width = across(verticalFov(w / h), w / h)
      expect(width, `${name}`).toBeGreaterThanOrEqual(CAMPUS_HORIZONTAL_FOV - 1)
    }
  })

  it('gets as close as it can on a tall one without bending the room', () => {
    // A phone in portrait would want about 130 degrees vertical to hold 90
    // across, which is a fisheye. Capped, it lands near 58 — not the target,
    // and much more than the 36 it had.
    const aspect = 390 / 844
    expect(across(verticalFov(aspect), aspect)).toBeGreaterThan(50)
  })

  it('substantially widens the case that prompted this', () => {
    // A phone in portrait used to get about 36 degrees across. It cannot have
    // 90 without a fisheye, but it should not have a tunnel either.
    const aspect = 390 / 844
    const before = across(70, aspect)
    const after = across(verticalFov(aspect), aspect)
    expect(before).toBeLessThan(40)
    expect(after).toBeGreaterThan(before * 1.5)
  })

  it('never goes narrower than the value the campus was built around', () => {
    // Widescreen must not end up worse off than it was.
    for (const [, w, h] of SHAPES) {
      expect(verticalFov(w / h)).toBeGreaterThanOrEqual(70)
    }
  })

  it('does not bend the room to do it', () => {
    // A fisheye is not an improvement on a tunnel.
    for (const aspect of [0.05, 0.2, 0.46, 1, 2.4, 10]) {
      expect(verticalFov(aspect)).toBeLessThanOrEqual(100)
    }
  })

  it('survives a window with no height', () => {
    // Which is what a canvas reports for a frame or two while it is laid out.
    expect(Number.isFinite(verticalFov(0))).toBe(true)
    expect(Number.isFinite(verticalFov(Number.POSITIVE_INFINITY))).toBe(true)
  })
})
