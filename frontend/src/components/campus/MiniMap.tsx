import { useCallback, useEffect, useRef, useState, type MutableRefObject } from 'react'
import { createPortal } from 'react-dom'
import { Maximize2, X } from 'lucide-react'
import { CAMPUS_BUILDINGS, CAMPUS_DOORS, QUAD_CENTRE, QUAD_RADIUS } from './campusLayout'
import {
  buildingsInView,
  clampToEdge,
  fitCampus,
  headingVector,
  placeLabels,
  project,
  scaleOf,
  windowAround,
  type MapView,
  type Pose,
} from './mapProjection'

export interface MapPeer {
  id: string | number
  room: string | null
  position: { x: number; z: number }
  color?: string
}

interface Props {
  poseRef: MutableRefObject<Pose>
  peers: MapPeer[]
  expanded: boolean
  onToggle: () => void
  onClose: () => void
}

const INK = {
  grass: '#18251c',
  quad: '#1d2b21',
  path: '#232a33',
  wall: '#39424f',
  walls: '#262d37',
  here: '#3f4d3a',
  door: '#f0b429',
  peer: '#7dd3fc',
  self: '#ffffff',
  label: '#9aa8ba',
}

function drawMap(
  ctx: CanvasRenderingContext2D,
  view: MapView,
  pose: Pose,
  peers: MapPeer[],
  detailed: boolean,
) {
  const { size } = view
  const scale = scaleOf(view)

  ctx.clearRect(0, 0, size, size)
  ctx.fillStyle = INK.grass
  ctx.fillRect(0, 0, size, size)

  const quad = project(QUAD_CENTRE[0], QUAD_CENTRE[1], view)
  ctx.fillStyle = INK.quad
  ctx.beginPath()
  ctx.arc(quad.x, quad.y, QUAD_RADIUS * scale, 0, Math.PI * 2)
  ctx.fill()

  ctx.strokeStyle = INK.path
  ctx.lineWidth = Math.max(1, 7 * scale)
  ctx.beginPath()
  const spineTop = project(0, -110, view)
  const spineBottom = project(0, 150, view)
  ctx.moveTo(spineTop.x, spineTop.y)
  ctx.lineTo(spineBottom.x, spineBottom.y)
  const crossLeft = project(-120, 0, view)
  const crossRight = project(120, 0, view)
  ctx.moveTo(crossLeft.x, crossLeft.y)
  ctx.lineTo(crossRight.x, crossRight.y)
  ctx.stroke()

  const visible = buildingsInView(view)
  for (const building of visible) {
    const [x, , z] = building.position
    const w = building.size[0] * scale
    const d = building.size[2] * scale
    const at = project(x, z, view)
    const here = pose.room !== null && String(building.id) === pose.room

    ctx.fillStyle = here ? INK.here : INK.walls
    ctx.strokeStyle = here ? INK.door : INK.wall
    ctx.lineWidth = here ? 1.6 : 1
    ctx.beginPath()
    ctx.rect(at.x - w / 2, at.y - d / 2, w, d)
    ctx.fill()
    ctx.stroke()
  }

  ctx.fillStyle = INK.door
  for (const door of CAMPUS_DOORS) {
    const at = project(door.x, door.z, view)
    if (at.x < -4 || at.y < -4 || at.x > size + 4 || at.y > size + 4) continue
    ctx.beginPath()
    ctx.arc(at.x, at.y, detailed ? 2.4 : 1.6, 0, Math.PI * 2)
    ctx.fill()
  }

  if (detailed) {
    ctx.font = '600 11px ui-sans-serif, system-ui, sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    const labels = placeLabels(view, (text) => ctx.measureText(text).width + 6, visible)
    ctx.lineWidth = 3
    ctx.strokeStyle = 'rgba(6,9,14,0.9)'
    for (const label of labels) {
      ctx.strokeText(label.text, label.x, label.y)
    }
    ctx.fillStyle = INK.label
    for (const label of labels) {
      ctx.fillText(label.text, label.x, label.y)
    }
  }

  const centre = size / 2
  const radius = centre - 3
  for (const peer of peers) {
    if ((peer.room ?? null) !== (pose.room ?? null)) continue
    const at = project(peer.position.x, peer.position.z, view)
    const edge = clampToEdge(at.x - centre, at.y - centre, radius)
    ctx.fillStyle = peer.color ?? INK.peer
    ctx.globalAlpha = edge.clamped ? 0.45 : 1
    ctx.beginPath()
    ctx.arc(centre + edge.x, centre + edge.y, detailed ? 3.5 : 2.6, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.globalAlpha = 1

  const rawSelf = pose.room ? roomCentre(pose.room, view) : project(pose.x, pose.z, view)
  const selfEdge = clampToEdge(rawSelf.x - centre, rawSelf.y - centre, radius - 6)
  const self = { x: centre + selfEdge.x, y: centre + selfEdge.y }
  const forward = headingVector(pose.heading)
  const left = { x: -forward.y, y: forward.x }
  const nose = detailed ? 9 : 6.5
  const wing = detailed ? 5 : 3.8

  ctx.fillStyle = INK.self
  ctx.strokeStyle = '#0b0e13'
  ctx.lineWidth = 1.2
  ctx.beginPath()
  ctx.moveTo(self.x + forward.x * nose, self.y + forward.y * nose)
  ctx.lineTo(self.x - forward.x * wing + left.x * wing, self.y - forward.y * wing + left.y * wing)
  ctx.lineTo(self.x - forward.x * wing - left.x * wing, self.y - forward.y * wing - left.y * wing)
  ctx.closePath()
  ctx.fill()
  ctx.stroke()
}

function roomCentre(room: string, view: MapView): { x: number; y: number } {
  const building = CAMPUS_BUILDINGS.find((candidate) => String(candidate.id) === room)
  if (!building) return { x: view.size / 2, y: view.size / 2 }
  return project(building.position[0], building.position[2], view)
}

function useMapCanvas(
  canvasRef: MutableRefObject<HTMLCanvasElement | null>,
  poseRef: MutableRefObject<Pose>,
  peers: MapPeer[],
  size: number,
  detailed: boolean,
  active: boolean,
) {
  const peersRef = useRef(peers)
  peersRef.current = peers

  useEffect(() => {
    if (!active || size <= 0) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    canvas.width = Math.round(size * dpr)
    canvas.height = Math.round(size * dpr)
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

    let frame = 0
    let last = 0
    const tick = (now: number) => {
      frame = requestAnimationFrame(tick)
      if (now - last < 66) return
      last = now
      const pose = poseRef.current
      const view = detailed ? fitCampus(size) : windowAround(pose.x, pose.z, size)
      drawMap(ctx, view, pose, peersRef.current, detailed)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [canvasRef, poseRef, size, detailed, active])
}

function smallSizeFor(width: number, height: number): number {
  const shortest = Math.min(width, height)
  if (shortest < 380) return 62
  if (shortest < 500) return 74
  if (width < 1024) return 92
  return 108
}

export default function MiniMap({ poseRef, peers, expanded, onToggle, onClose }: Props) {
  const smallRef = useRef<HTMLCanvasElement | null>(null)
  const bigRef = useRef<HTMLCanvasElement | null>(null)
  const bigBoxRef = useRef<HTMLDivElement | null>(null)

  const [smallSize, setSmallSize] = useState(() =>
    typeof window === 'undefined' ? 92 : smallSizeFor(window.innerWidth, window.innerHeight),
  )
  const [bigSize, setBigSize] = useState(320)

  useEffect(() => {
    const onResize = () => setSmallSize(smallSizeFor(window.innerWidth, window.innerHeight))
    window.addEventListener('resize', onResize)
    window.addEventListener('orientationchange', onResize)
    return () => {
      window.removeEventListener('resize', onResize)
      window.removeEventListener('orientationchange', onResize)
    }
  }, [])

  const measureBig = useCallback(() => {
    const box = bigBoxRef.current
    if (!box) return
    const next = Math.floor(Math.min(box.clientWidth, box.clientHeight))
    if (next > 0) setBigSize(next)
  }, [])

  useEffect(() => {
    if (!expanded) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [expanded, onClose])

  useEffect(() => {
    if (!expanded) return
    measureBig()
    const box = bigBoxRef.current
    if (!box || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(measureBig)
    observer.observe(box)
    return () => observer.disconnect()
  }, [expanded, measureBig])

  useMapCanvas(smallRef, poseRef, peers, smallSize, false, true)
  useMapCanvas(bigRef, poseRef, peers, bigSize, true, expanded)

  return (
    <>
      <button
        type="button"
        onClick={onToggle}
        aria-label="Open the campus map"
        title="Campus map (M)"
        className="group relative block shrink-0 overflow-hidden rounded-lg border border-white/15 bg-slate-950/70 shadow-lg shadow-black/40 backdrop-blur transition hover:border-white/35"
        style={{ width: smallSize, height: smallSize }}
      >
        <canvas ref={smallRef} className="block" style={{ width: smallSize, height: smallSize }} />
        <span className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center justify-between bg-gradient-to-t from-black/85 to-transparent px-1 pb-0.5 pt-2">
          <span className="text-[8px] font-semibold uppercase tracking-widest text-white/60">Map</span>
          <Maximize2 className="h-2.5 w-2.5 text-white/60 transition group-hover:text-white" />
        </span>
      </button>

      {expanded && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-3 backdrop-blur-sm sm:p-6">
          <div className="flex max-h-full w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-white/10 bg-slate-950/95 shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-2.5">
              <div>
                <h2 className="text-sm font-semibold text-white">Campus map</h2>
                <p className="text-[11px] text-slate-400">Press M to close</p>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close the map"
                className="rounded-md p-1.5 text-slate-400 transition hover:bg-white/10 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div
              ref={bigBoxRef}
              className="flex min-h-0 flex-1 items-center justify-center p-3 sm:p-4"
            >
              <canvas
                ref={bigRef}
                className="block rounded-lg border border-white/10 bg-slate-900"
                style={{ width: bigSize, height: bigSize }}
              />
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  )
}
