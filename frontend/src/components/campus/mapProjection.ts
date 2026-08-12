import { CAMPUS_BUILDINGS, CAMPUS_LIMIT, type CampusBuilding } from './campusLayout'

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

export function fitCampus(size: number, buildings: CampusBuilding[] = CAMPUS_BUILDINGS): MapView {
  if (buildings.length === 0) return { cx: 0, cz: 0, span: CAMPUS_SPAN, size }

  let minX = Infinity
  let maxX = -Infinity
  let minZ = Infinity
  let maxZ = -Infinity
  for (const building of buildings) {
    const [x, , z] = building.position
    minX = Math.min(minX, x - building.size[0] / 2)
    maxX = Math.max(maxX, x + building.size[0] / 2)
    minZ = Math.min(minZ, z - building.size[2] / 2)
    maxZ = Math.max(maxZ, z + building.size[2] / 2)
  }

  return {
    cx: (minX + maxX) / 2,
    cz: (minZ + maxZ) / 2,
    span: Math.max(maxX - minX, maxZ - minZ) + FIT_MARGIN * 2,
    size,
  }
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

export function headingVector(heading: number): { x: number; y: number } {
  return { x: -Math.sin(heading), y: -Math.cos(heading) }
}

export function buildingsInView(view: MapView, buildings: CampusBuilding[] = CAMPUS_BUILDINGS): CampusBuilding[] {
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
  buildings: CampusBuilding[] = CAMPUS_BUILDINGS,
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
  buildings: CampusBuilding[] = CAMPUS_BUILDINGS,
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
