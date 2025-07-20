"use client"

import { useState, useEffect } from "react"
import { useNavigate, Link } from "react-router-dom"
import { Helmet } from 'react-helmet';
import {Calculator, TrendingUp,MessageCircle,
  PenTool,Users,Bell,Search, LogOut, Calendar,
  Award,Target,Activity,BookMarked,GraduationCap,
  Menu,X } from "lucide-react"
import SideBar from "../components/ui/SideBar"
import NotificationDropdown from "../components/NotificationDropdown"
import notificationsAPI from "../services/notificationsAPI"
import pushNotificationService from "../services/pushNotificationService"
import { getMajorDisplayName } from "../utils/majorUtils"


const API_URL = import.meta.env.VITE_API_URL

const API_PROFILE = `${API_URL}/api/auth/user/`

export default function Dashboard() {
  const navigate = useNavigate()
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [currentTime, setCurrentTime] = useState(new Date())
  const [loading, setLoading] = useState(true)
  const [unreadCount, setUnreadCount] = useState(0)
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
      const count = await notificationsAPI.getUnreadCount();
      setUnreadCount(count);
    } catch (error) {
      console.error('Failed to fetch unread count:', error);
    }
  };

  const handleCountUpdate = (newCount) => {
    setUnreadCount(newCount);
  };

