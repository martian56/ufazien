/**
 * How a student moves and what they are doing with themselves.
 *
 * Pure, and separate from the model that draws it, so the parts worth checking
 * can be checked without a WebGL context: that a run does not look like a walk
 * played at the same speed, that turning takes the short way round, and that a
 * seated avatar's legs actually end up under the desk.
 *
 * ## What was wrong with the old walk
 *
 * One cycle at a fixed cadence — `elapsedTime * 9` — regardless of how fast the
 * player was actually going. Sprinting at 11 m/s used exactly the same leg
 * speed as walking at 5.5, so the feet visibly skated, and there was no
 * acceleration, no lean and no settle: the whole body switched between two
 * states on a boolean.
 */

/** The poses a player can be in. Mirrors `PlayerPosition.ACTIVITY_CHOICES`. */
export type Activity =
  | 'standing'
  | 'sitting'
  | 'leaning'
  | 'waving'
  | 'clapping'
  | 'hand_raised'
  | 'pointing'

export const ACTIVITIES: readonly Activity[] = [
  'standing',
  'sitting',
  'leaning',
  'waving',
  'clapping',
  'hand_raised',
  'pointing',
]

const ACTIVITY_SET: ReadonlySet<string> = new Set(ACTIVITIES)

/**
 * Narrows whatever arrived over the socket.
 *
 * A Set rather than an object literal, for the same reason `FACING` is a Map:
 * an inherited key like `constructor` is not undefined, so a `??` fallback
 * would never fire and a function would reach a rotation.
 */
export function isActivity(value: unknown): value is Activity {
  return typeof value === 'string' && ACTIVITY_SET.has(value)
}

export function toActivity(value: unknown): Activity {
  return isActivity(value) ? value : 'standing'
}

/** Emotes play once and then release; sitting and standing persist. */
export const HELD_ACTIVITIES: ReadonlySet<Activity> = new Set<Activity>([
  'standing',
  'sitting',
  'leaning',
  'hand_raised',
])

export function isHeld(activity: Activity): boolean {
  return HELD_ACTIVITIES.has(activity)
}

/** How long a one-shot emote runs for, in seconds. */
export const EMOTE_SECONDS = 2.4

export const WALK_SPEED = 5.5
export const RUN_SPEED = 11

export interface Gait {
  /** Radians per second of the leg cycle. */
  cadence: number
  /** Peak leg swing, in radians. */
  swing: number
  /** Vertical bob per stride, in world units. */
  bob: number
  /** Forward lean, in radians. */
  lean: number
  /** How much the arms swing relative to the legs. */
  armRatio: number
}

/**
 * The gait for a given ground speed.
 *
 * Cadence rises with the square root of speed rather than in proportion to it,
 * which is how legs actually behave: going twice as fast is mostly a longer
 * stride, not twice as many steps. Straight proportionality gives a sprint that
 * looks like a cartoon.
 */
export function gaitFor(speed: number): Gait {
  const safe = Number.isFinite(speed) && speed > 0 ? speed : 0
  if (safe < 0.1) {
    return { cadence: 0, swing: 0, bob: 0, lean: 0, armRatio: 0 }
  }

  const cadence = 4.2 * Math.sqrt(safe)
  // Stride opens up with speed and then stops: a leg only reaches so far.
  const swing = Math.min(0.95, 0.32 + safe * 0.055)
  const run = Math.min(1, Math.max(0, (safe - WALK_SPEED) / (RUN_SPEED - WALK_SPEED)))

  return {
    cadence,
    swing,
    bob: 0.035 + run * 0.05,
    // You lean into a run. Standing upright at 11 m/s reads as being dragged.
    lean: run * 0.16,
    armRatio: 0.7 + run * 0.35,
  }
}

/* ------------------------------------------------------------------ */
/* Turning                                                              */
/* ------------------------------------------------------------------ */

