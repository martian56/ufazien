export interface MovementControl {
  name: string
  keys: string[]
}

export const CAMPUS_KEY_MAP: MovementControl[] = [
  { name: 'forward', keys: ['ArrowUp', 'KeyW'] },
  { name: 'backward', keys: ['ArrowDown', 'KeyS'] },
  { name: 'leftward', keys: ['ArrowLeft', 'KeyA'] },
  { name: 'rightward', keys: ['ArrowRight', 'KeyD'] },
  { name: 'jump', keys: ['Space'] },
  { name: 'run', keys: ['ShiftLeft'] },
  { name: 'interact', keys: ['KeyE'] },
  { name: 'action', keys: ['KeyF'] },
  { name: 'sit', keys: ['KeyC'] },
  { name: 'lean', keys: ['KeyV'] },
  { name: 'grab', keys: ['KeyG'] },
  { name: 'light', keys: ['KeyL'] },
  { name: 'wave', keys: ['Digit1'] },
  { name: 'clap', keys: ['Digit2'] },
  { name: 'raiseHand', keys: ['Digit3'] },
  { name: 'point', keys: ['Digit4'] },
]

export interface KeyBinding {
  action?: string
  keys: string[]
  label: string
  group: KeyGroup
}

export type KeyGroup = 'Moving' | 'Doing' | 'Expressing' | 'Screen'

export const KEY_GROUPS: KeyGroup[] = ['Moving', 'Doing', 'Expressing', 'Screen']

export const KEY_BINDINGS: KeyBinding[] = [
  { action: 'forward', keys: ['W', '↑'], label: 'Walk forward', group: 'Moving' },
  { action: 'backward', keys: ['S', '↓'], label: 'Walk back', group: 'Moving' },
  { action: 'leftward', keys: ['A', '←'], label: 'Step left', group: 'Moving' },
  { action: 'rightward', keys: ['D', '→'], label: 'Step right', group: 'Moving' },
  { action: 'run', keys: ['Shift'], label: 'Run', group: 'Moving' },
  { action: 'jump', keys: ['Space'], label: 'Jump', group: 'Moving' },
  { keys: ['Mouse'], label: 'Look around', group: 'Moving' },

  { action: 'interact', keys: ['E'], label: 'Open a door, use a terminal', group: 'Doing' },
  { action: 'action', keys: ['F'], label: 'Play, and hold to charge a shot', group: 'Doing' },
  { action: 'sit', keys: ['C'], label: 'Sit down, and stand up again', group: 'Doing' },
  { action: 'lean', keys: ['V'], label: 'Lean on a wall', group: 'Doing' },
  { action: 'grab', keys: ['G'], label: 'Pick up, put down, hold to throw', group: 'Doing' },
  { action: 'light', keys: ['L'], label: 'Turn the lights on or off', group: 'Doing' },

  { action: 'wave', keys: ['1'], label: 'Wave', group: 'Expressing' },
  { action: 'clap', keys: ['2'], label: 'Clap', group: 'Expressing' },
  { action: 'raiseHand', keys: ['3'], label: 'Raise your hand', group: 'Expressing' },
  { action: 'point', keys: ['4'], label: 'Point', group: 'Expressing' },

  { keys: ['T'], label: 'Open the chat', group: 'Screen' },
  { keys: ['M'], label: 'Open the map', group: 'Screen' },
  { keys: ['B'], label: 'Mute or unmute yourself', group: 'Screen' },
  { keys: ['P'], label: 'Settings', group: 'Screen' },
  { keys: ['O'], label: 'Full screen', group: 'Screen' },
  { keys: ['Esc'], label: 'Close what is open, release the mouse', group: 'Screen' },
]

export function bindingsIn(group: KeyGroup): KeyBinding[] {
  return KEY_BINDINGS.filter((binding) => binding.group === group)
}

export const HUD_KEYS = {
  chat: 'KeyT',
  map: 'KeyM',
  mute: 'KeyB',
  settings: 'KeyP',
  fullscreen: 'KeyO',
} as const

export type HudAction = keyof typeof HUD_KEYS

export function hudActionFor(code: string): HudAction | null {
  for (const [action, key] of Object.entries(HUD_KEYS)) {
    if (key === code) return action as HudAction
  }
  return null
}
