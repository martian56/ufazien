import { Minus, Plus, Type, Volume2 } from "lucide-react"
import Select from "../../components/ui/Select"

interface ReadingSettingsPanelProps {
  darkMode: boolean
  fontSize: number
  setFontSize: (size: number) => void
  fontFamily: string
  setFontFamily: (family: string) => void
  lineHeight: number
  setLineHeight: (height: number) => void
  speechRate: number
  setSpeechRate: (rate: number) => void
  isPlaying: boolean
  speechSupported: boolean
}


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
}: ReadingSettingsPanelProps) {
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
          <Select
        value={fontFamily}
        onChange={(value) => setFontFamily(value)}
        options={[
          { value: "Inter", label: "Inter" },
          { value: "Georgia", label: "Georgia" },
          { value: "Times New Roman", label: "Times" },
          { value: "Arial", label: "Arial" },
          { value: "Helvetica", label: "Helvetica" },
        ]}
      />

          {/* Line Height */}
          <div className="flex items-center space-x-2">
            <span className="text-sm text-gray-500">Line Height:</span>
            <Select
              value={String(lineHeight)}
              onChange={(value) => setLineHeight(Number.parseFloat(value))}
              className="w-32"
              aria-label="Line height"
              options={[
                { value: "1.4", label: "Tight" },
                { value: "1.6", label: "Normal" },
                { value: "1.8", label: "Relaxed" },
                { value: "2", label: "Loose" },
              ]}
            />
          </div>
        </div>

        {/* Speech Rate */}
        {speechSupported && (
          <div className="flex items-center space-x-2">
            <Volume2 className="w-4 h-4 text-gray-500" />
            <span className="text-sm text-gray-500">Speed:</span>
            <Select
              value={String(speechRate)}
              onChange={(value) => setSpeechRate(Number.parseFloat(value))}
              className="w-28"
              aria-label="Speech rate"
              options={[
                { value: "0.5", label: "0.5x" },
                { value: "0.75", label: "0.75x" },
                { value: "1", label: "1x" },
                { value: "1.25", label: "1.25x" },
                { value: "1.5", label: "1.5x" },
                { value: "2", label: "2x" },
              ]}
            />
          </div>
        )}
      </div>
    </div>
  )
}
