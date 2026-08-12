import type { InteriorKind, Vec3 } from './campusLayout'

/**
 * What each building is like inside.
 *
 * Data only, in its own module rather than alongside the components that draw
 * it: the page needs the projector position and the boundary before it renders
 * anything, and a module that exports both constants and components defeats
 * fast refresh.
 */

export type FloorKind = 'marble' | 'wood' | 'carpet' | 'tile' | 'court' | 'epoxy'

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
  /** Light colour and strength, which is most of a room's character. */
  lightColor: string
  lightIntensity: number
  /**
   * Suspended office tiles, an exposed structural deck, or flat plaster. A
   * sixteen-metre sports hall with a tiled ceiling reads as an open-plan
   * office, and so — just as wrongly — did a fourteen-metre heritage hall with
   * columns and a staircase in it.
   */
  ceilingKind?: 'tile' | 'deck' | 'plaster' | 'timber'
  /**
   * An opening in the ceiling, in room coordinates.
   *
   * The landmark is built round an internal courtyard, so its "room" is a
   * gallery on four sides of an open court rather than a sealed box. Set this
   * and the ceiling is drawn as a ring with sky over the hole.
   */
  courtyard?: { x: number; z: number; half: number }
}

export const INTERIOR_SPECS: Record<InteriorKind, InteriorSpec> = {
  // Butter yellow walls, a boarded timber ceiling and a patterned tile floor.
  // This was cream-grey render, cream marble and a suspended office ceiling,
  // which was a guess at what a restored 1900s building ought to look like. The
  // Ministry of Education's photographs of the opening show what it does look
  // like, and it is warmer and plainer than the guess: yellow distemper, honey
  // pine boards overhead on dark pendants, encaustic tile underfoot, and a deep
  // grey-brown skirting running round it all.
  ufaz: {
    halfExtent: 22, ceiling: 14, wall: '#f0dda6', accent: '#5b5147', floor: 'tile',
    projector: [0, 6.4, -21.2], spawn: [0, 1.7, 16], lightColor: '#ffeec4', lightIntensity: 1.15,
    ceilingKind: 'timber',
    courtyard: { x: -3, z: -5, half: 8 },
  },
  library: {
    halfExtent: 24, ceiling: 11, wall: '#e0d4bd', accent: '#6d4f32', floor: 'wood',
    projector: [0, 5.4, -23.2], spawn: [0, 1.7, 18], lightColor: '#ffe9c4', lightIntensity: 0.85,
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
    ceilingKind: 'timber',
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
