import { describe, it, expect } from 'vitest'

import {
  ACTIVITIES,
  EMOTE_SECONDS,
  POSED_EMOTES,
  RUN_SPEED,
  SEATED_TURNS,
  TURN_RATE,
  WALK_SPEED,
  approachAngle,
  gaitFor,
  isActivity,
  isHeld,
  isPosedEmote,
  poseTurns,
  shortestTurn,
  toActivity,
  type Activity,
} from './avatarPose'

/**
 * The walk used to be one cycle at a fixed `elapsedTime * 9`, whatever the
 * player was actually doing. Sprinting at 11 m/s used the same leg speed as
 * walking at 5.5, so the feet skated, and there was no sitting pose at all.
 */

describe('gaitFor', () => {
  it('stands still at a standstill', () => {
    expect(gaitFor(0).cadence).toBe(0)
    expect(gaitFor(0).swing).toBe(0)
  })

  it('takes faster steps at a run than at a walk', () => {
    // The bug: these two were identical, which is what made the feet skate.
    expect(gaitFor(RUN_SPEED).cadence).toBeGreaterThan(gaitFor(WALK_SPEED).cadence)
  })

  it('opens the stride up with speed but not without limit', () => {
    expect(gaitFor(RUN_SPEED).swing).toBeGreaterThan(gaitFor(WALK_SPEED).swing)
    // A leg only reaches so far. Unbounded, a fast enough player does the splits.
    expect(gaitFor(40).swing).toBeLessThanOrEqual(0.95)
  })

  it('scales cadence sub-linearly, so a run is a longer stride not a scramble', () => {
    const walk = gaitFor(WALK_SPEED).cadence
    const run = gaitFor(RUN_SPEED).cadence
    const ratio = run / walk
    const speedRatio = RUN_SPEED / WALK_SPEED
    expect(ratio).toBeLessThan(speedRatio)
    expect(ratio).toBeGreaterThan(1.2)
  })

  it('leans into a run and stands upright at a walk', () => {
    expect(gaitFor(WALK_SPEED).lean).toBeCloseTo(0)
    expect(gaitFor(RUN_SPEED).lean).toBeGreaterThan(0.1)
  })

  it('survives a speed that is not a number', () => {
    for (const bad of [Number.NaN, -3, Infinity]) {
      const gait = gaitFor(bad)
      expect(Number.isFinite(gait.cadence), String(bad)).toBe(true)
      expect(Number.isFinite(gait.swing)).toBe(true)
    }
  })
})

describe('activities', () => {
  it('accepts the poses it knows', () => {
    for (const activity of ACTIVITIES) {
      expect(isActivity(activity), activity).toBe(true)
    }
  })

  it('rejects an inherited key rather than treating it as a pose', () => {
    // Same trap as `FACING`: with an object literal, `constructor` is not
    // undefined, so a `??` fallback never fires and a function reaches a
    // rotation, which makes a NaN matrix and removes the avatar from the scene.
    expect(isActivity('constructor')).toBe(false)
    expect(isActivity('toString')).toBe(false)
    expect(toActivity('constructor')).toBe('standing')
  })

  it('falls back to standing for anything unrecognised', () => {
    expect(toActivity('breakdancing')).toBe('standing')
    expect(toActivity(undefined)).toBe('standing')
    expect(toActivity(42)).toBe('standing')
  })

  it('holds a pose that should persist and releases one that should not', () => {
    expect(isHeld('sitting')).toBe(true)
    expect(isHeld('hand_raised')).toBe(true)
    // A wave that lasts until you press something else is a stuck arm.
    expect(isHeld('waving')).toBe(false)
    expect(isHeld('clapping')).toBe(false)
    expect(EMOTE_SECONDS).toBeGreaterThan(0)
  })
})

describe('turning', () => {
  it('takes the short way round past pi', () => {
    // Just west of north to just east of north is a small turn, not a 350
    // degree spin, which is what naive interpolation of angles gives.
    const from = Math.PI - 0.1
    const to = -Math.PI + 0.1
    expect(Math.abs(shortestTurn(from, to))).toBeLessThan(0.3)
  })

  it('reports zero for the same angle expressed differently', () => {
    expect(shortestTurn(0, Math.PI * 2)).toBeCloseTo(0)
    expect(shortestTurn(1, 1 + Math.PI * 4)).toBeCloseTo(0)
  })

  it('steps towards the target and arrives without overshooting', () => {
    const step = TURN_RATE * (1 / 60)
    let angle = 0
    const target = 1.2
    for (let i = 0; i < 200; i++) angle = approachAngle(angle, target, step)
    expect(angle).toBeCloseTo(target)
  })

  it('never moves further than the step allows', () => {
    const moved = approachAngle(0, Math.PI, 0.1)
    expect(Math.abs(moved)).toBeCloseTo(0.1)
  })

  it('snaps the last fraction rather than creeping forever', () => {
    expect(approachAngle(0, 0.01, 0.1)).toBe(0.01)
  })
})

