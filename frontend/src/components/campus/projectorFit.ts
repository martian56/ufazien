/**
 * How the projector screen sizes itself to the room it hangs in.
 *
 * Its own module rather than living beside the component, so the page and the
 * tests can reach it without importing a React component, and so fast refresh
 * still works for the screen itself.
 */

const MAX_WIDTH = 16
const MAX_HEIGHT = 8.4

/** Clearance kept between the screen and the ceiling, and the floor. */
const HEAD_ROOM = 0.7
const FOOT_ROOM = 0.4
/** How far below the ceiling the projector itself hangs. */
const MOUNT_DROP = 0.9
/** Where the projector hangs when the room is tall enough to allow it. */
const PREFERRED_MOUNT = 8.7

/**
 * How big the screen can be in a given room.
 *
 * Rooms are not all the same height. The cafeteria's ceiling is at 8 and the
 * sports hall's at 16, and a fixed 8.4-metre screen hung at a fixed height
 * pushed both the picture and its ceiling mount straight through the cafeteria
 * and laboratory ceilings. Pure, and tested, because the failure is invisible
 * until somebody walks into that particular room during a presentation.
 */
export function fitProjector(
  aspect: number,
  centreHeight: number,
  ceiling: number,
): { width: number; height: number; mount: number } {
  const budget = Math.max(
    1,
    Math.min(
      MAX_HEIGHT,
      // Room above the screen's centre, doubled because the centre is the middle.
      (ceiling - HEAD_ROOM - centreHeight) * 2,
      (centreHeight - FOOT_ROOM) * 2,
    ),
  )
  // A safe aspect, so a video that reports 0×0 cannot produce a NaN screen.
  const safeAspect = Number.isFinite(aspect) && aspect > 0 ? aspect : 16 / 9
  const width = Math.min(MAX_WIDTH, budget * safeAspect)

  return {
    width,
    height: width / safeAspect,
    mount: Math.min(PREFERRED_MOUNT, ceiling - MOUNT_DROP),
  }
}
