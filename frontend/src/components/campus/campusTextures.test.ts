import { describe, it, expect } from 'vitest'

import { toExpression } from './campusTextures'

/**
 * The drawn parts of the campus.
 *
 * Only the pure narrowing is covered here: everything else in the module needs
 * a canvas, and returns null without one.
 */

describe('faces', () => {
  it('narrows an unknown expression rather than trusting it', () => {
    // The value reaches here from an activity that arrived over the socket.
    expect(toExpression('smile')).toBe('smile')
    expect(toExpression('nonsense')).toBe('neutral')
    expect(toExpression(undefined)).toBe('neutral')
    // An inherited key is not an expression, for the same reason FACING is a
    // Map: `EXPRESSIONS.includes` is a value check, not a property lookup.
    expect(toExpression('constructor')).toBe('neutral')
  })
})
