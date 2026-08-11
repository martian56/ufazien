import { describe, it, expect } from 'vitest'

import {
  ACTIVITIES,
  EMOTE_SECONDS,
  RUN_SPEED,
  SIT_DROP,
  TURN_RATE,
  WALK_SPEED,
  approachAngle,
  gaitFor,
  isActivity,
  isHeld,
  poseFrame,
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

describe('poseFrame', () => {
  it('drops the hips by a seat height when sitting', () => {
    // The avatar is placed at floor level in front of the chair, so the drop
    // is what actually puts them on it.
    expect(poseFrame('sitting', 0, 0).hipDrop).toBeCloseTo(SIT_DROP)
    expect(poseFrame('standing', 0, 0).hipDrop).toBe(0)
  })

  it('folds the legs when sitting rather than sticking them out', () => {
    const frame = poseFrame('sitting', 0, 0)
    // Thigh forward, shin back down. A single-segment leg cannot do this, and
    // rotating one capsule at the hip gives a doll propped against a wall.
    expect(frame.leftHip).toBeCloseTo(-Math.PI / 2)
    expect(frame.leftKnee).toBeCloseTo(Math.PI / 2)
    expect(frame.rightHip).toBeCloseTo(-Math.PI / 2)
  })

  it('ignores movement while seated', () => {
    // The server keeps a seated player seated; the pose has to agree, or a
    // player nudging a key appears to walk on the spot in their chair.
    const still = poseFrame('sitting', 1.5, 0)
    const moving = poseFrame('sitting', 1.5, RUN_SPEED)
    expect(moving).toEqual(still)
  })

  it('never bends a knee backwards', () => {
    // Rectified in the walk cycle: a shin that swings through the thigh is the
    // most obvious possible animation bug.
    for (const speed of [WALK_SPEED, RUN_SPEED]) {
      for (let t = 0; t < 4; t += 0.05) {
        const frame = poseFrame('standing', t, speed)
        expect(frame.leftKnee, `t=${t}`).toBeGreaterThanOrEqual(0)
        expect(frame.rightKnee, `t=${t}`).toBeGreaterThanOrEqual(0)
      }
    }
  })

  it('swings the legs in opposition', () => {
    const frame = poseFrame('standing', 0.3, WALK_SPEED)
    expect(Math.sign(frame.leftHip)).toBe(-Math.sign(frame.rightHip))
  })

  it('counter-swings the arms against the legs', () => {
    const frame = poseFrame('standing', 0.3, WALK_SPEED)
    expect(Math.sign(frame.leftShoulder)).toBe(-Math.sign(frame.leftHip))
  })

  it('keeps a standing player still apart from a breath', () => {
    const frame = poseFrame('standing', 1, 0)
    expect(frame.leftHip).toBe(0)
    expect(frame.rightHip).toBe(0)
    expect(Math.abs(frame.headNod)).toBeLessThan(0.05)
  })

  it('raises one arm to raise a hand, not both', () => {
    const frame = poseFrame('hand_raised', 0, 0)
    expect(frame.rightShoulder).toBeLessThan(-2)
    expect(frame.leftShoulder).toBeCloseTo(0)
  })

  it('brings the hands together and apart when clapping', () => {
    let closest = Infinity
    let widest = -Infinity
    for (let t = 0; t < 2; t += 0.01) {
      const frame = poseFrame('clapping', t, 0)
      const gap = frame.leftShoulderZ - frame.rightShoulderZ
      closest = Math.min(closest, gap)
      widest = Math.max(widest, gap)
    }
    expect(widest).toBeGreaterThan(closest + 0.3)
  })

  it('still walks while emoting', () => {
    // Waving does not stop your legs. The emote is layered over the gait.
    const frame = poseFrame('waving', 0.3, WALK_SPEED)
    expect(Math.abs(frame.leftHip)).toBeGreaterThan(0.01)
  })

  it('returns finite angles for every pose at any time', () => {
    for (const activity of ACTIVITIES) {
      for (const speed of [0, WALK_SPEED, RUN_SPEED]) {
        for (const t of [0, 0.37, 12.5]) {
          const frame = poseFrame(activity as Activity, t, speed)
          for (const [joint, value] of Object.entries(frame)) {
            expect(Number.isFinite(value), `${activity} ${joint}`).toBe(true)
          }
        }
      }
    }
  })
})

describe('leaning', () => {
  it('is a posture that holds rather than an emote that releases', () => {
    expect(isHeld('leaning')).toBe(true)
  })

  it('leans backwards, onto the wall rather than off it', () => {
    // Forwards reads as being about to fall over. The wall is behind, because
    // that is the only side the detection looks at.
    const pose = poseFrame('leaning', 0, 0)
    expect(pose.torsoLean).toBeLessThan(0)
  })

  it('ignores the gait, because you cannot walk while propped up', () => {
    // Laid over a walk it produced a player sliding along the wall at an angle.
    const still = poseFrame('leaning', 1, 0)
    const running = poseFrame('leaning', 1, RUN_SPEED)
    expect(running).toEqual(still)
  })

  it('crosses one leg over the other', () => {
    // What separates it from standing still at a slight angle.
    const pose = poseFrame('leaning', 0, 0)
    expect(pose.leftHip).not.toBeCloseTo(pose.rightHip)
  })

  it('is a real activity as far as the wire is concerned', () => {
    expect(isActivity('leaning')).toBe(true)
    expect(toActivity('leaning')).toBe('leaning')
  })
})
