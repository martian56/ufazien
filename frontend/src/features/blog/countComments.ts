interface CommentLike {
  replies?: CommentLike[] | null
}

/**
 * Total comments on a post, replies included.
 *
 * The API returns only root comments at the top level, with replies nested
 * underneath, so `comments.length` counts threads rather than comments. A post
 * with one comment and one reply displayed "Comments (1)" above two visible
 * comments.
 */
export function countComments(comments: CommentLike[] | null | undefined): number {
  if (!comments?.length) return 0
  return comments.reduce((total, comment) => total + 1 + countComments(comment.replies), 0)
}
