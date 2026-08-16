import { describe, it, expect } from 'vitest'

import {
  ALL_INTERIOR_SEATS,
  SEAT_REACH,
  UFAZ_STAIR,
  interiorColliders,
  interiorPlatforms,
  interiorSeats,
  nearestSeat,
  seatWithinRoom,
} from './interiorPhysics'
import {
  HEADROOM,
  STEP_UP,
  blockingPlatforms,
  groundHeight,
  insideCollider,
  resolveColliders,
  sightlineBlocker,
  type Collider,
} from './campusPhysics'
import { INTERIOR_SPECS, interiorHalfExtent } from './interiorSpecs'
import { CAMPUS_BUILDINGS, PLAYER_RADIUS, type InteriorKind } from './campusLayout'
import { fitProjector } from './projectorFit'

const KINDS = Object.keys(INTERIOR_SPECS) as InteriorKind[]

/** Eye height of someone sitting down, above the seat pan. */
const SEATED_EYE = 1.15

/**
 * Which way a seat points.
 *
 * `interiorPhysics.test.ts` has always checked that a seat has a clear line to
 * the board, and never that it is turned towards it — so every seat in the
 * amphitheatre and every seat in the sports hall faced the opposite wall, with
 * an unobstructed view of it, and eighteen passing tests said nothing. Both
 * comments claimed the right thing; both angles were half a turn out, because
 * `ry` is the avatar convention in which zero faces *+Z*.
 */
describe('which way the seats face', () => {
  /** The direction a seat looks, in the avatar convention: zero faces +Z. */
  const facing = (ry: number) => ({ x: Math.sin(ry), z: Math.cos(ry) })

  it('turns tiered seating towards the board', () => {
    // A tier is auditorium seating: unlike a chair at a table, the only reason
    // it exists is to look at the front of the room. Table seating is left
    // alone deliberately — half of it faces its table, away from the screen,
    // which is what a table is for.
    for (const { kind, seat } of ALL_INTERIOR_SEATS) {
      if (seat.kind !== 'tiered') continue
      const board = INTERIOR_SPECS[kind].projector
      const toBoard = { x: board[0] - seat.x, z: board[2] - seat.z }
      const length = Math.hypot(toBoard.x, toBoard.z) || 1
      const look = facing(seat.ry)
      const alignment = (look.x * toBoard.x + look.z * toBoard.z) / length
      expect(alignment, `${kind} seat ${seat.id} faces away from the board`).toBeGreaterThan(0)
    }
  })

  it('never sits anybody facing a wall from touching distance', () => {
    // The sports hall's bleachers stand against the west wall, so the sign of
    // their facing decides whether they watch the court or the brickwork. Two
    // metres is close enough that no legitimate seat looks into a wall.
    const PROBE = 2
    for (const { kind, seat } of ALL_INTERIOR_SEATS) {
      const limit = interiorHalfExtent(kind)
      const look = facing(seat.ry)
      const ahead = { x: seat.x + look.x * PROBE, z: seat.z + look.z * PROBE }
      expect(
        Math.max(Math.abs(ahead.x), Math.abs(ahead.z)),
        `${kind} seat ${seat.id} faces a wall ${PROBE} m away`,
      ).toBeLessThanOrEqual(limit)
    }
  })
})

/**
 * Whether you can actually walk to a place, rather than whether it is empty.
 *
 * A flood fill from where the player is put down, on a half-metre grid, through
 * whatever is solid at floor level. "Nothing is standing here" and "you can get
 * here" are different questions, and the entrance hall was a case where the
 * second answer was no over eighty-four square metres of it: the staircase's
 * fifteen platforms all blocked from below, so the space under a landing four
 * and a half metres up, in a nine-metre room, was fenced off behind nothing.
 */
function reachableAtFloorLevel(kind: InteriorKind, from: { x: number; z: number }) {
  const limit = interiorHalfExtent(kind)
  const solid = [...interiorColliders(kind), ...blockingPlatforms(interiorPlatforms(kind), 0)]
  const STRIDE = 0.5
  const key = (x: number, z: number) => `${Math.round(x / STRIDE)},${Math.round(z / STRIDE)}`

  const open = (x: number, z: number) => {
    if (Math.abs(x) > limit || Math.abs(z) > limit) return false
    const settled = resolveColliders(x, z, solid)
    return Math.hypot(settled.x - x, settled.z - z) < 1e-9
  }

  const seen = new Set<string>()
  const queue = [from]
  seen.add(key(from.x, from.z))
  while (queue.length) {
    const here = queue.pop()!
    for (const [dx, dz] of [
      [STRIDE, 0],
      [-STRIDE, 0],
      [0, STRIDE],
      [0, -STRIDE],
    ]) {
      const x = here.x + dx
      const z = here.z + dz
      const id = key(x, z)
      if (seen.has(id) || !open(x, z)) continue
      seen.add(id)
      queue.push({ x, z })
    }
  }
  return { seen, key }
}

