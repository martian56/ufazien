import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { Helmet } from "react-helmet"
import {
  ArrowLeft,
  Globe,
  Code,
  Database,
  Upload,
  FileText,
  CheckCircle,
  AlertCircle,
  Info,
  Server,
  Settings,
  RefreshCw
} from "lucide-react"
import HostingSidebar from "../../components/hosting/HostingSidebar"
import { hostingApi } from "../../utils/hostingApi.js"
import { useSubscription } from "../../hooks/useSubscription.jsx"
import { useWebsites } from "../../hooks/useWebsites.js"
import { useDomains } from "../../hooks/useDomains.js"

export default function CreateWebsite() {
  const navigate = useNavigate()
  const { subscription, canCreateWebsite } = useSubscription()
  const { createWebsite } = useWebsites()
  const { availableDomains, createDomain, checkDomainAvailability, refreshDomains } = useDomains()
  const [currentStep, setCurrentStep] = useState(1)
  const [formData, setFormData] = useState({
    // Step 1: Basic Info
    name: "",
    subdomain: "",
    description: "",
    domainOption: "new", // "new" or "existing"
    selectedDomainId: null,
    
    // Step 2: Website Type
    website_type: "", // "static" or "php"
    
    // Step 3: Configuration
    phpVersion: "8.2",
    environment_variables: [],
    ssl: true,
    
    // Step 4: Files
    deploymentMethod: "upload", // "upload", "git", "zip"
    files: [],
    git_repository: "",
    deployment_branch: "main",
    zipFile: null
  })

  const [errors, setErrors] = useState({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState("")

  const steps = [
    { id: 1, title: "Basic Information", description: "Website name and subdomain" },
    { id: 2, title: "Website Type", description: "Choose static site or PHP application" },
        { id: 3, title: "Configuration", description: "Environment variables and SSL settings" },
    { id: 4, title: "Deployment", description: "Upload files or connect repository" }
  ]

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }))
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({
        ...prev,
        [field]: null
      }))
    }
  }

  const handleEnvironmentVariableAdd = () => {
    setFormData(prev => ({
      ...prev,
      environment_variables: [...prev.environment_variables, { key: "", value: "" }]
    }))
  }

  const handleEnvironmentVariableChange = (index, field, value) => {
    setFormData(prev => ({
      ...prev,
      environment_variables: prev.environment_variables.map((envVar, i) => 
        i === index ? { ...envVar, [field]: value } : envVar
      )
    }))
  }

  const handleEnvironmentVariableRemove = (index) => {
    setFormData(prev => ({
      ...prev,
      environment_variables: prev.environment_variables.filter((_, i) => i !== index)
    }))
  }

  const validateStep = (step) => {
    const newErrors = {}
    
    switch (step) {
      case 1:
        if (!formData.name.trim()) newErrors.name = "Website name is required"
        
        // Domain validation based on selected option
        if (formData.domainOption === 'new') {
          if (!formData.subdomain.trim()) newErrors.subdomain = "Subdomain is required"
          else if (!/^[a-z0-9-]+$/.test(formData.subdomain)) {
            newErrors.subdomain = "Subdomain can only contain lowercase letters, numbers, and hyphens"
          }
        } else if (formData.domainOption === 'existing') {
          if (!formData.selectedDomainId) {
            newErrors.selectedDomainId = "Please select an available domain"
          }
        }
        break
      case 2:
        if (!formData.website_type) newErrors.website_type = "Please select a website type"
        break
      case 3:
        // No specific validation needed for configuration step
        break
      case 4:
        if (formData.deploymentMethod === "upload" && formData.files.length === 0) {
          newErrors.files = "Please upload at least one file"
        }
        if (formData.deploymentMethod === "git" && !formData.git_repository.trim()) {
          newErrors.git_repository = "Git repository URL is required"
        }
        if (formData.deploymentMethod === "zip" && !formData.zipFile) {
          newErrors.zipFile = "Please select a ZIP file"
        }
        break
    }
    
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleNext = () => {
    if (validateStep(currentStep)) {
      setCurrentStep(prev => Math.min(prev + 1, 4))
    }
  }

  const handlePrevious = () => {
    setCurrentStep(prev => Math.max(prev - 1, 1))
  }

  const handleSubmit = async () => {
    if (!validateStep(4)) return
    
    // Check subscription limits
    if (!canCreateWebsite()) {
      setSubmitError("You have reached your website limit. Please upgrade your subscription to create more websites.")
      return
    }
    
    setIsSubmitting(true)
    setSubmitError("")
    
    try {
      // Prepare website data for API
      const websiteData = {
        name: formData.name,
        description: formData.description,
        website_type: formData.website_type,
      }

      // Add git repository if specified
      if (formData.deploymentMethod === "git" && formData.git_repository) {
        websiteData.git_repository = formData.git_repository
        websiteData.deployment_branch = formData.deployment_branch || "main"
      }

      // Add environment variables if any
      if (formData.environment_variables.length > 0) {
        // Convert to object format expected by backend
        const envVars = {}
        formData.environment_variables.forEach(envVar => {
          if (envVar.key.trim() && envVar.value.trim()) {
            envVars[envVar.key.trim()] = envVar.value.trim()
          }
        })
        if (Object.keys(envVars).length > 0) {
          websiteData.environment_variables = envVars
        }
      }

      // Handle domain creation or selection
      let domain;
      if (formData.domainOption === "existing" && formData.selectedDomainId) {
        // Use existing domain - pass domain_id to the API
        websiteData.domain_id = formData.selectedDomainId;
      } else if (formData.domainOption === "new" && formData.subdomain) {
        // Create new subdomain
        const domainData = {
          name: `${formData.subdomain}.ufazien.com`,
          domain_type: "subdomain"
        }

        // Create domain first
        domain = await createDomain(domainData)
        websiteData.domain_id = domain.id;
      }
      // Note: If no domain is selected/created, domain_id will be undefined and handled as null by the backend

      // Create website using the hook
      const website = await createWebsite(websiteData)
      
      // Handle file uploads if deployment method is upload or zip
      if (formData.deploymentMethod === "upload" && formData.files.length > 0) {
        const uploadFormData = new FormData();
        formData.files.forEach((file, index) => {
          uploadFormData.append(`files`, file);
        });
        uploadFormData.append('website_id', website.id);
        
        // Send to your backend endpoint
        await hostingApi.uploadFiles(website.id, uploadFormData);
      }
      
      if (formData.deploymentMethod === "zip" && formData.zipFile) {
        const zipFormData = new FormData();
        zipFormData.append('zip_file', formData.zipFile);
        zipFormData.append('website_id', website.id);
        
        await hostingApi.uploadZip(website.id, zipFormData);
      }

      // Navigate to website detail or websites list
      navigate(`/hosting/website/${website.id}`)
    } catch (error) {
      console.error("Error creating website:", error)
      if (error.response?.data) {
        // Handle API validation errors
        const apiErrors = error.response.data
        if (typeof apiErrors === 'object') {
          const errorMessages = Object.entries(apiErrors)
            .map(([field, messages]) => `${field}: ${Array.isArray(messages) ? messages.join(', ') : messages}`)
            .join('\n')
          setSubmitError(errorMessages)
        } else {
          setSubmitError(apiErrors.message || "Failed to create website")
        }
      } else {
        setSubmitError(error.message || "An unexpected error occurred. Please try again.")
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleFileUpload = (event) => {
    const files = Array.from(event.target.files)
    
    // Preserve folder structure using webkitRelativePath if available
    const filesWithPaths = files.map(file => {
      // If webkitRelativePath exists, use it; otherwise use just the name
      const relativePath = file.webkitRelativePath || file.name
      return Object.assign(file, { relativePath })
    })
    
    setFormData(prev => ({
      ...prev,
      files: [...prev.files, ...filesWithPaths]
    }))
  }

  const removeFile = (index) => {
    setFormData(prev => ({
      ...prev,
      files: prev.files.filter((_, i) => i !== index)
    }))
  }

  return (
    <>
      <Helmet>
        <title>Create New Website | Ufazien Hosting</title>
        <meta name="description" content="Create a new website on Ufazien hosting platform" />
      </Helmet>
      <div className="min-h-screen bg-gray-50">
        <HostingSidebar />
        
        <div className="lg:ml-64">
          <div className="p-4 lg:p-6 pt-16 lg:pt-6">{/* Added top padding for mobile menu button */}
            {/* Header */}
            <div className="mb-8">
              <button
                onClick={() => navigate("/hosting/websites")}
                className="inline-flex items-center text-gray-600 hover:text-gray-900 mb-4"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Websites
              </button>
              <h1 className="text-3xl font-bold text-gray-900">Create New Website</h1>
              <p className="mt-2 text-gray-600">Deploy your website to Ufazien hosting platform</p>
            </div>

            {/* Progress Steps.
                Three labelled columns need about 795px, so on a phone this
                forced the whole page 400px wider than the screen. The labels
                drop out below sm and only the current step is named, under the
                dots. */}
            <div className="mb-8">
              <div className="flex items-center">
                {steps.map((step, index) => (
                  <div key={step.id} className="flex items-center min-w-0 last:shrink-0 sm:flex-none">
                    <div className={`flex items-center justify-center w-8 h-8 shrink-0 rounded-full border-2 ${
                      currentStep >= step.id
                        ? 'bg-blue-600 border-blue-600 text-white'
                        : 'border-gray-300 text-gray-400'
                    }`}>
                      {currentStep > step.id ? (
                        <CheckCircle className="h-5 w-5" />
                      ) : (
                        <span className="text-sm font-medium">{step.id}</span>
                      )}
                    </div>
                    <div className="ml-3 hidden sm:block min-w-0">
                      <div className={`text-sm font-medium truncate ${
                        currentStep >= step.id ? 'text-blue-600' : 'text-gray-500'
                      }`}>
                        {step.title}
                      </div>
                      <div className="text-xs text-gray-500">{step.description}</div>
                    </div>
                    {index < steps.length - 1 && (
                      <div className={`mx-3 sm:mx-6 h-0.5 flex-1 sm:w-12 sm:flex-none ${
                        currentStep > step.id ? 'bg-blue-600' : 'bg-gray-300'
                      }`} />
                    )}
                  </div>
                ))}
              </div>

              <div className="mt-3 sm:hidden">
                <div className="text-sm font-medium text-blue-600">
                  {steps.find((s) => s.id === currentStep)?.title}
                </div>
                <div className="text-xs text-gray-500">
                  {steps.find((s) => s.id === currentStep)?.description}
                </div>
              </div>
            </div>

            {/* Form Content */}
            <div className="max-w-2xl mx-auto">
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                
                {/* Error Display */}
                {submitError && (
                  <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
                    <div className="flex items-start">
                      <AlertCircle className="h-5 w-5 text-red-600 mt-0.5 mr-2" />
                      <div>
                        <h3 className="text-sm font-medium text-red-800">Error creating website</h3>
                        <div className="mt-1 text-sm text-red-700 whitespace-pre-line">{submitError}</div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Subscription Limit Warning */}
                {!canCreateWebsite() && (
                  <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-lg">
                    <div className="flex items-start">
                      <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5 mr-2" />
                      <div>
                        <h3 className="text-sm font-medium text-amber-800">Website Limit Reached</h3>
                        <div className="mt-1 text-sm text-amber-700">
                          You have reached your website limit on the {subscription?.plan?.display_name || 'Free'} plan. 
                          Please upgrade your subscription to create more websites.
                        </div>
                        <button
                          onClick={() => navigate('/hosting/upgrade')}
                          className="mt-2 text-sm text-amber-800 underline hover:text-amber-900"
                        >
                          Upgrade Plan
                        </button>
                      </div>
                    </div>
                  </div>
                )}
                
                {/* Step 1: Basic Information */}
                {currentStep === 1 && (
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
                )}

                {/* Step 2: Website Type */}
                {currentStep === 2 && (
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
                )}

                {/* Step 3: Configuration */}
                {currentStep === 3 && (
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

                          {formData.environment_variables.length === 0 ? (
                            <div className="text-center py-6 border-2 border-dashed border-gray-300 rounded-lg">
                              <p className="text-gray-500 text-sm">No environment variables added yet</p>
                              <p className="text-gray-400 text-xs mt-1">Click "Add Variable" to add configuration for your website</p>
                            </div>
                          ) : (
                            <div className="space-y-3">
                              {formData.environment_variables.map((envVar, index) => (
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
                )}

                {/* Step 4: Deployment */}
                {currentStep === 4 && (
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
                                    webkitdirectory=""
                                    directory=""
                                    multiple
                                    onChange={handleFileUpload}
                                    className="sr-only"
                                  />
                                </label>
                              </div>
                            </div>
                            
                            {formData.files.length > 0 && (
                              <div className="mt-4">
                                <h4 className="text-sm font-medium text-gray-700 mb-2">Uploaded Files:</h4>
                                <div className="space-y-2 max-h-48 overflow-y-auto">
                                  {formData.files.map((file, index) => (
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
                              onChange={(e) => handleInputChange("zipFile", e.target.files[0])}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
                                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
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
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
                )}

                {/* Navigation Buttons */}
                <div className="flex justify-between pt-6 mt-6 border-t border-gray-200">
                  <button
                    onClick={handlePrevious}
                    disabled={currentStep === 1}
                    className={`px-4 py-2 text-sm font-medium rounded-lg ${
                      currentStep === 1
                        ? 'text-gray-400 cursor-not-allowed'
                        : 'text-gray-700 hover:bg-gray-50 border border-gray-300'
                    }`}
                  >
                    Previous
                  </button>
                  
                  {currentStep < 4 ? (
                    <button
                      onClick={handleNext}
                      className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700"
                    >
                      Next
                    </button>
                  ) : (
                    <button
                      onClick={handleSubmit}
                      disabled={isSubmitting || !canCreateWebsite()}
                      className="px-6 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                    >
                      {isSubmitting ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                          <span>Creating...</span>
                        </>
                      ) : (
                        <span>Create Website</span>
                      )}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
