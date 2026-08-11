import { X } from "lucide-react"
import type { CalendarEvent } from "../../services/calendarApi"
import Select from "../../components/ui/Select"

interface Option {
  id: string
  name: string
}

interface EventModalProps {
  event: Partial<CalendarEvent>
  onChange: (event: Partial<CalendarEvent>) => void
  onSave: () => void
  onClose: () => void
  categories: Option[]
  priorities: Option[]
  isEditing: boolean
}

export default function EventModal({
  event,
  onChange,
  onSave,
  onClose,
  categories,
  priorities,
  isEditing,
}: EventModalProps) {
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
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
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
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 resize-none"
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
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Start Time</label>
              <input
                type="time"
                value={event.startTime}
                onChange={(e) => onChange({ ...event, startTime: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">End Time</label>
              <input
                type="time"
                value={event.endTime}
                onChange={(e) => onChange({ ...event, endTime: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
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
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
            />
          </div>

          {/* Category and Priority */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Category</label>
              <Select
                value={event.category ?? ""}
                onChange={(value) => onChange({ ...event, category: value })}
                options={categories.slice(1).map((category) => ({
                  value: String(category.id),
                  label: category.name,
                }))}
                aria-label="Category"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Priority</label>
              <Select
                value={event.priority ?? ""}
                onChange={(value) => onChange({ ...event, priority: value })}
                options={priorities.map((priority) => ({
                  value: String(priority.id),
                  label: priority.name,
                }))}
                aria-label="Priority"
              />
            </div>
          </div>

          {/* A Reminder select used to sit beside this. CalendarEvent has no
              reminder field, in the model or the serializer, so the choice was
              dropped on save; and with nothing scheduling future work there is
              no way to deliver one. Recurring is real and stays. */}
          <div className="grid grid-cols-1 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Recurring</label>
              <Select
        value={event.recurring ?? "none"}
        onChange={(value) => onChange({ ...event, recurring: value })}
        options={[
          { value: "none", label: "No repeat" },
          { value: "daily", label: "Daily" },
          { value: "weekly", label: "Weekly" },
          { value: "monthly", label: "Monthly" },
        ]}
      />
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
