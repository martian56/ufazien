/**
 * The campus, as data.
 *
 * Everything about where things are lives here rather than in the components
 * that draw them, so the layout can be reasoned about — and tested — without a
 * WebGL context. `campusLayout.test.ts` covers the parts with real logic in
 * them: collision, proximity and the deterministic scatter.
 *
 * ## Why this shape of campus
 *
 * UFAZ is not a green-field American campus. It is a single six-storey
 * building at 183 Nizami Street in central Baku: a state-protected
 * architectural monument of local significance, about 2,500 m², restored and
 * reopened in September 2016, with laboratories added in 2018 to University of
 * Strasbourg standards. So the real building is modelled as the landmark it is
 * — heritage limestone, on a street, in a terrace of its oil-boom-era
 * neighbours — and the teaching spaces students actually use are laid out as a
 * campus behind it. It reads as UFAZ rather than as Generic University #4.
 */

import { DISTRICT_BUILDINGS, DISTRICT_STREETS } from './nizamiDistrict'

/** r3f accepts a plain number[] at runtime, but its types want the length. */
export type Vec3 = [number, number, number]

/**
 * How far from the origin a player may walk.
 *
 * Was 50, which put the whole world inside one screen: you could see every
 * building from the spawn point and cross the campus in twelve seconds. Then
 * 185, the campus; then 240, to fit a district that reached 28 May küçəsi and
 * Azadlıq prospekti. That district turned out to be what made the game freeze,
 * so it has been pulled back to the block the university actually stands on and
 * this with it — far enough to hold the scenery blocks at z 176, no further.
 */
export const CAMPUS_LIMIT = 200

/** The ground plane. Comfortably past the fog, so the world has no visible edge. */
export const GROUND_SIZE = 1000

/** Half-width of the player's collision cylinder, in world units. */
export const PLAYER_RADIUS = 0.55

/** Which interior a building opens into. One design per building. */
export type InteriorKind =
  | 'ufaz'
  | 'library'
  | 'lab'
  | 'lecture'
  | 'student-center'
  | 'cafeteria'
  | 'sports'

export type MinigameId = 'basketball' | 'dash' | 'titration' | 'booksort'

/** How a building's facade is drawn. */
export type BuildingStyle = 'heritage' | 'modern' | 'brick' | 'glass'

export interface CampusBuilding {
  /**
   * Stays numeric. It is what travels over the wire as `current_room`, and the
   * screen-share room check compares it against what other clients send, so
   * changing the format would make presenters invisible across a deploy.
   */
  id: number
  name: string
  position: Vec3
  size: Vec3
  color: string
  icon: string
  style: BuildingStyle
  interior: InteriorKind
  /** Roof/trim colour. Heritage buildings get a darker cap than their walls. */
  trim: string
  /** Shown on the approach prompt, so walking up to a door tells you something. */
  blurb: string
}

/**
 * The enterable buildings.
 *
 * Entrances all face +Z, which is what `Building` draws and what the interior
 * spawn assumes, so the campus is laid out with its circulation to the south of
 * each block.
 */
