import { useState, useEffect } from "react"
import { Helmet } from "react-helmet"
import { useParams, useNavigate } from "react-router-dom"
import {
  User,
  Mail,
  Phone,
  Calendar,
  MapPin,
  BookOpen,
  Users,
  Eye,
  Heart,
  MessageCircle,
  Share2,
  Edit,
  UserPlus,
  UserMinus,
  GraduationCap,
  Trophy,
  Clock,
  Menu,
  ChevronRight,
  ChevronLeft,
  Shield,
  Ban
} from "lucide-react"
import SideBar from "../components/ui/SideBar"
import { formatYearDisplay, getYearDisplay } from "../utils/majorUtils"

const API_URL = import.meta.env.VITE_API_URL

export default function Profile() {
  const { userId } = useParams()
  const navigate = useNavigate()
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [user, setUser] = useState(null)
  const [userPosts, setUserPosts] = useState([])
  const [currentUser, setCurrentUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [postsLoading, setPostsLoading] = useState(true)
  const [following, setFollowing] = useState(false)
  const [activeTab, setActiveTab] = useState("posts")
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [hasNext, setHasNext] = useState(false)
  const [hasPrevious, setHasPrevious] = useState(false)
  const postsPerPage = 10
  const [stats, setStats] = useState({
    posts: 0,
    followers: 0,
    following: 0
  })


  // Fetch current user
  useEffect(() => {
    const fetchCurrentUser = async () => {
      try {
        const token = localStorage.getItem('access')
        if (!token) {
          navigate('/auth')
          return
        }

        const response = await fetch(`${API_URL}/api/auth/user/`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        })

        if (response.ok) {
          const userData = await response.json()
          setCurrentUser(userData)
        } else {
          console.error('Failed to fetch current user:', response.status, response.statusText)
        }
      } catch (error) {
        console.error('Error fetching current user:', error)
      }
    }

    fetchCurrentUser()
  }, [navigate])

  // Fetch user profile
  useEffect(() => {
    const fetchUserProfile = async () => {
      try {
        const token = localStorage.getItem('access')
        if (!token) {
          navigate('/auth')
          return
        }

        const targetUserId = userId || 'me'
        const response = await fetch(`${API_URL}/api/auth/user/${targetUserId}/`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        })

        if (response.ok) {
          const userData = await response.json()
          setUser(userData)
          console.log("User data:", userData)
          setFollowing(userData.is_following || false)
          setStats(prev => ({
            ...prev,
            followers: userData.followers_count || 0,
            following: userData.following_count || 0
          }))
        } else {
          console.error('Failed to fetch user profile:', response.status, response.statusText)
        }
      } catch (error) {
        console.error('Error fetching user profile:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchUserProfile()
  }, [userId, navigate])

  // Fetch user's blog posts with pagination
  const fetchUserPosts = async (page = 1) => {
    if (!user) return

    setPostsLoading(true)
    try {
      const token = localStorage.getItem('access')
      const offset = (page - 1) * postsPerPage
      const response = await fetch(`${API_URL}/api/blog/posts/?by=${user.id}&limit=${postsPerPage}&offset=${offset}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      })

      if (response.ok) {
        const data = await response.json()
        setUserPosts(data.results || [])
        setStats(prev => ({
          ...prev,
          posts: data.count || 0
        }))
        
        // Calculate pagination info
        const totalPosts = data.count || 0
        const calculatedTotalPages = Math.ceil(totalPosts / postsPerPage)
        setTotalPages(calculatedTotalPages)
        setHasNext(data.next !== null)
        setHasPrevious(data.previous !== null)
      } else {
        console.error('Failed to fetch user posts:', response.status, response.statusText)
      }
    } catch (error) {
      console.error('Error fetching user posts:', error)
    } finally {
      setPostsLoading(false)
    }
  }

  // Initial fetch of user's blog posts
  useEffect(() => {
    if (user) {
      setCurrentPage(1)
      fetchUserPosts(1)
    }
  }, [user])

  // Handle page change
  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setCurrentPage(newPage)
      fetchUserPosts(newPage)
    }
  }

  // Handle follow/unfollow
  const handleFollowToggle = async () => {
    if (!user || !currentUser) return

    try {
      const token = localStorage.getItem('access')
      const response = await fetch(`${API_URL}/api/auth/user/${user.id}/follow/`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      })

      if (response.ok) {
        const responseData = await response.json()
        const isOwnProfile = currentUser && user && currentUser.id === user.id
        setFollowing(!following)
        setStats(prev => ({
          ...prev,
          followers: following ? prev.followers - 1 : prev.followers + 1,
          // Update following count if this is the current user's own profile
          ...(isOwnProfile && { following: responseData.following_count || prev.following })
        }))
      } else {
        console.error('Failed to toggle follow:', response.status, response.statusText)
      }
    } catch (error) {
      console.error('Error toggling follow:', error)
    }
  }

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  const isOwnProfile = currentUser && user && currentUser.id === user.id

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex">
        <SideBar 
          isSidebarOpen={isSidebarOpen} 
          setIsSidebarOpen={setIsSidebarOpen}
          pageTitle="Profile"
        />
        <div className="flex-1 lg:ml-64">
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        </div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex">
        <SideBar 
          isSidebarOpen={isSidebarOpen} 
          setIsSidebarOpen={setIsSidebarOpen}
          pageTitle="Profile"
        />
        <div className="flex-1 lg:ml-64">
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">User Not Found</h2>
              <p className="text-gray-600">The user you're looking for doesn't exist.</p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <>
      <Helmet>
        <title>Ufazien | Profile : {user.first_name} {user.last_name}</title>
        <meta name="description" content={`Profile page of ${user.first_name} ${user.last_name}`} />
      </Helmet>
      <div className="min-h-screen bg-gray-50 flex">
        <SideBar
          isSidebarOpen={isSidebarOpen}
          setIsSidebarOpen={setIsSidebarOpen}
          pageTitle="Profile"
        />
      
      <div className={`flex-1 transition-all duration-300 ${
        isSidebarOpen ? 'lg:ml-64' : ''
      }`}>
        {/* Mobile header */}
        <div className="lg:hidden bg-white shadow-sm border-b border-gray-200 px-4 py-3 flex items-center justify-between">
          <button
            onClick={() => setIsSidebarOpen(true)}
            className="p-2 rounded-md text-gray-600 hover:text-gray-900 hover:bg-gray-100"
          >
            <Menu className="h-6 w-6" />
          </button>
          <h1 className="text-lg font-semibold text-gray-900">Profile</h1>
          <div className="w-10"></div>
        </div>

        <div className="w-full max-w-6xl mx-auto px-4 py-8">
          {/* Profile Header */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            {/* Cover Photo Area */}
            <div className="h-32 bg-gradient-to-r from-blue-600 to-indigo-600"></div>
            
            {/* Profile Info */}
            <div className="px-6 py-6">
              <div className="flex flex-col sm:flex-row sm:items-end sm:space-x-6">
                {/* Avatar */}
                <div className="relative -mt-16 sm:-mt-16 mb-4 sm:mb-0">
                  <div className="w-24 h-24 bg-white rounded-full border-4 border-white shadow-lg flex items-center justify-center">
                    {user.avatar_url ? (
                      <img 
                        src={user.avatar_url} 
                        alt={`${user.first_name} ${user.last_name}`}
                        className="w-20 h-20 rounded-full object-cover"
                      />
                    ) : (
                      <User className="w-12 h-12 text-gray-400" />
                    )}
                  </div>
                </div>

                {/* User Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <h1 className="text-2xl font-bold text-gray-900">
                          {user.first_name} {user.last_name}
                        </h1>
                        {user.is_staff && (
                          <div className="flex items-center bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-xs font-medium">
                            <Shield className="w-3 h-3 mr-1" />
                            Staff
                          </div>
                        )}
                        {!user.is_active && (
                          <div className="flex items-center bg-red-100 text-red-800 px-2 py-1 rounded-full text-xs font-medium">
                            <Ban className="w-3 h-3 mr-1" />
                            Banned
                          </div>
                        )}
                      </div>
                      {user.bio && (
                        <p className="mt-2 text-gray-700">{user.bio}</p>
                      )}
                    </div>
                    
                    {/* Action Buttons */}
                    <div className="mt-4 sm:mt-0 flex space-x-3">
                      {isOwnProfile ? (
                        <button
                          onClick={() => navigate('/settings')}
                          className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                        >
                          <Edit className="w-4 h-4 mr-2" />
                          Edit Profile
                        </button>
                      ) : (
                        <button
                          onClick={handleFollowToggle}
                          className={`flex items-center px-4 py-2 rounded-lg transition-colors ${
                            following
                              ? 'bg-gray-200 text-gray-800 hover:bg-gray-300'
                              : 'bg-blue-600 text-white hover:bg-blue-700'
                          }`}
                        >
                          {following ? (
                            <>
                              <UserMinus className="w-4 h-4 mr-2" />
                              Unfollow
                            </>
                          ) : (
                            <>
                              <UserPlus className="w-4 h-4 mr-2" />
                              Follow
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* User Details */}
              <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {user.major && (
                  <div className="flex items-center text-gray-600">
                    <GraduationCap className="w-4 h-4 mr-2" />
                    <span>{user.major}</span>
                  </div>
                )}
                {user.year && (
                  <div className="flex items-center text-gray-600">
                    <Calendar className="w-4 h-4 mr-2" />
                    <span>{formatYearDisplay(user.year)}</span>
                  </div>
                )}
                {user.email && isOwnProfile && (
                  <div className="flex items-center text-gray-600">
                    <Mail className="w-4 h-4 mr-2" />
                    <span>{user.email}</span>
                  </div>
                )}
              </div>

              {/* Stats */}
              <div className="mt-6 flex space-x-8">
                <div className="text-center">
                  <div className="text-2xl font-bold text-gray-900">{stats.posts}</div>
                  <div className="text-sm text-gray-600">Posts</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-gray-900">{stats.followers}</div>
                  <div className="text-sm text-gray-600">Followers</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-gray-900">{stats.following}</div>
                  <div className="text-sm text-gray-600">Following</div>
                </div>
              </div>
            </div>
          </div>

          {/* Content Tabs */}
          <div className="mt-8">
            <div className="border-b border-gray-200">
              <nav className="-mb-px flex space-x-8">
                <button
                  onClick={() => setActiveTab('posts')}
                  className={`py-2 px-1 border-b-2 font-medium text-sm ${
                    activeTab === 'posts'
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  Blog Posts
                </button>
                <button
                  onClick={() => setActiveTab('about')}
                  className={`py-2 px-1 border-b-2 font-medium text-sm ${
                    activeTab === 'about'
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  About
                </button>
              </nav>
            </div>

            {/* Tab Content */}
            <div className="mt-6">
              {activeTab === 'posts' && (
                <div>
                  {postsLoading ? (
                    <div className="flex justify-center py-8">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                    </div>
                  ) : userPosts.length > 0 ? (
                    <>
                      <div className="space-y-6">
                        {userPosts.map((post) => (
                          <div key={post.id} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <h3 
                                  className="text-xl font-semibold text-gray-900 cursor-pointer hover:text-blue-600"
                                  onClick={() => navigate(`/blog/${post.id}`)}
                                >
                                  {post.title}
                                </h3>
                                <p className="mt-2 text-gray-600 line-clamp-3">{post.content}</p>
                                
                                <div className="mt-4 flex items-center justify-between">
                                  <div className="flex items-center space-x-4 text-sm text-gray-500">
                                    <div className="flex items-center">
                                      <Clock className="w-4 h-4 mr-1" />
                                      {formatDate(post.published_at)}
                                    </div>
                                    <div className="flex items-center">
                                      <Eye className="w-4 h-4 mr-1" />
                                      {post.views || 0}
                                    </div>
                                    <div className="flex items-center">
                                      <Heart className="w-4 h-4 mr-1" />
                                      {post.likes_count || 0}
                                    </div>
                                    <div className="flex items-center">
                                      <MessageCircle className="w-4 h-4 mr-1" />
                                      {post.comments_count || 0}
                                    </div>
                                  </div>
                                  
                                  <button
                                    onClick={() => navigate(`/blog/post/${post.id}`)}
                                    className="flex items-center text-blue-600 hover:text-blue-700"
                                  >
                                    Read more
                                    <ChevronRight className="w-4 h-4 ml-1" />
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                      
                      {/* Pagination Controls */}
                      {totalPages > 1 && (
                        <div className="mt-8">
                          {/* Desktop Pagination */}
                          <div className="hidden sm:flex items-center justify-between">
                            <div className="flex items-center space-x-2">
                              <button
                                onClick={() => handlePageChange(currentPage - 1)}
                                disabled={!hasPrevious}
                                className={`flex items-center px-3 py-2 rounded-lg text-sm font-medium ${
                                  hasPrevious
                                    ? 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
                                    : 'bg-gray-100 border border-gray-200 text-gray-400 cursor-not-allowed'
                                }`}
                              >
                                <ChevronLeft className="w-4 h-4 mr-1" />
                                Previous
                              </button>
                              
                              <div className="flex items-center space-x-1">
                                {(() => {
                                  const showPages = []
                                  const maxVisiblePages = 5
                                  
                                  if (totalPages <= maxVisiblePages) {
                                    // Show all pages if total is small
                                    for (let i = 1; i <= totalPages; i++) {
                                      showPages.push(i)
                                    }
                                  } else {
                                    // Show first page, current page range, and last page with ellipsis
                                    if (currentPage <= 3) {
                                      for (let i = 1; i <= 4; i++) showPages.push(i)
                                      showPages.push('...')
                                      showPages.push(totalPages)
                                    } else if (currentPage >= totalPages - 2) {
                                      showPages.push(1)
                                      showPages.push('...')
                                      for (let i = totalPages - 3; i <= totalPages; i++) showPages.push(i)
                                    } else {
                                      showPages.push(1)
                                      showPages.push('...')
                                      for (let i = currentPage - 1; i <= currentPage + 1; i++) showPages.push(i)
                                      showPages.push('...')
                                      showPages.push(totalPages)
                                    }
                                  }
                                  
                                  return showPages.map((page, index) => (
                                    page === '...' ? (
                                      <span key={index} className="px-3 py-2 text-gray-500">...</span>
                                    ) : (
                                      <button
                                        key={page}
                                        onClick={() => handlePageChange(page)}
                                        className={`px-3 py-2 rounded-lg text-sm font-medium ${
                                          currentPage === page
                                            ? 'bg-blue-600 text-white'
                                            : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
                                        }`}
                                      >
                                        {page}
                                      </button>
                                    )
                                  ))
                                })()}
                              </div>
                              
                              <button
                                onClick={() => handlePageChange(currentPage + 1)}
                                disabled={!hasNext}
                                className={`flex items-center px-3 py-2 rounded-lg text-sm font-medium ${
                                  hasNext
                                    ? 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
                                    : 'bg-gray-100 border border-gray-200 text-gray-400 cursor-not-allowed'
                                }`}
                              >
                                Next
                                <ChevronRight className="w-4 h-4 ml-1" />
                              </button>
                            </div>
                            
                            <div className="text-sm text-gray-600">
                              Showing {((currentPage - 1) * postsPerPage) + 1} to {Math.min(currentPage * postsPerPage, stats.posts)} of {stats.posts} posts
                            </div>
                          </div>

                          {/* Mobile Pagination */}
                          <div className="sm:hidden flex items-center justify-between">
                            <button
                              onClick={() => handlePageChange(currentPage - 1)}
                              disabled={!hasPrevious}
                              className={`flex items-center px-3 py-2 rounded-lg text-sm font-medium ${
                                hasPrevious
                                  ? 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
                                  : 'bg-gray-100 border border-gray-200 text-gray-400 cursor-not-allowed'
                              }`}
                            >
                              <ChevronLeft className="w-4 h-4 mr-1" />
                              Previous
                            </button>
                            
                            <div className="text-sm text-gray-600">
                              Page {currentPage} of {totalPages}
                            </div>
                            
                            <button
                              onClick={() => handlePageChange(currentPage + 1)}
                              disabled={!hasNext}
                              className={`flex items-center px-3 py-2 rounded-lg text-sm font-medium ${
                                hasNext
                                  ? 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
                                  : 'bg-gray-100 border border-gray-200 text-gray-400 cursor-not-allowed'
                              }`}
                            >
                              Next
                              <ChevronRight className="w-4 h-4 ml-1" />
                            </button>
                          </div>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="text-center py-12">
                      <BookOpen className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                      <h3 className="text-lg font-medium text-gray-900 mb-2">No posts yet</h3>
                      <p className="text-gray-600">
                        {isOwnProfile 
                          ? "You haven't written any blog posts yet." 
                          : `${user.first_name} hasn't written any blog posts yet.`
                        }
                      </p>
                      {isOwnProfile && (
                        <button
                          onClick={() => navigate('/blog/new')}
                          className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                        >
                          Write your first post
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'about' && (
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">About</h3>
                  <div className="space-y-4">
                    {user.bio && (
                      <div>
                        <h4 className="text-sm font-medium text-gray-700 mb-1">Bio</h4>
                        <p className="text-gray-600">{user.bio}</p>
                      </div>
                    )}
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {user.major && (
                        <div>
                          <h4 className="text-sm font-medium text-gray-700 mb-1">Major</h4>
                          <p className="text-gray-600">{user.major}</p>
                        </div>
                      )}
                      {user.year && (
                        <div>
                          <h4 className="text-sm font-medium text-gray-700 mb-1">Year</h4>
                          <p className="text-gray-600">{formatYearDisplay(user.year)}</p>
                        </div>
                      )}
                      {user.completed_credits && (
                        <div>
                          <h4 className="text-sm font-medium text-gray-700 mb-1">Completed Credits</h4>
                          <p className="text-gray-600">{user.completed_credits}</p>
                        </div>
                      )}
                    </div>

                    {(user.email && isOwnProfile) || user.phone && (
                      <div>
                        <h4 className="text-sm font-medium text-gray-700 mb-2">Contact Information</h4>
                        <div className="space-y-2">
                          {user.email && isOwnProfile && (
                            <div className="flex items-center text-gray-600">
                              <Mail className="w-4 h-4 mr-2" />
                              <span>{user.email}</span>
                            </div>
                          )}
                          {user.phone && (
                            <div className="flex items-center text-gray-600">
                              <Phone className="w-4 h-4 mr-2" />
                              <span>{user.phone}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
    </>
  )
}
