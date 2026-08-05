"use client"

import { useState, useEffect } from "react"
import { Helmet } from "react-helmet"
import { useNavigate } from "react-router-dom"
import { calendarApi } from "../../../services/calendarApi"
import {
  CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Plus,
  Search,
  Filter,
  Menu,
  X,
  BookOpen,
  BarChart3,
  Calculator,
  TrendingUp,
  FileText,
  Users,
  Clock,
  MapPin,
  User,
  Edit,
  Trash2,
  Download,
  AlertCircle,
  BookMarked,
  Heart,
  Star,
  Activity,
  PenTool,
  Settings,
} from "lucide-react"

export default function Calendar() {
  const navigate = useNavigate()
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [currentDate, setCurrentDate] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [viewMode, setViewMode] = useState("month") // month, week, day
  const [showEventModal, setShowEventModal] = useState(false)
  const [showEventDetails, setShowEventDetails] = useState(false)
  const [selectedEvent, setSelectedEvent] = useState(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [filterCategory, setFilterCategory] = useState("all")
  const [showFilters, setShowFilters] = useState(false)

  const [newEvent, setNewEvent] = useState({
    title: "",
    description: "",
    date: "",
    startTime: "",
    endTime: "",
    location: "",
    category: "class",
    priority: "medium",
    reminder: "15",
    recurring: "none",
  })

  const [events, setEvents] = useState([])
  const [eventsLoading, setEventsLoading] = useState(true)
  const [eventsError, setEventsError] = useState(null)

  useEffect(() => {
    let cancelled = false
    setEventsLoading(true)
    calendarApi
      .list()
      .then((data) => {
        if (!cancelled) {
          setEvents(data)
          setEventsError(null)
        }
      })
      .catch((err) => {
        if (!cancelled) setEventsError(err?.message || "Failed to load events")
      })
      .finally(() => {
        if (!cancelled) setEventsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const categories = [
    { id: "all", name: "All Events", color: "bg-gray-500", icon: CalendarIcon },
    { id: "class", name: "Classes", color: "bg-blue-500", icon: BookOpen },
    { id: "exam", name: "Exams", color: "bg-red-600", icon: AlertCircle },
    { id: "assignment", name: "Assignments", color: "bg-red-500", icon: FileText },
    { id: "study", name: "Study Sessions", color: "bg-green-500", icon: BookMarked },
    { id: "meeting", name: "Meetings", color: "bg-orange-500", icon: User },
    { id: "event", name: "Events", color: "bg-purple-500", icon: Star },
    { id: "club", name: "Club Activities", color: "bg-indigo-500", icon: Users },
    { id: "personal", name: "Personal", color: "bg-pink-500", icon: Heart },
  ]

  const priorities = [
    { id: "low", name: "Low", color: "text-green-600" },
    { id: "medium", name: "Medium", color: "text-yellow-600" },
    { id: "high", name: "High", color: "text-red-600" },
  ]


  // Calendar navigation
  const navigateMonth = (direction) => {
    const newDate = new Date(currentDate)
    newDate.setMonth(currentDate.getMonth() + direction)
    setCurrentDate(newDate)
  }

  const navigateWeek = (direction) => {
    const newDate = new Date(currentDate)
    newDate.setDate(currentDate.getDate() + direction * 7)
    setCurrentDate(newDate)
  }

  const navigateDay = (direction) => {
    const newDate = new Date(currentDate)
    newDate.setDate(currentDate.getDate() + direction)
    setCurrentDate(newDate)
  }

  const goToToday = () => {
    const today = new Date()
    setCurrentDate(today)
    setSelectedDate(today)
  }

  // Get events for a specific date
  const getEventsForDate = (date) => {
    const dateStr = date.toISOString().split("T")[0]
    return events.filter((event) => {
      const eventDate = event.date
      const matchesDate = eventDate === dateStr
      const matchesCategory = filterCategory === "all" || event.category === filterCategory
      const matchesSearch =
        !searchQuery ||
        event.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        event.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        event.location.toLowerCase().includes(searchQuery.toLowerCase())

      return matchesDate && matchesCategory && matchesSearch
    })
  }

  // Get all filtered events
  const getFilteredEvents = () => {
    return events.filter((event) => {
      const matchesCategory = filterCategory === "all" || event.category === filterCategory
      const matchesSearch =
        !searchQuery ||
        event.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        event.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        event.location.toLowerCase().includes(searchQuery.toLowerCase())

      return matchesCategory && matchesSearch
    })
  }

  // Generate calendar days for month view
  const generateCalendarDays = () => {
    const year = currentDate.getFullYear()
    const month = currentDate.getMonth()
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    const startDate = new Date(firstDay)
    startDate.setDate(startDate.getDate() - firstDay.getDay())

    const days = []
    const current = new Date(startDate)

    for (let i = 0; i < 42; i++) {
      days.push(new Date(current))
      current.setDate(current.getDate() + 1)
    }

    return days
  }

  // Generate week days for week view
  const generateWeekDays = () => {
    const startOfWeek = new Date(currentDate)
    startOfWeek.setDate(currentDate.getDate() - currentDate.getDay())

    const days = []
    for (let i = 0; i < 7; i++) {
      const day = new Date(startOfWeek)
      day.setDate(startOfWeek.getDate() + i)
      days.push(day)
    }
    return days
  }

  // Handle event creation
  const handleCreateEvent = () => {
    if (!newEvent.title || !newEvent.date || !newEvent.startTime) return

    calendarApi
      .create(newEvent)
      .then((created) => {
        setEvents((current) => [...current, created])
        setEventsError(null)
      })
      .catch((err) => setEventsError(err?.message || "Failed to create event"))

    setNewEvent({
      title: "",
      description: "",
      date: "",
      startTime: "",
      endTime: "",
      location: "",
      category: "class",
      priority: "medium",
      reminder: "15",
      recurring: "none",
    })
    setShowEventModal(false)
  }

  // Handle event deletion
  const handleDeleteEvent = (eventId) => {
    const previous = events
    setEvents(events.filter((event) => event.id !== eventId))
    setShowEventDetails(false)
    setSelectedEvent(null)
    calendarApi.remove(eventId).catch((err) => {
      // Put it back if the server rejected the delete.
      setEvents(previous)
      setEventsError(err?.message || "Failed to delete event")
    })
  }

  // Export calendar to CSV
  const exportCalendar = () => {
    const csvContent = [
      "Title,Description,Date,Start Time,End Time,Location,Category,Priority",
      ...getFilteredEvents().map((event) =>
        [
          event.title,
          event.description,
          event.date,
          event.startTime,
          event.endTime,
          event.location,
          event.category,
          event.priority,
        ].join(","),
      ),
    ].join("\n")

    const blob = new Blob([csvContent], { type: "text/csv" })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `calendar-${new Date().toISOString().split("T")[0]}.csv`
    a.click()
  }

  const sidebarItems = [
    { name: "Dashboard", icon: Activity, link: "/dashboard" },
    { name: "GPA Calculator", icon: Calculator, link: "/gpa-calculator" },
    { name: "Average Calculator", icon: TrendingUp, link: "/average-calculator" },
    { name: "Blog", icon: PenTool, link: "/blog" },
    { name: "Community", icon: Users, link: "/community" },
    { name: "Calendar", icon: CalendarIcon, active: true },
    { name: "Settings", icon: Settings, link: "/settings" },
  ]

  const monthNames = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ]

  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

  return (
    <>
      <Helmet>
        <title>Ufazien | Calendar</title>
        <meta name="description" content="Manage your academic schedule with Ufazien's calendar." />
      </Helmet>
      <div className="min-h-screen bg-gray-50 flex">
        {eventsError && (
          <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[60] bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded-lg shadow-sm">
            Could not sync your calendar: {eventsError}
          </div>
        )}
        {eventsLoading && (
          <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[60] bg-white border border-gray-200 text-gray-600 px-4 py-2 rounded-lg shadow-sm">
            Loading your events...
          </div>
        )}
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

        {/* Mini Calendar */}
        <div className="mt-8 px-3">
          <div className="bg-gray-50 rounded-lg p-4">
            <h3 className="font-medium text-gray-900 mb-3">Quick Navigation</h3>
            <button
              onClick={goToToday}
              className="w-full px-3 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors mb-3"
            >
              Go to Today
            </button>
            <div className="space-y-2">
              {categories.slice(1, 5).map((category) => (
                <button
                  key={category.id}
                  onClick={() => setFilterCategory(category.id)}
                  className={`flex items-center gap-2 w-full px-2 py-1 text-sm rounded transition-colors ${
                    filterCategory === category.id ? "bg-white shadow-sm" : "hover:bg-white"
                  }`}
                >
                  <div className={`w-3 h-3 rounded-full ${category.color}`} />
                  <span className="text-gray-700">{category.name}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="bg-white shadow-sm border-b border-gray-200">
          <div className="flex items-center justify-between h-16 px-4 sm:px-6 lg:px-8">
            <div className="flex items-center gap-2 sm:gap-4 min-w-0">
              <button onClick={() => setIsSidebarOpen(true)} className="lg:hidden p-2 rounded-md hover:bg-gray-100">
                <Menu className="w-5 h-5" />
              </button>
              <div>
                <h1 className="text-lg sm:text-2xl font-bold text-gray-900 flex items-center gap-2">
                  Calendar
                  <span className="hidden sm:inline-block px-2 py-1 text-xs bg-yellow-100 text-yellow-800 rounded-full">In Development</span>
                </h1>
                <p className="hidden sm:block text-sm text-gray-500">Manage your academic schedule</p>
              </div>
            </div>

            <div className="flex items-center gap-2 sm:gap-4 shrink-0">
              {/* Search */}
              <div className="hidden sm:block relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  type="text"
                  placeholder="Search events..."
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

              {/* Export Button */}
              <button
                onClick={exportCalendar}
                className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <Download className="w-4 h-4" />
                <span className="hidden sm:inline">Export</span>
              </button>

              {/* Add Event Button */}
              <button
                onClick={() => setShowEventModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Plus className="w-4 h-4" />
                <span className="hidden sm:inline">Add Event</span>
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

        {/* Calendar Content */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          {/* Calendar Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6">
            <div className="flex items-center gap-4 mb-4 sm:mb-0">
              <h2 className="text-2xl font-bold text-gray-900">
                {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
              </h2>
              <div className="flex items-center gap-1">
                <button
                  onClick={() =>
                    viewMode === "month" ? navigateMonth(-1) : viewMode === "week" ? navigateWeek(-1) : navigateDay(-1)
                  }
                  className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={() =>
                    viewMode === "month" ? navigateMonth(1) : viewMode === "week" ? navigateWeek(1) : navigateDay(1)
                  }
                  className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* View Mode Selector */}
            <div className="flex items-center gap-2">
              <div className="flex bg-gray-100 rounded-lg p-1">
                <button
                  onClick={() => setViewMode("month")}
                  className={`px-3 py-1 text-sm font-medium rounded-md transition-colors ${
                    viewMode === "month" ? "bg-white text-gray-900 shadow-sm" : "text-gray-600 hover:text-gray-900"
                  }`}
                >
                  Month
                </button>
                <button
                  onClick={() => setViewMode("week")}
                  className={`px-3 py-1 text-sm font-medium rounded-md transition-colors ${
                    viewMode === "week" ? "bg-white text-gray-900 shadow-sm" : "text-gray-600 hover:text-gray-900"
                  }`}
                >
                  Week
                </button>
                <button
                  onClick={() => setViewMode("day")}
                  className={`px-3 py-1 text-sm font-medium rounded-md transition-colors ${
                    viewMode === "day" ? "bg-white text-gray-900 shadow-sm" : "text-gray-600 hover:text-gray-900"
                  }`}
                >
                  Day
                </button>
              </div>
            </div>
          </div>

          {/* Calendar Views */}
          {viewMode === "month" && (
            <MonthView
              days={generateCalendarDays()}
              currentDate={currentDate}
              selectedDate={selectedDate}
              onDateSelect={setSelectedDate}
              getEventsForDate={getEventsForDate}
              onEventClick={(event) => {
                setSelectedEvent(event)
                setShowEventDetails(true)
              }}
            />
          )}

          {viewMode === "week" && (
            <WeekView
              days={generateWeekDays()}
              getEventsForDate={getEventsForDate}
              onEventClick={(event) => {
                setSelectedEvent(event)
                setShowEventDetails(true)
              }}
            />
          )}

          {viewMode === "day" && (
            <DayView
              date={currentDate}
              events={getEventsForDate(currentDate)}
              onEventClick={(event) => {
                setSelectedEvent(event)
                setShowEventDetails(true)
              }}
            />
          )}
        </main>
      </div>

      {/* Add Event Modal */}
      {showEventModal && (
        <EventModal
          event={newEvent}
          onChange={setNewEvent}
          onSave={handleCreateEvent}
          onClose={() => setShowEventModal(false)}
          categories={categories}
          priorities={priorities}
          isEditing={false}
        />
      )}

      {/* Event Details Modal */}
      {showEventDetails && selectedEvent && (
        <EventDetailsModal
          event={selectedEvent}
          onClose={() => {
            setShowEventDetails(false)
            setSelectedEvent(null)
          }}
          onDelete={handleDeleteEvent}
          categories={categories}
        />
      )}

      {/* Mobile Sidebar Overlay */}
      {isSidebarOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden" onClick={() => setIsSidebarOpen(false)} />
      )}
    </div>
  </>
  )
}

// Month View Component
function MonthView({ days, currentDate, selectedDate, onDateSelect, getEventsForDate, onEventClick }) {
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
  const today = new Date()

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      {/* Day Headers */}
      <div className="grid grid-cols-7 border-b border-gray-200">
        {dayNames.map((day) => (
          <div key={day} className="p-4 text-center font-medium text-gray-700 bg-gray-50">
            {day}
          </div>
        ))}
      </div>

      {/* Calendar Grid */}
      <div className="grid grid-cols-7">
        {days.map((day, index) => {
          const isCurrentMonth = day.getMonth() === currentDate.getMonth()
          const isToday = day.toDateString() === today.toDateString()
          const isSelected = day.toDateString() === selectedDate.toDateString()
          const dayEvents = getEventsForDate(day)

          return (
            <div
              key={index}
              className={`min-h-32 p-2 border-r border-b border-gray-200 cursor-pointer hover:bg-gray-50 transition-colors ${
                !isCurrentMonth ? "bg-gray-50 text-gray-400" : ""
              } ${isSelected ? "bg-blue-50" : ""}`}
              onClick={() => onDateSelect(day)}
            >
              <div className="flex items-center justify-between mb-1">
                <span
                  className={`text-sm font-medium ${
                    isToday
                      ? "bg-blue-600 text-white w-6 h-6 rounded-full flex items-center justify-center"
                      : isCurrentMonth
                        ? "text-gray-900"
                        : "text-gray-400"
                  }`}
                >
                  {day.getDate()}
                </span>
              </div>

              {/* Events */}
              <div className="space-y-1">
                {dayEvents.slice(0, 3).map((event) => (
                  <div
                    key={event.id}
                    onClick={(e) => {
                      e.stopPropagation()
                      onEventClick(event)
                    }}
                    className={`text-xs p-1 rounded text-white truncate cursor-pointer hover:opacity-80 ${event.color}`}
                  >
                    {event.title}
                  </div>
                ))}
                {dayEvents.length > 3 && (
                  <div className="text-xs text-gray-500 font-medium">+{dayEvents.length - 3} more</div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// Week View Component
function WeekView({ days, getEventsForDate, onEventClick }) {
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
  const today = new Date()

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      {/* Day Headers */}
      <div className="grid grid-cols-7 border-b border-gray-200">
        {days.map((day, index) => {
          const isToday = day.toDateString() === today.toDateString()
          return (
            <div key={index} className="p-4 text-center border-r border-gray-200 last:border-r-0">
              <div className="text-sm font-medium text-gray-700">{dayNames[day.getDay()]}</div>
              <div
                className={`text-lg font-bold mt-1 ${
                  isToday
                    ? "bg-blue-600 text-white w-8 h-8 rounded-full flex items-center justify-center mx-auto"
                    : "text-gray-900"
                }`}
              >
                {day.getDate()}
              </div>
            </div>
          )
        })}
      </div>

      {/* Events Grid */}
      <div className="grid grid-cols-7 min-h-96">
        {days.map((day, index) => {
          const dayEvents = getEventsForDate(day)
          return (
            <div key={index} className="p-2 border-r border-gray-200 last:border-r-0">
              <div className="space-y-1">
                {dayEvents.map((event) => (
                  <div
                    key={event.id}
                    onClick={() => onEventClick(event)}
                    className={`text-xs p-2 rounded text-white cursor-pointer hover:opacity-80 ${event.color}`}
                  >
                    <div className="font-medium truncate">{event.title}</div>
                    <div className="opacity-90">
                      {event.startTime} - {event.endTime}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// Day View Component
function DayView({ date, events, onEventClick }) {
  const hours = Array.from({ length: 24 }, (_, i) => i)

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      {/* Day Header */}
      <div className="p-6 border-b border-gray-200">
        <h3 className="text-xl font-bold text-gray-900">
          {date.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
        </h3>
        <p className="text-gray-600 mt-1">{events.length} events scheduled</p>
      </div>

      {/* Time Grid */}
      <div className="max-h-96 overflow-y-auto">
        {hours.map((hour) => {
          const hourEvents = events.filter((event) => {
            const eventHour = Number.parseInt(event.startTime.split(":")[0])
            return eventHour === hour
          })

          return (
            <div key={hour} className="flex border-b border-gray-100">
              <div className="w-20 p-4 text-sm text-gray-500 border-r border-gray-200">
                {hour.toString().padStart(2, "0")}:00
              </div>
              <div className="flex-1 p-2">
                {hourEvents.map((event) => (
                  <div
                    key={event.id}
                    onClick={() => onEventClick(event)}
                    className={`p-3 rounded-lg mb-2 cursor-pointer hover:opacity-80 ${event.color} text-white`}
                  >
                    <div className="font-medium">{event.title}</div>
                    <div className="text-sm opacity-90">
                      {event.startTime} - {event.endTime}
                    </div>
                    {event.location && (
                      <div className="text-sm opacity-90 flex items-center gap-1 mt-1">
                        <MapPin className="w-3 h-3" />
                        {event.location}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// Event Modal Component
function EventModal({ event, onChange, onSave, onClose, categories, priorities, isEditing }) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-900">{isEditing ? "Edit Event" : "Create New Event"}</h2>
            <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 rounded-lg">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-4">
          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Event Title</label>
            <input
              type="text"
              placeholder="Enter event title..."
              value={event.title}
              onChange={(e) => onChange({ ...event, title: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
            <textarea
              placeholder="Enter event description..."
              value={event.description}
              onChange={(e) => onChange({ ...event, description: e.target.value })}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
            />
          </div>

          {/* Date and Time */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Date</label>
              <input
                type="date"
                value={event.date}
                onChange={(e) => onChange({ ...event, date: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Start Time</label>
              <input
                type="time"
                value={event.startTime}
                onChange={(e) => onChange({ ...event, startTime: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">End Time</label>
              <input
                type="time"
                value={event.endTime}
                onChange={(e) => onChange({ ...event, endTime: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Location */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Location</label>
            <input
              type="text"
              placeholder="Enter location..."
              value={event.location}
              onChange={(e) => onChange({ ...event, location: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Category and Priority */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Category</label>
              <select
                value={event.category}
                onChange={(e) => onChange({ ...event, category: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                {categories.slice(1).map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Priority</label>
              <select
                value={event.priority}
                onChange={(e) => onChange({ ...event, priority: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                {priorities.map((priority) => (
                  <option key={priority.id} value={priority.id}>
                    {priority.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Reminder and Recurring */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Reminder</label>
              <select
                value={event.reminder}
                onChange={(e) => onChange({ ...event, reminder: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="none">No reminder</option>
                <option value="5">5 minutes before</option>
                <option value="15">15 minutes before</option>
                <option value="30">30 minutes before</option>
                <option value="60">1 hour before</option>
                <option value="1440">1 day before</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Recurring</label>
              <select
                value={event.recurring}
                onChange={(e) => onChange({ ...event, recurring: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="none">No repeat</option>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
              </select>
            </div>
          </div>
        </div>

        <div className="p-6 border-t border-gray-200 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onSave}
            disabled={!event.title || !event.date || !event.startTime}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isEditing ? "Update Event" : "Create Event"}
          </button>
        </div>
      </div>
    </div>
  )
}

// Event Details Modal Component
function EventDetailsModal({ event, onClose, onDelete, categories }) {
  const category = categories.find((cat) => cat.id === event.category)
  const CategoryIcon = category?.icon || CalendarIcon

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-lg">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-3">
              <div className={`w-12 h-12 ${event.color} rounded-lg flex items-center justify-center`}>
                <CategoryIcon className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-gray-900">{event.title}</h2>
                <p className="text-gray-600 mt-1">{event.description}</p>
              </div>
            </div>
            <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 rounded-lg">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-4">
          {/* Date and Time */}
          <div className="flex items-center gap-3">
            <Clock className="w-5 h-5 text-gray-400" />
            <div>
              <div className="font-medium text-gray-900">
                {new Date(event.date).toLocaleDateString("en-US", {
                  weekday: "long",
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                })}
              </div>
              <div className="text-gray-600">
                {event.startTime} - {event.endTime}
              </div>
            </div>
          </div>

          {/* Location */}
          {event.location && (
            <div className="flex items-center gap-3">
              <MapPin className="w-5 h-5 text-gray-400" />
              <div className="text-gray-900">{event.location}</div>
            </div>
          )}

          {/* Category */}
          <div className="flex items-center gap-3">
            <CategoryIcon className="w-5 h-5 text-gray-400" />
            <div className="text-gray-900">{category?.name}</div>
          </div>

          {/* Priority */}
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-gray-400" />
            <div className="text-gray-900 capitalize">{event.priority} Priority</div>
          </div>

          {/* Additional Info */}
          {event.professor && (
            <div className="flex items-center gap-3">
              <User className="w-5 h-5 text-gray-400" />
              <div className="text-gray-900">{event.professor}</div>
            </div>
          )}

          {event.courseCode && (
            <div className="flex items-center gap-3">
              <BookOpen className="w-5 h-5 text-gray-400" />
              <div className="text-gray-900">{event.courseCode}</div>
            </div>
          )}
        </div>

        <div className="p-6 border-t border-gray-200 flex justify-between">
          <button
            onClick={() => onDelete(event.id)}
            className="flex items-center gap-2 px-4 py-2 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
          >
            <Trash2 className="w-4 h-4" />
            Delete Event
          </button>
          <div className="flex gap-3">
            <button className="flex items-center gap-2 px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
              <Edit className="w-4 h-4" />
              Edit
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