export const CAMPUS_BUILDINGS: CampusBuilding[] = [
  {
    id: 1,
    name: 'UFAZ Main Building',
    position: [0, 0, -86],
    size: [54, 25, 22],
    color: '#e0d2b4',
    trim: '#cdba99',
    icon: '🏛️',
    style: 'heritage',
    interior: 'ufaz',
    blurb: '183 Nizami Street — the restored 1900s building UFAZ actually occupies',
  },
  {
    id: 2,
    name: 'Library',
    position: [-64, 0, -8],
    size: [32, 16, 24],
    color: '#c8b394',
    trim: '#7f6f57',
    icon: '📚',
    style: 'brick',
    interior: 'library',
    blurb: 'Reading room, stacks, and a book-sorting challenge on the desk',
  },
  {
    id: 3,
    name: 'Laboratory Building',
    position: [62, 0, -10],
    size: [32, 15, 24],
    color: '#aebccb',
    trim: '#5d6b7a',
    icon: '🔬',
    style: 'modern',
    interior: 'lab',
    blurb: 'Strasbourg-standard labs — the titration bench is open',
  },
  {
    id: 4,
    name: 'Amphitheatre',
    position: [0, 0, 66],
    size: [36, 14, 28],
    color: '#b9a68c',
    trim: '#6f6353',
    icon: '🎓',
    style: 'modern',
    interior: 'lecture',
    blurb: 'Tiered lecture hall with the projector screen',
  },
  {
    id: 5,
    name: 'Student Centre',
    position: [-70, 0, 64],
    size: [32, 13, 26],
    color: '#9fb6c4',
    trim: '#4f6472',
    icon: '🏢',
    style: 'glass',
    interior: 'student-center',
    blurb: 'Sofas, table football and somewhere to actually sit down',
  },
  {
    id: 6,
    name: 'Cafeteria',
    position: [68, 0, 62],
    size: [30, 11, 22],
    color: '#c9a68f',
    trim: '#7d5f4d',
    icon: '🍽️',
    style: 'brick',
    interior: 'cafeteria',
    blurb: 'Counters, trays, and the smell of reheated plov',
  },
  {
    id: 7,
    name: 'Sports Hall',
    position: [-10, 0, 128],
    size: [44, 15, 32],
    color: '#b8bfc6',
    trim: '#575f68',
    icon: '🏀',
    style: 'modern',
    interior: 'sports',
    blurb: 'Indoor court — free throws on the far hoop',
  },
]

/**
 * Buildings you cannot walk into.
 *
 * Their job is to close the horizon: an empty plane past the last enterable
 * block makes a campus feel like a diorama. The Nizami Street terrace also
 * gives the main building neighbours, which is how it actually stands.
 */
export interface SceneryBlock {
  position: Vec3
  size: Vec3
  color: string
  trim: string
  style: BuildingStyle
  /** Heritage terraces get their windows arched like the landmark's. */
  arched?: boolean
}

export const SCENERY_BLOCKS: SceneryBlock[] = [
  // The Nizami Street terrace used to be six invented facades here, three
  // either side of the landmark. It is now the real one: `nizamiDistrict.ts`
  // carries the surveyed footprints, and `NizamiDistrict` draws them.

  // Halls of residence, well back on the west side.
  { position: [-138, 0, 70], size: [26, 26, 22], color: '#b6a894', trim: '#6d6355', style: 'brick' },
  { position: [-138, 0, 118], size: [26, 29, 22], color: '#ad9f8b', trim: '#665d50', style: 'brick' },
  { position: [-138, 0, 166], size: [26, 24, 22], color: '#bcae9a', trim: '#71675a', style: 'brick' },

  // Engineering annexes on the east side, mirroring them.
  { position: [140, 0, 20], size: [28, 20, 24], color: '#a8b5c1', trim: '#5a6773', style: 'modern' },
  { position: [140, 0, 76], size: [28, 24, 24], color: '#9fb0bd', trim: '#54626e', style: 'modern' },
  { position: [136, 0, 134], size: [30, 18, 26], color: '#aab7c2', trim: '#5c6975', style: 'modern' },

  // Something to see at the far end, so the north-south axis has a terminus.
  { position: [0, 0, 176], size: [60, 16, 20], color: '#b0a894', trim: '#655e50', style: 'modern' },
]

/** A paved surface: streets, plazas, courts and the paths between them. */
export interface Pavement {
  /** Centre of the strip. */
  position: [number, number]
  size: [number, number]
  kind: 'asphalt' | 'stone' | 'path' | 'court'
  /** Rotation about Y, radians. Only used for the diagonal desire lines. */
  rotation?: number
}

