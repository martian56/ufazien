import { describe, it, expect } from 'vitest'
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

  it('sorts by class letters first, then by number', () => {
    const books = [
      { id: 0, code: 'TA 10.1', rank: 4 * 100000 + 10 * 100 + 1, slot: 0 },
      { id: 1, code: 'QA 900.9', rank: 0 * 100000 + 900 * 100 + 9, slot: 1 },
      { id: 2, code: 'QA 10.0', rank: 0 * 100000 + 10 * 100 + 0, slot: 2 },
    ]
    expect(correctOrder(books)).toEqual([2, 1, 0])
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
