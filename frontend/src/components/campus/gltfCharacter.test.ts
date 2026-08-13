import { describe, it, expect } from 'vitest'

import { AVATAR_MODELS, clipFor, packIndex } from './GltfCharacter'
import { ACTIVITIES, RUN_SPEED, WALK_SPEED } from './avatarPose'

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
