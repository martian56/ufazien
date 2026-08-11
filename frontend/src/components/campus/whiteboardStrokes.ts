/**
 * A whiteboard several people can draw on at once.
 *
 * Strokes travel over the lobby socket as chat messages on a reserved channel,
 * which is the one broadcast path the campus already has. That constrains the
 * format: it has to survive a JSON round trip, stay well under the 500-character
 * message limit, and be recognisable as not-a-chat-message by a client that has
 * never heard of whiteboards.
 *
 * Pure, so the wire format can be tested without a socket or a canvas — and the
 * wire format is the part that has to be right, because a malformed stroke from
 * one client would otherwise end up drawn on everybody's board.
 */

/** Marks a chat message as a stroke rather than something somebody said. */
export const STROKE_PREFIX = 'wb1:'

/** The board is drawn in a unit square; points are 0..1 on both axes. */
export interface StrokePoint {
  x: number
  y: number
}

export interface Stroke {
  /** Which board. Several rooms can have one without sharing a surface. */
  board: string
  color: string
  points: StrokePoint[]
}

/**
 * Colours a client may send.
 *
 * A closed set, because the colour reaches a canvas fill style: an arbitrary
 * string there is a place to put something that is not a colour.
 */
export const STROKE_COLORS = ['#1c1f24', '#c2453a', '#2f6fb0', '#3f8f4f', '#c08a2e'] as const
export type StrokeColor = (typeof STROKE_COLORS)[number]

const COLOR_SET: ReadonlySet<string> = new Set(STROKE_COLORS)

/** Points per stroke. Past this the message would not fit in one chat row. */
export const MAX_POINTS = 40

/** Strokes kept per board, oldest dropped first. */
export const MAX_STROKES = 120

/**
 * Packs a stroke into a chat message.
 *
 * Coordinates are quantised to three decimals — a whiteboard is not a CAD
 * program, and the difference between 0.123 and 0.1234567 is well under a
 * pixel, while the second costs four times the characters.
 */
export function encodeStroke(stroke: Stroke): string {
  const points = stroke.points
    .slice(0, MAX_POINTS)
    .map((p) => `${round(p.x)},${round(p.y)}`)
    .join(' ')
  return `${STROKE_PREFIX}${stroke.board}|${stroke.color}|${points}`
}

function round(value: number): string {
  return (Math.round(clamp01(value) * 1000) / 1000).toString()
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.min(1, Math.max(0, value))
}

export function isStrokeMessage(message: string): boolean {
  return typeof message === 'string' && message.startsWith(STROKE_PREFIX)
}

/**
 * Unpacks a stroke, or returns null.
 *
 * Everything here arrives from another client, so nothing is trusted: the
 * colour is checked against the known set rather than passed to a fill style,
 * the point count is capped, and coordinates outside the board are clamped
 * rather than drawn off it.
 */
export function decodeStroke(message: string): Stroke | null {
  if (!isStrokeMessage(message)) return null

  const body = message.slice(STROKE_PREFIX.length)
  const parts = body.split('|')
  if (parts.length !== 3) return null

  const [board, color, raw] = parts
  if (!board || board.length > 24) return null
  if (!COLOR_SET.has(color)) return null

  const points: StrokePoint[] = []
  for (const pair of raw.split(' ')) {
    if (!pair) continue
    const [xs, ys] = pair.split(',')
    const x = Number(xs)
    const y = Number(ys)
    if (!Number.isFinite(x) || !Number.isFinite(y)) return null
    points.push({ x: clamp01(x), y: clamp01(y) })
    if (points.length >= MAX_POINTS) break
  }

  // A stroke needs two points to be a line. One is a stray click.
  if (points.length < 2) return null

  return { board, color, points }
}

/**
 * Adds a stroke to a board, dropping the oldest once it is full.
 *
 * Returns the same array when nothing changed, so a consumer re-rendering on
 * identity does not repaint for a message that was not for this board.
 */
export function addStroke(strokes: readonly Stroke[], stroke: Stroke, board: string): Stroke[] {
  if (stroke.board !== board) return strokes as Stroke[]
  const next = [...strokes, stroke]
  return next.length > MAX_STROKES ? next.slice(next.length - MAX_STROKES) : next
}

/** Rebuilds a board from a chat backlog, so arriving late still shows the board. */
export function strokesFromMessages(
  messages: readonly { message: string }[],
  board: string,
): Stroke[] {
  const strokes: Stroke[] = []
  for (const entry of messages) {
    const stroke = decodeStroke(entry.message)
    if (stroke && stroke.board === board) strokes.push(stroke)
  }
  return strokes.length > MAX_STROKES ? strokes.slice(strokes.length - MAX_STROKES) : strokes
}

/** Which messages a chat panel should hide, because they are not chat. */
export function isDrawableChat(message: string): boolean {
  return !isStrokeMessage(message)
}
