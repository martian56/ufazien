import { Link } from "react-router-dom"
import { Bookmark, Eye, Flag, Heart, MessageSquare, Pin, Reply, Share2 } from "lucide-react"
import { getYearDisplay } from "../../../utils/majorUtils"
import type { ForumPost } from "../../../lib/api/endpoints/community"
import type { User } from "../../../lib/api/types"

interface PostCardProps {
  post: ForumPost
  onLike: () => void
  onBookmark: () => void
  onShare: (post: ForumPost) => void
}


export default function PostCard({ post, onLike, onBookmark, onShare }: PostCardProps) {
  return (
    <article className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <img
            src={post.author.avatar || "/placeholder.svg"}
            alt={post.author.username}
            className="w-10 h-10 rounded-full border-2 border-gray-200"
          />
          <div>
            <h3 className="font-medium text-gray-900">{post.author.full_name || post.author.username}</h3>
            <p className="text-sm text-gray-500">
              {post.author.year ? (getYearDisplay(post.author.year) === 'Graduate' ? 'Graduate' : `${getYearDisplay(post.author.year)} Year`) : 'Student'} • {post.author.major || 'UFAZ'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {post.is_pinned && <Pin className="w-4 h-4 text-blue-600" />}
          <span className="text-sm text-gray-500">{new Date(post.created_at).toLocaleDateString()}</span>
        </div>
      </div>

      {/* Content */}
      <div className="mb-4">
        <Link
          to={`/community/posts/${post.id}`}
          className="block text-lg font-semibold text-gray-900 mb-2 hover:text-blue-600"
        >
          {post.title}
        </Link>
        <p className="text-gray-600 line-clamp-3">{post.content}</p>
      </div>

      {/* Tags */}
      {post.tags && post.tags.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4">
          {post.tags.map((tag) => (
            <span key={tag} className="px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-xs">
              #{tag}
            </span>
          ))}
        </div>
      )}

      {/* Stats */}
      <div className="flex items-center justify-between text-sm text-gray-500 mb-4">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1">
            <Eye className="w-4 h-4" />
            {post.view_count || 0}
          </span>
          <span className="flex items-center gap-1">
            <MessageSquare className="w-4 h-4" />
            {post.reply_count || 0}
          </span>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between pt-4 border-t border-gray-200">
        <div className="flex items-center gap-4">
          <button
            onClick={onLike}
            className={`flex items-center gap-2 px-3 py-1 rounded-lg transition-colors ${
              post.is_liked
                ? "text-red-600 bg-red-50 hover:bg-red-100"
                : "text-gray-600 hover:text-red-600 hover:bg-red-50"
            }`}
          >
            <Heart className={`w-4 h-4 ${post.is_liked ? "fill-current" : ""}`} />
            <span>{post.like_count}</span>
          </button>

          {/* Both of these were decoration: no onClick at all. */}
          <Link
            to={`/community/posts/${post.id}`}
            className="flex items-center gap-2 px-3 py-1 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
          >
            <Reply className="w-4 h-4" />
            <span>Reply</span>
          </Link>

          <button
            onClick={() => onShare(post)}
            className="flex items-center gap-2 px-3 py-1 text-gray-600 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
          >
            <Share2 className="w-4 h-4" />
            <span>Share</span>
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onBookmark}
            className={`p-2 rounded-lg transition-colors ${
              post.is_bookmarked
                ? "text-blue-600 bg-blue-50 hover:bg-blue-100"
                : "text-gray-400 hover:text-blue-600 hover:bg-blue-50"
            }`}
          >
            <Bookmark className={`w-4 h-4 ${post.is_bookmarked ? "fill-current" : ""}`} />
          </button>
          <button className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
            <Flag className="w-4 h-4" />
          </button>
        </div>
      </div>
    </article>
  )
}

// Create Modal Component
