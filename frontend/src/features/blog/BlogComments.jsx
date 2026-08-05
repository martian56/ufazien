import { ThumbsUp } from "lucide-react"

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
}) {
  return (
        <div
          className={`mt-12 p-6 rounded-xl border ${
            darkMode ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200"
          }`}
        >
          <h3 className="text-xl font-semibold mb-6">Comments ({comments.length})</h3>

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
              <div key={comment.id} className="space-y-4">
                <div className={`flex space-x-3 ${replyTo === comment.id ? 'bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800' : ''}`}>
                  <img
                    src={comment.author?.avatar_url || "/placeholder.svg"}
                    alt={`${comment.author?.first_name} ${comment.author?.last_name}`}
                    className="w-10 h-10 rounded-full border-2 border-gray-200"
                  />
                  <div className="flex-1">
                    <div className={`p-4 rounded-lg ${darkMode ? "bg-gray-700" : "bg-gray-50"}`}>
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-medium">{`${comment.author?.first_name || ""} ${comment.author?.last_name || ""}`.trim() || "Anonymous"}</h4>
                        <span className="text-sm text-gray-500">
                          {new Date(comment.published_at).toLocaleDateString()}
                        </span>
                      </div>
                      <p className={`${darkMode ? "text-gray-200" : "text-gray-900"}`}>{comment.content}</p>
                    </div>
                    <div className="flex items-center space-x-4 mt-2">
                      <button 
                        onClick={() => onLikeComment(comment.id)}
                        className={`flex items-center space-x-1 text-sm transition-colors ${
                          comment.is_liked 
                            ? "text-blue-600 hover:text-blue-700" 
                            : "text-gray-500 hover:text-blue-600"
                        }`}
                      >
                        <ThumbsUp className={`w-4 h-4 ${comment.is_liked ? 'fill-current' : ''}`} />
                        <span>{comment.likes_count || 0}</span>
                      </button>
                      <button
                        onClick={() => setReplyTo(replyTo === comment.id ? null : comment.id)}
                        className={`text-sm transition-colors ${
                          replyTo === comment.id 
                            ? "text-blue-600 font-medium" 
                            : "text-gray-500 hover:text-blue-600"
                        }`}
                      >
                        {replyTo === comment.id ? "Cancel Reply" : "Reply"}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Replies */}
                {comment.replies && comment.replies.length > 0 && (
                  <div className="ml-12 space-y-4">
                    {comment.replies.map((reply) => (
                      <div key={reply.id} className="flex space-x-3">
                        <img
                          src={reply.author?.avatar_url || "/placeholder.svg"}
                          alt={`${reply.author?.first_name} ${reply.author?.last_name}`}
                          className="w-8 h-8 rounded-full border-2 border-gray-200"
                        />
                        <div className="flex-1">
                          <div className={`p-3 rounded-lg ${darkMode ? "bg-gray-700" : "bg-gray-50"}`}>
                            <div className="flex items-center justify-between mb-1">
                              <h5 className="font-medium text-sm">{`${reply.author?.first_name || ""} ${reply.author?.last_name || ""}`.trim() || "Anonymous"}</h5>
                              <span className="text-xs text-gray-500">
                                {new Date(reply.published_at).toLocaleDateString()}
                              </span>
                            </div>
                            <p className={`text-sm ${darkMode ? "text-gray-200" : "text-gray-900"}`}>{reply.content}</p>
                          </div>
                          <div className="flex items-center space-x-4 mt-1">
                            <button 
                              onClick={() => onLikeComment(reply.id)}
                              className={`flex items-center space-x-1 text-xs transition-colors ${
                                reply.is_liked 
                                  ? "text-blue-600 hover:text-blue-700" 
                                  : "text-gray-500 hover:text-blue-600"
                              }`}
                            >
                              <ThumbsUp className={`w-3 h-3 ${reply.is_liked ? 'fill-current' : ''}`} />
                              <span>{reply.likes_count || 0}</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
  )
}
