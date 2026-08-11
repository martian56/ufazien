import { describe, it, expect } from 'vitest'

import {
  ALCOVE_DEPTH,
  DOOR_HALF_WIDTH,
  buildingCollidersWithDoor,
  doorCrossed,
  doorstep,
  doorwayFor,
  interiorDoorFor,
  leavingThroughDoor,
} from './doorways'
import { CAMPUS_BUILDINGS, PLAYER_RADIUS, type InteriorKind } from './campusLayout'
import { interiorHalfExtent } from './interiorSpecs'
import { insideCollider, resolveColliders, type Collider } from './campusPhysics'

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
  it('sits on the boundary the player is clamped to', () => {
    // A door in front of the clamp is one you walk into; behind it, one you
    // can never reach.
    for (const kind of KINDS as InteriorKind[]) {
      expect(interiorDoorFor(kind).z).toBeCloseTo(interiorHalfExtent(kind))
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
