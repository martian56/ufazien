import { useState } from "react"
import type React from "react"
import { errorMessage } from "../../lib/api/errors"
import { Helmet } from "react-helmet"
import { useNavigate } from "react-router-dom"
import {
  ArrowLeft,
  Database,
  CheckCircle,
  AlertCircle,
  Eye,
  EyeOff,
  Info,
  Loader,
  Server,
  Shield,
  Zap
} from "lucide-react"
import HostingSidebar from "../../components/hosting/HostingSidebar"
import { useDatabases } from "../../hooks/useDatabases.js"
import { useSubscription } from "../../hooks/useSubscription"

interface FormData {
  name: string
  db_type: string
  description: string
}

/** Per-field messages, plus `submit` for a failure of the whole form. */
type FormErrors = Partial<Record<keyof FormData | "submit", string>>

export default function CreateDatabase() {
  const navigate = useNavigate()
  const { createDatabase, loading: databaseLoading } = useDatabases()
  const { subscription } = useSubscription()
  
  const [formData, setFormData] = useState({
    name: "",
    db_type: "mysql",
    description: ""
  })
  
  const [errors, setErrors] = useState<FormErrors>({})
  const [showPassword, setShowPassword] = useState(false)
  const [generatedCredentials, setGeneratedCredentials] = useState<{ username: string; password: string } | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [isCreated, setIsCreated] = useState(false)

  const databaseTypes = [
    {
      id: 'mysql',
      name: 'MySQL',
      description: 'Popular open-source relational database',
      icon: Database,
      version: '8.0',
      features: ['ACID compliant', 'High performance', 'Widely supported'],
      color: 'bg-blue-100 text-blue-600'
    },
    {
      id: 'postgresql',
      name: 'PostgreSQL',
      description: 'Advanced open-source relational database',
      icon: Server,
      version: '15',
      features: ['Advanced features', 'JSON support', 'Extensible'],
      color: 'bg-purple-100 text-purple-600'
    }
  ]

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
    
    // Clear error when user starts typing
    if (errors[name as keyof FormErrors]) {
      setErrors(prev => ({
        ...prev,
        [name]: null
      }))
    }
  }

  const handleTypeSelect = (type: string) => {
    setFormData(prev => ({
      ...prev,
      db_type: type
    }))
  }

  const validateForm = () => {
    const newErrors: FormErrors = {}

    if (!formData.name.trim()) {
      newErrors.name = "Database name is required"
    } else if (formData.name.length < 3) {
      newErrors.name = "Database name must be at least 3 characters"
    } else if (!/^[a-zA-Z][a-zA-Z0-9_]*$/.test(formData.name)) {
      newErrors.name = "Database name must start with a letter and contain only letters, numbers, and underscores"
    }

    if (!formData.db_type) {
      newErrors.db_type = "Please select a database type"
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const generateCredentials = () => {
    const username = `${formData.name}_user`
    const password = Math.random().toString(36).slice(-12) + Math.random().toString(36).slice(-12).toUpperCase() + '123!'
    return { username, password }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!validateForm()) {
      return
    }

    setIsCreating(true)
    
    try {
      const credentials = generateCredentials()
      setGeneratedCredentials(credentials)
      
      const databaseData = {
        name: formData.name,
        db_type: formData.db_type,
        username: credentials.username,
        password: credentials.password,
        description: formData.description
      }

      const newDatabase = await createDatabase(databaseData)
      setIsCreated(true)
      
      // Auto redirect after 5 seconds or user can click button
      setTimeout(() => {
        if (isCreated) {
          navigate('/hosting/databases')
        }
      }, 5000)
      
    } catch (error) {
      setErrors({ submit: errorMessage(error, "Could not create that database.") })
    } finally {
      setIsCreating(false)
    }
  }

  const selectedType = databaseTypes.find(type => type.id === formData.db_type)

  if (isCreated && generatedCredentials) {
    return (
      <>
        <Helmet>
          <title>Database Created | Ufazien Hosting</title>
        </Helmet>
        <div className="min-h-screen bg-white">
          <HostingSidebar />
          
          <div className="lg:ml-64">
            <div className="p-4 lg:p-6 pt-16 lg:pt-6">
              <div className="max-w-2xl mx-auto">
                <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
                  <div className="mb-6">
                    <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-green-100 mb-4">
                      <CheckCircle className="h-8 w-8 text-green-600" />
                    </div>
                    <h2 className="text-2xl font-bold text-gray-900 mb-2">Database Created Successfully!</h2>
                    <p className="text-gray-600">Your {selectedType?.name} database "{formData.name}" has been created.</p>
                  </div>

                  <div className="bg-gray-50 rounded-lg p-6 mb-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                      <Shield className="h-5 w-5 mr-2 text-blue-600" />
                      Database Credentials
                    </h3>
                    
                    <div className="space-y-4 text-left">
                      <div>
                        <label className="text-sm font-medium text-gray-500 uppercase tracking-wide">Database Name</label>
                        <div className="mt-1 flex items-center justify-between bg-white border border-gray-300 rounded-lg px-3 py-2">
                          <code className="text-sm font-mono">{formData.name}</code>
                          <button 
                            onClick={() => navigator.clipboard.writeText(formData.name)}
                            className="text-blue-600 hover:text-blue-700 text-sm"
                          >
                            Copy
                          </button>
                        </div>
                      </div>

                      <div>
                        <label className="text-sm font-medium text-gray-500 uppercase tracking-wide">Username</label>
                        <div className="mt-1 flex items-center justify-between bg-white border border-gray-300 rounded-lg px-3 py-2">
                          <code className="text-sm font-mono">{generatedCredentials.username}</code>
                          <button 
                            onClick={() => navigator.clipboard.writeText(generatedCredentials.username)}
                            className="text-blue-600 hover:text-blue-700 text-sm"
                          >
                            Copy
                          </button>
                        </div>
                      </div>

                      <div>
                        <label className="text-sm font-medium text-gray-500 uppercase tracking-wide">Password</label>
                        <div className="mt-1 flex items-center justify-between bg-white border border-gray-300 rounded-lg px-3 py-2">
                          <code className="text-sm font-mono">
                            {showPassword ? generatedCredentials.password : '••••••••••••••••••••'}
                          </code>
                          <div className="flex items-center space-x-2">
                            <button 
                              onClick={() => setShowPassword(!showPassword)}
                              className="text-gray-400 hover:text-gray-600"
                            >
                              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </button>
                            <button 
                              onClick={() => navigator.clipboard.writeText(generatedCredentials.password)}
                              className="text-blue-600 hover:text-blue-700 text-sm"
                            >
                              Copy
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-lg">
                      <div className="flex items-start">
                        <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5 mr-2 flex-shrink-0" />
                        <div className="text-sm text-amber-700">
                          <p className="font-medium mb-1">Important: Save these credentials</p>
                          <p>Make sure to save these credentials in a secure location. You won't be able to view the password again once you leave this page.</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-3 justify-center">
                    <button
                      onClick={() => navigate('/hosting/databases')}
                      className="inline-flex items-center px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                    >
                      <Database className="h-4 w-4 mr-2" />
                      View All Databases
                    </button>
                    <button
                      onClick={() => {
                        setIsCreated(false)
                        setGeneratedCredentials(null)
                        setFormData({ name: "", db_type: "mysql", description: "" })
                      }}
                      className="inline-flex items-center px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
                    >
                      Create Another Database
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </>
    )
  }

  return (
    <>
      <Helmet>
        <title>Create Database | Ufazien Hosting</title>
        <meta name="description" content="Create a new MySQL or PostgreSQL database" />
      </Helmet>
      <div className="min-h-screen bg-white">
        <HostingSidebar />
        
        <div className="lg:ml-64">
          <div className="p-4 lg:p-6 pt-16 lg:pt-6">
            {/* Header */}
            <div className="mb-8">
              <button
                onClick={() => navigate('/hosting/databases')}
                className="inline-flex items-center text-blue-600 hover:text-blue-700 mb-4"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Databases
              </button>
              
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Create Database</h1>
                <p className="mt-2 text-gray-600">Set up a new MySQL or PostgreSQL database for your applications</p>
                
                {/* Usage Info */}
                <div className="mt-3 flex items-center gap-4 text-sm text-gray-500">
                  <span>Plan: {subscription?.plan?.name || 'Free'}</span>
                  <span>Database Limit: {subscription?.plan?.max_databases || 5}</span>
                </div>
              </div>
            </div>

            <div className="max-w-3xl">
              <form onSubmit={handleSubmit} className="space-y-8">
                {/* Database Type Selection */}
                <div className="bg-white rounded-lg border border-gray-200 p-6">
                  <h2 className="text-xl font-semibold text-gray-900 mb-4">Database Type</h2>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {databaseTypes.map((type) => {
                      const Icon = type.icon
                      const isSelected = formData.db_type === type.id
                      
                      return (
                        <div
                          key={type.id}
                          onClick={() => handleTypeSelect(type.id)}
                          className={`relative cursor-pointer rounded-lg border-2 p-6 transition-all ${
                            isSelected 
                              ? 'border-blue-500 bg-blue-50' 
                              : 'border-gray-300 hover:border-gray-400'
                          }`}
                        >
                          <div className="flex items-center space-x-3 mb-3">
                            <div className={`rounded-lg p-2 ${type.color}`}>
                              <Icon className="h-6 w-6" />
                            </div>
                            <div>
                              <h3 className="font-semibold text-gray-900">{type.name}</h3>
                              <p className="text-sm text-gray-500">Version {type.version}</p>
                            </div>
                          </div>
                          
                          <p className="text-gray-600 text-sm mb-3">{type.description}</p>
                          
                          <div className="space-y-1">
                            {type.features.map((feature, index) => (
                              <div key={index} className="flex items-center text-sm text-gray-500">
                                <CheckCircle className="h-3 w-3 text-green-500 mr-2" />
                                {feature}
                              </div>
                            ))}
                          </div>
                          
                          {isSelected && (
                            <div className="absolute top-4 right-4">
                              <div className="bg-blue-600 text-white rounded-full p-1">
                                <CheckCircle className="h-4 w-4" />
                              </div>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                  
                  {errors.db_type && (
                    <p className="mt-2 text-sm text-red-600">{errors.db_type}</p>
                  )}
                </div>

                {/* Database Configuration */}
                <div className="bg-white rounded-lg border border-gray-200 p-6">
                  <h2 className="text-xl font-semibold text-gray-900 mb-4">Database Configuration</h2>
                  
                  <div className="space-y-6">
                    <div>
                      <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
                        Database Name <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        id="name"
                        name="name"
                        value={formData.name}
                        onChange={handleInputChange}
                        placeholder="my_database"
                        className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 ${
                          errors.name ? 'border-red-500' : ''
                        }`}
                      />
                      {errors.name && (
                        <p className="mt-1 text-sm text-red-600">{errors.name}</p>
                      )}
                      <p className="mt-1 text-sm text-gray-500">
                        Must start with a letter and contain only letters, numbers, and underscores
                      </p>
                    </div>

                    <div>
                      <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-2">
                        Description (Optional)
                      </label>
                      <textarea
                        id="description"
                        name="description"
                        value={formData.description}
                        onChange={handleInputChange}
                        rows={3}
                        placeholder="Brief description of what this database will be used for..."
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                      />
                    </div>
                  </div>
                </div>

                {/* Features & Security Info */}
                <div className="bg-white rounded-lg border border-gray-200 p-6">
                  <h2 className="text-xl font-semibold text-gray-900 mb-4">What You Get</h2>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="flex items-start space-x-3">
                      <div className="bg-green-100 rounded-lg p-2">
                        <Zap className="h-5 w-5 text-green-600" />
                      </div>
                      <div>
                        <h3 className="font-medium text-gray-900">High Performance</h3>
                        <p className="text-sm text-gray-600">Optimized for fast queries and high throughput</p>
                      </div>
                    </div>
                    
                    <div className="flex items-start space-x-3">
                      <div className="bg-blue-100 rounded-lg p-2">
                        <Shield className="h-5 w-5 text-blue-600" />
                      </div>
                      <div>
                        <h3 className="font-medium text-gray-900">Secure by Default</h3>
                        <p className="text-sm text-gray-600">Encrypted connections and secure credentials</p>
                      </div>
                    </div>
                    
                    <div className="flex items-start space-x-3">
                      <div className="bg-purple-100 rounded-lg p-2">
                        <Database className="h-5 w-5 text-purple-600" />
                      </div>
                      <div>
                        <h3 className="font-medium text-gray-900">Auto Backups</h3>
                        <p className="text-sm text-gray-600">Daily automated backups included</p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <div className="flex items-start">
                      <Info className="h-5 w-5 text-blue-600 mt-0.5 mr-2 flex-shrink-0" />
                      <div className="text-sm text-blue-700">
                        <p className="font-medium mb-1">Automatic Setup</p>
                        <p>We'll automatically generate secure credentials and configure your database. You'll receive the connection details once creation is complete.</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Submit */}
                <div className="flex flex-col sm:flex-row gap-3 justify-end">
                  <button
                    type="button"
                    onClick={() => navigate('/hosting/databases')}
                    className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isCreating}
                    className="inline-flex items-center px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isCreating ? (
                      <>
                        <Loader className="h-4 w-4 mr-2 animate-spin" />
                        Creating Database...
                      </>
                    ) : (
                      <>
                        <Database className="h-4 w-4 mr-2" />
                        Create Database
                      </>
                    )}
                  </button>
                </div>

                {errors.submit && (
                  <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                    <div className="flex items-center">
                      <AlertCircle className="h-5 w-5 text-red-600 mr-2" />
                      <p className="text-sm text-red-700">{errors.submit}</p>
                    </div>
                  </div>
                )}
              </form>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
