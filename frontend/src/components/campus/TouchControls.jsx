import { useEffect, useRef, useState } from "react"
import { DoorOpen, Hand } from "lucide-react"

/**
 * Touch controls for phones and tablets.
 *
 * The desktop game is driven by WASD and PointerLockControls, neither of which
 * exists on a touch device, so without this the simulator is unplayable on a
 * phone: you can look at the scene but never move.
 *
 * State is written into a ref shared with the 3D scene rather than React state,
 * because it is read every frame and re-rendering the page 60 times a second to
 * move a camera would be wasteful.
 */

export function createTouchState() {
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

function Joystick({ onChange }) {
  const base = useRef(null)
  const [knob, setKnob] = useState({ x: 0, y: 0 })
  const active = useRef(null)

  const radius = 52

  const handle = (touch) => {
    const rect = base.current.getBoundingClientRect()
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

  const end = () => {
    active.current = null
    setKnob({ x: 0, y: 0 })
    onChange({ x: 0, y: 0 })
  }

  return (
    <div
      ref={base}
      onTouchStart={(e) => {
        active.current = e.changedTouches[0].identifier
        handle(e.changedTouches[0])
      }}
      onTouchMove={(e) => {
        for (const touch of e.changedTouches) {
          if (touch.identifier === active.current) handle(touch)
        }
      }}
      onTouchEnd={end}
      onTouchCancel={end}
      className="relative w-32 h-32 rounded-full bg-white/10 border border-white/25 backdrop-blur-sm touch-none"
      aria-label="Move"
    >
      <div
        className="absolute w-14 h-14 rounded-full bg-white/70 shadow-lg"
        style={{
          left: `calc(50% - 1.75rem + ${knob.x}px)`,
          top: `calc(50% - 1.75rem + ${knob.y}px)`,
        }}
      />
    </div>
  )
}

/** Full-screen pad behind the HUD that turns drags into look deltas. */
function LookArea({ onLook }) {
  const last = useRef(null)

  return (
    <div
      className="absolute inset-0 touch-none"
      onTouchStart={(e) => {
        const t = e.changedTouches[0]
        last.current = { id: t.identifier, x: t.clientX, y: t.clientY }
      }}
      onTouchMove={(e) => {
        for (const t of e.changedTouches) {
          if (!last.current || t.identifier !== last.current.id) continue
          onLook({ dx: t.clientX - last.current.x, dy: t.clientY - last.current.y })
          last.current = { id: t.identifier, x: t.clientX, y: t.clientY }
        }
      }}
      onTouchEnd={() => {
        last.current = null
      }}
      onTouchCancel={() => {
        last.current = null
      }}
    />
  )
}

export default function TouchControls({ stateRef, insideBuilding, canInteract }) {
  return (
    <>
      {/* Sits under the HUD so buttons still receive their own taps. */}
      <div className="absolute inset-0 z-0 pointer-events-auto">
        <LookArea
          onLook={({ dx, dy }) => {
            stateRef.current.look.dx += dx
            stateRef.current.look.dy += dy
          }}
        />
      </div>

      <div className="absolute bottom-6 left-6 z-30 pointer-events-auto">
        <Joystick onChange={(v) => (stateRef.current.move = v)} />
      </div>

      <div className="absolute bottom-6 right-6 z-30 pointer-events-auto flex flex-col gap-3 items-end">
        {(canInteract || insideBuilding) && (
          <button
            onTouchStart={() => (stateRef.current.interact = true)}
            className="w-16 h-16 rounded-full bg-blue-600/90 text-white flex flex-col items-center justify-center shadow-lg active:scale-95"
            aria-label={insideBuilding ? "Leave building" : "Enter building"}
          >
            <DoorOpen className="w-6 h-6" />
            <span className="text-[10px] mt-0.5">{insideBuilding ? "Exit" : "Enter"}</span>
          </button>
        )}

        <button
          onTouchStart={() => (stateRef.current.jump = true)}
          onTouchEnd={() => (stateRef.current.jump = false)}
          className="w-16 h-16 rounded-full bg-white/15 border border-white/25 text-white flex flex-col items-center justify-center backdrop-blur-sm active:scale-95"
          aria-label="Jump"
        >
          <Hand className="w-6 h-6" />
          <span className="text-[10px] mt-0.5">Jump</span>
        </button>
      </div>
    </>
  )
}
