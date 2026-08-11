import { describe, it, expect } from 'vitest'

import {
  MAX_BOARD_ID,
  MAX_MESSAGE_LENGTH,
  MAX_POINTS,
  MAX_STROKES,
  STROKE_COLORS,
  addStroke,
  decodeStroke,
  encodeStroke,
  isDrawableChat,
  isStrokeMessage,
  strokesFromMessages,
  type Stroke,
} from './whiteboardStrokes'

/**
 * Strokes travel as chat messages, so every one of them arrives from another
 * client and none of it is trusted. The colour in particular reaches a canvas
 * fill style.
 */

const stroke: Stroke = {
  board: 'lecture',
  color: STROKE_COLORS[0],
  points: [
    { x: 0.1, y: 0.2 },
    { x: 0.5, y: 0.6 },
  ],
}

describe('the wire format', () => {
  it('survives a round trip', () => {
    const decoded = decodeStroke(encodeStroke(stroke))
    expect(decoded?.board).toBe('lecture')
    expect(decoded?.color).toBe(STROKE_COLORS[0])
    expect(decoded?.points).toHaveLength(2)
    expect(decoded?.points[0].x).toBeCloseTo(0.1, 3)
  })

  it('is recognisable as not a chat message', () => {
    expect(isStrokeMessage(encodeStroke(stroke))).toBe(true)
    expect(isStrokeMessage('hello everyone')).toBe(false)
  })

  it('keeps strokes out of the chat panel', () => {
    // A client that has never heard of whiteboards must not print them.
    expect(isDrawableChat(encodeStroke(stroke))).toBe(false)
    expect(isDrawableChat('hello everyone')).toBe(true)
  })

  it('fits inside the message limit', () => {
    const long: Stroke = {
      board: 'lecture',
      color: STROKE_COLORS[0],
      points: Array.from({ length: 200 }, (_, i) => ({ x: i / 200, y: (i % 7) / 7 })),
    }
    // ChatMessage.message is capped at 500 characters by the model, and the
    // worst case is what matters: five-character coordinates throughout.
    expect(encodeStroke(long).length).toBeLessThanOrEqual(MAX_MESSAGE_LENGTH)
  })

  it('caps the points rather than truncating the message', () => {
    const long: Stroke = {
      board: 'lecture',
      color: STROKE_COLORS[0],
      points: Array.from({ length: 200 }, (_, i) => ({ x: i / 200, y: 0.5 })),
    }
    expect(decodeStroke(encodeStroke(long))?.points.length).toBeLessThanOrEqual(MAX_POINTS)
  })
})

describe('decoding untrusted input', () => {
  it('rejects a colour that is not one of ours', () => {
    // This value reaches a canvas fill style. An arbitrary string there is a
    // place to put something that is not a colour.
    expect(decodeStroke('wb1:lecture|javascript:alert(1)|0,0 1,1')).toBeNull()
    expect(decodeStroke('wb1:lecture|#ff0000|0,0 1,1')).toBeNull()
  })

  it('rejects anything that is not a stroke at all', () => {
    expect(decodeStroke('hello everyone')).toBeNull()
    expect(decodeStroke('')).toBeNull()
    expect(decodeStroke('wb1:')).toBeNull()
  })

  it('rejects a malformed body', () => {
    expect(decodeStroke('wb1:lecture|#1c1f24')).toBeNull()
    expect(decodeStroke(`wb1:lecture|${STROKE_COLORS[0]}|a,b c,d`)).toBeNull()
  })

  it('rejects a stroke with only one point', () => {
    expect(decodeStroke(`wb1:lecture|${STROKE_COLORS[0]}|0.5,0.5`)).toBeNull()
  })

  it('rejects an absurd board name', () => {
    const long = 'x'.repeat(80)
    expect(decodeStroke(`wb1:${long}|${STROKE_COLORS[0]}|0,0 1,1`)).toBeNull()
  })

  it('rejects a board id carrying the separator', () => {
    // It would encode a message every client rejects, so the stroke reaches
    // everybody and draws nothing at all.
    expect(decodeStroke(`wb1:a|b|${STROKE_COLORS[0]}|0,0 1,1`)).toBeNull()
    expect(() => encodeStroke({ ...stroke, board: 'a|b' })).toThrow()
    expect(() => encodeStroke({ ...stroke, board: 'x'.repeat(MAX_BOARD_ID + 1) })).toThrow()
  })

  it('rejects a truncated coordinate pair', () => {
    // `Number('')` is 0, so this used to decode to a point on the top edge.
    expect(decodeStroke(`wb1:lecture|${STROKE_COLORS[0]}|0.5, 1,1`)).toBeNull()
    expect(decodeStroke(`wb1:lecture|${STROKE_COLORS[0]}|,0.5 1,1`)).toBeNull()
  })

  it('stays inside the transport limit for the longest legal board id', () => {
    const worst = {
      board: 'x'.repeat(MAX_BOARD_ID),
      color: STROKE_COLORS[0],
      // 0.123 style coordinates are the widest `round` produces.
      points: Array.from({ length: MAX_POINTS * 2 }, () => ({ x: 0.123, y: 0.987 })),
    }
    expect(encodeStroke(worst).length).toBeLessThanOrEqual(MAX_MESSAGE_LENGTH)
  })

  it('clamps coordinates onto the board rather than drawing off it', () => {
    const decoded = decodeStroke(`wb1:lecture|${STROKE_COLORS[0]}|-5,9 0.5,0.5`)
    expect(decoded?.points[0]).toEqual({ x: 0, y: 1 })
  })

  it('does not choke on a NaN coordinate', () => {
    expect(decodeStroke(`wb1:lecture|${STROKE_COLORS[0]}|NaN,0 1,1`)).toBeNull()
  })
})

describe('accumulating a board', () => {
  it('adds a stroke meant for this board', () => {
    expect(addStroke([], stroke, 'lecture')).toHaveLength(1)
  })

  it('ignores a stroke meant for another board, without a new array', () => {
    // Same identity when nothing changed, so consumers do not repaint for a
    // message that was not for them.
    const existing: Stroke[] = []
    expect(addStroke(existing, { ...stroke, board: 'library' }, 'lecture')).toBe(existing)
  })

  it('drops the oldest once the board is full', () => {
    let strokes: readonly Stroke[] = []
    for (let i = 0; i < MAX_STROKES + 20; i++) {
      strokes = addStroke(strokes, { ...stroke, points: [{ x: i / 500, y: 0 }, { x: 1, y: 1 }] }, 'lecture')
    }
    expect(strokes).toHaveLength(MAX_STROKES)
    // The survivors are the recent ones.
    expect(strokes[0].points[0].x).toBeGreaterThan(0)
  })

  it('rebuilds a board from the backlog, so arriving late still shows it', () => {
    const backlog = [
      { message: 'hello everyone' },
      { message: encodeStroke(stroke) },
      { message: encodeStroke({ ...stroke, board: 'library' }) },
      { message: encodeStroke(stroke) },
    ]
    expect(strokesFromMessages(backlog, 'lecture')).toHaveLength(2)
  })

  it('rebuilds nothing from an empty backlog', () => {
    expect(strokesFromMessages([], 'lecture')).toEqual([])
  })
})
