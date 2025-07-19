"use client"

import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import {
  Calculator,
  Plus,
  Trash2,
  Save,
  Download,
  RotateCcw,
  TrendingUp,
  BookOpen,
  Info,
  ChevronLeft,
  Menu,
  X,
  FileText,
  BarChart3,
  Search,
  Share,
  Eye,
  Edit3,
  Globe,
  Lock,
  Users,
  CheckCircle,
  AlertCircle
} from "lucide-react"
import SideBar from "../../../components/ui/SideBar"
import AverageTab from "./AverageTab"
import MySchemasTab from "./MySchemasTab"
import PublicSchemasTab from "./PublicSchemasTab"
import axios from "axios"

const API_URL = import.meta.env.VITE_API_URL
const API_BASE_URL = `${API_URL}/api`

export default function AverageCalculator() {
  const navigate = useNavigate()
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [activeTab, setActiveTab] = useState("average") // average, my-schemas, public-schemas
  const [currentSchema, setCurrentSchema] = useState(null)
  const [mySchemas, setMySchemas] = useState([])
  const [publicSchemas, setPublicSchemas] = useState([])
  const [searchTerm, setSearchTerm] = useState("")
  const [loading, setLoading] = useState(false)
  
  // Pagination states
  const [mySchemasPagination, setMySchemasPagination] = useState(null)
  const [publicSchemasPagination, setPublicSchemasPagination] = useState(null)
  const [currentMyPage, setCurrentMyPage] = useState(1)
  const [currentPublicPage, setCurrentPublicPage] = useState(1)
  
  // Schema creation states
  const [isCreatingSchema, setIsCreatingSchema] = useState(false)
  const [newSchemaName, setNewSchemaName] = useState("")
  const [newSchemaDescription, setNewSchemaDescription] = useState("")
  const [newSchemaFields, setNewSchemaFields] = useState([
    { name: "", weight: 1 }
  ])
  
  // Notification states (replacing error and success states)
  const [notifications, setNotifications] = useState([])

  // Add CSS animation for toast notifications
  useEffect(() => {
    const style = document.createElement('style')
    style.textContent = `
      @keyframes slideInFromRight {
        from {
          transform: translateX(100%);
          opacity: 0;
        }
        to {
          transform: translateX(0);
          opacity: 1;
        }
      }
    `
    document.head.appendChild(style)
    return () => document.head.removeChild(style)
  }, [])

  // Notification system
  const addNotification = (message, type = 'success') => {
    const id = Date.now()
    const notification = { id, message, type }
    setNotifications(prev => [...prev, notification])
    
    // Auto-remove after 4 seconds
    setTimeout(() => {
      removeNotification(id)
    }, 4000)
  }

  const removeNotification = (id) => {
    setNotifications(prev => prev.filter(notif => notif.id !== id))
  }

  // Auth token from localStorage
  const getAuthToken = () => {
    return localStorage.getItem("access")
  }

  // API request helper
  const apiRequest = async (method, url, data = null) => {
    const token = getAuthToken()
    if (!token) {
      addNotification("Please log in to continue", "error")
      return null
    }

    try {
      const config = {
        method,
        url: `${API_BASE_URL}${url}`,
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json"
        }
      }
      
      if (data) {
        config.data = data
      }

      const response = await axios(config)
      return response.data
    } catch (error) {
      const message = error.response?.data?.detail || error.response?.data?.error || error.message
      addNotification(message, "error")
      return null
    }
  }

  // Load current schema
  const loadCurrentSchema = async () => {
    setLoading(true)
    const data = await apiRequest("GET", "/average/current-schema/")
    if (data) {
      setCurrentSchema(data)
    }
    setLoading(false)
  }

  // Load user's schemas
  const loadMySchemas = async (page = 1) => {
    const data = await apiRequest("GET", `/average/my-schemas/?page=${page}`)
    if (data) {
      setMySchemas(data.results || data)
      if (data.results) {
        // Handle paginated response
        setMySchemasPagination({
          count: data.count,
          current_page: page,
          total_pages: Math.ceil(data.count / 20),
          next: data.next,
          previous: data.previous
        })
      }
    }
  }

  // Load public schemas
  const loadPublicSchemas = async (page = 1) => {
    const params = new URLSearchParams({
      page: page.toString(),
      ...(searchTerm && { search: searchTerm })
    })
    const data = await apiRequest("GET", `/average/public-schemas/?${params}`)
    if (data) {
      setPublicSchemas(data.results || data)
      if (data.results) {
        // Handle paginated response
        setPublicSchemasPagination({
          count: data.count,
          current_page: page,
          total_pages: Math.ceil(data.count / 20),
          next: data.next,
          previous: data.previous
        })
      }
    }
  }

  // Create new schema
  const createSchema = async () => {
    if (!newSchemaName.trim()) {
      addNotification("Schema name is required", "error")
      return
    }

    const validFields = newSchemaFields.filter(f => f.name.trim() && f.weight >= 0)
    if (validFields.length === 0) {
      addNotification("At least one valid field is required", "error")
      return
    }

    const data = await apiRequest("POST", "/average/create-schema/", {
      name: newSchemaName,
      description: newSchemaDescription,
      fields: validFields
    })

    if (data) {
      addNotification("Schema created successfully!", "success")
      setIsCreatingSchema(false)
      setNewSchemaName("")
      setNewSchemaDescription("")
      setNewSchemaFields([{ name: "", weight: 1 }])
      await loadCurrentSchema()
      await loadMySchemas()
    }
  }

  // Use a schema
  const useSchema = async (schemaId) => {
    const data = await apiRequest("POST", `/average/use-schema/${schemaId}/`)
    if (data) {
      setCurrentSchema(data)
      addNotification("Schema loaded successfully!", "success")
      setActiveTab("average")
    }
  }

  // Publish schema
  const publishSchema = async (schemaId) => {
    const data = await apiRequest("POST", `/average/publish-schema/${schemaId}/`)
    if (data) {
      addNotification("Schema published successfully!", "success")
      await loadMySchemas()
    }
  }

  // Save schema
  const saveSchema = async (schemaId) => {
    const data = await apiRequest("POST", `/average/save-schema/${schemaId}/`)
    if (data) {
      addNotification("Schema saved successfully!", "success")
      await loadMySchemas()
      await loadPublicSchemas()
    }
  }

  // Unsave schema
  const unsaveSchema = async (schemaId) => {
    const data = await apiRequest("DELETE", `/average/unsave-schema/${schemaId}/`)
    if (data) {
      addNotification("Schema removed from saved schemas!", "success")
      await loadMySchemas()
      await loadPublicSchemas()
    }
  }

  // Update grade
  const updateGrade = async (fieldGradeId, grade) => {
    const data = await apiRequest("PUT", `/average/update-grade/${fieldGradeId}/`, { grade })
    if (data) {
      // Update current schema in state
      setCurrentSchema(prev => ({
        ...prev,
        field_grades: prev.field_grades.map(fg => 
          fg.id === fieldGradeId ? { ...fg, grade: data.grade } : fg
        )
      }))
    }
  }

  // Calculate weighted average
  const calculateWeightedAverage = () => {
    if (!currentSchema?.field_grades) return 0

    const validGrades = currentSchema.field_grades.filter(fg => fg.grade !== null && fg.grade !== undefined)
    if (validGrades.length === 0) return 0

    const totalWeightedScore = validGrades.reduce((sum, fg) => sum + (fg.grade * fg.field_weight), 0)
    const totalWeight = validGrades.reduce((sum, fg) => sum + fg.field_weight, 0)

    return totalWeight > 0 ? (totalWeightedScore / totalWeight).toFixed(2) : 0
  }

  // Pagination handlers
  const handleMySchemaPageChange = (page) => {
    setCurrentMyPage(page)
    loadMySchemas(page)
  }

  const handlePublicSchemaPageChange = (page) => {
    setCurrentPublicPage(page)
    loadPublicSchemas(page)
  }

  // Load data on component mount
  useEffect(() => {
    loadCurrentSchema()
    loadMySchemas()
    loadPublicSchemas()
  }, [])

  // Search public schemas when search term changes
  useEffect(() => {
    if (activeTab === "public-schemas") {
      setCurrentPublicPage(1) // Reset to first page when searching
      const timeoutId = setTimeout(() => {
        loadPublicSchemas(1)
      }, 300)
      return () => clearTimeout(timeoutId)
    }
  }, [searchTerm, activeTab])

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar */}
      <SideBar
        isSidebarOpen={isSidebarOpen}
        setIsSidebarOpen={setIsSidebarOpen}
        pageTitle="Average Calculator"
      />

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="bg-white shadow-sm border-b border-gray-200">
          <div className="flex items-center justify-between h-16 px-4 sm:px-6 lg:px-8">
            <div className="flex items-center gap-4">
              <button onClick={() => setIsSidebarOpen(true)} className="lg:hidden p-2 rounded-md hover:bg-gray-100">
                <Menu className="w-5 h-5" />
              </button>
              <button
                onClick={() => navigate("/dashboard")}
                className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
              >
                <ChevronLeft className="w-5 h-5" />
                <span className="hidden sm:inline">Back to Dashboard</span>
              </button>
            </div>

            <div className="flex items-center gap-4">
              <TrendingUp className="w-8 h-8 text-blue-600" />
            </div>
          </div>
        </header>

        {/* Tab Navigation */}
        <div className="bg-white border-b border-gray-200">
          <div className="px-4 sm:px-6 lg:px-8">
            <div className="flex space-x-8">
              <button
                onClick={() => setActiveTab("average")}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === "average"
                    ? "border-blue-500 text-blue-600"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                }`}
              >
                <Calculator className="w-4 h-4 inline mr-2" />
                Average
              </button>
              <button
                onClick={() => setActiveTab("my-schemas")}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === "my-schemas"
                    ? "border-blue-500 text-blue-600"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                }`}
              >
                <FileText className="w-4 h-4 inline mr-2" />
                My Schemas
              </button>
              <button
                onClick={() => setActiveTab("public-schemas")}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === "public-schemas"
                    ? "border-blue-500 text-blue-600"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                }`}
              >
                <Globe className="w-4 h-4 inline mr-2" />
                Public Schemas
              </button>
            </div>
          </div>
        </div>

        {/* Toast Notifications */}
        <div className="fixed top-4 right-4 z-50 space-y-2">
          {notifications.map((notification) => (
            <div
              key={notification.id}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg border-l-4 transition-all duration-300 transform ${
                notification.type === 'success' 
                  ? 'bg-green-50 border-green-400 text-green-800' 
                  : 'bg-red-50 border-red-400 text-red-800'
              }`}
              style={{
                animation: 'slideInFromRight 0.3s ease-out'
              }}
            >
              {notification.type === 'success' ? (
                <CheckCircle className="w-5 h-5 text-green-600" />
              ) : (
                <AlertCircle className="w-5 h-5 text-red-600" />
              )}
              <span className="font-medium">{notification.message}</span>
              <button
                onClick={() => removeNotification(notification.id)}
                className="ml-2 text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>

        {/* Tab Content */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          {activeTab === "average" && (
            <AverageTab
              currentSchema={currentSchema}
              updateGrade={updateGrade}
              calculateWeightedAverage={calculateWeightedAverage}
              loading={loading}
              isCreatingSchema={isCreatingSchema}
              setIsCreatingSchema={setIsCreatingSchema}
              newSchemaName={newSchemaName}
              setNewSchemaName={setNewSchemaName}
              newSchemaDescription={newSchemaDescription}
              setNewSchemaDescription={setNewSchemaDescription}
              newSchemaFields={newSchemaFields}
              setNewSchemaFields={setNewSchemaFields}
              createSchema={createSchema}
            />
          )}

          {activeTab === "my-schemas" && (
            <MySchemasTab
              schemas={mySchemas}
              useSchema={useSchema}
              publishSchema={publishSchema}
              unsaveSchema={unsaveSchema}
              loadMySchemas={loadMySchemas}
              pagination={mySchemasPagination}
              onPageChange={handleMySchemaPageChange}
            />
          )}

          {activeTab === "public-schemas" && (
            <PublicSchemasTab
              schemas={publicSchemas}
              useSchema={useSchema}
              saveSchema={saveSchema}
              unsaveSchema={unsaveSchema}
              searchTerm={searchTerm}
              setSearchTerm={setSearchTerm}
              pagination={publicSchemasPagination}
              onPageChange={handlePublicSchemaPageChange}
            />
          )}
        </main>
      </div>

      {/* Mobile Sidebar Overlay */}
      {isSidebarOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden" onClick={() => setIsSidebarOpen(false)} />
      )}
    </div>
  )
}
