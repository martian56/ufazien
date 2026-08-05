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
import DraftList from "../../../features/blog/DraftList"
import { apiFetch } from "../../../lib/api/compat"

const API_URL = import.meta.env.VITE_API_URL

// Helper function to strip HTML tags and create clean text preview
const stripHtmlTags = (html) => {
  if (!html) return ''
  const div = document.createElement('div')
  div.innerHTML = html
  return div.textContent || div.innerText || ''
}

// Helper function to create excerpt from content
const createExcerpt = (content, maxLength = 150) => {
  if (!content) return ''
  const plainText = stripHtmlTags(content)
  if (plainText.length <= maxLength) return plainText
  return plainText.substring(0, maxLength).trim() + '...'
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
  const [blogPosts, setBlogPosts] = useState([])
  const [user, setUser] = useState({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [selectedPost, setSelectedPost] = useState(null)
  
  // Pagination states
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const [pageSize, setPageSize] = useState(10)
  const [nextPage, setNextPage] = useState(null)
  const [previousPage, setPreviousPage] = useState(null)
  
  // Categories state
  const [categories, setCategories] = useState([])
  const [categoriesLoading, setCategoriesLoading] = useState(false)
  
  // Trending tags state
  const [trendingTags, setTrendingTags] = useState([])
  const [tagsLoading, setTagsLoading] = useState(false)

  // Popular posts state (overall, not filtered)
  const [popularPosts, setPopularPosts] = useState([])
  const [popularPostsLoading, setPopularPostsLoading] = useState(false)

  // Categories with counts state (overall, not filtered)
  const [categoriesWithCounts, setCategoriesWithCounts] = useState([])
  const [categoriesCountsLoading, setCategoriesCountsLoading] = useState(false)

  // Share modal state
  const [showShareModal, setShowShareModal] = useState(false)
  const [selectedPostForShare, setSelectedPostForShare] = useState(null)

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery)
    }, 500)

    return () => clearTimeout(timer)
  }, [searchQuery])

  // Fetch user profile add Authentication Header
  useEffect(() => {
    apiFetch(`/auth/user/`)
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch user profile");
        return res.json();
      })
      .then((data) => {
        setUser(data);
      })
      .catch((error) => {
        console.error("Error fetching user profile:", error);
      });
  }, []);

  // Fetch categories from API
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        setCategoriesLoading(true)
        const res = await apiFetch(`/blog/categories/`);
        if (!res.ok) throw new Error("Failed to fetch categories");
        
        const data = await res.json();
        // console.log("Fetched categories:", data);
        setCategories([{ id: 'all', name: 'All' }, ...data.results]);
      } catch (error) {
        console.error("Error fetching categories:", error);
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
        let url = `/blog/posts/?page=${currentPage}&page_size=${pageSize}`;
        let isBookmarksEndpoint = false;
        
        // Add filters based on active tab and selections
        if (activeTab === "my-posts" && user.id) {
          url += `&by=${user.id}`;
        } else if (activeTab === "following") {
          // For bookmarked posts, use different endpoint but still support search
          url = `${API_URL}/api/blog/bookmarks/me/?page=${currentPage}&page_size=${pageSize}`;
          isBookmarksEndpoint = true;
        }
          // Add category filter (only for main posts endpoint)
        if (!isBookmarksEndpoint && selectedCategory !== "all") {
          const category = categories.find(cat => cat.name.toLowerCase() === selectedCategory.toLowerCase());
          if (category && category.id !== 'all') {
            url += `&category=${category.name}`;
          }
        }
        
        // Add tag filter (only for main posts endpoint)
        if (!isBookmarksEndpoint && selectedTag.trim()) {
          url += `&tag=${encodeURIComponent(selectedTag)}`;
        }

        // Add search query
        if (debouncedSearchQuery.trim()) {
          url += `&search=${encodeURIComponent(debouncedSearchQuery)}`;
        }
        
        // console.log("Fetching from URL:", url);
        // console.log("Current pageSize state:", pageSize);
        
        const res = await apiFetch(url);
        if (!res.ok) throw new Error("Failed to fetch blog posts");
        
        const data = await res.json();
        // console.log("Fetched blog posts:", data);
        // console.log("Backend page_size:", data.page_size, "Frontend pageSize:", pageSize);
        
        // Handle pagination data
        setBlogPosts(data.results || data);
        setTotalCount(data.count || 0);
        setNextPage(data.next);
        setPreviousPage(data.previous);
        
        // Calculate total pages using current pageSize (user's selection)
        if (data.total_pages) {
          setTotalPages(data.total_pages);
        } else if (data.count) {
          setTotalPages(Math.ceil(data.count / pageSize));
        }
        
      } catch (error) {
        console.error("Error fetching blog posts:", error);
        setError(error.message);
        setBlogPosts([]);
      } finally {
        setLoading(false);
      }
    };

    fetchPosts();
  }, [activeTab, user.id, currentPage, selectedCategory, selectedTag, debouncedSearchQuery, categories, pageSize]); // Re-fetch when dependencies change

  // Fetch trending tags from API
  useEffect(() => {
    const fetchTrendingTags = async () => {
      try {
        setTagsLoading(true)
        const res = await apiFetch(`/blog/tags/trending/?limit=8`);
        if (!res.ok) throw new Error("Failed to fetch trending tags");
        
        const data = await res.json();
        // console.log("Fetched trending tags:", data);
        setTrendingTags(data);
      } catch (error) {
        console.error("Error fetching trending tags:", error);
        // Fallback to hardcoded tags if API fails
        setTrendingTags([
          { id: 1, name: "study-tips", post_count: 5 },
          { id: 2, name: "programming", post_count: 4 },
          { id: 3, name: "exchange", post_count: 3 },
          { id: 4, name: "research", post_count: 3 },
          { id: 5, name: "career", post_count: 2 },
          { id: 6, name: "exams", post_count: 2 },
        ]);
      } finally {
        setTagsLoading(false);
      }
    };

    fetchTrendingTags();
  }, []);

  // Fetch popular posts (overall, not filtered)
  useEffect(() => {
    const fetchPopularPosts = async () => {
      try {
        setPopularPostsLoading(true)
        const res = await apiFetch(`/blog/posts/popular/?limit=5`);
        if (!res.ok) throw new Error("Failed to fetch popular posts");
        
        const data = await res.json();
        // console.log("Fetched popular posts:", data);
        setPopularPosts(data || []);
      } catch (error) {
        console.error("Error fetching popular posts:", error);
        setPopularPosts([]);
      } finally {
        setPopularPostsLoading(false);
      }
    };

    fetchPopularPosts();
  }, []);

  // Fetch categories with overall post counts
  useEffect(() => {
    const fetchCategoriesWithCounts = async () => {
      try {
        setCategoriesCountsLoading(true)
        const res = await apiFetch(`/blog/categories/with-counts/`);
        if (!res.ok) throw new Error("Failed to fetch categories with counts");
        
        const data = await res.json();
        // console.log("Fetched categories with counts:", data);
        setCategoriesWithCounts(data || []);
      } catch (error) {
        console.error("Error fetching categories with counts:", error);
        // Fallback to categories without counts
        setCategoriesWithCounts(categories.slice(1).map(cat => ({ ...cat, post_count: 0 })));
      } finally {
        setCategoriesCountsLoading(false);
      }
    };

    // Only fetch if categories are loaded
    if (categories.length > 1) {
      fetchCategoriesWithCounts();
    }
  }, [categories]);

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
          return new Date(b.published_at) - new Date(a.published_at)
      }
    })

  const handleLike = async (postId) => {
    try {
      const res = await apiFetch(`/blog/posts/${postId}/like/`, { method: "POST" });
      
      if (res.ok) {
        // Update local state optimistically
        setBlogPosts((posts) =>
          posts.map((post) =>
            post.id === postId
              ? {
                  ...post,
                  is_liked: !post.is_liked,
                  likes_count: post.is_liked ? post.likes_count - 1 : post.likes_count + 1,
                }
              : post,
          ),
        )
      }
    } catch (error) {
      console.error("Error liking post:", error);
    }
  }

  const handleBookmark = async (postId) => {
    try {
      const res = await apiFetch(`/blog/posts/${postId}/bookmark/`, { method: "POST" });
      
      if (res.ok) {
        // Update local state optimistically
        setBlogPosts((posts) =>
          posts.map((post) => 
            post.id === postId 
              ? { ...post, is_bookmarked: !post.is_bookmarked } 
              : post
          ),
        )
      }
    } catch (error) {
      console.error("Error bookmarking post:", error);
    }
  }

  const handlePostClick = async (postId) => {
    // Navigate to post detail page
    navigate(`/blog/${postId}`);
  }

  const handleShare = (platform) => {
    if (!selectedPostForShare) return
    
    const url = `${window.location.origin}/blog/${selectedPostForShare.id}`
    const title = selectedPostForShare.title || "Check out this article"

    const shareUrls = {
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

  const handleShareClick = (post) => {
    setSelectedPostForShare(post)
    setShowShareModal(true)
  }

  // Pagination handlers
  const handlePageChange = (page) => {
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

// Blog Post Card Component
function BlogPostCard({ post, onLike, onBookmark, onPostClick, onSelect, currentUser, onShare }) {
  const navigate = useNavigate()
  const isOwnPost = post.author.id === currentUser.id

  const handleTitleClick = () => {
    onPostClick(post.id)
  }

  const handlePopularPostClick = () => {
    onPostClick(post.id)
  }

  return (
    <article  className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <img
            src={post.author.avatar_url || "/placeholder.svg"}
            alt={`${post.author.first_name} ${post.author.last_name}`}
            className="w-10 h-10 rounded-full border-2 border-gray-200"
          />
          <div>
            <h3 className="font-medium text-gray-900">{`${post.author.first_name} ${post.author.last_name}`}</h3>
            <p className="text-sm text-gray-500">
              {post.author.year ? formatYearWithOrdinal(post.author.year) : 'Student'} • {post.author.major}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">{post.category_name}</span>
          {isOwnPost && (
            <button className="p-1 text-gray-400 hover:text-gray-600 rounded">
              <MoreHorizontal className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="mb-4">
        <h2
          className="text-xl font-bold text-gray-900 mb-2 cursor-pointer hover:text-blue-600 transition-colors"
          onClick={handleTitleClick}
        >
          {post.title}
        </h2>
        <p className="text-gray-600 line-clamp-3">{post.excerpt || createExcerpt(post.content, 200)}</p>
      </div>

      {/* Tags */}
      {post.tags && post.tags.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4">
          {post.tags.map((tag) => (
            <span key={tag} className="px-2 py-1 bg-gray-100 text-gray-600 rounded text-xs">
              #{tag}
            </span>
          ))}
        </div>
      )}

      {/* Meta Info */}
      <div className="flex items-center justify-between text-sm text-gray-500 mb-4">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1">
            <Calendar className="w-4 h-4" />
            {new Date(post.published_at).toLocaleDateString()}
          </span>
          <span className="flex items-center gap-1">
            <Clock className="w-4 h-4" />
            {post.read_time}
          </span>
          <span className="flex items-center gap-1">
            <Eye className="w-4 h-4" />
            {post.views || 0}
          </span>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between pt-4 border-t border-gray-200">
        <div className="flex items-center gap-4">
          <button
            onClick={() => onLike(post.id)}
            className={`flex items-center gap-2 px-3 py-1 rounded-lg transition-colors ${
              post.is_liked
                ? "text-red-600 bg-red-50 hover:bg-red-100"
                : "text-gray-600 hover:text-red-600 hover:bg-red-50"
            }`}
          >
            <Heart className={`w-4 h-4 ${post.is_liked ? "fill-current" : ""}`} />
            <span>{post.likes_count || 0}</span>
          </button>

          <button className="flex items-center gap-2 px-3 py-1 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
            <MessageCircle className="w-4 h-4" />
            <span>{post.comments ? post.comments.length : 0}</span>
          </button>

          <button 
            onClick={() => onShare && onShare(post)}
            className="flex items-center gap-2 px-3 py-1 text-gray-600 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
          >
            <Share2 className="w-4 h-4" />
            <span>Share</span>
          </button>
        </div>

        <button
          onClick={() => onBookmark(post.id)}
          className={`p-2 rounded-lg transition-colors ${
            post.is_bookmarked
              ? "text-blue-600 bg-blue-50 hover:bg-blue-100"
              : "text-gray-400 hover:text-blue-600 hover:bg-blue-50"
          }`}
        >
          <Bookmark className={`w-4 h-4 ${post.is_bookmarked ? "fill-current" : ""}`} />
        </button>
      </div>
    </article>
  )
}

