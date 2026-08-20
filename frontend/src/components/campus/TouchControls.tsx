import { useCallback, useEffect, useRef, useState } from "react"
import {
  DoorOpen,
  ChevronsUp,
  Armchair,
  Hand,
  Lightbulb,
  MoreHorizontal,
  PersonStanding,
  X,
} from "lucide-react"

import type React from "react"

import {
  createTouchActions,
  isRunning,
  type EmoteControl,
  type TouchActions,
} from "./touchActions"

/**
 * The shared control state the campus reads each frame.
 *
 * `look` accumulates swipe deltas and is drained by the player controller;
 * `move` is the joystick's current offset. The rest are the same held/not-held
 * booleans a keyboard produces, so the controllers can read one merged object
 * and never ask which surface a press came from — see `touchActions.ts`.
 */
export interface TouchState extends TouchActions {
  move: { x: number; y: number }
  look: { dx: number; dy: number }
}

/** What the player can do right here, so a button only appears when it works. */
export interface TouchContext {
  insideBuilding: { name: string } | null
  canInteract: boolean
  /** A chair within reach, or the one they are already in. */
  canSit: boolean
  seated: boolean
  /** Something within reach to pick up, or something already in their hands. */
  canGrab: boolean
  holding: boolean
  leaning: boolean
}

interface TouchControlsProps {
  stateRef: React.MutableRefObject<TouchState>
  context: TouchContext
}

export function createTouchState(): TouchState {
  return {
    ...createTouchActions(),
    move: { x: 0, y: 0 }, // -1..1, y is forward
    look: { dx: 0, dy: 0 }, // consumed each frame
  }
}

/** Detects a touch-primary device rather than a small window. */
export function useIsTouchDevice() {
  const [isTouch, setIsTouch] = useState(false)
  useEffect(() => {
    const query = window.matchMedia("(pointer: coarse)")
    const update = () => setIsTouch(query.matches)
    update()
    query.addEventListener?.("change", update)
    return () => query.removeEventListener?.("change", update)
  }, [])
  return isTouch
}

/**
 * Swipe on the 3D view to look around.
 *
 * Bound to the window rather than an overlay div: the canvas comes later in the
 * DOM so it paints above any HUD layer and swallows the touches first, which
 * left the player unable to turn at all. A swipe only counts if it started on
 * the canvas, so the joystick and the HUD buttons keep their own touches.
 */
function useWorldLook(stateRef: React.MutableRefObject<TouchState>) {
  useEffect(() => {
    // Track by identifier so a second finger on the stick cannot hijack the
    // one that is turning the camera.
    let lookId: number | null = null
    let lastX = 0
    let lastY = 0

    const start = (e: TouchEvent) => {
      if (lookId !== null) return
      const target = e.target
      if (!(target instanceof Element) || !target.closest("#campus-canvas")) return
      const t = e.changedTouches[0]
      lookId = t.identifier
      lastX = t.clientX
      lastY = t.clientY
    }

    const move = (e: TouchEvent) => {
      if (lookId === null) return
      for (const t of Array.from(e.changedTouches)) {
        if (t.identifier !== lookId) continue
        stateRef.current.look.dx += t.clientX - lastX
        stateRef.current.look.dy += t.clientY - lastY
        lastX = t.clientX
        lastY = t.clientY
        // Stop the browser panning the page mid-swipe.
        if (e.cancelable) e.preventDefault()
      }
    }

    const end = (e: TouchEvent) => {
      for (const t of Array.from(e.changedTouches)) {
        if (t.identifier === lookId) lookId = null
      }
    }

    window.addEventListener("touchstart", start, { passive: true })
    window.addEventListener("touchmove", move, { passive: false })
    window.addEventListener("touchend", end, { passive: true })
    window.addEventListener("touchcancel", end, { passive: true })
    return () => {
      window.removeEventListener("touchstart", start)
      window.removeEventListener("touchmove", move)
      window.removeEventListener("touchend", end)
      window.removeEventListener("touchcancel", end)
    }
  }, [stateRef])
}

function Joystick({ onChange }: { onChange: (offset: { x: number; y: number }) => void }) {
  const base = useRef<HTMLDivElement>(null)
  const [knob, setKnob] = useState({ x: 0, y: 0 })
  const active = useRef<number | null>(null)
  const radius = 46

  const handle = (touch: React.Touch) => {
    const rect = base.current?.getBoundingClientRect()
    if (!rect) return
    const cx = rect.left + rect.width / 2
    const cy = rect.top + rect.height / 2
    let dx = touch.clientX - cx
    let dy = touch.clientY - cy
    const distance = Math.hypot(dx, dy)
    if (distance > radius) {
      dx = (dx / distance) * radius
      dy = (dy / distance) * radius
    }
    setKnob({ x: dx, y: dy })
    // Screen y grows downwards; forward is negative y.
    onChange({ x: dx / radius, y: -dy / radius })
  }

  const release = () => {
    active.current = null
    setKnob({ x: 0, y: 0 })
    onChange({ x: 0, y: 0 })
  }

  return (
    <div
      ref={base}
      onTouchStart={(e) => {
        e.stopPropagation()
        active.current = e.changedTouches[0].identifier
        handle(e.changedTouches[0])
      }}
      onTouchMove={(e) => {
        e.stopPropagation()
        for (const touch of Array.from(e.changedTouches)) {
          if (touch.identifier === active.current) handle(touch)
        }
      }}
      onTouchEnd={release}
      onTouchCancel={release}
      className="relative w-28 h-28 rounded-full bg-white/10 border border-white/25 backdrop-blur-sm touch-none"
      aria-label="Move"
    >
      <div
        className="absolute w-12 h-12 rounded-full bg-white/70 shadow-lg"
        style={{
          left: `calc(50% - 1.5rem + ${knob.x}px)`,
          top: `calc(50% - 1.5rem + ${knob.y}px)`,
        }}
      />
    </div>
  )
}

