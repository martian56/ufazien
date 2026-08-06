"use client"

import { useState, useEffect } from "react"
import { replace, useNavigate } from "react-router-dom"
import { Helmet } from "react-helmet"
import { PenTool, Search, Heart, MessageCircle,Share2,
  Bookmark, Eye, Calendar, Clock, Plus,Menu,X,ThumbsUp,MoreHorizontal,
  Twitter, Facebook, Linkedin, Copy,
} from "lucide-react"

import SideBar from "../../../components/ui/SideBar"
import { formatYearWithOrdinal } from "../../../utils/majorUtils"
import BlogPostCard from "../../../features/blog/BlogPostCard"
import { createExcerpt } from "../../../features/blog/createExcerpt"
import DraftList from "../../../features/blog/DraftList"
import { blogApi } from "../../../lib/api/endpoints/blog"
import type { BlogCategory, BlogPost, BlogTag, CategoryWithCount } from "../../../lib/api/endpoints/blog"
import { api } from "../../../lib/api/client"
import { toList } from "../../../lib/api/types"
import { errorMessage } from "../../../lib/api/errors"
import { logger } from "../../../lib/logger"

/** The category picker prepends an "All" entry, which has no id on the server. */
type CategoryOption = { id: number | "all"; name: string }

/** Only what the header renders. The API never sends another user's email. */
interface BlogUser {
  id?: number
  username?: string
  full_name?: string
  avatar?: string | null
  year?: number | string | null
  major?: string | null
}

