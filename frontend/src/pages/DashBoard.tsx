"use client"

import { useState, useEffect } from "react"
import type React from "react"

/** The fields this page reads off /auth/user/. */
interface UserProfileResponse {
  first_name?: string
  last_name?: string
  email?: string | null
  year?: string
  major?: string
  avatar_url?: string | null
  gpa?: string | number
  completed_credits?: number
  username?: string
  followers_count?: number
}
import { useNavigate, Link } from "react-router-dom"
import { Helmet } from 'react-helmet';
import {Calculator, TrendingUp,MessageCircle,
  PenTool,Users,Bell, LogOut, Calendar,
  Award,Target,Activity,BookMarked,
  Menu,X } from "lucide-react"
import NotificationDropdown from "../components/NotificationDropdown"
import SearchTrigger from "../features/search/SearchTrigger"
import notificationsAPI from "../lib/api/endpoints/notifications"
import type { Notification } from "../lib/api/endpoints/notifications"
import calendarApi, { type CalendarEvent } from "../services/calendarApi"
import { communityApi } from "../lib/api/endpoints/community"
import { toList } from "../lib/api/types"
import { todayKey } from "../lib/localDate"
import { api, ApiError } from "../lib/api/client"
import { clearTokens } from "../lib/api/tokens"
import { logger } from "../lib/logger"
import pushNotificationService from "../services/pushNotificationService"
import { getMajorDisplayName, formatYearWithOrdinal } from "../utils/majorUtils"
import { useAppShell } from "../components/layout/appShellContext"
import Spinner from "../components/ui/Spinner"




export default function Dashboard() {
  const navigate = useNavigate()
  const { isSidebarOpen, setIsSidebarOpen } = useAppShell()
  const [currentTime, setCurrentTime] = useState(new Date())
  const [loading, setLoading] = useState(true)
  const [unreadCount, setUnreadCount] = useState(0)
  const [upcomingEvents, setUpcomingEvents] = useState<CalendarEvent[]>([])
  const [recentActivity, setRecentActivity] = useState<Notification[]>([])
  const [groupsJoined, setGroupsJoined] = useState<number | null>(null)
  const [user, setUser] = useState({
    name: "Loading...",
    email: "loading@ufaz.az",
    year: "Loading...",
    major: "Loading...",
    avatar: "/placeholder.svg?height=40&width=40",
    gpa: 0.00,
    completedCredits: 0,
    totalCredits: 120,
    username: "",
    followersCount: 0,
  })

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    const today = todayKey()
    calendarApi
      .list({ start: today })
      .then((events) => {
        const upcoming = events
          .filter((e) => (e.date ?? "") >= today)
          .sort((a, b) => (a.date ?? "").localeCompare(b.date ?? ""))
          .slice(0, 4)
        setUpcomingEvents(upcoming)
      })
      .catch((error) => logger.error("Could not load upcoming events:", error))

    notificationsAPI
      .getNotifications(1, 4)
      .then((data) => setRecentActivity(toList(data).slice(0, 4)))
      .catch((error) => logger.error("Could not load recent activity:", error))

    communityApi
      .getCommunityStats()
      .then((data) => setGroupsJoined(data.user_stats?.groups_joined ?? 0))
      .catch(() => setGroupsJoined(null))
  }, [])

  const formatEventWhen = (event: CalendarEvent) => {
    if (!event.date) return ""
    const when = new Date(`${event.date}T00:00:00`)
    const label = when.toLocaleDateString("en-US", { month: "short", day: "numeric" })
    const time = event.start_time ? ` at ${event.start_time.slice(0, 5)}` : ""
    return `${label}${time}`
  }

  // Initialize push notifications
  useEffect(() => {
    const initializePushNotifications = async () => {
      try {
        await pushNotificationService.initialize();
        
        // Check if user is logged in before fetching notifications
        const access = localStorage.getItem("access");
        if (access) {
          fetchUnreadCount();
        }
      } catch (error) {
        console.error('Failed to initialize push notifications:', error);
      }
    };

    initializePushNotifications();
  }, []);

  const fetchUnreadCount = async () => {
    try {
      const { count } = await notificationsAPI.getUnreadCount();
      setUnreadCount(count);
    } catch {
      // The bell simply keeps its last count.
    }
  };

  const handleCountUpdate = (newCount: number) => {
    setUnreadCount(newCount);
  };

