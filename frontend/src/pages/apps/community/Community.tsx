"use client"

import { useState, useEffect, useRef } from "react"
import { Helmet } from "react-helmet"
import { Link } from "react-router-dom"
import { MessageCircle, Search, Plus, Filter, Menu, Globe, Book, Coffee, Camera, Code, Briefcase, BookOpen, TrendingUp, Activity } from "lucide-react"

import { useCommunityData, useGroupChat } from "../../../hooks/useCommunity"
import type { Forum, ForumPost, Group, NewForumPost } from "../../../lib/api/endpoints/community"
import { communityApi as communityAPI } from "../../../lib/api/endpoints/community"
import { logger } from "../../../lib/logger"
import { copyText } from "../../../lib/clipboard"
import GroupsView from "../../../features/community/components/GroupsView"
import ForumsView from "../../../features/community/components/ForumsView"
import ChatView from "../../../features/community/components/ChatView"
import CreateModal from "../../../features/community/components/CreateModal"
import PrivateChatModal from "../../../features/community/components/PrivateChatModal"
import { useAppShell } from "../../../components/layout/appShellContext"
import { SidebarPanel } from "../../../components/layout/AppShell"

export default function Community() {
  const { isSidebarOpen, setIsSidebarOpen } = useAppShell()
  const [activeTab, setActiveTab] = useState("groups") // groups, forums, chat
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null)
  // Only the setter is used; ForumsView reports the selection but nothing
  // reads it back yet.
  const [, setSelectedForum] = useState<Forum | null>(null)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [createModalType, setCreateModalType] = useState<"group" | "forum" | "post">("group")
  const [showPrivateChatModal, setShowPrivateChatModal] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [filterCategory, setFilterCategory] = useState("all")
  const [showFilters, setShowFilters] = useState(false)
  const [shareNotice, setShareNotice] = useState<string | null>(null)
  const [newMessage, setNewMessage] = useState("")

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
    messages: liveGroupMessages,
    sendMessage: sendGroupMessage,
    sendTyping,
    sendStopTyping
  } = useGroupChat(selectedGroup?.id ?? null)

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
        console.error('loadAllData failed:', err);
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

    // A post has no category of its own; the category belongs to its forum.
    // This read post.author.category, which the user serializer has never
    // sent, so every filter but "all" matched nothing.
    const matchesCategory = filterCategory === "all" || post.forum?.category === filterCategory

    return matchesSearch && matchesCategory
  })

  // Handle creating new content
  const handleCreateGroup = async (groupData: Record<string, unknown>) => {
    try {
      await createGroup(groupData)
      setShowCreateModal(false)
    } catch (error) {
      console.error("Error creating group:", error)
    }
  }

  const handleCreateForum = async (forumData: Record<string, unknown>) => {
    try {
      await createForum(forumData)
      setShowCreateModal(false)
    } catch (error) {
      console.error("Error creating forum:", error)
    }
  }

  const handleCreatePost = async (postData: NewForumPost) => {
    try {
      await createPost(postData)
      setShowCreateModal(false)
    } catch (error) {
      console.error("Error creating post:", error)
    }
  }

  // Handle joining a group
  const handleJoinGroup = async (groupId: string) => {
    try {
      await joinGroup(groupId)
    } catch (error) {
      console.error("Error joining group:", error)
    }
  }

  // Handle leaving a group
  const handleLeaveGroup = async (groupId: string) => {
    try {
      await leaveGroup(groupId)
    } catch (error) {
      console.error("Error leaving group:", error)
    }
  }

  // Handle sending a message
  const handleSendMessage = async (chatId: string) => {
    if (!newMessage.trim() || !chatId) return

    try {
      // A group and a private chat are different things. This used to send
      // everything to /community/chats/{id}/messages/, so selecting a group
      // posted its id to the private chat endpoint and got a 404. Group
      // messages belong on the socket that useGroupChat already opened, which
      // was connected and then never used to send anything.
      if (selectedGroup && String(chatId) === String(selectedGroup.id)) {
        sendGroupMessage(newMessage)
      } else {
        await communityAPI.sendChatMessage(chatId, newMessage)
      }

      setNewMessage("")
    } catch (error) {
      logger.error('Error sending message:', error)
    }
  }

  // Handle post interactions
  const handleSharePost = async (post: ForumPost) => {
    // Copy a permalink. The button used to do nothing at all, and the first
    // version of this silently did nothing when the clipboard rejected, which
    // it does whenever the document is not focused.
    const url = `${window.location.origin}/community/posts/${post.id}`
    const copied = await copyText(url)
    setShareNotice(copied ? 'Link copied' : 'Could not copy the link')
    setTimeout(() => setShareNotice(null), 2000)
  }

  const handleLikePost = async (postId: string) => {
    try {
      await likePost(postId)
    } catch (error) {
      console.error("Error liking post:", error)
    }
  }

  const handleBookmarkPost = async (postId: string) => {
    try {
      await bookmarkPost(postId)
    } catch (error) {
      console.error("Error bookmarking post:", error)
    }
  }

  // Handle typing indicators. The timer used to hang off `window`, which
  // meant two mounted chats shared one handle and cancelled each other.
  const typingTimeout = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const handleTyping = () => {
    sendTyping()
    // Stop typing after 1 second of inactivity
    clearTimeout(typingTimeout.current)
    typingTimeout.current = setTimeout(() => {
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


  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
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
      <div className="min-h-screen bg-white flex items-center justify-center">
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
      <SidebarPanel>
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
      </SidebarPanel>
      <div className="flex-1 flex flex-col min-w-0">
        

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="bg-white border-b border-gray-200">
          <div className="flex items-center justify-between h-16 px-4 sm:px-6 lg:px-8">
            <div className="flex items-center gap-2 sm:gap-4 min-w-0">
              <button onClick={() => setIsSidebarOpen(true)} className="lg:hidden p-2 rounded-md hover:bg-gray-100">
                <Menu className="w-5 h-5" />
              </button>
              <div>
                <h1 className="text-lg sm:text-2xl font-bold text-gray-900">Community</h1>
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
                  className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
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
            />
          )}

          {activeTab === "chat" && (
            <ChatView
              groups={groups.filter((g) => g.is_joined)}
              chats={chats}
              selectedGroup={selectedGroup}
              liveMessages={liveGroupMessages}
              onSelectGroup={setSelectedGroup}
              newMessage={newMessage}
              onMessageChange={(value) => {
                setNewMessage(value)
                // handleTyping existed but was wired to nothing, so the typing
                // indicator the consumer already supports never fired.
                if (selectedGroup) handleTyping()
              }}
              onSendMessage={handleSendMessage}
            />
          )}
        </main>
      </div>

      {shareNotice && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-lg bg-gray-900 text-white text-sm shadow-lg">
          {shareNotice}
        </div>
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
