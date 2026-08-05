"use client"

import { useState, useEffect } from "react"
import { Helmet } from "react-helmet"
import { Link, useNavigate } from "react-router-dom"
import {
  MessageCircle,
  Search,
  Plus,
  Filter,
  Menu,
  Send,
  Lock,
  Globe,
  MoreHorizontal,
  Pin,
  Heart,
  Reply,
  Share2,
  Flag,
  Crown,
  Book,
  Coffee,
  Camera,
  Code,
  Briefcase,
  Clock,
  Eye,
  MessageSquare,
  Bookmark,
  BookOpen,
  Calculator,
  Home,
  Gamepad2,
  Brain,
  Telescope,
  TrendingUp,
  PenTool,
  Users,
  Settings,
  Activity,
  X,
  Calendar
} from "lucide-react"

import { useCommunityData, useGroupChat } from "../../../hooks/useCommunity"
import { communityApi as communityAPI } from "../../../lib/api/endpoints/community"
import { api } from "../../../lib/api/client"
import { isAuthenticated } from "../../../lib/api/tokens"
import { getYearDisplay } from "../../../utils/majorUtils"

export default function Community() {
  const navigate = useNavigate()
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [activeTab, setActiveTab] = useState("groups") // groups, forums, chat
  const [selectedGroup, setSelectedGroup] = useState(null)
  const [selectedForum, setSelectedForum] = useState(null)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [createModalType, setCreateModalType] = useState("group") // "group", "forum", "post"
  const [showJoinModal, setShowJoinModal] = useState(false)
  const [showPrivateChatModal, setShowPrivateChatModal] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [filterCategory, setFilterCategory] = useState("all")
  const [showFilters, setShowFilters] = useState(false)
  const [shareNotice, setShareNotice] = useState(null)
  const [newMessage, setNewMessage] = useState("")
  const [newPost, setNewPost] = useState({ title: "", content: "", category: "general" })

  // Use community data hook
  const {
    groups,
    forums,
    posts,
    chats,
    stats,
    loading,
    error,
    loadAllData,
    joinGroup,
    leaveGroup,
    likePost,
    bookmarkPost,
    createPost,
    createGroup,
    createForum,
    createChat
  } = useCommunityData()

  // Debug logging for state changes
  useEffect(() => {
  }, [loading, error, groups.length, forums.length, posts.length]);

  // Chat functionality
  const {
    messages: chatMessages,
    isConnected,
    sendMessage: sendChatMessage,
    sendTyping,
    sendStopTyping
  } = useGroupChat(selectedGroup?.id)

  const [user, setUser] = useState(null)
  
  // Load current user data
  useEffect(() => {
    const loadCurrentUser = async () => {
      try {
        // Was fetch('/api/auth/me/'): a relative path, so it hit the web server
        // rather than the API and came back as index.html, throwing
        // "Unexpected token '<'" on every load. That endpoint does not exist
        // either; the current user is /auth/user/me/.
        if (isAuthenticated()) {
          const userData = await api.get('/auth/user/me/')
          setUser({
            id: userData.id,
            name: userData.get_full_name || userData.username,
            avatar: userData.avatar || "/placeholder.svg?height=40&width=40",
            year: userData.year || "Student",
            major: userData.major || "UFAZ",
            role: "student",
          })
        }
      } catch (error) {
        console.error('Error loading user data:', error)
        // Fallback user data
        setUser({
          id: 1,
          name: "Guest User",
          avatar: "/placeholder.svg?height=40&width=40",
          year: "Student",
          major: "UFAZ",
          role: "student",
        })
      }
    }
    
    loadCurrentUser()
  }, [])

  // Load data on component mount
  useEffect(() => {
    
    const timeoutId = setTimeout(() => {
      if (loading) {
        console.error('⏰ Loading timeout - API might be down or authentication failed');
        console.error('⏰ Current state at timeout:', {
          loading,
          error,
          groupsCount: groups.length,
          forumsCount: forums.length,
          postsCount: posts.length
        });
      }
    }, 10000); // 10 second timeout

    loadAllData()
      .then(() => {
      })
      .catch((err) => {
        console.error('💥 loadAllData failed:', err);
      })
      .finally(() => {
        clearTimeout(timeoutId);
      });

    return () => {
      clearTimeout(timeoutId);
    };
  }, [])  // Remove dependencies to prevent re-runs

  // Filter data based on search and category
  const filteredGroups = groups.filter((group) => {
    const matchesSearch =
      group.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      group.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (group.tags && group.tags.some((tag) => tag.toLowerCase().includes(searchQuery.toLowerCase())))

    const matchesCategory = filterCategory === "all" || group.category === filterCategory

    return matchesSearch && matchesCategory
  })

  const filteredForums = forums.filter((forum) => {
    const matchesSearch =
      forum.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      forum.description.toLowerCase().includes(searchQuery.toLowerCase())

    const matchesCategory = filterCategory === "all" || forum.category === filterCategory

    return matchesSearch && matchesCategory
  })

  const filteredPosts = posts.filter((post) => {
    const matchesSearch =
      post.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      post.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (post.tags && post.tags.some((tag) => tag.toLowerCase().includes(searchQuery.toLowerCase())))

    const matchesCategory = filterCategory === "all" || post.author?.category === filterCategory

    return matchesSearch && matchesCategory
  })

  // Handle creating new content
  const handleCreateGroup = async (groupData) => {
    try {
      await createGroup(groupData)
      setShowCreateModal(false)
    } catch (error) {
      console.error("Error creating group:", error)
    }
  }

  const handleCreateForum = async (forumData) => {
    try {
      await createForum(forumData)
      setShowCreateModal(false)
    } catch (error) {
      console.error("Error creating forum:", error)
    }
  }

  const handleCreatePost = async (postData) => {
    try {
      await createPost(postData)
      setShowCreateModal(false)
    } catch (error) {
      console.error("Error creating post:", error)
    }
  }

  // Handle joining a group
  const handleJoinGroup = async (groupId) => {
    try {
      await joinGroup(groupId)
    } catch (error) {
      console.error("Error joining group:", error)
    }
  }

  // Handle leaving a group
  const handleLeaveGroup = async (groupId) => {
    try {
      await leaveGroup(groupId)
    } catch (error) {
      console.error("Error leaving group:", error)
    }
  }

  // Handle sending a message
  const handleSendMessage = async (chatId) => {
    if (!newMessage.trim() || !chatId) return

    try {
      // Send message via API
      await communityAPI.sendChatMessage(chatId, newMessage)
      
      // Clear the message input
      setNewMessage("")
      
      // Optionally reload chat data to show the new message
      // In a real implementation, this would be handled by WebSocket
      
    } catch (error) {
      console.error('Error sending message:', error)
      // You could show a toast notification here
    }
  }

  // Handle post interactions
  const handleSharePost = async (post) => {
    // Copy a permalink. The button used to do nothing at all.
    const url = `${window.location.origin}/community/posts/${post.id}`
    try {
      await navigator.clipboard.writeText(url)
      setShareNotice(post.id)
      setTimeout(() => setShareNotice(null), 2000)
    } catch {
      setShareNotice(null)
    }
  }

  const handleLikePost = async (postId) => {
    try {
      await likePost(postId)
    } catch (error) {
      console.error("Error liking post:", error)
    }
  }

  const handleBookmarkPost = async (postId) => {
    try {
      await bookmarkPost(postId)
    } catch (error) {
      console.error("Error bookmarking post:", error)
    }
  }

  // Handle typing indicators
  const handleTyping = () => {
    sendTyping()
    // Stop typing after 1 second of inactivity
    clearTimeout(window.typingTimeout)
    window.typingTimeout = setTimeout(() => {
      sendStopTyping()
    }, 1000)
  }

  const categories = [
    { id: "all", name: "All", icon: Globe, color: "bg-gray-500" },
    { id: "study", name: "Study Groups", icon: Book, color: "bg-blue-500" },
    { id: "tech", name: "Technology", icon: Code, color: "bg-indigo-500" },
    { id: "language", name: "Languages", icon: MessageCircle, color: "bg-green-500" },
    { id: "hobby", name: "Hobbies", icon: Camera, color: "bg-pink-500" },
    { id: "project", name: "Projects", icon: Briefcase, color: "bg-purple-500" },
    { id: "social", name: "Social", icon: Coffee, color: "bg-orange-500" },
    { id: "academic", name: "Academic", icon: BookOpen, color: "bg-red-500" },
    { id: "career", name: "Career", icon: TrendingUp, color: "bg-yellow-500" },
  ]

  const sidebarItems = [
    { name: "Dashboard", icon: Activity, url: "/dashboard" },
    { name: "GPA Calculator", icon: Calculator, url: "/gpa-calculator" },
    { name: "Average Calculator", icon: TrendingUp, url: "/average-calculator" },
    { name: "Campus Simulator", icon: Gamepad2, url: "/campus-simulator" },
    { name: "Hosting", icon: Home, url: "/hosting" },
    { name: "AI Tools", icon: Brain, url: "/ai-tools" },
    { name: "Blog", icon: PenTool, url: "/blog" },
    { name: "User Sites", icon: Telescope, url: "/user-sites" },
    { name: "Community", icon: Users, url: "/community" },
    { name: "Calendar", icon: Calendar, url: "/calendar" },
    { name: "Settings", icon: Settings, url: "/settings" },
  ]

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-gray-600">Loading community...</p>
          <p className="mt-1 text-xs text-gray-400">Check console for debug logs</p>
          {error && <p className="mt-2 text-red-500 text-sm">Error: {error}</p>}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600">Error loading community: {error}</p>
          <button 
            onClick={() => window.location.reload()} 
            className="mt-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }


  return (
    <>
      <Helmet>
        <title>Ufazien | Community</title>
        <meta name="description" content="Connect with peers and join study groups on Ufazien's community page." />
      </Helmet>
      <div className="min-h-screen bg-gray-50 flex">
        {/* Sidebar */}
        <aside
          className={`fixed inset-y-0 left-0 z-50 w-64 bg-white shadow-lg transform transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:inset-0 ${
            isSidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between h-16 px-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-lg flex items-center justify-center">
              <BookOpen className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
              Ufazien
            </span>
          </div>
          <button onClick={() => setIsSidebarOpen(false)} className="lg:hidden p-1 rounded-md hover:bg-gray-100">
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="mt-6 px-3">
          {sidebarItems.map((item, index) => (
            <a
              key={index}
              href={item.url || "#"}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg mb-1 transition-colors ${
                item.active ? "bg-blue-50 text-blue-600 border-r-2 border-blue-600" : "text-gray-700 hover:bg-gray-100"
              }`}
            >
              <item.icon className="w-5 h-5" />
              <span className="font-medium">{item.name}</span>
            </a>
          ))}
        </nav>

        {/* Quick Stats */}
        <div className="mt-8 px-3">
          <div className="bg-gray-50 rounded-lg p-4">
            <h3 className="font-medium text-gray-900 mb-3">Your Activity</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Groups Joined</span>
                <span className="font-medium">{stats?.user_stats?.groups_joined ?? 0}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Posts Liked</span>
                <span className="font-medium">{stats?.user_stats?.posts_liked ?? 0}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Bookmarked</span>
                <span className="font-medium">{stats?.user_stats?.posts_bookmarked ?? 0}</span>
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="bg-white shadow-sm border-b border-gray-200">
          <div className="flex items-center justify-between h-16 px-4 sm:px-6 lg:px-8">
            <div className="flex items-center gap-2 sm:gap-4 min-w-0">
              <button onClick={() => setIsSidebarOpen(true)} className="lg:hidden p-2 rounded-md hover:bg-gray-100">
                <Menu className="w-5 h-5" />
              </button>
              <div>
                <h1 className="text-lg sm:text-2xl font-bold text-gray-900 flex items-center gap-2">
                  Community
                  <span className="hidden sm:inline-block px-2 py-1 text-xs bg-yellow-100 text-yellow-800 rounded-full">In Development</span>
                </h1>
                <p className="hidden sm:block text-sm text-gray-500">Connect with fellow UFAZ students</p>
              </div>
            </div>

            <div className="flex items-center gap-2 sm:gap-4 shrink-0">
              {/* Search */}
              <div className="hidden sm:block relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  type="text"
                  placeholder="Search groups, forums, posts..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              {/* Filter Button */}
              <button
                onClick={() => setShowFilters(!showFilters)}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <Filter className="w-5 h-5" />
              </button>

              {/* Create Button */}
              <div className="relative">
                <button
                  onClick={() => {
                    if (activeTab === "groups") {
                      setCreateModalType("group")
                    } else if (activeTab === "forums") {
                      setCreateModalType("forum")
                    } else if (activeTab === "chat") {
                      setShowPrivateChatModal(true)
                      return
                    }
                    setShowCreateModal(true)
                  }}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  <span className="hidden sm:inline">
                    {activeTab === "groups" && "Create Group"}
                    {activeTab === "forums" && "Create Forum"}
                    {activeTab === "chat" && "New Chat"}
                  </span>
                </button>
              </div>
            </div>
          </div>

          {/* Tab Navigation */}
          <div className="border-t border-gray-200">
            <div className="flex items-center gap-1 px-4 sm:px-6 lg:px-8">
              <button
                onClick={() => setActiveTab("groups")}
                className={`px-4 py-3 font-medium transition-colors ${
                  activeTab === "groups"
                    ? "text-blue-600 border-b-2 border-blue-600"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                Study Groups
              </button>
              <button
                onClick={() => setActiveTab("forums")}
                className={`px-4 py-3 font-medium transition-colors ${
                  activeTab === "forums"
                    ? "text-blue-600 border-b-2 border-blue-600"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                Forums
              </button>
              <button
                onClick={() => setActiveTab("chat")}
                className={`px-4 py-3 font-medium transition-colors ${
                  activeTab === "chat"
                    ? "text-blue-600 border-b-2 border-blue-600"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                Group Chat
              </button>
            </div>
          </div>

          {/* Filters Panel */}
          {showFilters && (
            <div className="border-t border-gray-200 p-4">
              <div className="flex flex-wrap gap-2">
                {categories.map((category) => (
                  <button
                    key={category.id}
                    onClick={() => setFilterCategory(category.id)}
                    className={`flex items-center gap-2 px-3 py-1 rounded-full text-sm transition-colors ${
                      filterCategory === category.id
                        ? "bg-blue-100 text-blue-700 border border-blue-300"
                        : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                    }`}
                  >
                    <category.icon className="w-3 h-3" />
                    {category.name}
                  </button>
                ))}
              </div>
            </div>
          )}
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto">
          {activeTab === "groups" && (
            <GroupsView
              groups={filteredGroups}
              onJoinGroup={handleJoinGroup}
              onLeaveGroup={handleLeaveGroup}
              onSelectGroup={setSelectedGroup}
              user={user}
            />
          )}

          {activeTab === "forums" && (
            <ForumsView
              forums={filteredForums}
              posts={filteredPosts}
              onSelectForum={setSelectedForum}
              onLikePost={handleLikePost}
              onBookmarkPost={handleBookmarkPost}
              onSharePost={handleSharePost}
              onCreatePost={() => {
                setCreateModalType("post")
                setShowCreateModal(true)
              }}
              user={user}
            />
          )}

          {activeTab === "chat" && (
            <ChatView
              groups={groups.filter((g) => g.is_joined)}
              chats={chats}
              selectedGroup={selectedGroup}
              onSelectGroup={setSelectedGroup}
              newMessage={newMessage}
              onMessageChange={setNewMessage}
              onSendMessage={handleSendMessage}
              user={user}
            />
          )}
        </main>
      </div>

      {/* Mobile Sidebar Overlay */}
      {isSidebarOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden" onClick={() => setIsSidebarOpen(false)} />
      )}

      {/* Create Modals */}
      {showCreateModal && (
        <CreateModal
          type={createModalType}
          onClose={() => setShowCreateModal(false)}
          onCreateGroup={handleCreateGroup}
          onCreateForum={handleCreateForum}
          onCreatePost={handleCreatePost}
          forums={forums}
          categories={categories}
        />
      )}

      {/* Private Chat Modal */}
      {showPrivateChatModal && (
        <PrivateChatModal
          onClose={() => setShowPrivateChatModal(false)}
          onCreateChat={async (chatData) => {
            try {
              await createChat(chatData);
              setShowPrivateChatModal(false);
            } catch (error) {
              console.error('Error creating private chat:', error);
            }
          }}
        />
      )}
    </div>
  </>
  )
}

// Groups View Component
function GroupsView({ groups, onJoinGroup, onLeaveGroup, onSelectGroup, user }) {
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
            user={user}
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
function ForumsView({ forums, posts, onSelectForum, onLikePost, onBookmarkPost, onSharePost, onCreatePost, user }) {
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
function ChatView({ groups, chats, selectedGroup, onSelectGroup, newMessage, onMessageChange, onSendMessage, user }) {
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
          ) : messages.length > 0 ? (
            messages.map((message) => (
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
function GroupCard({ group, onJoin, onLeave, onSelect, user }) {
  const categoryIcons = {
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
        {group.isOwner && <Crown className="w-5 h-5 text-yellow-500" />}
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
function ForumCard({ forum, onSelect }) {
  // Import icons dynamically based on icon_name from API
  const iconMap = {
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
      className="p-4 bg-white rounded-lg border border-gray-200 hover:shadow-md cursor-pointer transition-all"
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
function PostCard({ post, onLike, onBookmark, onShare, user }) {
  return (
    <article className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <img
            src={post.author.avatar || "/placeholder.svg"}
            alt={post.author.name}
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
function CreateModal({ type, onClose, onCreateGroup, onCreateForum, onCreatePost, forums, categories }) {
  const [formData, setFormData] = useState({
    name: "",
    title: "",
    description: "",
    category: "general",
    type: "public",
    maxMembers: 30,
    tags: [],
    courseCode: "",
    professor: "",
    content: "",
    forumId: "",
    iconName: "MessageCircle",
    colorClass: "bg-blue-500"
  })
  const [tagInput, setTagInput] = useState("")

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    try {
      if (type === "group") {
        await onCreateGroup({
          name: formData.name,
          description: formData.description,
          category: formData.category,
          type: formData.type,
          max_members: formData.maxMembers,
          tags: formData.tags,
          course_code: formData.courseCode || null,
          professor: formData.professor || null
        })
      } else if (type === "forum") {
        await onCreateForum({
          title: formData.title,
          description: formData.description,
          category: formData.category,
          icon_name: formData.iconName,
          color_class: formData.colorClass
        })
      } else if (type === "post") {
        await onCreatePost({
          title: formData.title,
          content: formData.content,
          forum: formData.forumId,
          tags: formData.tags
        })
      }
    } catch (error) {
      console.error("Error creating:", error)
    }
  }

  const addTag = () => {
    if (tagInput.trim() && !formData.tags.includes(tagInput.trim())) {
      setFormData(prev => ({
        ...prev,
        tags: [...prev.tags, tagInput.trim()]
      }))
      setTagInput("")
    }
  }

  const removeTag = (tagToRemove) => {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags.filter(tag => tag !== tagToRemove)
    }))
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-gray-900">
              Create {type === "group" ? "Study Group" : type === "forum" ? "Forum" : "Post"}
            </h2>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 rounded-lg"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Title/Name Field */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {type === "group" ? "Group Name" : "Title"}
              </label>
              <input
                type="text"
                value={type === "group" ? formData.name : formData.title}
                onChange={(e) => setFormData(prev => ({
                  ...prev,
                  [type === "group" ? "name" : "title"]: e.target.value
                }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>

            {/* Description/Content Field */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {type === "post" ? "Content" : "Description"}
              </label>
              <textarea
                value={type === "post" ? formData.content : formData.description}
                onChange={(e) => setFormData(prev => ({
                  ...prev,
                  [type === "post" ? "content" : "description"]: e.target.value
                }))}
                rows={type === "post" ? 6 : 3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>

            {/* Forum Selection for Posts */}
            {type === "post" && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Forum
                </label>
                <select
                  value={formData.forumId}
                  onChange={(e) => setFormData(prev => ({ ...prev, forumId: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                >
                  <option value="">Select a forum</option>
                  {forums.map((forum) => (
                    <option key={forum.id} value={forum.id}>
                      {forum.title}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Category */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Category
              </label>
              <select
                value={formData.category}
                onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Group-specific fields */}
            {type === "group" && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Group Type
                    </label>
                    <select
                      value={formData.type}
                      onChange={(e) => setFormData(prev => ({ ...prev, type: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="public">Public</option>
                      <option value="private">Private</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Max Members
                    </label>
                    <input
                      type="number"
                      value={formData.maxMembers}
                      onChange={(e) => setFormData(prev => ({ ...prev, maxMembers: parseInt(e.target.value) }))}
                      min="2"
                      max="100"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Course Code (Optional)
                    </label>
                    <input
                      type="text"
                      value={formData.courseCode}
                      onChange={(e) => setFormData(prev => ({ ...prev, courseCode: e.target.value }))}
                      placeholder="e.g., CS301"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Professor (Optional)
                    </label>
                    <input
                      type="text"
                      value={formData.professor}
                      onChange={(e) => setFormData(prev => ({ ...prev, professor: e.target.value }))}
                      placeholder="e.g., Dr. Smith"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>
              </>
            )}

            {/* Forum-specific fields */}
            {type === "forum" && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Icon
                  </label>
                  <select
                    value={formData.iconName}
                    onChange={(e) => setFormData(prev => ({ ...prev, iconName: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="MessageCircle">Message Circle</option>
                    <option value="Book">Book</option>
                    <option value="Briefcase">Briefcase</option>
                    <option value="Code">Code</option>
                    <option value="Coffee">Coffee</option>
                    <option value="Camera">Camera</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Color
                  </label>
                  <select
                    value={formData.colorClass}
                    onChange={(e) => setFormData(prev => ({ ...prev, colorClass: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="bg-blue-500">Blue</option>
                    <option value="bg-green-500">Green</option>
                    <option value="bg-purple-500">Purple</option>
                    <option value="bg-red-500">Red</option>
                    <option value="bg-yellow-500">Yellow</option>
                    <option value="bg-indigo-500">Indigo</option>
                  </select>
                </div>
              </div>
            )}

            {/* Tags */}
            {(type === "group" || type === "post") && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Tags
                </label>
                <div className="flex gap-2 mb-2">
                  <input
                    type="text"
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyPress={(e) => e.key === "Enter" && (e.preventDefault(), addTag())}
                    placeholder="Add a tag"
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <button
                    type="button"
                    onClick={addTag}
                    className="px-3 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
                  >
                    Add
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {formData.tags.map((tag) => (
                    <span
                      key={tag}
                      className="px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-xs flex items-center gap-1"
                    >
                      #{tag}
                      <button
                        type="button"
                        onClick={() => removeTag(tag)}
                        className="text-blue-500 hover:text-blue-700"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
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
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Create {type === "group" ? "Group" : type === "forum" ? "Forum" : "Post"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

// Private Chat Modal Component
function PrivateChatModal({ onClose, onCreateChat }) {
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
