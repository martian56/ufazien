/**
 * The calculator terminal in the library.
 *
 * A desk you walk up to and press E at. The panel it opens is DOM rather than
 * geometry, for the same reason the door prompts are: while the pointer is
 * locked for mouse-look — the normal way to play — a click in the world never
 * lands on anything.
 *
 * It answers "where am I", not "plan my degree". Somebody who wants the second
 * should use the real calculator, which this links to.
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { useKeyboardControls } from '@react-three/drei'

import { bandFor, gradePointFor, weightedAverage, type GradeRow } from '../../features/gpa/quickAverage'
import { LIBRARY_TERMINAL } from './interiorPhysics'

/**
 * Where the terminal stands, and how close you must be to use it.
 *
 * Taken from the physics module rather than declared twice: the desk you can
 * see and the box you cannot walk through have to be the same object, and two
 * copies of a coordinate is how they stop being.
 */
export const TERMINAL_POSITION: [number, number, number] = [
  LIBRARY_TERMINAL[0],
  0,
  LIBRARY_TERMINAL[1],
]
export const TERMINAL_REACH = 2.6

/** The desk, the housing and the screen. */
export function LibraryTerminalDesk({ awake }: { awake: boolean }) {
  const [x, , z] = TERMINAL_POSITION

  return (
    <group position={[x, 0, z]} rotation={[0, Math.PI / 2, 0]}>
      {/* Desk */}
      <mesh position={[0, 0.72, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.6, 0.08, 0.7]} />
        <meshStandardMaterial color="#6d4f32" roughness={0.7} />
      </mesh>
      {[-0.7, 0.7].map((side) => (
        <mesh key={side} position={[side, 0.36, 0]} castShadow>
          <boxGeometry args={[0.1, 0.72, 0.6]} />
          <meshStandardMaterial color="#59402a" roughness={0.8} />
        </mesh>
      ))}

      {/* Housing */}
      <mesh position={[0, 0.86, -0.1]} castShadow>
        <boxGeometry args={[0.62, 0.2, 0.42]} />
        <meshStandardMaterial color="#2b3038" roughness={0.6} metalness={0.2} />
      </mesh>
      {/* Screen, tilted back the way a monitor on a desk is. */}
      <group position={[0, 1.24, -0.16]} rotation={[-0.18, 0, 0]}>
        <mesh castShadow>
          <boxGeometry args={[0.84, 0.56, 0.05]} />
          <meshStandardMaterial color="#20252c" roughness={0.5} metalness={0.3} />
        </mesh>
        <mesh position={[0, 0, 0.031]}>
          <planeGeometry args={[0.76, 0.48]} />
          <meshStandardMaterial
            color={awake ? '#123047' : '#0c1016'}
            emissive={awake ? '#3f9fd8' : '#16324a'}
            // Bright when somebody is standing at it, a dim standby glow
            // otherwise — which is what makes it findable in a dark library.
            emissiveIntensity={awake ? 1.5 : 0.35}
            toneMapped={false}
          />
        </mesh>
      </group>
      <mesh position={[0, 1.0, -0.16]}>
        <boxGeometry args={[0.1, 0.36, 0.06]} />
        <meshStandardMaterial color="#20252c" roughness={0.6} />
      </mesh>
    </group>
  )
}

/**
 * Watches for the player standing at the desk.
 *
 * A ref-free callback rather than state per frame: `onNear` is only called
 * when the answer changes, so walking past the desk does not re-render the
 * page sixty times.
 */
export function LibraryTerminalSensor({
  onNear,
  active,
}: {
  onNear: (near: boolean) => void
  active: boolean
}) {
  const { camera } = useThree()
  const near = useRef(false)

  useFrame(() => {
    if (!active) return
    const [x, , z] = TERMINAL_POSITION
    const within = Math.hypot(camera.position.x - x, camera.position.z - z) <= TERMINAL_REACH
    if (within !== near.current) {
      near.current = within
      onNear(within)
    }
  })

  return null
}

/** Reads E while the player is standing at the desk. */
export function LibraryTerminalKey({
  enabled,
  onOpen,
}: {
  enabled: boolean
  onOpen: () => void
}) {
  const [, get] = useKeyboardControls()
  const wasPressed = useRef(false)

  useFrame(() => {
    const pressed = Boolean(get().interact)
    if (pressed && !wasPressed.current && enabled) onOpen()
    wasPressed.current = pressed
  })

  return null
}

/**
 * The shape `/gpa/statistics/` answers with.
 *
 * Every field optional, because the endpoint returns a `message` and nothing
 * else for a student with no records yet — which is most students the first
 * time they walk up to this desk.
 */
export interface TerminalStatistics {
  message?: string
  statistics?: {
    highest_gpa?: number
    lowest_gpa?: number
    average_gpa?: number
    total_calculations?: number
    total_credits?: number
  }
}

const BLANK: GradeRow[] = [
  { mark: Number.NaN, credits: 6 },
  { mark: Number.NaN, credits: 6 },
  { mark: Number.NaN, credits: 3 },
]

/**
 * The panel.
 *
 * Two halves: what the platform already knows about this student, and a scratch
 * pad for the semester they are in the middle of.
 */
