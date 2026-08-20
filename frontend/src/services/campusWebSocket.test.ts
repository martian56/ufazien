import { describe, it, expect, vi } from 'vitest'

import campusWebSocket, { HEARTBEAT_INTERVAL_MS } from './campusWebSocket'

/**
 * The event registry.
 *
 * `on` used to register a callback only if the event was already a key in a
 * fixed map built in the constructor, and `emit` only fired if the same key
 * existed. Subscribing to anything not on that list therefore did nothing, and
 * neither end reported it — which is how the whole seating feature shipped
 * completely inert: the server sent `seat_update`, the hook subscribed to it,
 * and the two never met.
 */

describe('the event registry', () => {
  it('delivers an event the constructor never listed', () => {
    const heard = vi.fn()
    campusWebSocket.on('somethingEntirelyNew', heard)
    campusWebSocket.emit('somethingEntirelyNew', { hello: true })
    expect(heard).toHaveBeenCalledWith({ hello: true })
  })

  it('delivers the seating events', () => {
    const seated = vi.fn()
    const denied = vi.fn()
    campusWebSocket.on('seatUpdate', seated)
    campusWebSocket.on('seatDenied', denied)

    campusWebSocket.emit('seatUpdate', { user_id: 1, seat: 'lecture-0-0' })
    campusWebSocket.emit('seatDenied', { seat: 'lecture-0-0' })

    expect(seated).toHaveBeenCalledTimes(1)
    expect(denied).toHaveBeenCalledTimes(1)
  })

  it('routes a seat frame off the wire to its listener', () => {
    const seated = vi.fn()
    campusWebSocket.on('seatUpdate', seated)
    campusWebSocket.handleMessage({ type: 'seat_update', user_id: 7, seat: 'cafe-1', activity: 'sitting' })
    expect(seated).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: 7, seat: 'cafe-1' }),
    )
  })

  it('survives a listener that throws, so one bad handler is not fatal', () => {
    const later = vi.fn()
    campusWebSocket.on('boomEvent', () => {
      throw new Error('boom')
    })
    campusWebSocket.on('boomEvent', later)
    expect(() => campusWebSocket.emit('boomEvent', {})).not.toThrow()
    expect(later).toHaveBeenCalled()
  })
})

/**
 * Listener lifetime.
 *
 * This is a module singleton, so it outlives the component subscribing to it,
 * and `disconnect()` leaves the callbacks in place. Joining a second lobby ran
 * the hook's registration a second time on top of the first, so every chat
 * message arrived once per past connection and the stale handlers went on
 * writing to state belonging to a render that no longer existed.
 */
describe('listener lifetime', () => {
  it('forgets everything on demand', () => {
    const stale = vi.fn()
    campusWebSocket.on('chatMessage', stale)
    campusWebSocket.clearListeners()
    campusWebSocket.emit('chatMessage', { message: 'hi' })
    expect(stale).not.toHaveBeenCalled()
  })

  it('does not deliver one message twice after a second registration', () => {
    // The symptom, rather than the mechanism: subscribe, reconnect, subscribe
    // again, and one message must still arrive once.
    const register = (seen: () => void) => {
      campusWebSocket.clearListeners()
      campusWebSocket.on('chatMessage', seen)
    }

    const seen = vi.fn()
    register(seen)
    campusWebSocket.disconnect()
    register(seen)

    campusWebSocket.emit('chatMessage', { message: 'hello' })
    expect(seen).toHaveBeenCalledTimes(1)
  })

  it('leaves a fresh registration working', () => {
    const heard = vi.fn()
    campusWebSocket.clearListeners()
    campusWebSocket.on('seatUpdate', heard)
    campusWebSocket.emit('seatUpdate', { user_id: 1, seat: 'cafe-1' })
    expect(heard).toHaveBeenCalledTimes(1)
  })
})

/**
 * The heartbeat.
 *
 * The server counts a member as present from a live socket and a recent sign
 * of life, so a connection that dies without saying so stops holding a place
 * (#165). Position frames only flow while the player walks — so a player
 * standing perfectly still has to keep saying they are there, or they age out
 * of the lobby they are standing in.
 */
describe('the heartbeat', () => {
  const openSocket = () => {
    const sent: string[] = []
    const ws = {
      readyState: 1,
      send: (data: string) => sent.push(data),
      close: () => {},
    }
    campusWebSocket.ws = ws as unknown as WebSocket
    campusWebSocket.isConnected = true
    return sent
  }

  const stop = () => {
    campusWebSocket.stopHeartbeat()
    campusWebSocket.ws = null
    campusWebSocket.isConnected = false
  }

  it('says we are still here without being asked', () => {
    vi.useFakeTimers()
    try {
      const sent = openSocket()
      campusWebSocket.startHeartbeat()

      expect(sent, 'a heartbeat fired before its interval').toHaveLength(0)
      vi.advanceTimersByTime(HEARTBEAT_INTERVAL_MS * 3)

      expect(sent).toHaveLength(3)
      expect(JSON.parse(sent[0])).toEqual({ type: 'heartbeat' })
    } finally {
      stop()
      vi.useRealTimers()
    }
  })

  it('beats well inside the window the server drops you after', () => {
    // Three can go missing — a tab throttled in the background, a moment of
    // bad signal — before anybody is taken out of a lobby they are in.
    expect(HEARTBEAT_INTERVAL_MS * 3).toBeLessThan(90_000)
  })

  it('stops when the socket goes, rather than beating at nothing', () => {
    vi.useFakeTimers()
    try {
      const sent = openSocket()
      campusWebSocket.startHeartbeat()
      campusWebSocket.disconnect()

      // The timer itself, not merely the absence of frames: the interval also
      // checks the connection before sending, so a leaked one is silent. This
      // is a module singleton that outlives any component using it, and a
      // leaked interval survives every later connect.
      expect(campusWebSocket.heartbeatTimer, 'the heartbeat was left running').toBeNull()
      vi.advanceTimersByTime(HEARTBEAT_INTERVAL_MS * 4)
      expect(sent, 'the heartbeat outlived the connection').toHaveLength(0)
    } finally {
      stop()
      vi.useRealTimers()
    }
  })

  it('leaves only one running when a reconnect starts another', () => {
    vi.useFakeTimers()
    try {
      const sent = openSocket()
      campusWebSocket.startHeartbeat()
      campusWebSocket.startHeartbeat()
      vi.advanceTimersByTime(HEARTBEAT_INTERVAL_MS)
      expect(sent, 'a reconnect left the old heartbeat running too').toHaveLength(1)
    } finally {
      stop()
      vi.useRealTimers()
    }
  })
})
