import { mulberry32 } from '../campusLayout'
import type { Vec3 } from '../campusLayout'

/**
 * The rules of the four campus mini-games, with no React and no three.js in
 * sight.
 *
 * Everything that decides whether you scored, how long you took, or what the
 * next round asks of you lives here so it can be tested directly. The
 * components in this folder do the drawing and nothing else — a shot going in
 * is a function of two positions and a hoop, not of a render.
 */

export type MinigameId = 'basketball' | 'dash' | 'titration' | 'booksort'

export interface Point3 {
  x: number
  y: number
  z: number
}

export interface MinigameMeta {
  id: MinigameId
  name: string
  /** Shown on the station, and in the prompt when you walk up to it. */
  blurb: string
  /** How to play, in one line. */
  controls: string
  icon: string
}

export const MINIGAMES: Record<MinigameId, MinigameMeta> = {
  basketball: {
    id: 'basketball',
    name: 'Free Throws',
    blurb: 'Ten shots. Hold to charge, release to shoot.',
    controls: 'Hold F to charge · release to shoot',
    icon: '🏀',
  },
  dash: {
    id: 'dash',
    name: 'Campus Dash',
    blurb: 'Run the whole campus through every ring before the clock runs out.',
    controls: 'Run through the rings in order',
    icon: '⏱️',
  },
  titration: {
    id: 'titration',
    name: 'Titration',
    blurb: 'Add exactly enough titrant to hit the endpoint. No more.',
    controls: 'Hold F to pour · release to stop',
    icon: '⚗️',
  },
  booksort: {
    id: 'booksort',
    name: 'Shelf Order',
    blurb: 'Put the returns back in call-number order, fastest wins.',
    controls: 'Click the books in ascending order',
    icon: '📚',
  },
}

/* ------------------------------------------------------------------ */
/* Free throws                                                          */
/* ------------------------------------------------------------------ */

/** Metres per second squared. Tuned for feel, not for Earth. */
export const GRAVITY = 16

/** Fastest a throw can leave the hand, at full charge. */
export const MAX_THROW_SPEED = 15.5
export const MIN_THROW_SPEED = 6

export interface Projectile {
  position: Point3
  velocity: Point3
}

/**
 * How much charge a hold of `seconds` has built up, as 0..1.
 *
 * Ramps and then holds rather than looping back to zero: a meter that wraps
 * around punishes you for thinking, and this is a game about aiming.
 */
export function chargeFor(seconds: number, fullChargeAt = 1.1): number {
  if (!Number.isFinite(seconds) || seconds <= 0) return 0
  return Math.min(1, seconds / fullChargeAt)
}

/** Turns an aim direction and a charge into a launch velocity. */
export function launchVelocity(direction: Point3, charge: number): Point3 {
  const length = Math.hypot(direction.x, direction.y, direction.z) || 1
  const speed = MIN_THROW_SPEED + (MAX_THROW_SPEED - MIN_THROW_SPEED) * Math.max(0, Math.min(1, charge))
  return {
    x: (direction.x / length) * speed,
    y: (direction.y / length) * speed,
    z: (direction.z / length) * speed,
  }
}

/** One step of ballistic flight. Returns a new object; does not mutate. */
export function stepProjectile(ball: Projectile, dt: number, gravity = GRAVITY): Projectile {
  const vy = ball.velocity.y - gravity * dt
  return {
    position: {
      x: ball.position.x + ball.velocity.x * dt,
      y: ball.position.y + (ball.velocity.y + vy) * 0.5 * dt,
      z: ball.position.z + ball.velocity.z * dt,
    },
    velocity: { x: ball.velocity.x, y: vy, z: ball.velocity.z },
  }
}

/**
 * Did the ball drop through the ring between these two positions?
 *
 * Checked as a downward crossing of the hoop's plane, not as proximity: a ball
 * that flies up through the net from below has not scored, and one that sails
 * past at ring height in a single frame would be missed entirely by a distance
 * test at 60fps.
 */
export function passedThroughHoop(
  previous: Point3,
  next: Point3,
  hoop: Point3,
  radius = 0.55,
): boolean {
  // Must be travelling downwards across the ring's height.
  if (!(previous.y > hoop.y && next.y <= hoop.y)) return false

  const span = previous.y - next.y
  // Guard against a zero-length step, which would divide by nothing.
  const t = span === 0 ? 0 : (previous.y - hoop.y) / span
  const x = previous.x + (next.x - previous.x) * t
  const z = previous.z + (next.z - previous.z) * t

  return Math.hypot(x - hoop.x, z - hoop.z) <= radius
}

export interface ThrowSession {
  shots: number
  made: number
  streak: number
  bestStreak: number
  score: number
}

export const FREE_THROW_ATTEMPTS = 10

