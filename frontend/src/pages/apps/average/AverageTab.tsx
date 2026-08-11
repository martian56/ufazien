import { useState, useEffect, useCallback } from "react"
import { Plus, Trash2, Save, RotateCcw, Info } from "lucide-react"

// Debounce utility function
function debounce<A extends unknown[]>(func: (...args: A) => void, delay: number) {
  let timeoutId: ReturnType<typeof setTimeout>
  return (...args: A) => {
    clearTimeout(timeoutId)
    timeoutId = setTimeout(() => func(...args), delay)
  }
}

import type { SchemaField, SchemaGrades } from "../../../lib/api/endpoints/average"
import Spinner from "../../../components/ui/Spinner"

interface AverageTabProps {
  currentSchema: SchemaGrades | null
  updateGrade: (fieldGradeId: number, grade: number | null) => Promise<void> | void
  calculateWeightedAverage: () => number
  loading: boolean
  isCreatingSchema: boolean
  setIsCreatingSchema: (creating: boolean) => void
  newSchemaName: string
  setNewSchemaName: (name: string) => void
  newSchemaDescription: string
  setNewSchemaDescription: (description: string) => void
  newSchemaFields: SchemaField[]
  setNewSchemaFields: (fields: SchemaField[]) => void
  createSchema: () => Promise<void> | void
}

