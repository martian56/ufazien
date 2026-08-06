import { ThumbsUp } from "lucide-react"
import { countComments } from "./countComments"

interface CommentAuthor {
  first_name?: string
  last_name?: string
  avatar_url?: string | null
}

export interface BlogComment {
  id: number
  author?: CommentAuthor
  content: string
  published_at: string
  likes_count?: number
  is_liked?: boolean
  replies?: BlogComment[]
}

interface BlogCommentsProps {
  comments: BlogComment[]
  commentsLoading: boolean
  currentUser: { name?: string; avatar?: string | null }
  darkMode: boolean
  newComment: string
  setNewComment: (value: string) => void
  replyTo: number | null
  setReplyTo: (id: number | null) => void
  onSubmitComment: () => void
  onLikeComment: (commentId: number) => void
}


/**
 * Comments on an article, including replies.
 *
 * Carved out of BlogRead, which was one 1,400-line function with no internal
 * components at all.
 */
export default function BlogComments({
  comments,
  commentsLoading,
  currentUser,
  darkMode,
  newComment,
  setNewComment,
  replyTo,
  setReplyTo,
  onSubmitComment,
  onLikeComment,
}: BlogCommentsProps) {
  return (
        <div
          className={`mt-12 p-6 rounded-xl border ${
            darkMode ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200"
          }`}
        >
          <h3 className="text-xl font-semibold mb-6">Comments ({countComments(comments)})</h3>

          {/* Add Comment */}
          <div className="mb-8">
            <div className="flex space-x-3">
              <img
                src={currentUser.avatar || "/placeholder.svg"}
                alt={currentUser.name}
                className="w-10 h-10 rounded-full border-2 border-gray-200"
              />
              <div className="flex-1">
                <textarea
                  placeholder={replyTo ? "Write a reply..." : "Write a thoughtful comment..."}
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  rows={3}
                  className={`w-full p-3 border rounded-lg resize-none ${
                    darkMode
                      ? "bg-gray-700 border-gray-600 text-white placeholder-gray-400"
                      : "bg-white border-gray-300 placeholder-gray-500"
                  }`}
                />
                <div className="flex justify-between items-center mt-2">
                  <div className="flex items-center space-x-4">
                    <span className="text-sm text-gray-500">{newComment.length}/500 characters</span>
                    {replyTo && (
                      <button
                        onClick={() => setReplyTo(null)}
                        className="text-sm text-gray-500 hover:text-red-600 transition-colors"
                      >
                        Cancel Reply
                      </button>
                    )}
                  </div>
                  <button
                    onClick={onSubmitComment}
                    disabled={!newComment.trim() || commentsLoading}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {commentsLoading ? "Posting..." : replyTo ? "Post Reply" : "Post Comment"}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Comments List */}
          <div className="space-y-6">
            {comments.map((comment) => (
              <CommentThread
                key={comment.id}
                comment={comment}
                depth={0}
                darkMode={darkMode}
                replyTo={replyTo}
                setReplyTo={setReplyTo}
                onLikeComment={onLikeComment}
              />
            ))}
            {comments.length === 0 && (
              <p className="text-gray-500 text-sm">No comments yet. Be the first.</p>
            )}
          </div>
        </div>
  )
}

/** How far replies keep indenting before they stack vertically instead. */
const MAX_INDENT_DEPTH = 4

/**
 * One comment and everything under it.
 *
 * The API nests replies to any depth, and this used to render exactly one
 * level: a reply to a reply was stored, returned, and then not drawn. It also
 * had no Reply button of its own, so there was no way to start one from the
 * interface.
 */
interface CommentThreadProps {
  comment: BlogComment
  depth: number
  darkMode: boolean
  replyTo: number | null
  setReplyTo: (id: number | null) => void
  onLikeComment: (commentId: number) => void
}

function CommentThread({ comment, depth, darkMode, replyTo, setReplyTo, onLikeComment }: CommentThreadProps) {
  const isReply = depth > 0
  const author = `${comment.author?.first_name || ""} ${comment.author?.last_name || ""}`.trim() || "Anonymous"
  const replies = comment.replies || []

  return (
    <div className={isReply ? "" : "space-y-3"}>
      <div
        className={`flex space-x-3 ${
          replyTo === comment.id
            ? "bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800"
            : ""
        }`}
      >
        <img
          src={comment.author?.avatar_url || "/placeholder.svg"}
          alt={author}
          className={`${isReply ? "w-8 h-8" : "w-10 h-10"} rounded-full border-2 border-gray-200`}
        />
        <div className="flex-1">
          <div className={`p-3 rounded-lg ${darkMode ? "bg-gray-700" : "bg-gray-50"}`}>
            <div className="flex items-center justify-between mb-1">
              <h5 className={`font-medium ${isReply ? "text-sm" : ""}`}>{author}</h5>
              <span className="text-xs text-gray-500">
                {new Date(comment.published_at).toLocaleDateString()}
              </span>
            </div>
            <p className={`${isReply ? "text-sm" : ""} ${darkMode ? "text-gray-200" : "text-gray-900"}`}>
              {comment.content}
            </p>
          </div>

          <div className="flex items-center space-x-4 mt-1">
            <button
              onClick={() => onLikeComment(comment.id)}
              className={`flex items-center space-x-1 text-xs transition-colors ${
                comment.is_liked ? "text-blue-600 hover:text-blue-700" : "text-gray-500 hover:text-blue-600"
              }`}
            >
              <ThumbsUp className={`w-3 h-3 ${comment.is_liked ? "fill-current" : ""}`} />
              <span>{comment.likes_count || 0}</span>
            </button>
            <button
              onClick={() => setReplyTo(replyTo === comment.id ? null : comment.id)}
              className={`text-xs transition-colors ${
                replyTo === comment.id ? "text-blue-600 font-medium" : "text-gray-500 hover:text-blue-600"
              }`}
            >
              {replyTo === comment.id ? "Cancel Reply" : "Reply"}
            </button>
          </div>
        </div>
      </div>

      {replies.length > 0 && (
        <div
          className={`mt-4 space-y-4 ${
            depth < MAX_INDENT_DEPTH ? "ml-12 border-l border-gray-200 pl-4" : ""
          }`}
        >
          {replies.map((reply) => (
            <CommentThread
              key={reply.id}
              comment={reply}
              depth={depth + 1}
              darkMode={darkMode}
              replyTo={replyTo}
              setReplyTo={setReplyTo}
              onLikeComment={onLikeComment}
            />
          ))}
        </div>
      )}
    </div>
  )
}