export default function Blog() {
  const navigate = useNavigate()
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [activeTab, setActiveTab] = useState("all") // all, following, my-posts
  const [searchQuery, setSearchQuery] = useState("")
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("")
  const [selectedCategory, setSelectedCategory] = useState("all")
  const [selectedTag, setSelectedTag] = useState("")
  const [sortBy, setSortBy] = useState("latest") // latest, popular, trending
  const [blogPosts, setBlogPosts] = useState<BlogPost[]>([])
  const [user, setUser] = useState<BlogUser>({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedPost, setSelectedPost] = useState<BlogPost | null>(null)
  
  // Pagination states
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const [pageSize, setPageSize] = useState(10)
  const [nextPage, setNextPage] = useState<string | null>(null)
  const [previousPage, setPreviousPage] = useState<string | null>(null)
  
  // Categories state
  const [categories, setCategories] = useState<CategoryOption[]>([])
  const [categoriesLoading, setCategoriesLoading] = useState(false)
  
  // Trending tags state
  const [trendingTags, setTrendingTags] = useState<BlogTag[]>([])
  const [tagsLoading, setTagsLoading] = useState(false)

  // Popular posts state (overall, not filtered)
  const [popularPosts, setPopularPosts] = useState<BlogPost[]>([])
  const [popularPostsLoading, setPopularPostsLoading] = useState(false)

  // Categories with counts state (overall, not filtered)
  const [categoriesWithCounts, setCategoriesWithCounts] = useState<CategoryWithCount[]>([])
  const [categoriesCountsLoading, setCategoriesCountsLoading] = useState(false)

  // Share modal state
  const [showShareModal, setShowShareModal] = useState(false)
  const [selectedPostForShare, setSelectedPostForShare] = useState<BlogPost | null>(null)

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery)
    }, 500)

    return () => clearTimeout(timer)
  }, [searchQuery])

  // Fetch user profile add Authentication Header
  useEffect(() => {
    api
      .get<BlogUser>('/auth/user/')
      .then(setUser)
      .catch((error) => logger.error('Error fetching user profile:', error));
  }, []);

  // Fetch categories from API
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        setCategoriesLoading(true)
        const data = toList<BlogCategory>(await blogApi.categories());
        setCategories([{ id: 'all', name: 'All' }, ...data]);
      } catch (error) {
        logger.error("Error fetching categories:", error);
      } finally {
        setCategoriesLoading(false);
      }
    };

    fetchCategories();
  }, []);

  useEffect(() => {
    const fetchPosts = async () => {
      try {
        setLoading(true)
        setError(null)

        const params: Record<string, string | number> = {
          page: currentPage,
          page_size: pageSize,
        }
        if (debouncedSearchQuery.trim()) params.search = debouncedSearchQuery.trim()

        let data
        if (activeTab === "following") {
          // Bookmarks live under their own path. This used to be built from
          // import.meta.env.VITE_API_URL with /api spliced in by hand, which
          // broke whenever that variable already ended in /api.
          data = await blogApi.bookmarks('me', params)
        } else {
          if (activeTab === "my-posts" && user.id) params.by = user.id
          if (selectedCategory !== "all") {
            const category = categories.find(
              (cat) => cat.name.toLowerCase() === selectedCategory.toLowerCase()
            )
            if (category && category.id !== 'all') params.category = category.name
          }
          if (selectedTag.trim()) params.tag = selectedTag.trim()
          data = await blogApi.list(params)
        }

        setBlogPosts(data.results ?? [])
        setTotalCount(data.count ?? 0)
        setNextPage(data.next)
        setPreviousPage(data.previous)
        setTotalPages(Math.max(1, Math.ceil((data.count ?? 0) / pageSize)))
      } catch (error) {
        logger.error("Error fetching blog posts:", error)
        setError(errorMessage(error, "Could not load posts."))
        setBlogPosts([])
      } finally {
        setLoading(false)
      }
    }

    fetchPosts()
  }, [activeTab, user.id, currentPage, selectedCategory, selectedTag, debouncedSearchQuery, categories, pageSize])

  // Fetch trending tags from API
  useEffect(() => {
    const fetchTrendingTags = async () => {
      try {
        setTagsLoading(true)
        setTrendingTags(await blogApi.trendingTags(8))
      } catch (error) {
        // This used to fall back to six invented tags with invented post
        // counts, so an API failure looked exactly like a working sidebar.
        logger.error("Error fetching trending tags:", error)
        setTrendingTags([])
      } finally {
        setTagsLoading(false)
      }
    }

    fetchTrendingTags()
  }, [])

  // Fetch popular posts (overall, not filtered)
  useEffect(() => {
    const fetchPopularPosts = async () => {
      try {
        setPopularPostsLoading(true)
        setPopularPosts(await blogApi.popularPosts(5))
      } catch (error) {
        logger.error("Error fetching popular posts:", error)
        setPopularPosts([])
      } finally {
        setPopularPostsLoading(false)
      }
    }

    fetchPopularPosts()
  }, [])

  // Fetch categories with overall post counts
  useEffect(() => {
    const fetchCategoriesWithCounts = async () => {
      try {
        setCategoriesCountsLoading(true)
        setCategoriesWithCounts(await blogApi.categoriesWithCounts())
      } catch (error) {
        logger.error("Error fetching categories with counts:", error)
        // Names without counts beats no list at all, and a zero here is
        // visibly "not counted" rather than a number we made up.
        setCategoriesWithCounts(
          categories
            .filter((cat): cat is { id: number; name: string } => cat.id !== 'all')
            .map((cat) => ({ ...cat, post_count: 0 }))
        )
      } finally {
        setCategoriesCountsLoading(false)
      }
    }

    if (categories.length > 1) {
      fetchCategoriesWithCounts()
    }
  }, [categories])

  // Since filtering is mostly done server-side, we only need client-side sorting
  const sortedPosts = blogPosts
    .slice() // Create a copy to avoid mutating original array
    .sort((a, b) => {
      switch (sortBy) {
        case "popular":
          return (b.likes_count || 0) - (a.likes_count || 0)
        case "trending":
          return (b.views || 0) - (a.views || 0)
        case "latest":
        default:
          return new Date(b.published_at ?? 0).getTime() - new Date(a.published_at ?? 0).getTime()
      }
    })

  const handleLike = async (postId: number) => {
    try {
      await blogApi.toggleLike(postId)
      setBlogPosts((posts) =>
        posts.map((post) =>
          post.id === postId
            ? {
                ...post,
                is_liked: !post.is_liked,
                likes_count: (post.likes_count ?? 0) + (post.is_liked ? -1 : 1),
              }
            : post,
        ),
      )
    } catch (error) {
      logger.error("Error liking post:", error)
    }
  }

  const handleBookmark = async (postId: number) => {
    try {
      await blogApi.toggleBookmark(postId)
      setBlogPosts((posts) =>
        posts.map((post) =>
          post.id === postId ? { ...post, is_bookmarked: !post.is_bookmarked } : post
        ),
      )
    } catch (error) {
      logger.error("Error bookmarking post:", error);
    }
  }

  const handlePostClick = async (postId: number) => {
    // Navigate to post detail page
    navigate(`/blog/${postId}`);
  }

  const handleShare = (platform: string) => {
    if (!selectedPostForShare) return
    
    const url = `${window.location.origin}/blog/${selectedPostForShare.id}`
    const title = selectedPostForShare.title || "Check out this article"

    const shareUrls: Record<string, string> = {
      twitter: `https://twitter.com/intent/tweet?text=${encodeURIComponent(title)}&url=${encodeURIComponent(url)}`,
      facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
      linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`,
    }

    if (shareUrls[platform]) {
      window.open(shareUrls[platform], "_blank", "width=600,height=400")
    }
  }

  const copyToClipboard = () => {
    if (!selectedPostForShare) return
    
    const url = `${window.location.origin}/blog/${selectedPostForShare.id}`
    navigator.clipboard.writeText(url)
    
    // Show a better notification
    const notification = document.createElement('div')
    notification.className = 'fixed top-4 right-4 bg-green-500 text-white px-4 py-2 rounded-lg shadow-lg z-50'
    notification.textContent = 'Link copied to clipboard!'
    document.body.appendChild(notification)
    
    setTimeout(() => {
      document.body.removeChild(notification)
    }, 3000)
  }

  const handleShareClick = (post: BlogPost) => {
    setSelectedPostForShare(post)
    setShowShareModal(true)
  }

  // Pagination handlers
  const handlePageChange = (page: number) => {
    setCurrentPage(page)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleNextPage = () => {
    if (nextPage && currentPage < totalPages) {
      handlePageChange(currentPage + 1)
    }
  }

  const handlePreviousPage = () => {
    if (previousPage && currentPage > 1) {
      handlePageChange(currentPage - 1)
    }
  }

  // Reset pagination when filters change
  useEffect(() => {
    setCurrentPage(1)
  }, [activeTab, selectedCategory, debouncedSearchQuery, pageSize])

  return (
    <>
      <Helmet>
        <title>Ufazien | Blog</title>
        <meta name="description" content="Read and share articles on Ufazien's blog." />
      </Helmet>
      <div className="min-h-screen bg-gray-50 flex">
        {/* Sidebar */}
        <SideBar
          isSidebarOpen={isSidebarOpen}
          setIsSidebarOpen={setIsSidebarOpen}
          pageTitle="Blog"
        />
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
                <h1 className="text-2xl font-bold text-gray-900">Blog</h1>
                <p className="text-sm text-gray-500">Share your thoughts and experiences</p>
              </div>
            </div>

            <button
              onClick={() => navigate("/blog/new")}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">Write Post</span>
            </button>
          </div>
        </header>

        {/* Blog Content */}
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            {/* Filters and Search */}
            <div className="mb-8">
              {/* Tab Navigation */}
              <div className="flex items-center gap-1 mb-6 border-b border-gray-200">
                <button
                  onClick={() => {
                    setActiveTab("all");
                    setSelectedTag(""); // Clear tag filter when switching tabs
                    setCurrentPage(1);
                  }}
                  className={`px-4 py-2 font-medium transition-colors ${
                    activeTab === "all"
                      ? "text-blue-600 border-b-2 border-blue-600"
                      : "text-gray-600 hover:text-gray-900"
                  }`}
                >
                  All Posts
                </button>
                <button
                  onClick={() => {
                    setActiveTab("following");
                    setSelectedTag(""); // Clear tag filter when switching tabs
                    setCurrentPage(1);
                  }}
                  className={`px-4 py-2 font-medium transition-colors ${
                    activeTab === "following"
                      ? "text-blue-600 border-b-2 border-blue-600"
                      : "text-gray-600 hover:text-gray-900"
                  }`}
                >
                  Bookmarked
                </button>
                <button
                  onClick={() => {
                    setActiveTab("my-posts");
                    setSelectedTag(""); // Clear tag filter when switching tabs
                    setCurrentPage(1);
                  }}
                  className={`px-4 py-2 font-medium transition-colors ${
                    activeTab === "my-posts"
                      ? "text-blue-600 border-b-2 border-blue-600"
                      : "text-gray-600 hover:text-gray-900"
                  }`}
                >
                  My Posts
                </button>

                <button
                  onClick={() => {
                    setActiveTab("drafts");
                    setSelectedTag("");
                    setCurrentPage(1);
                  }}
                  className={`px-4 py-2 font-medium transition-colors ${
                    activeTab === "drafts"
                      ? "text-blue-600 border-b-2 border-blue-600"
                      : "text-gray-600 hover:text-gray-900"
                  }`}
                >
                  Drafts
                </button>
              </div>

              {/* Search and Filters */}
              <div className="flex flex-col sm:flex-row gap-4">
                {/* Search */}
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <input
                    type="text"
                    placeholder="Search posts, tags, or authors..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-12 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery("")}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                  {debouncedSearchQuery && debouncedSearchQuery !== searchQuery && (
                    <div className="absolute -bottom-6 left-0">
                      <span className="text-xs text-blue-600 bg-blue-100 px-2 py-1 rounded">
                        Searching...
                      </span>
                    </div>
                  )}
                </div>

                {/* Category Filter */}
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  disabled={categoriesLoading}
                >
                  {categories.map((category) => (
                    <option key={category.id} value={category.id === 'all' ? 'all' : category.name.toLowerCase()}>
                      {category.name}
                    </option>
                  ))}
                </select>

                {/* Sort Filter */}
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="latest">Latest</option>
                  <option value="popular">Most Liked</option>
                  <option value="trending">Most Viewed</option>
                </select>

                {/* Page Size Selector */}
                <select
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(parseInt(e.target.value));
                    setCurrentPage(1); // Reset to first page when changing page size
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value={10}>10 per page</option>
                  <option value={20}>20 per page</option>
                  <option value={50}>50 per page</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
              {/* Search Results Info */}
              {debouncedSearchQuery && (
                <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-sm text-blue-800">
                    Found {totalCount} result{totalCount !== 1 ? 's' : ''} for "<strong>{debouncedSearchQuery}</strong>"
                    {selectedCategory !== "all" && ` in category "${selectedCategory}"`}
                  </p>
                </div>
              )}

              {/* Main Content */}
              <div className="lg:col-span-3">
                {activeTab === "drafts" ? (
                  <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-6">
                    <h2 className="text-lg font-semibold text-gray-900">Your drafts</h2>
                    <p className="mt-1 text-sm text-gray-500">
                      Unfinished posts, visible only to you. Pick one up where you left off.
                    </p>
                    <div className="mt-4">
                      <DraftList />
                    </div>
                  </div>
                ) : loading ? (
                  <div className="text-center py-12">
                    <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-gray-600">Loading posts...</p>
                  </div>
                ) : error ? (
                  <div className="text-center py-12">
                    <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <span className="text-red-600 text-xl">!</span>
                    </div>
                    <h3 className="text-lg font-medium text-gray-900 mb-2">Error loading posts</h3>
                    <p className="text-gray-600 mb-4">{error}</p>
                    <button
                      onClick={() => window.location.reload()}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      Try Again
                    </button>
                  </div>
                ) : sortedPosts.length === 0 ? (
                  <div className="text-center py-12">
                    <PenTool className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">
                      {activeTab === "my-posts" ? "No posts yet" : "No posts found"}
                    </h3>
                    <p className="text-gray-600 mb-4">
                      {activeTab === "my-posts" 
                        ? "You haven't written any posts yet. Share your first thought!"
                        : searchQuery || selectedCategory !== "all"
                        ? "Try adjusting your search or filters"
                        : "Be the first to share your thoughts!"}
                    </p>
                    <button
                      onClick={() => navigate("/blog/new")}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      {activeTab === "my-posts" ? "Write Your First Post" : "Write First Post"}
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="space-y-6">
                      {sortedPosts.map((post) => (
                        <BlogPostCard
                          key={post.id}
                          post={post}
                          onLike={handleLike}
                          onBookmark={handleBookmark}
                          onPostClick={handlePostClick}
                          onSelect={setSelectedPost}
                          currentUser={user}
                          onShare={handleShareClick}
                        />
                      ))}
                    </div>
                    
                    {/* Pagination */}
                    {totalPages > 1 && (
                      <div className="mt-8 flex items-center justify-between">
                        <div className="text-sm text-gray-600">
                          Showing {((currentPage - 1) * pageSize) + 1} to {Math.min(currentPage * pageSize, totalCount)} of {totalCount} posts
                        </div>
                        
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={handlePreviousPage}
                            disabled={!previousPage || loading}
                            className="px-3 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                          >
                            Previous
                          </button>
                          
                          <div className="flex items-center space-x-1">
                            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                              let pageNum;
                              if (totalPages <= 5) {
                                pageNum = i + 1;
                              } else if (currentPage <= 3) {
                                pageNum = i + 1;
                              } else if (currentPage >= totalPages - 2) {
                                pageNum = totalPages - 4 + i;
                              } else {
                                pageNum = currentPage - 2 + i;
                              }
                              
                              return (
                                <button
                                  key={pageNum}
                                  onClick={() => handlePageChange(pageNum)}
                                  disabled={loading}
                                  className={`px-3 py-2 text-sm rounded-md transition-colors ${
                                    currentPage === pageNum
                                      ? 'bg-blue-600 text-white'
                                      : 'border border-gray-300 hover:bg-gray-50 disabled:opacity-50'
                                  }`}
                                >
                                  {pageNum}
                                </button>
                              );
                            })}
                          </div>
                          
                          <button
                            onClick={handleNextPage}
                            disabled={!nextPage || loading}
                            className="px-3 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                          >
                            Next
                          </button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Sidebar */}
              <div className="space-y-6">
                {/* Trending Tags */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-gray-900">Trending Tags</h3>
                    {selectedTag && (
                      <button
                        onClick={() => {
                          setSelectedTag("");
                          setCurrentPage(1);
                        }}
                        className="text-xs text-gray-500 hover:text-gray-700 underline"
                      >
                        Clear filter
                      </button>
                    )}
                  </div>
                  {selectedTag && (
                    <div className="mb-3 px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg">
                      <span className="text-sm text-blue-700">
                        Filtering by: <strong>#{selectedTag}</strong>
                      </span>
                    </div>
                  )}
                  {tagsLoading ? (
                    <div className="flex items-center justify-center py-4">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {trendingTags.map((tag) => (
                        <button
                          key={tag.id}
                          onClick={() => {
                            setSelectedTag(tag.name);
                            setCurrentPage(1); // Reset to first page when filtering by tag
                          }}
                          className={`px-3 py-1 rounded-full text-sm transition-colors flex items-center gap-1 ${
                            selectedTag === tag.name
                              ? "bg-blue-500 text-white"
                              : "bg-blue-100 text-blue-700 hover:bg-blue-200"
                          }`}
                        >
                          <span>#{tag.name}</span>
                          <span className="text-xs opacity-75">({tag.post_count})</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Popular Posts */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Popular This Week</h3>
                  {popularPostsLoading ? (
                    <div className="flex items-center justify-center py-4">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
                    </div>
                  ) : popularPosts.length === 0 ? (
                    <p className="text-gray-500 text-sm">No popular posts yet</p>
                  ) : (
                    <div className="space-y-4">
                      {popularPosts.slice(0, 3).map((post, index) => (
                        <div key={post.id} className="flex items-start gap-3">
                          <div className="w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-medium">
                            {index + 1}
                          </div>
                          <div className="flex-1 min-w-0">
                            <h4 
                              onClick={() => handlePostClick(post.id)} 
                              className="font-medium text-gray-900 text-sm line-clamp-2 cursor-pointer hover:text-blue-600"
                            >
                              {post.title}
                            </h4>
                            <p className="text-xs text-gray-500 mt-1">
                              {post.likes_count || 0} likes • {post.views || 0} views
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Categories */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Categories</h3>
                  {categoriesCountsLoading ? (
                    <div className="flex items-center justify-center py-4">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {categoriesWithCounts.map((category) => (
                        <button
                          key={category.id}
                          onClick={() => setSelectedCategory(category.name.toLowerCase())}
                          className={`flex items-center justify-between w-full text-left px-3 py-2 rounded-lg transition-colors ${
                            selectedCategory === category.name.toLowerCase()
                              ? "bg-blue-100 text-blue-700"
                              : "text-gray-700 hover:bg-gray-100"
                          }`}
                        >
                          <span>{category.name}</span>
                          <span className="text-sm text-gray-500">
                            {category.post_count || 0}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>

      {/* Share Modal */}
      {showShareModal && selectedPostForShare && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="rounded-xl w-full max-w-md bg-white">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Share Article</h3>
                <button
                  onClick={() => {
                    setShowShareModal(false)
                    setSelectedPostForShare(null)
                  }}
                  className="p-2 rounded-lg transition-colors hover:bg-gray-100"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-4">
              <div className="mb-4">
                <h4 className="font-medium text-gray-900 mb-1">{selectedPostForShare.title}</h4>
                <p className="text-sm text-gray-500">by {selectedPostForShare.author.first_name} {selectedPostForShare.author.last_name}</p>
              </div>

              <button
                onClick={() => handleShare("twitter")}
                className="w-full flex items-center space-x-3 p-3 rounded-lg hover:bg-blue-50 hover:text-blue-600 transition-colors"
              >
                <Twitter className="w-5 h-5" />
                <span>Share on Twitter</span>
              </button>

              <button
                onClick={() => handleShare("facebook")}
                className="w-full flex items-center space-x-3 p-3 rounded-lg hover:bg-blue-50 hover:text-blue-600 transition-colors"
              >
                <Facebook className="w-5 h-5" />
                <span>Share on Facebook</span>
              </button>

              <button
                onClick={() => handleShare("linkedin")}
                className="w-full flex items-center space-x-3 p-3 rounded-lg hover:bg-blue-50 hover:text-blue-600 transition-colors"
              >
                <Linkedin className="w-5 h-5" />
                <span>Share on LinkedIn</span>
              </button>

              <button
                onClick={copyToClipboard}
                className="w-full flex items-center space-x-3 p-3 rounded-lg hover:bg-gray-50 hover:text-gray-600 transition-colors"
              >
                <Copy className="w-5 h-5" />
                <span>Copy Link</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mobile Sidebar Overlay */}
      {isSidebarOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden" onClick={() => setIsSidebarOpen(false)} />
      )}
    </div>
  </>
  )
}
