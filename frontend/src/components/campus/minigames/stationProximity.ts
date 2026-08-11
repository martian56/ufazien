import type { MinigameId } from './minigameLogic'

/**
 * Which mini-game stations the player is currently standing at.
 *
 * A plain mutable set, written by the stations from inside the render loop and
 * sampled by the HUD a few times a second. It is deliberately not React state:
 * the stations test the player's distance every frame, and turning that into a
 * state update would re-render the page continuously as you walk across the
 * campus — which is exactly the kind of thing that made the old version stutter.
 */
export const NEARBY_STATIONS = new Set<MinigameId>()
