/**
 * One set of controls, whichever hand is on them.
 *
 * The campus was built keyboard-first: every controller reads drei's
 * `useKeyboardControls`, and the touch layer only ever wrote movement, jump and
 * the door. So sitting down, leaning, picking things up, the light switch and
 * all four emotes existed on a keyboard and nowhere else — on a phone the
 * campus was somewhere you could walk around and nothing more.
 *
 * Rather than teach each controller about touch, the two are merged into one
 * object with the same shape drei returns. A controller keeps reading
 * `controls.sit` and does not care which surface said so.
 */

/** The four emote controls, in the order the keyboard numbers them. */
export const EMOTE_CONTROLS = ['wave', 'clap', 'raiseHand', 'point'] as const

export type EmoteControl = (typeof EMOTE_CONTROLS)[number]

/**
 * The actions a touch surface can hold down.
 *
 * Every one is a plain held/not-held boolean, the same thing a key is, because
 * the controllers are edge-triggered: they compare this frame against last and
 * act on the rising edge. A press that set a flag and never cleared it would
 * fire once and then read as held for ever — which is what the door button
 * did, leaving it dead after the first tap.
 */
export interface TouchActions {
  run: boolean
  jump: boolean
  interact: boolean
  sit: boolean
  lean: boolean
  grab: boolean
  light: boolean
  action: boolean
  /** The emote being held, or '' for none. One at a time, like the keys. */
  emote: EmoteControl | ''
}

export function createTouchActions(): TouchActions {
  return {
    run: false,
    jump: false,
    interact: false,
    sit: false,
    lean: false,
    grab: false,
    light: false,
    action: false,
    emote: '',
  }
}

/** What drei hands back: a name-to-held map, with movement in it too. */
export type Controls = Record<string, boolean>

/**
 * Keyboard and touch as one.
 *
 * Held on either counts as held, so a keyboard is never taken away from
 * somebody using a tablet with one attached, and neither surface can release
 * something the other is still holding.
 *
 * Movement is deliberately absent: the joystick writes a vector rather than
 * four booleans, and the player controller reads it directly.
 */
export function mergeTouch(keys: Controls, touch?: TouchActions | null): Controls {
  if (!touch) return keys

  const merged: Controls = { ...keys }
  merged.run = Boolean(keys.run) || touch.run
  merged.jump = Boolean(keys.jump) || touch.jump
  merged.interact = Boolean(keys.interact) || touch.interact
  merged.sit = Boolean(keys.sit) || touch.sit
  merged.lean = Boolean(keys.lean) || touch.lean
  merged.grab = Boolean(keys.grab) || touch.grab
  merged.light = Boolean(keys.light) || touch.light
  merged.action = Boolean(keys.action) || touch.action

  for (const emote of EMOTE_CONTROLS) {
    merged[emote] = Boolean(keys[emote]) || touch.emote === emote
  }

  return merged
}

/**
 * Whether the joystick is pushed far enough over to be running.
 *
 * Running is a modifier key on a keyboard and there is no such thing under a
 * thumb, so the stick itself says: walk near the middle, run at the edge. It
 * costs no screen space, which a phone has none of, and it is what every game
 * with a stick already does.
 *
 * The threshold sits below the edge rather than at it, because a thumb pushed
 * "all the way" lands short of the rim about as often as not.
 */
export const RUN_DEFLECTION = 0.85

export function isRunning(move: { x: number; y: number }): boolean {
  return Math.hypot(move.x, move.y) >= RUN_DEFLECTION
}
