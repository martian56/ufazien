import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import type { ThreeEvent } from '@react-three/fiber'

import {
  STROKE_COLORS,
  encodeStroke,
  strokesFromMessages,
  type Stroke,
  type StrokePoint,
} from './whiteboardStrokes'
import type { Vec3 } from './campusLayout'

/**
 * A whiteboard several people can draw on.
 *
 * Strokes go out over the lobby socket as chat messages on a reserved prefix,
 * which is the one broadcast path the campus already has — adding a WebSocket
 * message type for it would have meant a migration and a consumer branch for a
 * feature that is, in the end, drawing on a wall.
 *
 * Drawing needs a cursor, and the campus is played with the pointer locked. So
 * the board is only live when the player is *not* locked, which is also the
 * only time they could aim at it. The prompt says as much.
 */

const CANVAS = 1024

/**
 * Module scope, not a default parameter.
 *
 * A default is evaluated on every call, so `size = [7, 3.6]` was a fresh array
 * identity per render — and the memo below keys on it, so every render threw
 * away a 1024-pixel canvas and its texture and built new ones.
 */
const DEFAULT_SIZE: [number, number] = [7, 3.6]

export default function Whiteboard({
  board,
  position,
  rotation = 0,
  size = DEFAULT_SIZE,
  messages,
  onStroke,
  enabled = true,
}: {
  /** Which board. Two rooms can each have one without sharing a surface. */
  board: string
  position: Vec3
  rotation?: number
  size?: [number, number]
  /** The chat backlog, which is where strokes live. */
  messages: readonly { message: string }[]
  onStroke: (encoded: string) => void
  /** False while the pointer is locked, when there is no cursor to draw with. */
  enabled?: boolean
}) {
  const [color, setColor] = useState<string>(STROKE_COLORS[0])
  const drawing = useRef<StrokePoint[] | null>(null)

  // Rebuilt from the backlog rather than accumulated, so a player who joins
  // halfway through a lecture sees what is already on the board.
  const strokes = useMemo(() => strokesFromMessages(messages, board), [messages, board])

  // Keyed on the numbers, not the array: a caller passing an inline literal
  // would otherwise rebuild the canvas on every render too.
  const [sizeW, sizeH] = size
  const { texture, canvas } = useMemo(() => {
    if (typeof document === 'undefined') return { texture: null, canvas: null }
    const element = document.createElement('canvas')
    element.width = CANVAS
    element.height = Math.round(CANVAS * (sizeH / sizeW))
    const made = new THREE.CanvasTexture(element)
    made.colorSpace = THREE.SRGBColorSpace
    made.anisotropy = 4
    return { texture: made, canvas: element }
  }, [sizeW, sizeH])

  useEffect(() => () => texture?.dispose(), [texture])

  const repaint = useCallback(
    (extra: Stroke | null) => {
      if (!canvas || !texture) return
      const ctx = canvas.getContext('2d')
      if (!ctx) return

      ctx.fillStyle = '#f6f7f5'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      ctx.lineWidth = 5

      const all = extra ? [...strokes, extra] : strokes
      for (const stroke of all) {
        ctx.strokeStyle = stroke.color
        ctx.beginPath()
        stroke.points.forEach((point, i) => {
          const x = point.x * canvas.width
          const y = point.y * canvas.height
          if (i === 0) ctx.moveTo(x, y)
          else ctx.lineTo(x, y)
        })
        ctx.stroke()
      }

      texture.needsUpdate = true
    },
    [canvas, texture, strokes],
  )

  useEffect(() => repaint(null), [repaint])

  // Abandon anything half-drawn when the board goes inert.
  useEffect(() => {
    if (!enabled) drawing.current = null
  }, [enabled])

  /** Where on the board a pointer event landed, as 0..1. */
  const toBoard = (event: ThreeEvent<PointerEvent>): StrokePoint | null => {
    const uv = event.uv
    if (!uv) return null
    // Canvas y runs down, UV runs up.
    return { x: uv.x, y: 1 - uv.y }
  }

  const handleDown = (event: ThreeEvent<PointerEvent>) => {
    if (!enabled) return
    const point = toBoard(event)
    if (!point) return
    event.stopPropagation()
    drawing.current = [point]
  }

  const handleMove = (event: ThreeEvent<PointerEvent>) => {
    if (!enabled || !drawing.current) return
    const point = toBoard(event)
    if (!point) return
    drawing.current.push(point)
    repaint({ board, color, points: drawing.current })
  }

  const handleUp = () => {
    const points = drawing.current
    drawing.current = null
    // Down and move both check this; up did not, so locking the pointer
    // mid-stroke still published whatever had been drawn so far.
    if (!enabled) return
    // One point is a stray click, not a stroke, and the decoder rejects it —
    // so sending it would put a message in the backlog that draws nothing.
    if (!points || points.length < 2) return
    onStroke(encodeStroke({ board, color, points }))
  }

  return (
    <group position={position} rotation={[0, rotation, 0]}>
      <mesh position={[0, 0, -0.05]} castShadow>
        <boxGeometry args={[size[0] + 0.22, size[1] + 0.22, 0.12]} />
        <meshStandardMaterial color="#c9ccd1" roughness={0.5} metalness={0.3} />
      </mesh>

      <mesh
        onPointerDown={handleDown}
        onPointerMove={handleMove}
        onPointerUp={handleUp}
        onPointerLeave={handleUp}
      >
        <planeGeometry args={size} />
        {texture ? (
          <meshBasicMaterial map={texture} toneMapped={false} />
        ) : (
          <meshStandardMaterial color="#f6f7f5" roughness={0.3} />
        )}
      </mesh>

      {/* Pens on the tray. Clicking one changes colour, which is the only
          control the board needs and the only one that works with a pointer. */}
      <group position={[0, -size[1] / 2 - 0.22, 0.06]}>
        <mesh>
          <boxGeometry args={[size[0] * 0.5, 0.12, 0.22]} />
          <meshStandardMaterial color="#aeb3b9" roughness={0.6} metalness={0.2} />
        </mesh>
        {STROKE_COLORS.map((pen, i) => (
          <mesh
            key={pen}
            position={[(i - (STROKE_COLORS.length - 1) / 2) * 0.34, 0.1, 0.02]}
            rotation={[Math.PI / 2, 0, 0]}
            onPointerDown={(event) => {
              if (!enabled) return
              event.stopPropagation()
              setColor(pen)
            }}
          >
            <cylinderGeometry args={[0.045, 0.045, 0.3, 8]} />
            <meshStandardMaterial
              color={pen}
              roughness={0.4}
              emissive={pen === color ? pen : '#000000'}
              emissiveIntensity={pen === color ? 0.5 : 0}
            />
          </mesh>
        ))}
      </group>
    </group>
  )
}
