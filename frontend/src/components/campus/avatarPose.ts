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
 * One rotation applied to one joint of the rig the campus ships.
 *
 * ## Why poses are described this way now
 *
 * There used to be a `PoseFrame` here: a hip, a knee, a shoulder and an elbow
 * per side, with a `clap`, a `handRaised` and a `point` written against it. It
 * described the avatar the campus used to draw, which was built out of cones
 * and spheres. When that was replaced by Quaternius's rigged characters,
 * nothing consumed any of it any more, and it was never noticed because the
 * whole file is pure and its tests kept passing — twenty-six of them, on code
 * no frame ever ran.
 *
 * What players got instead was `clipFor` picking the nearest baked clip: a
 * clap played `Interact`, which is a reach, and a raised hand played `Wave`,
 * which is a wave. Those are the two the emote menu is most often used for, and
 * both of them plainly did something else. The pack has twenty-four clips and
 * not one of them is a clap, a raised hand or a point — the rest are combat —
 * so no amount of rebuilding the assets fixes it.
 *
 * So an emote is a handful of joint rotations laid over a still idle, which is
 * the technique sitting already used. Angles are in the joint's own frame,
 * applied in the order listed, and they are measured against the pack's actual
 * A-pose rest orientation rather than guessed: an arm bone here points down its
 * own +Y and neither arm's frame is world-aligned, so "rotate the shoulder
 * back by two radians" means nothing until you know which axis that is.
 */
export interface JointTurn {
  /** The joint, spelled as the pack spells it. */
  joint: string
  axis: 'x' | 'y' | 'z'
  /** Radians. */
  angle: number
  /**
   * Whose frame the axis is in.
   *
   * `local` — the joint's own, which is a hinge: a knee, an elbow.
   * `parent` — the bone above it, which is a swing: a hip.
   *
   * The distinction is not cosmetic. Folding both knees in the parent's frame
   * bends the two legs in opposite directions and crosses them over, which is
   * a yoga pose rather than a person on a chair.
   */
  frame?: 'parent' | 'local'
}

const DEG = Math.PI / 180

/**
 * Sitting: hips folded forward, knees bent, ankles eased.
 *
 * The pack has no sitting clip, so this goes over `Idle_Neutral`. A seated
 * character playing the animated idle sways from the waist as though standing.
 */
export const SEATED_TURNS: readonly JointTurn[] = [
  // Hips swing in the parent's frame, which for a thigh is the pelvis and is
  // near enough world-aligned.
  { joint: 'UpperLeg.L', axis: 'x', angle: -1.45, frame: 'parent' },
  { joint: 'UpperLeg.R', axis: 'x', angle: -1.45, frame: 'parent' },
  { joint: 'LowerLeg.L', axis: 'x', angle: 1.5 },
  { joint: 'LowerLeg.R', axis: 'x', angle: 1.5 },
  { joint: 'Foot.L', axis: 'x', angle: 0.25 },
  { joint: 'Foot.R', axis: 'x', angle: 0.25 },
]

/** How far apart the palms get between claps, as an elbow angle in degrees. */
const CLAP_OPEN = 62
const CLAP_SHUT = 100

/** Claps per second. Applause, not a slow hand. */
const CLAP_RATE = 12

/**
 * The emotes that are posed from the rig rather than played from a clip.
 *
 * Waving is not among them: the pack ships a wave and it is a better one than
 * six joint angles would be.
 */
export const POSED_EMOTES: readonly Activity[] = ['clapping', 'hand_raised', 'pointing']

export function isPosedEmote(activity: Activity): boolean {
  return POSED_EMOTES.includes(activity)
}

/**
 * The joint rotations for what a player is doing, if it is posed rather than
 * played.
 *
 * `time` is the animation clock in seconds, not a delta. Anything not posed
 * returns nothing, and the baked clip is left to do its job untouched.
 */
export function poseTurns(activity: Activity, time: number): readonly JointTurn[] {
  switch (activity) {
    case 'sitting':
      return SEATED_TURNS
    case 'clapping':
      return clapTurns(time)
    case 'hand_raised':
      return raisedTurns(time)
    case 'pointing':
      return POINT_TURNS
    default:
      return NO_TURNS
  }
}

const NO_TURNS: readonly JointTurn[] = []

/**
 * Clapping: both hands meeting on the centre line in front of the chest.
 *
 * The upper arms are fixed and only the elbows move, which is what a clap
 * actually is — swinging at the shoulder throws the hands past each other. The
 * two arms take different numbers because the rig's left and right joints are
 * mirrored rather than identical, so the same angle on each gives one hand in
 * front of the sternum and the other up by the ear.
 */
function clapTurns(time: number): JointTurn[] {
  const close = (Math.sin(time * CLAP_RATE) + 1) / 2
  const elbow = (CLAP_OPEN + close * (CLAP_SHUT - CLAP_OPEN)) * DEG

  return [
    { joint: 'UpperArm.R', axis: 'x', angle: 165 * DEG },
    { joint: 'UpperArm.R', axis: 'z', angle: 95 * DEG },
    { joint: 'LowerArm.R', axis: 'x', angle: elbow },
    { joint: 'UpperArm.L', axis: 'x', angle: -165 * DEG },
    { joint: 'UpperArm.L', axis: 'y', angle: 15 * DEG },
    { joint: 'UpperArm.L', axis: 'z', angle: -90 * DEG },
    { joint: 'LowerArm.L', axis: 'x', angle: elbow },
  ]
}

/**
 * A hand up, held.
 *
 * The right arm all but straight, wrist level with the top of the head and
 * outboard of the shoulder rather than across the face. `hand_raised` is a held
 * activity — it stays up until the player drops it — so the only movement is a
 * slight sway, because an arm frozen to the tenth of a degree reads as a
 * crashed animation.
 */
function raisedTurns(time: number): JointTurn[] {
  const sway = Math.sin(time * 1.6) * 1.5

  return [
    { joint: 'UpperArm.R', axis: 'x', angle: 155 * DEG },
    { joint: 'UpperArm.R', axis: 'z', angle: (-25 + sway) * DEG },
    { joint: 'LowerArm.R', axis: 'x', angle: 12 * DEG },
  ]
}

/** Pointing: right arm out in front, level, elbow nearly straight. */
const POINT_TURNS: readonly JointTurn[] = [
  { joint: 'UpperArm.R', axis: 'x', angle: -85 * DEG },
  { joint: 'UpperArm.R', axis: 'z', angle: 60 * DEG },
  { joint: 'LowerArm.R', axis: 'x', angle: 12 * DEG },
]
