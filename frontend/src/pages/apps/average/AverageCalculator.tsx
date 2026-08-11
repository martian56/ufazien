"use client"

import { useState, useEffect } from "react"
import { Helmet } from "react-helmet"
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
import AverageTab from "./AverageTab"
import MySchemasTab from "./MySchemasTab"
import PublicSchemasTab from "./PublicSchemasTab"
import averageApi, { type Schema, type SchemaGrades } from "../../../lib/api/endpoints/average"
import { ApiError } from "../../../lib/api/errors"
import { useAppShell } from "../../../components/layout/appShellContext"

/** Page number to page of results, for the two schema lists. */
interface PageInfo {
  count: number
  current_page: number
  total_pages: number
  next?: string | null
  previous?: string | null
}

interface Toast {
  id: number
  message: string
  type: string
}

/** Matches SchemaPagination.page_size in average/views.py. */
const PAGE_SIZE = 20

export default function AverageCalculator() {
  const navigate = useNavigate()
  const { isSidebarOpen, setIsSidebarOpen } = useAppShell()
  const [activeTab, setActiveTab] = useState("average") // average, my-schemas, public-schemas
  const [currentSchema, setCurrentSchema] = useState<SchemaGrades | null>(null)
  const [mySchemas, setMySchemas] = useState<Schema[]>([])
  const [publicSchemas, setPublicSchemas] = useState<Schema[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [loading, setLoading] = useState(false)
  
  // Pagination states
  const [mySchemasPagination, setMySchemasPagination] = useState<PageInfo | null>(null)
  const [publicSchemasPagination, setPublicSchemasPagination] = useState<PageInfo | null>(null)
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
  const [notifications, setNotifications] = useState<Toast[]>([])

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
    return () => {
      document.head.removeChild(style)
    }
  }, [])

  // Notification system
  const addNotification = (message: string, type: string = "success") => {
    const id = Date.now()
    const notification = { id, message, type }
    setNotifications(prev => [...prev, notification])
    
    // Auto-remove after 4 seconds
    setTimeout(() => {
      removeNotification(id)
    }, 4000)
  }

  const removeNotification = (id: number) => {
    setNotifications(prev => prev.filter(notif => notif.id !== id))
  }

  /**
   * Every call reports its own failure and returns nothing, so the handlers
   * below stay flat. The shared client already refreshes an expired token and
   * only reaches here once that has failed too.
   */
  const report = (error: unknown, fallback: string) => {
    addNotification(error instanceof ApiError ? error.userMessage : fallback, "error")
  }

  const loadCurrentSchema = async () => {
    setLoading(true)
    try {
      setCurrentSchema(await averageApi.current())
    } catch (error) {
      // Having picked no schema yet is the normal first visit, not a failure.
      if (error instanceof ApiError && error.isNotFound) {
        setCurrentSchema(null)
      } else {
        report(error, "Could not load your schema")
      }
    } finally {
      setLoading(false)
    }
  }

  const loadMySchemas = async (page = 1) => {
    try {
      const data = await averageApi.mySchemas(page)
      setMySchemas(data.results ?? [])
      setMySchemasPagination({
        count: data.count,
        current_page: page,
        total_pages: Math.max(1, Math.ceil(data.count / PAGE_SIZE)),
        next: data.next,
        previous: data.previous,
      })
    } catch (error) {
      report(error, "Could not load your schemas")
    }
  }

  const loadPublicSchemas = async (page = 1) => {
    try {
      const data = await averageApi.publicSchemas(page, searchTerm)
      setPublicSchemas(data.results ?? [])
      setPublicSchemasPagination({
        count: data.count,
        current_page: page,
        total_pages: Math.max(1, Math.ceil(data.count / PAGE_SIZE)),
        next: data.next,
        previous: data.previous,
      })
    } catch (error) {
      report(error, "Could not load public schemas")
    }
  }

  const createSchema = async () => {
    if (!newSchemaName.trim()) {
      addNotification("Schema name is required", "error")
      return
    }

    const validFields = newSchemaFields.filter(f => f.name.trim() && Number(f.weight) > 0)
    if (validFields.length === 0) {
      addNotification("At least one valid field is required", "error")
      return
    }

    try {
      await averageApi.create({
        name: newSchemaName,
        description: newSchemaDescription,
        fields: validFields.map(f => ({ name: f.name, weight: String(f.weight) })),
      })
      addNotification("Schema created successfully!", "success")
      setIsCreatingSchema(false)
      setNewSchemaName("")
      setNewSchemaDescription("")
      setNewSchemaFields([{ name: "", weight: 1 }])
      await loadCurrentSchema()
      await loadMySchemas()
    } catch (error) {
      report(error, "Could not create the schema")
    }
  }

  const useSchema = async (schemaId: number) => {
    try {
      setCurrentSchema(await averageApi.use(schemaId))
      addNotification("Schema loaded successfully!", "success")
      setActiveTab("average")
    } catch (error) {
      report(error, "Could not load that schema")
    }
  }

  const publishSchema = async (schemaId: number) => {
    try {
      await averageApi.publish(schemaId)
      addNotification("Schema published successfully!", "success")
      await loadMySchemas()
    } catch (error) {
      report(error, "Could not publish the schema")
    }
  }

  const saveSchema = async (schemaId: number) => {
    try {
      await averageApi.save(schemaId)
      addNotification("Schema saved successfully!", "success")
      await loadMySchemas()
      await loadPublicSchemas()
    } catch (error) {
      report(error, "Could not save the schema")
    }
  }

  const deleteSchema = async (schemaId: number) => {
    // /average/delete-schema/ has existed all along and nothing called it, so
    // the confirmation dialog closed and left the schema exactly where it was.
    try {
      await averageApi.remove(schemaId)
      addNotification("Schema deleted.", "success")
      // The deleted schema may have been the active one, in which case the
      // calculator was still showing its fields.
      await loadCurrentSchema()
      await loadMySchemas()
      await loadPublicSchemas()
    } catch (error) {
      report(error, "Could not delete the schema")
    }
  }

  const unsaveSchema = async (schemaId: number) => {
    try {
      await averageApi.unsave(schemaId)
      addNotification("Schema removed from saved schemas!", "success")
      await loadMySchemas()
      await loadPublicSchemas()
    } catch (error) {
      report(error, "Could not remove the schema")
    }
  }

  const updateGrade = async (fieldGradeId: number, grade: number | string | null) => {
    try {
      const saved = await averageApi.updateGrade(fieldGradeId, grade)
      setCurrentSchema(prev =>
        prev
          ? {
              ...prev,
              field_grades: (prev.field_grades ?? []).map(fg =>
                fg.id === fieldGradeId ? { ...fg, grade: saved.grade } : fg
              ),
            }
          : prev
      )
    } catch (error) {
      report(error, "Could not save that grade")
    }
  }

  /**
   * Grades arrive as strings from DRF's DecimalField, so `sum + fg.grade` was
   * string concatenation: three marks of 15 averaged to "151515".
   */
  const calculateWeightedAverage = (): number => {
    const graded = (currentSchema?.field_grades ?? []).filter(
      fg => fg.grade !== null && fg.grade !== undefined && fg.grade !== ""
    )
    if (graded.length === 0) return 0

    const weighted = graded.reduce((sum, fg) => sum + Number(fg.grade) * Number(fg.field_weight ?? 0), 0)
    const totalWeight = graded.reduce((sum, fg) => sum + Number(fg.field_weight ?? 0), 0)

    return totalWeight > 0 ? Number((weighted / totalWeight).toFixed(2)) : 0
  }

  // Pagination handlers
  const handleMySchemaPageChange = (page: number) => {
    setCurrentMyPage(page)
    loadMySchemas(page)
  }

  const handlePublicSchemaPageChange = (page: number) => {
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
    <>
      <Helmet>
        <title>Ufazien | Average Calculator</title>
        <meta name="description" content="Calculate your average grades with Ufazien's Average Calculator." />
      </Helmet>
      <div className="flex-1 flex flex-col min-w-0">
        {/* Sidebar */}
        

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="bg-white border-b border-gray-200">
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
              deleteSchema={deleteSchema}
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
    </div>
  </>
  )
}
