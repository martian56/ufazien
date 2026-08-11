import { Book, Briefcase, Camera, Code, Coffee, MessageCircle } from "lucide-react"
import type { Forum } from "../../../lib/api/endpoints/community"

interface ForumCardProps {
  forum: Forum
  onSelect: () => void
}



export default function ForumCard({ forum, onSelect }: ForumCardProps) {
  // Import icons dynamically based on icon_name from API
  const iconMap: Record<string, typeof MessageCircle> = {
    MessageCircle,
    Book,
    Briefcase,
    Code,
    Coffee,
    Camera
  };
  
  const ForumIcon = iconMap[forum.icon_name] || MessageCircle;

  return (
    <div
      onClick={onSelect}
      className="p-4 bg-white rounded-lg border border-gray-200 hover:border-gray-300 cursor-pointer transition-colors"
    >
      <div className="flex items-center gap-3 mb-3">
        <div className={`w-10 h-10 ${forum.color_class || 'bg-blue-500'} rounded-lg flex items-center justify-center`}>
          <ForumIcon className="w-5 h-5 text-white" />
        </div>
        <div>
          <h3 className="font-medium text-gray-900">{forum.title}</h3>
          <p className="text-sm text-gray-500">{forum.description}</p>
        </div>
      </div>

      <div className="flex items-center justify-between text-sm text-gray-500 mb-2">
        <span>{forum.post_count || 0} posts</span>
        <span>{forum.member_count || 0} members</span>
      </div>

      {forum.last_post ? (
        <div className="text-xs text-gray-400">
          <span className="font-medium">{forum.last_post.title}</span>
          <span>
            {" "}
            by {forum.last_post.author} • {new Date(forum.last_post.timestamp).toLocaleDateString()}
          </span>
        </div>
      ) : (
        <div className="text-xs text-gray-400">
          No posts yet
        </div>
      )}
    </div>
  )
}

// Post Card Component
