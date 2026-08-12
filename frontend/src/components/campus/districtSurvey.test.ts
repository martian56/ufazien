import { describe, it, expect } from 'vitest'

import { DISTRICT_BUILDINGS, DISTRICT_STREETS } from './districtSurvey'
import { DISTRICT_COLLIDERS } from './campusLayout'

/**
 * The generated district, checked as data.
 *
 * `scripts/build-district.mjs` writes this file and the output is committed, so
 * nobody runs the generator in CI and nothing would notice if a re-run produced
 * something wrong. These are the properties the generator is supposed to
 * guarantee, asserted against what it actually emitted.
 */

/** Distance from a point to a segment. */
function segmentDistance(
  [ax, az]: readonly [number, number],
  [bx, bz]: readonly [number, number],
  px: number,
  pz: number,
): number {
  const dx = bx - ax
  const dz = bz - az
  const len2 = dx * dx + dz * dz
  const t = len2 ? Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / len2)) : 0
  return Math.hypot(px - (ax + dx * t), pz - (az + dz * t))
}

describe('the district', () => {
  it('has streets and something standing along them', () => {
    // A generator that quietly emitted nothing would pass every check below.
    expect(DISTRICT_STREETS.length).toBeGreaterThan(4)
    expect(DISTRICT_BUILDINGS.length).toBeGreaterThan(4)
  })

  it('never stands a building in a carriageway', () => {
    // The infill terrace is marched down one street at a time, and for a while
    // it only knew about the street it was marching down — so a block placed
    // along one road could land squarely in the road crossing it. Every
    // footprint becomes a collider, so those were walls across a street.
    //
    // Point-to-segment, not a segment bounding box: the streets here run a few
    // degrees off the axes and a box round a diagonal is far wider than the road.
    const intrusions: string[] = []

    DISTRICT_BUILDINGS.forEach((building, i) => {
      const xs = building.footprint.map((p) => p[0])
      const zs = building.footprint.map((p) => p[1])
      const probes: (readonly [number, number])[] = [
        [(Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...zs) + Math.max(...zs)) / 2],
        ...building.footprint,
      ]

      for (const street of DISTRICT_STREETS) {
        for (let k = 0; k < street.points.length - 1; k++) {
          for (const [px, pz] of probes) {
            const depth =
              street.width / 2 - segmentDistance(street.points[k], street.points[k + 1], px, pz)
            if (depth > 0) {
              intrusions.push(
                `building ${i} (${building.source}) is ${depth.toFixed(2)}m into ${
                  street.name ?? 'a street'
                }`,
              )
            }
          }
        }
      }
    })

    expect([...new Set(intrusions)]).toEqual([])
  })

  it('keeps every block on the north side of Nizami Street', () => {
    // South of the kerb is where the campus is. A block that strayed across
    // would be a solid box standing in the quad.
    for (const building of DISTRICT_BUILDINGS) {
      const nearest = Math.max(...building.footprint.map((p) => p[1]))
      expect(nearest, JSON.stringify(building.name ?? building.source)).toBeLessThanOrEqual(-66)
    }
  })

  it('gives every block a footprint that encloses something', () => {
    for (const building of DISTRICT_BUILDINGS) {
      expect(building.footprint.length).toBeGreaterThanOrEqual(3)
      expect(building.height).toBeGreaterThan(1)
    }
  })

  it('turns every block into exactly the colliders the layout uses', () => {
    // `mergeWedges` joins boxes that would trap a player between them, so the
    // collider count is at most the building count — never more.
    expect(DISTRICT_COLLIDERS.length).toBeGreaterThan(0)
    expect(DISTRICT_COLLIDERS.length).toBeLessThanOrEqual(DISTRICT_BUILDINGS.length)
  })
})
