import { AlertCircle, BookOpen, Calendar as CalendarIcon, Clock, Edit, MapPin, Trash2, User, X } from "lucide-react"

export default function EventDetailsModal({ event, onClose, onDelete, categories }) {
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