export const PAVEMENTS: Pavement[] = [
  // Nizami Street used to be a single 400-metre asphalt strip here with a
  // pavement either side. It is drawn from its surveyed centreline now, along
  // with the four streets that cross it; see `nizamiDistrict.ts`.

  // The forecourt between the street and the main building's steps.
  { position: [0, -70], size: [70, 8], kind: 'stone' },

  // The spine: gate to amphitheatre to sports hall.
  { position: [0, 20], size: [16, 190], kind: 'path' },
  // The cross axis: library to laboratory.
  { position: [0, -9], size: [180, 14], kind: 'path' },
  // Approach to the student centre and cafeteria.
  { position: [0, 62], size: [190, 12], kind: 'path' },

  // The outdoor basketball court.
  { position: [74, 122], size: [30, 22], kind: 'court' },
]

/** Where the campus dash rings and the basketball hoop stand. */
export const OUTDOOR_COURT: Vec3 = [74, 0, 122]

/**
 * The quad, at the crossing of the two main axes. Drawn as a ring of grass
 * with a fountain in the middle rather than as another rectangle of paving.
 */
export const QUAD_CENTRE: [number, number] = [0, -9]
export const QUAD_RADIUS = 26

/**
 * Deterministic PRNG.
 *
 * Scenery positions must survive a re-render. `Math.random()` in a `useMemo`
 * looks stable until React re-runs it, and then the trees jump.
 */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export interface ScatterItem {
  x: number
  z: number
  scale: number
  rotation: number
  /** Index into the variant palette, so not every tree is the same green. */
  variant: number
}

/**
 * Scatters props across the campus, avoiding buildings and paved routes.
 *
 * Rejection sampling with a fixed seed: same input, same forest, every time.
 */
export function scatterProps({
  count,
  seed,
  limit = CAMPUS_LIMIT,
  clearance = 4,
  blocked = [],
  variants = 3,
}: {
  count: number
  seed: number
  limit?: number
  clearance?: number
  blocked?: Rect[]
  variants?: number
}): ScatterItem[] {
  const random = mulberry32(seed)
  const items: ScatterItem[] = []
  // Bounded: a fully blocked region must not spin forever looking for space.
  for (let attempt = 0; attempt < count * 30 && items.length < count; attempt++) {
    const x = (random() * 2 - 1) * limit
    const z = (random() * 2 - 1) * limit
    if (blocked.some((rect) => insideRect(x, z, rect, clearance))) continue
    items.push({
      x,
      z,
      scale: 0.75 + random() * 0.7,
      rotation: random() * Math.PI * 2,
      variant: Math.floor(random() * variants),
    })
  }
  return items
}

/**
 * The props, as data.
 *
 * These lived in `CampusScenery` as three `useMemo`s, which was fine while they
 * were only drawn. They are solid now, and a tree that the renderer puts in one
 * place and the collision system in another is worse than a tree you can walk
 * through — so both read the same list from here.
 */
export const TREE_COUNT = 150

/** Trunk radius used for collision. The canopy is wider; you duck under it. */
export const TRUNK_RADIUS = 0.7
export const LAMP_RADIUS = 0.32
/** The fountain in the quad, which you now walk around rather than through. */
export const FOUNTAIN_RADIUS = 7.5
/** A bench, as a footprint: long, shallow, and turned to face the quad. */
export const BENCH_HALF = { halfW: 1.25, halfD: 0.45 }

export function campusTrees(count = TREE_COUNT): ScatterItem[] {
  return scatterProps({ count, seed: 20240917, blocked: KEEP_CLEAR, clearance: 5, variants: 3 })
}

/** Lamps line the routes rather than scattering, because that is what lamps do. */
export function campusLamps(): { x: number; z: number }[] {
  const items: { x: number; z: number }[] = []
  for (let z = -170; z <= 170; z += 22) {
    items.push({ x: -9.5, z }, { x: 9.5, z })
  }
  for (let x = -160; x <= 160; x += 24) {
    items.push({ x, z: -54.5 })
  }
  return items
}

/** Benches around the quad, facing in. */
export function campusBenches(): { x: number; z: number; ry: number }[] {
  const items: { x: number; z: number; ry: number }[] = []
  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * Math.PI * 2
    items.push({
      x: QUAD_CENTRE[0] + Math.cos(angle) * (QUAD_RADIUS - 2.5),
      z: QUAD_CENTRE[1] + Math.sin(angle) * (QUAD_RADIUS - 2.5),
      ry: -angle + Math.PI / 2,
    })
  }
  return items
}

