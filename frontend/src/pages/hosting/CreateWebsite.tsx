import { useState } from "react"
import type React from "react"
import { ApiError, errorMessage } from "../../lib/api/errors"
import StepBasicInfo from "../../features/hosting/StepBasicInfo"
import StepConfiguration from "../../features/hosting/StepConfiguration"
import StepDeployment from "../../features/hosting/StepDeployment"
import StepWebsiteType from "../../features/hosting/StepWebsiteType"
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
import { hostingApi } from "../../utils/hostingApi"
import { useSubscription } from "../../hooks/useSubscription"
import { useWebsites } from "../../hooks/useWebsites.js"
import { useDomains } from "../../hooks/useDomains.js"
import Spinner from "../../components/ui/Spinner"

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
    selectedDomainId: null as string | null,
    
    // Step 2: Website Type
    website_type: "", // "static" or "php"
    
    // Step 3: Configuration
    phpVersion: "8.2",
    environment_variables: [] as { key: string; value: string }[],
    ssl: true,
    
    // Step 4: Files
    deploymentMethod: "upload", // "upload", "git", "zip"
    files: [] as File[],
    git_repository: "",
    deployment_branch: "main",
    zipFile: null as File | null
  })

  const [errors, setErrors] = useState<Record<string, string>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState("")

  const steps = [
    { id: 1, title: "Basic Information", description: "Website name and subdomain" },
    { id: 2, title: "Website Type", description: "Choose static site or PHP application" },
        { id: 3, title: "Configuration", description: "Environment variables and SSL settings" },
    { id: 4, title: "Deployment", description: "Upload files or connect repository" }
  ]

  const handleInputChange = (field: string, value: unknown) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }))
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({
        ...prev,
        [field]: ""
      }))
    }
  }

  const handleEnvironmentVariableAdd = () => {
    setFormData(prev => ({
      ...prev,
      environment_variables: [...prev.environment_variables, { key: "", value: "" }]
    }))
  }

  const handleEnvironmentVariableChange = (index: number, field: "key" | "value", value: string) => {
    setFormData(prev => ({
      ...prev,
      environment_variables: prev.environment_variables.map((envVar, i) => 
        i === index ? { ...envVar, [field]: value } : envVar
      )
    }))
  }

  const handleEnvironmentVariableRemove = (index: number) => {
    setFormData(prev => ({
      ...prev,
      environment_variables: prev.environment_variables.filter((_, i) => i !== index)
    }))
  }

  const validateStep = (step: number) => {
    const newErrors: Record<string, string> = {}
    
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
      const websiteData: Record<string, unknown> = {
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
        const envVars: Record<string, string> = {}
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
      // ApiError carries the parsed body, so DRF's per-field messages can be
      // shown as they were sent. There is no axios envelope to read.
      const body = error instanceof ApiError ? error.body : null
      if (body && typeof body === "object") {
        setSubmitError(
          Object.entries(body as Record<string, unknown>)
            .map(([field, messages]) =>
              `${field}: ${Array.isArray(messages) ? messages.join(", ") : String(messages)}`)
            .join("\n")
        )
      } else {
        setSubmitError(errorMessage(error, "Could not create that website."))
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? [])
    
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

  const removeFile = (index: number) => {
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
      <div className="min-h-screen bg-white">
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
              <div className="bg-white rounded-lg border border-gray-200 p-6">
                
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
                
                {currentStep === 1 && (
                  <StepBasicInfo
                    formData={formData}
                    errors={errors}
                    handleInputChange={handleInputChange}
                    availableDomains={availableDomains}
                  />
                )}

                {currentStep === 2 && (
                  <StepWebsiteType
                    formData={formData}
                    errors={errors}
                    handleInputChange={handleInputChange}
                  />
                )}

                {currentStep === 3 && (
                  <StepConfiguration
                    formData={formData}
                    errors={errors}
                    handleInputChange={handleInputChange}
                    handleEnvironmentVariableAdd={handleEnvironmentVariableAdd}
                    handleEnvironmentVariableChange={handleEnvironmentVariableChange}
                    handleEnvironmentVariableRemove={handleEnvironmentVariableRemove}
                  />
                )}

                {currentStep === 4 && (
                  <StepDeployment
                    formData={formData}
                    errors={errors}
                    handleInputChange={handleInputChange}
                    handleFileUpload={handleFileUpload}
                    removeFile={removeFile}
                  />
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
                          <Spinner size="sm" tone="onColor" />
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