useEffect(() => {
  const access = localStorage.getItem("access");
  if (!access) {
    navigate("/auth");
    return;
  }

  setLoading(true);
  // The client refreshes an expired token and retries, so a 401 reaching here
  // means the session is genuinely gone.
  api
    .get<UserProfileResponse>("/auth/user/")
    .then((data) => {
      setUser({
        // These used to fall back to "Sarah Johnson", her email address and
        // "3rd Year": a real student with no year set was told they were in
        // their third. The name fallback could never fire either, since a
        // template string is truthy even when both halves are empty.
        name: `${data.first_name ?? ""} ${data.last_name ?? ""}`.trim() || data.username || "Your profile",
        email: data.email || "",
        year: data.year ? formatYearWithOrdinal(data.year) : "",
        major: getMajorDisplayName(data.major || "UD"),
        avatar: data.avatar_url || "/placeholder.svg?height=40&width=40",
        gpa: parseFloat(String(data.gpa ?? 0)) || 0.0,
        completedCredits: data.completed_credits || 0,
        totalCredits: 120, // This seems to be a fixed value or calculated elsewhere
        username: data.username ?? "",
        followersCount: data.followers_count || 0,
      })
      setLoading(false);
    })
    .catch((error) => {
      if (error instanceof ApiError && error.isUnauthorized) {
        clearTokens();
        navigate("/auth");
        return;
      }
      logger.error("Error fetching dashboard data:", error);
      setLoading(false);
    });
}, [navigate]);

  const quickActions = [
    {
      title: "Calculate GPA",
      description: "Update your semester grades",
      icon: Calculator,
      color: "bg-blue-50 text-blue-600",
      link: "/gpa-calculator",
    },
    {
      title: "Course Average",
      description: "Check your course performance",
      icon: TrendingUp,
      color: "bg-blue-50 text-blue-600",
      link: "/average-calculator",
    },
    {
      title: "Write Blog Post",
      description: "Share your thoughts",
      icon: PenTool,
      color: "bg-blue-50 text-blue-600",
      link: "/blog/new",
    },
    {
      title: "Join Community",
      description: "Connect with classmates",
      icon: MessageCircle,
      color: "bg-blue-50 text-blue-600",
      link: "/community",
    },
  ]

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <Spinner size="lg" className="mx-auto mb-4" />
          <p className="text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <Helmet>
        <title>Ufazien | Dashboard</title>
        <meta name="description" content="User dashboard for managing academic tasks and activities." />
      </Helmet>
      <div className="flex-1 flex flex-col min-w-0">
      {/* Sidebar */}
      

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="bg-white border-b border-gray-200">
          <div className="flex items-center justify-between h-16 px-4 sm:px-6 lg:px-8">
            <div className="flex items-center gap-4">
              <button onClick={() => setIsSidebarOpen(true)} className="lg:hidden p-2 rounded-md hover:bg-gray-100">
                <Menu className="w-5 h-5" />
              </button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
                <p className="text-sm text-gray-500">
                  {currentTime.toLocaleDateString("en-US", {
                    weekday: "long",
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 sm:gap-4">
              <SearchTrigger />

              {/* Notifications */}
              <div className="flex items-center gap-2">
                <NotificationDropdown 
                  unreadCount={unreadCount} 
                  onCountUpdate={handleCountUpdate}
                />
                {/* <Link 
                  to="/notifications"
                  className="hidden sm:block text-xs text-gray-500 hover:text-blue-600 transition-colors"
                >
                  View All
                </Link> */}
              </div>

              {/* User Profile */}
              <div className="flex items-center gap-3">
                <img
                  onClick={() => navigate('/profile')}
                  src={user.avatar || "/placeholder.svg"}
                  alt={user.name}
                  className="w-8 h-8 rounded-full border-2 border-gray-200 cursor-pointer"
                />
                <div className="hidden sm:block">
                  <p className="text-sm font-medium text-gray-900">{user.name}</p>
                  <p className="text-xs text-gray-500">{user.major}</p>
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Dashboard Content */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          {/* Welcome Section */}
          <div className="mb-8">
            <div className="bg-blue-600 rounded-xl p-6 text-white">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl font-semibold mb-1">
                    Welcome back, {user.name.split(" ")[0]}
                  </h2>
                  <p className="text-blue-100 text-sm">
                    {user.major && user.major !== "Loading..."
                      ? `${user.major}${user.year && user.year !== "Loading..." ? `, ${user.year}` : ""}`
                      : "Pick up where you left off."}
                  </p>
                </div>
                <div className="sm:text-right">
                  <div className="text-3xl font-semibold tabular-nums">{user.gpa.toFixed(2)}</div>
                  <div className="text-blue-100 text-sm">Current GPA</div>
                </div>
              </div>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-8">
            <StatsCard title="Current GPA" value={user.gpa.toFixed(2)} icon={Award} color="text-blue-600" bgColor="bg-blue-50" />
            <StatsCard
              title="Credits Completed"
              value={`${user.completedCredits}/${user.totalCredits}`}
              icon={BookMarked}
              color="text-blue-600"
              bgColor="bg-blue-50"
            />
            <StatsCard
              title="Study Groups"
              value={groupsJoined === null ? "-" : String(groupsJoined)}
              icon={Users}
              color="text-blue-600"
              bgColor="bg-blue-50"
            />
          </div>

          {/* Quick Actions */}
          <div className="mb-8">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {quickActions.map((action, index) => (
                <QuickActionCard key={index} {...action} />
              ))}
            </div>
          </div>

          {/* Main Content Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Upcoming</h3>
                <Link to="/calendar" className="text-blue-600 hover:text-blue-700 text-sm">
                  Calendar
                </Link>
              </div>
              {upcomingEvents.length === 0 ? (
                <p className="text-sm text-gray-500 py-6 text-center">
                  Nothing scheduled. <Link to="/calendar" className="text-blue-600 hover:underline">Add an event</Link>.
                </p>
              ) : (
                <div className="space-y-3">
                  {upcomingEvents.map((event) => (
                    <Link
                      key={event.id}
                      to="/calendar"
                      className="flex items-start gap-3 py-2 hover:bg-gray-50 rounded-lg px-2 -mx-2 transition-colors"
                    >
                      <span className="w-2 h-2 rounded-full bg-blue-600 mt-1.5 shrink-0" />
                      <span className="min-w-0">
                        <span className="block text-sm text-gray-900 truncate">{event.title}</span>
                        <span className="block text-xs text-gray-500">
                          {formatEventWhen(event)}
                        </span>
                      </span>
                    </Link>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Recent Activity</h3>
                <Link to="/notifications" className="text-blue-600 hover:text-blue-700 text-sm">
                  All
                </Link>
              </div>
              {recentActivity.length === 0 ? (
                <p className="text-sm text-gray-500 py-6 text-center">Nothing yet.</p>
              ) : (
                <div className="space-y-3">
                  {recentActivity.map((item) => (
                    <div key={item.id} className="flex items-start gap-3 py-1">
                      <span className="w-2 h-2 rounded-full bg-gray-300 mt-1.5 shrink-0" />
                      <span className="min-w-0">
                        <span className="block text-sm text-gray-900 truncate">{item.title}</span>
                        <span className="block text-xs text-gray-500 truncate">{item.message}</span>
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  </>
  )
}

// Stats Card Component
interface StatsCardProps {
  title: string
  value: React.ReactNode
  icon: React.ComponentType<{ className?: string }>
  color: string
  bgColor: string
}

function StatsCard({ title, value, icon: Icon, color, bgColor }: StatsCardProps) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-600 mb-1">{title}</p>
          <p className="text-2xl font-bold text-gray-900">{value}</p>
        </div>
        <div className={`w-12 h-12 ${bgColor} rounded-lg flex items-center justify-center`}>
          <Icon className={`w-6 h-6 ${color}`} />
        </div>
      </div>
    </div>
  )
}

// Quick Action Card Component
interface QuickActionCardProps {
  title: string
  description: string
  icon: React.ComponentType<{ className?: string }>
  color: string
  link: string
}

function QuickActionCard({ title, description, icon: Icon, color, link }: QuickActionCardProps) {
  const navigate = useNavigate();
  
  const handleClick = () => {
    navigate(link);
  };

  return (
    <div
      onClick={handleClick}
      className="bg-white rounded-xl border border-gray-200 p-6 hover:border-gray-300 transition-colors group cursor-pointer"
    >
      <div className={`w-10 h-10 ${color} rounded-lg flex items-center justify-center mb-4`}>
        <Icon className="w-5 h-5" aria-hidden="true" />
      </div>
      <h4 className="font-semibold text-gray-900 mb-1">{title}</h4>
      <p className="text-sm text-gray-600">{description}</p>
    </div>
  )
}

// Course Progress Card Component

// Event Card Component

// Activity Card Component