/**
 * A button that holds while the thumb is on it.
 *
 * Press and release, because every controller in the campus is edge-triggered:
 * it acts on the frame a control goes down and compares against the frame
 * before. A press that only ever set the flag would fire once and then read as
 * held for ever — which is exactly what the door button did, so entering a
 * building worked once and the button was dead until the controls remounted.
 *
 * `onPointerDown` rather than `onTouchStart` so the same button answers a
 * stylus and a mouse; a phone is the reason it exists but not the only thing
 * that can press it.
 */
function HoldButton({
  onHold,
  label,
  hint,
  icon,
  tone = 'bg-white/15 border-white/25',
  className = '',
}: {
  onHold: (held: boolean) => void
  label: string
  hint?: string
  icon: React.ReactNode
  tone?: string
  className?: string
}) {
  // Released on the window as well as on the button: a thumb that slides off
  // before lifting never sends the button its own pointerup, and the control
  // would stay down.
  const holding = useRef(false)
  // Through a ref, so the listener below can be bound once and still call the
  // current handler rather than the one from the first render.
  const onHoldRef = useRef(onHold)
  onHoldRef.current = onHold
  const release = useCallback(() => {
    if (!holding.current) return
    holding.current = false
    onHoldRef.current(false)
  }, [])

  // Bound once. With no dependency array this ran its cleanup on every render,
  // and the cleanup releases — so any re-render while a thumb was down let the
  // control go. Everything around these buttons re-renders as the player moves,
  // which would have cancelled a throw part-way through charging it.
  useEffect(() => {
    window.addEventListener('pointerup', release)
    window.addEventListener('pointercancel', release)
    return () => {
      window.removeEventListener('pointerup', release)
      window.removeEventListener('pointercancel', release)
      // Unmounting mid-press — walking out of range of the thing the button
      // acts on — must not leave it held.
      release()
    }
  }, [release])

  return (
    <button
      onPointerDown={(e) => {
        e.stopPropagation()
        e.preventDefault()
        holding.current = true
        onHoldRef.current(true)
      }}
      onPointerUp={release}
      onPointerCancel={release}
      onPointerLeave={release}
      className={`flex h-14 w-14 flex-col items-center justify-center rounded-full border text-white shadow-lg backdrop-blur-sm transition active:scale-95 ${tone} ${className}`}
      aria-label={hint ? `${label}. ${hint}` : label}
    >
      {icon}
      <span className="mt-0.5 text-[10px] leading-none">{label}</span>
    </button>
  )
}

/** The emotes, in the order the keyboard numbers them. */
const EMOTE_BUTTONS: { control: EmoteControl; label: string; face: string }[] = [
  { control: 'wave', label: 'Wave', face: '👋' },
  { control: 'clap', label: 'Clap', face: '👏' },
  { control: 'raiseHand', label: 'Raise hand', face: '✋' },
  { control: 'point', label: 'Point', face: '👉' },
]

/**
 * Everything that is not a one-tap action, behind one button.
 *
 * Emotes, leaning and the lights are four, one and one more control; laid out
 * as buttons they fill a phone screen with things nobody is about to press.
 * Shut by default, so the campus is what you see and the controls are what you
 * reach for.
 */
