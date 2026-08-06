import { useState } from "react"
import { Play, Share, Trash2, Edit3, Lock, Globe, Users, Calendar, Heart, HeartOff, User } from "lucide-react"
import Pagination from "../../../components/ui/Pagination"

/** Mirrors AverageSchemaSerializer. */
interface Schema {
  id: number
  name: string
  description?: string
  creator?: number
  creator_full_name?: string
  creator_username?: string
  is_public?: boolean
  is_saved_by_user?: boolean
  usage_count?: number
  fields?: { name: string; weight: number }[]
  created_at?: string
  updated_at?: string
}

interface MySchemasTabProps {
  schemas: Schema[]
  useSchema: (schemaId: number) => Promise<void> | void
  publishSchema: (schemaId: number) => Promise<void> | void
  loadMySchemas: () => Promise<void> | void
  unsaveSchema: (schemaId: number) => Promise<void> | void
  deleteSchema: (schemaId: number) => Promise<void> | void
  /** The shape AverageCalculator actually builds. */
  pagination?: {
    count: number
    current_page: number
    total_pages: number
    next?: string | null
    previous?: string | null
  } | null
  onPageChange: (page: number) => void
}


export default function MySchemasTab({
  schemas,
  useSchema,
  publishSchema,
  loadMySchemas,
  unsaveSchema,
  deleteSchema,
  pagination,
  onPageChange,
}: MySchemasTabProps) {
  const [selectedSchema, setSelectedSchema] = useState<Schema | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<number | null>(null)

  const handleUseSchema = async (schemaId: number) => {
    await useSchema(schemaId)
  }

  const handlePublishSchema = async (schemaId: number) => {
    await publishSchema(schemaId)
  }

  const handleDeleteSchema = async (schemaId: number) => {
    await deleteSchema(schemaId)
    setShowDeleteConfirm(null)
  }

  const handleUnsaveSchema = async (schemaId: number) => {
    await unsaveSchema(schemaId)
  }

  // Check if schema is owned by current user (can be published/deleted) vs saved from public
  const isOwnedSchema = (schema: Schema) => {
    // A schema is owned if it's not saved from someone else
    // We can check if creator_username exists and it's the current user's schema
    return !schema.is_saved_by_user
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">My Schemas</h2>
          <p className="text-gray-600 mt-1">Manage your custom calculation schemas</p>
        </div>
        <div className="text-sm text-gray-500">
          {schemas.length} schema{schemas.length !== 1 ? 's' : ''}
        </div>
      </div>

      {schemas.length === 0 ? (
        <div className="text-center py-12">
          <div className="bg-gray-100 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
            <Edit3 className="w-8 h-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No Schemas Created</h3>
          <p className="text-gray-600 mb-6">Create your first schema to start organizing your grades.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {schemas.map((schema) => (
            <div key={schema.id} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow flex flex-col h-full">
              {/* Schema Header */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="font-semibold text-gray-900 truncate">{schema.name}</h3>
                    {isOwnedSchema(schema) ? (
                      <>
                        {schema.is_public ? (
                          <span title="Public"><Globe className="w-4 h-4 text-green-600" /></span>
                        ) : (
                          <span title="Private"><Lock className="w-4 h-4 text-gray-400" /></span>
                        )}
                        <span title="Created by you"><User className="w-4 h-4 text-blue-600" /></span>
                      </>
                    ) : (
                      <>
                        <span title="Saved schema"><Heart className="w-4 h-4 text-red-600" /></span>
                        <span className="text-xs text-gray-500">by {schema.creator_full_name}</span>
                      </>
                    )}
                  </div>
                  {schema.description && (
                    <p className="text-sm text-gray-600 line-clamp-2">{schema.description}</p>
                  )}
                </div>
              </div>

              {/* Content Area - will grow to push buttons to bottom */}
              <div className="flex-grow">
                {/* Schema Details */}
                <div className="space-y-3 mb-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">Fields</span>
                  <span className="font-medium">{schema.fields?.length || 0}</span>
                </div>
                
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">Created</span>
                  <span className="font-medium">
                    {schema.created_at ? new Date(schema.created_at).toLocaleDateString() : "-"}
                  </span>
                </div>

                {schema.is_public && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">Uses</span>
                    <span className="font-medium">{schema.usage_count || 0}</span>
                  </div>
                )}
              </div>

              {/* Schema Fields Preview */}
              {schema.fields && schema.fields.length > 0 && (
                <div className="mb-4">
                  <div className="text-xs font-medium text-gray-700 mb-2">Fields:</div>
                  <div className="space-y-1">
                    {(schema.fields ?? []).slice(0, 3).map((field, index) => (
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
                  Use
                </button>
                
                {isOwnedSchema(schema) ? (
                  <>
                    {!schema.is_public && (
                      <button
                        onClick={() => handlePublishSchema(schema.id)}
                        className="flex items-center justify-center gap-2 px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm"
                        title="Make Public"
                      >
                        <Share className="w-4 h-4" />
                      </button>
                    )}

                    <button
                      onClick={() => setShowDeleteConfirm(schema.id)}
                      className="flex items-center justify-center gap-2 px-3 py-2 text-red-600 border border-red-300 rounded-lg hover:bg-red-50 transition-colors text-sm"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => handleUnsaveSchema(schema.id)}
                    className="flex items-center justify-center gap-2 px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm"
                    title="Remove from Saved"
                  >
                    <HeartOff className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Delete Schema</h3>
            <p className="text-gray-600 mb-6">
              Are you sure you want to delete this schema? This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteConfirm(null)}
                className="flex-1 px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeleteSchema(showDeleteConfirm)}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              >
                Delete
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
