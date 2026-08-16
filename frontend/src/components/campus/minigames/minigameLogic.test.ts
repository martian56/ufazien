import { describe, it, expect } from 'vitest'
import {
  CAMPUS_BUILDINGS,
  CAMPUS_COLLIDERS,
  CAMPUS_LIMIT,
  OUTDOOR_COURT,
  SPAWN,
  insideRect,
} from '../campusLayout'
import {
  DASH_CHECKPOINTS,
  DASH_PAR,
  FREE_THROW_ATTEMPTS,
  GRAVITY,
  MAX_THROW_SPEED,
  MIN_THROW_SPEED,
  TITRATION_TOLERANCE,
  advanceDash,
  chargeFor,
  correctOrder,
  dashMedal,
  dashScore,
  formatClock,
  launchVelocity,
  makeShelf,
  newDashState,
  newShelfState,
  newThrowSession,
  passedThroughHoop,
  pickBook,
  recordShot,
  shelfScore,
  stepProjectile,
  throwSessionOver,
  titrationColour,
  titrationTarget,
  titrationVerdict,
} from './minigameLogic'

describe('chargeFor', () => {
  it('is zero at rest and one at full charge', () => {
    expect(chargeFor(0)).toBe(0)
    expect(chargeFor(1.1)).toBe(1)
  })

  it('holds at full instead of wrapping around', () => {
    expect(chargeFor(5)).toBe(1)
    expect(chargeFor(50)).toBe(1)
  })

  it('is linear in between', () => {
    expect(chargeFor(0.55)).toBeCloseTo(0.5)
  })

  it('shrugs off nonsense input', () => {
    expect(chargeFor(-3)).toBe(0)
    expect(chargeFor(Number.NaN)).toBe(0)
  })
})

describe('launchVelocity', () => {
  it('normalises the aim, so a long vector is not a faster throw', () => {
    const near = launchVelocity({ x: 0, y: 0, z: -1 }, 1)
    const far = launchVelocity({ x: 0, y: 0, z: -100 }, 1)
    expect(near.z).toBeCloseTo(far.z)
  })

  it('scales speed between the minimum and the maximum', () => {
    const soft = launchVelocity({ x: 0, y: 0, z: -1 }, 0)
    const hard = launchVelocity({ x: 0, y: 0, z: -1 }, 1)
    expect(Math.abs(soft.z)).toBeCloseTo(MIN_THROW_SPEED)
    expect(Math.abs(hard.z)).toBeCloseTo(MAX_THROW_SPEED)
  })

  it('clamps a charge outside 0..1', () => {
    const over = launchVelocity({ x: 0, y: 0, z: -1 }, 9)
    expect(Math.abs(over.z)).toBeCloseTo(MAX_THROW_SPEED)
  })

  it('survives a zero direction rather than returning NaN', () => {
    const dead = launchVelocity({ x: 0, y: 0, z: 0 }, 1)
    expect(Number.isNaN(dead.x)).toBe(false)
  })
})

describe('stepProjectile', () => {
  it('pulls the ball down over time', () => {
    let ball = { position: { x: 0, y: 10, z: 0 }, velocity: { x: 0, y: 0, z: 0 } }
    ball = stepProjectile(ball, 0.5)
    expect(ball.velocity.y).toBeCloseTo(-GRAVITY * 0.5)
    expect(ball.position.y).toBeLessThan(10)
  })

  it('leaves horizontal velocity alone', () => {
    const ball = stepProjectile(
      { position: { x: 0, y: 5, z: 0 }, velocity: { x: 3, y: 0, z: -4 } },
      0.2,
    )
    expect(ball.velocity.x).toBe(3)
    expect(ball.velocity.z).toBe(-4)
  })

  it('does not mutate its input', () => {
    const ball = { position: { x: 0, y: 5, z: 0 }, velocity: { x: 1, y: 1, z: 1 } }
    stepProjectile(ball, 0.3)
    expect(ball.position).toEqual({ x: 0, y: 5, z: 0 })
    expect(ball.velocity).toEqual({ x: 1, y: 1, z: 1 })
  })
})

