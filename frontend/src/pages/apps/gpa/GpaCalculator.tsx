"use client"

import { useState, useEffect } from "react"
import { tabFor, toAverageRows } from "../../../features/gpa/loadCalculation"
import { api } from "../../../lib/api/client"
import { errorMessage } from "../../../lib/api/errors"
import { gpaApi } from "../../../lib/api/endpoints/gpa"
import { toList } from "../../../lib/api/types"
import AverageRow from "../../../features/gpa/AverageRow"
import ConversionTableModal from "../../../features/gpa/ConversionTableModal"
import { useNavigate } from "react-router-dom"
import { Helmet } from "react-helmet"
import {
  Calculator,
  Plus,
  Trash2,
  Save,
  Download,
  RotateCcw,
  Info,
  ChevronLeft,
  Menu,
  FileText,
  BarChart3,
  Calendar,
  Clock,
  Award,
  AlertCircle,
  CheckCircle,
  Users,
  X,
} from "lucide-react"
import SideBar from "../../../components/ui/SideBar"
import type { AverageRow as AverageRowData, GpaStatistics, SavedCalculation } from "../../../lib/api/endpoints/gpa"

interface Toast {
  id: number
  message: string
  type: string
}

/** Only what this page reads off the profile; never the email address. */
interface GpaProfile {
  id?: number
  username?: string
  full_name?: string
  gpa?: number | string | null
}