function MoreSheet({
  stateRef,
  context,
  onClose,
}: {
  stateRef: React.MutableRefObject<TouchState>
  context: TouchContext
  onClose: () => void
}) {
  // An emote is a moment rather than a posture, so it is pressed for the
  // player: held long enough for the frame loop to see the rising edge, then
  // released. Holding it under a thumb would have the avatar wave until they
  // let go, and the pose already releases itself.
  const play = (control: EmoteControl) => {
    stateRef.current.emote = control
    window.setTimeout(() => {
      if (stateRef.current.emote === control) stateRef.current.emote = ''
    }, EMOTE_PRESS_MS)
    onClose()
  }

  return (
    <div className="pointer-events-auto absolute bottom-24 right-4 z-40 w-[min(15rem,72vw)] rounded-2xl border border-white/15 bg-slate-950/90 p-3 shadow-2xl shadow-black/60 backdrop-blur">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[11px] uppercase tracking-wide text-slate-400">Express</span>
        <button
          onClick={onClose}
          aria-label="Close"
          className="rounded-md p-1 text-slate-400 transition hover:text-white"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-1.5">
        {EMOTE_BUTTONS.map((emote) => (
          <button
            key={emote.control}
            onClick={() => play(emote.control)}
            className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-2 py-2 text-left text-xs text-white transition active:scale-95"
          >
            <span aria-hidden className="text-base leading-none">{emote.face}</span>
            {emote.label}
          </button>
        ))}
      </div>

      {/* Postures and the room, which are held rather than played. */}
      <div className="mt-2 grid gap-1.5 border-t border-white/10 pt-2">
        <HoldRow
          stateRef={stateRef}
          field="lean"
          icon={<PersonStanding className="h-4 w-4 text-slate-300" />}
          label={context.leaning ? 'Stand up straight' : 'Lean on a wall'}
          onDone={onClose}
        />
        {context.insideBuilding && (
          <HoldRow
            stateRef={stateRef}
            field="light"
            icon={<Lightbulb className="h-4 w-4 text-amber-300" />}
            label="Turn the lights on or off"
            onDone={onClose}
          />
        )}
      </div>
    </div>
  )
}

/** A row in the sheet that presses one control the way a key press does. */
function HoldRow({
  stateRef,
  field,
  icon,
  label,
  onDone,
}: {
  stateRef: React.MutableRefObject<TouchState>
  field: 'lean' | 'light'
  icon: React.ReactNode
  label: string
  onDone: () => void
}) {
  return (
    <button
      onClick={() => {
        stateRef.current[field] = true
        window.setTimeout(() => {
          stateRef.current[field] = false
        }, EMOTE_PRESS_MS)
        onDone()
      }}
      className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-2 py-2 text-left text-xs text-white transition active:scale-95"
    >
      {icon}
      {label}
    </button>
  )
}

/**
 * How long a tapped control is held down for, in milliseconds.
 *
 * Long enough that the frame loop cannot miss the rising edge — a tap can
 * start and finish inside one frame at 60fps, and a press nobody saw is a
 * button that does nothing every so often.
 */
export const EMOTE_PRESS_MS = 120

export default function TouchControls({ stateRef, context }: TouchControlsProps) {
  useWorldLook(stateRef)
  const [moreOpen, setMoreOpen] = useState(false)
  const { insideBuilding, canInteract, canSit, seated, canGrab, holding } = context

  // Unmounting mid-drag, which is what opening chat does, would otherwise
  // leave the last vector in the shared state and the player walking on alone.
  useEffect(
    () => () => {
      Object.assign(stateRef.current, createTouchState())
    },
    [stateRef],
  )

  const hold = (field: keyof TouchActions) => (held: boolean) => {
    // `emote` is a name rather than a flag, and nothing here holds one.
    if (field === 'emote') return
    stateRef.current[field] = held
  }

  return (
    <>
      <div className="absolute bottom-5 left-5 z-30 pointer-events-auto">
        <Joystick
          onChange={(v) => {
            stateRef.current.move = v
            // Running has no modifier under a thumb: the stick says it.
            stateRef.current.run = isRunning(v)
          }}
        />
      </div>

      {moreOpen && (
        <MoreSheet stateRef={stateRef} context={context} onClose={() => setMoreOpen(false)} />
      )}

      <div className="absolute bottom-5 right-5 z-30 flex flex-col items-end gap-2.5 pointer-events-auto">
        {/* Contextual, so the screen carries what you can actually do here
            rather than every control the campus has. */}
        {canGrab && (
          <HoldButton
            onHold={hold('grab')}
            label={holding ? 'Throw' : 'Pick up'}
            hint={holding ? 'Hold to throw further, let go to drop' : undefined}
            icon={<Hand className="h-5 w-5" />}
            tone="bg-amber-600/85 border-amber-300/40"
          />
        )}

        {canSit && (
          <HoldButton
            onHold={hold('sit')}
            label={seated ? 'Stand' : 'Sit'}
            icon={<Armchair className="h-5 w-5" />}
            tone="bg-emerald-600/85 border-emerald-300/40"
          />
        )}

        {(canInteract || insideBuilding) && (
          <HoldButton
            onHold={hold('interact')}
            label={insideBuilding ? 'Exit' : 'Enter'}
            icon={<DoorOpen className="h-5 w-5" />}
            tone="bg-blue-600/90 border-blue-300/40"
          />
        )}

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setMoreOpen((open) => !open)}
            aria-label="Emotes and more"
            aria-expanded={moreOpen}
            className={`flex h-14 w-14 flex-col items-center justify-center rounded-full border text-white shadow-lg backdrop-blur-sm transition active:scale-95 ${
              moreOpen ? 'border-blue-300/50 bg-blue-600/80' : 'border-white/25 bg-white/15'
            }`}
          >
            <MoreHorizontal className="h-5 w-5" />
            <span className="mt-0.5 text-[10px] leading-none">More</span>
          </button>

          <HoldButton onHold={hold('jump')} label="Jump" icon={<ChevronsUp className="h-5 w-5" />} />
        </div>
      </div>
    </>
  )
}
