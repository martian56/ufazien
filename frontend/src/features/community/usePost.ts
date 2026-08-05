import { useCallback, useEffect, useMemo, useState } from 'react'
import { communityApi, type ForumPost, type PostReply } from '../../lib/api/endpoints/community'
import { toList } from '../../lib/api/types'
import { errorMessage } from '../../lib/api/errors'
import { buildCommentTree } from './commentTree'

/** One post plus its whole reply thread. */
export function usePost(postId: string | undefined) {
  const [post, setPost] = useState<ForumPost | null>(null)
  const [replies, setReplies] = useState<PostReply[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!postId) return
    try {
      setLoading(true)
      setError(null)
      const [postData, replyData] = await Promise.all([
        communityApi.getPost(postId),
        communityApi.getPostReplies(postId),
      ])
      setPost(postData)
      setReplies(toList(replyData))
    } catch (err) {
      setError(errorMessage(err, 'Could not load this post'))
    } finally {
      setLoading(false)
    }
  }, [postId])

  useEffect(() => {
    load()
  }, [load])

  const thread = useMemo(() => buildCommentTree(replies), [replies])

  const addReply = useCallback(
    async (content: string, parentReplyId: string | null = null) => {
      if (!postId) return
      const created = await communityApi.createReply({
        post: postId,
        content,
        parent_reply: parentReplyId,
      })
      // Append rather than refetch, so a long thread does not jump.
      setReplies((prev) => [...prev, created])
      setPost((prev) => (prev ? { ...prev, reply_count: prev.reply_count + 1 } : prev))
      return created
    },
    [postId],
  )

  const toggleLike = useCallback(async () => {
    if (!post) return

    // Optimistic, because a like should feel instant.
    const previous = { is_liked: post.is_liked, like_count: post.like_count }
    setPost({
      ...post,
      is_liked: !post.is_liked,
      like_count: post.like_count + (post.is_liked ? -1 : 1),
    })

    try {
      const result = await communityApi.likePost(String(post.id))
      setPost((prev) =>
        prev ? { ...prev, is_liked: result.liked, like_count: result.like_count } : prev,
      )
    } catch (err) {
      setPost((prev) => (prev ? { ...prev, ...previous } : prev))
      setError(errorMessage(err, 'Could not save your like'))
    }
  }, [post])

  const toggleReplyLike = useCallback(async (replyId: string) => {
    const apply = (change: Partial<PostReply>) =>
      setReplies((prev) =>
        prev.map((r) => (String(r.id) === String(replyId) ? { ...r, ...change } : r)),
      )

    const current = replies.find((r) => String(r.id) === String(replyId))
    if (!current) return

    apply({
      is_liked: !current.is_liked,
      like_count: current.like_count + (current.is_liked ? -1 : 1),
    })

    try {
      const result = await communityApi.likeReply(replyId)
      apply({ is_liked: result.liked, like_count: result.like_count })
    } catch {
      apply({ is_liked: current.is_liked, like_count: current.like_count })
    }
  }, [replies])

  return { post, replies, thread, loading, error, reload: load, addReply, toggleLike, toggleReplyLike }
}
