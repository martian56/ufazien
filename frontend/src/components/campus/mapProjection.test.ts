import { describe, expect, it } from 'vitest'
import { OUTDOOR_BUILDINGS, type CampusBuilding } from './campusLayout'
import {
  CAMPUS_SPAN,
  buildingsInView,
  clampToEdge,
  FIT_MARGIN,
  fitCampus,
  headingVector,
  nearestBuilding,
  placeLabels,
  project,
  scaleOf,
  windowAround,
} from './mapProjection'

describe('projecting the campus onto a square', () => {
  it('puts the centre of the view in the middle', () => {
    const view = windowAround(40, -12, 200)
    expect(project(40, -12, view)).toEqual({ x: 100, y: 100 })
  })

  it('keeps north up and east right', () => {
    const view = windowAround(0, 0, 200)
    const north = project(0, -50, view)
    const east = project(50, 0, view)
    expect(north.y).toBeLessThan(100)
    expect(north.x).toBe(100)
    expect(east.x).toBeGreaterThan(100)
    expect(east.y).toBe(100)
  })

  it('scales by the span rather than the pixel size alone', () => {
    expect(scaleOf({ cx: 0, cz: 0, span: 100, size: 200 })).toBe(2)
    expect(scaleOf({ cx: 0, cz: 0, span: 400, size: 200 })).toBe(0.5)
  })

  it('follows the player, so the marker stays centred', () => {
    const first = windowAround(10, 10, 120)
    const second = windowAround(90, 10, 120)
    expect(project(10, 10, first)).toEqual(project(90, 10, second))
  })
})

describe('the whole-campus view', () => {
  it('fits every building inside the square', () => {
    const size = 400
    const view = fitCampus(size)
    for (const building of OUTDOOR_BUILDINGS) {
      const [x, , z] = building.position
      const at = project(x, z, view)
      expect(at.x, building.name).toBeGreaterThanOrEqual(0)
      expect(at.x, building.name).toBeLessThanOrEqual(size)
      expect(at.y, building.name).toBeGreaterThanOrEqual(0)
      expect(at.y, building.name).toBeLessThanOrEqual(size)
    }
  })

  it('spans more than the campus is wide', () => {
    const widest = Math.max(
      ...OUTDOOR_BUILDINGS.map((b) => Math.abs(b.position[0]) + b.size[0] / 2),
      ...OUTDOOR_BUILDINGS.map((b) => Math.abs(b.position[2]) + b.size[2] / 2),
    )
    expect(CAMPUS_SPAN / 2).toBeGreaterThan(widest)
  })

  it('does not waste the square on empty grass', () => {
    const view = fitCampus(400)
    const spread = Math.max(
      ...OUTDOOR_BUILDINGS.map((b) => Math.abs(b.position[0] - view.cx) + b.size[0] / 2),
      ...OUTDOOR_BUILDINGS.map((b) => Math.abs(b.position[2] - view.cz) + b.size[2] / 2),
    )
    expect(view.span).toBeLessThan(spread * 2 + FIT_MARGIN * 2 + 1)
    expect(view.span).toBeLessThan(CAMPUS_SPAN)
  })

  it('survives having nothing to fit', () => {
    expect(fitCampus(300, []).span).toBe(CAMPUS_SPAN)
  })
})

describe('building labels', () => {
  const width = (text: string) => text.length * 6

  it('names every building when there is room', () => {
    const labels = placeLabels(fitCampus(900), width)
    expect(labels).toHaveLength(OUTDOOR_BUILDINGS.length)
  })

  it('never lets two labels touch', () => {
    const labels = placeLabels(fitCampus(340), width)
    for (let i = 0; i < labels.length; i++) {
      for (let j = i + 1; j < labels.length; j++) {
        const a = labels[i]
        const b = labels[j]
        const apart =
          Math.abs(a.x - b.x) >= (width(a.text) + width(b.text)) / 2 || Math.abs(a.y - b.y) >= 12
        expect(apart, `${a.text} collides with ${b.text}`).toBe(true)
      }
    }
  })

  it('drops a label rather than running it off the edge', () => {
    // A synthetic row, because only one building stands on the campus now and
    // the thing under test is what happens when labels compete for room.
    // The view has to be fitted to `CROWD` as well. `fitCampus` defaults to the
    // outdoor list, which is one building, so the view was centred tightly on
    // it and every one of these fell off the canvas — the assertion below then
    // passed because nothing was placed at all, not because anything was
    // sensibly refused.
    const labels = placeLabels(fitCampus(120, CROWD), width, CROWD)
    for (const label of labels) {
      expect(label.x - width(label.text) / 2).toBeGreaterThanOrEqual(0)
      expect(label.x + width(label.text) / 2).toBeLessThanOrEqual(120)
    }
    expect(labels.length).toBeLessThan(CROWD.length)
  })

  it('gives the biggest buildings first refusal on a spot', () => {
    // Against `CROWD` for the same reason as the tests above: with one
    // building on the campus every label fits and nothing has to be refused,
    // so the priority this asserts would never actually be exercised.
    const biggest = [...CROWD].sort((a, b) => b.size[0] * b.size[2] - a.size[0] * a.size[2])[0]
    const labels = placeLabels(fitCampus(240, CROWD), width, CROWD)
    expect(labels.map((l) => l.text)).toContain(biggest.name)
  })
})

