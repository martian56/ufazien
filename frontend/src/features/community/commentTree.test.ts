import { describe, expect, it } from 'vitest'
import { buildCommentTree, countThread } from './commentTree'
import type { PostReply } from '../../lib/api/endpoints/community'

const reply = (id: string, parent: string | null = null): PostReply =>
  ({
    id,
    post: 'p1',
    parent_reply: parent,
    content: `reply ${id}`,
    author: { id: 1, username: 'someone', email: null },
    like_count: 0,
    created_at: '2026-01-01T00:00:00Z',
  }) as PostReply

describe('buildCommentTree', () => {
  it('returns an empty list for no replies', () => {
    expect(buildCommentTree([])).toEqual([])
  })

  it('treats replies with no parent as roots', () => {
    const tree = buildCommentTree([reply('a'), reply('b')])
    expect(tree).toHaveLength(2)
    expect(tree.every((n) => n.depth === 0)).toBe(true)
  })

  it('nests a child under its parent', () => {
    const tree = buildCommentTree([reply('a'), reply('b', 'a')])
    expect(tree).toHaveLength(1)
    expect(tree[0].children).toHaveLength(1)
    expect(tree[0].children[0].reply.id).toBe('b')
  })

  it('assigns increasing depth down the thread', () => {
    const tree = buildCommentTree([reply('a'), reply('b', 'a'), reply('c', 'b')])
    expect(tree[0].depth).toBe(0)
    expect(tree[0].children[0].depth).toBe(1)
    expect(tree[0].children[0].children[0].depth).toBe(2)
  })

  it('gets depth right even when a child arrives before its parent', () => {
    const tree = buildCommentTree([reply('c', 'b'), reply('b', 'a'), reply('a')])
    expect(tree).toHaveLength(1)
    expect(tree[0].reply.id).toBe('a')
    expect(tree[0].children[0].children[0].depth).toBe(2)
  })

  it('keeps an orphan rather than dropping it', () => {
    // A page boundary can split a thread, leaving the parent out of this batch.
    const tree = buildCommentTree([reply('b', 'missing-parent')])
    expect(tree).toHaveLength(1)
    expect(tree[0].reply.id).toBe('b')
  })

  it('does not hang on a reply that points at itself', () => {
    const tree = buildCommentTree([reply('a', 'a')])
    expect(tree).toHaveLength(1)
    expect(tree[0].children).toHaveLength(0)
  })

  it('keeps siblings in the order given', () => {
    const tree = buildCommentTree([reply('a'), reply('x', 'a'), reply('y', 'a')])
    expect(tree[0].children.map((n) => n.reply.id)).toEqual(['x', 'y'])
  })
})

describe('countThread', () => {
  it('counts a node and everything under it', () => {
    const tree = buildCommentTree([reply('a'), reply('b', 'a'), reply('c', 'b'), reply('d', 'a')])
    expect(countThread(tree[0])).toBe(4)
  })
})
