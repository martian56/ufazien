import { describe, expect, it } from 'vitest'

import {
  DOOR_OPEN_MS,
  DOOR_REACH,
  closedDoorColliders,
  doorSwing,
  doorWithinReach,
  exteriorDoorId,
  interiorDoorId,
  isDoorOpen,
  openDoor,
  pruneDoors,
} from './doorState'
import type { Doorway } from './campusLayout'

const DOORS: Doorway[] = [
  { id: 1, x: 0, z: 10, halfW: 1.7 },
  { id: 2, x: 40, z: 10, halfW: 1.7 },
]

describe('doorWithinReach', () => {
  it('finds the door you are standing at', () => {
    expect(doorWithinReach(0, 11, DOORS)?.id).toBe(1)
  })

  it('does not reach across the quad', () => {
    // The complaint about the old proximity key was that it worked from
    // anywhere near a fifty metre facade.
    expect(doorWithinReach(0, 25, DOORS)).toBeNull()
    expect(doorWithinReach(20, 10, DOORS)).toBeNull()
  })

  it('picks the nearer door when two are in range', () => {
    const close: Doorway[] = [
      { id: 1, x: 0, z: 10, halfW: 1.7 },
      { id: 2, x: 2, z: 10, halfW: 1.7 },
    ]
    expect(doorWithinReach(1.9, 10, close)?.id).toBe(2)
    expect(doorWithinReach(0.1, 10, close)?.id).toBe(1)
  })

  it('reaches exactly as far as it claims', () => {
    expect(doorWithinReach(0, 10 + DOOR_REACH, DOORS)?.id).toBe(1)
    expect(doorWithinReach(0, 10 + DOOR_REACH + 0.01, DOORS)).toBeNull()
  })
})

describe('opening and closing', () => {
  it('a door is shut until it is opened', () => {
    expect(isDoorOpen({}, 'exterior:1', 1000)).toBe(false)
  })

  it('opens, then closes itself', () => {
    const state = openDoor({}, 'exterior:1', 1000)
    expect(isDoorOpen(state, 'exterior:1', 1000)).toBe(true)
    expect(isDoorOpen(state, 'exterior:1', 1000 + DOOR_OPEN_MS - 1)).toBe(true)
    expect(isDoorOpen(state, 'exterior:1', 1000 + DOOR_OPEN_MS)).toBe(false)
  })

  it('opening a door that is already open restarts its timer', () => {
    let state = openDoor({}, 'exterior:1', 1000)
    state = openDoor(state, 'exterior:1', 3000)
    expect(isDoorOpen(state, 'exterior:1', 3000 + DOOR_OPEN_MS - 1)).toBe(true)
  })

  it('opening one door leaves the others shut', () => {
    const state = openDoor({}, 'exterior:1', 1000)
    expect(isDoorOpen(state, 'exterior:2', 1000)).toBe(false)
  })

  it('inside and outside doors of one building are separate', () => {
    const state = openDoor({}, interiorDoorId(1), 1000)
    expect(isDoorOpen(state, exteriorDoorId(1), 1000)).toBe(false)
  })
})

describe('pruneDoors', () => {
  it('drops doors whose time is up', () => {
    const state = openDoor(openDoor({}, 'a', 0), 'b', 5000)
    const pruned = pruneDoors(state, 5000)
    expect(pruned).toEqual({ b: 5000 })
  })

  it('returns the same object when nothing expired, so React can skip a render', () => {
    const state = openDoor({}, 'a', 1000)
    expect(pruneDoors(state, 1500)).toBe(state)
  })
})

describe('doorSwing', () => {
  it('is shut before it is opened and after it closes', () => {
    expect(doorSwing({}, 'a', 0)).toBe(0)
    const state = openDoor({}, 'a', 0)
    expect(doorSwing(state, 'a', DOOR_OPEN_MS)).toBe(0)
  })

  it('swings open, holds, then swings back', () => {
    const state = openDoor({}, 'a', 0)
    const opening = doorSwing(state, 'a', 100)
    const held = doorSwing(state, 'a', DOOR_OPEN_MS / 2)
    const closing = doorSwing(state, 'a', DOOR_OPEN_MS - 200)

    expect(opening).toBeGreaterThan(0)
    expect(opening).toBeLessThan(1)
    expect(held).toBe(1)
    expect(closing).toBeLessThan(1)
    expect(closing).toBeGreaterThan(0)
  })

  it('never leaves the 0 to 1 range', () => {
    const state = openDoor({}, 'a', 0)
    for (let t = -500; t < DOOR_OPEN_MS + 500; t += 37) {
      const swing = doorSwing(state, 'a', t)
      expect(swing).toBeGreaterThanOrEqual(0)
      expect(swing).toBeLessThanOrEqual(1)
    }
  })
})

describe('closedDoorColliders', () => {
  it('a shut door is solid', () => {
    const colliders = closedDoorColliders({}, 0, DOORS)
    expect(colliders).toHaveLength(2)
    expect(colliders[0]).toMatchObject({ x: 0, z: 10, halfW: 1.7 })
  })

  it('an open door is not', () => {
    // Without this the key would be decoration: you could walk through a
    // door you never opened.
    const state = openDoor({}, exteriorDoorId(1), 0)
    const colliders = closedDoorColliders(state, 0, DOORS)
    expect(colliders).toHaveLength(1)
    expect(colliders[0].x).toBe(40)
  })

  it('becomes solid again once the door has closed', () => {
    const state = openDoor({}, exteriorDoorId(1), 0)
    expect(closedDoorColliders(state, DOOR_OPEN_MS, DOORS)).toHaveLength(2)
  })
})