/** The shorter of the two ways round from one angle to another. */
export function shortestTurn(from: number, to: number): number {
  let delta = (to - from) % (Math.PI * 2)
  if (delta > Math.PI) delta -= Math.PI * 2
  if (delta < -Math.PI) delta += Math.PI * 2
  return delta
}

/**
 * Steps an angle towards another, at most `maxStep` this frame.
 *
 * Avatars used to snap between four cardinal headings. Turning smoothly means
 * interpolating, and interpolating angles naively spins the long way round
 * whenever the shorter path crosses pi — a student turning from just west of
 * north to just east of north would rotate 350 degrees to do it.
 */
export function approachAngle(from: number, to: number, maxStep: number): number {
  const delta = shortestTurn(from, to)
  if (Math.abs(delta) <= maxStep) return to
  return from + Math.sign(delta) * maxStep
}

/**
 * How fast an avatar may turn, in radians per second.
 *
 * Fast enough that it never lags visibly behind where someone is walking, slow
 * enough that the turn reads as a turn.
 */
export const TURN_RATE = 9

/* ------------------------------------------------------------------ */
/* Poses                                                                */
/* ------------------------------------------------------------------ */

/**
 * Everything the rig needs for one frame.
 *
 * Angles are radians about X unless named otherwise. The rig has a hip and a
 * knee per leg and a shoulder and an elbow per arm, which is the minimum that
 * lets somebody sit down: with a single-segment leg, sitting puts both legs out
 * horizontally in front like a doll.
 */
export interface PoseFrame {
  /** How far the whole body drops, for sitting. */
  hipDrop: number
  torsoLean: number
  headTurn: number
  headNod: number
  leftHip: number
  rightHip: number
  leftKnee: number
  rightKnee: number
  leftShoulder: number
  rightShoulder: number
  /** Outward swing of the arms, about Z. Used by waving and clapping. */
  leftShoulderZ: number
  rightShoulderZ: number
  leftElbow: number
  rightElbow: number
}

const REST: PoseFrame = {
  hipDrop: 0,
  torsoLean: 0,
  headTurn: 0,
  headNod: 0,
  leftHip: 0,
  rightHip: 0,
  leftKnee: 0,
  rightKnee: 0,
  leftShoulder: 0,
  rightShoulder: 0,
  leftShoulderZ: 0,
  rightShoulderZ: 0,
  leftElbow: 0,
  rightElbow: 0,
}

/** How far the hips drop when sitting: roughly the height of a chair seat. */
export const SIT_DROP = 0.42

/**
 * The pose for one frame.
 *
 * `time` is seconds — the animation clock, not a delta. `speed` is ground speed
 * in world units per second, and is what decides whether this is a walk, a run
 * or a stand.
 */
export function poseFrame(activity: Activity, time: number, speed: number): PoseFrame {
  if (activity === 'sitting') return sitPose(time)
  // Leaning is a whole-body pose like sitting rather than something laid over
  // a gait: you cannot walk while propped against a wall, and blending the two
  // gives a player sliding along it at a angle.
  if (activity === 'leaning') return leanPose(time)

  const gait = gaitFor(speed)
  const base = gait.cadence > 0 ? walkPose(gait, time) : idlePose(time)

  switch (activity) {
    case 'waving':
      return { ...base, ...wave(time) }
    case 'clapping':
      return { ...base, ...clap(time) }
    case 'hand_raised':
      return { ...base, ...handRaised() }
    case 'pointing':
      return { ...base, ...point() }
    default:
      return base
  }
}

