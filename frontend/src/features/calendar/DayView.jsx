import { MapPin } from "lucide-react"

export default function DayView({ date, events, onEventClick }) {
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
