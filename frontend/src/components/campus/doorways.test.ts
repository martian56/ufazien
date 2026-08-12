import { describe, it, expect } from 'vitest'

import {
  ALCOVE_DEPTH,
  DOOR_HALF_WIDTH,
  buildingCollidersWithDoor,
  doorCrossed,
  doorstep,
  doorwayFor,
  interiorDoorFor,
  interiorLimit,
  leavingThroughDoor,
} from './doorways'
import { CAMPUS_BUILDINGS, PLAYER_RADIUS, type InteriorKind } from './campusLayout'
import { INTERIOR_SPECS, interiorHalfExtent } from './interiorSpecs'
import { insideCollider, resolveColliders, type Collider } from './campusPhysics'
import { interiorColliders } from './interiorPhysics'

const KINDS = CAMPUS_BUILDINGS.map((b) => b.interior)

describe('every building has a door', () => {
  it('puts one on the face of each building', () => {
    for (const building of CAMPUS_BUILDINGS) {
      const door = doorwayFor(building)
      expect(door.z, building.name).toBeCloseTo(building.position[2] + building.size[2] / 2)
      expect(door.x, building.name).toBeCloseTo(building.position[0])
    }
  })

  it('leaves an opening wider than a person', () => {
    // A door you cannot fit through is a wall with a picture of a door on it.
    expect(DOOR_HALF_WIDTH).toBeGreaterThan(PLAYER_RADIUS * 1.5)
  })

  it('numbers the door after the building it belongs to', () => {
    for (const building of CAMPUS_BUILDINGS) {
      expect(doorwayFor(building).id).toBe(building.id)
    }
  })
})

describe('the facade has a hole in it', () => {
  const building = CAMPUS_BUILDINGS[0]
  const boxes = buildingCollidersWithDoor(building).map((r) => r as Collider)
  const door = doorwayFor(building)

  it('lets a player reach the face of the building', () => {
    // The whole point. With one solid box the collider stops you a player's
    // radius short of the wall and the transition can never fire.
    const settled = resolveColliders(door.x, door.z + 0.05, boxes, PLAYER_RADIUS)
    expect(settled.z).toBeCloseTo(door.z + 0.05)
    expect(settled.x).toBeCloseTo(door.x)
  })

  it('still stops a player walking at the wall beside the door', () => {
    const beside = door.x + door.halfW + PLAYER_RADIUS + 1
    const settled = resolveColliders(beside, door.z - 1, boxes, PLAYER_RADIUS)
    // Pushed back out of the facade rather than left standing inside it.
    for (const box of boxes) {
      expect(insideCollider(settled.x, settled.z, box, PLAYER_RADIUS - 1e-6)).toBe(false)
    }
  })

  it('closes the back of the alcove, so a door is not a tunnel', () => {
    // Identified by how far back it sits, not by its width: it runs the full
    // width of the building so that it overlaps the piers rather than abutting
    // them, which is what stops the alcove corner being a seam.
    const back = boxes.find((box) => Math.abs(box.z - (building.position[2] - ALCOVE_DEPTH / 2)) < 1e-6)
    expect(back).toBeDefined()
    // Deep inside the footprint is solid.
    expect(insideCollider(door.x, building.position[2], back!)).toBe(true)
    // And the alcove itself is not.
    expect(insideCollider(door.x, door.z - ALCOVE_DEPTH / 4, back!)).toBe(false)
  })

  it('covers the same footprint the solid box did, minus the alcove', () => {
    // A corner of the building must still be solid, or the door has quietly
    // opened the whole facade.
    const corner = {
      x: building.position[0] + building.size[0] / 2 - 0.5,
      z: building.position[2] + building.size[2] / 2 - 0.5,
    }
    expect(boxes.some((box) => insideCollider(corner.x, corner.z, box))).toBe(true)
  })
})

describe('walking through', () => {
  const door = { id: 1, x: 0, z: 10, halfW: DOOR_HALF_WIDTH }

  it('goes inside when the step crosses the opening', () => {
    expect(doorCrossed({ x: 0, z: 10.4 }, { x: 0, z: 9.6 }, [door])).toBe(door)
  })

  it('does not go inside walking along the wall', () => {
    expect(doorCrossed({ x: 8, z: 10.4 }, { x: 8, z: 9.6 }, [door])).toBeNull()
  })

  it('does not go inside walking out again', () => {
    expect(doorCrossed({ x: 0, z: 9.6 }, { x: 0, z: 10.4 }, [door])).toBeNull()
  })

  it('measures where the path crosses, not where the step ended', () => {
    // Ends dead centre in the opening, having gone through the wall six
    // metres to the left of it. Testing the end point calls this a doorway.
    expect(doorCrossed({ x: -6, z: 10.2 }, { x: 0, z: 9.8 }, [door])).toBeNull()
    // And the reverse: steps into the opening and carries on sideways, ending
    // six metres along inside the footprint. Testing the end point calls this
    // a wall and leaves the player standing in the masonry.
    expect(doorCrossed({ x: 0, z: 10.05 }, { x: 6, z: 8 }, [door])).toBe(door)
  })

  it('ignores a step that never reaches the wall', () => {
    expect(doorCrossed({ x: 0, z: 14 }, { x: 0, z: 12 }, [door])).toBeNull()
  })

  it('picks the door it actually went through', () => {
    const other = { id: 2, x: 40, z: 10, halfW: DOOR_HALF_WIDTH }
    expect(doorCrossed({ x: 40, z: 10.2 }, { x: 40, z: 9.8 }, [door, other])).toBe(other)
  })

  it('puts you back outside the door you came out of', () => {
    const out = doorstep(door)
    expect(out.x).toBeCloseTo(door.x)
    expect(out.z).toBeGreaterThan(door.z)
  })
})

