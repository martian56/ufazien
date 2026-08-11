import { Palette } from "lucide-react"
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

interface ChoiceProps {
  id: string
  label: string
  value: string
  options: readonly { value: string; label: string }[]
  onChange: (value: string) => void
}

function Choice({ id, label, value, options, onChange }: ChoiceProps) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id} className="text-sm font-semibold text-gray-700">{label}</Label>
      <Select id={id} value={value} onChange={onChange} options={options} />
    </div>
  )
}

import type { AppearanceSettings } from "./settingsMapping"
import Select from "../../components/ui/Select"

interface AppearanceTabProps {
  settings: AppearanceSettings
  onChange: (field: keyof AppearanceSettings, value: string) => void
}

export default function AppearanceTab({ settings, onChange }: AppearanceTabProps) {
  return (
    <div className="p-8">
      <div className="flex items-center gap-4 mb-8">
        <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
          <Palette className="w-5 h-5 text-gray-700" aria-hidden="true" />
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
