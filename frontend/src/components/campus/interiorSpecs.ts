import type { InteriorKind, Vec3 } from './campusLayout'

/**
 * What each building is like inside.
 *
 * Data only, in its own module rather than alongside the components that draw
 * it: the page needs the projector position and the boundary before it renders
 * anything, and a module that exports both constants and components defeats
 * fast refresh.
 */

export type FloorKind = 'marble' | 'wood' | 'carpet' | 'tile' | 'court' | 'epoxy' | 'encaustic'

export interface InteriorSpec {
  /** The room is 2×halfExtent square. The player is clamped just inside it. */
  halfExtent: number
  ceiling: number
  wall: string
  accent: string
  floor: FloorKind
  /** Where the projector screen hangs, so a screen share lands on a wall. */
  projector: Vec3
  /** Where the player stands on entering. */
  spawn: Vec3
  /**
   * What they are looking at. Rooms default to facing the projector wall,
   * which is right when the room is arranged around it. The amphitheatre is
   * not: entering there on the axis puts a fifteen-metre blank screen across
   * the whole view, and you cannot see the hall you just walked into.
   */
  spawnLookAt?: Vec3
  /**
   * Tints the floor texture.
   *
   * The corridors and the teaching rooms are the same boards as each other and
   * much darker than the library's; without this they all come out the one
   * mid-oak the wood texture ships with.
   */
  floorTint?: string
  /** Light colour and strength, which is most of a room's character. */
  lightColor: string
  lightIntensity: number
  /**
   * Suspended office tiles, an exposed structural deck, or flat plaster. A
   * sixteen-metre sports hall with a tiled ceiling reads as an open-plan
   * office, and so — just as wrongly — did a fourteen-metre heritage hall with
   * columns and a staircase in it.
   */
  ceilingKind?: 'tile' | 'deck' | 'plaster' | 'timber' | 'truss' | 'coffered'
}

export const INTERIOR_SPECS: Record<InteriorKind, InteriorSpec> = {
  // The entrance sequence, from photographs of the finished building: white
  // walls, encaustic cement tile underfoot in a four-pointed star, and a flat
  // white ceiling on suspended square light rings.
  //
  // This has now been wrong twice in opposite directions. It was cream marble
  // and a colonnade — a guess at what a restored 1900s building ought to be,
  // which guessed a palace. Then it was butter yellow with a boarded timber
  // ceiling, off the 2017 opening photographs, which is a different part of the
  // building. The hall you actually walk into is neither: it is white, and very
  // plain, and everything in it is the floor.
  ufaz: {
    halfExtent: 22, ceiling: 9, wall: '#eceef0', accent: '#5a5f66', floor: 'encaustic',
    projector: [0, 5.6, -21.2], spawn: [0, 1.7, 18], lightColor: '#f2f6fa', lightIntensity: 1.2,
    ceilingKind: 'plaster',
  },
  // The upper floors, all three the same. In the real building the corridor on
  // the second floor is the corridor on the third and the fourth: white walls,
  // an arcade of round-headed openings down one side, dark boards underfoot,
  // deep window reveals with a panel radiator under each and framed portraits
  // between them.
  'ufaz-floor': {
    halfExtent: 22, ceiling: 6.2, wall: '#eceef0', accent: '#4a4640', floor: 'wood',
    projector: [0, 4.2, -21.2], spawn: [10.5, 1.7, -5], spawnLookAt: [-2, 2.6, -16],
    lightColor: '#f4f7fa', lightIntensity: 1.1,
    floorTint: '#4b3b31',
    ceilingKind: 'plaster',
  },
  // The library is in the roof, and the roof is the room: a steep pitch with
  // dark steel trusses across a white boarded soffit, conical pendants on long
  // cables between them, and a dark walnut floor. It was cream walls under a
  // flat ceiling, which is a reading room in a different building.
  library: {
    halfExtent: 24, ceiling: 11, wall: '#eef0f2', accent: '#5c6167', floor: 'wood',
    projector: [0, 5.4, -23.2], spawn: [0, 1.7, 18], lightColor: '#eef4fa', lightIntensity: 1.45,
    floorTint: '#463830',
    ceilingKind: 'truss',
  },
  lab: {
    halfExtent: 20, ceiling: 8.5, wall: '#dfe6ea', accent: '#7fa8bd', floor: 'epoxy',
    projector: [0, 5.0, -19.2], spawn: [0, 1.7, 15], lightColor: '#f2fbff', lightIntensity: 1.3,
  },
  // White walls, a wood floor and a dark beamed ceiling, which is what UFAZ's
  // teaching rooms are. It was beige walls over a dark blue carpet — a hotel
  // conference suite, not a classroom in a restored Baku townhouse.
  lecture: {
    halfExtent: 22, ceiling: 12, wall: '#edeeec', accent: '#4a4640', floor: 'wood',
    projector: [0, 6.2, -21.2], spawn: [-11, 1.7, -10], spawnLookAt: [3, 4.5, -19],
    lightColor: '#fff6e8', lightIntensity: 0.95,
    floorTint: '#4e3b2e',
    // A flat dark grid over white panels with linear tubes in it. This was
    // briefly trusses, which is the library's roof applied to the wrong room:
    // the conference hall's ceiling is flat and coffered, and the photographs
    // are unambiguous about it.
    ceilingKind: 'coffered',
  },
  'student-center': {
    halfExtent: 22, ceiling: 10, wall: '#e6ebee', accent: '#3f8f7f', floor: 'carpet',
    projector: [0, 5.2, -21.2], spawn: [0, 1.7, 17], lightColor: '#fff2e0', lightIntensity: 1.05,
  },
  cafeteria: {
    halfExtent: 20, ceiling: 8, wall: '#efe2d2', accent: '#c2703f', floor: 'tile',
    projector: [0, 4.8, -19.2], spawn: [0, 1.7, 15], lightColor: '#fff0d4', lightIntensity: 1.1,
  },
  sports: {
    halfExtent: 26, ceiling: 16, wall: '#dfe3e7', accent: '#c25b3f', floor: 'court',
    projector: [0, 7.0, -25.2], spawn: [0, 1.7, 20], lightColor: '#f4f8ff', lightIntensity: 1.35,
    ceilingKind: 'deck',
  },
}

/** How far from the centre the player may walk inside a given building. */
export function interiorHalfExtent(kind: InteriorKind | undefined): number {
  const spec = kind ? INTERIOR_SPECS[kind] : INTERIOR_SPECS.lecture
  return spec.halfExtent - 1.5
}