describe('passedThroughHoop', () => {
  const hoop = { x: 0, y: 3.05, z: -5 }

  it('scores a ball dropping through the middle', () => {
    expect(passedThroughHoop({ x: 0, y: 3.3, z: -5 }, { x: 0, y: 2.8, z: -5 }, hoop)).toBe(true)
  })

  it('refuses a ball going up through the net', () => {
    expect(passedThroughHoop({ x: 0, y: 2.8, z: -5 }, { x: 0, y: 3.3, z: -5 }, hoop)).toBe(false)
  })

  it('refuses a ball that crosses outside the ring', () => {
    expect(passedThroughHoop({ x: 2, y: 3.3, z: -5 }, { x: 2, y: 2.8, z: -5 }, hoop)).toBe(false)
  })

  it('refuses a ball that never reaches the ring', () => {
    expect(passedThroughHoop({ x: 0, y: 5, z: -5 }, { x: 0, y: 4.5, z: -5 }, hoop)).toBe(false)
  })

  it('interpolates, so a fast shot is not missed between frames', () => {
    // One long step passing right through the ring on the way down.
    expect(passedThroughHoop({ x: 0, y: 6, z: -5 }, { x: 0, y: 0.2, z: -5 }, hoop)).toBe(true)
  })

  it('catches a fast diagonal that lands off to the side', () => {
    // Same downward span, but drifting three metres sideways as it falls.
    expect(passedThroughHoop({ x: 0, y: 6, z: -5 }, { x: 3, y: 0.2, z: -5 }, hoop)).toBe(false)
  })
})

describe('free throw scoring', () => {
  it('starts empty', () => {
    expect(newThrowSession()).toEqual({ shots: 0, made: 0, streak: 0, bestStreak: 0, score: 0 })
  })

  it('pays a bonus for a streak', () => {
    let session = newThrowSession()
    session = recordShot(session, true)
    const first = session.score
    session = recordShot(session, true)
    expect(session.score - first).toBeGreaterThan(first)
  })

  it('resets the streak on a miss but keeps the best', () => {
    let session = newThrowSession()
    session = recordShot(session, true)
    session = recordShot(session, true)
    session = recordShot(session, false)
    expect(session.streak).toBe(0)
    expect(session.bestStreak).toBe(2)
    expect(session.made).toBe(2)
  })

  it('never loses points for missing', () => {
    let session = newThrowSession()
    for (let i = 0; i < 5; i++) session = recordShot(session, false)
    expect(session.score).toBe(0)
  })

  it('ends after the full set of attempts', () => {
    let session = newThrowSession()
    for (let i = 0; i < FREE_THROW_ATTEMPTS - 1; i++) session = recordShot(session, true)
    expect(throwSessionOver(session)).toBe(false)
    session = recordShot(session, true)
    expect(throwSessionOver(session)).toBe(true)
  })
})

describe('campus dash', () => {
  it('does not advance until the player reaches the ring', () => {
    const state = advanceDash(newDashState(), 999, 999, 3)
    expect(state.index).toBe(0)
  })

  it('advances on reaching the next ring', () => {
    const [x, , z] = DASH_CHECKPOINTS[0]
    const state = advanceDash(newDashState(), x, z, 3)
    expect(state.index).toBe(1)
    expect(state.splits).toEqual([3])
  })

  it('cannot be short-cut by touching a later ring first', () => {
    const [x, , z] = DASH_CHECKPOINTS[4]
    const state = advanceDash(newDashState(), x, z, 3)
    expect(state.index).toBe(0)
  })

  it('finishes after the last ring', () => {
    let state = newDashState()
    DASH_CHECKPOINTS.forEach((point, i) => {
      state = advanceDash(state, point[0], point[2], i + 1)
    })
    expect(state.finished).toBe(true)
    expect(state.running).toBe(false)
    expect(state.splits).toHaveLength(DASH_CHECKPOINTS.length)
  })

  it('ignores further contact once finished', () => {
    let state = newDashState()
    DASH_CHECKPOINTS.forEach((point, i) => {
      state = advanceDash(state, point[0], point[2], i + 1)
    })
    const after = advanceDash(state, DASH_CHECKPOINTS[0][0], DASH_CHECKPOINTS[0][2], 99)
    expect(after).toBe(state)
  })

  it('awards medals by time', () => {
    expect(dashMedal(DASH_PAR - 10)).toBe('gold')
    expect(dashMedal(DASH_PAR * 1.1)).toBe('silver')
    expect(dashMedal(DASH_PAR * 1.4)).toBe('bronze')
    expect(dashMedal(DASH_PAR * 3)).toBe('none')
  })

  it('scores faster runs higher, and never below the floor', () => {
    expect(dashScore(40)).toBeGreaterThan(dashScore(90))
    expect(dashScore(100000)).toBeGreaterThanOrEqual(50)
    expect(dashScore(0)).toBe(0)
  })
})