/** An axis-aligned footprint on the ground plane. */
export interface Rect {
  x: number
  z: number
  halfW: number
  halfD: number
}

export function insideRect(x: number, z: number, rect: Rect, margin = 0): boolean {
  return (
    Math.abs(x - rect.x) <= rect.halfW + margin && Math.abs(z - rect.z) <= rect.halfD + margin
  )
}

/** The footprint a building occupies, as the collision system sees it. */
export function buildingRect(building: { position: Vec3; size: Vec3 }): Rect {
  return {
    x: building.position[0],
    z: building.position[2],
    halfW: building.size[0] / 2,
    halfD: building.size[2] / 2,
  }
}

/**
 * The footprint of a district block, as the collision system sees it.
 *
 * The resolver works in axis-aligned boxes, so a surveyed footprint collides as
 * its bounding box rather than as its outline. Every street in the extract runs
 * within a few degrees of an axis once the district has been rotated onto ours,
 * so for the terrace blocks the two are near enough the same shape; where they
 * are not, the effect is that a courtyard notch is solid rather than walkable.
 * That is the right way round to be wrong: you cannot walk into a building, and
 * the alternative — a polygon resolver — would be a rewrite of the one piece of
 * this codebase that everything else depends on being simple.
 */
export function districtRect(building: { footprint: readonly (readonly [number, number])[] }): Rect {
  const xs = building.footprint.map((p) => p[0])
  const zs = building.footprint.map((p) => p[1])
  const minX = Math.min(...xs)
  const maxX = Math.max(...xs)
  const minZ = Math.min(...zs)
  const maxZ = Math.max(...zs)
  return {
    x: (minX + maxX) / 2,
    z: (minZ + maxZ) / 2,
    halfW: (maxX - minX) / 2,
    halfD: (maxZ - minZ) / 2,
  }
}

/**
 * The narrowest slot between two blocks that is worth leaving open.
 *
 * A least-penetration resolver ejects along the shallower axis, so a gap
 * narrower than a person — or a shallow overlap — bounces them between the two
 * walls forever. Anything inside this band gets merged rather than left as a
 * trap. `campusLayout.test.ts` is what enforces it.
 */
const MIN_ALLEY = PLAYER_RADIUS * 2 + 1

function isWedge(a: Rect, b: Rect): boolean {
  const gapX = Math.abs(a.x - b.x) - (a.halfW + b.halfW)
  const gapZ = Math.abs(a.z - b.z) - (a.halfD + b.halfD)
  // Two blocks offset on both axes are diagonal neighbours, not a slot.
  if (gapX > 0 && gapZ > 0) return false
  const gap = Math.max(gapX, gapZ)
  return gap > -MIN_ALLEY && gap < MIN_ALLEY
}

function union(a: Rect, b: Rect): Rect {
  const minX = Math.min(a.x - a.halfW, b.x - b.halfW)
  const maxX = Math.max(a.x + a.halfW, b.x + b.halfW)
  const minZ = Math.min(a.z - a.halfD, b.z - b.halfD)
  const maxZ = Math.max(a.z + a.halfD, b.z + b.halfD)
  return { x: (minX + maxX) / 2, z: (minZ + maxZ) / 2, halfW: (maxX - minX) / 2, halfD: (maxZ - minZ) / 2 }
}

/**
 * Merges every pair of boxes that would form a wedge, until none is left.
 *
 * A Baku terrace is drawn as separate houses — the reveals between them are
 * most of what gives the row its rhythm — but it is one continuous wall and has
 * to collide as one. This is the same trick the hand-built terrace used, except
 * that it was two hardcoded rectangles and this works out the runs for itself,
 * so the surveyed footprints can change without anyone having to remember.
 *
 * Repeated to a fixed point because merging two boxes can bring the result
 * within a wedge of a third.
 */
