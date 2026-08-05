import type { PostReply } from '../../lib/api/endpoints/community'

export interface CommentNode {
  reply: PostReply
  depth: number
  children: CommentNode[]
}

/**
 * Assemble a flat reply list into a thread.
 *
 * The API sends every reply on a post in one flat list, each carrying its
 * `parent_reply`. Building the tree here keeps the server free of recursive
 * serialization, which is why nesting had been commented out there entirely.
 *
 * Replies whose parent is missing from the list, which happens when a page
 * boundary splits a thread, are treated as roots rather than dropped.
 */
export function buildCommentTree(replies: PostReply[]): CommentNode[] {
  const nodes = new Map<string, CommentNode>()
  for (const reply of replies) {
    nodes.set(String(reply.id), { reply, depth: 0, children: [] })
  }

  const roots: CommentNode[] = []

  for (const reply of replies) {
    const node = nodes.get(String(reply.id))!
    const parentId = reply.parent_reply ? String(reply.parent_reply) : null
    const parent = parentId ? nodes.get(parentId) : undefined

    if (parent && parent !== node) {
      parent.children.push(node)
    } else {
      roots.push(node)
    }
  }

  // Depth is assigned after linking, so it is correct regardless of the order
  // the flat list arrived in.
  const assignDepth = (node: CommentNode, depth: number) => {
    node.depth = depth
    for (const child of node.children) assignDepth(child, depth + 1)
  }
  for (const root of roots) assignDepth(root, 0)

  return roots
}

/** Total replies in a subtree, including the node itself. */
export function countThread(node: CommentNode): number {
  return 1 + node.children.reduce((total, child) => total + countThread(child), 0)
}
