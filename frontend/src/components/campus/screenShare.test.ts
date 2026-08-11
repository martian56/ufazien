import { describe, it, expect } from 'vitest'

import { playerPositionFromUpdate } from '../../hooks/useCampusSimulator'
import { fitProjector } from './projectorFit'
import { INTERIOR_SPECS, interiorHalfExtent } from './interiorSpecs'
import { lectureSeatingExtent } from './lectureSeating'
import { CAMPUS_BUILDINGS } from './campusLayout'

/**
 * The screen-share path, at the two points where it silently broke.
 *
 * A share is drawn on the projector of the room the presenter is standing in,
 * and nowhere else. That decision reads `current_room` off the presenter's last
 * position frame, so anything that loses the field takes the picture down for
 * every viewer without an error anywhere.
 */

describe('playerPositionFromUpdate', () => {
  const frame = (position: Record<string, unknown>) =>
    playerPositionFromUpdate({
      position: position as never,
      username: 'aysel',
      full_name: 'Aysel M',
    })

  it('keeps the room the player is standing in', () => {
    // The bug: the consumer sent this on every frame and the handler dropped
    // it, so a presenter's room survived exactly until they took a step.
    expect(frame({ x: 1, y: 2, current_room: '3' }).current_room).toBe('3')
  })

  it('reports no room for someone out on the campus', () => {
    expect(frame({ x: 1, y: 2, current_room: null }).current_room).toBeNull()
  })

  it('treats a missing room as no room rather than undefined', () => {
    // `undefined` and `null` compare the same against a building id, but only
    // one of them survives a JSON round trip.
    expect(frame({ x: 1, y: 2 }).current_room).toBeNull()
  })

  it('carries the fields the avatars animate from', () => {
    const merged = frame({ x: 4, y: 5, direction: 'left', is_moving: true })
    expect(merged).toMatchObject({ x: 4, y: 5, direction: 'left', is_moving: true })
  })

  it('defaults direction and movement rather than leaving them undefined', () => {
    expect(frame({ x: 0, y: 0 })).toMatchObject({ direction: 'down', is_moving: false })
  })

  it('falls back to the username when there is no full name', () => {
    const merged = playerPositionFromUpdate({ position: { x: 0, y: 0 } as never, username: 'aysel' })
    expect(merged.full_name).toBe('aysel')
  })
})

describe('room matching', () => {
  // What the page compares. A share shows only where these agree.
  const roomOf = (buildingId: number) => String(buildingId)

  it('matches a presenter in the same building', () => {
    const building = CAMPUS_BUILDINGS[1]
    const presenter = playerPositionFromUpdate({
      position: { x: 0, y: 0, current_room: roomOf(building.id) } as never,
    })
    expect(presenter.current_room === String(building.id)).toBe(true)
  })

  it('does not match a presenter in a different building', () => {
    const presenter = playerPositionFromUpdate({
      position: { x: 0, y: 0, current_room: roomOf(CAMPUS_BUILDINGS[1].id) } as never,
    })
    expect(presenter.current_room === String(CAMPUS_BUILDINGS[2].id)).toBe(false)
  })

  it('does not match a presenter who is outdoors', () => {
    const presenter = playerPositionFromUpdate({ position: { x: 0, y: 0 } as never })
    for (const building of CAMPUS_BUILDINGS) {
      expect(presenter.current_room === String(building.id)).toBe(false)
    }
  })
})

