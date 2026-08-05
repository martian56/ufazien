import { Code, Globe } from "lucide-react"

export default function StepWebsiteType({ formData, errors, handleInputChange }) {
  return (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-4">Website Type</h3>
            
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div
                    onClick={() => handleInputChange("website_type", "static")}
                    className={`p-4 border-2 rounded-lg cursor-pointer transition-colors ${
                      formData.website_type === "static" 
                        ? 'border-blue-500 bg-blue-50' 
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-center space-x-3">
                      <Globe className="h-8 w-8 text-blue-600" />
                      <div>
                        <h4 className="font-medium text-gray-900">Static Website</h4>
                        <p className="text-sm text-gray-600">HTML, CSS, JavaScript files</p>
                      </div>
                    </div>
                    <div className="mt-3 text-sm text-gray-600">
                      Perfect for portfolios, landing pages, and documentation sites.
                    </div>
                  </div>

                  <div
                    onClick={() => handleInputChange("website_type", "php")}
                    className={`p-4 border-2 rounded-lg cursor-pointer transition-colors ${
                      formData.website_type === "php" 
                        ? 'border-blue-500 bg-blue-50' 
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-center space-x-3">
                      <Code className="h-8 w-8 text-purple-600" />
                      <div>
                        <h4 className="font-medium text-gray-900">PHP Application</h4>
                        <p className="text-sm text-gray-600">Dynamic PHP website</p>
                      </div>
                    </div>
                    <div className="mt-3 text-sm text-gray-600">
                      For dynamic websites, CMSs like WordPress, and web applications.
                    </div>
                  </div>
                </div>

                {errors.website_type && (
                  <p className="mt-2 text-sm text-red-600">{errors.website_type}</p>
                )}
              </div>
            </div>
  )
}