export default function GpaCalculator() {
  const navigate = useNavigate()
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [activeTab, setActiveTab] = useState("semester")
  const [loading, setLoading] = useState(false)
  const [inputSaving, setInputSaving] = useState(false)
  const [isInitialLoad, setIsInitialLoad] = useState(true)

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
  
  // Separate state for semester and yearly averages
  const [semesterAverages, setSemesterAverages] = useState<AverageRowData[]>([
    { id: 1, period: "", average: "", gradeType: "ufaz" }
  ])
  const [yearlyAverages, setYearlyAverages] = useState<AverageRowData[]>([
    { id: 1, period: "", average: "", gradeType: "ufaz" }
  ])
  
  // Saved calculations and statistics
  const [savedCalculations, setSavedCalculations] = useState<SavedCalculation[]>([])
  const [statistics, setStatistics] = useState<GpaStatistics | null>(null)
  // "history" is a view, not a calculator. This remembers which set of
  // numbers is on screen so the saved panel knows what it is saving.
  const [lastCalculatorTab, setLastCalculatorTab] = useState("semester")
  const [userProfile, setUserProfile] = useState<GpaProfile | null>(null)
  
  // UI state
  const [showConversionTable, setShowConversionTable] = useState(false)
  const [notifications, setNotifications] = useState<Toast[]>([])

  // Auth and API helpers
  const getAuthToken = () => localStorage.getItem("access")

  // Notification system
  const addNotification = (message: string, type = 'success') => {
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

  const apiRequest = async (method: string, url: string, data: unknown = null) => {
    try {
      if (method === "GET") return await api.get(url)
      if (method === "POST") return await api.post(url, data ?? undefined)
      if (method === "DELETE") return await api.delete(url)
      return await api.patch(url, data ?? undefined)
    } catch (error) {
      addNotification(errorMessage(error, "Something went wrong."), "error")
      return null
    }
  }

  // UFAZ conversion system based on research
  const ufazConversionTable = [
    { min: 16, max: 20, gpa: 4.0, letter: "A+", status: "Perfect", azMin: 90, azMax: 100 },
    { min: 13.5, max: 16, gpa: 4.0, letter: "A", status: "Excellent", azMin: 80, azMax: 90 },
    { min: 11.5, max: 13.5, gpa: 3.0, letter: "B", status: "Good", azMin: 70, azMax: 80 },
    { min: 10, max: 11.5, gpa: 2.0, letter: "C", status: "Enough", azMin: 50, azMax: 70 },
    { min: 0, max: 10, gpa: 0.0, letter: "F", status: "Fail", azMin: 0, azMax: 50 },
  ]

  // Load academic structure and user data
  const loadUserData = async () => {
    try {
      setUserProfile(await api.get<GpaProfile>("/auth/user/"))
    } catch (error) {
      addNotification(errorMessage(error, "Could not load your profile."), "error")
    }
  }

  /**
   * Reopen a saved calculation in the calculator.
   *
   * The rows called a loadCalculation that was never written, so clicking one
   * threw a ReferenceError; they were then made non-clickable on the belief
   * that only a summary was stored. update_user_gpa in fact writes one
   * CourseGrade per period with its name and average, and the list endpoint
   * serializes them, so the inputs were there the whole time.
   */
  const saveNamedCalculation = async () => {
    // The Save button lives on the history tab, so activeTab is "history"
    // here and cannot say which calculator the numbers came from. That is
    // what lastCalculatorTab is for.
    const currentAverages = lastCalculatorTab === "yearly" ? yearlyAverages : semesterAverages
    const filled = currentAverages.filter((avg) => avg.period && avg.average)
    if (filled.length === 0) {
      addNotification("Add a period and a mark before saving.", "error")
      return
    }

    const name = window.prompt("Name this calculation", `${lastCalculatorTab === "yearly" ? "Yearly" : "Semester"} GPA`)
    if (!name?.trim()) return

    try {
      await gpaApi.save(
        name.trim(),
        lastCalculatorTab,
        // 30 ECTS for a semester, 60 for a year, matching what the autosave
        // writes. Every period carries the same weight either way, so this
        // does not change the GPA, but total_credits is displayed and should
        // mean something.
        filled.map((avg) => ({
          course_name: avg.period,
          credits: lastCalculatorTab === "yearly" ? 60 : 30,
          grade_type: "ufaz",
          ufaz_grade: parseFloat(avg.average),
        }))
      )
      addNotification(`Saved "${name.trim()}".`, "success")
      loadSavedCalculations()
    } catch (error) {
      addNotification(errorMessage(error, "Could not save that calculation."), "error")
    }
  }

  const deleteCalculation = async (calc: SavedCalculation) => {
    if (!window.confirm(`Delete "${calc.name}"?`)) return
    try {
      await gpaApi.remove(calc.id)
      addNotification(`Deleted "${calc.name}".`, "success")
      loadSavedCalculations()
    } catch (error) {
      addNotification(errorMessage(error, "Could not delete that calculation."), "error")
    }
  }

  const loadCalculation = (calc: SavedCalculation) => {
    const rows = toAverageRows(calc)
    const tab = tabFor(calc)
    if (tab === "yearly") setYearlyAverages(rows)
    else setSemesterAverages(rows)
    setActiveTab(tab)
    setLastCalculatorTab(tab)
    addNotification(`Loaded "${calc.name}".`, "success")
  }

  // Load saved calculations
  const loadSavedCalculations = async () => {
    try {
      setSavedCalculations(toList(await gpaApi.list()))
    } catch (error) {
      addNotification(errorMessage(error, "Could not load your saved calculations."), "error")
    }
  }

  // Load statistics
  const loadStatistics = async () => {
    try {
      setStatistics(await gpaApi.statistics())
    } catch (error) {
      addNotification(errorMessage(error, "Could not load your statistics."), "error")
    }
  }

  // Save user input state to database
  const saveInputState = async () => {
    setInputSaving(true)
    try {
      // Always save the current tab and data state
      await gpaApi.saveInputState(activeTab, semesterAverages, yearlyAverages)
    } catch (error) {
      console.error("Failed to save input state:", error)
    } finally {
      setInputSaving(false)
    }
  }

  // Load user input state from database
  const loadInputState = async () => {
    try {
      const data = await gpaApi.getInputState()
      if (data) {
        // Restore active tab
        if (data.active_tab) {
          setActiveTab(data.active_tab)
        }
        
        // Restore semester data
        if (data.semester_data && data.semester_data.length > 0) {
          setSemesterAverages(data.semester_data)
        }
        
        // Restore yearly data
        if (data.yearly_data && data.yearly_data.length > 0) {
          setYearlyAverages(data.yearly_data)
        }
      }
    } catch (error) {
      console.error("Failed to load input state:", error)
    } finally {
      // Mark initial load as complete after a short delay
      setTimeout(() => {
        setIsInitialLoad(false)
      }, 1000)
    }
  }

  // Auto-save GPA calculation and update user profile
  const autoSaveGPA = async (gpaData: { totalPeriods: number }) => {
    if (gpaData.totalPeriods === 0) return

    const currentAverages = activeTab === "semester" ? semesterAverages : yearlyAverages
    
    setLoading(true)
    try {
      const periodAverages = currentAverages.filter(avg => avg.period && avg.average).map(avg => ({
        name: avg.period,
        average: parseFloat(avg.average),
        credits: 30 // Default credits per period
      }))

      // Save using the simplified endpoint
      const saveData = await gpaApi.updateUserGpa(activeTab, periodAverages)

      if (saveData?.success) {
        setUserProfile(prev => ({ ...(prev ?? {}), gpa: saveData.overall_gpa }))
        addNotification(`GPA updated to ${saveData.overall_gpa}!`, "success")

        // Refresh statistics, and the saved list: only statistics was
        // reloaded, so a calculation you had just saved was missing from
        // Saved Calculations until the page was reloaded.
        loadStatistics()
        loadSavedCalculations()
      }
    } catch (error) {
      console.error("Auto-save error:", error)
      addNotification("Failed to save GPA calculation", "error")
    } finally {
      setLoading(false)
    }
  }

  // Calculate current GPA from averages
  const calculateCurrentGPA = () => {
    const currentAverages = activeTab === "semester" ? semesterAverages : yearlyAverages
    const validAverages = currentAverages.filter(avg => avg.period && avg.average)

    if (validAverages.length === 0) {
      return { gpa: 0, azerbaijanGrade: 0, totalPeriods: 0, averageScore: 0 }
    }

    let totalGPA = 0
    let totalAzerbaijanGrade = 0

    validAverages.forEach(avg => {
      const average = parseFloat(avg.average)
      let gpaPoints = 0
      let azerbaijanEquivalent = 0

      if (avg.gradeType === 'ufaz') {
        // Convert UFAZ (20-point) to GPA
        const conversion = ufazConversionTable.find(range => average >= range.min && average < range.max)
        if (conversion) {
          gpaPoints = conversion.gpa
          azerbaijanEquivalent = (conversion.azMin + conversion.azMax) / 2 // Average of range
          
          // Linear interpolation for more precise conversion
          if (average >= 11.5 && average < 13.5) {
            gpaPoints = 3.0 + ((average - 11.5) / 2.0) * 0.7
            azerbaijanEquivalent = 70 + ((average - 11.5) / 2.0) * 10
          } else if (average >= 10 && average < 11.5) {
            gpaPoints = 2.0 + ((average - 10) / 1.5) * 1.0
            azerbaijanEquivalent = 50 + ((average - 10) / 1.5) * 20
          }
        }
      } else if (avg.gradeType === 'azerbaijan') {
        // Convert Azerbaijan (100-point) to GPA
        azerbaijanEquivalent = average
        if (average >= 90) gpaPoints = 4.0
        else if (average >= 80) gpaPoints = 3.7
        else if (average >= 70) gpaPoints = 3.0
        else if (average >= 60) gpaPoints = 2.7
        else if (average >= 50) gpaPoints = 2.0
        else gpaPoints = 0.0
      } else if (avg.gradeType === 'gpa') {
        // Direct GPA input
        gpaPoints = average
        // Convert GPA back to Azerbaijan scale
        if (gpaPoints >= 3.85) azerbaijanEquivalent = 95
        else if (gpaPoints >= 3.7) azerbaijanEquivalent = 85
        else if (gpaPoints >= 3.0) azerbaijanEquivalent = 75
        else if (gpaPoints >= 2.7) azerbaijanEquivalent = 65
        else if (gpaPoints >= 2.0) azerbaijanEquivalent = 55
        else azerbaijanEquivalent = Math.max(0, gpaPoints * 25)
      }

      totalGPA += gpaPoints
      totalAzerbaijanGrade += azerbaijanEquivalent
    })

    const finalGPA = totalGPA / validAverages.length
    const finalAzerbaijanGrade = totalAzerbaijanGrade / validAverages.length
    const averageScore = validAverages.reduce((sum, avg) => sum + parseFloat(avg.average), 0) / validAverages.length

    const result = {
      gpa: Math.round(finalGPA * 1000) / 1000,
      azerbaijanGrade: Math.round(finalAzerbaijanGrade * 10) / 10,
      totalPeriods: validAverages.length,
      averageScore: Math.round(averageScore * 100) / 100,
    }

    return result
  }

  // Average management functions
  const addAverage = () => {
    const currentAverages = activeTab === "semester" ? semesterAverages : yearlyAverages
    const setCurrentAverages = activeTab === "semester" ? setSemesterAverages : setYearlyAverages
    
    const newPeriod = activeTab === "semester" ? `Semester ${currentAverages.length + 1}` : `Year ${currentAverages.length + 1}`
    setCurrentAverages([...currentAverages, { 
      id: Date.now(), 
      period: newPeriod, 
      average: "", 
      gradeType: "ufaz"
    }])
  }

  const removeAverage = (id: number) => {
    const currentAverages = activeTab === "semester" ? semesterAverages : yearlyAverages
    const setCurrentAverages = activeTab === "semester" ? setSemesterAverages : setYearlyAverages
    
    const newAverages = currentAverages.filter(avg => avg.id !== id)
    setCurrentAverages(newAverages)
  }

  const updateAverage = (id: number, field: 'period' | 'average' | 'gradeType', value: string) => {
    const currentAverages = activeTab === "semester" ? semesterAverages : yearlyAverages
    const setCurrentAverages = activeTab === "semester" ? setSemesterAverages : setYearlyAverages
    
    const newAverages = currentAverages.map(avg => {
      if (avg.id === id) {
        return { ...avg, [field]: value }
      }
      return avg
    })
    setCurrentAverages(newAverages)
  }

  // Trigger auto-save when GPA changes (with better conditions)
  const triggerAutoSave = (gpaData: { totalPeriods: number; gpa: number }) => {
    // Only save if we have meaningful data and a valid GPA
    if (gpaData.totalPeriods > 0 && gpaData.gpa > 0) {
      // Debounce auto-save to avoid too many API calls
      const timeoutId = setTimeout(() => {
        // Double-check conditions before saving
        const currentAverages = activeTab === "semester" ? semesterAverages : yearlyAverages
        const validAverages = currentAverages.filter(avg => avg.period && avg.average)
        
        if (validAverages.length > 0) {
          autoSaveGPA(gpaData)
        }
      }, 2000) // Increased to 2 seconds
      
      return () => clearTimeout(timeoutId)
    }
  }

  // Reset calculator
  const resetCalculator = () => {
    const setCurrentAverages = activeTab === "semester" ? setSemesterAverages : setYearlyAverages
    setCurrentAverages([
      { id: Date.now(), period: "", average: "", gradeType: "ufaz" }
    ])
  }

  // Get GPA status
  const getGpaStatus = (gpa: number) => {
    if (gpa >= 3.7) return { status: "Excellent", color: "text-green-600", bgColor: "bg-green-50" }
    if (gpa >= 3.0) return { status: "Good", color: "text-blue-600", bgColor: "bg-blue-50" }
    if (gpa >= 2.0) return { status: "Satisfactory", color: "text-yellow-600", bgColor: "bg-yellow-50" }
    if (gpa >= 1.0) return { status: "Poor", color: "text-orange-600", bgColor: "bg-orange-50" }
    return { status: "Failing", color: "text-red-600", bgColor: "bg-red-50" }
  }

  // Get letter grade for display
  const getLetterGrade = (gpa: number) => {
    if (gpa >= 3.85) return "A+"
    else if (gpa >= 3.7) return "A"
    else if (gpa >= 3.3) return "A-"
    else if (gpa >= 3.0) return "B+"
    else if (gpa >= 2.7) return "B"
    else if (gpa >= 2.3) return "B-"
    else if (gpa >= 2.0) return "C+"
    else if (gpa >= 1.7) return "C"
    else if (gpa >= 1.0) return "D"
    else return "F"
  }

  // Load data on mount
  useEffect(() => {
    loadUserData()
    loadSavedCalculations()
    loadStatistics()
    loadInputState() // Load saved input state
  }, [])

  // Auto-save when averages change (debounced)
  useEffect(() => {
    // Skip if still in initial load
    if (isInitialLoad) return
    
    // Only trigger if there are actual valid averages to save
    const currentAverages = activeTab === "semester" ? semesterAverages : yearlyAverages
    const hasValidAverages = currentAverages.some(avg => avg.period && avg.average)
    
    if (hasValidAverages) {
      const gpaData = calculateCurrentGPA()
      const cleanup = triggerAutoSave(gpaData)
      return cleanup
    }
  }, [semesterAverages, yearlyAverages, isInitialLoad]) // Added isInitialLoad dependency

  // Save input state when data changes (debounced) - only on actual data changes
  useEffect(() => {
    // Skip if still in initial load
    if (isInitialLoad) return
    
    // Only save if there's actual input data
    const hasData = 
      semesterAverages.some(avg => avg.period.trim() || avg.average) || 
      yearlyAverages.some(avg => avg.period.trim() || avg.average)
    
    if (hasData) {
      const timeoutId = setTimeout(() => {
        saveInputState()
      }, 3000) // Increased to 3 seconds for better debouncing
      
      return () => clearTimeout(timeoutId)
    }
  }, [semesterAverages, yearlyAverages, isInitialLoad]) // Added isInitialLoad dependency

  // Save input state immediately when tab changes (without debounce)
  useEffect(() => {
    // Skip if still in initial load
    if (isInitialLoad) return
    
    // Save tab state immediately when changing tabs
    saveInputState()
  }, [activeTab, isInitialLoad]) // Added isInitialLoad dependency

  // Clear notifications (removed error/success clearing as we now use notifications)

  const gpaData = calculateCurrentGPA()
  const gpaStatus = getGpaStatus(gpaData.gpa)

  return (
    <>
      <Helmet>
        <title>Ufazien | GPA Calculator</title>
        <meta name="description" content="Calculate and track your GPA with Ufazien's GPA Calculator." />
      </Helmet>
      <div className="min-h-screen bg-gray-50 flex">
        {/* Sidebar */}
        <SideBar
          isSidebarOpen={isSidebarOpen}
          setIsSidebarOpen={setIsSidebarOpen}
        pageTitle="GPA Calculator"
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
              <button
                onClick={() => setShowConversionTable(true)}
                className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <Info className="w-4 h-4" />
                <span className="hidden sm:inline">Grade Scale</span>
              </button>
              {userProfile?.gpa && (
                <div className="flex items-center gap-2 px-4 py-2 bg-blue-50 rounded-lg">
                  <Award className="w-4 h-4 text-blue-600" />
                  <span className="text-sm font-medium text-blue-700">
                    Current GPA: {userProfile.gpa}
                  </span>
                </div>
              )}
            </div>
          </div>
        </header>

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

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          {/* Header Section */}
          <div className="mb-8">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6">
              <div>
                <h1 className="text-3xl font-bold text-gray-900 mb-2">UFAZ GPA Calculator</h1>
                <p className="text-gray-600">Calculate your overall GPA by entering semester or yearly averages using UFAZ's French grading system</p>
                {gpaData.totalPeriods > 0 && (
                  <div className="mt-2 flex items-center gap-2 text-sm text-green-600">
                    <CheckCircle className="w-4 h-4" />
                    <span>Your GPA is automatically saved and updated</span>
                  </div>
                )}
                <div className="mt-2 flex items-center gap-2 text-sm text-blue-600">
                  <Save className="w-4 h-4" />
                  <span>Your inputs are automatically saved and will be restored when you return</span>
                </div>
              </div>
              <div className="flex items-center gap-2 mt-4 sm:mt-0">
                <Calculator className="w-8 h-8 text-blue-600" />
              </div>
            </div>

            {/* UFAZ System Info */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
              <div className="flex items-start gap-3">
                <Info className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                <div>
                  <h3 className="font-medium text-blue-900 mb-1">UFAZ French Grading System</h3>
                  <p className="text-blue-700 text-sm">
                    Enter your semester or yearly averages to calculate your overall GPA. The calculator automatically converts between 
                    UFAZ 20-point scale, Azerbaijan 100-point system, and standard 4.0 GPA scale.
                  </p>
                  <div className="mt-2 text-xs text-blue-600">
                    <span className="font-medium">Scale:</span> Perfect (16-20), Excellent (13.5-16), Good (11.5-13.5), Enough (10-11.5), Fail (0-10)
                  </div>
                </div>
              </div>
            </div>

            {/* Tab Navigation */}
            <div className="flex border-b border-gray-200 mb-6">
              <button
                onClick={() => { setActiveTab("semester"); setLastCalculatorTab("semester") }}
                className={`px-4 py-2 font-medium transition-colors ${
                  activeTab === "semester" 
                    ? "text-blue-600 border-b-2 border-blue-600" 
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                <Calendar className="w-4 h-4 inline mr-2" />
                Semester-based
              </button>
              <button
                onClick={() => { setActiveTab("yearly"); setLastCalculatorTab("yearly") }}
                className={`px-4 py-2 font-medium transition-colors ${
                  activeTab === "yearly" 
                    ? "text-blue-600 border-b-2 border-blue-600" 
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                <Clock className="w-4 h-4 inline mr-2" />
                Yearly Average
              </button>
              <button
                onClick={() => setActiveTab("history")}
                className={`px-4 py-2 font-medium transition-colors ${
                  activeTab === "history" 
                    ? "text-blue-600 border-b-2 border-blue-600" 
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                <BarChart3 className="w-4 h-4 inline mr-2" />
                Statistics & Saved
              </button>
            </div>
          </div>

          {/* Average Input Section */}
          {(activeTab === "semester" || activeTab === "yearly") && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Average Input */}
              <div className="lg:col-span-2">
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-semibold text-gray-900">
                      {activeTab === "semester" ? "Semester Averages" : "Yearly Averages"}
                    </h2>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={resetCalculator}
                        className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                        title="Reset All"
                      >
                        <RotateCcw className="w-4 h-4" />
                      </button>
                      {loading && (
                        <div className="flex items-center gap-2 text-blue-600">
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                          <span className="text-sm">Saving GPA...</span>
                        </div>
                      )}
                      {inputSaving && (
                        <div className="flex items-center gap-2 text-green-600">
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-green-600"></div>
                          <span className="text-sm">Saving inputs...</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Average Input Forms */}
                  <div className="space-y-4">
                    {(activeTab === "semester" ? semesterAverages : yearlyAverages).map((average, index) => (
                      <AverageRow
                        key={average.id}
                        average={average}
                        index={index}
                        onUpdate={updateAverage}
                        onRemove={removeAverage}
                        canRemove={(activeTab === "semester" ? semesterAverages : yearlyAverages).length > 1}
                        activeTab={activeTab}
                      />
                    ))}
                  </div>

                  <button
                    onClick={addAverage}
                    className="w-full mt-4 py-3 border-2 border-dashed border-gray-300 rounded-lg text-gray-600 hover:border-blue-400 hover:text-blue-600 transition-colors flex items-center justify-center gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    Add {activeTab === "semester" ? "Semester" : "Year"}
                  </button>
                </div>
              </div>

              {/* Results Section */}
              <div className="space-y-6">
                {/* GPA Display */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">GPA Results</h3>

                  <div className="text-center mb-6">
                    <div className="text-4xl font-bold text-blue-600 mb-2">{gpaData.gpa}</div>
                    <div
                      className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium ${gpaStatus.bgColor} ${gpaStatus.color}`}
                    >
                      {gpaData.gpa >= 2.0 ? <CheckCircle className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                      {gpaStatus.status}
                    </div>
                    <div className="mt-2 text-lg font-semibold text-gray-700">
                      Letter Grade: {getLetterGrade(gpaData.gpa)}
                    </div>
                    
                    {/* Show comparison with current saved GPA */}
                    {userProfile?.gpa && userProfile.gpa !== gpaData.gpa && gpaData.totalPeriods > 0 && (
                      <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                        <div className="text-sm text-yellow-800">
                          <div className="flex items-center justify-center gap-2">
                            <span>Current GPA: {userProfile.gpa}</span>
                            <span>→</span>
                            <span className="font-semibold">New GPA: {gpaData.gpa}</span>
                          </div>
                          <div className="text-xs mt-1">
                            {gpaData.gpa > Number(userProfile.gpa) ? "⬆ Improvement!" : "⬇ Lower than current"}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Overall GPA</span>
                      <span className="font-medium text-blue-600">{gpaData.gpa}/4.0</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Azerbaijan Scale</span>
                      <span className="font-medium text-green-600">{gpaData.azerbaijanGrade}/100</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Total Periods</span>
                      <span className="font-medium">{gpaData.totalPeriods}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Average Score</span>
                      <span className="font-medium">{gpaData.averageScore}</span>
                    </div>
                  </div>
                </div>

                {/* Quick Stats */}
                {statistics && (
                  <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Your Statistics</h3>
                    <div className="space-y-3 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Highest GPA</span>
                        <span className="font-medium text-green-600">{statistics.statistics?.highest_gpa || "N/A"}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Average GPA</span>
                        <span className="font-medium">{statistics.statistics?.average_gpa || "N/A"}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Total Calculations</span>
                        <span className="font-medium">{statistics.statistics?.total_calculations || 0}</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* UFAZ Grade Scale */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">UFAZ Grade Scale</h3>
                  <div className="space-y-2 text-sm">
                    {ufazConversionTable.map((range, index) => (
                      <div key={index} className="flex justify-between items-center">
                        <span>{range.status} ({range.min}-{range.max})</span>
                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                          range.status === "Perfect" || range.status === "Excellent" ? "bg-green-100 text-green-700" :
                          range.status === "Good" ? "bg-blue-100 text-blue-700" :
                          range.status === "Enough" ? "bg-yellow-100 text-yellow-700" :
                          "bg-red-100 text-red-700"
                        }`}>
                          {range.letter} ({range.gpa})
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Statistics Tab */}
          {activeTab === "history" && (
            <div className="space-y-6">
              {statistics && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                    <div className="flex items-center gap-3">
                      <Award className="w-8 h-8 text-green-600" />
                      <div>
                        <div className="text-2xl font-bold text-gray-900">{statistics.statistics?.highest_gpa || "0.00"}</div>
                        <div className="text-sm text-gray-600">Highest GPA</div>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                    <div className="flex items-center gap-3">
                      <BarChart3 className="w-8 h-8 text-blue-600" />
                      <div>
                        <div className="text-2xl font-bold text-gray-900">{statistics.statistics?.average_gpa || "0.00"}</div>
                        <div className="text-sm text-gray-600">Average GPA</div>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                    <div className="flex items-center gap-3">
                      <Calculator className="w-8 h-8 text-purple-600" />
                      <div>
                        <div className="text-2xl font-bold text-gray-900">{statistics.statistics?.total_calculations || 0}</div>
                        <div className="text-sm text-gray-600">Total Calculations</div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Saved Calculations */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">Saved Calculations</h3>
                  <button
                    onClick={saveNamedCalculation}
                    className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    Save current
                  </button>
                </div>
                {savedCalculations.length === 0 ? (
                  <p className="text-gray-500 text-center py-8">
                    Nothing saved yet. Enter your marks and choose Save current to keep a copy.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {savedCalculations.map((calc) => (
                      <div
                        key={calc.id}
                        className="flex items-center gap-2 p-4 border border-gray-200 rounded-lg hover:border-blue-400 hover:bg-blue-50 transition-colors"
                      >
                        <button
                          onClick={() => loadCalculation(calc)}
                          className="flex-1 text-left flex items-center justify-between"
                        >
                          <div>
                            <h4 className="font-medium text-gray-900 flex items-center gap-2">
                              {calc.name}
                              {/* One of these exists per type and is rewritten
                                  on every change, so it is not a snapshot
                                  anyone chose to keep. */}
                              {calc.name?.startsWith("Auto-saved") && (
                                <span className="text-xs font-normal px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                                  automatic
                                </span>
                              )}
                            </h4>
                            <p className="text-sm text-gray-500">
                              {calc.calculation_type} • {calc.course_count || 0} periods
                            </p>
                          </div>
                          <div className="text-right mr-2">
                            <div className="text-2xl font-bold text-blue-600">{calc.overall_gpa}</div>
                            <div className="text-xs text-gray-500">GPA</div>
                          </div>
                        </button>
                        <button
                          onClick={() => deleteCalculation(calc)}
                          className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors shrink-0"
                          aria-label={`Delete ${calc.name}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Conversion Table Modal */}
      {showConversionTable && (
        <ConversionTableModal
          onClose={() => setShowConversionTable(false)}
          ufazConversionTable={ufazConversionTable}
        />
      )}
    </div>
  </>
  )
}
