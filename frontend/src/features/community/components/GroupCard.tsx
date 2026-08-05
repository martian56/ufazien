import { Book, Briefcase, Camera, Clock, Code, Coffee, Crown, Globe, Lock, MessageCircle, Users } from "lucide-react"
import type { Group } from "../../../lib/api/endpoints/community"

interface GroupCardProps {
  group: Group
  onJoin: () => void
  onLeave: () => void
  onSelect: () => void
}


export default function GroupCard({ group, onJoin, onLeave, onSelect }: GroupCardProps) {
  const categoryIcons: Record<string, typeof Users> = {
    study: Book,
    tech: Code,
    language: MessageCircle,
    hobby: Camera,
    project: Briefcase,
    social: Coffee,
  }

  const CategoryIcon = categoryIcons[group.category] || Users

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
            <CategoryIcon className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">{group.name}</h3>
            <div className="flex items-center gap-2 mt-1">
              {group.type === "private" ? (
                <Lock className="w-3 h-3 text-gray-400" />
              ) : (
                <Globe className="w-3 h-3 text-gray-400" />
              )}
              <span className="text-sm text-gray-500 capitalize">{group.type}</span>
            </div>
          </div>
        </div>
        {group.is_owner && <Crown className="w-5 h-5 text-yellow-500" />}
      </div>

      {/* Description */}
      <p className="text-gray-600 text-sm mb-4 line-clamp-3">{group.description}</p>

      {/* Course Info */}
      {group.course_code && (
        <div className="flex items-center gap-2 mb-3 text-sm text-gray-600">
          <Book className="w-4 h-4" />
          <span>{group.course_code}</span>
          {group.professor && <span>• {group.professor}</span>}
        </div>
      )}

      {/* Tags */}
      {group.tags && group.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-4">
          {group.tags.slice(0, 3).map((tag) => (
            <span key={tag} className="px-2 py-1 bg-gray-100 text-gray-600 rounded text-xs">
              #{tag}
            </span>
          ))}
          {group.tags.length > 3 && (
            <span className="px-2 py-1 bg-gray-100 text-gray-600 rounded text-xs">+{group.tags.length - 3}</span>
          )}
        </div>
      )}

      {/* Stats */}
      <div className="flex items-center justify-between mb-4 text-sm text-gray-500">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1">
            <Users className="w-4 h-4" />
            {group.member_count}/{group.max_members}
          </span>
          <span className="flex items-center gap-1">
            <Clock className="w-4 h-4" />
            {group.last_activity ? new Date(group.last_activity).toLocaleDateString() : 'No activity'}
          </span>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        {group.is_joined ? (
          <>
            <button
              onClick={onSelect}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Open Chat
            </button>
            <button
              onClick={onLeave}
              className="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Leave
            </button>
          </>
        ) : (
          <button
            onClick={onJoin}
            disabled={group.member_count >= group.max_members}
            className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {group.member_count >= group.max_members ? "Full" : "Join Group"}
          </button>
        )}
      </div>
    </div>
  )
}

// Forum Card Component
