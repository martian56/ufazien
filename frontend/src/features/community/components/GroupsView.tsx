import { Users } from "lucide-react"
import GroupCard from "./GroupCard"
import type { Group } from "../../../lib/api/endpoints/community"

interface GroupsViewProps {
  groups: Group[]
  onJoinGroup: (groupId: string) => void
  onLeaveGroup: (groupId: string) => void
  onSelectGroup: (group: Group) => void
}


export default function GroupsView({ groups, onJoinGroup, onLeaveGroup, onSelectGroup }: GroupsViewProps) {
  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {groups.map((group) => (
          <GroupCard
            key={group.id}
            group={group}
            onJoin={() => onJoinGroup(group.id)}
            onLeave={() => onLeaveGroup(group.id)}
            onSelect={() => onSelectGroup(group)}
          />
        ))}
      </div>

      {groups.length === 0 && (
        <div className="text-center py-12">
          <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No groups found</h3>
          <p className="text-gray-600 mb-4">Try adjusting your search or filters</p>
          <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
            Create New Group
          </button>
        </div>
      )}
    </div>
  )
}

// Forums View Component
