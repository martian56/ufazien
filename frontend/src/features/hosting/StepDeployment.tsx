import type React from "react"

import type { WizardErrors, WizardFormData } from "./wizardTypes"

interface StepDeploymentProps {
  formData: WizardFormData
  errors: WizardErrors
  handleInputChange: (field: string, value: unknown) => void
  handleFileUpload: (event: React.ChangeEvent<HTMLInputElement>) => void
  removeFile: (index: number) => void
}

import { FileText, Server, Upload } from "lucide-react"

export default function StepDeployment({
  formData,
  errors,
  handleInputChange,
  handleFileUpload,
  removeFile,
}: StepDeploymentProps) {
  return (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-4">Deployment Method</h3>
            
                <div className="space-y-4">
                  {/* Deployment Method Selection */}
                  <div className="space-y-3">
                    <div
                      onClick={() => handleInputChange("deploymentMethod", "upload")}
                      className={`p-4 border rounded-lg cursor-pointer ${
                        formData.deploymentMethod === "upload"
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="flex items-center space-x-3">
                        <Upload className="h-5 w-5 text-blue-600" />
                        <div>
                          <div className="font-medium">Upload Files</div>
                          <div className="text-sm text-gray-600">Upload individual files</div>
                        </div>
                      </div>
                    </div>

                    <div
                      onClick={() => handleInputChange("deploymentMethod", "zip")}
                      className={`p-4 border rounded-lg cursor-pointer ${
                        formData.deploymentMethod === "zip"
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="flex items-center space-x-3">
                        <FileText className="h-5 w-5 text-green-600" />
                        <div>
                          <div className="font-medium">Upload ZIP Archive</div>
                          <div className="text-sm text-gray-600">Upload a ZIP file containing your website</div>
                        </div>
                      </div>
                    </div>

                    <div
                      onClick={() => handleInputChange("deploymentMethod", "git")}
                      className={`p-4 border rounded-lg cursor-pointer ${
                        formData.deploymentMethod === "git"
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="flex items-center space-x-3">
                        <Server className="h-5 w-5 text-purple-600" />
                        <div>
                          <div className="font-medium">Git Repository</div>
                          <div className="text-sm text-gray-600">Deploy from GitHub, GitLab, or Bitbucket</div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* File Upload */}
                  {formData.deploymentMethod === "upload" && (
                    <div className="mt-4">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Upload Files
                      </label>
                  
                      <div className="space-y-3">
                        {/* Individual Files Upload */}
                        <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                          <Upload className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                          <div className="text-sm text-gray-600 mb-2">
                            Upload individual files
                          </div>
                          <label className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 cursor-pointer">
                            <span>Browse Files</span>
                            <input
                              type="file"
                              multiple
                              onChange={handleFileUpload}
                              className="sr-only"
                            />
                          </label>
                        </div>
                    
                        {/* Folder Upload */}
                        <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                          <Upload className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                          <div className="text-sm text-gray-600 mb-2">
                            Upload entire folder
                          </div>
                          <label className="inline-flex items-center px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 cursor-pointer">
                            <span>Browse Folder</span>
                            <input
                              type="file"
                              {...{ webkitdirectory: "", directory: "" }}
                              
                              multiple
                              onChange={handleFileUpload}
                              className="sr-only"
                            />
                          </label>
                        </div>
                      </div>
                  
                      {(formData.files ?? []).length > 0 && (
                        <div className="mt-4">
                          <h4 className="text-sm font-medium text-gray-700 mb-2">Uploaded Files:</h4>
                          <div className="space-y-2 max-h-48 overflow-y-auto">
                            {(formData.files ?? []).map((file, index) => (
                              <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                                <span className="text-sm">{file.webkitRelativePath || file.name}</span>
                                <button
                                  onClick={() => removeFile(index)}
                                  className="text-red-600 hover:text-red-800"
                                >
                                  Remove
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                  
                      {errors.files && (
                        <p className="mt-2 text-sm text-red-600">{errors.files}</p>
                      )}
                    </div>
                  )}

                  {/* ZIP Upload */}
                  {formData.deploymentMethod === "zip" && (
                    <div className="mt-4">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Upload ZIP File
                      </label>
                      <input
                        type="file"
                        accept=".zip"
                        onChange={(e) => handleInputChange("zipFile", e.target.files?.[0])}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                      />
                      {errors.zipFile && (
                        <p className="mt-1 text-sm text-red-600">{errors.zipFile}</p>
                      )}
                    </div>
                  )}

                  {/* Git Repository */}
                  {formData.deploymentMethod === "git" && (
                    <div className="mt-4 space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Repository URL
                        </label>
                        <input
                          type="url"
                          value={formData.git_repository}
                          onChange={(e) => handleInputChange("git_repository", e.target.value)}
                          className={`w-full px-3 py-2 border rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 ${
                            errors.git_repository ? 'border-red-300' : 'border-gray-300'
                          }`}
                          placeholder="https://github.com/username/repository.git"
                        />
                        {errors.git_repository && (
                          <p className="mt-1 text-sm text-red-600">{errors.git_repository}</p>
                        )}
                        <p className="mt-1 text-sm text-gray-500">
                          Repository must be public or you'll need to provide access credentials
                        </p>
                      </div>
                  
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Branch
                        </label>
                        <input
                          type="text"
                          value={formData.deployment_branch}
                          onChange={(e) => handleInputChange("deployment_branch", e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                          placeholder="main"
                        />
                        <p className="mt-1 text-sm text-gray-500">
                          Branch to deploy from (default: main)
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
  )
}