describe('which buildings are worth drawing', () => {
  it('includes everything at full campus zoom', () => {
    expect(buildingsInView(fitCampus(300))).toHaveLength(OUTDOOR_BUILDINGS.length)
  })

  it('drops the ones off the edge when zoomed in', () => {
    const first = CROWD[0]
    const view = windowAround(first.position[0], first.position[2], 200, 40)
    const visible = buildingsInView(view, CROWD)
    expect(visible).toContain(first)
    expect(visible.length).toBeLessThan(CROWD.length)
  })

  it('keeps a building whose centre is outside but whose wall is not', () => {
    const wide = OUTDOOR_BUILDINGS.reduce((a, b) => (a.size[0] > b.size[0] ? a : b))
    const justPast = wide.position[0] + wide.size[0] / 2 + 4
    const view = windowAround(justPast, wide.position[2], 200, 10)
    expect(buildingsInView(view)).toContain(wide)
  })
})

describe('where you are facing', () => {
  /**
   * These used to assert the negation of all three, which is where the arrow
   * pointing backwards came from: the convention is the avatar's — zero faces
   * +Z — and `project` puts +Z down the screen, so heading zero is *down* the
   * map, not up it. The old names said "looking down negative z", which is
   * heading PI rather than heading 0.
   */
  it('points down the map at heading zero, which faces +Z', () => {
    const forward = headingVector(0)
    expect(forward.x).toBeCloseTo(0)
    expect(forward.y).toBeCloseTo(1)
  })

  it('points up the map when looking down negative z', () => {
    const forward = headingVector(Math.PI)
    expect(forward.x).toBeCloseTo(0)
    expect(forward.y).toBeCloseTo(-1)
  })

  it('agrees with the world axes the projection uses', () => {
    // The arrow has to point the same way as the step the player just took:
    // walk along your own heading and the marker must move the way the nose is
    // pointing. Compared as a dot product rather than per axis, because the
    // component that should be zero comes out as 6e-17 and its sign is noise.
    const view = windowAround(0, 0, 200)
    const origin = project(0, 0, view)
    for (const [heading, name] of [
      [0, '+Z'],
      [Math.PI / 2, '+X'],
      [Math.PI, '-Z'],
      [-Math.PI / 2, '-X'],
      [0.9, 'a bearing off the axes'],
    ] as const) {
      const forward = headingVector(heading)
      const stepped = project(Math.sin(heading) * 30, Math.cos(heading) * 30, view)
      const dx = stepped.x - origin.x
      const dy = stepped.y - origin.y
      // Positive: the same direction. Negated — which is what this was — the
      // arrow points at where the player has just walked away from.
      expect(forward.x * dx + forward.y * dy, `${name}`).toBeGreaterThan(0)
    }
  })

  it('stays a unit vector at any angle', () => {
    for (const heading of [0.3, 1.9, -2.4, 5.5]) {
      const forward = headingVector(heading)
      expect(Math.hypot(forward.x, forward.y)).toBeCloseTo(1)
    }
  })
})

describe('players off the edge of the map', () => {
  it('leaves a pip alone when it is already inside', () => {
    expect(clampToEdge(3, 4, 10)).toEqual({ x: 3, y: 4, clamped: false })
  })

  it('pulls a distant one onto the rim, keeping its bearing', () => {
    const edge = clampToEdge(30, 40, 10)
    expect(edge.clamped).toBe(true)
    expect(Math.hypot(edge.x, edge.y)).toBeCloseTo(10)
    expect(edge.y / edge.x).toBeCloseTo(40 / 30)
  })

  it('does not divide by zero at the centre', () => {
    expect(clampToEdge(0, 0, 10)).toEqual({ x: 0, y: 0, clamped: false })
  })
})

describe('the nearest building', () => {
  it('finds the one you are standing on', () => {
    const target = CROWD[2]
    expect(nearestBuilding(target.position[0], target.position[2], CROWD)).toBe(target)
  })

  it('returns nothing when there are no buildings', () => {
    expect(nearestBuilding(0, 0, [])).toBeNull()
  })
})

/**
 * A row of buildings to test the label and culling logic against.
 *
 * The campus has one building standing on it since the rest became rooms
 * inside it, and a list of one cannot demonstrate labels colliding, labels
 * being dropped, or anything being culled. These are what the campus used to
 * be, near enough, and they exercise the logic rather than the data.
 */
const CROWD: CampusBuilding[] = [
  ['Library', -64, -8, 32, 24],
  ['Laboratory Building', 62, -10, 32, 24],
  ['Amphitheatre', 0, 66, 36, 28],
  ['Student Centre', -70, 64, 32, 26],
  ['Cafeteria', 68, 62, 30, 22],
  ['Sports Hall', -10, 128, 44, 32],
].map(([name, x, z, w, d], i) => ({
  id: 100 + i,
  name: name as string,
  position: [x as number, 0, z as number],
  size: [w as number, 14, d as number],
  color: '#cccccc',
  trim: '#888888',
  icon: '🏢',
  style: 'modern',
  interior: 'lecture',
  blurb: '',
  outdoor: true,
}))
