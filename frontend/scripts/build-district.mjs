/**
 * Turns an OpenStreetMap extract of central Baku into the district data the
 * campus renders around the landmark.
 *
 * The streets around UFAZ used to be invented: one asphalt strip labelled
 * "Nizami Street" and six identical terrace blocks either side of the main
 * building. The real thing is a dense nineteenth-century grid, and no amount of
 * guessing produces it — so this reads the actual street centrelines and
 * building footprints and projects them into world metres.
 *
 * ## What it does
 *
 * 1. Projects lat/lon to metres on a local tangent plane centred on UFAZ.
 * 2. Rotates the whole extract so Nizami Street runs along the world X axis,
 *    which is the axis the campus was already built on.
 * 3. Translates so the real UFAZ footprint's centroid lands on the landmark.
 * 4. Keeps only what is on UFAZ's own side of Nizami Street. The other side is
 *    where the invented campus stands, and the campus is not being demolished
 *    for this; see the note in `nizamiDistrict.ts`.
 * 5. Emits footprints, heights and street centrelines as a TypeScript module.
 *
 * ## Running it
 *
 *     node scripts/build-district.mjs <overpass.json> > \
 *       src/components/campus/nizamiDistrict.ts
 *
 * The Overpass query that produced the input:
 *
 *     [out:json][timeout:90];
 *     (
 *       way(around:420,40.3765033,49.8515587)["highway"~"^(primary|secondary|
 *         tertiary|residential|trunk|unclassified|living_street|pedestrian|
 *         service)$"];
 *       way(around:420,40.3765033,49.8515587)["building"];
 *     );
 *     out tags geom;
 *
 * The output is committed, so the campus builds without network access and the
 * district cannot change under us because someone edited a map. Re-run this
 * only when the district is meant to change.
 *
 * Source data © OpenStreetMap contributors, ODbL. The generated module carries
 * the attribution and the campus credits it on screen.
 */

import { readFileSync } from 'node:fs'

/** The UFAZ node in OSM, which is what everything here is measured from. */
const ORIGIN = { lat: 40.3765033, lon: 49.8515587 }

/** Where the landmark stands in world coordinates, from `campusLayout`. */
const LANDMARK = { x: 0, z: -86 }

/**
 * How far north of the landmark to keep.
 *
 * This reached 28 May küçəsi at -200 — the next street parallel to Nizami —
 * which closed the block behind the university and looked right from the air.
 * On the ground it was unplayable: the extra depth roughly doubled the street
 * network, and the street network is what the trees, the lamps and the
 * frontage terrace are all generated from. Everything past this line is
 * further away than the fog anyway.
 */
const NORTH_LIMIT = -180

/**
 * How far east and west to keep.
 *
 * Reaches Fikrət Əmirov one way and Puşkin the other, which are the two cross
 * streets that actually bound the university's block. Azadlıq prospekti at
 * x 211 was in range before and cost a whole extra avenue of frontage for
 * something visible only as a smudge in the fog.
 */
const EAST_WEST_LIMIT = 170

/**
 * The near edge of the district, for buildings.
 *
 * The north kerb of Nizami Street. Buildings up to this line are UFAZ's own
 * terrace neighbours, which is the row the player actually stands in front of;
 * anything past it is on the far side of the street, where the invented campus
 * is. Buildings that cross the line are dropped whole rather than clipped: half
 * a building is worse than none.
 */
const SOUTH_LIMIT = -66

/**
 * The near edge for streets, which has to be further south than the buildings'
 * or Nizami Street itself — the one street the player spends the most time on —
 * would be clipped away as being on the wrong side of its own kerb.
 */
const STREET_SOUTH_LIMIT = -46

/** Metres per degree of latitude, near enough at this latitude. */
const M_PER_DEG_LAT = 110540

/** Storey height, for turning `building:levels` into a height. */
const STOREY = 3.6

/** What a street of each class is worth in metres, kerb to kerb. */
const ROAD_WIDTH = {
  trunk: 20,
  primary: 19,
  secondary: 15,
  tertiary: 13,
  residential: 11,
  unclassified: 10,
  living_street: 9,
  pedestrian: 11,
  service: 6,
}