describe('the space under the staircase', () => {
  it('can be walked into from the entrance hall', () => {
    // The flight is drawn with iron balusters you can see the hall through,
    // and its landing clears the floor by 4.55 m under a 9 m ceiling. Before
    // `walkUnder`, every square metre of its footprint was unreachable.
    const spec = INTERIOR_SPECS.ufaz
    const { seen, key } = reachableAtFloorLevel('ufaz', { x: spec.spawn[0], z: spec.spawn[2] })

    // A spot under the landing, at the back of the flight.
    const underLanding = { x: UFAZ_STAIR.x, z: UFAZ_STAIR.landing.z }
    expect(
      seen.has(key(underLanding.x, underLanding.z)),
      `cannot reach (${underLanding.x}, ${underLanding.z}) under the landing`,
    ).toBe(true)
  })

  it('still refuses to let you duck under the bottom of the flight', () => {
    // The first few treads are barely off the ground. Walking "under" those
    // would be walking through them.
    const low = interiorPlatforms('ufaz').filter((p) => p.top > STEP_UP && p.top < HEADROOM)
    expect(low.length, 'no low treads left to check').toBeGreaterThan(0)
    for (const tread of low) {
      expect(blockingPlatforms([tread], 0), `tread at ${tread.top} should still block`).toHaveLength(
        1,
      )
    }
  })
})

