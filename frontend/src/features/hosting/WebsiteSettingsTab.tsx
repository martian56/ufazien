import { Edit, Terminal, Trash2 } from "lucide-react"
import { getSSLStatus, getWebsiteUrl } from "./websiteFormat"

import type { Website } from "../../utils/hostingApi"

interface EnvVar {
  id: string
  key: string
  value: string
}

interface WebsiteSettingsTabProps {
  website: Website
  editingSettings: boolean
  onEditSettings: () => void
  settingsForm: { name: string; description: string }
  onSettingsChange: (field: "name" | "description", value: string) => void
  onSaveSettings: () => void
  onCancelSettings: () => void
  envVars: EnvVar[]
  editingEnvVars: boolean
  onEditEnvVars: () => void
  onEnvVarChange: (id: string, field: "key" | "value", value: string) => void
  onAddEnvVar: () => void
  onRemoveEnvVar: (id: string) => void
  onSaveEnvVars: () => void
  onCancelEnvVars: () => void
  onDeleteWebsite: () => void
}


/** General settings, environment variables, SSL and the danger zone. */
export default function WebsiteSettingsTab({
  website,
  editingSettings,
  onEditSettings,
  settingsForm,
  onSettingsChange,
  onSaveSettings,
  onCancelSettings,
  envVars,
  editingEnvVars,
  onEditEnvVars,
  onEnvVarChange,
  onAddEnvVar,
  onRemoveEnvVar,
  onSaveEnvVars,
  onCancelEnvVars,
  onDeleteWebsite,
}: WebsiteSettingsTabProps) {
  const inputClass = (editing: boolean) =>
    `w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
      editing ? '' : 'bg-gray-50 cursor-not-allowed'
    }`

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">General Settings</h3>
          {!editingSettings ? (
            <button
              onClick={onEditSettings}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              <Edit className="w-4 h-4 mr-2 inline" />
              Edit
            </button>
          ) : (
            <div className="flex space-x-2">
              <button
                onClick={onSaveSettings}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
              >
                Save
              </button>
              <button
                onClick={onCancelSettings}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
            </div>
          )}
        </div>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Website Name</label>
            <input
              type="text"
              value={settingsForm.name}
              onChange={(e) => onSettingsChange('name', e.target.value)}
              disabled={!editingSettings}
              className={inputClass(editingSettings)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
            <textarea
              value={settingsForm.description}
              onChange={(e) => onSettingsChange('description', e.target.value)}
              disabled={!editingSettings}
              rows={3}
              className={inputClass(editingSettings)}
              placeholder="Optional description of your website"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Domain</label>
            <input
              type="text"
              value={getWebsiteUrl(website)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50"
              readOnly
            />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Environment Variables</h3>
          {!editingEnvVars ? (
            <button
              onClick={onEditEnvVars}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              <Edit className="w-4 h-4 mr-2 inline" />
              Edit
            </button>
          ) : (
            <div className="flex space-x-2">
              <button
                onClick={onSaveEnvVars}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
              >
                Save
              </button>
              <button
                onClick={onCancelEnvVars}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
            </div>
          )}
        </div>

        <div className="space-y-3">
          {envVars.length === 0 ? (
            <div className="text-center py-8">
              <Terminal className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600 font-medium">No environment variables</p>
              <p className="text-sm text-gray-500">Add environment variables for your application</p>
            </div>
          ) : (
            envVars.map((envVar) => (
              <div key={envVar.id} className="flex items-center space-x-3">
                <input
                  type="text"
                  value={envVar.key}
                  onChange={(e) => onEnvVarChange(envVar.id, 'key', e.target.value)}
                  disabled={!editingEnvVars}
                  placeholder="Variable name"
                  className={`flex-1 ${inputClass(editingEnvVars)}`}
                />
                <span className="text-gray-400">=</span>
                <input
                  type="text"
                  value={envVar.value}
                  onChange={(e) => onEnvVarChange(envVar.id, 'value', e.target.value)}
                  disabled={!editingEnvVars}
                  placeholder="Variable value"
                  className={`flex-1 ${inputClass(editingEnvVars)}`}
                />
                {editingEnvVars && (
                  <button
                    onClick={() => onRemoveEnvVar(envVar.id)}
                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    aria-label={`Remove ${envVar.key || 'variable'}`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))
          )}

          {editingEnvVars && (
            <button
              onClick={onAddEnvVar}
              className="w-full py-2 border-2 border-dashed border-gray-300 rounded-lg text-gray-600 hover:border-blue-400 hover:text-blue-600 transition-colors font-medium"
            >
              + Add Environment Variable
            </button>
          )}
        </div>

        <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
          <p className="text-sm text-yellow-800">
            <strong>Note:</strong> Environment variables are available during build and runtime.
            Changes will take effect on the next deployment.
          </p>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">SSL Certificate</h3>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-700">SSL encryption protects your website and visitors</p>
            <p className="text-xs text-gray-500 mt-1">
              Status: {getSSLStatus(website) ? 'Active' : 'Inactive'}
            </p>
          </div>
          <button className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors">
            {getSSLStatus(website) ? 'Renew SSL' : 'Enable SSL'}
          </button>
        </div>
      </div>

      <div className="bg-red-50 border border-red-200 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-red-900 mb-4">Danger Zone</h3>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-red-900">Delete Website</p>
              <p className="text-xs text-red-700">This action cannot be undone</p>
            </div>
            <button
              onClick={onDeleteWebsite}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
            >
              Delete
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
