import { describe, it, expect } from 'vitest'

import { AVATAR_MODELS, clipFor, clipRate, packIndex } from './GltfCharacter'
import { ACTIVITIES, POSED_EMOTES, RUN_SPEED, WALK_SPEED } from './avatarPose'

/**
 * The clip chosen for a given activity, and the pack chosen for a given seed.
 *
 * Both are pure and both are the kind of thing that goes wrong quietly: a bad
 * clip name plays nothing and the avatar freezes in its bind pose, and an
 * unstable pack index reshuffles everybody's clothes on reconnect.
 */

/** Kept in step with the build script's `KEEP`. */
const BUILT = ['Idle', 'Idle_Neutral', 'Walk', 'Run', 'Wave', 'Interact']

describe('choosing a clip', () => {
  it('only ever names a clip the assets actually contain', () => {
    // Anything else silently plays nothing, and the player stands in the
    // T-pose the model was authored in.
    for (const activity of ACTIVITIES) {
      for (const speed of [0, 1, WALK_SPEED, RUN_SPEED]) {
        for (const moving of [true, false]) {
          expect(BUILT, `${activity} at ${speed} moving=${moving}`).toContain(
            clipFor(activity, speed, moving),
          )
        }
      }
    }
  })

  it('walks below the halfway point and runs above it', () => {
    expect(clipFor('standing', WALK_SPEED, true)).toBe('Walk')
    expect(clipFor('standing', RUN_SPEED, true)).toBe('Run')
  })

  it('lets movement win over the emote', () => {
    // A player waving while they walk is walking. Playing the wave would leave
    // them sliding across the floor in a standing pose.
    expect(clipFor('waving', RUN_SPEED, true)).toBe('Run')
    expect(clipFor('waving', 0, false)).toBe('Wave')
  })

  it('holds still for sitting rather than playing a standing idle', () => {
    // `Idle` breathes and shifts weight. On someone in a chair that reads as
    // fidgeting hard enough to fall off it.
    expect(clipFor('sitting', 0, false)).toBe('Idle_Neutral')
    expect(clipFor('leaning', 0, false)).toBe('Idle_Neutral')
  })

  it('does not walk when a stationary client reports a stale speed', () => {
    // `is_moving` false with a leftover speed is what an interrupted client
    // sends, and treating it as movement moonwalks them on the spot.
    expect(clipFor('standing', 0.2, false)).toBe('Idle')
  })

  it('never plays a gesture clip for an emote the pack does not have', () => {
    // The bug. Clapping played `Interact`, which is reaching for a switch, and
    // a raised hand played `Wave` — so asking for a raised hand got you a wave,
    // which is not a near miss but a different gesture entirely. All three are
    // posed from the rig now, over a still idle.
    for (const activity of POSED_EMOTES) {
      expect(clipFor(activity, 0, false), activity).toBe('Idle_Neutral')
    }
  })
})

describe('the speed a gait clip plays at', () => {
  it('plays a gait clip at its own pace at the speed it was baked for', () => {
    expect(clipRate('Walk', WALK_SPEED)).toBeCloseTo(1)
    expect(clipRate('Run', RUN_SPEED)).toBeCloseTo(1)
  })

  it('slows the walk down for somebody creeping', () => {
    // Otherwise the legs march at full stride while the player barely moves,
    // which is the same skating the fixed cadence used to cause.
    expect(clipRate('Walk', 1.5)).toBeLessThan(1)
  })

  it('leaves the clips that are not gaits alone', () => {
    for (const clip of ['Idle', 'Idle_Neutral', 'Wave', 'Interact'] as const) {
      expect(clipRate(clip, RUN_SPEED), clip).toBe(1)
    }
  })

  it('stays within a sane range for any speed a client might send', () => {
    // A hacked or broken client can report anything. A timeScale of zero
    // freezes the avatar mid-stride and a huge one is a blur.
    for (const speed of [0, -4, 0.01, 400, Number.NaN, Infinity]) {
      const rate = clipRate('Run', speed)
      expect(Number.isFinite(rate), String(speed)).toBe(true)
      expect(rate).toBeGreaterThan(0)
      expect(rate).toBeLessThanOrEqual(1.8)
    }
  })
})

describe('choosing a pack', () => {
  it('is in range for either shape of seed', () => {
    for (const seed of [0, 7, -3, 2.9, 'ilkin', 'a', '', 'Fuad Alizada']) {
      const index = packIndex(seed)
      expect(index, String(seed)).toBeGreaterThanOrEqual(0)
      expect(index, String(seed)).toBeLessThan(AVATAR_MODELS.length)
      expect(Number.isInteger(index), String(seed)).toBe(true)
    }
  })

  it('gives the same player the same pack every time', () => {
    // The whole point: reconnecting must not hand someone a different body.
    expect(packIndex('ilkin')).toBe(packIndex('ilkin'))
    expect(packIndex(12)).toBe(packIndex(12))
  })

  it('survives a seed that is not finite', () => {
    // `Math.abs(NaN) % 3` is NaN, and indexing an array with NaN is undefined,
    // which reaches `useGLTF` as a URL of "undefined".
    for (const seed of [NaN, Infinity, -Infinity]) {
      expect(AVATAR_MODELS[packIndex(seed)]).toBeDefined()
    }
  })
})
