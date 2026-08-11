import { useState } from 'react'
import { Helmet } from 'react-helmet'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Bookmark, Check, Eye, Heart, Link2, Lock, MessageSquare, Pin } from 'lucide-react'
import { usePost } from '../../features/community/usePost'
import CommentTree from '../../features/community/components/CommentTree'
import ReplyComposer from '../../features/community/components/ReplyComposer'
import { communityApi } from '../../lib/api/endpoints/community'
import { useCurrentUser } from '../../lib/useCurrentUser'
import { copyText } from '../../lib/clipboard'
import EditableText from '../../features/community/components/EditableText'

export default function PostDetail() {
  const { postId } = useParams<{ postId: string }>()
  const navigate = useNavigate()
  const {
    post,
    thread,
    loading,
    error,
    addReply,
    toggleLike,
    toggleReplyLike,
    editPost,
    removePost,
    editReply,
    removeReply,
  } = usePost(postId)
  const { user } = useCurrentUser()
  const [copied, setCopied] = useState(false)
  const [bookmarked, setBookmarked] = useState<boolean | null>(null)

  const share = async () => {
    // The Share button used to have no onClick at all. Say what actually
    // happened rather than claiming success when the clipboard refused.
    const ok = await copyText(window.location.href)
    setCopied(ok)
    if (ok) setTimeout(() => setCopied(false), 2000)
  }

  const toggleBookmark = async () => {
    if (!post) return
    const next = !(bookmarked ?? post.is_bookmarked)
    setBookmarked(next)
    try {
      await communityApi.bookmarkPost(String(post.id))
    } catch {
      setBookmarked(!next)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-500">
        Loading post...
      </div>
    )
  }

  if (error || !post) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 px-4 text-center">
        <p className="text-gray-700">{error || 'That post could not be found.'}</p>
        <button
          onClick={() => navigate('/community')}
          className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm hover:bg-blue-700"
        >
          Back to Community
        </button>
      </div>
    )
  }

  const isBookmarked = bookmarked ?? post.is_bookmarked

  return (
    <>
      <Helmet>
        <title>{`${post.title} | Ufazien Community`}</title>
      </Helmet>

      <div className="min-h-screen bg-white">
        <div className="max-w-3xl mx-auto px-4 py-6">
          <Link
            to="/community"
            className="inline-flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Community
          </Link>

          <article className="mt-4 bg-white rounded-xl border border-gray-200 p-4 sm:p-6">
            <div className="flex items-start gap-2">
              <h1 className="flex-1 text-xl sm:text-2xl font-bold text-gray-900 break-words">
                {post.title}
              </h1>
              {post.is_pinned && <Pin className="w-4 h-4 text-blue-600 shrink-0 mt-1" />}
              {post.is_locked && <Lock className="w-4 h-4 text-gray-400 shrink-0 mt-1" />}
            </div>

            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500">
              <span className="font-medium text-gray-700">
                {post.author?.full_name || post.author?.username}
              </span>
              <span>{new Date(post.created_at).toLocaleString()}</span>
              <span className="inline-flex items-center gap-1">
                <Eye className="w-3.5 h-3.5" />
                {post.view_count}
              </span>
            </div>

            <div className="mt-4">
              <EditableText
                value={post.content}
                canEdit={Boolean(user) && post.author?.id === user?.id}
                onSave={editPost}
                onDelete={async () => {
                  await removePost()
                  navigate('/community')
                }}
                deleteLabel="Delete this post and all its replies?"
              >
                <p className="text-gray-800 whitespace-pre-wrap break-words">{post.content}</p>
              </EditableText>
            </div>

            {post.attachments?.length > 0 && (
              <div className="mt-4 space-y-3">
                {post.attachments.map((attachment) => (
                  <figure key={attachment.id}>
                    <img
                      src={attachment.image}
                      alt={attachment.caption || 'Attached image'}
                      loading="lazy"
                      className="w-full max-w-full rounded-lg border border-gray-200"
                    />
                    {attachment.caption && (
                      <figcaption className="mt-1 text-xs text-gray-500">
                        {attachment.caption}
                      </figcaption>
                    )}
                  </figure>
                ))}
              </div>
            )}

            {post.tags?.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-1.5">
                {post.tags.map((tag) => (
                  <span key={tag} className="px-2 py-0.5 rounded-full bg-gray-100 text-xs text-gray-600">
                    #{tag}
                  </span>
                ))}
              </div>
            )}

            <div className="mt-5 pt-4 border-t border-gray-100 flex flex-wrap items-center gap-2">
              <button
                onClick={toggleLike}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors ${
                  post.is_liked
                    ? 'text-red-600 bg-red-50 hover:bg-red-100'
                    : 'text-gray-600 hover:text-red-600 hover:bg-red-50'
                }`}
              >
                <Heart className={`w-4 h-4 ${post.is_liked ? 'fill-current' : ''}`} />
                {post.like_count}
              </button>

              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600">
                <MessageSquare className="w-4 h-4" />
                {post.reply_count}
              </span>

              <button
                onClick={share}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-gray-600 hover:text-green-700 hover:bg-green-50"
              >
                {copied ? <Check className="w-4 h-4" /> : <Link2 className="w-4 h-4" />}
                {copied ? 'Link copied' : 'Share'}
              </button>

              <button
                onClick={toggleBookmark}
                className={`ml-auto p-2 rounded-lg transition-colors ${
                  isBookmarked
                    ? 'text-blue-600 bg-blue-50 hover:bg-blue-100'
                    : 'text-gray-500 hover:bg-gray-100'
                }`}
                aria-label={isBookmarked ? 'Remove bookmark' : 'Bookmark this post'}
              >
                <Bookmark className={`w-4 h-4 ${isBookmarked ? 'fill-current' : ''}`} />
              </button>
            </div>
          </article>

          <section className="mt-4 bg-white rounded-xl border border-gray-200 p-4 sm:p-6">
            <h2 className="text-sm font-semibold text-gray-900">
              {post.reply_count} {post.reply_count === 1 ? 'reply' : 'replies'}
            </h2>

            {post.is_locked ? (
              <p className="mt-3 text-sm text-gray-500">This post is locked. No new replies.</p>
            ) : (
              <div className="mt-3">
                <ReplyComposer onSubmit={(content) => addReply(content, null)} />
              </div>
            )}

            <div className="mt-4">
              <CommentTree
                thread={thread}
                onReply={addReply}
                onToggleLike={toggleReplyLike}
                onEdit={editReply}
                onDelete={removeReply}
                currentUserId={user?.id ?? null}
              />
            </div>
          </section>
        </div>
      </div>
    </>
  )
}
