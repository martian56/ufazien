import { describe, expect, it } from 'vitest'
import { countComments } from './countComments'

describe('countComments', () => {
  it('counts a flat list', () => {
    expect(countComments([{}, {}, {}])).toBe(3)
  })

  it('counts replies, which is the bug it was written for', () => {
    // One thread, two comments. The header used to say "Comments (1)".
    expect(countComments([{ replies: [{}] }])).toBe(2)
  })

  it('counts replies to replies', () => {
    expect(countComments([{ replies: [{ replies: [{}, {}] }] }])).toBe(4)
  })

  it('treats an empty replies array as no replies', () => {
    expect(countComments([{ replies: [] }])).toBe(1)
  })

  it('handles null, undefined and empty', () => {
    expect(countComments(null)).toBe(0)
    expect(countComments(undefined)).toBe(0)
    expect(countComments([])).toBe(0)
    expect(countComments([{ replies: null }])).toBe(1)
  })
})
