import { useEffect, useRef, useState } from "react"
import { DoorOpen, ChevronsUp } from "lucide-react"

import type React from "react"

/**
 * The shared control state the campus reads each frame.
 *
 * look accumulates swipe deltas and is drained by the player controller;
 * move is the joystick's current offset.
 */
export interface TouchState {
  move: { x: number; y: number }
  look: { dx: number; dy: number }
  jump: boolean
  interact: boolean
}

interface TouchControlsProps {
  stateRef: React.MutableRefObject<TouchState>
  insideBuilding: { name: string } | null
  canInteract: boolean
}


/**
 * Touch controls for phones and tablets.
 *
 * Movement and looking are written into a ref shared with the 3D scene rather
 * than React state, because they are read every frame.
 */

/** The shared mutable state the on-screen joystick writes and Player reads. */
export interface TouchState {
  move: { x: number; y: number }
  look: { dx: number; dy: number }
  jump: boolean
  interact: boolean
}

export function createTouchState(): TouchState {
  return {
    move: { x: 0, y: 0 }, // -1..1, y is forward
    look: { dx: 0, dy: 0 }, // consumed each frame
    jump: false,
    interact: false,
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

export default function TouchControls({ stateRef, insideBuilding, canInteract }: TouchControlsProps) {
  useWorldLook(stateRef)

  // Unmounting mid-drag, which is what opening chat does, would otherwise
  // leave the last vector in the shared state and the player walking on alone.
  useEffect(
    () => () => {
      stateRef.current.move = { x: 0, y: 0 }
      stateRef.current.look = { dx: 0, dy: 0 }
      stateRef.current.jump = false
      stateRef.current.interact = false
    },
    [stateRef],
  )

  return (
    <>
      <div className="absolute bottom-5 left-5 z-30 pointer-events-auto">
        <Joystick onChange={(v) => (stateRef.current.move = v)} />
      </div>

      <div className="absolute bottom-5 right-5 z-30 pointer-events-auto flex flex-col gap-2.5 items-end">
        {(canInteract || insideBuilding) && (
          <button
            onTouchStart={(e) => {
              e.stopPropagation()
              stateRef.current.interact = true
            }}
            className="w-14 h-14 rounded-full bg-blue-600/90 text-white flex flex-col items-center justify-center shadow-lg active:scale-95"
            aria-label={insideBuilding ? "Leave building" : "Enter building"}
          >
            <DoorOpen className="w-5 h-5" />
            <span className="text-[10px] mt-0.5">{insideBuilding ? "Exit" : "Enter"}</span>
          </button>
        )}

        <button
          onTouchStart={(e) => {
            e.stopPropagation()
            stateRef.current.jump = true
          }}
          onTouchEnd={() => (stateRef.current.jump = false)}
          className="w-14 h-14 rounded-full bg-white/15 border border-white/25 text-white flex flex-col items-center justify-center backdrop-blur-sm active:scale-95"
          aria-label="Jump"
        >
          <ChevronsUp className="w-5 h-5" />
          <span className="text-[10px] mt-0.5">Jump</span>
        </button>
      </div>
    </>
  )
}
