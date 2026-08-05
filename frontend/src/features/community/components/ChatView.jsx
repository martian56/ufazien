import { useState, useEffect, useMemo } from "react"
import { MessageCircle, MoreHorizontal, Send, Users } from "lucide-react"
import { communityApi as communityAPI } from "../../../lib/api/endpoints/community"

export default function ChatView({ groups, chats, selectedGroup, liveMessages, onSelectGroup, newMessage, onMessageChange, onSendMessage }) {
  const [selectedChat, setSelectedChat] = useState(null)
  const [chatType, setChatType] = useState("groups") // "groups" or "private"
  const [messages, setMessages] = useState([])
  const [loadingMessages, setLoadingMessages] = useState(false)

  // Load messages when a chat or group is selected
  useEffect(() => {
    const loadMessages = async () => {
      const currentChat = selectedGroup || selectedChat
      if (!currentChat) {
        setMessages([])
        return
      }

      setLoadingMessages(true)
      try {
        let messagesData = []
        if (selectedGroup) {
          // Load group messages
          messagesData = await communityAPI.getGroupMessages(selectedGroup.id)
        } else if (selectedChat) {
          // Load private chat messages
          messagesData = await communityAPI.getChatMessages(selectedChat.id)
        }
        
        setMessages(messagesData.results || messagesData || [])
      } catch (error) {
        console.error('Error loading messages:', error)
        setMessages([])
      } finally {
        setLoadingMessages(false)
      }
    }

    loadMessages()
  }, [selectedGroup, selectedChat])

  // History comes from REST, but anything sent while the panel is open arrives
  // on the socket. ChatView kept only its own REST state, so live messages,
  // including your own, never appeared until a reload.
  const visibleMessages = useMemo(() => {
    if (!selectedGroup) return messages

    const seen = new Set(messages.map((m) => String(m.id)))
    const extra = (liveMessages || []).filter((m) => !seen.has(String(m.id)))
    return [...messages, ...extra]
  }, [messages, liveMessages, selectedGroup])

  if (!selectedGroup && !selectedChat) {
    return (
      <div className="flex h-full">
        {/* Chat List */}
        <div className="w-80 border-r border-gray-200 bg-white">
          <div className="p-4 border-b border-gray-200">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Messages</h2>
            </div>
            
            {/* Chat Type Tabs */}
            <div className="flex bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => setChatType("groups")}
                className={`flex-1 px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                  chatType === "groups"
                    ? "bg-white text-gray-900 shadow-sm"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                Study Groups
              </button>
              <button
                onClick={() => setChatType("private")}
                className={`flex-1 px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                  chatType === "private"
                    ? "bg-white text-gray-900 shadow-sm"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                Private Chats
              </button>
            </div>
          </div>

          <div className="overflow-y-auto">
            {chatType === "groups" ? (
              /* Study Groups */
              groups.map((group) => (
                <div
                  key={group.id}
                  onClick={() => onSelectGroup(group)}
                  className="p-4 border-b border-gray-100 hover:bg-gray-50 cursor-pointer transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <img
                      src={group.avatar || "/placeholder.svg"}
                      alt={group.name}
                      className="w-10 h-10 rounded-full border-2 border-gray-200"
                    />
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-gray-900 truncate">{group.name}</h3>
                      <p className="text-sm text-gray-500">{group.member_count} members</p>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              /* Private Chats */
              chats.map((chat) => (
                <div
                  key={chat.id}
                  onClick={() => setSelectedChat(chat)}
                  className="p-4 border-b border-gray-100 hover:bg-gray-50 cursor-pointer transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center">
                      {chat.is_group_chat ? (
                        <Users className="w-5 h-5 text-gray-600" />
                      ) : (
                        <MessageCircle className="w-5 h-5 text-gray-600" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-gray-900 truncate">
                        {chat.name || (chat.participants && chat.participants.length > 0 
                          ? chat.participants.map(p => p.name).join(", ")
                          : "Chat"
                        )}
                      </h3>
                      <p className="text-sm text-gray-500 truncate">
                        {chat.last_message ? chat.last_message.content : "No messages yet"}
                      </p>
                    </div>
                    {chat.unread_count > 0 && (
                      <span className="bg-blue-600 text-white text-xs px-2 py-1 rounded-full">
                        {chat.unread_count}
                      </span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Empty State */}
        <div className="flex-1 flex items-center justify-center bg-gray-50">
          <div className="text-center">
            <MessageCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              Select a {chatType === "groups" ? "group" : "chat"} to start messaging
            </h3>
            <p className="text-gray-600">
              Choose a {chatType === "groups" ? "study group" : "private chat"} from the sidebar to view messages and participate in discussions
            </p>
          </div>
        </div>
      </div>
    )
  }

  // Show selected group chat or private chat
  const currentChat = selectedGroup || selectedChat
  const isGroupChat = !!selectedGroup
  
  return (
    <div className="flex h-full">
      {/* Chat List Sidebar */}
      <div className="w-80 border-r border-gray-200 bg-white">
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Messages</h2>
          </div>
          
          {/* Chat Type Tabs */}
          <div className="flex bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => {
                setChatType("groups")
                setSelectedChat(null)
              }}
              className={`flex-1 px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                chatType === "groups"
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              Study Groups
            </button>
            <button
              onClick={() => {
                setChatType("private")
                onSelectGroup(null)
              }}
              className={`flex-1 px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                chatType === "private"
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              Private Chats
            </button>
          </div>
        </div>

        <div className="overflow-y-auto">
          {chatType === "groups" ? (
            groups.map((group) => (
              <div
                key={group.id}
                onClick={() => onSelectGroup(group)}
                className={`p-4 border-b border-gray-100 cursor-pointer transition-colors ${
                  selectedGroup?.id === group.id ? "bg-blue-50 border-blue-200" : "hover:bg-gray-50"
                }`}
              >
                <div className="flex items-center gap-3">
                  <img
                    src={group.avatar || "/placeholder.svg"}
                    alt={group.name}
                    className="w-10 h-10 rounded-full border-2 border-gray-200"
                  />
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-gray-900 truncate">{group.name}</h3>
                    <p className="text-sm text-gray-500">{group.member_count} members</p>
                  </div>
                </div>
              </div>
            ))
          ) : (
            chats.map((chat) => (
              <div
                key={chat.id}
                onClick={() => setSelectedChat(chat)}
                className={`p-4 border-b border-gray-100 cursor-pointer transition-colors ${
                  selectedChat?.id === chat.id ? "bg-blue-50 border-blue-200" : "hover:bg-gray-50"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center">
                    {chat.is_group_chat ? (
                      <Users className="w-5 h-5 text-gray-600" />
                    ) : (
                      <MessageCircle className="w-5 h-5 text-gray-600" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-gray-900 truncate">
                      {chat.name || (chat.participants && chat.participants.length > 0 
                        ? chat.participants.map(p => p.name).join(", ")
                        : "Chat"
                      )}
                    </h3>
                    <p className="text-sm text-gray-500 truncate">
                      {chat.last_message ? chat.last_message.content : "No messages yet"}
                    </p>
                  </div>
                  {chat.unread_count > 0 && (
                    <span className="bg-blue-600 text-white text-xs px-2 py-1 rounded-full">
                      {chat.unread_count}
                    </span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col bg-white">
        {/* Chat Header */}
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {isGroupChat ? (
                <img
                  src={currentChat.avatar || "/placeholder.svg"}
                  alt={currentChat.name}
                  className="w-10 h-10 rounded-full border-2 border-gray-200"
                />
              ) : (
                <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center">
                  {currentChat.is_group_chat ? (
                    <Users className="w-5 h-5 text-gray-600" />
                  ) : (
                    <MessageCircle className="w-5 h-5 text-gray-600" />
                  )}
                </div>
              )}
              <div>
                <h3 className="font-medium text-gray-900">
                  {currentChat.name || (currentChat.participants 
                    ? currentChat.participants.map(p => p.name).join(", ")
                    : "Chat"
                  )}
                </h3>
                <p className="text-sm text-gray-500">
                  {isGroupChat 
                    ? `${currentChat.member_count} members` 
                    : (currentChat.is_group_chat ? "Group Chat" : "Private Chat")
                  }
                </p>
              </div>
            </div>
            <button className="p-2 text-gray-400 hover:text-gray-600 rounded-lg">
              <MoreHorizontal className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {loadingMessages ? (
            <div className="text-center text-gray-500 py-8">
              <div className="animate-spin w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full mx-auto mb-2"></div>
              <p>Loading messages...</p>
            </div>
          ) : visibleMessages.length > 0 ? (
            visibleMessages.map((message) => (
              <div key={message.id} className="flex items-start gap-3">
                <img
                  src={message.sender_avatar || "/placeholder.svg"}
                  alt={message.sender_name || "User"}
                  className="w-8 h-8 rounded-full border-2 border-gray-200"
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-gray-900">
                      {message.sender?.username || message.sender?.first_name || "Unknown User"}
                    </span>
                    <span className="text-xs text-gray-500">
                      {new Date(message.created_at).toLocaleTimeString()}
                    </span>
                  </div>
                  <p className="text-gray-700">{message.content}</p>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center text-gray-500 py-8">
              <MessageCircle className="w-8 h-8 mx-auto mb-2 text-gray-400" />
              <p>No messages yet</p>
              <p className="text-xs">Start the conversation!</p>
            </div>
          )}
        </div>

        {/* Message Input */}
        <div className="p-4 border-t border-gray-200">
          <div className="flex items-center gap-3">
            <input
              type="text"
              placeholder="Type a message..."
              value={newMessage}
              onChange={(e) => onMessageChange(e.target.value)}
              onKeyPress={(e) => e.key === "Enter" && onSendMessage(currentChat.id)}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <button
              onClick={() => onSendMessage(currentChat.id)}
              disabled={!newMessage.trim()}
              className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// Group Card Component
