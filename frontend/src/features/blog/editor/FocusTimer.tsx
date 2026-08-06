import { Clock, Pause, Play, RotateCcw, Volume2, VolumeX } from "lucide-react"

interface FocusTimerProps {
  darkMode: boolean
  currentTimer: number
  isBreak: boolean
  active: boolean
  onToggle: () => void
  onReset: () => void
  soundEnabled: boolean
  onToggleSound: () => void
}


const formatTime = (seconds: number) => {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

/** Pomodoro timer beside the editor. The countdown itself lives in the page. */
export default function FocusTimer({
  darkMode,
  currentTimer,
  isBreak,
  active,
  onToggle,
  onReset,
  soundEnabled,
  onToggleSound,
}: FocusTimerProps) {
  return (
    <div className={`rounded-xl shadow-sm border p-6 ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold flex items-center">
          <Clock className="w-4 h-4 mr-2" />
          Focus Timer
        </h3>
        <button
          onClick={onToggleSound}
          className={`p-1 rounded ${darkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-100'}`}
          aria-label={soundEnabled ? 'Mute the timer' : 'Unmute the timer'}
        >
          {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
        </button>
      </div>

      <div className="text-center">
        <div className={`text-3xl font-mono font-bold mb-4 ${isBreak ? 'text-green-500' : 'text-blue-500'}`}>
          {formatTime(currentTimer)}
        </div>
        <div className="text-sm text-gray-500 mb-4">{isBreak ? 'Break Time' : 'Focus Time'}</div>

        <div className="flex justify-center space-x-2">
          <button
            onClick={onToggle}
            className={`flex items-center space-x-2 px-2.5 sm:px-4 py-2 rounded-lg transition-colors ${
              active ? 'bg-red-500 hover:bg-red-600 text-white' : 'bg-blue-500 hover:bg-blue-600 text-white'
            }`}
          >
            {active ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            <span>{active ? 'Pause' : 'Start'}</span>
          </button>

          <button
            onClick={onReset}
            className={`p-2 rounded-lg transition-colors ${
              darkMode ? 'bg-gray-700 hover:bg-gray-600' : 'bg-gray-200 hover:bg-gray-300'
            }`}
            aria-label="Reset the timer"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