describe('fitProjector', () => {
  it('keeps the screen and its mount inside a low room', () => {
    // The cafeteria: an 8-metre ceiling. A fixed 8.4-metre screen hung at a
    // fixed 8.7 put both the picture and the projector through it.
    const spec = INTERIOR_SPECS.cafeteria
    const fit = fitProjector(16 / 9, spec.projector[1], spec.ceiling)
    expect(spec.projector[1] + fit.height / 2).toBeLessThan(spec.ceiling)
    expect(fit.mount).toBeLessThan(spec.ceiling)
  })

  it('fits in every interior on the campus', () => {
    for (const building of CAMPUS_BUILDINGS) {
      const spec = INTERIOR_SPECS[building.interior]
      for (const aspect of [16 / 9, 4 / 3, 21 / 9, 1]) {
        const fit = fitProjector(aspect, spec.projector[1], spec.ceiling)
        const top = spec.projector[1] + fit.height / 2
        const bottom = spec.projector[1] - fit.height / 2

        expect(top, `${building.name} screen top`).toBeLessThanOrEqual(spec.ceiling)
        expect(bottom, `${building.name} screen bottom`).toBeGreaterThan(0)
        expect(fit.mount, `${building.name} projector mount`).toBeLessThan(spec.ceiling)
        // And it has to stay on the wall it is hung on.
        expect(fit.width, `${building.name} screen width`).toBeLessThanOrEqual(spec.halfExtent * 2)
      }
    }
  })

  it('uses the full budget when the room is tall enough', () => {
    const tall = fitProjector(16 / 9, 7, 16)
    expect(tall.height).toBeCloseTo(8.4)
    expect(tall.mount).toBeCloseTo(8.7)
  })

  it('preserves the video aspect ratio', () => {
    for (const aspect of [16 / 9, 4 / 3, 2.39]) {
      const fit = fitProjector(aspect, 6, 14)
      expect(fit.width / fit.height).toBeCloseTo(aspect)
    }
  })

  it('survives a video that has not reported its size yet', () => {
    // videoWidth/videoHeight are 0 until metadata arrives, and 0/0 is NaN.
    for (const bad of [0, Number.NaN, -3, Infinity]) {
      const fit = fitProjector(bad, 6, 14)
      expect(Number.isFinite(fit.width)).toBe(true)
      expect(fit.width).toBeGreaterThan(0)
      expect(fit.height).toBeGreaterThan(0)
    }
  })

  it('never returns a screen of zero or negative size in a very low room', () => {
    const fit = fitProjector(16 / 9, 1, 2)
    expect(fit.width).toBeGreaterThan(0)
    expect(fit.height).toBeGreaterThan(0)
  })
})

describe('interior spawns', () => {
  it('does not put the player inside the lecture hall seating', () => {
    // Back faces are culled, so standing inside a tier looks fine in a
    // screenshot and is only obvious once you try to walk out of it.
    const seating = lectureSeatingExtent()
    const [x, , z] = INTERIOR_SPECS.lecture.spawn
    const clearOfDepth = z < seating.minZ || z > seating.maxZ
    const clearOfWidth = Math.abs(x) > seating.halfWidth
    expect(clearOfDepth || clearOfWidth).toBe(true)
  })

  it('keeps every spawn inside its room and out of the walls', () => {
    for (const building of CAMPUS_BUILDINGS) {
      const spec = INTERIOR_SPECS[building.interior]
      const limit = interiorHalfExtent(building.interior)
      expect(Math.abs(spec.spawn[0]), `${building.name} spawn x`).toBeLessThanOrEqual(limit)
      expect(Math.abs(spec.spawn[2]), `${building.name} spawn z`).toBeLessThanOrEqual(limit)
    }
  })

  it('turns the player towards the screen one way or another', () => {
    // Entry sets the camera rotation to zero, which in three.js looks down -Z,
    // so a room without an explicit target must put its spawn in front of the
    // screen rather than behind it.
    for (const building of CAMPUS_BUILDINGS) {
      const spec = INTERIOR_SPECS[building.interior]
      if (spec.spawnLookAt) {
        // An explicit target has to be deeper into the room than the player.
        expect(spec.spawnLookAt[2], `${building.name} look target`).toBeLessThan(spec.spawn[2])
      } else {
        expect(spec.spawn[2], `${building.name}`).toBeGreaterThan(spec.projector[2])
      }
    }
  })
})

describe('the two position paths agree', () => {
  it('maps a lobby snapshot and a live frame to the same shape', () => {
    // The snapshot sends a flat record, the live frame a nested one. They used
    // to be mapped by two hand-written copies of the same code, and they drifted
    // — which is the bug this whole file exists for.
    const flat = {
      x: 12,
      y: -4,
      direction: 'left',
      is_moving: true,
      current_room: '5',
      username: 'nigar',
      full_name: 'Nigar A',
      last_updated: '2026-01-01T00:00:00.000Z',
    }

    const snapshot = playerPositionFromUpdate({
      position: flat as never,
      username: flat.username,
      full_name: flat.full_name,
      last_updated: flat.last_updated,
    })
    const live = playerPositionFromUpdate({
      position: flat as never,
      username: flat.username,
      full_name: flat.full_name,
    })

    // Everything but the timestamp, which the snapshot takes from the server.
    const { last_updated: snapshotStamp, ...snapshotRest } = snapshot
    const { last_updated: liveStamp, ...liveRest } = live
    expect(snapshotRest).toEqual(liveRest)
    expect(snapshotStamp).toBe(flat.last_updated)
    expect(liveStamp).not.toBe(flat.last_updated)
  })
})
