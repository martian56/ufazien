import { Minus, Plus, Type, Volume2 } from "lucide-react"

/**
 * Reading preferences for an article: type size, typeface, line height and
 * the speech rate for read-aloud.
 *
 * Lifted out of BlogRead, which was a single function holding the whole
 * reader.
 */
export default function ReadingSettingsPanel({
  darkMode,
  fontSize,
  setFontSize,
  fontFamily,
  setFontFamily,
  lineHeight,
  setLineHeight,
  speechRate,
  setSpeechRate,
  isPlaying,
  speechSupported,
}) {
  return (
    <div className={`border-t p-4 ${darkMode ? "border-gray-700 bg-gray-800" : "border-gray-200 bg-white"}`}>
      <div className="flex items-center justify-between max-w-4xl mx-auto">
        <div className="flex items-center space-x-6">
          {/* Font Size */}
          <div className="flex items-center space-x-2">
            <Type className="w-4 h-4 text-gray-500" />
            <button
              onClick={() => setFontSize(Math.max(14, fontSize - 2))}
              className={`p-1 rounded ${darkMode ? "hover:bg-gray-700" : "hover:bg-gray-100"}`}
            >
              <Minus className="w-3 h-3" />
            </button>
            <span className="text-sm font-medium w-8 text-center">{fontSize}</span>
            <button
              onClick={() => setFontSize(Math.min(24, fontSize + 2))}
              className={`p-1 rounded ${darkMode ? "hover:bg-gray-700" : "hover:bg-gray-100"}`}
            >
              <Plus className="w-3 h-3" />
            </button>
          </div>

          {/* Font Family */}
          <select
            value={fontFamily}
            onChange={(e) => setFontFamily(e.target.value)}
            className={`px-3 py-1 rounded border text-sm ${
              darkMode
                ? "bg-gray-700 border-gray-600 text-white placeholder-gray-400"
                : "bg-white border-gray-300"
            }`}
          >
            <option value="Inter">Inter</option>
            <option value="Georgia">Georgia</option>
            <option value="Times New Roman">Times</option>
            <option value="Arial">Arial</option>
            <option value="Helvetica">Helvetica</option>
          </select>

          {/* Line Height */}
          <div className="flex items-center space-x-2">
            <span className="text-sm text-gray-500">Line Height:</span>
            <select
              value={lineHeight}
              onChange={(e) => setLineHeight(Number.parseFloat(e.target.value))}
              className={`px-2 py-1 rounded border text-sm ${
                darkMode ? "bg-gray-700 border-gray-600 text-white" : "bg-white border-gray-300"
              }`}
            >
              <option value={1.4}>Tight</option>
              <option value={1.6}>Normal</option>
              <option value={1.8}>Relaxed</option>
              <option value={2.0}>Loose</option>
            </select>
          </div>
        </div>

        {/* Speech Rate */}
        {speechSupported && (
          <div className="flex items-center space-x-2">
            <Volume2 className="w-4 h-4 text-gray-500" />
            <span className="text-sm text-gray-500">Speed:</span>
            <select
              value={speechRate}
              onChange={(e) => setSpeechRate(Number.parseFloat(e.target.value))}
              className={`px-2 py-1 rounded border text-sm ${
                darkMode ? "bg-gray-700 border-gray-600 text-white" : "bg-white border-gray-300"
              }`}
            >
              <option value={0.5}>0.5x</option>
              <option value={0.75}>0.75x</option>
              <option value={1}>1x</option>
              <option value={1.25}>1.25x</option>
              <option value={1.5}>1.5x</option>
              <option value={2}>2x</option>
            </select>
          </div>
        )}
      </div>
    </div>
  )
}