describe('titration', () => {
  it('gives a target inside the burette and away from zero', () => {
    for (let round = 0; round < 20; round++) {
      const target = titrationTarget(42, round)
      expect(target).toBeGreaterThanOrEqual(14)
      expect(target).toBeLessThanOrEqual(38)
    }
  })

  it('is reproducible for a seed and round', () => {
    expect(titrationTarget(7, 2)).toBe(titrationTarget(7, 2))
    expect(titrationTarget(7, 2)).not.toBe(titrationTarget(7, 3))
  })

  it('gives full marks at the endpoint', () => {
    expect(titrationVerdict(25, 25).score).toBe(100)
    expect(titrationVerdict(25, 25).direction).toBe(0)
  })

  it('penalises overshoot and undershoot equally', () => {
    expect(titrationVerdict(26, 25).score).toBe(titrationVerdict(24, 25).score)
  })

  it('reports which way you were wrong', () => {
    expect(titrationVerdict(27, 25).direction).toBe(1)
    expect(titrationVerdict(23, 25).direction).toBe(-1)
    expect(titrationVerdict(27, 25).label).toContain('Overshot')
    expect(titrationVerdict(23, 25).label).toContain('Short')
  })

  it('scores zero once past the tolerance, never negative', () => {
    expect(titrationVerdict(25 + TITRATION_TOLERANCE, 25).score).toBe(0)
    expect(titrationVerdict(50, 25).score).toBe(0)
    expect(titrationVerdict(0, 25).score).toBe(0)
  })

  it('turns the flask pink past the endpoint', () => {
    expect(titrationColour(0, 25)).toBe(titrationColour(10, 25))
    expect(titrationColour(30, 25)).not.toBe(titrationColour(10, 25))
  })
})

describe('shelf order', () => {
  it('deals the requested number of books', () => {
    expect(makeShelf(1, 6)).toHaveLength(6)
  })

  it('is reproducible for a seed', () => {
    expect(makeShelf(11, 6)).toEqual(makeShelf(11, 6))
    expect(makeShelf(11, 6)).not.toEqual(makeShelf(12, 6))
  })

  it('never deals the same call number twice', () => {
    const codes = makeShelf(5, 8).map((book) => book.code)
    expect(new Set(codes).size).toBe(codes.length)
  })

  it('gives each book its own slot on the desk', () => {
    const slots = makeShelf(9, 6).map((book) => book.slot)
    expect([...slots].sort((a, b) => a - b)).toEqual([0, 1, 2, 3, 4, 5])
  })

  it('orders by the call number the player can actually read', () => {
    // Asserted against the codes on the spines, not against hand-written ranks.
    // A fixture that repeats the implementation's own rank formula passes even
    // when the class list is out of order, which is how that shipped once.
    for (const seed of [3, 21, 77, 512]) {
      const books = makeShelf(seed, 6)
      // Numeric collation, because that is how a shelf is actually ordered:
      // QA 9 comes before QA 76, not after it the way a plain string compare
      // would have it. This is derived from the spines alone, so it can catch
      // an ordering the player has no way to guess.
      const byCode = [...books]
        .sort((a, b) => a.code.localeCompare(b.code, 'en', { numeric: true }))
        .map((b) => b.id)
      expect(correctOrder(books)).toEqual(byCode)
    }
  })

  it('deals call numbers whose class letters sort alphabetically', () => {
    const classes = makeShelf(9, 10).map((book) => book.code.slice(0, 2))
    const ranks = makeShelf(9, 10).map((book) => book.rank)
    const byRank = classes.map((cls, i) => ({ cls, rank: ranks[i] })).sort((a, b) => a.rank - b.rank)
    expect(byRank.map((b) => b.cls)).toEqual([...byRank.map((b) => b.cls)].sort())
  })

  it('accepts picks in order and finishes on the last one', () => {
    const books = makeShelf(3, 4)
    const order = correctOrder(books)
    let state = newShelfState()
    for (const id of order) state = pickBook(state, books, id)
    expect(state.done).toBe(true)
    expect(state.mistakes).toBe(0)
  })

  it('counts a wrong pick without throwing the run away', () => {
    const books = makeShelf(3, 4)
    const order = correctOrder(books)
    let state = pickBook(newShelfState(), books, order[2])
    expect(state.mistakes).toBe(1)
    expect(state.picked).toEqual([])
    state = pickBook(state, books, order[0])
    expect(state.picked).toEqual([order[0]])
  })

  it('ignores a book that has already been picked', () => {
    const books = makeShelf(3, 4)
    const order = correctOrder(books)
    const state = pickBook(newShelfState(), books, order[0])
    expect(pickBook(state, books, order[0])).toBe(state)
  })

  it('rewards speed and punishes mistakes, but never goes negative', () => {
    expect(shelfScore(6, 10, 0)).toBeGreaterThan(shelfScore(6, 40, 0))
    expect(shelfScore(6, 10, 3)).toBeLessThan(shelfScore(6, 10, 0))
    expect(shelfScore(1, 300, 99)).toBe(0)
  })
})

