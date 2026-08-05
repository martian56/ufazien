import { api } from '../client'
import type { Paginated, User } from '../types'

export interface BlogCategory {
  id: number
  name: string
}

export interface BlogTag {
  id: number
  name: string
}

export interface BlogPost {
  id: number
  title: string
  content: string
  excerpt: string
  featured_image_url?: string | null
  author: User
  category?: BlogCategory | null
  tags: BlogTag[]
  /** Null while the post is a draft. */
  published_at: string | null
  created_at: string
  updated_at: string
  read_time: string
  views: number
  is_published: boolean
  is_featured: boolean
  likes_count?: number
  comments_count?: number
  is_liked?: boolean
  is_bookmarked?: boolean
}

export interface BlogPostInput {
  title: string
  content: string
  excerpt?: string
  /** The serializer takes a category id. */
  category?: number | null
  /** The serializer takes tag names, not ids, and creates any that are new. */
  tag_names?: string[]
  read_time?: string
  is_published?: boolean
  is_featured?: boolean
}

type Params = Record<string, string | number | boolean | null | undefined>

export const blogApi = {
  list: (params: Params = {}) => api.get<Paginated<BlogPost>>('/blog/posts/', { params }),

  /**
   * Your own unpublished posts.
   *
   * Drafts used to live in localStorage under a single key, so there was only
   * ever one, it never left the browser, and it was gone on another device.
   */
  drafts: () => api.get<Paginated<BlogPost>>('/blog/posts/', { params: { status: 'draft' } }),

  get: (id: number | string) => api.get<BlogPost>(`/blog/posts/${id}/`),

  create: (data: BlogPostInput) => api.post<BlogPost>('/blog/posts/', data),

  update: (id: number | string, data: Partial<BlogPostInput>) =>
    api.patch<BlogPost>(`/blog/posts/${id}/`, data),

  remove: (id: number | string) => api.delete(`/blog/posts/${id}/`),

  publish: (id: number | string) =>
    api.patch<BlogPost>(`/blog/posts/${id}/`, { is_published: true }),

  unpublish: (id: number | string) =>
    api.patch<BlogPost>(`/blog/posts/${id}/`, { is_published: false }),

  toggleLike: (id: number | string) => api.post(`/blog/posts/${id}/like/`),
  toggleBookmark: (id: number | string) => api.post(`/blog/posts/${id}/bookmark/`),
  trackView: (id: number | string) => api.post(`/blog/posts/${id}/view/`),

  categories: () => api.get<BlogCategory[] | Paginated<BlogCategory>>('/blog/categories/'),
  tags: () => api.get<BlogTag[] | Paginated<BlogTag>>('/blog/tags/'),

  comments: (postId: number | string) => api.get(`/blog/posts/${postId}/comments/`),
  addComment: (postId: number | string, content: string, parent?: number | null) =>
    api.post(`/blog/posts/${postId}/comments/`, { content, parent: parent ?? null }),
}

export default blogApi
