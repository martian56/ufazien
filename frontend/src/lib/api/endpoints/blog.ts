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

/**
 * Who can reach a post.
 *
 * The editor has offered these four since it was written but sent none of
 * them, so choosing "private" published to everyone. Enforced in
 * BlogPost.visible_to on the server.
 */
export type PostVisibility = 'public' | 'unlisted' | 'followers' | 'private'

export interface BlogPost {
  id: number
  title: string
  content: string
  excerpt: string
  featured_image_url?: string | null
  author: User
  category?: BlogCategory | null
  /** The serializer sends the name alongside the id. */
  category_name?: string | null
  /**
   * Names, not objects. get_tags returns [tag.name for tag in ...], so a
   * card that rendered these as objects was rendering "[object Object]".
   */
  tags: string[]
  /** Null while the post is a draft. */
  published_at: string | null
  created_at: string
  updated_at: string
  read_time: string
  views: number
  is_published: boolean
  is_featured: boolean
  visibility: PostVisibility
  /** Published, but dated forward, so not live yet. */
  is_scheduled?: boolean
  likes_count?: number
  comments_count?: number
  /** Root comments, each with its own nested replies. */
  comments?: unknown[]
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
  visibility?: PostVisibility
  /** A future value schedules the post: it stays out of listings until then. */
  published_at?: string | null
}

/** Counted from your own posts. Nothing here is estimated or made up. */
export interface WritingStats {
  streak_days: number
  posts_this_week: number
  published: number
  drafts: number
  /** Local hour you post in most often, or null below three posts. */
  best_hour: number | null
  active_days: number
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

  myStats: () => api.get<WritingStats>('/blog/my-stats/'),

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