function mergeWedges(rects: Rect[]): Rect[] {
  const boxes = [...rects]
  for (let guard = 0; guard < boxes.length * 4; guard++) {
    let joined = false
    search: for (let i = 0; i < boxes.length; i++) {
      for (let j = i + 1; j < boxes.length; j++) {
        if (!isWedge(boxes[i], boxes[j])) continue
        boxes[i] = union(boxes[i], boxes[j])
        boxes.splice(j, 1)
        joined = true
        break search
      }
    }
    if (!joined) break
  }
  return boxes
}

/** Every block of the real district, as something to bump into. */
export const DISTRICT_COLLIDERS: Rect[] = mergeWedges(DISTRICT_BUILDINGS.map(districtRect))

/**
 * What is solid, which is not the same list as what is drawn.
 *
 * Two boxes that share an edge exactly are a trap for a least-penetration
 * resolver: standing on the seam, each block pushes you sideways into the
 * other, and no number of passes settles it. The district generator leaves a
 * margin between adjacent blocks for exactly that reason, so nothing here has
 * to be merged the way the old hand-built terrace did.
 */
export const SCENERY_COLLIDERS: Rect[] = [
  ...DISTRICT_COLLIDERS,
  // Everything else stands alone, with room to walk between.
  ...SCENERY_BLOCKS.map(buildingRect),
]

/** Half-width of a doorway. A shade over two people wide. */
export const DOOR_HALF_WIDTH = 1.7

/**
 * How far the opening is recessed into the facade.
 *
 * Only has to be deep enough for the player's centre to reach the face of the
 * building, which is where going inside is decided — `PLAYER_RADIUS` is 0.45,
 * so this is roughly twice what is needed and leaves the doorway reading as a
 * doorway rather than as a scratch in the wall.
 */
export const ALCOVE_DEPTH = 1.2

export interface Doorway {
  /** The building this is the door of. */
  id: number
  /** Centre of the opening, in world x. */
  x: number
  /** The face of the building, in world z. Crossing this is going inside. */
  z: number
  halfW: number
}

/**
 * The door of a building.
 *
 * Centred on the facade, on the +Z face like every entrance on this campus —
 * the buildings all face down the spine, and proximity entry always measured
 * to the same side.
 */
export function doorwayFor(building: CampusBuilding): Doorway {
  const [x, , z] = building.position
  return { id: building.id, x, z: z + building.size[2] / 2, halfW: DOOR_HALF_WIDTH }
}

/** Every door on the campus. */
export const CAMPUS_DOORS: Doorway[] = CAMPUS_BUILDINGS.map(doorwayFor)

/**
 * A building's footprint with the doorway left open.
 *
 * Three boxes rather than one: the piers either side run the full depth, and a
 * back wall closes the alcove so the opening is a doorway rather than a tunnel
 * straight through the building.
 */
export function buildingCollidersWithDoor(building: CampusBuilding): Rect[] {
  const [x, , z] = building.position
  const halfW = building.size[0] / 2
  const halfD = building.size[2] / 2
  const door = doorwayFor(building)
  const pierWidth = halfW - door.halfW

  if (pierWidth <= 0 || halfD <= ALCOVE_DEPTH / 2) {
    // A building narrower than its own doorway, or shallower than the alcove,
    // has nothing left to build the opening out of. Solid, rather than
    // silently open across the whole face.
    return [{ x, z, halfW, halfD }]
  }

  return [
    { x: x - door.halfW - pierWidth / 2, z, halfW: pierWidth / 2, halfD },
    { x: x + door.halfW + pierWidth / 2, z, halfW: pierWidth / 2, halfD },
    // The back of the alcove, running the *full* width of the building rather
    // than just the width of the opening. Cut to the opening it would abut the
    // piers exactly, and a shared edge is the one arrangement a
    // least-penetration resolver cannot settle on: each box ejects the player
    // into the other and no number of passes converges. The corner of the
    // alcove is somewhere a player can stand, so that seam is reachable.
    // Overlapping the piers deeply leaves no seam to stand on, and the alcove
    // is still open because this box stops short of the facade in z.
    { x, z: z - ALCOVE_DEPTH / 2, halfW, halfD: halfD - ALCOVE_DEPTH / 2 },
  ]
}

