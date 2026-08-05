import { Plus } from "lucide-react"
import PostCard from "./PostCard"
import ForumCard from "./ForumCard"
import type { Forum, ForumPost } from "../../../lib/api/endpoints/community"
import type { User } from "../../../lib/api/types"

interface ForumsViewProps {
  forums: Forum[]
  posts: ForumPost[]
  onSelectForum: (forum: Forum) => void
  onLikePost: (postId: string) => void
  onBookmarkPost: (postId: string) => void
  onSharePost: (post: ForumPost) => void
  onCreatePost: () => void
  user: User | null
}


export default function ForumsView({
  forums,
  posts,
  onSelectForum,
  onLikePost,
  onBookmarkPost,
  onSharePost,
  onCreatePost,
  user,
}: ForumsViewProps) {
  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Forums List */}
        <div className="lg:col-span-1">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Forums</h2>
          <div className="space-y-3">
            {forums.map((forum) => (
              <ForumCard key={forum.id} forum={forum} onSelect={() => onSelectForum(forum)} />
            ))}
          </div>
        </div>

        {/* Recent Posts */}
        <div className="lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-900">Recent Posts</h2>
            <button
              onClick={onCreatePost}
              className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
            >
              <Plus className="w-4 h-4" />
              Create Post
            </button>
          </div>
          <div className="space-y-4">
            {posts.map((post) => (
              <PostCard
                key={post.id}
                post={post}
                onLike={() => onLikePost(post.id)}
                onBookmark={() => onBookmarkPost(post.id)}
                onShare={onSharePost}
                user={user}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// Chat View Component
