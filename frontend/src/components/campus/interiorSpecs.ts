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
  /** Where the player stands on entering, and which way they face. */
  spawn: Vec3
  /** Light colour and strength, which is most of a room's character. */
  lightColor: string
  lightIntensity: number
  /**
   * Suspended office tiles, or an exposed structural deck. A sixteen-metre
   * sports hall with a tiled ceiling reads as an open-plan office.
   */
  ceilingKind?: 'tile' | 'deck'
}

export const INTERIOR_SPECS: Record<InteriorKind, InteriorSpec> = {
  ufaz: {
    halfExtent: 22, ceiling: 14, wall: '#e5dcc8', accent: '#b99a5c', floor: 'marble',
    projector: [0, 6.4, -21.2], spawn: [0, 1.7, 16], lightColor: '#fff3dc', lightIntensity: 1.1,
  },
  library: {
    halfExtent: 24, ceiling: 11, wall: '#e0d4bd', accent: '#6d4f32', floor: 'wood',
    projector: [0, 5.4, -23.2], spawn: [0, 1.7, 18], lightColor: '#ffe9c4', lightIntensity: 0.85,
  },
  lab: {
    halfExtent: 20, ceiling: 8.5, wall: '#dfe6ea', accent: '#7fa8bd', floor: 'epoxy',
    projector: [0, 5.0, -19.2], spawn: [0, 1.7, 15], lightColor: '#f2fbff', lightIntensity: 1.3,
  },
  lecture: {
    halfExtent: 22, ceiling: 12, wall: '#d8d2c4', accent: '#3f4a5c', floor: 'carpet',
    projector: [0, 6.2, -21.2], spawn: [0, 1.7, 17], lightColor: '#fff6e8', lightIntensity: 0.9,
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
