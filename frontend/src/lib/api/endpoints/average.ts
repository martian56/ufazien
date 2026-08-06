import { api } from '../client'
import type { Paginated } from '../types'

/**
 * Weighted-average schemas.
 *
 * The calculator page built its own axios instance on
 * import.meta.env.VITE_API_URL and read the token out of localStorage by
 * hand, so it had none of the shared client's refresh-on-401: a session that
 * expired mid-edit showed "Please log in to continue" and lost the grade the
 * user had just typed.
 *
 * Field names below mirror average/serializers.py exactly. `grade` arrives as
 * a string on some responses and a number on others, because DRF renders a
 * DecimalField as a string while the write path echoes back what was sent.
 */

export interface SchemaField {
  id?: number
  name: string
  weight: number
  order?: number
}

export interface Schema {
  id: number
  name: string
  description?: string
  creator?: number
  creator_full_name?: string
  creator_username?: string
  is_public?: boolean
  is_saved_by_user?: boolean
  usage_count?: number
  created_at?: string
  updated_at?: string
  fields?: SchemaField[]
}

export interface FieldGrade {
  id: number
  field?: number
  field_id?: number
  field_name?: string
  field_weight?: number
  grade?: number | string | null
}

/** One user's marks against one schema. */
export interface SchemaGrades {
  id: number
  schema?: Schema
  current_schema?: boolean
  field_grades?: FieldGrade[]
  weighted_average?: number | string | null
  created_at?: string
  updated_at?: string
}

/** What the create form sends; weights are strings straight off the inputs. */
export interface NewSchema {
  name: string
  description?: string
  fields: { name: string; weight: string }[]
}

export const averageApi = {
  mySchemas: (page = 1) =>
    api.get<Paginated<Schema>>(`/average/my-schemas/?page=${page}`),

  publicSchemas: (page = 1, search = '') => {
    const query = new URLSearchParams({ page: String(page) })
    if (search) query.set('search', search)
    return api.get<Paginated<Schema>>(`/average/public-schemas/?${query}`)
  },

  create: (schema: NewSchema) => api.post<Schema>('/average/create-schema/', schema),

  publish: (schemaId: number) => api.post(`/average/publish-schema/${schemaId}/`),

  /** Makes this schema the active one and returns the user's grades for it. */
  use: (schemaId: number) => api.post<SchemaGrades>(`/average/use-schema/${schemaId}/`),

  /** 404s when the user has not picked a schema yet, which is not an error. */
  current: () => api.get<SchemaGrades>('/average/current-schema/'),

  /** PUT, not PATCH: the view only accepts PUT and 405s on anything else. */
  updateGrade: (fieldGradeId: number, grade: number | string | null) =>
    api.put<FieldGrade>(`/average/update-grade/${fieldGradeId}/`, { grade }),

  remove: (schemaId: number) => api.delete(`/average/delete-schema/${schemaId}/`),

  save: (schemaId: number) => api.post(`/average/save-schema/${schemaId}/`),

  unsave: (schemaId: number) => api.delete(`/average/unsave-schema/${schemaId}/`),
}

export default averageApi
