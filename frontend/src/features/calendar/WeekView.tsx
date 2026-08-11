import type { CalendarEvent } from "../../services/calendarApi"

interface WeekViewProps {
  days: Date[]
  getEventsForDate: (date: Date) => CalendarEvent[]
  onEventClick: (event: CalendarEvent) => void
}

export default function WeekView({ days, getEventsForDate, onEventClick }: WeekViewProps) {
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
  const today = new Date()

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
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