export function newThrowSession(): ThrowSession {
  return { shots: 0, made: 0, streak: 0, bestStreak: 0, score: 0 }
}

/**
 * Records a shot.
 *
 * A run of makes is worth more than the same number scattered about, which is
 * what makes the tenth shot tense rather than routine.
 */
export function recordShot(session: ThrowSession, made: boolean): ThrowSession {
  const streak = made ? session.streak + 1 : 0
  return {
    shots: session.shots + 1,
    made: session.made + (made ? 1 : 0),
    streak,
    bestStreak: Math.max(session.bestStreak, streak),
    score: session.score + (made ? 100 + (streak - 1) * 25 : 0),
  }
}

export function throwSessionOver(session: ThrowSession): boolean {
  return session.shots >= FREE_THROW_ATTEMPTS
}

/* ------------------------------------------------------------------ */
/* Campus dash                                                          */
/* ------------------------------------------------------------------ */

/**
 * The route.
 *
 * Deliberately spread to the far corners of the campus: the point of the game
 * is to make the bigger world worth having, so the route has to visit the
 * dorms and the sports hall rather than circling the quad.
 */
export const DASH_CHECKPOINTS: Vec3[] = [
  [0, 0, 30],
  [-62, 0, 22],
  [-70, 0, 92],
  [-10, 0, 100],
  // Past the basketball court, not on it. A ring standing on the free-throw
  // line put a two-metre hoop between the shooter and the basket.
  [74, 0, 150],
  [68, 0, 34],
  [62, 0, -34],
  [0, 0, -56],
]

/** Seconds to beat. Anything slower still finishes, it just does not medal. */
export const DASH_PAR = 95
export const DASH_TIME_LIMIT = 180
/** How close counts as through the ring. */
export const DASH_RADIUS = 4.5

export interface DashState {
  index: number
  /** Seconds since the run began, or null before the first ring. */
  elapsed: number
  running: boolean
  finished: boolean
  /** Split times, one per ring cleared. */
  splits: number[]
}

export function newDashState(): DashState {
  return { index: 0, elapsed: 0, running: false, finished: false, splits: [] }
}

/**
 * Advances the run given where the player is now.
 *
 * Only the *next* ring counts, so you cannot shortcut the route by clipping
 * ring six on your way to ring two.
 */
export function advanceDash(
  state: DashState,
  x: number,
  z: number,
  elapsed: number,
  checkpoints: Vec3[] = DASH_CHECKPOINTS,
  radius = DASH_RADIUS,
): DashState {
  if (state.finished) return state

  const target = checkpoints[state.index]
  if (!target) return { ...state, finished: true, running: false }

  const reached = Math.hypot(x - target[0], z - target[2]) <= radius
  if (!reached) return { ...state, elapsed, running: state.running }

  const index = state.index + 1
  const finished = index >= checkpoints.length
  return {
    index,
    elapsed,
    running: !finished,
    finished,
    splits: [...state.splits, elapsed],
  }
}

export type Medal = 'gold' | 'silver' | 'bronze' | 'none'

export function dashMedal(seconds: number, par = DASH_PAR): Medal {
  if (!Number.isFinite(seconds) || seconds <= 0) return 'none'
  if (seconds <= par) return 'gold'
  if (seconds <= par * 1.25) return 'silver'
  if (seconds <= par * 1.6) return 'bronze'
  return 'none'
}

/** Score for a finished run: faster is worth more, and it never goes negative. */
export function dashScore(seconds: number, par = DASH_PAR): number {
  if (!Number.isFinite(seconds) || seconds <= 0) return 0
  return Math.max(50, Math.round(1000 * (par / Math.max(seconds, 1))))
}

/* ------------------------------------------------------------------ */
/* Titration                                                           */
/* ------------------------------------------------------------------ */

export const TITRATION_TOLERANCE = 1.4
export const TITRATION_ROUNDS = 5
/** Millilitres delivered per second of pouring. */
export const TITRATION_FLOW = 7.5
export const TITRATION_BURETTE = 50

/**
 * The endpoint for a round, in millilitres.
 *
 * Seeded rather than random so a round is reproducible — and so the test can
 * assert the range without stubbing `Math.random`.
 */
export function titrationTarget(seed: number, round: number): number {
  const random = mulberry32(seed + round * 7919)
  // 14–38 ml: far enough from zero that you cannot win by tapping, and short
  // of the burette's capacity so overshooting is always possible.
  return Math.round((14 + random() * 24) * 10) / 10
}

export interface TitrationVerdict {
  score: number
  /** −1 short, 0 on the endpoint, 1 over. */
  direction: -1 | 0 | 1
  label: string
  error: number
}

