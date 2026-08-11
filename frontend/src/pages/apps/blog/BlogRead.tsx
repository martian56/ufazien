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

import { getMajorDisplayName, formatYearDisplay } from "../../../utils/majorUtils"
// import "../../../components/RichTextEditor.css"
// import "../../../components/BlogContent.css"
import PostBody from "../../../features/blog/PostBody"
import BlogComments from "../../../features/blog/BlogComments"
import ReadingSettingsPanel from "../../../features/blog/ReadingSettingsPanel"
import { countComments } from "../../../features/blog/countComments"
import { errorMessage } from "../../../lib/api/errors"
import RelatedReading from "../../../features/blog/RelatedReading"
import ShareModal from "../../../features/blog/ShareModal"
import ReportModal from "../../../features/blog/ReportModal"
import { copyText } from "../../../lib/clipboard"
import { blogApi } from "../../../lib/api/endpoints/blog"
import type { BlogPost } from "../../../lib/api/endpoints/blog"
import type { RelatedPostSummary } from "../../../features/blog/RelatedReading"
import type { BlogComment } from "../../../features/blog/BlogComments"
import { logger } from "../../../lib/logger"
import { api } from "../../../lib/api/client"
import { toList } from "../../../lib/api/types"

/** Just what the header shows. The API never sends another user's email. */
interface ReaderProfile {
  id: number | null
  name: string
  avatar: string
  year: string
  major: string
}
import { isAuthenticated } from "../../../lib/api/tokens"
import { processblogContent, extractPlainText, calculateReadTime } from "../../../utils/contentProcessor"
import { useToast, ToastContainer } from "../../../hooks/useToast"
import { useAppShell } from "../../../components/layout/appShellContext"
import Spinner from "../../../components/ui/Spinner"