function main() {
  const raw = JSON.parse(readFileSync(process.argv[2], 'utf8'))
  const elements = raw.elements.filter((e) => e.geometry?.length)

  const k = Math.cos((ORIGIN.lat * Math.PI) / 180) * 111320
  const flat = (p) => [(p.lon - ORIGIN.lon) * k, (p.lat - ORIGIN.lat) * M_PER_DEG_LAT]

  const ufaz = elements.find(
    (e) =>
      e.tags['addr:housenumber'] === '117' && (e.tags['addr:street'] || '').includes('Nizami'),
  )
  if (!ufaz) throw new Error('UFAZ footprint not found in the extract')

  // Nizami's bearing, taken from the longest run of it near the origin rather
  // than from one segment: the street kinks, and a short segment's bearing is
  // noise.
  const bearing = nizamiBearing(elements, flat)

  const ufazFlat = ufaz.geometry.map(flat)
  const centre = centroid(ufazFlat)

  // Rotate so Nizami lies along X, then decide which way round. The real UFAZ
  // is on the north side of its street and the landmark is on the -Z side of
  // ours, so if the rotation puts it on +Z the whole extract is turned through
  // half a turn. Mirroring instead would hand back a district that is a
  // reflection of Baku, which is subtly wrong in a way nobody could name but
  // everybody would feel.
  let theta = -bearing
  if (rotate(centre, theta)[1] - rotate(nizamiPoint(elements, flat), theta)[1] > 0) {
    theta += Math.PI
  }

  const place = (p) => {
    const [x, y] = rotate(flat(p), theta)
    const [cx, cy] = rotate(centre, theta)
    return [round(x - cx + LANDMARK.x), round(y - cy + LANDMARK.z)]
  }

  const buildings = []
  for (const e of elements) {
    if (!e.tags.building) continue
    if (e.id === ufaz.id) continue
    const ring = dedupe(e.geometry.map(place))
    if (ring.length < 3) continue
    const zs = ring.map((p) => p[1])
    if (Math.max(...zs) > SOUTH_LIMIT) continue
    if (Math.min(...zs) < NORTH_LIMIT) continue
    const xs = ring.map((p) => p[0])
    if (Math.min(...xs) < -EAST_WEST_LIMIT || Math.max(...xs) > EAST_WEST_LIMIT) continue
    if (area(ring) < 60) continue
    // The landmark's own plot. OSM's UFAZ way is already excluded by id, but
    // the extract has outbuildings and yard structures inside the same block,
    // and a shed standing in the middle of the main building is worse than no
    // shed at all.
    if (overlapsLandmark(xs, zs)) continue

    const levels = Number(e.tags['building:levels'])
    const tagged = Number(e.tags.height)
    const height = Number.isFinite(tagged)
      ? tagged
      : Number.isFinite(levels)
        ? Math.max(1, levels) * STOREY
        : 4 * STOREY

    buildings.push({
      ring,
      height: round(height),
      name: e.tags.name || e.tags['name:en'] || undefined,
      kind: classify(e.tags),
    })
  }

  const streets = []
  for (const e of elements) {
    const highway = e.tags.highway
    if (!highway || !(highway in ROAD_WIDTH)) continue
    const line = clip(dedupe(e.geometry.map(place)))
    for (const run of line) {
      if (run.length < 2) continue
      streets.push({
        points: run,
        width: ROAD_WIDTH[highway],
        name: e.tags.name || undefined,
        kind: highway === 'pedestrian' ? 'pedestrian' : 'road',
      })
    }
  }

  buildings.sort((a, b) => a.ring[0][0] - b.ring[0][0] || a.ring[0][1] - b.ring[0][1])
  streets.sort((a, b) => (a.name || '').localeCompare(b.name || '') || a.points[0][0] - b.points[0][0])

  const infill = frontage(streets, buildings)

  process.stdout.write(emit([...buildings, ...infill], streets, theta))
}

/**
 * Terrace filling the street frontages OpenStreetMap has not surveyed.
 *
 * The streets around UFAZ are mapped in full; the buildings along them are not.
 * Fifteen footprints across four blocks leaves the district reading as roads
 * through empty lots, which is a less honest picture of central Baku than a
 * terrace is — the whole point of this quarter is that it is built solid to the
 * pavement edge.
 *
 * So: march down each named street, and wherever the frontage is empty, stand a
 * block on it. Deterministic, and skipped wherever a surveyed footprint already
 * covers the ground, so re-running the generator against a better extract
 * quietly replaces invention with fact.
 *
 * These are tagged `source: 'infill'` in the output. Nothing downstream needs
 * to care, but a reader deserves to know which blocks are Baku and which are us.
 */
