import { useState } from "react"
import { Search, Play, Users, Eye, Calendar, Globe, Heart, HeartOff } from "lucide-react"
import Pagination from "../../../components/ui/Pagination"

export default function PublicSchemasTab({ 
  schemas, 
  useSchema, 
  saveSchema, 
  unsaveSchema, 
  searchTerm, 
  setSearchTerm,
  pagination,
  onPageChange 
}) {
  const [selectedSchema, setSelectedSchema] = useState(null)

  const handleUseSchema = async (schemaId) => {
    await useSchema(schemaId)
  }

  const handleSaveSchema = async (schemaId) => {
    await saveSchema(schemaId)
  }

  const handleUnsaveSchema = async (schemaId) => {
    await unsaveSchema(schemaId)
  }

  const handleViewSchema = (schema) => {
    setSelectedSchema(schema)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Public Schemas</h2>
          <p className="text-gray-600 mt-1">Discover and use schemas created by the community</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-sm text-gray-500">
            {schemas.length} schema{schemas.length !== 1 ? 's' : ''} found
          </div>
        </div>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search public schemas..."
          className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      {schemas.length === 0 ? (
        <div className="text-center py-12">
          <div className="bg-gray-100 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
            <Globe className="w-8 h-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            {searchTerm ? "No Schemas Found" : "No Public Schemas"}
          </h3>
          <p className="text-gray-600">
            {searchTerm 
              ? "Try adjusting your search terms or browse all available schemas."
              : "Be the first to publish a schema for the community to use!"
            }
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {schemas.map((schema) => (
            <div key={schema.id} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow flex flex-col h-full">
              <div className="flex-grow">
                {/* Schema Header */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="font-semibold text-gray-900 truncate">{schema.name}</h3>
                      <Globe className="w-4 h-4 text-green-600" title="Public Schema" />
                    </div>
                    {schema.description && (
                      <p className="text-sm text-gray-600 line-clamp-2">{schema.description}</p>
                    )}
                  </div>
                </div>

                {/* Schema Stats */}
                <div className="space-y-3 mb-4">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">Creator</span>
                    <span className="font-medium">{schema.creator_full_name || 'Anonymous'}</span>
                  </div>
                  
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">Fields</span>
                    <span className="font-medium">{schema.fields?.length || 0}</span>
                  </div>
                  
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">Uses</span>
                    <span className="font-medium flex items-center gap-1">
                      <Users className="w-3 h-3" />
                      {schema.usage_count || 0}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">Published</span>
                    <span className="font-medium">
                      {new Date(schema.created_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>

                {/* Schema Fields Preview */}
                {schema.fields && schema.fields.length > 0 && (
                  <div className="mb-4">
                    <div className="text-xs font-medium text-gray-700 mb-2">Fields:</div>
                    <div className="space-y-1">
                      {schema.fields.slice(0, 3).map((field, index) => (
                        <div key={index} className="flex items-center justify-between text-xs">
                          <span className="text-gray-600 truncate">{field.name}</span>
                          <span className="text-gray-500 ml-2">×{field.weight}</span>
                        </div>
                      ))}
                      {schema.fields.length > 3 && (
                        <div className="text-xs text-gray-500">
                          +{schema.fields.length - 3} more...
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2 mt-auto">
                <button
                  onClick={() => handleUseSchema(schema.id)}
                  className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
                >
                  <Play className="w-4 h-4" />
                  Use Schema
                </button>
                
                {schema.is_saved_by_user ? (
                  <button
                    onClick={() => handleUnsaveSchema(schema.id)}
                    className="flex items-center justify-center gap-2 px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm"
                    title="Remove from Saved"
                  >
                    <HeartOff className="w-4 h-4" />
                  </button>
                ) : (
                  <button
                    onClick={() => handleSaveSchema(schema.id)}
                    className="flex items-center justify-center gap-2 px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm"
                    title="Save Schema"
                  >
                    <Heart className="w-4 h-4" />
                  </button>
                )}
                
                <button
                  onClick={() => handleViewSchema(schema)}
                  className="flex items-center justify-center gap-2 px-3 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-sm"
                  title="View Details"
                >
                  <Eye className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Schema Details Modal */}
      {selectedSchema && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-2xl max-h-96 overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">{selectedSchema.name}</h3>
              <button
                onClick={() => setSelectedSchema(null)}
                className="p-2 text-gray-400 hover:text-gray-600 rounded-lg"
              >
                ×
              </button>
            </div>

            {selectedSchema.description && (
              <div className="mb-4">
                <h4 className="font-medium text-gray-900 mb-2">Description</h4>
                <p className="text-gray-600">{selectedSchema.description}</p>
              </div>
            )}

            <div className="mb-4">
              <h4 className="font-medium text-gray-900 mb-2">Schema Information</h4>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-600">Creator:</span>
                  <span className="ml-2 font-medium">{selectedSchema.creator_full_name || 'Anonymous'}</span>
                </div>
                <div>
                  <span className="text-gray-600">Published:</span>
                  <span className="ml-2 font-medium">{new Date(selectedSchema.created_at).toLocaleDateString()}</span>
                </div>
                <div>
                  <span className="text-gray-600">Total Uses:</span>
                  <span className="ml-2 font-medium">{selectedSchema.usage_count || 0}</span>
                </div>
                <div>
                  <span className="text-gray-600">Fields:</span>
                  <span className="ml-2 font-medium">{selectedSchema.fields?.length || 0}</span>
                </div>
              </div>
            </div>

            {selectedSchema.fields && selectedSchema.fields.length > 0 && (
              <div className="mb-6">
                <h4 className="font-medium text-gray-900 mb-2">Fields</h4>
                <div className="space-y-2">
                  {selectedSchema.fields.map((field, index) => (
                    <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                      <span className="text-gray-700">{field.name}</span>
                      <span className="text-gray-500 text-sm">Weight: {field.weight}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => setSelectedSchema(null)}
                className="flex-1 px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Close
              </button>
              <button
                onClick={() => {
                  handleUseSchema(selectedSchema.id)
                  setSelectedSchema(null)
                }}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Use This Schema
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Pagination */}
      {pagination && pagination.count > 20 && (
        <Pagination
          currentPage={pagination.current_page}
          totalPages={pagination.total_pages}
          totalCount={pagination.count}
          onPageChange={onPageChange}
          itemsPerPage={20}
        />
      )}
    </div>
  )
}
