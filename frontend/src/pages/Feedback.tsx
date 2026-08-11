"use client"

import { useState, useEffect } from "react"
import type React from "react"
import { ApiError, errorMessage } from "../lib/api/errors"
import { useNavigate } from "react-router-dom"
import { Helmet } from "react-helmet"
import {
  MessageSquare,
  Send,
  Clock,
  CheckCircle,
  AlertCircle,
  Bug,
  Lightbulb,
  Shield,
  Star,
  MessageCircle,
  ChevronRight,
  RefreshCw
} from "lucide-react"
import { Button } from "../components/ui/button"
import { Input } from "../components/ui/input"
import { Label } from "../components/ui/label"
import { Textarea } from "../components/ui/textarea"
import { useToast, ToastContainer } from "../hooks/useToast"
import { api as apiClient } from "../lib/api/client"
import { useAppShell } from "../components/layout/appShellContext"

interface FeedbackType {
  value: string
  label: string
}

interface RateLimitStatus {
  can_submit?: boolean
  seconds_remaining?: number
}

interface FeedbackEntry {
  id: number
  feedback_type: string
  subject: string
  message: string
  status?: string
  /** Filled in when someone answers. */
  admin_response?: string | null
  created_at: string
}

export default function Feedback() {
  const navigate = useNavigate()
  const { notifications, toast, removeNotification } = useToast()
  const { isSidebarOpen, setIsSidebarOpen } = useAppShell()
  const [loading, setLoading] = useState(false)
  const [canSubmit, setCanSubmit] = useState(true)
  const [rateLimitInfo, setRateLimitInfo] = useState<RateLimitStatus | null>(null)
  const [countdown, setCountdown] = useState(0)
  const [feedbackTypes, setFeedbackTypes] = useState<FeedbackType[]>([])
  const [userFeedbacks, setUserFeedbacks] = useState<FeedbackEntry[]>([])
  const [loadingHistory, setLoadingHistory] = useState(true)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalCount, setTotalCount] = useState(0)

  const [formData, setFormData] = useState({
    feedback_type: "",
    subject: "",
    message: "",
  })

  const [errors, setErrors] = useState<Record<string, string>>({})

  // Feedback type icons mapping
  const getFeedbackIcon = (type: string) => {
    switch (type) {
      case "bug":
        return <Bug className="w-5 h-5" />
      case "vulnerability":
        return <Shield className="w-5 h-5" />
      case "feature":
        return <Lightbulb className="w-5 h-5" />
      case "improvement":
        return <Star className="w-5 h-5" />
      case "share_me_on_testimonials":
        return <MessageCircle className="w-5 h-5" />
      case "general":
        return <MessageSquare className="w-5 h-5" />
      default:
        return <MessageSquare className="w-5 h-5" />
    }
  }

  // Fetch feedback types
  useEffect(() => {
    const fetchFeedbackTypes = async () => {
      try {
        const data = await apiClient.get<{ feedback_types: FeedbackType[] }>('/feedback/types/')
        if (data?.feedback_types) {
          setFeedbackTypes(data.feedback_types)
        }
      } catch (error) {
        console.error("Failed to fetch feedback types:", error)
      }
    }

    fetchFeedbackTypes()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Check rate limit status
  const checkRateLimitStatus = async () => {
    try {
      const data = await apiClient.get<RateLimitStatus>('/feedback/status/')
      if (data) {
        setCanSubmit(data.can_submit !== false)
        setRateLimitInfo(data)
        
        if (!data.can_submit && data.seconds_remaining) {
          setCountdown(data.seconds_remaining)
        }
      }
    } catch (error) {
      console.error("Failed to check rate limit:", error)
      // Default to allowing submission if check fails
      setCanSubmit(true)
    }
  }

  // Fetch user's feedback history
  const fetchUserFeedbacks = async (page = 1) => {
    try {
      setLoadingHistory(true)
      const data = await apiClient.get<{ results?: FeedbackEntry[]; count?: number }>(`/feedback/?page=${page}`)
      setUserFeedbacks(data?.results || [])
      setCurrentPage(page)
      
      // Calculate total pages
      if (data?.count) {
        setTotalCount(data.count)
        const pageSize = data.results?.length || 10
        setTotalPages(Math.ceil(data.count / pageSize))
      }
    } catch (error) {
      console.error("Failed to fetch feedback history:", error)
      setUserFeedbacks([])
    } finally {
      setLoadingHistory(false)
    }
  }

  // Initial load
  useEffect(() => {
    checkRateLimitStatus()
    fetchUserFeedbacks()
  }, [])

  // Countdown timer
  useEffect(() => {
    if (countdown > 0) {
      const timer = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            setCanSubmit(true)
            setRateLimitInfo(null)
            return 0
          }
          return prev - 1
        })
      }, 1000)

      return () => clearInterval(timer)
    }
  }, [countdown])

  // Format countdown time
  const formatCountdown = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, "0")}`
  }

  // Validate form
  const validateForm = () => {
    const newErrors: Record<string, string> = {}

    if (!formData.feedback_type) {
      newErrors.feedback_type = "Please select a feedback type"
    }

    if (!formData.subject || formData.subject.trim().length < 5) {
      newErrors.subject = "Subject must be at least 5 characters"
    }

    if (!formData.message || formData.message.trim().length < 10) {
      newErrors.message = "Message must be at least 10 characters"
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!canSubmit) {
      toast.error("Please wait before submitting another feedback")
      return
    }

    if (!validateForm()) {
      toast.error("Please fix the errors in the form")
      return
    }

    setLoading(true)

    try {
      const data = await apiClient.post<{ message?: string }>('/feedback/', formData)
      
      toast.success(data?.message || "Feedback submitted successfully! Thank you for your input.")
      
      // Reset form
      setFormData({
        feedback_type: "",
        subject: "",
        message: "",
      })
      
      // Update rate limit info
      await checkRateLimitStatus()
      
      // Refresh feedback history
      await fetchUserFeedbacks()
    } catch (error) {
      // ApiError carries the status, so the rate limit is a number to read
      // rather than a string to search for.
      if (error instanceof ApiError && error.status === 429) {
        toast.error("You're submitting feedback too quickly. Please wait a moment.")
        await checkRateLimitStatus()
      } else {
        toast.error(errorMessage(error, "Failed to submit feedback. Please try again."))
      }
    } finally {
      setLoading(false)
    }
  }

  // Handle input change
  const handleInputChange = (field: "feedback_type" | "subject" | "message", value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: "" }))
    }
  }

  // Get status badge
  const getStatusBadge = (status?: string) => {
    const badges = {
      pending: { color: "bg-yellow-100 text-yellow-800", icon: <Clock className="w-3 h-3" />, label: "Pending" },
      in_review: { color: "bg-blue-100 text-blue-800", icon: <RefreshCw className="w-3 h-3" />, label: "In Review" },
      resolved: { color: "bg-green-100 text-green-800", icon: <CheckCircle className="w-3 h-3" />, label: "Resolved" },
      closed: { color: "bg-gray-100 text-gray-800", icon: <AlertCircle className="w-3 h-3" />, label: "Closed" },
    }

    const badge = badges[status as keyof typeof badges] || badges.pending

    return (
      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${badge.color}`}>
        {badge.icon}
        {badge.label}
      </span>
    )
  }

  // Format relative time
  const getRelativeTime = (dateString?: string) => {
    if (!dateString) return "Unknown time"

    const diffInSeconds = Math.floor((Date.now() - new Date(dateString).getTime()) / 1000)

    if (diffInSeconds < 60) return "Just now"
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} minutes ago`
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} hours ago`
    if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)} days ago`
    return new Date(dateString).toLocaleDateString()
  }

  return (
    <>
      <Helmet>
        <title>Feedback | Ufazien</title>
        <meta name="description" content="Send feedback, report bugs, or request features" />
      </Helmet>

      <div className="flex-1 flex flex-col min-w-0">
        {/* Sidebar */}
        
        <ToastContainer notifications={notifications} removeNotification={removeNotification} />

        {/* Main Content */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Header */}
          <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="flex items-center justify-between h-16">
                <div className="flex items-center gap-4">
                  <button
                    onClick={() => setIsSidebarOpen(true)}
                    className="lg:hidden p-2 rounded-lg hover:bg-gray-100 transition-colors"
                  >
                    <svg
                      className="w-6 h-6 text-gray-600"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M4 6h16M4 12h16M4 18h16"
                      />
                    </svg>
                  </button>
                  <div>
                    <h1 className="text-2xl font-bold text-gray-900">Feedback</h1>
                    <p className="text-sm text-gray-600">Help us improve Ufazien</p>
                  </div>
                </div>
              </div>
            </div>
          </header>

          {/* Main Content Area */}
          <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
            <div className="max-w-7xl mx-auto">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Feedback Form */}
            <div className="lg:col-span-2">
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="p-6 border-b border-gray-200">
                  <div className="flex items-center gap-3">
                    <MessageSquare className="w-5 h-5 text-gray-400" />
                    <div>
                      <h2 className="text-xl font-semibold text-gray-900">Submit Feedback</h2>
                      <p className="text-sm text-gray-500">Tell us what is working and what is not</p>
                    </div>
                  </div>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-6">
                  {/* Rate Limit Warning */}
                  {!canSubmit && rateLimitInfo && (
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                      <div className="flex items-start gap-3">
                        <Clock className="w-5 h-5 text-yellow-600 mt-0.5" />
                        <div className="flex-1">
                          <h3 className="font-semibold text-yellow-900">Rate Limit</h3>
                          <p className="text-sm text-yellow-800 mt-1">
                            You can submit another feedback in{" "}
                            <span className="font-mono font-bold">{formatCountdown(countdown)}</span>
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Feedback Type */}
                  <div className="space-y-2">
                    <Label htmlFor="feedback_type" className="text-sm font-medium text-gray-700">
                      Feedback Type <span className="text-red-500">*</span>
                    </Label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {feedbackTypes.length > 0 ? (
                        feedbackTypes.map((type) => (
                          <button
                            key={type.value}
                            type="button"
                            onClick={() => handleInputChange("feedback_type", type.value)}
                            className={`p-3 rounded-lg border-2 transition-all ${
                              formData.feedback_type === type.value
                                ? "border-blue-600 bg-blue-50 text-blue-700"
                                : "border-gray-200 hover:border-gray-300 text-gray-700"
                            }`}
                          >
                            <div className="flex flex-col items-center gap-2">
                              {getFeedbackIcon(type.value)}
                              <span className="text-xs font-medium text-center">{type.label}</span>
                            </div>
                          </button>
                        ))
                      ) : (
                        <div className="col-span-3 text-sm text-gray-500 text-center py-4">
                          Loading feedback types...
                        </div>
                      )}
                    </div>
                    {errors.feedback_type && (
                      <p className="text-sm text-red-600">{errors.feedback_type}</p>
                    )}
                  </div>

                  {/* Subject */}
                  <div className="space-y-2">
                    <Label htmlFor="subject" className="text-sm font-medium text-gray-700">
                      Subject <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="subject"
                      type="text"
                      placeholder="Brief summary of your feedback"
                      value={formData.subject}
                      onChange={(e) => handleInputChange("subject", e.target.value)}
                      className={errors.subject ? "border-red-500" : ""}
                      disabled={!canSubmit}
                    />
                    {errors.subject && <p className="text-sm text-red-600">{errors.subject}</p>}
                  </div>

                  {/* Message */}
                  <div className="space-y-2">
                    <Label htmlFor="message" className="text-sm font-medium text-gray-700">
                      Message <span className="text-red-500">*</span>
                    </Label>
                    <Textarea
                      id="message"
                      placeholder="Provide detailed information about your feedback..."
                      value={formData.message}
                      onChange={(e) => handleInputChange("message", e.target.value)}
                      className={`min-h-[150px] ${errors.message ? "border-red-500" : ""}`}
                      disabled={!canSubmit}
                    />
                    {errors.message && <p className="text-sm text-red-600">{errors.message}</p>}
                  </div>

                  {/* Submit Button */}
                  <Button
                    type="submit"
                    disabled={loading || !canSubmit}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 rounded-lg transition-colors disabled:opacity-60"
                  >
                    {loading ? (
                      <div className="flex items-center justify-center gap-2">
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        Submitting...
                      </div>
                    ) : (
                      <div className="flex items-center justify-center gap-2">
                        <Send className="w-4 h-4" />
                        Submit Feedback
                      </div>
                    )}
                  </Button>
                </form>
              </div>
            </div>

            {/* Sidebar Info */}
            <div className="space-y-6">
              {/* Guidelines */}
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <h3 className="font-semibold text-gray-900 mb-4">Feedback Guidelines</h3>
                <ul className="space-y-3 text-sm text-gray-600">
                  <li className="flex items-start gap-2">
                    <CheckCircle className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                    <span>Be specific and descriptive</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                    <span>Include steps to reproduce bugs</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                    <span>One feedback per submission</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                    <span>Rate limit: 1 feedback per 5 minutes</span>
                  </li>
                </ul>
              </div>

              {/* Quick Stats */}
              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <h3 className="font-semibold text-gray-900 mb-4">Your Feedback</h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-500">Total submitted</span>
                    <span className="text-lg font-semibold text-gray-900">{userFeedbacks.length}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-500">Pending</span>
                    <span className="text-lg font-semibold text-gray-900">
                      {userFeedbacks.filter((f) => f.status === "pending").length}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-500">Resolved</span>
                    <span className="text-lg font-semibold text-gray-900">
                      {userFeedbacks.filter((f) => f.status === "resolved").length}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Feedback History */}
          <div className="mt-8">
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="p-6 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900">Your Feedback History</h2>
                <p className="text-sm text-gray-600 mt-1">Track the status of your submissions</p>
              </div>

              <div className="divide-y divide-gray-200">
                {loadingHistory ? (
                  <div className="p-8 text-center">
                    <div className="inline-block w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
                    <p className="text-sm text-gray-600 mt-2">Loading feedback history...</p>
                  </div>
                ) : userFeedbacks.length === 0 ? (
                  <div className="p-8 text-center">
                    <MessageSquare className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                    <p className="text-gray-600">No feedback submitted yet</p>
                    <p className="text-sm text-gray-500 mt-1">Your feedback history will appear here</p>
                  </div>
                ) : (
                  userFeedbacks.map((feedback) => (
                    <div key={feedback.id} className="p-6 hover:bg-gray-50 transition-colors">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-start gap-3 flex-1">
                          <div className="p-2 rounded-lg bg-gray-100">
                            {getFeedbackIcon(feedback.feedback_type)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="font-semibold text-gray-900 truncate">{feedback.subject}</h3>
                            <p className="text-sm text-gray-600 mt-1 line-clamp-2">{feedback.message}</p>
                            <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
                              <span>{getRelativeTime(feedback.created_at)}</span>
                              <span>•</span>
                              <span className="capitalize">
                                {feedbackTypes.find((t) => t.value === feedback.feedback_type)?.label ||
                                  feedback.feedback_type}
                              </span>
                            </div>
                            {feedback.admin_response && (
                              <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                                <p className="text-sm font-medium text-blue-900 mb-1">Admin Response:</p>
                                <p className="text-sm text-blue-800">{feedback.admin_response}</p>
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex-shrink-0">{getStatusBadge(feedback.status)}</div>
                      </div>
                    </div>
                  ))
                )}
              </div>
              
              {/* Pagination */}
              {!loadingHistory && totalPages > 1 && (
                <div className="p-4 border-t border-gray-200 bg-gray-50">
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-gray-600">
                      Showing page {currentPage} of {totalPages} ({totalCount} total)
                    </p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => fetchUserFeedbacks(currentPage - 1)}
                        disabled={currentPage === 1}
                        className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        Previous
                      </button>
                      <button
                        onClick={() => fetchUserFeedbacks(currentPage + 1)}
                        disabled={currentPage === totalPages}
                        className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
            </div>
          </main>
        </div>
      </div>
    </>
  )
}