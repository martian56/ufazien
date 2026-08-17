import { CAMPUS_LIMIT, OUTDOOR_BUILDINGS, type CampusBuilding } from './campusLayout'

export interface MapView {
  cx: number
  cz: number
  span: number
  size: number
}

export interface Pose {
  x: number
  z: number
  heading: number
  room: string | null
}

export const NEAR_SPAN = 150

export const CAMPUS_SPAN = CAMPUS_LIMIT * 2 + 24

export const FIT_MARGIN = 26

/**
 * A view of the whole campus.
 *
 * Fitted to where the player can actually go, not to the buildings. It used to
 * take the bounding box of `OUTDOOR_BUILDINGS`, which was fine when there were
 * seven of them scattered across the site — and then the campus was rebuilt
 * around the one real building and every other room moved indoors, leaving that
 * list with a single entry. The map became a 106-metre window centred on the
 * main building: no quad, no fountain, no Nizami Street, no paths, and the
 * player's own marker pinned to the rim whenever they were anywhere else.
 *
 * `CAMPUS_LIMIT` is what the player is clamped to, so a view built from it can
 * never exclude somewhere they can stand. The buildings are still taken into
 * account, because scenery beyond the limit should not fall off the edge.
 */
export function fitCampus(size: number, buildings: CampusBuilding[] = OUTDOOR_BUILDINGS): MapView {
  // Centred on the origin, which is where the campus is laid out about, and
  // reaching at least as far as the player may walk. A building that stands
  // beyond that limit pushes it out rather than being cut off.
  const half = Math.max(
    CAMPUS_LIMIT,
    ...buildings.map((b) => Math.abs(b.position[0]) + b.size[0] / 2),
    ...buildings.map((b) => Math.abs(b.position[2]) + b.size[2] / 2),
  )

  return { cx: 0, cz: 0, span: half * 2 + FIT_MARGIN, size }
}

export function windowAround(x: number, z: number, size: number, span: number = NEAR_SPAN): MapView {
  return { cx: x, cz: z, span, size }
}

export function scaleOf(view: MapView): number {
  return view.size / view.span
}

export function project(x: number, z: number, view: MapView): { x: number; y: number } {
  const scale = scaleOf(view)
  return {
    x: view.size / 2 + (x - view.cx) * scale,
    y: view.size / 2 + (z - view.cz) * scale,
  }
}

/**
 * A heading as a direction on the map.
 *
 * `heading` is the avatar convention — zero faces +Z — and `project` maps +Z to
 * +Y, which is down the screen. So forward is `(sin, cos)`.
 *
 * This returned the negation of that, which is the direction the player's back
 * is pointing: the arrow on the minimap pointed exactly the opposite way to the
 * one you were walking, all the way across the campus.
 */
export function headingVector(heading: number): { x: number; y: number } {
  return { x: Math.sin(heading), y: Math.cos(heading) }
}

export function buildingsInView(view: MapView, buildings: CampusBuilding[] = OUTDOOR_BUILDINGS): CampusBuilding[] {
  const half = view.span / 2
  return buildings.filter((building) => {
    const [x, , z] = building.position
    const halfW = building.size[0] / 2
    const halfD = building.size[2] / 2
    return (
      Math.abs(x - view.cx) <= half + halfW && Math.abs(z - view.cz) <= half + halfD
    )
  })
}

export function clampToEdge(
  dx: number,
  dy: number,
  radius: number,
): { x: number; y: number; clamped: boolean } {
  const distance = Math.hypot(dx, dy)
  if (distance <= radius || distance === 0) return { x: dx, y: dy, clamped: false }
  const ratio = radius / distance
  return { x: dx * ratio, y: dy * ratio, clamped: true }
}

export interface PlacedLabel {
  text: string
  x: number
  y: number
}

export function placeLabels(
  view: MapView,
  measure: (text: string) => number,
  buildings: CampusBuilding[] = OUTDOOR_BUILDINGS,
  lineHeight = 12,
): PlacedLabel[] {
  const scale = scaleOf(view)
  const taken: { x: number; y: number; w: number; h: number }[] = []
  const placed: PlacedLabel[] = []

  const ordered = [...buildings].sort((a, b) => b.size[0] * b.size[2] - a.size[0] * a.size[2])

  for (const building of ordered) {
    const [x, , z] = building.position
    const at = project(x, z, view)
    const width = measure(building.name)
    const belowRect = at.y + (building.size[2] / 2) * scale + lineHeight * 0.9

    const candidates = [belowRect, at.y, at.y - (building.size[2] / 2) * scale - lineHeight * 0.4]
    let chosen: number | null = null

    for (const y of candidates) {
      const box = { x: at.x - width / 2, y: y - lineHeight / 2, w: width, h: lineHeight }
      if (box.x < 0 || box.y < 0 || box.x + box.w > view.size || box.y + box.h > view.size) continue
      const clash = taken.some(
        (other) =>
          box.x < other.x + other.w &&
          box.x + box.w > other.x &&
          box.y < other.y + other.h &&
          box.y + box.h > other.y,
      )
      if (!clash) {
        chosen = y
        taken.push(box)
        break
      }
    }

    if (chosen !== null) placed.push({ text: building.name, x: at.x, y: chosen })
  }

  return placed
}

export function nearestBuilding(
  x: number,
  z: number,
  buildings: CampusBuilding[] = OUTDOOR_BUILDINGS,
): CampusBuilding | null {
  let best: CampusBuilding | null = null
  let bestDistance = Infinity
  for (const building of buildings) {
    const [bx, , bz] = building.position
    const distance = Math.hypot(x - bx, z - bz)
    if (distance < bestDistance) {
      best = building
      bestDistance = distance
    }
  }
  return best
}
