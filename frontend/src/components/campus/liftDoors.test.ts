import { describe, expect, it } from 'vitest'

import {
  FLOORS,
  LIFT_CALL_BUTTON,
  LIFT_DOOR_HEIGHT,
  LIFT_SHAFT,
  floorLevel,
  liftLandingDoors,
  withinCallButton,
  type Floor,
} from './ufazCore'
import { PLAYER_RADIUS } from './campusLayout'
import { collidersAt, insideCollider } from './campusPhysics'

describe('the lift shaft on a floor the car is not at', () => {
  it('is shut on every other floor', () => {
    // The shaft's fourth side is open so you can walk into the car. On every
    // floor the car is elsewhere that opening was a hole in the building: the
    // shaft is cut out of every slab, so walking at it dropped you a storey.
    for (const at of FLOORS) {
      const doors = liftLandingDoors(at)
      expect(doors).toHaveLength(FLOORS.length - 1)
      expect(doors.some((door) => door.id === `lift-door-${at}`)).toBe(false)
    }
  })

  it('stands across the opening, not beside it', () => {
    for (const door of liftLandingDoors(0)) {
      const box = door as { x: number; z: number; halfW: number; halfD: number }
      expect(box.x - box.halfW).toBeLessThanOrEqual(LIFT_SHAFT.x0 + 0.01)
      expect(box.x + box.halfW).toBeGreaterThanOrEqual(LIFT_SHAFT.x1 - 0.01)
      // On the open face, which is the +Z side.
      expect(box.z).toBeGreaterThan(LIFT_SHAFT.z1 - 0.5)
    }
  })

  it('is solid at the height of the floor it belongs to', () => {
    for (const floor of [1, 2, 3] as Floor[]) {
      const doors = liftLandingDoors(0)
      const mine = doors.find((door) => door.id === `lift-door-${floor}`)!
      const feet = floorLevel(floor)
      // Level with that floor it blocks; a storey below it does not, or the
      // hall would have three invisible walls stacked over the lift.
      expect(collidersAt([mine], feet).length, `floor ${floor}`).toBe(1)
      expect(collidersAt([mine], feet - 2).length, `below floor ${floor}`).toBe(0)
    }
  })

  it('lets you walk in on the floor the car is at', () => {
    // The whole point of the open side. Standing in the opening on the car's
    // floor must not hit anything.
    const at: Floor = 2
    const doors = collidersAt(liftLandingDoors(at), floorLevel(at))
    const middle = (LIFT_SHAFT.x0 + LIFT_SHAFT.x1) / 2
    for (const door of doors) {
      expect(insideCollider(middle, LIFT_SHAFT.z1 - 0.05, door, PLAYER_RADIUS)).toBe(false)
    }
  })

  it('is tall enough to be a door and short enough to be one', () => {
    expect(LIFT_DOOR_HEIGHT).toBeGreaterThan(2)
    expect(LIFT_DOOR_HEIGHT).toBeLessThan(3)
  })
})

describe('calling the car from a landing', () => {
  it('is offered beside the opening rather than inside it', () => {
    // Reaching the button must not mean standing where the doors are.
    expect(LIFT_CALL_BUTTON.x).toBeGreaterThan(LIFT_SHAFT.x1)
    expect(withinCallButton(LIFT_CALL_BUTTON.x, LIFT_CALL_BUTTON.z, 0)).toBe(0)
  })

  it('is not offered from across the room', () => {
    expect(withinCallButton(LIFT_CALL_BUTTON.x + 6, LIFT_CALL_BUTTON.z, 0)).toBeNull()
  })

  it('calls the car to the floor the caller is standing on', () => {
    // Not the floor the button is modelled at — there is one button per floor
    // and they are the same button as far as this is concerned.
    for (const floor of FLOORS) {
      expect(
        withinCallButton(LIFT_CALL_BUTTON.x, LIFT_CALL_BUTTON.z, floorLevel(floor)),
        `floor ${floor}`,
      ).toBe(floor)
    }
  })
})
