import { Bookmark, Calendar, Clock, Eye, Heart, MessageCircle, MoreHorizontal, Share2 } from "lucide-react"
import { useNavigate } from "react-router-dom"
import { formatYearWithOrdinal } from "../../utils/majorUtils"
import { createExcerpt } from "./createExcerpt"

export default function BlogPostCard({ post, onLike, onBookmark, onPostClick, onSelect, currentUser, onShare }) {
  const navigate = useNavigate()
  const isOwnPost = post.author.id === currentUser.id

  const handleTitleClick = () => {
    onPostClick(post.id)
  }

  const handlePopularPostClick = () => {
    onPostClick(post.id)
  }

  return (
    <article  className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <img
            src={post.author.avatar_url || "/placeholder.svg"}
            alt={`${post.author.first_name} ${post.author.last_name}`}
            className="w-10 h-10 rounded-full border-2 border-gray-200"
          />
          <div>
            <h3 className="font-medium text-gray-900">{`${post.author.first_name} ${post.author.last_name}`}</h3>
            <p className="text-sm text-gray-500">
              {post.author.year ? formatYearWithOrdinal(post.author.year) : 'Student'} • {post.author.major}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">{post.category_name}</span>
          {isOwnPost && (
            <button className="p-1 text-gray-400 hover:text-gray-600 rounded">
              <MoreHorizontal className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="mb-4">
        <h2
          className="text-xl font-bold text-gray-900 mb-2 cursor-pointer hover:text-blue-600 transition-colors"
          onClick={handleTitleClick}
        >
          {post.title}
        </h2>
        <p className="text-gray-600 line-clamp-3">{post.excerpt || createExcerpt(post.content, 200)}</p>
      </div>

      {/* Tags */}
      {post.tags && post.tags.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4">
          {post.tags.map((tag) => (
            <span key={tag} className="px-2 py-1 bg-gray-100 text-gray-600 rounded text-xs">
              #{tag}
            </span>
          ))}
        </div>
      )}

      {/* Meta Info */}
      <div className="flex items-center justify-between text-sm text-gray-500 mb-4">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1">
            <Calendar className="w-4 h-4" />
            {new Date(post.published_at).toLocaleDateString()}
          </span>
          <span className="flex items-center gap-1">
            <Clock className="w-4 h-4" />
            {post.read_time}
          </span>
          <span className="flex items-center gap-1">
            <Eye className="w-4 h-4" />
            {post.views || 0}
          </span>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between pt-4 border-t border-gray-200">
        <div className="flex items-center gap-4">
          <button
            onClick={() => onLike(post.id)}
            className={`flex items-center gap-2 px-3 py-1 rounded-lg transition-colors ${
              post.is_liked
                ? "text-red-600 bg-red-50 hover:bg-red-100"
                : "text-gray-600 hover:text-red-600 hover:bg-red-50"
            }`}
          >
            <Heart className={`w-4 h-4 ${post.is_liked ? "fill-current" : ""}`} />
            <span>{post.likes_count || 0}</span>
          </button>

          <button className="flex items-center gap-2 px-3 py-1 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
            <MessageCircle className="w-4 h-4" />
            <span>{post.comments ? post.comments.length : 0}</span>
          </button>

          <button 
            onClick={() => onShare && onShare(post)}
            className="flex items-center gap-2 px-3 py-1 text-gray-600 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
          >
            <Share2 className="w-4 h-4" />
            <span>Share</span>
          </button>
        </div>

        <button
          onClick={() => onBookmark(post.id)}
          className={`p-2 rounded-lg transition-colors ${
            post.is_bookmarked
              ? "text-blue-600 bg-blue-50 hover:bg-blue-100"
              : "text-gray-400 hover:text-blue-600 hover:bg-blue-50"
          }`}
        >
          <Bookmark className={`w-4 h-4 ${post.is_bookmarked ? "fill-current" : ""}`} />
        </button>
      </div>
    </article>
  )
}