useEffect(() => {
  const access = localStorage.getItem("access");
  if (!access) {
    navigate("/auth");
    return;
  }

  setLoading(true);
  fetch(API_PROFILE, {
    headers: {
      Authorization: `Bearer ${access}`,
    },
  })
    .then((res) => {
      if (!res.ok) {
        if (res.status === 401) {
          localStorage.removeItem("access");
          localStorage.removeItem("refresh");
          navigate("/auth");
          return;
        }
        throw new Error("Failed to fetch dashboard data");
      }
      return res.json();
    })
    .then((data) => {
      console.log("Dashboard data:", data);
      setUser({
        name: `${data.first_name} ${data.last_name}` || "Sarah Johnson",
        email: data.email || "sarah.johnson@ufaz.edu.az",
        year: data.year ? `${data.year}${data.year === "1" ? "st" : data.year === "2" ? "nd" : data.year === "3" ? "rd" : "th"} Year` : "3rd Year",
        major: getMajorDisplayName(data.major || "UD"),
        avatar: data.avatar_url || "/placeholder.svg?height=40&width=40",
        gpa: parseFloat(data.gpa) || 0.00,
        completedCredits: data.completed_credits || 0,
        totalCredits: 120, // This seems to be a fixed value or calculated elsewhere
        username: data.username,
        followersCount: data.followers_count || 0,
      })
      setLoading(false);
    })
    .catch((error) => {
      console.error("Error fetching dashboard data:", error);
      setLoading(false);
    });
}, [navigate]);

  const quickActions = [
    {
      title: "Calculate GPA",
      description: "Update your semester grades",
      icon: Calculator,
      color: "bg-blue-500",
      link: "/gpa-calculator",
    },
    {
      title: "Course Average",
      description: "Check your course performance",
      icon: TrendingUp,
      color: "bg-green-500",
      link: "/average-calculator",
    },
    {
      title: "Write Blog Post",
      description: "Share your thoughts",
      icon: PenTool,
      color: "bg-purple-500",
      link: "/blog/new",
    },
    {
      title: "Join Community",
      description: "Connect with classmates",
      icon: MessageCircle,
      color: "bg-orange-500",
      link: "/community",
    },
  ]

  const recentActivities = [
    {
      type: "gpa",
      title: "GPA Updated",
      description: "Your Fall 2024 GPA has been calculated: 3.85",
      time: "2 hours ago",
      icon: Award,
    },
    {
      type: "blog",
      title: "New Blog Post",
      description: "You published 'Tips for Final Exams'",
      time: "1 day ago",
      icon: PenTool,
    },
    {
      type: "community",
      title: "Joined Group",
      description: "You joined 'CS301 Study Group'",
      time: "2 days ago",
      icon: Users,
    },
    {
      type: "achievement",
      title: "Achievement Unlocked",
      description: "Completed 75% of your degree requirements",
      time: "3 days ago",
      icon: Target,
    },
  ]

  const upcomingEvents = [
    {
      title: "Midterm Exam - Database Systems",
      date: "Tomorrow",
      time: "10:00 AM",
      type: "exam",
    },
    {
      title: "CS Club Meeting",
      date: "Friday",
      time: "3:00 PM",
      type: "meeting",
    },
    {
      title: "Project Deadline - Web Development",
      date: "Next Monday",
      time: "11:59 PM",
      type: "deadline",
    },
  ]

  const courseProgress = [
    { name: "Database Systems", progress: 85, grade: "A-" },
    { name: "Web Development", progress: 92, grade: "A" },
    { name: "Data Structures", progress: 78, grade: "B+" },
    { name: "Software Engineering", progress: 88, grade: "A-" },
  ]

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
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
      <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar */}
      <SideBar
        isSidebarOpen={isSidebarOpen}
        setIsSidebarOpen={setIsSidebarOpen}
        pageTitle="Dashboard"
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

            <div className="flex items-center gap-4">
              {/* Search */}
              <div className="hidden sm:block relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  type="text"
                  placeholder="Search..."
                  className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

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
                  src={user.avatar || "/placeholder.svg"}
                  alt={user.name}
                  className="w-8 h-8 rounded-full border-2 border-gray-200"
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
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl p-6 text-white">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold mb-2">Welcome back, {user.name.split(" ")[0]}! 👋</h2>
                  <p className="text-blue-100 mb-4 sm:mb-0">
                    You're doing great this semester. Keep up the excellent work!
                  </p>
                </div>
                <div className="text-right">
                  <div className="text-3xl font-bold">{user.gpa.toFixed(2)}</div>
                  <div className="text-blue-100 text-sm">Current GPA</div>
                </div>
              </div>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <StatsCard title="Current GPA" value={user.gpa.toFixed(2)} icon={Award} color="text-blue-600" bgColor="bg-blue-50" />
            <StatsCard
              title="Credits Completed"
              value={`${user.completedCredits}/${user.totalCredits}`}
              icon={BookMarked}
              color="text-green-600"
              bgColor="bg-green-50"
            />
            <StatsCard
              title="Active Courses"
              value="4"
              icon={GraduationCap}
              color="text-purple-600"
              bgColor="bg-purple-50"
            />
            <StatsCard title="Study Groups" value="3" icon={Users} color="text-orange-600" bgColor="bg-orange-50" />
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
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Course Progress */}
            <div className="lg:col-span-2">
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-lg font-semibold text-gray-900">Course Progress</h3>
                  <button className="text-blue-600 hover:text-blue-700 font-medium text-sm">View All</button>
                </div>
                <div className="space-y-4">
                  {courseProgress.map((course, index) => (
                    <CourseProgressCard key={index} {...course} />
                  ))}
                </div>
              </div>
            </div>

            {/* Sidebar Content */}
            <div className="space-y-6">
              {/* Upcoming Events */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">Upcoming</h3>
                  <Calendar className="w-5 h-5 text-gray-400" />
                </div>
                <div className="space-y-3">
                  {upcomingEvents.map((event, index) => (
                    <EventCard key={index} {...event} />
                  ))}
                </div>
              </div>

              {/* Recent Activity */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Activity</h3>
                <div className="space-y-3">
                  {recentActivities.slice(0, 3).map((activity, index) => (
                    <ActivityCard key={index} {...activity} />
                  ))}
                </div>
                <button className="w-full mt-4 text-blue-600 hover:text-blue-700 font-medium text-sm">
                  View All Activity
                </button>
              </div>
            </div>
          </div>
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

// Stats Card Component
function StatsCard({ title, value, icon: Icon, color, bgColor }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
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
function QuickActionCard({ title, description, icon: Icon, color, link }) {
  const navigate = useNavigate();
  
  const handleClick = () => {
    navigate(link);
  };

  return (
    <div
      onClick={handleClick}
      className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow group cursor-pointer"
    >
      <div
        className={`w-12 h-12 ${color} rounded-lg flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}
      >
        <Icon className="w-6 h-6 text-white" />
      </div>
      <h4 className="font-semibold text-gray-900 mb-2">{title}</h4>
      <p className="text-sm text-gray-600">{description}</p>
    </div>
  )
}

// Course Progress Card Component
function CourseProgressCard({ name, progress, grade }) {
  return (
    <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
      <div className="flex-1">
        <div className="flex items-center justify-between mb-2">
          <h4 className="font-medium text-gray-900">{name}</h4>
          <span className="text-sm font-semibold text-gray-700">{grade}</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className="bg-gradient-to-r from-blue-500 to-indigo-500 h-2 rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
        <p className="text-xs text-gray-500 mt-1">{progress}% Complete</p>
      </div>
    </div>
  )
}

// Event Card Component
function EventCard({ title, date, time, type }) {
  const getTypeColor = (type) => {
    switch (type) {
      case "exam":
        return "bg-red-100 text-red-700"
      case "meeting":
        return "bg-blue-100 text-blue-700"
      case "deadline":
        return "bg-orange-100 text-orange-700"
      default:
        return "bg-gray-100 text-gray-700"
    }
  }

  return (
    <div className="flex items-start gap-3 p-3 hover:bg-gray-50 rounded-lg transition-colors">
      <div className={`w-2 h-2 rounded-full mt-2 ${getTypeColor(type).split(" ")[0]}`} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 truncate">{title}</p>
        <p className="text-xs text-gray-500">
          {date} at {time}
        </p>
      </div>
    </div>
  )
}

// Activity Card Component
function ActivityCard({ title, description, time, icon: Icon }) {
  return (
    <div className="flex items-start gap-3">
      <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
        <Icon className="w-4 h-4 text-blue-600" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900">{title}</p>
        <p className="text-xs text-gray-600 mb-1">{description}</p>
        <p className="text-xs text-gray-400">{time}</p>
      </div>
    </div>
  )
}
