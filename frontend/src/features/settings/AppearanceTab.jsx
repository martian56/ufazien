import { Label } from "../../components/ui/label"

/**
 * Appearance and formatting preferences.
 *
 * Another tab that rendered "🚧 This section is under development" over state
 * that already existed. Only settings the app can honour are here: there is no
 * offline-mode switch, because there is no offline mode.
 */

const THEMES = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'system', label: 'Match my device' },
]

const LANGUAGES = [
  { value: 'en', label: 'English' },
  { value: 'az', label: 'Azərbaycan dili' },
  { value: 'fr', label: 'Français' },
]

const DATE_FORMATS = [
  { value: 'DD/MM/YYYY', label: '31/12/2026' },
  { value: 'MM/DD/YYYY', label: '12/31/2026' },
  { value: 'YYYY-MM-DD', label: '2026-12-31' },
]

const TIME_FORMATS = [
  { value: '24h', label: '18:30' },
  { value: '12h', label: '6:30 PM' },
]

function Choice({ id, label, value, options, onChange }) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id} className="text-sm font-semibold text-gray-700">{label}</Label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
    </div>
  )
}

export default function AppearanceTab({ settings, onChange }) {
  return (
    <div className="p-8">
      <div className="flex items-center gap-4 mb-8">
        <div className="w-12 h-12 bg-gradient-to-r from-pink-500 to-rose-600 rounded-xl flex items-center justify-center">
          <span className="text-white text-xl">🎨</span>
        </div>
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Appearance</h2>
          <p className="text-gray-600">How Ufazien looks and formats things for you</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Choice
          id="theme"
          label="Theme"
          value={settings.theme}
          options={THEMES}
          onChange={(value) => onChange("theme", value)}
        />
        <Choice
          id="language"
          label="Language"
          value={settings.language}
          options={LANGUAGES}
          onChange={(value) => onChange("language", value)}
        />
        <Choice
          id="dateFormat"
          label="Date format"
          value={settings.dateFormat}
          options={DATE_FORMATS}
          onChange={(value) => onChange("dateFormat", value)}
        />
        <Choice
          id="timeFormat"
          label="Time format"
          value={settings.timeFormat}
          options={TIME_FORMATS}
          onChange={(value) => onChange("timeFormat", value)}
        />
      </div>
    </div>
  )
}