export default function AverageTab({
  currentSchema,
  updateGrade,
  calculateWeightedAverage,
  loading,
  isCreatingSchema,
  setIsCreatingSchema,
  newSchemaName,
  setNewSchemaName,
  newSchemaDescription,
  setNewSchemaDescription,
  newSchemaFields,
  setNewSchemaFields,
  createSchema,
}: AverageTabProps) {
  // State for managing grade updates with debouncing
  const [localGrades, setLocalGrades] = useState<Record<string, string>>({})
  const [pendingUpdates, setPendingUpdates] = useState<Record<string, boolean>>({})

  // Initialize local grades when schema changes
  useEffect(() => {
    if (currentSchema?.field_grades) {
      const grades: Record<string, string> = {}
      currentSchema.field_grades.forEach(fg => {
        // Explicitly handle zero values - only convert null/undefined to empty string
        if (fg.grade === null || fg.grade === undefined) {
          grades[fg.id] = ''
        } else {
          // Keep the actual value, including 0
          grades[fg.id] = String(fg.grade)
        }
      })
      setLocalGrades(grades)
    }
  }, [currentSchema])

  // Debounced update function
  const debouncedUpdateGrade = useCallback(
    debounce((fieldGradeId: number, grade: number | null) => {
      updateGrade(fieldGradeId, grade)
      setPendingUpdates(prev => {
        const updated = { ...prev }
        delete updated[fieldGradeId]
        return updated
      })
    }, 800), // 800ms delay
    [updateGrade]
  )

  // Handle grade input change
  const handleGradeChange = (fieldGradeId: number, value: string) => {
    // Update local state immediately for responsive UI
    setLocalGrades(prev => ({
      ...prev,
      [fieldGradeId]: value
    }))

    // Mark as pending update
    setPendingUpdates(prev => ({
      ...prev,
      [fieldGradeId]: true
    }))

    // Parse the grade value, allowing zero but converting empty string to null
    let grade: number | null = null
    if (value !== '' && value !== null && value !== undefined) {
      const parsed = parseFloat(value)
      if (!isNaN(parsed)) {
        grade = parsed
      }
    }

    // Debounce the API call
    debouncedUpdateGrade(fieldGradeId, grade)
  }

  // Add field to new schema
  const addNewField = () => {
    setNewSchemaFields([...newSchemaFields, { name: "", weight: 1 }])
  }

  // Remove field from new schema
  const removeNewField = (index: number) => {
    if (newSchemaFields.length > 1) {
      setNewSchemaFields(newSchemaFields.filter((_, i) => i !== index))
    }
  }

  // Update new field
  const updateNewField = (index: number, field: "name" | "weight", value: string | number) => {
    const updated = newSchemaFields.map((existing, i) =>
      i === index ? { ...existing, [field]: value } : existing
    )
    setNewSchemaFields(updated)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner size="md" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {!currentSchema && !isCreatingSchema && (
        <div className="text-center py-12">
          <div className="bg-gray-100 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
            <Info className="w-8 h-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No Active Schema</h3>
          <p className="text-gray-600 mb-6">Create a new schema or load one from your saved schemas to start calculating averages.</p>
          <button
            onClick={() => setIsCreatingSchema(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Create New Schema
          </button>
        </div>
      )}

      {isCreatingSchema && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-6">Create New Schema</h2>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Schema Name</label>
              <input
                type="text"
                value={newSchemaName}
                onChange={(e) => setNewSchemaName(e.target.value)}
                placeholder="e.g., L2 Computer Science Semester 1"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Description (Optional)</label>
              <textarea
                value={newSchemaDescription}
                onChange={(e) => setNewSchemaDescription(e.target.value)}
                placeholder="Describe this schema..."
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Fields</label>
              <div className="space-y-3">
                {newSchemaFields.map((field, index) => (
                  <div key={index} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                    <div className="flex-1">
                      <input
                        type="text"
                        value={field.name}
                        onChange={(e) => updateNewField(index, "name", e.target.value)}
                        placeholder="Field name (e.g., Math Midterm Exam)"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                      />
                    </div>
                    <div className="w-24">
                      <input
                        type="number"
                        value={field.weight}
                        onChange={(e) => updateNewField(index, "weight", parseFloat(e.target.value))}
                        placeholder="Weight"
                        min="0.1"
                        step="0.1"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                      />
                    </div>
                    {newSchemaFields.length > 1 && (
                      <button
                        onClick={() => removeNewField(index)}
                        className="p-2 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
              
              <button
                onClick={addNewField}
                className="w-full mt-3 py-2 border-2 border-dashed border-gray-300 rounded-lg text-gray-600 hover:border-blue-400 hover:text-blue-600 transition-colors flex items-center justify-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Add Field
              </button>
            </div>

            <div className="flex gap-3 pt-4">
              <button
                onClick={() => setIsCreatingSchema(false)}
                className="flex-1 px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={createSchema}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Create Schema
              </button>
            </div>
          </div>
        </div>
      )}

      {currentSchema && !isCreatingSchema && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Input Section */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-xl font-semibold text-gray-900">{currentSchema.schema?.name}</h2>
                  {currentSchema.schema?.description && (
                    <p className="text-gray-600 text-sm mt-1">{currentSchema.schema?.description}</p>
                  )}
                </div>
                <button
                  onClick={() => setIsCreatingSchema(true)}
                  className="flex items-center gap-2 px-3 py-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  New Schema
                </button>
              </div>

              <div className="space-y-4">
                {currentSchema.field_grades?.map((fieldGrade, index) => (
                  <div key={fieldGrade.id} className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg border border-gray-100">
                    <div className="flex-1">
                      <label className="block text-sm font-medium text-gray-900 mb-1">
                        {fieldGrade.field_name}
                      </label>
                      <div className="flex items-center gap-2 text-xs text-gray-500">
                        <span>Weight: {fieldGrade.field_weight}</span>
                        {localGrades[fieldGrade.id] !== '' && localGrades[fieldGrade.id] !== null && localGrades[fieldGrade.id] !== undefined && (
                          <span className="text-blue-600">
                            • Contribution: {(Number(localGrades[fieldGrade.id]) * (fieldGrade.field_weight ?? 0)).toFixed(2)}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="w-32">
                      <div className="relative">
                        <input
                          type="number"
                          value={localGrades[fieldGrade.id] !== null && localGrades[fieldGrade.id] !== undefined ? localGrades[fieldGrade.id] : ""}
                          onChange={(e) => handleGradeChange(fieldGrade.id, e.target.value)}
                          placeholder="0-20"
                          min="0"
                          max="20"
                          step="0.1"
                          className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all ${
                            pendingUpdates[fieldGrade.id] ? 'bg-yellow-50 border-yellow-300' : ''
                          }`}
                        />
                        {pendingUpdates[fieldGrade.id] && (
                          <div className="absolute -top-1 -right-1 w-3 h-3 bg-yellow-400 rounded-full animate-pulse"></div>
                        )}
                      </div>
                      {pendingUpdates[fieldGrade.id] && (
                        <div className="mt-1 text-center">
                          <span className="text-xs text-yellow-600">Saving...</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Results Section */}
          <div className="space-y-6">
            {/* Average Display */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Your Average</h3>
              <div className="text-center mb-6">
                <div className="text-4xl font-bold text-blue-600 mb-2">
                  {calculateWeightedAverage()}
                </div>
                <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                  calculateWeightedAverage() >= 13.5 
                    ? 'bg-green-100 text-green-800' 
                    : calculateWeightedAverage() >= 11.5 
                    ? 'bg-blue-100 text-blue-800'
                    : calculateWeightedAverage() >= 10
                    ? 'bg-yellow-100 text-yellow-800'
                    : 'bg-red-100 text-red-800'
                }`}>
                  {calculateWeightedAverage() >= 13.5 
                    ? 'Excellent' 
                    : calculateWeightedAverage() >= 11.5 
                    ? 'Good'
                    : calculateWeightedAverage() >= 10
                    ? 'Enough'
                    : 'Fail'}
                </div>
              </div>
              
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Weighted Average</span>
                  <span className="font-medium text-blue-600">{calculateWeightedAverage()}/20</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Total Fields</span>
                  <span className="font-medium">{currentSchema.field_grades?.length || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Completed</span>
                  <span className="font-medium">{currentSchema.field_grades?.filter(fg => fg.grade !== null && fg.grade !== undefined).length || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Progress</span>
                  <span className="font-medium">{(currentSchema.field_grades?.length ?? 0) > 0 ? Math.round(((currentSchema.field_grades?.filter(fg => fg.grade !== null && fg.grade !== undefined).length || 0) / (currentSchema.field_grades ?? []).length) * 100) : 0}%</span>
                </div>
              </div>
            </div>

            {/* Statistics */}
            {(currentSchema.field_grades?.filter(fg => fg.grade !== null && fg.grade !== undefined).length ?? 0) > 0 && (
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Statistics</h3>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Highest Score</span>
                    <span className="font-medium text-green-600">
                      {Math.max(...(currentSchema.field_grades ?? [])
                        .filter(fg => fg.grade !== null && fg.grade !== undefined)
                        .map(fg => Number(fg.grade))
                      ).toFixed(1)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Lowest Score</span>
                    <span className="font-medium">
                      {Math.min(...(currentSchema.field_grades ?? [])
                        .filter(fg => fg.grade !== null && fg.grade !== undefined)
                        .map(fg => Number(fg.grade))
                      ).toFixed(1)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Average Score</span>
                    <span className="font-medium">
                      {((currentSchema.field_grades ?? [])
                        .filter(fg => fg.grade !== null && fg.grade !== undefined)
                        .reduce((sum, fg) => sum + Number(fg.grade), 0) / 
                        (currentSchema.field_grades ?? []).filter(fg => fg.grade !== null && fg.grade !== undefined).length
                      ).toFixed(1)}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* UFAZ Grade Scale */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">UFAZ Grade Scale</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between items-center">
                  <span>Excellent (13.5-20)</span>
                  <span className="px-2 py-1 rounded text-xs font-medium bg-green-100 text-green-700">
                    Excellent
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span>Good (11.5-13.4)</span>
                  <span className="px-2 py-1 rounded text-xs font-medium bg-blue-100 text-blue-700">
                    Good
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span>Enough (10-11.4)</span>
                  <span className="px-2 py-1 rounded text-xs font-medium bg-yellow-100 text-yellow-700">
                    Enough
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span>Fail (0-9.9)</span>
                  <span className="px-2 py-1 rounded text-xs font-medium bg-red-100 text-red-700">
                    Fail
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