describe('every interior has physics', () => {
  it('gives each room a collider list', () => {
    for (const kind of KINDS) {
      expect(interiorColliders(kind).length, kind).toBeGreaterThan(0)
    }
  })

  it('gives every room you go to in order to be there somewhere to sit', () => {
    // The laboratory is worked at standing up. The corridors are circulation:
    // they are how you get to a room, not a place you settle in, and the
    // stairwell stands between their east wall and the projector so a seat
    // there could not see the screen anyway. Everything else — the halls, the
    // library, the lecture theatre, the cafeteria — is somewhere you stay, and
    // somewhere you stay needs seats.
    for (const kind of KINDS) {
      if (kind === 'lab' || kind === 'ufaz-floor') continue
      expect(interiorSeats(kind).length, kind).toBeGreaterThan(0)
    }
  })

  it('numbers every seat on the campus uniquely', () => {
    // The id is what the server stores to hold a seat. Two seats sharing one
    // would mean sitting in a chair silently evicts someone in another building.
    const ids = ALL_INTERIOR_SEATS.map(({ seat }) => seat.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})

describe('seats are usable', () => {
  it('keeps every seat inside the room the player is clamped to', () => {
    for (const { kind, seat } of ALL_INTERIOR_SEATS) {
      expect(seatWithinRoom(kind, seat), `${kind} ${seat.id}`).toBe(true)
    }
  })

  it('does not put a seat inside something other than its own furniture', () => {
    // A seat inside a table is one you can never walk up to. A seat inside the
    // sofa it belongs to is just what a sofa is, which is what `on` separates.
    for (const kind of KINDS) {
      const colliders = interiorColliders(kind)
      for (const seat of interiorSeats(kind)) {
        const blocker = colliders.find(
          (c) => c.id !== seat.on && insideCollider(seat.x, seat.z, c),
        )
        expect(blocker, `${kind} ${seat.id} is inside ${JSON.stringify(blocker)}`).toBeUndefined()
      }
    }
  })

  it('leaves room to stand next to every seat', () => {
    // You have to reach a seat before you can sit in it. Resolving the seat
    // position against the room must not shove you somewhere out of reach.
    for (const kind of KINDS) {
      const colliders = interiorColliders(kind)
      for (const seat of interiorSeats(kind)) {
        const settled = resolveColliders(seat.x, seat.z, colliders, PLAYER_RADIUS)
        const moved = Math.hypot(settled.x - seat.x, settled.z - seat.z)
        expect(moved, `${kind} ${seat.id}`).toBeLessThan(SEAT_REACH)
      }
    }
  })

  it('offers the nearest free seat and skips a taken one', () => {
    const seats = interiorSeats('cafeteria')
    const target = seats[0]
    expect(nearestSeat(target.x, target.z, seats)?.id).toBe(target.id)
    expect(nearestSeat(target.x, target.z, seats, SEAT_REACH, new Set([target.id]))?.id).not.toBe(
      target.id,
    )
  })

  it('offers nothing when you are not near a seat', () => {
    expect(nearestSeat(0, 0, interiorSeats('ufaz'), 0.5)).toBeNull()
  })
})

describe('colliders do not trap the player', () => {
  it('never places two solid objects closer than a person is wide', () => {
    // A gap narrower than the player is a slot they can be pushed into and not
    // get out of, and two flush colliders are a seam a least-penetration
    // resolver cannot settle on at all.
    const minGap = PLAYER_RADIUS * 2
    for (const kind of KINDS) {
      const colliders = interiorColliders(kind)
      for (let i = 0; i < colliders.length; i++) {
        for (let j = i + 1; j < colliders.length; j++) {
          const a = colliders[i]
          const b = colliders[j]
          const gap = separation(a, b)
          // A negative gap is an overlap, which is worse than a narrow slot —
          // and `gap > 0` used to filter exactly those out, so the one case
          // this test exists to catch was the one it could never fail on.
          const tooClose = gap < minGap
          expect(tooClose, `${kind}: ${describe_(a)} and ${describe_(b)} are ${gap.toFixed(2)} apart`).toBe(false)
        }
      }
    }
  })
})

describe('platforms are climbable', () => {
  it('keeps every tier within a single step of the one below', () => {
    for (const kind of KINDS) {
      const tops = [0, ...interiorPlatforms(kind).map((p) => p.top)].sort((a, b) => a - b)
      for (let i = 1; i < tops.length; i++) {
        const rise = tops[i] - tops[i - 1]
        expect(rise, `${kind} rise from ${tops[i - 1]} to ${tops[i]}`).toBeLessThanOrEqual(STEP_UP)
      }
    }
  })

  it('rakes the amphitheatre rather than leaving it flat', () => {
    const tops = interiorPlatforms('lecture').map((p) => p.top)
    expect(Math.max(...tops)).toBeGreaterThan(3)
  })

  it('stands a tiered seat on its own tier rather than on the floor', () => {
    for (const kind of ['lecture', 'sports'] as InteriorKind[]) {
      const raised = interiorSeats(kind).filter((seat) => seat.y > 0)
      expect(raised.length, kind).toBeGreaterThan(0)
      for (const seat of raised) {
        const under = interiorPlatforms(kind).find(
          (p) => Math.abs(p.top - seat.y) < 1e-6 && insideCollider(seat.x, seat.z, p),
        )
        expect(under, `${kind} ${seat.id} floats at ${seat.y}`).toBeDefined()
      }
    }
  })
})

describe('the board is visible from every seat', () => {
  /**
   * The requirement this whole height system exists for. Five of the seven
   * rooms failed it: the entrance hall ran its staircase up the screen wall,
   * the library put five point eight metres of stacks between every reading
   * table and the board, the laboratory parked four fume cupboards across it,
   * the student centre two vending machines, and the sports hall hung its
   * scoreboard over the picture.
   */
  it('leaves nothing solid between a seat and any corner of the screen', () => {
    // Corners, not just the centre. Clearing the centre is what a first
    // version checked, and it is not the requirement: it leaves a reader at
    // the end of a row seeing the middle of the picture and none of one side
    // of it, which is worse than useless for a slide. Aiming the library's
    // aisle at the screen's edges instead took 68 blocked lines to zero.
    for (const kind of KINDS) {
      const spec = INTERIOR_SPECS[kind]
      const colliders = interiorColliders(kind)
      const fit = fitProjector(16 / 9, spec.projector[1], spec.ceiling)
      const [sx, sy, sz] = spec.projector

      const targets: [string, number, number][] = [
        ['centre', sx, sy],
        ['bottom left', sx - fit.width / 2, sy - fit.height / 2],
        ['bottom right', sx + fit.width / 2, sy - fit.height / 2],
        ['top left', sx - fit.width / 2, sy + fit.height / 2],
        ['top right', sx + fit.width / 2, sy + fit.height / 2],
      ]

      for (const seat of interiorSeats(kind)) {
        const eye = { x: seat.x, y: seat.y + seat.seatHeight + SEATED_EYE, z: seat.z }
        for (const [corner, x, y] of targets) {
          const blocker = sightlineBlocker(eye, { x, y, z: sz }, colliders)
          expect(
            blocker,
            `${kind}: ${seat.id} cannot see the ${corner} of the board — ${JSON.stringify(blocker)}`,
          ).toBeNull()
        }
      }
    }
  })

  it('leaves the room clear from standing height on the centre line too', () => {
    // Not everyone watching is sitting down.
    for (const kind of KINDS) {
      const spec = INTERIOR_SPECS[kind]
      const limit = interiorHalfExtent(kind)
      const screen = { x: spec.projector[0], y: spec.projector[1], z: spec.projector[2] }

      const colliders = interiorColliders(kind)
      for (let z = -limit + 2; z <= limit; z += 2) {
        // Only from in front of the board: behind it there is nothing to see.
        if (z <= spec.projector[2] + 1) continue
        // And only from somewhere a player could actually stand. The middle of
        // the servery counter is not a viewing position.
        if (colliders.some((c) => insideCollider(0, z, c, PLAYER_RADIUS))) continue
        // Standing *on the floor at that point*, which in the amphitheatre is
        // a tier rather than the ground. Measuring everyone's eye at 1.7 above
        // zero puts the audience's heads under their own desks.
        const floor = groundHeight(0, z, interiorPlatforms(kind), Number.POSITIVE_INFINITY)
        const eye = { x: 0, y: floor + 1.7, z }
        const blocker = sightlineBlocker(eye, screen, colliders)
        expect(blocker, `${kind}: blocked at z=${z} by ${JSON.stringify(blocker)}`).toBeNull()
      }
    }
  })

  it('keeps the screen itself inside the room', () => {
    for (const building of CAMPUS_BUILDINGS) {
      const spec = INTERIOR_SPECS[building.interior]
      const fit = fitProjector(16 / 9, spec.projector[1], spec.ceiling)
      expect(fit.width / 2, building.name).toBeLessThanOrEqual(spec.halfExtent)
    }
  })
})

/* ------------------------------------------------------------------ */

/**
 * Gap between two colliders.
 *
 * Axis-aligned boxes are measured face to face. A bounding circle would have
 * done, but it is wildly conservative for the long thin shapes this campus is
 * full of: two sofas four metres apart have a real gap of 2.7 m and a
 * bounding-circle gap of 0.55, which reads as a trap that is not there.
 */
function separation(a: Collider, b: Collider): number {
  const circleA = 'radius' in a
  const circleB = 'radius' in b

  if (!circleA && !circleB && !a.ry && !b.ry) {
    const gapX = Math.abs(a.x - b.x) - (a.halfW + b.halfW)
    const gapZ = Math.abs(a.z - b.z) - (a.halfD + b.halfD)
    // Negative on both axes means they intersect, and the value is then how
    // deep. Otherwise it is the gap along whichever axis separates them.
    return Math.max(gapX, gapZ)
  }

  if (circleA && circleB) {
    return Math.hypot(a.x - b.x, a.z - b.z) - a.radius - b.radius
  }

  // Circle against an un-turned box: measure to the nearest point on the box,
  // not to its bounding circle. The bounding circle of a 1.6 x 4.4 bench
  // reaches 2.34 m from its centre, which reported a column two metres clear
  // of it as an overlap.
  const circle = (circleA ? a : b) as { x: number; z: number; radius: number }
  const box = (circleA ? b : a) as { x: number; z: number; halfW: number; halfD: number; ry?: number }
  if (!box.ry) {
    const dx = Math.max(0, Math.abs(circle.x - box.x) - box.halfW)
    const dz = Math.max(0, Math.abs(circle.z - box.z) - box.halfD)
    return Math.hypot(dx, dz) - circle.radius
  }

  // A turned box against a circle is the one case left, and there is none on
  // this campus. Fall back to the bounding circle rather than reporting clear.
  return (
    Math.hypot(circle.x - box.x, circle.z - box.z) -
    circle.radius -
    Math.hypot(box.halfW, box.halfD)
  )
}

function describe_(c: Collider): string {
  return 'radius' in c ? `circle(${c.x},${c.z})` : `box(${c.x},${c.z})`
}