// Helper function to strip HTML tags for text processing
export default function BlogRead() {
  const { notifications: toastNotifications, toast, removeNotification } = useToast();
  const { id } = useParams()
  const navigate = useNavigate()

  // Sidebar state
  const { isSidebarOpen, setIsSidebarOpen } = useAppShell()

  // Core state
  const [post, setPost] = useState<BlogPost | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isLiked, setIsLiked] = useState(false)
  const [isBookmarked, setIsBookmarked] = useState(false)
  const [isFollowing, setIsFollowing] = useState(false)
  const [likes, setLikes] = useState(0)
  const [views, setViews] = useState(0)

  // Comments state
  const [comments, setComments] = useState<BlogComment[]>([])
  const [newComment, setNewComment] = useState("")
  const [replyTo, setReplyTo] = useState<number | null>(null)
  const [showComments, setShowComments] = useState(true)
  const [commentsLoading, setCommentsLoading] = useState(false)

  // Reading experience state
  const [readingProgress, setReadingProgress] = useState(0)
  const [estimatedReadTime, setEstimatedReadTime] = useState(0)
  const [actualReadTime, setActualReadTime] = useState(0)
  const [startTime, setStartTime] = useState<number | null>(null)
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
  const [speechVoice, setSpeechVoice] = useState<SpeechSynthesisVoice | null>(null)
  const [currentPosition, setCurrentPosition] = useState(0)
  const [speechSupported, setSpeechSupported] = useState(false)

  // Social features
  const [showShareModal, setShowShareModal] = useState(false)
  const [showReportModal, setShowReportModal] = useState(false)

  // Related content
  const [relatedPosts, setRelatedPosts] = useState<RelatedPostSummary[]>([])
  const [authorPosts, setAuthorPosts] = useState<RelatedPostSummary[]>([])
  const [authorPostsCount, setAuthorPostsCount] = useState(0)

  // User state
  const [currentUser, setCurrentUser] = useState<ReaderProfile>({
    id: null,
    name: "",
    avatar: "/placeholder.svg?height=40&width=40",
    year: "",
    major: "",
  })

  // Refs
  const contentRef = useRef<HTMLDivElement>(null)
  const speechRef = useRef<SpeechSynthesisUtterance | null>(null)
  const progressRef = useRef<HTMLDivElement>(null)

  // Enhance blog content after rendering
  useEffect(() => {
    if (contentRef.current && post) {
      // Content is already enhanced by contentProcessor, 
      // so we just handle any additional dynamic features here
      const images = contentRef.current.querySelectorAll('img');
      images.forEach((img) => {
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
        if (!isAuthenticated()) return

        const userData = await api.get<{
          id: number
          first_name?: string
          last_name?: string
          avatar_url?: string | null
          year?: string
          major?: string
        }>('/auth/user/me/')
        {
          setCurrentUser({
            id: userData.id,
            name: `${userData.first_name ?? ""} ${userData.last_name ?? ""}`.trim(),
            avatar: userData.avatar_url || "/placeholder.svg?height=40&width=40",
            year: userData.year ?? "",
            major: userData.major ?? "",
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
        const data = await blogApi.get(id!)

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
        setComments((data.comments as BlogComment[] | undefined) ?? [])

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
        if (!isAuthenticated()) return

        const data = await blogApi.trackView(post.id) as { views?: number }
        if (typeof data?.views === "number") {
          setViews(data.views)
          setPost((prevPost) => (prevPost ? { ...prevPost, views: data.views! } : prevPost))
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
      if (!isAuthenticated()) {
        navigate("/auth")
        return
      }

      const data = await api.post<{ following: boolean; followers_count: number }>(
        `/auth/user/${post.author.id}/follow/`
      )

      setIsFollowing(data.following)
      setPost((prevPost) =>
        prevPost
          ? {
              ...prevPost,
              author: { ...prevPost.author, followers_count: data.followers_count },
            }
          : prevPost
      )
    } catch (error) {
      console.error("Error toggling follow:", error)
    }
  }

  /**
   * A post as the sidebar shows it: the author flattened to a display name,
   * because RelatedReading renders a string there rather than a user object.
   */
  const toSummary = (item: BlogPost): RelatedPostSummary => ({
    id: item.id,
    title: item.title,
    // `a + ' ' + b` left a bare space for an author with no name set.
    author:
      `${item.author?.first_name ?? ""} ${item.author?.last_name ?? ""}`.trim() ||
      item.author?.username ||
      "Someone",
    read_time: item.read_time,
    likes: item.likes_count,
    category: item.category_name,
  })

  // Load related posts by tags
  const loadRelatedPosts = async (tags: string[], currentPostId: number) => {
    try {
      const data = await blogApi.list({ tag: tags[0] })
      setRelatedPosts(
        (data.results ?? [])
          .filter((item) => item.id !== currentPostId)
          .slice(0, 3)
          .map(toSummary)
      )
    } catch (error) {
      logger.error("Error loading related posts:", error)
    }
  }

  // Load author's other posts
  const loadAuthorPosts = async (authorId: number, currentPostId: number) => {
    try {
      const data = await blogApi.list({ by: authorId })
      setAuthorPostsCount(data.count ?? 0)
      setAuthorPosts(
        (data.results ?? [])
          .filter((item) => item.id !== currentPostId)
          .slice(0, 3)
          .map(toSummary)
      )
    } catch (error) {
      logger.error("Error loading author posts:", error)
    }
  }


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
      await blogApi.toggleLike(id!)
      setIsLiked(!isLiked)
      setLikes((prev) => (isLiked ? prev - 1 : prev + 1))
    } catch (error) {
      logger.error("Error liking post:", error)
    }
  }

  const handleBookmark = async () => {
    try {
      await blogApi.toggleBookmark(id!)
      setIsBookmarked(!isBookmarked)
    } catch (error) {
      logger.error("Error bookmarking post:", error)
    }
  }

  const handleShare = (platform: string) => {
    const url = window.location.href
    const title = post?.title || "Check out this article"

    const shareUrls: Record<string, string> = {
      twitter: `https://twitter.com/intent/tweet?text=${encodeURIComponent(title)}&url=${encodeURIComponent(url)}`,
      facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
      linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`,
    }

    if (shareUrls[platform]) {
      window.open(shareUrls[platform], "_blank", "width=600,height=400")
    }
  }

  const copyToClipboard = async () => {
    // Was fire-and-forget: it never awaited or caught the write and always
    // claimed success, so the message lied whenever the clipboard rejected.
    const copied = await copyText(window.location.href)
    if (copied) toast.success("Link copied to clipboard!")
    else toast.error("Could not copy the link.")
  }

  const handleComment = async () => {
    if (!newComment.trim()) return

    try {
      setCommentsLoading(true)
      // A failed post used to fall straight through: the box kept its text,
      // nothing appeared, and nothing said why. The client throws now.
      await blogApi.addComment(id!, newComment, replyTo)

      const postData = await blogApi.get(id!)
      setComments((postData.comments as BlogComment[] | undefined) ?? [])

      setNewComment("")
      setReplyTo(null)
    } catch (error) {
      toast.error(errorMessage(error, "Your comment could not be posted."))
    } finally {
      setCommentsLoading(false)
    }
  }

  const handleCommentLike = async (commentId: number) => {
    try {
      await api.post(`/blog/comments/${commentId}/like/`)
      // Refresh the comments by fetching the post again.
      const postData = await blogApi.get(id!)
      setComments((postData.comments as BlogComment[] | undefined) ?? [])
    } catch (error) {
      logger.error("Error liking comment:", error)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <Spinner size="lg" className="mx-auto mb-4" />
          <p className="text-gray-600">Loading blog post...</p>
        </div>
      </div>
    )
  }

  if (error || !post) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
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
        className={`flex-1 flex flex-col min-w-0 transition-colors duration-300 ${darkMode ? "bg-gray-900 text-white" : "bg-white text-gray-900"}`}
      >
        {/* Sidebar */}
        

  {/* Main Content */}
  <div className="flex-1 flex flex-col overflow-hidden">
          {/* Reading Progress Bar */}
          <div className="fixed top-0 left-0 lg:left-64 w-full lg:w-[calc(100%-16rem)] h-1 bg-gray-200 z-50">
            <div
              className="h-full bg-blue-600 transition-all duration-300"
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

                {/* The serializer field is is_featured; `post.featured` is
                    undefined, so this badge has never appeared on a featured
                    post. */}
                {post.is_featured && (
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
            <ReadingSettingsPanel
              darkMode={darkMode}
              fontSize={fontSize}
              setFontSize={setFontSize}
              fontFamily={fontFamily}
              setFontFamily={setFontFamily}
              lineHeight={lineHeight}
              setLineHeight={setLineHeight}
              speechRate={speechRate}
              setSpeechRate={setSpeechRate}
              isPlaying={isPlaying}
              speechSupported={speechSupported}
            />
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
                      {post.author?.year ? formatYearDisplay(post.author.year) : "Student"} • {getMajorDisplayName(post.author?.major)}
                    </p>
                  </div>
                </div>

                <div className="flex items-center space-x-4 text-sm text-gray-500">
                  <span className="flex items-center space-x-1">
                    <Calendar className="w-4 h-4" />
                    <span>{new Date(post.published_at ?? post.created_at ?? 0).toLocaleDateString()}</span>
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
                    <span>{countComments(comments)} {countComments(comments) === 1 ? "comment" : "comments"}</span>
                  </span>
                </div>

              </div>
            </header>

            {/* Article Content. Shared with the editor's preview so the two
                cannot drift apart. */}
            <div ref={contentRef}>
              <PostBody
                html={processblogContent(post.content)}
                darkMode={darkMode}
                fontFamily={fontFamily}
                fontSize={fontSize}
                lineHeight={lineHeight}
              />
            </div>
          </article>

          {/* Article Actions */}
          <div
            className={`sticky bottom-6 mt-12 p-4 rounded-lg border ${
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
                  <span>{countComments(comments)}</span>
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
                  {post.author?.year ? formatYearDisplay(post.author.year) : "Student"} • {getMajorDisplayName(post.author?.major)}
                </p>
                {post.author?.bio && (
                  <p className="text-gray-600 mb-3 text-sm leading-relaxed">
                    {post.author.bio}
                  </p>
                )}
                <div className="flex items-center space-x-4 text-sm text-gray-500">
                  <span>{authorPostsCount || 0} posts</span>
                  <span>{post.author?.followers_count || 0} followers</span>
                  {Number(post.author?.gpa) > 0 && (
                    <span>GPA: {post.author.gpa}</span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {showComments && (
            <BlogComments
              comments={comments}
              commentsLoading={commentsLoading}
              currentUser={currentUser}
              darkMode={darkMode}
              newComment={newComment}
              setNewComment={setNewComment}
              replyTo={replyTo}
              setReplyTo={setReplyTo}
              onSubmitComment={handleComment}
              onLikeComment={handleCommentLike}
            />
          )}


          <RelatedReading
            relatedPosts={relatedPosts}
            authorPosts={authorPosts}
            post={post}
            darkMode={darkMode}
            onOpenPost={(id) => navigate(id ? `/blog/${id}` : "/blog")}
          />
        </main>
      </div>


      {showShareModal && (
        <ShareModal
          darkMode={darkMode}
          onClose={() => setShowShareModal(false)}
          onShare={handleShare}
          onCopyLink={copyToClipboard}
        />
      )}

      {showReportModal && (
        <ReportModal
          darkMode={darkMode}
          post={post}
          onClose={() => setShowReportModal(false)}
          onDone={() =>
            toast.success("Report submitted. Thank you for helping keep our community safe.")
          }
        />
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
