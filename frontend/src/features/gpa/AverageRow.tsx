import { Trash2 } from "lucide-react"

interface AverageRowProps {
  average: { id: number; period: string; average: string; gradeType: string }
  index: number
  onUpdate: (id: number, field: string, value: string) => void
  onRemove: (id: number) => void
  canRemove: boolean
  activeTab: string
}


export default function AverageRow({ average, index, onUpdate, onRemove, canRemove, activeTab }: AverageRowProps) {
  return (
    <div className="p-4 bg-gray-50 rounded-lg space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* Period Name */}
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">
            {activeTab === "semester" ? "Semester" : "Year"}
          </label>
          <input
            type="text"
            placeholder={activeTab === "semester" ? "e.g., Semester 1" : "e.g., Year 1"}
            value={average.period}
            onChange={(e) => onUpdate(average.id, "period", e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {/* Grade Type */}
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Grade System</label>
          <select
            value={average.gradeType}
            onChange={(e) => onUpdate(average.id, "gradeType", e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="ufaz">UFAZ (20-point)</option>
            <option value="azerbaijan">Azerbaijan (100-point)</option>
            <option value="gpa">Direct GPA (4.0)</option>
          </select>
        </div>

        {/* Average Input */}
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">
            Average {
              average.gradeType === "ufaz" ? "(0-20)" :
              average.gradeType === "azerbaijan" ? "(0-100)" :
              "(0-4.0)"
            }
          </label>
          <input
            type="number"
            placeholder={
              average.gradeType === "ufaz" ? "16.5" :
              average.gradeType === "azerbaijan" ? "85" :
              "3.5"
            }
            min="0"
            max={
              average.gradeType === "ufaz" ? "20" :
              average.gradeType === "azerbaijan" ? "100" :
              "4.0"
            }
            step={average.gradeType === "ufaz" ? "0.1" : average.gradeType === "gpa" ? "0.01" : "1"}
            value={average.average}
            onChange={(e) => onUpdate(average.id, "average", e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      </div>

      {/* Remove Button */}
      {canRemove && (
        <div className="flex justify-end pt-2">
          <button
            onClick={() => onRemove(average.id)}
            className="p-2 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  )
}