/**
 * The joints in the pack, so a pose cannot name one that is not there.
 *
 * A misspelled joint is the quietest possible failure: nothing throws, nothing
 * logs, the lookup returns undefined, the turn is skipped and the emote simply
 * does not happen. That is how the seated pose did nothing at all for a while —
 * the pack calls a joint `UpperLeg.L` and three.js renames it `UpperLeg_L`, so
 * sixty-two bones were in the map and not one under the name being asked for.
 */
const RIG = [
  'Head', 'Neck', 'Chest', 'Torso', 'Abdomen', 'Hips', 'Root', 'Body',
  ...['L', 'R'].flatMap((side) => [
    `Shoulder.${side}`, `UpperArm.${side}`, `LowerArm.${side}`, `Wrist.${side}`,
    `UpperLeg.${side}`, `LowerLeg.${side}`, `Foot.${side}`, `PT.${side}`,
  ]),
]

describe('posed emotes', () => {
  it('only turns joints the rig actually has', () => {
    for (const activity of ACTIVITIES) {
      for (const time of [0, 0.37, 12.5]) {
        for (const turn of poseTurns(activity as Activity, time)) {
          expect(RIG, `${activity} turns ${turn.joint}`).toContain(turn.joint)
        }
      }
    }
  })

  it('gives every posed emote something to do, and the rest nothing', () => {
    // The bug this replaces: clapping, a raised hand and pointing all fell
    // through to whichever baked clip was nearest, because the pack has none of
    // them and the poses written for them were for the avatar before this one.
    for (const activity of POSED_EMOTES) {
      expect(poseTurns(activity, 0).length, activity).toBeGreaterThan(0)
    }
    for (const activity of ['standing', 'waving', 'leaning'] as Activity[]) {
      expect(poseTurns(activity, 0), activity).toEqual([])
    }
    // Waving is the one emote the pack ships a clip for, so it is not posed.
    expect(isPosedEmote('waving')).toBe(false)
  })

  it('folds the hips in the parent frame and the knees in their own', () => {
    // In the parent's frame the two knees bend in opposite directions and the
    // legs cross over, which is a yoga pose rather than somebody on a chair.
    const hip = SEATED_TURNS.find((turn) => turn.joint === 'UpperLeg.L')
    const knee = SEATED_TURNS.find((turn) => turn.joint === 'LowerLeg.L')
    expect(hip?.frame).toBe('parent')
    expect(knee?.frame).toBeUndefined()
    expect(poseTurns('sitting', 0)).toEqual(SEATED_TURNS)
  })

  it('raises one hand, not two', () => {
    // Both arms up is surrender, not a question.
    const sides = new Set(poseTurns('hand_raised', 0).map((turn) => turn.joint.slice(-1)))
    expect(sides).toEqual(new Set(['R']))
  })

  it('opens and shuts the hands when clapping, on both arms', () => {
    const elbow = (t: number, side: string) =>
      poseTurns('clapping', t).find((turn) => turn.joint === `LowerArm.${side}`)!.angle

    for (const side of ['L', 'R']) {
      let shut = -Infinity
      let open = Infinity
      for (let t = 0; t < 2; t += 0.01) {
        shut = Math.max(shut, elbow(t, side))
        open = Math.min(open, elbow(t, side))
      }
      // A clap the hands never part for is a held prayer.
      expect(shut - open, side).toBeGreaterThan(0.4)
    }
  })

  it('claps with both hands doing the same thing at the same moment', () => {
    // One hand leading the other by half a cycle is not applause.
    for (const t of [0, 0.13, 0.5, 3.7]) {
      expect(elbowOf(t, 'L')).toBeCloseTo(elbowOf(t, 'R'))
    }
  })

  it('holds a raised hand still enough to read as held', () => {
    // It is a held activity: it stays up until the player drops it. A sway
    // wide enough to be a wave would make it the gesture it is not.
    const shoulder = (t: number) =>
      poseTurns('hand_raised', t).find((turn) => turn.axis === 'z')!.angle
    let lowest = Infinity
    let highest = -Infinity
    for (let t = 0; t < 8; t += 0.02) {
      lowest = Math.min(lowest, shoulder(t))
      highest = Math.max(highest, shoulder(t))
    }
    expect(highest - lowest).toBeLessThan(0.12)
    expect(highest - lowest).toBeGreaterThan(0)
  })

  it('returns finite angles for every activity at any time', () => {
    for (const activity of ACTIVITIES) {
      for (const t of [0, 0.37, 12.5, 1e6]) {
        for (const turn of poseTurns(activity as Activity, t)) {
          expect(Number.isFinite(turn.angle), `${activity} ${turn.joint}`).toBe(true)
        }
      }
    }
  })
})

function elbowOf(time: number, side: string): number {
  return poseTurns('clapping', time).find((turn) => turn.joint === `LowerArm.${side}`)!.angle
}

describe('leaning', () => {
  it('is a posture that holds rather than an emote that releases', () => {
    expect(isHeld('leaning')).toBe(true)
  })

  it('is a real activity as far as the wire is concerned', () => {
    expect(isActivity('leaning')).toBe(true)
    expect(toActivity('leaning')).toBe('leaning')
  })
})