function walkPose(gait: Gait, time: number): PoseFrame {
  const phase = time * gait.cadence
  const swing = Math.sin(phase) * gait.swing

  return {
    ...REST,
    torsoLean: gait.lean,
    // The head lags the shoulders slightly, which is most of what makes a walk
    // look like a walk rather than a slide.
    headTurn: -Math.sin(phase) * 0.05,
    leftHip: swing,
    rightHip: -swing,
    // A knee only bends one way, and only on the leg that is travelling
    // forward. Rectified, so the shin never hyperextends through the thigh.
    leftKnee: Math.max(0, -Math.sin(phase)) * gait.swing * 1.15,
    rightKnee: Math.max(0, Math.sin(phase)) * gait.swing * 1.15,
    leftShoulder: -swing * gait.armRatio,
    rightShoulder: swing * gait.armRatio,
    leftElbow: Math.max(0, swing) * 0.5,
    rightElbow: Math.max(0, -swing) * 0.5,
  }
}

function idlePose(time: number): PoseFrame {
  // A slow breath, so a student standing still is not a statue.
  return { ...REST, headNod: Math.sin(time * 1.5) * 0.02 }
}

/**
 * Sitting.
 *
 * Thighs forward and level, shins down, torso upright with the faintest
 * settle. The hips drop by a seat height so that placing the avatar at floor
 * level in front of a chair puts them *on* it.
 */
function sitPose(time: number): PoseFrame {
  const settle = Math.sin(time * 1.2) * 0.012
  return {
    ...REST,
    hipDrop: SIT_DROP,
    torsoLean: 0.06 + settle,
    headNod: settle,
    leftHip: -Math.PI / 2,
    rightHip: -Math.PI / 2,
    leftKnee: Math.PI / 2,
    rightKnee: Math.PI / 2,
    // Hands resting on the thighs rather than hanging through the seat.
    leftShoulder: -0.45,
    rightShoulder: -0.45,
    leftElbow: 0.7,
    rightElbow: 0.7,
  }
}

/**
 * Propped against a wall.
 *
 * The lean is backwards, away from the direction the avatar faces, because the
 * wall is behind them — a forward lean reads as being about to fall over. One
 * ankle crossed over the other is what separates it from standing still at a
 * slight angle, and is most of why it looks deliberate.
 */
export const LEAN_ANGLE = -0.22

function leanPose(time: number): PoseFrame {
  // Slower than the standing idle: somebody leaning is settled, and breathing
  // at walking pace against a wall looks like fidgeting.
  const breathe = Math.sin(time * 0.9) * 0.015

  return {
    ...REST,
    torsoLean: LEAN_ANGLE + breathe,
    headNod: -breathe,
    // The near leg straight and taking the weight, the far one crossed in
    // front of it.
    leftHip: 0.06,
    rightHip: -0.22,
    rightKnee: 0.3,
    // Arms folded, which is what hands do when the hips are not free.
    leftShoulder: -0.5,
    rightShoulder: -0.5,
    leftElbow: 1.5,
    rightElbow: 1.5,
    leftShoulderZ: 0.18,
    rightShoulderZ: -0.18,
  }
}

function wave(time: number): Partial<PoseFrame> {
  const swing = Math.sin(time * 9) * 0.5
  return {
    rightShoulder: -2.5,
    rightShoulderZ: -0.5 + swing * 0.5,
    rightElbow: 0.3,
    headTurn: 0.1,
  }
}

function clap(time: number): Partial<PoseFrame> {
  // Hands meet in front of the chest and part again, twice a second.
  const close = (Math.sin(time * 12) + 1) / 2
  const spread = 0.42 - close * 0.34
  return {
    leftShoulder: -1.3,
    rightShoulder: -1.3,
    leftShoulderZ: spread,
    rightShoulderZ: -spread,
    leftElbow: 1.1,
    rightElbow: 1.1,
  }
}

function handRaised(): Partial<PoseFrame> {
  // Straight up and held, which is what a raised hand in a lecture is.
  return { rightShoulder: -2.9, rightShoulderZ: -0.12, rightElbow: 0.05 }
}

function point(): Partial<PoseFrame> {
  return { rightShoulder: -1.55, rightElbow: 0.08, headTurn: -0.12 }
}