export function LibraryTerminalPanel({
  statistics,
  loading,
  error,
  onClose,
  onOpenCalculator,
}: {
  statistics: TerminalStatistics | null
  loading: boolean
  error: string | null
  onClose: () => void
  onOpenCalculator: () => void
}) {
  const [rows, setRows] = useState<GradeRow[]>(BLANK)

  // Escape closes it. Without this the only way out is the button, and the
  // pointer is unlocked while the panel is open so the habit is to press Esc.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const average = useMemo(() => weightedAverage(rows), [rows])
  const point = useMemo(() => gradePointFor(rows), [rows])
  const band = average === null ? null : bandFor(average)

  const update = (index: number, field: 'mark' | 'credits', value: string) => {
    setRows((prev) =>
      prev.map((row, i) =>
        i === index ? { ...row, [field]: value === '' ? Number.NaN : Number(value) } : row,
      ),
    )
  }

  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/60 backdrop-blur-sm pointer-events-auto p-4">
      <div className="bg-[#0f141b] border border-sky-500/30 rounded-2xl w-[min(34rem,94vw)] max-h-[86vh] overflow-y-auto text-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 px-5 py-4 border-b border-white/10">
          <div>
            <h3 className="font-bold text-sky-300">Library terminal</h3>
            <p className="text-xs text-gray-400">Your record, and a scratch pad</p>
          </div>
          <button
            onClick={onClose}
            className="text-xs text-gray-300 hover:text-white bg-white/10 hover:bg-white/20 rounded-lg px-2.5 py-1"
          >
            Close
          </button>
        </div>

        <div className="px-5 py-4 border-b border-white/10">
          <div className="text-[11px] uppercase tracking-wide text-sky-300/70 mb-2">On record</div>
          {loading ? (
            <p className="text-sm text-gray-400">Reading your record…</p>
          ) : error ? (
            <p className="text-sm text-amber-300">{error}</p>
          ) : statistics?.statistics ? (
            <div className="grid grid-cols-3 gap-3">
              <Stat label="Average GPA" value={formatPoint(statistics.statistics.average_gpa)} />
              <Stat label="Best semester" value={formatPoint(statistics.statistics.highest_gpa)} />
              <Stat label="Credits" value={formatWhole(statistics.statistics.total_credits)} />
            </div>
          ) : (
            <p className="text-sm text-gray-400">
              {statistics?.message || 'Nothing on record yet — the scratch pad below still works.'}
            </p>
          )}
        </div>

        <div className="px-5 py-4">
          <div className="text-[11px] uppercase tracking-wide text-sky-300/70 mb-2">
            This semester, so far
          </div>
          <div className="space-y-2">
            {rows.map((row, index) => (
              <div key={index} className="flex items-center gap-2">
                <input
                  type="number"
                  min={0}
                  max={20}
                  step={0.5}
                  placeholder="mark /20"
                  value={Number.isFinite(row.mark) ? row.mark : ''}
                  onChange={(event) => update(index, 'mark', event.target.value)}
                  className="flex-1 bg-black/40 border border-white/15 rounded-lg px-2.5 py-1.5 text-sm"
                />
                <input
                  type="number"
                  min={0}
                  step={1}
                  placeholder="credits"
                  value={Number.isFinite(row.credits) ? row.credits : ''}
                  onChange={(event) => update(index, 'credits', event.target.value)}
                  className="w-24 bg-black/40 border border-white/15 rounded-lg px-2.5 py-1.5 text-sm"
                />
              </div>
            ))}
          </div>

          <button
            onClick={() => setRows((prev) => [...prev, { mark: Number.NaN, credits: 3 }])}
            className="mt-2 text-xs text-sky-300 hover:text-sky-200"
          >
            + another course
          </button>

          <div className="mt-4 rounded-xl bg-black/40 border border-white/10 px-4 py-3">
            {average === null ? (
              <p className="text-sm text-gray-400">
                Type a mark and its credits to see where you stand.
              </p>
            ) : (
              <div className="flex items-baseline justify-between gap-3">
                <div>
                  <div className="text-2xl font-bold text-sky-300">{average.toFixed(2)}</div>
                  <div className="text-[11px] text-gray-400">weighted, out of 20</div>
                </div>
                <div className="text-right">
                  <div className="text-lg font-semibold">
                    {band?.letter} · {point?.toFixed(1)}
                  </div>
                  <div className="text-[11px] text-gray-400">{band?.status}</div>
                </div>
              </div>
            )}
          </div>

          <button
            onClick={onOpenCalculator}
            className="mt-4 w-full text-sm bg-sky-500 hover:bg-sky-400 text-white rounded-xl py-2 transition-colors"
          >
            Open the full calculator
          </button>
          <p className="text-[11px] text-gray-500 mt-2 text-center">
            This is a scratch pad — it is not saved to your record.
          </p>
        </div>
      </div>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-black/40 border border-white/10 px-3 py-2">
      <div className="text-lg font-semibold text-sky-200">{value}</div>
      <div className="text-[10px] text-gray-400 leading-tight">{label}</div>
    </div>
  )
}

function formatPoint(value: number | null | undefined): string {
  return typeof value === 'number' && Number.isFinite(value) ? value.toFixed(2) : '—'
}

function formatWhole(value: number | null | undefined): string {
  return typeof value === 'number' && Number.isFinite(value) ? String(Math.round(value)) : '—'
}
