export default function StepBasicInfo({ formData, errors, handleInputChange, availableDomains }) {
  return (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-4">Basic Information</h3>
            
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Website Name
                    </label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => handleInputChange("name", e.target.value)}
                      className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                        errors.name ? 'border-red-300' : 'border-gray-300'
                      }`}
                      placeholder="My Awesome Website"
                    />
                    {errors.name && (
                      <p className="mt-1 text-sm text-red-600">{errors.name}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Domain
                    </label>
                
                    {/* Domain option selection */}
                    <div className="mb-4">
                      <div className="space-y-3">
                        <label className="flex items-center">
                          <input
                            type="radio"
                            name="domainOption"
                            value="new"
                            checked={formData.domainOption === 'new'}
                            onChange={(e) => handleInputChange("domainOption", e.target.value)}
                            className="mr-2"
                          />
                          <span className="text-sm text-gray-700">Create new subdomain</span>
                        </label>
                    
                        {availableDomains.length > 0 && (
                          <label className="flex items-center">
                            <input
                              type="radio"
                              name="domainOption"
                              value="existing"
                              checked={formData.domainOption === 'existing'}
                              onChange={(e) => handleInputChange("domainOption", e.target.value)}
                              className="mr-2"
                            />
                            <span className="text-sm text-gray-700">Use existing domain</span>
                          </label>
                        )}
                      </div>
                    </div>

                    {/* New subdomain input */}
                    {formData.domainOption === 'new' && (
                      <div className="mb-4">
                        <div className="flex">
                          <input
                            type="text"
                            value={formData.subdomain}
                            onChange={(e) => handleInputChange("subdomain", e.target.value.toLowerCase())}
                            className={`flex-1 min-w-0 px-3 py-2 border rounded-l-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                              errors.subdomain ? 'border-red-300' : 'border-gray-300'
                            }`}
                            placeholder="mywebsite"
                          />
                          <span className="shrink-0 px-2 sm:px-3 py-2 bg-gray-100 border border-l-0 border-gray-300 rounded-r-lg text-sm sm:text-base text-gray-500 whitespace-nowrap">
                            .ufazien.com
                          </span>
                        </div>
                        {errors.subdomain && (
                          <p className="mt-1 text-sm text-red-600">{errors.subdomain}</p>
                        )}
                        <p className="mt-1 text-sm text-gray-500">
                          Your website will be available at {formData.subdomain || 'subdomain'}.ufazien.com
                        </p>
                      </div>
                    )}

                    {/* Existing domain selection */}
                    {formData.domainOption === 'existing' && availableDomains.length > 0 && (
                      <div className="mb-4">
                        <select
                          value={formData.selectedDomainId || ''}
                          onChange={(e) => handleInputChange("selectedDomainId", e.target.value)}
                          className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                            errors.selectedDomainId ? 'border-red-300' : 'border-gray-300'
                          }`}
                        >
                          <option value="">Select an available domain</option>
                          {availableDomains.map((domain) => (
                            <option key={domain.id} value={domain.id}>
                              {domain.name}
                            </option>
                          ))}
                        </select>
                        {errors.selectedDomainId && (
                          <p className="mt-1 text-sm text-red-600">{errors.selectedDomainId}</p>
                        )}
                        <p className="mt-1 text-sm text-gray-500">
                          Reuse an existing domain that is not currently in use
                        </p>
                      </div>
                    )}

                    {/* Show message when no domains are available */}
                    {availableDomains.length === 0 && formData.domainOption === 'existing' && (
                      <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                        <p className="text-sm text-yellow-800">
                          No available domains found. You can create a new subdomain instead.
                        </p>
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Description (Optional)
                    </label>
                    <textarea
                      value={formData.description}
                      onChange={(e) => handleInputChange("description", e.target.value)}
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Brief description of your website..."
                    />
                  </div>
                </div>
              </div>
            </div>
  )
}
