"use client"

import { useState, useEffect } from "react"
import { Helmet } from "react-helmet"
import { useNavigate } from "react-router-dom"
import {
  Users,
  MessageCircle,
  Search,
  Plus,
  Filter,
  Menu,
  User,
  X,
  BookOpen,
  BarChart3,
  Calculator,
  TrendingUp,
  FileText,
  CalendarIcon,
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
  Activity,
  PenTool,
  Settings,
} from "lucide-react"

export default function Community() {
  const navigate = useNavigate()
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [activeTab, setActiveTab] = useState("groups") // groups, forums, chat
  const [selectedGroup, setSelectedGroup] = useState(null)
  const [selectedForum, setSelectedForum] = useState(null)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showJoinModal, setShowJoinModal] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [filterCategory, setFilterCategory] = useState("all")
  const [showFilters, setShowFilters] = useState(false)
  const [newMessage, setNewMessage] = useState("")
  const [newPost, setNewPost] = useState({ title: "", content: "", category: "general" })

  const [user] = useState({
    id: 1,
    name: "Sarah Johnson",
    avatar: "/placeholder.svg?height=40&width=40",
    year: "3rd Year",
    major: "Computer Science",
    role: "student",
  })

  const [groups, setGroups] = useState([
    {
      id: 1,
      name: "CS301 - Database Systems",
      description:
        "Study group for Database Systems course. Share notes, discuss assignments, and prepare for exams together.",
      category: "study",
      type: "public",
      members: 24,
      maxMembers: 30,
      avatar: "/placeholder.svg?height=48&width=48",
      courseCode: "CS301",
      professor: "Dr. Smith",
      isJoined: true,
      isOwner: false,
      lastActivity: "2 hours ago",
      tags: ["database", "sql", "study-group"],
      messages: [
        {
          id: 1,
          sender: "Alice Chen",
          avatar: "/placeholder.svg?height=32&width=32",
          message: "Hey everyone! I've uploaded my notes from today's lecture on query optimization.",
          timestamp: "10:30 AM",
          type: "text",
        },
        {
          id: 2,
          sender: "Bob Wilson",
          avatar: "/placeholder.svg?height=32&width=32",
          message: "Thanks Alice! Really helpful. Does anyone understand the B-tree indexing part?",
          timestamp: "10:45 AM",
          type: "text",
        },
        {
          id: 3,
          sender: "Sarah Johnson",
          avatar: "/placeholder.svg?height=32&width=32",
          message: "I can explain that! Let's meet in the library tomorrow at 2 PM?",
          timestamp: "11:00 AM",
          type: "text",
        },
      ],
    },
    {
      id: 2,
      name: "UFAZ Developers",
      description:
        "Community for aspiring developers at UFAZ. Share projects, collaborate on code, and discuss tech trends.",
      category: "tech",
      type: "public",
      members: 156,
      maxMembers: 200,
      avatar: "/placeholder.svg?height=48&width=48",
      isJoined: true,
      isOwner: false,
      lastActivity: "1 hour ago",
      tags: ["programming", "web-dev", "mobile-dev", "projects"],
      messages: [
        {
          id: 1,
          sender: "David Kim",
          avatar: "/placeholder.svg?height=32&width=32",
          message: "Just finished my React portfolio project! Would love some feedback 🚀",
          timestamp: "9:15 AM",
          type: "text",
        },
        {
          id: 2,
          sender: "Emma Rodriguez",
          avatar: "/placeholder.svg?height=32&width=32",
          message: "Looks amazing David! The animations are smooth. What did you use for deployment?",
          timestamp: "9:30 AM",
          type: "text",
        },
      ],
    },
    {
      id: 3,
      name: "French Language Exchange",
      description:
        "Practice French with native speakers and fellow learners. Improve your language skills in a friendly environment.",
      category: "language",
      type: "public",
      members: 43,
      maxMembers: 50,
      avatar: "/placeholder.svg?height=48&width=48",
      isJoined: false,
      isOwner: false,
      lastActivity: "3 hours ago",
      tags: ["french", "language-exchange", "conversation"],
      messages: [],
    },
    {
      id: 4,
      name: "UFAZ Photography Club",
      description:
        "Share your photography, get feedback, and organize photo walks around Baku. All skill levels welcome!",
      category: "hobby",
      type: "public",
      members: 89,
      maxMembers: 100,
      avatar: "/placeholder.svg?height=48&width=48",
      isJoined: true,
      isOwner: false,
      lastActivity: "5 hours ago",
      tags: ["photography", "art", "baku", "photo-walks"],
      messages: [],
    },
    {
      id: 5,
      name: "Final Year Project Team",
      description: "Private group for our capstone project on AI-powered learning systems.",
      category: "project",
      type: "private",
      members: 4,
      maxMembers: 5,
      avatar: "/placeholder.svg?height=48&width=48",
      isJoined: true,
      isOwner: true,
      lastActivity: "30 minutes ago",
      tags: ["ai", "machine-learning", "capstone"],
      messages: [],
    },
  ])

  const [forums, setForums] = useState([
    {
      id: 1,
      title: "General Discussion",
      description: "General topics and campus life discussions",
      category: "general",
      posts: 1247,
      members: 892,
      lastPost: {
        title: "New cafeteria menu - thoughts?",
        author: "Mike Chen",
        timestamp: "2 hours ago",
      },
      icon: MessageCircle,
      color: "bg-blue-500",
    },
    {
      id: 2,
      title: "Academic Help",
      description: "Get help with courses, assignments, and study tips",
      category: "academic",
      posts: 2156,
      members: 654,
      lastPost: {
        title: "Linear Algebra - Eigenvalues explanation needed",
        author: "Anna Petrov",
        timestamp: "1 hour ago",
      },
      icon: Book,
      color: "bg-green-500",
    },
    {
      id: 3,
      title: "Career & Internships",
      description: "Job opportunities, internship experiences, and career advice",
      category: "career",
      posts: 543,
      members: 423,
      lastPost: {
        title: "Google internship interview experience",
        author: "Alex Johnson",
        timestamp: "4 hours ago",
      },
      icon: Briefcase,
      color: "bg-purple-500",
    },
    {
      id: 4,
      title: "Tech Talk",
      description: "Latest technology trends, programming discussions, and project showcases",
      category: "tech",
      posts: 876,
      members: 321,
      lastPost: {
        title: "React vs Vue - which one to learn first?",
        author: "Sofia Martinez",
        timestamp: "3 hours ago",
      },
      icon: Code,
      color: "bg-indigo-500",
    },
    {
      id: 5,
      title: "Student Life",
      description: "Campus events, social activities, and student experiences",
      category: "social",
      posts: 1089,
      members: 567,
      lastPost: {
        title: "Best study spots on campus?",
        author: "James Wilson",
        timestamp: "6 hours ago",
      },
      icon: Coffee,
      color: "bg-orange-500",
    },
    {
      id: 6,
      title: "Hobbies & Interests",
      description: "Share your hobbies, find activity partners, and organize meetups",
      category: "hobby",
      posts: 432,
      members: 289,
      lastPost: {
        title: "Anyone interested in hiking this weekend?",
        author: "Lisa Zhang",
        timestamp: "5 hours ago",
      },
      icon: Camera,
      color: "bg-pink-500",
    },
  ])

  const [forumPosts, setForumPosts] = useState([
    {
      id: 1,
      title: "Tips for acing your Database Systems final exam",
      content: "After taking the exam last semester, here are some key tips that helped me get an A...",
      author: {
        name: "Alice Chen",
        avatar: "/placeholder.svg?height=32&width=32",
        year: "4th Year",
        major: "Computer Science",
      },
      category: "academic",
      tags: ["database", "exams", "study-tips"],
      timestamp: "2 hours ago",
      likes: 24,
      replies: 8,
      views: 156,
      isLiked: false,
      isBookmarked: true,
      isPinned: false,
    },
    {
      id: 2,
      title: "Google internship interview experience - AMA",
      content:
        "Just finished my Google internship interview process. Happy to answer any questions about the experience...",
      author: {
        name: "David Kim",
        avatar: "/placeholder.svg?height=32&width=32",
        year: "3rd Year",
        major: "Computer Science",
      },
      category: "career",
      tags: ["google", "internship", "interview", "tech"],
      timestamp: "4 hours ago",
      likes: 67,
      replies: 23,
      views: 445,
      isLiked: true,
      isBookmarked: false,
      isPinned: true,
    },
    {
      id: 3,
      title: "Best programming languages to learn in 2024",
      content:
        "With the tech industry evolving rapidly, here's my take on which programming languages are worth learning...",
      author: {
        name: "Emma Rodriguez",
        avatar: "/placeholder.svg?height=32&width=32",
        year: "2nd Year",
        major: "Software Engineering",
      },
      category: "tech",
      tags: ["programming", "career", "2024", "languages"],
      timestamp: "1 day ago",
      likes: 89,
      replies: 34,
      views: 678,
      isLiked: false,
      isBookmarked: true,
      isPinned: false,
    },
  ])

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


  // Filter groups based on search and category
  const filteredGroups = groups.filter((group) => {
    const matchesSearch =
      group.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      group.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      group.tags.some((tag) => tag.toLowerCase().includes(searchQuery.toLowerCase()))

    const matchesCategory = filterCategory === "all" || group.category === filterCategory

    return matchesSearch && matchesCategory
  })

  // Filter forums based on search and category
  const filteredForums = forums.filter((forum) => {
    const matchesSearch =
      forum.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      forum.description.toLowerCase().includes(searchQuery.toLowerCase())

    const matchesCategory = filterCategory === "all" || forum.category === filterCategory

    return matchesSearch && matchesCategory
  })

  // Filter forum posts
  const filteredPosts = forumPosts.filter((post) => {
    const matchesSearch =
      post.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      post.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
      post.tags.some((tag) => tag.toLowerCase().includes(searchQuery.toLowerCase()))

    const matchesCategory = filterCategory === "all" || post.category === filterCategory

    return matchesSearch && matchesCategory
  })

  // Handle joining a group
  const handleJoinGroup = (groupId) => {
    setGroups(
      groups.map((group) => (group.id === groupId ? { ...group, isJoined: true, members: group.members + 1 } : group)),
    )
  }

  // Handle leaving a group
  const handleLeaveGroup = (groupId) => {
    setGroups(
      groups.map((group) => (group.id === groupId ? { ...group, isJoined: false, members: group.members - 1 } : group)),
    )
  }

  // Handle sending a message
  const handleSendMessage = (groupId) => {
    if (!newMessage.trim()) return

    const message = {
      id: Date.now(),
      sender: user.name,
      avatar: user.avatar,
      message: newMessage,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      type: "text",
    }

    setGroups(
      groups.map((group) => (group.id === groupId ? { ...group, messages: [...group.messages, message] } : group)),
    )

    setNewMessage("")
  }

  // Handle post interactions
  const handleLikePost = (postId) => {
    setForumPosts(
      forumPosts.map((post) =>
        post.id === postId
          ? {
              ...post,
              isLiked: !post.isLiked,
              likes: post.isLiked ? post.likes - 1 : post.likes + 1,
            }
          : post,
      ),
    )
  }

  const handleBookmarkPost = (postId) => {
    setForumPosts(forumPosts.map((post) => (post.id === postId ? { ...post, isBookmarked: !post.isBookmarked } : post)))
  }

  const sidebarItems = [
    { name: "Dashboard", icon: Activity, link: "/dashboard" },
    { name: "GPA Calculator", icon: Calculator, link: "/gpa-calculator" },
    { name: "Average Calculator", icon: TrendingUp, link: "/average-calculator" },
    { name: "Blog", icon: PenTool, link: "/blog" },
    { name: "Community", icon: Users, active: true },
    { name: "Calendar", icon: CalendarIcon, link: "/calendar" },
    { name: "Settings", icon: Settings, link: "/settings" },
  ]

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
              href={item.link || "#"}
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
                <span className="font-medium">{groups.filter((g) => g.isJoined).length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Posts Liked</span>
                <span className="font-medium">{forumPosts.filter((p) => p.isLiked).length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Bookmarked</span>
                <span className="font-medium">{forumPosts.filter((p) => p.isBookmarked).length}</span>
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
            <div className="flex items-center gap-4">
              <button onClick={() => setIsSidebarOpen(true)} className="lg:hidden p-2 rounded-md hover:bg-gray-100">
                <Menu className="w-5 h-5" />
              </button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Community</h1>
                <p className="text-sm text-gray-500">Connect with fellow UFAZ students</p>
              </div>
            </div>

            <div className="flex items-center gap-4">
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
              <button
                onClick={() => setShowCreateModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Plus className="w-4 h-4" />
                <span className="hidden sm:inline">Create</span>
              </button>
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
              user={user}
            />
          )}

          {activeTab === "chat" && (
            <ChatView
              groups={groups.filter((g) => g.isJoined)}
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
function ForumsView({ forums, posts, onSelectForum, onLikePost, onBookmarkPost, user }) {
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
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Recent Posts</h2>
          <div className="space-y-4">
            {posts.map((post) => (
              <PostCard
                key={post.id}
                post={post}
                onLike={() => onLikePost(post.id)}
                onBookmark={() => onBookmarkPost(post.id)}
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
function ChatView({ groups, selectedGroup, onSelectGroup, newMessage, onMessageChange, onSendMessage, user }) {
  if (!selectedGroup) {
    return (
      <div className="flex h-full">
        {/* Groups List */}
        <div className="w-80 border-r border-gray-200 bg-white">
          <div className="p-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Your Groups</h2>
          </div>
          <div className="overflow-y-auto">
            {groups.map((group) => (
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
                    <p className="text-sm text-gray-500">{group.members} members</p>
                  </div>
                  {group.messages.length > 0 && <div className="w-2 h-2 bg-blue-600 rounded-full" />}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Empty State */}
        <div className="flex-1 flex items-center justify-center bg-gray-50">
          <div className="text-center">
            <MessageCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Select a group to start chatting</h3>
            <p className="text-gray-600">
              Choose a group from the sidebar to view messages and participate in discussions
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full">
      {/* Groups List */}
      <div className="w-80 border-r border-gray-200 bg-white">
        <div className="p-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Your Groups</h2>
        </div>
        <div className="overflow-y-auto">
          {groups.map((group) => (
            <div
              key={group.id}
              onClick={() => onSelectGroup(group)}
              className={`p-4 border-b border-gray-100 cursor-pointer transition-colors ${
                selectedGroup.id === group.id ? "bg-blue-50 border-blue-200" : "hover:bg-gray-50"
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
                  <p className="text-sm text-gray-500">{group.members} members</p>
                </div>
                {group.messages.length > 0 && selectedGroup.id !== group.id && (
                  <div className="w-2 h-2 bg-blue-600 rounded-full" />
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col bg-white">
        {/* Chat Header */}
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img
                src={selectedGroup.avatar || "/placeholder.svg"}
                alt={selectedGroup.name}
                className="w-10 h-10 rounded-full border-2 border-gray-200"
              />
              <div>
                <h3 className="font-medium text-gray-900">{selectedGroup.name}</h3>
                <p className="text-sm text-gray-500">{selectedGroup.members} members</p>
              </div>
            </div>
            <button className="p-2 text-gray-400 hover:text-gray-600 rounded-lg">
              <MoreHorizontal className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {selectedGroup.messages.map((message) => (
            <div key={message.id} className="flex items-start gap-3">
              <img
                src={message.avatar || "/placeholder.svg"}
                alt={message.sender}
                className="w-8 h-8 rounded-full border-2 border-gray-200"
              />
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-medium text-gray-900">{message.sender}</span>
                  <span className="text-xs text-gray-500">{message.timestamp}</span>
                </div>
                <p className="text-gray-700">{message.message}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Message Input */}
        <div className="p-4 border-t border-gray-200">
          <div className="flex items-center gap-3">
            <input
              type="text"
              placeholder="Type a message..."
              value={newMessage}
              onChange={(e) => onMessageChange(e.target.value)}
              onKeyPress={(e) => e.key === "Enter" && onSendMessage(selectedGroup.id)}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <button
              onClick={() => onSendMessage(selectedGroup.id)}
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
      {group.courseCode && (
        <div className="flex items-center gap-2 mb-3 text-sm text-gray-600">
          <Book className="w-4 h-4" />
          <span>{group.courseCode}</span>
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
            {group.members}/{group.maxMembers}
          </span>
          <span className="flex items-center gap-1">
            <Clock className="w-4 h-4" />
            {group.lastActivity}
          </span>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        {group.isJoined ? (
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
            disabled={group.members >= group.maxMembers}
            className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {group.members >= group.maxMembers ? "Full" : "Join Group"}
          </button>
        )}
      </div>
    </div>
  )
}

// Forum Card Component
function ForumCard({ forum, onSelect }) {
  const ForumIcon = forum.icon

  return (
    <div
      onClick={onSelect}
      className="p-4 bg-white rounded-lg border border-gray-200 hover:shadow-md cursor-pointer transition-all"
    >
      <div className="flex items-center gap-3 mb-3">
        <div className={`w-10 h-10 ${forum.color} rounded-lg flex items-center justify-center`}>
          <ForumIcon className="w-5 h-5 text-white" />
        </div>
        <div>
          <h3 className="font-medium text-gray-900">{forum.title}</h3>
          <p className="text-sm text-gray-500">{forum.description}</p>
        </div>
      </div>

      <div className="flex items-center justify-between text-sm text-gray-500 mb-2">
        <span>{forum.posts} posts</span>
        <span>{forum.members} members</span>
      </div>

      <div className="text-xs text-gray-400">
        <span className="font-medium">{forum.lastPost.title}</span>
        <span>
          {" "}
          by {forum.lastPost.author} • {forum.lastPost.timestamp}
        </span>
      </div>
    </div>
  )
}

// Post Card Component
function PostCard({ post, onLike, onBookmark, user }) {
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
            <h3 className="font-medium text-gray-900">{post.author.name}</h3>
            <p className="text-sm text-gray-500">
              {post.author.year} • {post.author.major}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {post.isPinned && <Pin className="w-4 h-4 text-blue-600" />}
          <span className="text-sm text-gray-500">{post.timestamp}</span>
        </div>
      </div>

      {/* Content */}
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-gray-900 mb-2">{post.title}</h2>
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
            {post.views}
          </span>
          <span className="flex items-center gap-1">
            <MessageSquare className="w-4 h-4" />
            {post.replies}
          </span>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between pt-4 border-t border-gray-200">
        <div className="flex items-center gap-4">
          <button
            onClick={onLike}
            className={`flex items-center gap-2 px-3 py-1 rounded-lg transition-colors ${
              post.isLiked
                ? "text-red-600 bg-red-50 hover:bg-red-100"
                : "text-gray-600 hover:text-red-600 hover:bg-red-50"
            }`}
          >
            <Heart className={`w-4 h-4 ${post.isLiked ? "fill-current" : ""}`} />
            <span>{post.likes}</span>
          </button>

          <button className="flex items-center gap-2 px-3 py-1 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
            <Reply className="w-4 h-4" />
            <span>Reply</span>
          </button>

          <button className="flex items-center gap-2 px-3 py-1 text-gray-600 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors">
            <Share2 className="w-4 h-4" />
            <span>Share</span>
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onBookmark}
            className={`p-2 rounded-lg transition-colors ${
              post.isBookmarked
                ? "text-blue-600 bg-blue-50 hover:bg-blue-100"
                : "text-gray-400 hover:text-blue-600 hover:bg-blue-50"
            }`}
          >
            <Bookmark className={`w-4 h-4 ${post.isBookmarked ? "fill-current" : ""}`} />
          </button>
          <button className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
            <Flag className="w-4 h-4" />
          </button>
        </div>
      </div>
    </article>
  )
}