describe('the door on the inside', () => {
  it('sits in the wall, not at the clamp in front of it', () => {
    // The clamp stands a metre and a half short of the wall so nobody presses
    // their eye against it. A door there hangs in mid-air with a blank wall
    // behind it — which is exactly what it did, and in the library it stood in
    // the issue desk.
    for (const kind of KINDS as InteriorKind[]) {
      expect(interiorDoorFor(kind).z).toBeCloseTo(INTERIOR_SPECS[kind].halfExtent)
      expect(interiorDoorFor(kind).z).toBeGreaterThan(interiorHalfExtent(kind))
    }
  })

  it('opens the clamp out to the wall inside the doorway', () => {
    // Otherwise the door is in the wall and the player still stops short of
    // it: you would walk up to an invisible line and watch the way out from
    // there.
    for (const kind of KINDS as InteriorKind[]) {
      const door = interiorDoorFor(kind)
      expect(interiorLimit(kind, 0, door.z - 1)).toBeCloseTo(door.z)
      // And nowhere else: the wall is still a wall a pace to the side.
      expect(interiorLimit(kind, door.halfW + 1, door.z - 1)).toBeCloseTo(
        interiorHalfExtent(kind),
      )
    }
  })

  it('keeps the far side of the room clamped', () => {
    // The doorway is on +Z only. An opening at the back as well would let a
    // player walk out through the projector wall.
    for (const kind of KINDS as InteriorKind[]) {
      expect(interiorLimit(kind, 0, -5)).toBeCloseTo(interiorHalfExtent(kind))
    }
  })

  it('is on the opposite wall to the projector in every room', () => {
    // Which is where the spawn already faced, so walking in and turning round
    // has always led back this way.
    for (const kind of KINDS as InteriorKind[]) {
      expect(interiorDoorFor(kind).z).toBeGreaterThan(0)
    }
  })

  it('lets you out through the opening', () => {
    const door = interiorDoorFor('library')
    expect(leavingThroughDoor(0, door.z + 0.2, door)).toBe(true)
  })

  it('does not let you out through the wall beside it', () => {
    const door = interiorDoorFor('library')
    expect(leavingThroughDoor(10, door.z + 0.2, door)).toBe(false)
  })

  it('does not let you out from inside the room', () => {
    const door = interiorDoorFor('library')
    expect(leavingThroughDoor(0, door.z - 2, door)).toBe(false)
  })
})

describe('the way out is clear', () => {
  /**
   * Nothing solid may stand in the doorway or the approach to it.
   *
   * The library's issue desk was directly across its door — the way out ran
   * through the counter, so leaving the room meant walking round a desk you
   * could not see past to a door you could not see. A room you cannot leave by
   * the door you came in by is worse than one with no door drawn at all.
   */
  it('leaves the doorway and its approach walkable in every room', () => {
    for (const kind of KINDS as InteriorKind[]) {
      const door = interiorDoorFor(kind)
      const colliders = interiorColliders(kind)

      // From the door back into the room, along its centre line.
      for (let back = 0; back <= APPROACH; back += 0.5) {
        const z = door.z - back
        const blocker = colliders.find((c) => insideCollider(door.x, z, c, PLAYER_RADIUS))
        expect(
          blocker,
          `${kind}: the way out is blocked ${back}m inside the door by ${JSON.stringify(blocker)}`,
        ).toBeUndefined()
      }
    }
  })

  it('lets a player walk from the middle of the room to the door', () => {
    // Resolving each step must not push them off the centre line and into the
    // jamb: a corridor a person cannot walk down is not a corridor.
    for (const kind of KINDS as InteriorKind[]) {
      const door = interiorDoorFor(kind)
      for (let back = 0.5; back <= APPROACH; back += 0.5) {
        const settled = resolveColliders(door.x, door.z - back, interiorColliders(kind), PLAYER_RADIUS)
        expect(
          Math.abs(settled.x - door.x),
          `${kind}: pushed ${Math.abs(settled.x - door.x).toFixed(2)}m sideways ${back}m from the door`,
        ).toBeLessThan(door.halfW)
      }
    }
  })
})

/**
 * How far back from a door the approach has to stay clear.
 *
 * Enough to stand in front of it and step through, not a corridor all the way
 * across the room. The amphitheatre's rows run the full width by design and
 * its back desk is four metres in — you reach the door along the back of the
 * hall rather than straight down the middle, which is how a raked hall works.
 */
const APPROACH = 2.5
