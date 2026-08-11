import { describe, it, expect, vi } from 'vitest'

import campusWebSocket from './campusWebSocket'

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