function frontage(streets, real) {
  const placed = real.map(bbox)
  const out = []
  // Bay width and depth of a Baku street block, near enough. Kept coarse: the
  // point is a continuous wall of frontage, not a plausible cadastral map.
  const DEPTH = 22
  const SETBACK = 5

  for (const street of streets) {
    if (!street.name) continue
    for (let i = 0; i < street.points.length - 1; i++) {
      const [ax, az] = street.points[i]
      const [bx, bz] = street.points[i + 1]
      const run = Math.hypot(bx - ax, bz - az)
      if (run < 12) continue
      const ux = (bx - ax) / run
      const uz = (bz - az) / run

      for (const side of [-1, 1]) {
        // The far edge of the pavement, which is where the building line is.
        const offset = street.width / 2 + SETBACK + DEPTH / 2
        const nx = -uz * side * offset
        const nz = ux * side * offset

        const bays = Math.max(1, Math.round(run / 26))
        for (let b = 0; b < bays; b++) {
          const t = ((b + 0.5) / bays) * run
          const cx = round(ax + ux * t + nx)
          const cz = round(az + uz * t + nz)
          const along = run / bays - 1.5

          // Square to the world rather than to the street. Every street in
          // this extract runs within a few degrees of an axis once rotated,
          // and an axis-aligned footprint is one the collision resolver can
          // represent exactly instead of approximately.
          const across = Math.abs(ux) > Math.abs(uz)
          const halfW = (across ? along : DEPTH) / 2
          const halfD = (across ? DEPTH : along) / 2
          if (halfW < 5 || halfD < 5) continue

          const box = { minX: cx - halfW, maxX: cx + halfW, minZ: cz - halfD, maxZ: cz + halfD }
          if (box.maxZ > SOUTH_LIMIT || box.minZ < NORTH_LIMIT) continue
          if (box.minX < -EAST_WEST_LIMIT || box.maxX > EAST_WEST_LIMIT) continue
          if (overlapsLandmark([box.minX, box.maxX], [box.minZ, box.maxZ])) continue
          if (placed.some((p) => overlaps(p, box, 1.5))) continue

          placed.push(box)
          out.push({
            ring: [
              [box.minX, box.minZ],
              [box.maxX, box.minZ],
              [box.maxX, box.maxZ],
              [box.minX, box.maxZ],
            ],
            // Four to six storeys, which is the range this quarter actually
            // runs to. Hashed off the position so the skyline is varied and
            // identical on every run.
            height: round((4 + (Math.abs(Math.round(cx * 7 + cz * 13)) % 3)) * STOREY),
            kind: 'limestone',
            source: 'infill',
          })
        }
      }
    }
  }
  return out
}

function bbox(building) {
  const xs = building.ring.map((p) => p[0])
  const zs = building.ring.map((p) => p[1])
  return { minX: Math.min(...xs), maxX: Math.max(...xs), minZ: Math.min(...zs), maxZ: Math.max(...zs) }
}

function overlaps(a, b, margin = 0) {
  return (
    a.minX - margin < b.maxX &&
    a.maxX + margin > b.minX &&
    a.minZ - margin < b.maxZ &&
    a.maxZ + margin > b.minZ
  )
}

/**
 * Whether a footprint lands on the landmark's own plot.
 *
 * The landmark is 54 by 22 at z -86, drawn by `UfazBuilding`; this is that box
 * with a little margin, in the same coordinates.
 */
function overlapsLandmark(xs, zs) {
  return (
    Math.min(...xs) < 30 && Math.max(...xs) > -30 && Math.min(...zs) < -72 && Math.max(...zs) > -101
  )
}

/** Keeps a polyline to the district, splitting it where it leaves. */
function clip(points) {
  const runs = []
  let run = []
  for (const p of points) {
    const inside =
      p[1] <= STREET_SOUTH_LIMIT && p[1] >= NORTH_LIMIT && Math.abs(p[0]) <= EAST_WEST_LIMIT
    if (inside) {
      run.push(p)
    } else {
      if (run.length > 1) runs.push(run)
      run = []
    }
  }
  if (run.length > 1) runs.push(run)
  return runs
}

/**
 * What to build the facade out of.
 *
 * OSM does not record architecture, so this is the crude split that the street
 * actually shows: the old city is limestone, the towers that have gone up
 * around it since are glass, and single-storey infill in a courtyard is
 * neither.
 */
function classify(tags) {
  const levels = Number(tags['building:levels'])
  if (tags.building === 'office' && levels >= 8) return 'tower'
  if (Number.isFinite(levels) && levels >= 8) return 'tower'
  if (Number.isFinite(levels) && levels <= 1) return 'infill'
  return 'limestone'
}

function nizamiSegments(elements) {
  return elements.filter((e) => e.tags.highway && e.tags.name === 'Nizami küçəsi')
}

function nizamiBearing(elements, flat) {
  let best = { length: 0, angle: 0 }
  for (const seg of nizamiSegments(elements)) {
    const pts = seg.geometry.map(flat)
    const a = pts[0]
    const b = pts[pts.length - 1]
    const length = Math.hypot(b[0] - a[0], b[1] - a[1])
    if (length > best.length) best = { length, angle: Math.atan2(b[1] - a[1], b[0] - a[0]) }
  }
  if (!best.length) throw new Error('Nizami küçəsi not found in the extract')
  return best.angle
}

