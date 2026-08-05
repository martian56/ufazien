import { useState, useEffect } from "react"
import { X } from "lucide-react"
import { communityApi as communityAPI } from "../../../lib/api/endpoints/community"
import { getYearDisplay } from "../../../utils/majorUtils"

export default function PrivateChatModal({ onClose, onCreateChat }) {
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedUsers, setSelectedUsers] = useState([])
  const [chatName, setChatName] = useState("")
  const [isGroupChat, setIsGroupChat] = useState(false)
  const [searchResults, setSearchResults] = useState([])
  const [isSearching, setIsSearching] = useState(false)
  const [searchError, setSearchError] = useState(null)

  // Real user search using API
  useEffect(() => {
    const searchUsers = async () => {
      if (searchQuery.trim().length < 2) {
        setSearchResults([])
        return
      }

      setIsSearching(true)
      setSearchError(null)
      
      try {
        const response = await communityAPI.searchUsers(searchQuery.trim())
        setSearchResults(response.results || [])
      } catch (error) {
        console.error('Error searching users:', error)
        setSearchError('Failed to search users')
        setSearchResults([])
      } finally {
        setIsSearching(false)
      }
    }

    const debounceTimer = setTimeout(searchUsers, 300) // Debounce search
    return () => clearTimeout(debounceTimer)
  }, [searchQuery])

  const handleUserSelect = (user) => {
    if (!selectedUsers.find(u => u.id === user.id)) {
      setSelectedUsers(prev => [...prev, user])
    }
  }

  const handleUserRemove = (userId) => {
    setSelectedUsers(prev => prev.filter(u => u.id !== userId))
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (selectedUsers.length === 0) return

    onCreateChat({
      participant_ids: selectedUsers.map(u => u.id),
      name: isGroupChat ? chatName : null,
      is_group_chat: isGroupChat
    })
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl max-w-md w-full">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-gray-900">Start New Chat</h2>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 rounded-lg"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Group Chat Toggle */}
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="group-chat"
                checked={isGroupChat}
                onChange={(e) => setIsGroupChat(e.target.checked)}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <label htmlFor="group-chat" className="text-sm font-medium text-gray-700">
                Group Chat
              </label>
            </div>

            {/* Group Chat Name */}
            {isGroupChat && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Chat Name
                </label>
                <input
                  type="text"
                  value={chatName}
                  onChange={(e) => setChatName(e.target.value)}
                  placeholder="Enter chat name"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required={isGroupChat}
                />
              </div>
            )}

            {/* User Search */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Search Users by Name
              </label>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by first or last name"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              {isSearching && (
                <div className="text-sm text-gray-500 mt-1">Searching...</div>
              )}
              {searchError && (
                <div className="text-sm text-red-500 mt-1">{searchError}</div>
              )}
            </div>

            {/* Selected Users */}
            {selectedUsers.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Selected ({selectedUsers.length})
                </label>
                <div className="flex flex-wrap gap-2">
                  {selectedUsers.map((user) => (
                    <span
                      key={user.id}
                      className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm flex items-center gap-2"
                    >
                      {user.name}
                      <button
                        type="button"
                        onClick={() => handleUserRemove(user.id)}
                        className="text-blue-500 hover:text-blue-700"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Search Results */}
            {searchQuery.length >= 2 && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Search Results
                </label>
                <div className="max-h-40 overflow-y-auto border border-gray-200 rounded-lg">
                  {searchResults.map((user) => (
                    <button
                      key={user.id}
                      type="button"
                      onClick={() => handleUserSelect(user)}
                      disabled={selectedUsers.find(u => u.id === user.id)}
                      className="w-full p-3 text-left hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-3"
                    >
                      <img
                        src={user.avatar || "/placeholder.svg"}
                        alt={user.name}
                        className="w-8 h-8 rounded-full bg-gray-200"
                      />
                      <div>
                        <div className="font-medium text-gray-900">{user.name}</div>
                        <div className="text-sm text-gray-500">
                          {user.year && user.major && `${getYearDisplay(user.year)} Year ${user.major}`}
                        </div>
                      </div>
                    </button>
                  ))}
                  {!isSearching && searchResults.length === 0 && searchQuery.length >= 2 && (
                    <div className="p-3 text-gray-500 text-center">No users found</div>
                  )}
                </div>
              </div>
            )}

            {/* Submit Buttons */}
            <div className="flex gap-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={selectedUsers.length === 0}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Start Chat
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
