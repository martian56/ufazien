import { useState } from "react"
import { Plus, Trash2, Save, RotateCcw, Info } from "lucide-react"

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
}) {
  // Add field to new schema
  const addNewField = () => {
    setNewSchemaFields([...newSchemaFields, { name: "", weight: 1 }])
  }

  // Remove field from new schema
  const removeNewField = (index) => {
    if (newSchemaFields.length > 1) {
      setNewSchemaFields(newSchemaFields.filter((_, i) => i !== index))
    }
  }

  // Update new field
  const updateNewField = (index, field, value) => {
    const updated = [...newSchemaFields]
    updated[index][field] = value
    setNewSchemaFields(updated)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
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
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-6">Create New Schema</h2>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Schema Name</label>
              <input
                type="text"
                value={newSchemaName}
                onChange={(e) => setNewSchemaName(e.target.value)}
                placeholder="e.g., L2 Computer Science Semester 1"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Description (Optional)</label>
              <textarea
                value={newSchemaDescription}
                onChange={(e) => setNewSchemaDescription(e.target.value)}
                placeholder="Describe this schema..."
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                    <div className="w-24">
                      <input
                        type="number"
                        value={field.weight}
                        onChange={(e) => updateNewField(index, "weight", parseFloat(e.target.value) || 1)}
                        placeholder="Weight"
                        min="0.1"
                        step="0.1"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-xl font-semibold text-gray-900">{currentSchema.schema_name}</h2>
                  {currentSchema.schema_description && (
                    <p className="text-gray-600 text-sm mt-1">{currentSchema.schema_description}</p>
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
                {currentSchema.field_grades?.map((fieldGrade) => (
                  <div key={fieldGrade.id} className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg">
                    <div className="flex-1">
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        {fieldGrade.field_name}
                      </label>
                      <div className="text-xs text-gray-500">
                        Weight: {fieldGrade.field_weight}
                      </div>
                    </div>
                    <div className="w-32">
                      <input
                        type="number"
                        value={fieldGrade.grade || ""}
                        onChange={(e) => updateGrade(fieldGrade.id, parseFloat(e.target.value) || null)}
                        placeholder="0-20"
                        min="0"
                        max="20"
                        step="0.1"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Results Section */}
          <div className="space-y-6">
            {/* Average Display */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Your Average</h3>
              <div className="text-center">
                <div className="text-4xl font-bold text-blue-600 mb-2">
                  {calculateWeightedAverage()}
                </div>
                <div className="text-gray-600 mb-3">Weighted Average</div>
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
            </div>

            {/* Grade Scale */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">UFAZ Grade Scale</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>Excellent (13.5-20)</span>
                  <span className="font-medium">Excellent</span>
                </div>
                <div className="flex justify-between">
                  <span>Good (11.5-13.4)</span>
                  <span className="font-medium">Good</span>
                </div>
                <div className="flex justify-between">
                  <span>Enough (10-11.4)</span>
                  <span className="font-medium">Enough</span>
                </div>
                <div className="flex justify-between">
                  <span>Fail (0-9.9)</span>
                  <span className="font-medium">Fail</span>
                </div>
              </div>
            </div>

            {/* Quick Stats */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Statistics</h3>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-600">Total Fields</span>
                  <span className="font-medium">{currentSchema.field_grades?.length || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Completed</span>
                  <span className="font-medium">
                    {currentSchema.field_grades?.filter(fg => fg.grade !== null && fg.grade !== undefined).length || 0}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Highest Score</span>
                  <span className="font-medium">
                    {currentSchema.field_grades?.length ? 
                      Math.max(...currentSchema.field_grades
                        .filter(fg => fg.grade !== null && fg.grade !== undefined)
                        .map(fg => fg.grade)
                      ).toFixed(1) || "0" : "0"}
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