/** A point on Nizami Street, to tell which side of it UFAZ is on. */
function nizamiPoint(elements, flat) {
  let best = null
  for (const seg of nizamiSegments(elements)) {
    for (const p of seg.geometry.map(flat)) {
      const d = Math.hypot(p[0], p[1])
      if (!best || d < best.d) best = { d, p }
    }
  }
  return best.p
}

function rotate([x, y], theta) {
  const c = Math.cos(theta)
  const s = Math.sin(theta)
  return [x * c - y * s, x * s + y * c]
}

function centroid(points) {
  return [
    points.reduce((t, p) => t + p[0], 0) / points.length,
    points.reduce((t, p) => t + p[1], 0) / points.length,
  ]
}

function area(ring) {
  let a = 0
  for (let i = 0; i < ring.length; i++) {
    const [x1, y1] = ring[i]
    const [x2, y2] = ring[(i + 1) % ring.length]
    a += x1 * y2 - x2 * y1
  }
  return Math.abs(a) / 2
}

/** Drops repeated points, including the closing one on a building ring. */
function dedupe(points) {
  const out = []
  for (const p of points) {
    const last = out[out.length - 1]
    if (last && Math.abs(last[0] - p[0]) < 0.05 && Math.abs(last[1] - p[1]) < 0.05) continue
    out.push(p)
  }
  const first = out[0]
  const last = out[out.length - 1]
  if (out.length > 1 && Math.abs(first[0] - last[0]) < 0.05 && Math.abs(first[1] - last[1]) < 0.05) {
    out.pop()
  }
  return out
}

function round(n) {
  return Math.round(n * 10) / 10
}

function emit(buildings, streets, theta) {
  const pts = (ring) => `[${ring.map(([x, z]) => `[${x},${z}]`).join(',')}]`
  return `/**
 * The real district around 183 Nizami Street, as data.
 *
 * GENERATED by \`scripts/build-district.mjs\`. Do not edit by hand — re-run the
 * generator, which documents the Overpass query it was built from.
 *
 * Street centrelines and building footprints are OpenStreetMap data, projected
 * onto a local tangent plane at the university, rotated so Nizami Street runs
 * along the world X axis, and translated so the real UFAZ footprint sits on the
 * landmark. Distances are metres and match the world's scale, so the block
 * across the street is as far away here as it is in Baku.
 *
 * Only UFAZ's own side of Nizami Street is included. The far side is where the
 * invented campus stands — the library, the labs, the amphitheatre and the
 * sports hall are not real buildings and never were, and this change did not
 * set out to delete them. So the city is real to the north of the street and
 * ours to the south, and the street is the seam.
 *
 * Rotation applied: ${(theta * 180 / Math.PI).toFixed(2)}°.
 *
 * Source data © OpenStreetMap contributors, available under the Open Database
 * Licence (https://www.openstreetmap.org/copyright). Heights come from
 * \`building:levels\` where the map records it and are estimated otherwise, so
 * treat the skyline as indicative and the footprints as accurate.
 */

/** A footprint, as a closed ring of [x, z] in world metres. */
export type Footprint = readonly (readonly [number, number])[]

/** How a block's facade is drawn. */
export type DistrictStyle = 'limestone' | 'tower' | 'infill'

export interface DistrictBuilding {
  footprint: Footprint
  /** Eaves height in metres. */
  height: number
  style: DistrictStyle
  /** Present only where OSM names the building. */
  name?: string
  /**
   * \`osm\` is a surveyed footprint. \`infill\` is a terrace block standing on a
   * frontage the map leaves blank — the streets here are mapped in full and the
   * buildings along them are not, and a road through an empty lot is a worse
   * likeness of this quarter than a terrace is.
   */
  source: 'osm' | 'infill'
}

export interface DistrictStreet {
  /** Centreline, as [x, z] in world metres. */
  points: readonly (readonly [number, number])[]
  /** Kerb to kerb, in metres. */
  width: number
  name?: string
  kind: 'road' | 'pedestrian'
}

export const DISTRICT_BUILDINGS: readonly DistrictBuilding[] = [
${buildings
  .map(
    (b) =>
      `  { footprint: ${pts(b.ring)}, height: ${b.height}, style: '${b.kind}', source: '${
        b.source || 'osm'
      }'${b.name ? `, name: ${JSON.stringify(b.name)}` : ''} },`,
  )
  .join('\n')}
]

export const DISTRICT_STREETS: readonly DistrictStreet[] = [
${streets
  .map(
    (s) =>
      `  { points: ${pts(s.points)}, width: ${s.width}, kind: '${s.kind}'${
        s.name ? `, name: ${JSON.stringify(s.name)}` : ''
      } },`,
  )
  .join('\n')}
]

/** Shown in the campus credits, because ODbL requires the attribution. */
export const DISTRICT_ATTRIBUTION = '© OpenStreetMap contributors'
`
}

main()
