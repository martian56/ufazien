import type React from "react"

import type { WizardErrors, WizardFormData } from "./wizardTypes"

interface StepConfigurationProps {
  formData: WizardFormData
  errors: WizardErrors
  handleInputChange: (field: string, value: unknown) => void
  handleEnvironmentVariableAdd: () => void
  handleEnvironmentVariableChange: (index: number, field: "key" | "value", value: string) => void
  handleEnvironmentVariableRemove: (index: number) => void
}

export default function StepConfiguration({
  formData,
  errors,
  handleInputChange,
  handleEnvironmentVariableAdd,
  handleEnvironmentVariableChange,
  handleEnvironmentVariableRemove,
}: StepConfigurationProps) {
  return (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-4">Configuration</h3>
            
                <div className="space-y-6">
                  {/* PHP Version (only for PHP websites) */}
                  {formData.website_type === "php" && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        PHP Version
                      </label>
                      <select
                        value={formData.phpVersion}
                        onChange={(e) => handleInputChange("phpVersion", e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      >
                        <option value="8.2">PHP 8.2 (Recommended)</option>
                        <option value="8.1">PHP 8.1</option>
                        <option value="8.0">PHP 8.0</option>
                        <option value="7.4">PHP 7.4</option>
                      </select>
                    </div>
                  )}

                  {/* Environment Variables */}
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <label className="block text-sm font-medium text-gray-700">
                        Environment Variables
                      </label>
                      <button
                        type="button"
                        onClick={handleEnvironmentVariableAdd}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-sm transition-colors"
                      >
                        Add Variable
                      </button>
                    </div>

                    {(formData.environment_variables ?? []).length === 0 ? (
                      <div className="text-center py-6 border-2 border-dashed border-gray-300 rounded-lg">
                        <p className="text-gray-500 text-sm">No environment variables added yet</p>
                        <p className="text-gray-400 text-xs mt-1">Click "Add Variable" to add configuration for your website</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {(formData.environment_variables ?? []).map((envVar, index) => (
                          <div key={index} className="flex items-center space-x-2">
                            <input
                              type="text"
                              placeholder="Variable name (e.g., API_URL)"
                              value={envVar.key}
                              onChange={(e) => handleEnvironmentVariableChange(index, 'key', e.target.value)}
                              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                            <input
                              type="text"
                              placeholder="Value (e.g., https://api.example.com)"
                              value={envVar.value}
                              onChange={(e) => handleEnvironmentVariableChange(index, 'value', e.target.value)}
                              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                            <button
                              type="button"
                              onClick={() => handleEnvironmentVariableRemove(index)}
                              className="text-red-600 hover:text-red-800 p-2 transition-colors"
                              title="Remove variable"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    <p className="mt-3 text-xs text-gray-500">
                      Environment variables will be available to your application at runtime. Common examples: API keys, database URLs, configuration flags.
                    </p>
                  </div>

                  {/* SSL Certificate */}
                  <div>
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="enable-ssl"
                        checked={formData.ssl}
                        onChange={(e) => handleInputChange("ssl", e.target.checked)}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      />
                      <label htmlFor="enable-ssl" className="text-sm font-medium text-gray-700">
                        Enable SSL Certificate (HTTPS)
                      </label>
                    </div>
                    <p className="mt-1 text-sm text-gray-500">
                      Automatically provision a free SSL certificate for your website
                    </p>
                  </div>
                </div>
              </div>
            </div>
  )
}