/**
 * Everything solid on the campus: what you bump into rather than walk through.
 *
 * The seven buildings are three boxes each rather than one, leaving an alcove
 * in the middle of each facade that you can walk into — the doorway. A single
 * box stops the player a radius short of the wall, which is a building you can
 * only enter by pressing a key at it.
 *
 * `KEEP_CLEAR` below deliberately keeps the whole footprint: the scatter must
 * not drop a tree into a doorway just because the doorway is not solid.
 */
export const CAMPUS_COLLIDERS: Rect[] = [
  ...CAMPUS_BUILDINGS.flatMap(buildingCollidersWithDoor),
  ...SCENERY_COLLIDERS,
]

/**
 * The carriageways, as footprints, so the scatter does not plant a tree in the
 * middle of Nizami Street.
 *
 * One rect per segment rather than per street: a street that turns a corner has
 * a bounding box covering the whole block it turns around, and everything
 * inside it would be swept clear of trees for no reason.
 */
export const DISTRICT_STREET_RECTS: Rect[] = DISTRICT_STREETS.flatMap((street) =>
  street.points.slice(1).map((point, i) => {
    const previous = street.points[i]
    return {
      x: (previous[0] + point[0]) / 2,
      z: (previous[1] + point[1]) / 2,
      halfW: Math.abs(point[0] - previous[0]) / 2 + street.width / 2,
      halfD: Math.abs(point[1] - previous[1]) / 2 + street.width / 2,
    }
  }),
)

/** Footprints the scatter must keep clear: buildings plus every paved surface. */
export const KEEP_CLEAR: Rect[] = [
  ...DISTRICT_STREET_RECTS,
  // The whole building footprint, doorway included: an opening you cannot walk
  // into because a tree is standing in it is not an opening.
  ...CAMPUS_BUILDINGS.map(buildingRect),
  ...SCENERY_COLLIDERS,
  ...PAVEMENTS.map((p) => ({
    x: p.position[0],
    z: p.position[1],
    halfW: p.size[0] / 2,
    halfD: p.size[1] / 2,
  })),
  // The quad, as a square that contains its circle.
  { x: QUAD_CENTRE[0], z: QUAD_CENTRE[1], halfW: QUAD_RADIUS, halfD: QUAD_RADIUS },
]

/**
 * Pushes a position out of anything solid it has ended up inside.
 *
 * Resolves along whichever axis is least deep, which is what makes a wall feel
 * like a wall: you slide along it instead of stopping dead, and a corner does
 * not fling you sideways. Buildings were previously not solid at all — you
 * walked through the library and out the other side.
 *
 * Runs several passes because one is not enough. Pushing clear of a corner can
 * land inside the neighbouring block, and a single pass would leave the player
 * standing in it; each further pass resolves what the last one created. Three
 * settles every arrangement on this campus, and the cap means a position wedged
 * somewhere genuinely impossible returns rather than looping.
 *
 * Pure, and the reason this module exists separately from the components.
 */
export function resolveCollision(
  x: number,
  z: number,
  colliders: Rect[] = CAMPUS_COLLIDERS,
  radius = PLAYER_RADIUS,
  passes = 3,
): { x: number; z: number } {
  let px = x
  let pz = z

  for (let pass = 0; pass < passes; pass++) {
    let moved = false

    for (const rect of colliders) {
      const dx = px - rect.x
      const dz = pz - rect.z
      const overlapX = rect.halfW + radius - Math.abs(dx)
      const overlapZ = rect.halfD + radius - Math.abs(dz)
      if (overlapX <= 0 || overlapZ <= 0) continue

      if (overlapX < overlapZ) {
        px += dx >= 0 ? overlapX : -overlapX
      } else {
        pz += dz >= 0 ? overlapZ : -overlapZ
      }
      moved = true
    }

    if (!moved) break
  }

  return { x: px, z: pz }
}

