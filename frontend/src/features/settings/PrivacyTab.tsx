import { Checkbox } from "../../components/ui/checkbox"
import { Label } from "../../components/ui/label"

/**
 * Privacy settings.
 *
 * This tab used to render "🚧 This section is under development", while the
 * state behind it already existed and was written to localStorage on save.
 * Profile visibility is enforced server-side in can_view_profile; the rest is
 * stored per user rather than per browser.
 */

const VISIBILITY = [
  { value: 'everyone', label: 'Everyone', hint: 'Any signed-in student can see your profile.' },
  { value: 'followers', label: 'People who follow me', hint: 'Others see only your name and picture.' },
  { value: 'nobody', label: 'Nobody', hint: 'Others see only your name and picture.' },
]

interface ToggleProps {
  label: string
  description: string
  checked: boolean
  onChange: (checked: boolean) => void
}

function Toggle({ label, description, checked, onChange }: ToggleProps) {
  return (
    <div className="flex items-center justify-between p-4 bg-white rounded-xl border border-gray-200">
      <div>
        <Label className="font-semibold text-gray-900">{label}</Label>
        <p className="text-sm text-gray-500">{description}</p>
      </div>
      <Checkbox
        checked={checked}
        onCheckedChange={onChange}
        className="data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"
      />
    </div>
  )
}

import type { PrivacySettings } from "./settingsMapping"
import type { ProfileVisibility } from "../../lib/api/endpoints/settings"

interface PrivacyTabProps {
  settings: PrivacySettings
  onChange: (field: keyof PrivacySettings, value: PrivacySettings[keyof PrivacySettings]) => void
}

export default function PrivacyTab({ settings, onChange }: PrivacyTabProps) {
  const selected = VISIBILITY.find((option) => option.value === settings.profileVisibility)

  return (
    <div className="p-8">
      <div className="flex items-center gap-4 mb-8">
        <div className="w-12 h-12 bg-gradient-to-r from-purple-500 to-pink-600 rounded-xl flex items-center justify-center">
          <span className="text-white text-xl">🔒</span>
        </div>
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Privacy Settings</h2>
          <p className="text-gray-600">Choose what other students can see</p>
        </div>
      </div>

      <div className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="profileVisibility" className="text-sm font-semibold text-gray-700">
            Who can see your profile
          </Label>
          <select
            id="profileVisibility"
            value={settings.profileVisibility}
            onChange={(e) => onChange("profileVisibility", e.target.value as ProfileVisibility)}
            className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            {VISIBILITY.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
          {selected && <p className="text-sm text-gray-500">{selected.hint}</p>}
        </div>

        <div className="space-y-4">
          <Toggle
            label="Show my schedule"
            description="Let others see the classes on your timetable"
            checked={settings.showSchedule}
            onChange={(checked) => onChange("showSchedule", checked)}
          />
          <Toggle
            label="Allow direct messages"
            description="Let other students start a chat with you"
            checked={settings.allowMessages}
            onChange={(checked) => onChange("allowMessages", checked)}
          />
          <Toggle
            label="Show when I am online"
            description="Display your online status in the community"
            checked={settings.showOnlineStatus}
            onChange={(checked) => onChange("showOnlineStatus", checked)}
          />
        </div>

        <p className="text-sm text-gray-500">
          Your email address is never shown to anyone else, whatever these are set to.
        </p>
      </div>
    </div>
  )
}
