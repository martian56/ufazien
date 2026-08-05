import { Lightbulb, Plus, Sparkles } from "lucide-react"

/** Writing suggestions panel. The suggestions themselves come from the page. */
export default function WritingAssistant({ darkMode, suggestions, onGenerate }) {
  return (
    <div className={`rounded-xl shadow-sm border p-6 ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold flex items-center">
          <Sparkles className="w-4 h-4 mr-2" />
          AI Assistant
        </h3>
        <button
          onClick={onGenerate}
          className="p-1 rounded bg-gradient-to-r from-blue-500 to-purple-500 text-white hover:from-blue-600 hover:to-purple-600"
          aria-label="Get a writing suggestion"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>

      <div className="space-y-3">
        {suggestions.slice(-3).map((suggestion) => (
          <div key={suggestion.id} className={`p-3 rounded-lg text-sm ${darkMode ? 'bg-gray-700' : 'bg-blue-50'}`}>
            <div className="flex items-start space-x-2">
              <Lightbulb className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
              <p>{suggestion.text}</p>
            </div>
          </div>
        ))}

        {suggestions.length === 0 && (
          <p className="text-gray-500 text-sm text-center py-4">
            Click + to get AI writing suggestions
          </p>
        )}
      </div>
    </div>
  )
}
