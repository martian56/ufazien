"use client"

import { useState, useEffect, useRef } from "react"
import { Helmet } from "react-helmet"
import { useParams, useNavigate } from "react-router-dom"
import { ArrowLeft, Heart, MessageCircle, Share2, Bookmark, Eye, Clock,
  Calendar, Tag, ThumbsUp, Flag, Copy, Twitter, Facebook, Linkedin,
  PrinterIcon as Print,
  Volume2, VolumeX, Play, Pause, Settings, Sun, Moon, Type,
  Minus, Plus, Maximize, Minimize, Check, AlertCircle, Star,
  Menu, X,
} from "lucide-react"

import { getMajorDisplayName } from "../../../utils/majorUtils"
import SideBar from "../../../components/ui/SideBar"
// import "../../../components/RichTextEditor.css"
// import "../../../components/BlogContent.css"
import { sanitizeHtml } from "../../../utils/security"
import { processblogContent, extractPlainText, calculateReadTime } from "../../../utils/contentProcessor"
import { useToast, ToastContainer } from "../../../hooks/useToast"

const API_URL = import.meta.env.VITE_API_URL

// Helper function to strip HTML tags for text processing
export default function BlogRead() {
  const { notifications: toastNotifications, toast, removeNotification } = useToast();
  const { id } = useParams()
  const navigate = useNavigate()

  // Sidebar state
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)

  // Core state
  const [post, setPost] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [isLiked, setIsLiked] = useState(false)
  const [isBookmarked, setIsBookmarked] = useState(false)
  const [isFollowing, setIsFollowing] = useState(false)
  const [likes, setLikes] = useState(0)
  const [views, setViews] = useState(0)

  // Comments state
  const [comments, setComments] = useState([])
  const [newComment, setNewComment] = useState("")
  const [replyTo, setReplyTo] = useState(null)
  const [showComments, setShowComments] = useState(true)
  const [commentsLoading, setCommentsLoading] = useState(false)

  // Reading experience state
  const [readingProgress, setReadingProgress] = useState(0)
  const [estimatedReadTime, setEstimatedReadTime] = useState(0)
  const [actualReadTime, setActualReadTime] = useState(0)
  const [startTime, setStartTime] = useState(null)
  const [isReading, setIsReading] = useState(false)

  // Customization state
  const [fontSize, setFontSize] = useState(18)
  const [fontFamily, setFontFamily] = useState("Inter")
  const [lineHeight, setLineHeight] = useState(1.7)
  const [darkMode, setDarkMode] = useState(false)
  const [focusMode, setFocusMode] = useState(false)
  const [showSettings, setShowSettings] = useState(false)

  // Text-to-speech state
  const [isPlaying, setIsPlaying] = useState(false)
  const [speechRate, setSpeechRate] = useState(1)
  const [speechVoice, setSpeechVoice] = useState(null)
  const [currentPosition, setCurrentPosition] = useState(0)
  const [speechSupported, setSpeechSupported] = useState(false)

  // Social features
  const [showShareModal, setShowShareModal] = useState(false)
  const [showReportModal, setShowReportModal] = useState(false)
  const [rating, setRating] = useState(0)
  const [hasRated, setHasRated] = useState(false)

  // Related content
  const [relatedPosts, setRelatedPosts] = useState([])
  const [authorPosts, setAuthorPosts] = useState([])
  const [authorPostsCount, setAuthorPostsCount] = useState(0)
  const [similarTags, setSimilarTags] = useState([])

  // User state
  const [currentUser, setCurrentUser] = useState({
    id: null,
    name: "",
    avatar: "/placeholder.svg?height=40&width=40",
    year: "",
    major: "",
  })

  // Refs
  const contentRef = useRef(null)
  const speechRef = useRef(null)
  const progressRef = useRef(null)

  // Enhance blog content after rendering
  useEffect(() => {
    if (contentRef.current && post) {
      // Content is already enhanced by contentProcessor, 
      // so we just handle any additional dynamic features here
      const images = contentRef.current.querySelectorAll('img');
      images.forEach(img => {
        if (!img.complete) {
          img.style.opacity = '0.5';
          img.onload = () => {
            img.style.opacity = '1';
          };
        }
      });
    }
  }, [post]);

  // Initialize speech synthesis
  useEffect(() => {
    if ("speechSynthesis" in window) {
      setSpeechSupported(true)
      const voices = speechSynthesis.getVoices()
      if (voices.length > 0) {
        setSpeechVoice(voices.find((voice) => voice.lang.startsWith("en")) || voices[0])
      }
    }
  }, [])

  // Fetch current user profile
  useEffect(() => {
    const fetchCurrentUser = async () => {
      try {
        const access = localStorage.getItem("access")
        if (!access) return

        const res = await fetch(`${API_URL}/api/auth/user/me/`, {
          headers: { Authorization: `Bearer ${access}` },
        })
        if (res.ok) {
          const userData = await res.json()
          setCurrentUser({
            id: userData.id,
            name: `${userData.first_name} ${userData.last_name}`,
            avatar: userData.avatar_url || "/placeholder.svg?height=40&width=40",
            year: userData.year,
            major: userData.major,
          })
        }
      } catch (error) {
        console.error("Error fetching user profile:", error)
      }
    }

    fetchCurrentUser()
  }, [])

  // Load post data from API
  useEffect(() => {
    const loadPost = async () => {
      try {
        setLoading(true)
        setError(null)

        const access = localStorage.getItem("access")
        const response = await fetch(`${API_URL}/api/blog/posts/${id}/`, {
          headers: { Authorization: `Bearer ${access}` },
        })

        if (!response.ok) {
          throw new Error("Failed to fetch blog post")
        }

        const data = await response.json()
        console.log("Fetched blog post:", data)

        setPost(data)
        setLikes(data.likes_count || 0)
        setViews(data.views || 0)
        setIsLiked(data.is_liked || false)
        setIsBookmarked(data.is_bookmarked || false)
        setIsFollowing(data.author?.is_following || false)

        // Calculate estimated read time from API or calculate from content
        if (data.read_time) {
          const timeValue = parseInt(data.read_time.replace(/\D/g, '')) || 0
          setEstimatedReadTime(timeValue)
        } else if (data.content) {
          const readTime = calculateReadTime(data.content)
          setEstimatedReadTime(readTime)
        }

        // Set comments from API response
        setComments(data.comments || [])

        // Load related posts by tags
        if (data.tags && data.tags.length > 0) {
          loadRelatedPosts(data.tags, data.id)
        }

        // Load author's other posts
        if (data.author && data.author.id) {
          loadAuthorPosts(data.author.id, data.id)
        }

        setStartTime(Date.now())
      } catch (err) {
        console.error("Error fetching blog post:", err)
        setError("Failed to load blog post")
      } finally {
        setLoading(false)
      }
    }

    loadPost()
  }, [id, navigate])

  // Track post view when post is loaded
  useEffect(() => {
    const trackPostView = async () => {
      if (!post || !post.id) return

      try {
        const access = localStorage.getItem("access")
        if (!access) return

        const response = await fetch(`${API_URL}/api/blog/posts/${post.id}/view/`, {
          method: "POST",
          headers: { 
            Authorization: `Bearer ${access}`,
            "Content-Type": "application/json"
          },
        })

        if (response.ok) {
          const data = await response.json()
          console.log("View tracking response:", data)
          
          // Update the views count in the UI
          setViews(data.views)
          
          // Optionally update the post object as well
          setPost(prevPost => ({
            ...prevPost,
            views: data.views
          }))
        }
      } catch (error) {
        console.error("Error tracking post view:", error)
        // Don't show error to user as this is a background operation
      }
    }

    trackPostView()
  }, [post?.id]) // Only run when post.id changes (when post is loaded)

  // Handle follow/unfollow
  const handleFollowToggle = async () => {
    if (!post?.author?.id) return

    try {
      const access = localStorage.getItem("access")
      if (!access) {
        navigate("/auth")
        return
      }

      const response = await fetch(`${API_URL}/api/auth/user/${post.author.id}/follow/`, {
        method: "POST",
        headers: { 
          Authorization: `Bearer ${access}`,
          "Content-Type": "application/json"
        },
      })

      if (response.ok) {
        const data = await response.json()
        console.log("Follow response:", data)
        
        setIsFollowing(data.following)
        
        // Update the post object with new followers count
        setPost(prevPost => ({
          ...prevPost,
          author: {
            ...prevPost.author,
            followers_count: data.followers_count
          }
        }))
      }
    } catch (error) {
      console.error("Error toggling follow:", error)
    }
  }

  // Load related posts by tags
  const loadRelatedPosts = async (tags, currentPostId) => {
    try {
      const access = localStorage.getItem("access")
      // Get posts with similar tags
      const tagQuery = tags[0] // Use first tag for simplicity
      const response = await fetch(`${API_URL}/api/blog/posts/?tag=${tagQuery}`, {
        headers: { Authorization: `Bearer ${access}` },
      })

      if (response.ok) {
        const data = await response.json()
        const filtered = data.results
          .filter(post => post.id !== currentPostId)
          .slice(0, 3)
          .map(post => ({
            id: post.id,
            title: post.title,
            author: `${post.author.first_name} ${post.author.last_name}`,
            read_time: post.read_time,
            likes: post.likes_count,
            category: post.category_name,
          }))
        setRelatedPosts(filtered)
      }
    } catch (error) {
      console.error("Error loading related posts:", error)
    }
  }

  // Load author's other posts
  const loadAuthorPosts = async (authorId, currentPostId) => {
    try {
      const access = localStorage.getItem("access")
      const response = await fetch(`${API_URL}/api/blog/posts/?by=${authorId}`, {
        headers: { Authorization: `Bearer ${access}` },
      })

      if (response.ok) {
        const data = await response.json()
        // Store the total count of author's posts
        setAuthorPostsCount(data.count || 0)
        
        const filtered = data.results
          .filter(post => post.id !== currentPostId)
          .slice(0, 3)
          .map(post => ({
            id: post.id,
            title: post.title,
            author: `${post.author.first_name} ${post.author.last_name}`,
            read_time: post.read_time,
            likes: post.likes_count,
            category: post.category_name,
          }))
        setAuthorPosts(filtered)
      }
    } catch (error) {
      console.error("Error loading author posts:", error)
    }
  }

  // Load trending tags
  const loadSimilarTags = async () => {
    try {
      const access = localStorage.getItem("access")
      const response = await fetch(`${API_URL}/api/blog/tags/`, {
        headers: { Authorization: `Bearer ${access}` },
      })

      if (response.ok) {
        const data = await response.json()
        const tags = data.results.slice(0, 10).map(tag => tag.name)
        setSimilarTags(tags)
      }
    } catch (error) {
      console.error("Error loading tags:", error)
    }
  }

  // Load trending tags on component mount
  useEffect(() => {
    loadSimilarTags()
  }, [])

  // Track reading progress
  useEffect(() => {
    const handleScroll = () => {
      if (!contentRef.current) return

      const element = contentRef.current
      const scrollTop = window.pageYOffset
      const scrollHeight = element.scrollHeight - window.innerHeight
      const progress = Math.min((scrollTop / scrollHeight) * 100, 100)

      setReadingProgress(progress)

      // Track reading time
      if (progress > 10 && !isReading) {
        setIsReading(true)
      }

      if (progress > 90 && isReading && startTime) {
        const readTime = Math.round((Date.now() - startTime) / 1000 / 60)
        setActualReadTime(readTime)
      }
    }

    window.addEventListener("scroll", handleScroll)
    return () => window.removeEventListener("scroll", handleScroll)
  }, [isReading, startTime])

  // Text-to-speech functions
  const toggleSpeech = () => {
    if (!speechSupported || !post?.content) return

    const plainTextContent = extractPlainText(post.content)
    if (!plainTextContent.trim()) return

    if (isPlaying) {
      speechSynthesis.pause()
      setIsPlaying(false)
    } else {
      if (speechSynthesis.paused) {
        speechSynthesis.resume()
      } else {
        const utterance = new SpeechSynthesisUtterance(plainTextContent)
        utterance.voice = speechVoice
        utterance.rate = speechRate
        utterance.onend = () => setIsPlaying(false)
        speechSynthesis.speak(utterance)
      }
      setIsPlaying(true)
    }
  }

  const stopSpeech = () => {
    speechSynthesis.cancel()
    setIsPlaying(false)
  }

  // Social actions
  const handleLike = async () => {
    try {
      const access = localStorage.getItem("access")
      const response = await fetch(`${API_URL}/api/blog/posts/${id}/like/`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${access}` },
      })

      if (response.ok) {
        setIsLiked(!isLiked)
        setLikes((prev) => (isLiked ? prev - 1 : prev + 1))
      }
    } catch (error) {
      console.error("Error liking post:", error)
    }
  }

  const handleBookmark = async () => {
    try {
      const access = localStorage.getItem("access")
      const response = await fetch(`${API_URL}/api/blog/posts/${id}/bookmark/`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${access}` },
      })

      if (response.ok) {
        setIsBookmarked(!isBookmarked)
      }
    } catch (error) {
      console.error("Error bookmarking post:", error)
    }
  }

  const handleShare = (platform) => {
    const url = window.location.href
    const title = post?.title || "Check out this article"

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
    navigator.clipboard.writeText(window.location.href)
    toast.success("Link copied to clipboard!")
  }

  const handleComment = async () => {
    if (!newComment.trim()) return

    try {
      setCommentsLoading(true)
      const access = localStorage.getItem("access")
      const response = await fetch(`${API_URL}/api/blog/posts/${id}/comments/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${access}`,
        },
        body: JSON.stringify({
          content: newComment,
          parent: replyTo,
        }),
      })

      if (response.ok) {
        // Refresh comments by fetching the post again
        const postResponse = await fetch(`${API_URL}/api/blog/posts/${id}/`, {
          headers: { Authorization: `Bearer ${access}` },
        })
        if (postResponse.ok) {
          const postData = await postResponse.json()
          setComments(postData.comments || [])
        }

        setNewComment("")
        setReplyTo(null)
      }
    } catch (error) {
      console.error("Error posting comment:", error)
    } finally {
      setCommentsLoading(false)
    }
  }

  const handleCommentLike = async (commentId) => {
    try {
      const access = localStorage.getItem("access")
      const response = await fetch(`${API_URL}/api/blog/comments/${commentId}/like/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${access}`,
        },
      })

      if (response.ok) {
        // Refresh comments by fetching the post again
        const postResponse = await fetch(`${API_URL}/api/blog/posts/${id}/`, {
          headers: { Authorization: `Bearer ${access}` },
        })
        if (postResponse.ok) {
          const postData = await postResponse.json()
          setComments(postData.comments || [])
        }
      }
    } catch (error) {
      console.error("Error liking comment:", error)
    }
  }

  const handleRating = (newRating) => {
    if (hasRated) return
    setRating(newRating)
    setHasRated(true)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading blog post...</p>
        </div>
      </div>
    )
  }

  if (error || !post) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Error Loading Post</h2>
          <p className="text-gray-600 mb-4">{error || "Post not found"}</p>
          <button
            onClick={() => navigate("/blog")}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Back to Blog
          </button>
        </div>
      </div>
    )
  }

  return (
    <>
      <Helmet>
        <title>Ufazien | Blog Read</title>
        <meta name="description" content="Read the full articles on Ufazien's blog." />
      </Helmet>

      <div
        className={`min-h-screen flex transition-colors duration-300 ${darkMode ? "bg-gray-900 text-white" : "bg-gray-50 text-gray-900"}`}
      >
        {/* Sidebar Overlay for Mobile */}
        {isSidebarOpen && (
          <div
            className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
            onClick={() => setIsSidebarOpen(false)}
          ></div>
        )}

        {/* Sidebar */}
        <SideBar isSidebarOpen={isSidebarOpen} setIsSidebarOpen={setIsSidebarOpen} pageTitle="Blog" />

  {/* Main Content */}
  <div className="flex-1 flex flex-col overflow-hidden">
          {/* Reading Progress Bar */}
          <div className="fixed top-0 left-0 lg:left-64 w-full lg:w-[calc(100%-16rem)] h-1 bg-gray-200 z-50">
            <div
              className="h-full bg-gradient-to-r from-blue-600 to-purple-600 transition-all duration-300"
              style={{ width: `${readingProgress}%` }}
            ></div>
          </div>
          {/* Header */}
          <header
            className={`sticky top-1 z-30 backdrop-blur-sm border-b ${darkMode ? "bg-gray-900/90 border-gray-700" : "bg-white/90 border-gray-200"}`}
          >
          <div className="flex items-center justify-between h-16 px-6">
            <div className="flex items-center space-x-4">
              {/* Mobile Menu Button */}
              <button
                onClick={() => setIsSidebarOpen(true)}
                className={`lg:hidden p-2 rounded-lg transition-colors ${darkMode ? "hover:bg-gray-700" : "hover:bg-gray-100"}`}
              >
                <Menu className="w-5 h-5" />
              </button>

              <button
                onClick={() => navigate("/blog")}
                className={`p-2 rounded-lg transition-colors ${darkMode ? "hover:bg-gray-700" : "hover:bg-gray-100"}`}
              >
                <ArrowLeft className="w-5 h-5" />
              </button>

              <div className="flex items-center space-x-3">
                <div
                  className={`px-3 py-1 rounded-full text-xs font-medium ${
                    post.category_name === "Technology"
                      ? "bg-blue-100 text-blue-700"
                      : post.category_name === "Academic"
                        ? "bg-green-100 text-green-700"
                        : "bg-gray-100 text-gray-700"
                  }`}
                >
                  {post.category_name || "General"}
                </div>

                {post.featured && (
                  <div className="flex items-center space-x-1 px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-xs font-medium">
                    <Star className="w-3 h-3" />
                    <span>Featured</span>
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center space-x-3">
              {/* Reading Stats */}
              <div className="hidden md:flex items-center space-x-4 text-sm text-gray-500">
                <span className="flex items-center space-x-1">
                  <Clock className="w-4 h-4" />
                  <span>{estimatedReadTime} min read</span>
                </span>
                <span className="flex items-center space-x-1">
                  <Eye className="w-4 h-4" />
                  <span>{views.toLocaleString()} views</span>
                </span>
                {actualReadTime > 0 && (
                  <span className="flex items-center space-x-1 text-green-600">
                    <Check className="w-4 h-4" />
                    <span>Read in {actualReadTime}m</span>
                  </span>
                )}
              </div>

              {/* Audio Controls */}
              {speechSupported && (
                <div className="flex items-center space-x-2">
                  <button
                    onClick={toggleSpeech}
                    className={`p-2 rounded-lg transition-colors ${
                      isPlaying ? "bg-blue-100 text-blue-600" : darkMode ? "hover:bg-gray-700" : "hover:bg-gray-100"
                    }`}
                    title={isPlaying ? "Pause Audio" : "Play Audio"}
                  >
                    {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                  </button>

                  {isPlaying && (
                    <button
                      onClick={stopSpeech}
                      className={`p-2 rounded-lg transition-colors ${darkMode ? "hover:bg-gray-700" : "hover:bg-gray-100"}`}
                      title="Stop Audio"
                    >
                      <VolumeX className="w-4 h-4" />
                    </button>
                  )}
                </div>
              )}

              {/* Settings */}
              <button
                onClick={() => setShowSettings(!showSettings)}
                className={`p-2 rounded-lg transition-colors ${
                  showSettings ? "bg-blue-100 text-blue-600" : darkMode ? "hover:bg-gray-700" : "hover:bg-gray-100"
                }`}
              >
                <Settings className="w-4 h-4" />
              </button>

              {/* Dark Mode Toggle */}
              <button
                onClick={() => setDarkMode(!darkMode)}
                className={`p-2 rounded-lg transition-colors ${darkMode ? "hover:bg-gray-700" : "hover:bg-gray-100"}`}
              >
                {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              </button>

              {/* Focus Mode */}
              <button
                onClick={() => setFocusMode(!focusMode)}
                className={`p-2 rounded-lg transition-colors ${
                  focusMode ? "bg-purple-100 text-purple-600" : darkMode ? "hover:bg-gray-700" : "hover:bg-gray-100"
                }`}
                title="Focus Mode"
              >
                {focusMode ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Reading Settings Panel */}
          {showSettings && (
            <div className={`border-t p-4 ${darkMode ? "border-gray-700 bg-gray-800" : "border-gray-200 bg-white"}`}>
              <div className="flex items-center justify-between max-w-4xl mx-auto">
                <div className="flex items-center space-x-6">
                  {/* Font Size */}
                  <div className="flex items-center space-x-2">
                    <Type className="w-4 h-4 text-gray-500" />
                    <button
                      onClick={() => setFontSize(Math.max(14, fontSize - 2))}
                      className={`p-1 rounded ${darkMode ? "hover:bg-gray-700" : "hover:bg-gray-100"}`}
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                    <span className="text-sm font-medium w-8 text-center">{fontSize}</span>
                    <button
                      onClick={() => setFontSize(Math.min(24, fontSize + 2))}
                      className={`p-1 rounded ${darkMode ? "hover:bg-gray-700" : "hover:bg-gray-100"}`}
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>

                  {/* Font Family */}
                  <select
                    value={fontFamily}
                    onChange={(e) => setFontFamily(e.target.value)}
                    className={`px-3 py-1 rounded border text-sm ${
                      darkMode
                        ? "bg-gray-700 border-gray-600 text-white placeholder-gray-400"
                        : "bg-white border-gray-300"
                    }`}
                  >
                    <option value="Inter">Inter</option>
                    <option value="Georgia">Georgia</option>
                    <option value="Times New Roman">Times</option>
                    <option value="Arial">Arial</option>
                    <option value="Helvetica">Helvetica</option>
                  </select>

                  {/* Line Height */}
                  <div className="flex items-center space-x-2">
                    <span className="text-sm text-gray-500">Line Height:</span>
                    <select
                      value={lineHeight}
                      onChange={(e) => setLineHeight(Number.parseFloat(e.target.value))}
                      className={`px-2 py-1 rounded border text-sm ${
                        darkMode ? "bg-gray-700 border-gray-600 text-white" : "bg-white border-gray-300"
                      }`}
                    >
                      <option value={1.4}>Tight</option>
                      <option value={1.6}>Normal</option>
                      <option value={1.8}>Relaxed</option>
                      <option value={2.0}>Loose</option>
                    </select>
                  </div>
                </div>

                {/* Speech Rate */}
                {speechSupported && (
                  <div className="flex items-center space-x-2">
                    <Volume2 className="w-4 h-4 text-gray-500" />
                    <span className="text-sm text-gray-500">Speed:</span>
                    <select
                      value={speechRate}
                      onChange={(e) => setSpeechRate(Number.parseFloat(e.target.value))}
                      className={`px-2 py-1 rounded border text-sm ${
                        darkMode ? "bg-gray-700 border-gray-600 text-white" : "bg-white border-gray-300"
                      }`}
                    >
                      <option value={0.5}>0.5x</option>
                      <option value={0.75}>0.75x</option>
                      <option value={1}>1x</option>
                      <option value={1.25}>1.25x</option>
                      <option value={1.5}>1.5x</option>
                      <option value={2}>2x</option>
                    </select>
                  </div>
                )}
              </div>
            </div>
          )}
        </header>

          {/* Article Content */}
        <main className="flex-1 overflow-y-auto px-6 py-8">
          <article ref={contentRef} className="max-w-4xl">
            {/* Article Header */}
            <header className="mb-8">
              <h1
                className="text-4xl font-bold mb-6 leading-tight"
                style={{ fontFamily, fontSize: `${fontSize + 8}px` }}
              >
                {post.title}
              </h1>

              {/* Author Info */}
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center space-x-4">
                  <img
                    src={post.author?.avatar_url || "/placeholder.svg"}
                    alt={`${post.author?.first_name} ${post.author?.last_name}` || "Author"}
                    className="w-12 h-12 rounded-full border-2 border-gray-200"
                  />
                  <div>
                    <h3 className="font-semibold text-lg">{`${post.author?.first_name || ""} ${post.author?.last_name || ""}`.trim() || "Anonymous"}</h3>
                    <p className="text-gray-600 text-sm">
                      {post.author?.year ? `Year ${post.author.year}` : "Student"} • {getMajorDisplayName(post.author?.major)}
                    </p>
                  </div>
                </div>

                <div className="flex items-center space-x-4 text-sm text-gray-500">
                  <span className="flex items-center space-x-1">
                    <Calendar className="w-4 h-4" />
                    <span>{new Date(post.published_at).toLocaleDateString()}</span>
                  </span>
                  {post.updated_at && post.updated_at !== post.created_at && (
                    <span className="text-xs">Updated {new Date(post.updated_at).toLocaleDateString()}</span>
                  )}
                </div>
              </div>

              {/* Tags */}
              {post.tags && post.tags.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-6">
                  {post.tags.map((tag, index) => (
                    <span
                      key={tag || index}
                      className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-blue-100 text-blue-700 hover:bg-blue-200 cursor-pointer transition-colors"
                    >
                      <Tag className="w-3 h-3 mr-1" />
                      {tag}
                    </span>
                  ))}
                </div>
              )}

              {/* Article Stats */}
              <div className="flex items-center justify-between py-4 border-y border-gray-200">
                <div className="flex items-center space-x-6">
                  <span className="flex items-center space-x-2 text-gray-600">
                    <Clock className="w-4 h-4" />
                    <span>{estimatedReadTime} min read</span>
                  </span>
                  <span className="flex items-center space-x-2 text-gray-600">
                    <Eye className="w-4 h-4" />
                    <span>{views.toLocaleString()} views</span>
                  </span>
                  <span className="flex items-center space-x-2 text-gray-600">
                    <MessageCircle className="w-4 h-4" />
                    <span>{comments.length} comments</span>
                  </span>
                </div>

                {/* Rating */}
                <div className="flex items-center space-x-2">
                  <div className="flex items-center space-x-1">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        onClick={() => handleRating(star)}
                        disabled={hasRated}
                        className={`w-5 h-5 ${
                          star <= (rating || Math.floor(post.likes / 10) || 4)
                            ? "text-yellow-400 fill-current"
                            : "text-gray-300"
                        } ${!hasRated ? "hover:text-yellow-400 cursor-pointer" : "cursor-default"}`}
                      >
                        <Star className="w-full h-full" />
                      </button>
                    ))}
                  </div>
                  <span className="text-sm text-gray-600">
                    {Math.floor(post.likes / 10) || 4}.{post.likes % 10 || 5} ({post.likes || 0} ratings)
                  </span>
                </div>
              </div>
            </header>

            {/* Article Content */}
            <div
              ref={contentRef}
              className={`blog-content prose prose-lg max-w-none ${darkMode ? "dark prose-invert" : ""}`}
              style={{
                fontFamily,
                fontSize: `${fontSize}px`,
                lineHeight: lineHeight,
              }}
            >
              <div
                dangerouslySetInnerHTML={{
                  __html: (() => {
                    const processed = processblogContent(post.content);
                    const sanitized = sanitizeHtml(processed);
                    console.log('Original content:', post.content);
                    console.log('Processed content:', processed);
                    console.log('Sanitized content:', sanitized);
                    return sanitized || "";
                  })()
                }}
              />
            </div>
          </article>

          {/* Article Actions */}
          <div
            className={`sticky bottom-6 mt-12 p-4 rounded-xl shadow-lg border backdrop-blur-sm ${
              darkMode ? "bg-gray-800/90 border-gray-700" : "bg-white/90 border-gray-200"
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <button
                  onClick={handleLike}
                  className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-all ${
                    isLiked
                      ? "bg-red-50 text-red-600 hover:bg-red-100"
                      : darkMode
                        ? "hover:bg-gray-700"
                        : "hover:bg-gray-100"
                  }`}
                >
                  <Heart className={`w-5 h-5 ${isLiked ? "fill-current" : ""}`} />
                  <span>{likes}</span>
                </button>

                <button
                  onClick={() => setShowComments(!showComments)}
                  className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors ${
                    darkMode ? "hover:bg-gray-700" : "hover:bg-gray-100"
                  }`}
                >
                  <MessageCircle className="w-5 h-5" />
                  <span>{comments.length}</span>
                </button>

                <button
                  onClick={handleBookmark}
                  className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-all ${
                    isBookmarked
                      ? "bg-blue-50 text-blue-600 hover:bg-blue-100"
                      : darkMode
                        ? "hover:bg-gray-700"
                        : "hover:bg-gray-100"
                  }`}
                >
                  <Bookmark className={`w-5 h-5 ${isBookmarked ? "fill-current" : ""}`} />
                  <span>Save</span>
                </button>

                <button
                  onClick={() => setShowShareModal(true)}
                  className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors ${
                    darkMode ? "hover:bg-gray-700" : "hover:bg-gray-100"
                  }`}
                >
                  <Share2 className="w-5 h-5" />
                  <span>Share</span>
                </button>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  onClick={() => window.print()}
                  className={`p-2 rounded-lg transition-colors ${darkMode ? "hover:bg-gray-700" : "hover:bg-gray-100"}`}
                  title="Print Article"
                >
                  <Print className="w-5 h-5" />
                </button>

                <button
                  onClick={() => setShowReportModal(true)}
                  className={`p-2 rounded-lg transition-colors ${darkMode ? "hover:bg-gray-700" : "hover:bg-gray-100"}`}
                  title="Report Article"
                >
                  <Flag className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>

          {/* Author Bio */}
          <div
            className={`mt-12 p-6 rounded-xl border ${
              darkMode ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200"
            }`}
          >
            <div className="flex items-start space-x-4">
              <img
                src={post.author?.avatar_url || "/placeholder.svg"}
                alt={`${post.author?.first_name} ${post.author?.last_name}` || "Author"}
                className="w-16 h-16 rounded-full border-2 border-gray-200"
              />
              <div className="flex-1">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-xl font-semibold">{`${post.author?.first_name || ""} ${post.author?.last_name || ""}`.trim() || "Anonymous"}</h3>
                  {post.author?.id !== currentUser.id && (
                    <button
                      onClick={handleFollowToggle}
                      className={`px-4 py-2 rounded-lg transition-colors font-medium ${
                        isFollowing
                          ? "bg-gray-200 text-gray-700 hover:bg-gray-300"
                          : "bg-blue-600 text-white hover:bg-blue-700"
                      }`}
                    >
                      {isFollowing ? "Following" : "Follow"}
                    </button>
                  )}
                </div>
                <p className="text-blue-600 font-medium mb-2">
                  {post.author?.year ? `Year ${post.author.year}` : "Student"} • {getMajorDisplayName(post.author?.major)}
                </p>
                {post.author?.bio && (
                  <p className="text-gray-600 mb-3 text-sm leading-relaxed">
                    {post.author.bio}
                  </p>
                )}
                <div className="flex items-center space-x-4 text-sm text-gray-500">
                  <span>{authorPostsCount || 0} posts</span>
                  <span>{post.author?.followers_count || 0} followers</span>
                  {post.author?.gpa && post.author.gpa > 0 && (
                    <span>GPA: {post.author.gpa}</span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Comments Section */}
          {showComments && (
            <div
              className={`mt-12 p-6 rounded-xl border ${
                darkMode ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200"
              }`}
            >
              <h3 className="text-xl font-semibold mb-6">Comments ({comments.length})</h3>

              {/* Add Comment */}
              <div className="mb-8">
                <div className="flex space-x-3">
                  <img
                    src={currentUser.avatar || "/placeholder.svg"}
                    alt={currentUser.name}
                    className="w-10 h-10 rounded-full border-2 border-gray-200"
                  />
                  <div className="flex-1">
                    <textarea
                      placeholder={replyTo ? "Write a reply..." : "Write a thoughtful comment..."}
                      value={newComment}
                      onChange={(e) => setNewComment(e.target.value)}
                      rows={3}
                      className={`w-full p-3 border rounded-lg resize-none ${
                        darkMode
                          ? "bg-gray-700 border-gray-600 text-white placeholder-gray-400"
                          : "bg-white border-gray-300 placeholder-gray-500"
                      }`}
                    />
                    <div className="flex justify-between items-center mt-2">
                      <div className="flex items-center space-x-4">
                        <span className="text-sm text-gray-500">{newComment.length}/500 characters</span>
                        {replyTo && (
                          <button
                            onClick={() => setReplyTo(null)}
                            className="text-sm text-gray-500 hover:text-red-600 transition-colors"
                          >
                            Cancel Reply
                          </button>
                        )}
                      </div>
                      <button
                        onClick={handleComment}
                        disabled={!newComment.trim() || commentsLoading}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        {commentsLoading ? "Posting..." : replyTo ? "Post Reply" : "Post Comment"}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Comments List */}
              <div className="space-y-6">
                {comments.map((comment) => (
                  <div key={comment.id} className="space-y-4">
                    <div className={`flex space-x-3 ${replyTo === comment.id ? 'bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800' : ''}`}>
                      <img
                        src={comment.author?.avatar_url || "/placeholder.svg"}
                        alt={`${comment.author?.first_name} ${comment.author?.last_name}`}
                        className="w-10 h-10 rounded-full border-2 border-gray-200"
                      />
                      <div className="flex-1">
                        <div className={`p-4 rounded-lg ${darkMode ? "bg-gray-700" : "bg-gray-50"}`}>
                          <div className="flex items-center justify-between mb-2">
                            <h4 className="font-medium">{`${comment.author?.first_name || ""} ${comment.author?.last_name || ""}`.trim() || "Anonymous"}</h4>
                            <span className="text-sm text-gray-500">
                              {new Date(comment.published_at).toLocaleDateString()}
                            </span>
                          </div>
                          <p className={`${darkMode ? "text-gray-200" : "text-gray-900"}`}>{comment.content}</p>
                        </div>
                        <div className="flex items-center space-x-4 mt-2">
                          <button 
                            onClick={() => handleCommentLike(comment.id)}
                            className={`flex items-center space-x-1 text-sm transition-colors ${
                              comment.is_liked 
                                ? "text-blue-600 hover:text-blue-700" 
                                : "text-gray-500 hover:text-blue-600"
                            }`}
                          >
                            <ThumbsUp className={`w-4 h-4 ${comment.is_liked ? 'fill-current' : ''}`} />
                            <span>{comment.likes_count || 0}</span>
                          </button>
                          <button
                            onClick={() => setReplyTo(replyTo === comment.id ? null : comment.id)}
                            className={`text-sm transition-colors ${
                              replyTo === comment.id 
                                ? "text-blue-600 font-medium" 
                                : "text-gray-500 hover:text-blue-600"
                            }`}
                          >
                            {replyTo === comment.id ? "Cancel Reply" : "Reply"}
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Replies */}
                    {comment.replies && comment.replies.length > 0 && (
                      <div className="ml-12 space-y-4">
                        {comment.replies.map((reply) => (
                          <div key={reply.id} className="flex space-x-3">
                            <img
                              src={reply.author?.avatar_url || "/placeholder.svg"}
                              alt={`${reply.author?.first_name} ${reply.author?.last_name}`}
                              className="w-8 h-8 rounded-full border-2 border-gray-200"
                            />
                            <div className="flex-1">
                              <div className={`p-3 rounded-lg ${darkMode ? "bg-gray-700" : "bg-gray-50"}`}>
                                <div className="flex items-center justify-between mb-1">
                                  <h5 className="font-medium text-sm">{`${reply.author?.first_name || ""} ${reply.author?.last_name || ""}`.trim() || "Anonymous"}</h5>
                                  <span className="text-xs text-gray-500">
                                    {new Date(reply.published_at).toLocaleDateString()}
                                  </span>
                                </div>
                                <p className={`text-sm ${darkMode ? "text-gray-200" : "text-gray-900"}`}>{reply.content}</p>
                              </div>
                              <div className="flex items-center space-x-4 mt-1">
                                <button 
                                  onClick={() => handleCommentLike(reply.id)}
                                  className={`flex items-center space-x-1 text-xs transition-colors ${
                                    reply.is_liked 
                                      ? "text-blue-600 hover:text-blue-700" 
                                      : "text-gray-500 hover:text-blue-600"
                                  }`}
                                >
                                  <ThumbsUp className={`w-3 h-3 ${reply.is_liked ? 'fill-current' : ''}`} />
                                  <span>{reply.likes_count || 0}</span>
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Related Posts */}
          <div
            className={`mt-12 p-6 rounded-xl border ${
              darkMode ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200"
            }`}
          >
            <h3 className="text-xl font-semibold mb-6">Related Articles</h3>
            {relatedPosts.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {relatedPosts.map((relatedPost) => (
                  <div
                    key={relatedPost.id}
                    onClick={() => navigate(`/blog/${relatedPost.id}`)}
                    className={`p-5 rounded-lg border cursor-pointer hover:shadow-lg transition-all duration-200 ${
                      darkMode 
                        ? "border-gray-600 hover:border-gray-500 hover:bg-gray-750" 
                        : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                    }`}
                  >
                    <div className="mb-3">
                      <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${
                        relatedPost.category === "Technology"
                          ? "bg-blue-100 text-blue-700"
                          : relatedPost.category === "Academic"
                          ? "bg-green-100 text-green-700"
                          : "bg-gray-100 text-gray-700"
                      }`}>
                        {relatedPost.category}
                      </span>
                    </div>
                    
                    <h4 className="font-semibold mb-3 text-lg leading-tight hover:text-blue-600 transition-colors line-clamp-2">
                      {relatedPost.title}
                    </h4>
                    
                    <div className="flex items-center justify-between text-sm text-gray-500 mb-3">
                      <span className="flex items-center space-x-1">
                        <span>by</span>
                        <span className="font-medium text-gray-700 dark:text-gray-300">
                          {relatedPost.author}
                        </span>
                      </span>
                    </div>
                    
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center space-x-4 text-gray-500">
                        <span className="flex items-center space-x-1">
                          <Clock className="w-3 h-3" />
                          <span>{relatedPost.read_time}</span>
                        </span>
                        <span className="flex items-center space-x-1">
                          <Heart className="w-3 h-3" />
                          <span>{relatedPost.likes}</span>
                        </span>
                      </div>
                      
                      <button 
                        onClick={(e) => {
                          e.stopPropagation()
                          navigate(`/blog/${relatedPost.id}`)
                        }}
                        className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                          darkMode
                            ? "bg-blue-600 text-white hover:bg-blue-700"
                            : "bg-blue-100 text-blue-700 hover:bg-blue-200"
                        }`}
                      >
                        Read More
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <div className={`w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center ${
                  darkMode ? "bg-gray-700" : "bg-gray-100"
                }`}>
                  <MessageCircle className="w-8 h-8 text-gray-400" />
                </div>
                <h4 className="text-lg font-medium text-gray-600 mb-2">No Related Articles</h4>
                <p className="text-gray-500 text-sm">
                  We couldn't find any related articles at the moment.
                </p>
                <button
                  onClick={() => navigate("/blog")}
                  className={`mt-4 px-4 py-2 rounded-lg transition-colors ${
                    darkMode
                      ? "bg-gray-700 text-gray-200 hover:bg-gray-600"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  Browse All Articles
                </button>
              </div>
            )}
            
            {/* More by Author Section */}
            {authorPosts.length > 0 && (
              <div className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">
                <h4 className="text-lg font-semibold mb-4">
                  More by {`${post.author?.first_name || ""} ${post.author?.last_name || ""}`.trim() || "This Author"}
                </h4>
                <div className="space-y-3">
                  {authorPosts.slice(0, 3).map((authorPost) => (
                    <div
                      key={authorPost.id}
                      onClick={() => navigate(`/blog/${authorPost.id}`)}
                      className={`p-4 rounded-lg border cursor-pointer hover:shadow-md transition-all ${
                        darkMode 
                          ? "border-gray-600 hover:border-gray-500 hover:bg-gray-750" 
                          : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h5 className="font-medium mb-2 hover:text-blue-600 transition-colors line-clamp-2">
                            {authorPost.title}
                          </h5>
                          <div className="flex items-center space-x-3 text-xs text-gray-500">
                            <span className="flex items-center space-x-1">
                              <Clock className="w-3 h-3" />
                              <span>{authorPost.read_time}</span>
                            </span>
                            <span className="flex items-center space-x-1">
                              <Heart className="w-3 h-3" />
                              <span>{authorPost.likes}</span>
                            </span>
                            <span className={`px-2 py-1 rounded text-xs ${
                              authorPost.category === "Technology"
                                ? "bg-blue-100 text-blue-700"
                                : "bg-gray-100 text-gray-700"
                            }`}>
                              {authorPost.category}
                            </span>
                          </div>
                        </div>
                        <ArrowLeft className="w-4 h-4 text-gray-400 rotate-180 ml-2" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Share Modal */}
      {showShareModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className={`rounded-xl w-full max-w-md ${darkMode ? "bg-gray-800" : "bg-white"}`}>
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Share Article</h3>
                <button
                  onClick={() => setShowShareModal(false)}
                  className={`p-2 rounded-lg transition-colors ${darkMode ? "hover:bg-gray-700" : "hover:bg-gray-100"}`}
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-4">
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

      {/* Report Modal */}
      {showReportModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className={`rounded-xl w-full max-w-md ${darkMode ? "bg-gray-800" : "bg-white"}`}>
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Report Article</h3>
                <button
                  onClick={() => setShowReportModal(false)}
                  className={`p-2 rounded-lg transition-colors ${darkMode ? "hover:bg-gray-700" : "hover:bg-gray-100"}`}
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-4">
              <p className="text-gray-600">Why are you reporting this article?</p>

              <div className="space-y-2">
                {[
                  "Spam or misleading content",
                  "Inappropriate content",
                  "Copyright violation",
                  "Harassment or bullying",
                  "Other",
                ].map((reason) => (
                  <label key={reason} className="flex items-center space-x-3 cursor-pointer">
                    <input type="radio" name="report-reason" className="text-blue-600" />
                    <span>{reason}</span>
                  </label>
                ))}
              </div>

              <textarea
                placeholder="Additional details (optional)"
                rows={3}
                className={`w-full p-3 border rounded-lg resize-none ${
                  darkMode
                    ? "bg-gray-700 border-gray-600 text-white placeholder-gray-400"
                    : "bg-white border-gray-300 placeholder-gray-500"
                }`}
              />

              <div className="flex space-x-3">
                <button
                  onClick={() => setShowReportModal(false)}
                  className={`flex-1 px-4 py-2 border rounded-lg transition-colors ${
                    darkMode ? "border-gray-600 hover:bg-gray-700" : "border-gray-300 hover:bg-gray-50"
                  }`}
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    setShowReportModal(false)
                    toast.success("Report submitted. Thank you for helping keep our community safe.")
                  }}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                >
                  Submit Report
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Toast Notifications */}
      <ToastContainer 
        notifications={toastNotifications} 
        removeNotification={removeNotification} 
      />
      </div>
    </>
  )
}