describe('formatClock', () => {
  it('formats minutes and seconds', () => {
    expect(formatClock(0)).toBe('0:00')
    expect(formatClock(9)).toBe('0:09')
    expect(formatClock(75)).toBe('1:15')
    expect(formatClock(600)).toBe('10:00')
  })

  it('never shows a negative or a NaN clock', () => {
    expect(formatClock(-5)).toBe('0:00')
    expect(formatClock(Number.NaN)).toBe('0:00')
  })
})

describe('the dash route', () => {
  it('never puts a ring inside a building', () => {
    // A checkpoint in a wall is one you can never reach, which strands the run.
    for (const [i, point] of DASH_CHECKPOINTS.entries()) {
      const blocked = CAMPUS_COLLIDERS.find((rect) => insideRect(point[0], point[2], rect, 3))
      expect(blocked, `ring ${i} at ${point[0]},${point[2]} is inside a building`).toBeUndefined()
    }
  })

  it('keeps every ring inside the playable area', () => {
    for (const point of DASH_CHECKPOINTS) {
      expect(Math.abs(point[0])).toBeLessThanOrEqual(CAMPUS_LIMIT)
      expect(Math.abs(point[2])).toBeLessThanOrEqual(CAMPUS_LIMIT)
    }
  })

  it('keeps the route clear of the basketball station', () => {
    // The two games share the campus but must not share a spot: a ring on the
    // free-throw line stands between the shooter and the basket.
    const hoop = { x: OUTDOOR_COURT[0], z: OUTDOOR_COURT[2] - 9 }
    for (const point of DASH_CHECKPOINTS) {
      expect(Math.hypot(point[0] - hoop.x, point[2] - hoop.z)).toBeGreaterThan(20)
    }
  })
})

describe('the spawn point', () => {
  it('does not drop the player inside a dash ring', () => {
    // Twice now the spawn and the course have been moved into each other, and
    // a two-metre steel hoop across your first view is hard to miss.
    for (const [i, point] of DASH_CHECKPOINTS.entries()) {
      const distance = Math.hypot(SPAWN[0] - point[0], SPAWN[2] - point[2])
      expect(distance, `spawn sits on ring ${i}`).toBeGreaterThan(12)
    }
  })

  it('keeps a clear sightline to the main building', () => {
    // Nothing solid between the spawn and the landmark's door.
    const target = CAMPUS_BUILDINGS.find((b) => b.interior === 'ufaz-core')!
    const doorZ = target.position[2] + target.size[2] / 2
    for (let t = 0; t <= 1; t += 0.02) {
      const z = SPAWN[2] + (doorZ - SPAWN[2]) * t
      const blocked = CAMPUS_COLLIDERS.find((rect) => insideRect(SPAWN[0], z, rect))
      expect(blocked, `view blocked at z=${z.toFixed(0)}`).toBeUndefined()
    }
  })
})