/**
 * Marks one round.
 *
 * Full marks are a narrow band around the endpoint, then it falls off linearly
 * to nothing at the tolerance. Overshooting and undershooting cost the same,
 * because in a real titration both mean doing it again.
 */
export function titrationVerdict(
  delivered: number,
  target: number,
  tolerance = TITRATION_TOLERANCE,
): TitrationVerdict {
  const error = Math.round((delivered - target) * 100) / 100
  const magnitude = Math.abs(error)
  const perfectBand = tolerance * 0.15

  let score: number
  if (magnitude <= perfectBand) score = 100
  else score = Math.max(0, Math.round(100 * (1 - (magnitude - perfectBand) / (tolerance - perfectBand))))

  const direction: -1 | 0 | 1 = magnitude <= perfectBand ? 0 : error > 0 ? 1 : -1
  const label =
    direction === 0
      ? 'Endpoint'
      : direction > 0
        ? `Overshot by ${magnitude.toFixed(1)} ml`
        : `Short by ${magnitude.toFixed(1)} ml`

  return { score, direction, label, error }
}

/** How the flask looks: clear below the endpoint, pink past it. */
export function titrationColour(delivered: number, target: number): string {
  if (delivered <= 0) return '#dff3ff'
  const ratio = delivered / Math.max(target, 0.001)
  if (ratio < 0.92) return '#dff3ff'
  if (ratio < 1.02) return '#ffd6ea'
  return '#e0409a'
}

/* ------------------------------------------------------------------ */
/* Shelf order                                                          */
/* ------------------------------------------------------------------ */

export interface ShelfBook {
  id: number
  /** A Library of Congress style call number, e.g. "QA 76.73". */
  code: string
  /** What it sorts by, precomputed so comparisons are not string parsing. */
  rank: number
  /** Where it sits on the desk, in the room's local space. */
  slot: number
}

const LC_CLASSES = ['QA', 'QC', 'QD', 'QH', 'TA', 'TK', 'HB', 'PN', 'BF', 'GV']

/** Deals a shuffled shelf of books for a round. */
export function makeShelf(seed: number, count = 6): ShelfBook[] {
  const random = mulberry32(seed)
  const used = new Set<string>()
  const books: ShelfBook[] = []

  // Bounded, because rejecting duplicates could in principle never terminate.
  for (let attempt = 0; attempt < count * 40 && books.length < count; attempt++) {
    const cls = LC_CLASSES[Math.floor(random() * LC_CLASSES.length)]
    const major = Math.floor(random() * 900) + 10
    const minor = Math.floor(random() * 99)
    const code = `${cls} ${major}.${minor}`
    if (used.has(code)) continue
    used.add(code)
    books.push({
      id: books.length,
      code,
      rank: LC_CLASSES.indexOf(cls) * 100000 + major * 100 + minor,
      slot: books.length,
    })
  }

  // Shuffle the slots, so the desk is not already in order.
  const slots = books.map((_, i) => i)
  for (let i = slots.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[slots[i], slots[j]] = [slots[j], slots[i]]
  }
  return books.map((book, i) => ({ ...book, slot: slots[i] }))
}

/** The order the books have to be picked in. */
export function correctOrder(books: ShelfBook[]): number[] {
  return [...books].sort((a, b) => a.rank - b.rank).map((book) => book.id)
}

export interface ShelfState {
  picked: number[]
  mistakes: number
  done: boolean
}

export function newShelfState(): ShelfState {
  return { picked: [], mistakes: 0, done: false }
}

/**
 * Handles a pick.
 *
 * A wrong pick costs a mistake but does not reset the run: restarting from
 * scratch on a slip is how you get people to stop playing.
 */
export function pickBook(state: ShelfState, books: ShelfBook[], id: number): ShelfState {
  if (state.done || state.picked.includes(id)) return state

  const order = correctOrder(books)
  const expected = order[state.picked.length]

  if (id !== expected) {
    return { ...state, mistakes: state.mistakes + 1 }
  }

  const picked = [...state.picked, id]
  return { picked, mistakes: state.mistakes, done: picked.length === books.length }
}

/** Score for a completed shelf. Speed matters, accuracy matters more. */
export function shelfScore(books: number, seconds: number, mistakes: number): number {
  const base = books * 100
  const speedBonus = Math.max(0, Math.round((45 - seconds) * 8))
  return Math.max(0, base + speedBonus - mistakes * 60)
}

/* ------------------------------------------------------------------ */

/** mm:ss, for every clock in every game. */
export function formatClock(seconds: number): string {
  const safe = Math.max(0, Math.floor(Number.isFinite(seconds) ? seconds : 0))
  const minutes = Math.floor(safe / 60)
  return `${minutes}:${String(safe % 60).padStart(2, '0')}`
}
