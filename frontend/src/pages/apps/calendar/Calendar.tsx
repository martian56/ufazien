"use client"

import { useState, useEffect } from "react"
import type { CalendarEvent } from "../../../services/calendarApi"
import DayView from "../../../features/calendar/DayView"
import EventDetailsModal from "../../../features/calendar/EventDetailsModal"
import EventModal from "../../../features/calendar/EventModal"
import MonthView from "../../../features/calendar/MonthView"
import WeekView from "../../../features/calendar/WeekView"
import { downloadCsv, eventsToCsv } from "../../../features/calendar/exportCsv"
import { Helmet } from "react-helmet"
import { calendarApi } from "../../../services/calendarApi"
import {
  CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Plus,
  Search,
  Filter,
  Menu,
  BookOpen,
  FileText,
  Users,
  User,
  Download,
  AlertCircle,
  BookMarked,
  Heart,
  Star,
} from "lucide-react"
import { toLocalDateKey, todayKey } from "../../../lib/localDate"
import { useAppShell } from "../../../components/layout/appShellContext"
import { SidebarPanel } from "../../../components/layout/AppShell"

export default function Calendar() {
  const { isSidebarOpen, setIsSidebarOpen } = useAppShell()
  const [currentDate, setCurrentDate] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [viewMode, setViewMode] = useState("month") // month, week, day
  const [showEventModal, setShowEventModal] = useState(false)
  const [showEventDetails, setShowEventDetails] = useState(false)
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [filterCategory, setFilterCategory] = useState("all")
  const [showFilters, setShowFilters] = useState(false)

  const [newEvent, setNewEvent] = useState<Partial<CalendarEvent>>({
    title: "",
    description: "",
    date: "",
    startTime: "",
    endTime: "",
    location: "",
    category: "class",
    priority: "medium",
    recurring: "none",
  })

  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [eventsLoading, setEventsLoading] = useState(true)
  const [eventsError, setEventsError] = useState<string | null>(null)

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
  const navigateMonth = (direction: number) => {
    const newDate = new Date(currentDate)
    newDate.setMonth(currentDate.getMonth() + direction)
    setCurrentDate(newDate)
  }

  const navigateWeek = (direction: number) => {
    const newDate = new Date(currentDate)
    newDate.setDate(currentDate.getDate() + direction * 7)
    setCurrentDate(newDate)
  }

  const navigateDay = (direction: number) => {
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
  const getEventsForDate = (date: Date) => {
    // Local parts, not toISOString: see lib/localDate. Every cell is local
    // midnight, so going through UTC shifted the whole grid by a day here.
    const dateStr = toLocalDateKey(date)
    return events.filter((event) => {
      const eventDate = event.date
      const matchesDate = eventDate === dateStr
      const matchesCategory = filterCategory === "all" || event.category === filterCategory
      const matchesSearch =
        !searchQuery ||
        event.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (event.description ?? "").toLowerCase().includes(searchQuery.toLowerCase()) ||
        (event.location ?? "").toLowerCase().includes(searchQuery.toLowerCase())

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
        (event.description ?? "").toLowerCase().includes(searchQuery.toLowerCase()) ||
        (event.location ?? "").toLowerCase().includes(searchQuery.toLowerCase())

      return matchesCategory && matchesSearch
    })
  }

  // Generate calendar days for month view
  const generateCalendarDays = () => {
    const year = currentDate.getFullYear()
    const month = currentDate.getMonth()
    const firstDay = new Date(year, month, 1)
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
      recurring: "none",
    })
    setShowEventModal(false)
  }

  // Handle event deletion
  const handleDeleteEvent = (eventId: number) => {
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
    downloadCsv(
      eventsToCsv(getFilteredEvents()),
      `calendar-${todayKey()}.csv`
    )
  }

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

  return (
    <>
      <Helmet>
        <title>Ufazien | Calendar</title>
        <meta name="description" content="Manage your academic schedule with Ufazien's calendar." />
      </Helmet>
      <SidebarPanel>
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
                    filterCategory === category.id ? "bg-white" : "hover:bg-white"
                  }`}
                >
                  <div className={`w-3 h-3 rounded-full ${category.color}`} />
                  <span className="text-gray-700">{category.name}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </SidebarPanel>
      <div className="flex-1 flex flex-col min-w-0">
        {eventsError && (
          <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[60] bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded-lg">
            Could not sync your calendar: {eventsError}
          </div>
        )}
        {eventsLoading && (
          <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[60] bg-white border border-gray-200 text-gray-600 px-4 py-2 rounded-lg">
            Loading your events...
          </div>
        )}
        {/* Sidebar */}
        

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="bg-white border-b border-gray-200">
          <div className="flex items-center justify-between h-16 px-4 sm:px-6 lg:px-8">
            <div className="flex items-center gap-2 sm:gap-4 min-w-0">
              <button onClick={() => setIsSidebarOpen(true)} className="lg:hidden p-2 rounded-md hover:bg-gray-100">
                <Menu className="w-5 h-5" />
              </button>
              <div>
                <h1 className="text-lg sm:text-2xl font-bold text-gray-900 flex items-center gap-2">
                  Calendar
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
                  className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
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
                disabled={getFilteredEvents().length === 0}
                title={
                  getFilteredEvents().length === 0
                    ? "No events to export with the current filter"
                    : "Download these events as a CSV"
                }
                className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent"
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
    </div>
  </>
  )
}

// Month View Component
