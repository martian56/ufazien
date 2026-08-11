import { describe, it, expect } from 'vitest'

import {
  CAMPUS_PROPS,
  MAX_THROW,
  THROW_ARC,
  nearestProp,
  propById,
  propsIn,
  throwArc,
  throwTarget,
} from './campusProps'
import { INTERIOR_SPECS, interiorHalfExtent } from './interiorSpecs'
import { interiorColliders } from './interiorPhysics'
import { insideCollider } from './campusPhysics'
import { PLAYER_RADIUS } from './campusLayout'

describe('the prop list', () => {
  it('gives every object a unique id', () => {
    // The server stores this id. Two objects sharing one would mean picking up
    // a ball in the sports hall takes the cup out of somebody's hand.
    const ids = CAMPUS_PROPS.map((prop) => prop.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('starts every indoor object inside its own room', () => {
    for (const prop of CAMPUS_PROPS) {
      if (!prop.room) continue
      const limit = interiorHalfExtent(prop.room)
      const [x, z] = prop.home
      expect(Math.abs(x), prop.id).toBeLessThan(limit)
      expect(Math.abs(z), prop.id).toBeLessThan(limit)
    }
  })

  it('does not start an object inside the furniture', () => {
    // One you can never reach is one that is not in the room at all.
    for (const prop of CAMPUS_PROPS) {
      if (!prop.room) continue
      const [x, z] = prop.home
      const blocker = interiorColliders(prop.room).find((collider) =>
        insideCollider(x, z, collider, PLAYER_RADIUS),
      )
      expect(blocker, `${prop.id} starts inside ${JSON.stringify(blocker)}`).toBeUndefined()
    }
  })

  it('names a room that exists', () => {
    for (const prop of CAMPUS_PROPS) {
      if (!prop.room) continue
      expect(INTERIOR_SPECS[prop.room], prop.id).toBeDefined()
    }
  })

  it('looks an object up by id without tripping over inherited keys', () => {
    expect(propById('ball-court')?.kind).toBe('ball')
    expect(propById('constructor')).toBeNull()
    expect(propById(null)).toBeNull()
    expect(propById('nothing-like-this')).toBeNull()
  })

  it('groups objects by the room they belong to', () => {
    expect(propsIn(null).every((prop) => prop.room === null)).toBe(true)
    expect(propsIn('library').map((prop) => prop.id)).toEqual(['book-library'])
  })
})

describe('picking things up', () => {
  const props = propsIn(null)
  const home = new Map<string, { x: number; z: number }>()

  it('offers what is at your feet', () => {
    const ball = props.find((prop) => prop.id === 'ball-court')!
    expect(nearestProp(ball.home[0], ball.home[1], props, home)?.id).toBe('ball-court')
  })

  it('offers nothing across the campus', () => {
    expect(nearestProp(0, 0, props, home, new Set(), 1)).toBeNull()
  })

  it('skips what somebody is already holding', () => {
    const ball = props.find((prop) => prop.id === 'ball-court')!
    const held = new Set(['ball-court'])
    expect(nearestProp(ball.home[0], ball.home[1], props, home, held)?.id).not.toBe('ball-court')
  })

  it('follows an object that has been moved', () => {
    // The whole point of recording where a throw landed: the ball is where it
    // came to rest, not where it started the day.
    const moved = new Map([['ball-court', { x: 0, z: 0 }]])
    expect(nearestProp(0, 0, props, moved)?.id).toBe('ball-court')
    const ball = props.find((prop) => prop.id === 'ball-court')!
    expect(nearestProp(ball.home[0], ball.home[1], props, moved, new Set(), 1)).toBeNull()
  })
})

describe('throwing', () => {
  it('throws in the direction the player faces', () => {
    // Heading zero is +Z, the same convention the avatar uses.
    const landing = throwTarget(0, 0, 0, 1)
    expect(landing.x).toBeCloseTo(0)
    expect(landing.z).toBeCloseTo(MAX_THROW)
  })

  it('goes no further than the server would accept', () => {
    // Drawing an arc past the clamp is what makes an object visibly snap back
    // to a shorter throw a moment after it lands.
    const far = throwTarget(0, 0, 0, 5)
    expect(Math.hypot(far.x, far.z)).toBeCloseTo(MAX_THROW)
  })

  it('drops at your feet with no power behind it', () => {
    const dropped = throwTarget(3, 4, 1.2, 0)
    expect(dropped.x).toBeCloseTo(3)
    expect(dropped.z).toBeCloseTo(4)
  })

  it('leaves the hand and arrives at the floor', () => {
    const from = { x: 0, y: 1.05, z: 0 }
    const to = { x: 0, y: 0.24, z: 10 }
    expect(throwArc(from, to, 0)).toEqual(from)
    const landed = throwArc(from, to, 1)
    expect(landed.y).toBeCloseTo(to.y)
    expect(landed.z).toBeCloseTo(to.z)
  })

  it('arcs above the straight line between them', () => {
    const from = { x: 0, y: 1, z: 0 }
    const to = { x: 0, y: 1, z: 10 }
    const middle = throwArc(from, to, 0.5)
    expect(middle.y).toBeCloseTo(1 + THROW_ARC)
    expect(middle.z).toBeCloseTo(5)
  })

  it('does not fly off the end of the flight', () => {
    // The clock can overrun a frame boundary, and an unclamped t sends the
    // object on past the landing point and underground.
    const from = { x: 0, y: 1, z: 0 }
    const to = { x: 0, y: 0, z: 10 }
    expect(throwArc(from, to, 1.4)).toEqual(throwArc(from, to, 1))
    expect(throwArc(from, to, -2)).toEqual(throwArc(from, to, 0))
  })
})