/** Keeps a position inside the playable square. */
export function clampToCampus(x: number, z: number, limit = CAMPUS_LIMIT) {
  return {
    x: Math.min(limit, Math.max(-limit, x)),
    z: Math.min(limit, Math.max(-limit, z)),
  }
}

export interface NearbyBuilding {
  building: CampusBuilding
  distance: number
}

/**
 * The building whose entrance you are standing at, if any.
 *
 * Measured from the entrance rather than the centre. On a 54-metre facade a
 * centre-based radius either reaches halfway across the quad or refuses to open
 * the door while you are standing on the step.
 */
export function nearestEntrance(
  x: number,
  z: number,
  buildings: CampusBuilding[] = CAMPUS_BUILDINGS,
  reach = 9,
): NearbyBuilding | null {
  let best: NearbyBuilding | null = null

  for (const building of buildings) {
    const [bx, , bz] = building.position
    const doorZ = bz + building.size[2] / 2
    // Clamped to the facade: a wide building has a wide doorstep, not a point.
    const doorX = Math.min(bx + building.size[0] / 2, Math.max(bx - building.size[0] / 2, x))
    const distance = Math.hypot(x - doorX, z - doorZ)
    if (distance <= reach && (!best || distance < best.distance)) {
      best = { building, distance }
    }
  }

  return best
}

/**
 * Where a player starts: on the spine, looking north at the main building.
 *
 * The sightline here is load-bearing, and narrower than it looks. Too close to
 * the quad and the fountain — fifteen metres across — stands directly between
 * the player and the landmark, so the first thing anyone sees on joining is a
 * wall of water. Too far back down the spine and they spawn inside one of the
 * campus dash rings instead. This sits between the two, on the near edge of the
 * quad; `campusLayout.test.ts` holds it there.
 */
export const SPAWN: Vec3 = [0, 1.7, 12]

export type TimeOfDay = 'day' | 'dusk' | 'night'

export interface DaylightConfig {
  sun: Vec3
  intensity: number
  ambient: number
  sky: string
  bounce: string
  tint: string
  fog: string
  fogNear: number
  fogFar: number
  fill: number
  /** Whether the lamps, signs and lit windows are on. */
  lampsOn: boolean
}

/**
 * Lighting presets.
 *
 * Lives here rather than in the scenery components because the landmark needs
 * it too, and importing it from there and back again would be a cycle.
 *
 * `bounce` is the ground half of the hemisphere light. Keep it bright: a brick
 * wall facing away from the sun should still read as brick, not as a
 * silhouette, which is what the old dark-olive value made of it.
 */
export const DAYLIGHT: Record<TimeOfDay, DaylightConfig> = {
  day: {
    sun: [80, 62, 40], intensity: 2.1, ambient: 1.0,
    sky: '#cfe4f7', bounce: '#9e9c8a', tint: '#fff6ea', fog: '#c8dcea',
    fogNear: 110, fogFar: 520, fill: 0.3, lampsOn: false,
  },
  dusk: {
    sun: [60, 12, -70], intensity: 1.5, ambient: 0.7,
    sky: '#a8b9d6', bounce: '#63594a', tint: '#ffb37a', fog: '#c98a6b',
    fogNear: 80, fogFar: 400, fill: 0.22, lampsOn: true,
  },
  night: {
    sun: [-50, 40, -60], intensity: 0.22, ambient: 0.35,
    sky: '#2c3d5c', bounce: '#1a2130', tint: '#9fb6e8', fog: '#1a2434',
    fogNear: 50, fogFar: 300, fill: 0.1, lampsOn: true,
  },
}

export function daylight(timeOfDay: TimeOfDay | string): DaylightConfig {
  // Own properties only. `DAYLIGHT['toString']` is an inherited function, which
  // is not nullish, so a `??` fallback would hand the caller something with no
  // `sun` and no `fog` on it.
  return Object.hasOwn(DAYLIGHT, timeOfDay) ? DAYLIGHT[timeOfDay as TimeOfDay] : DAYLIGHT.day
}
