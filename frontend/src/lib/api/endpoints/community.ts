import { api } from '../client'
import type { Paginated, User } from '../types'

export interface Group {
  id: string
  name: string
  description: string
  category: string
  type: 'public' | 'private'
  max_members: number
  member_count: number
  is_full: boolean
  is_joined?: boolean
  course_code?: string | null
  professor?: string | null
  tags?: string[]
  owner: User
  created_at: string
}

export interface Forum {
  id: string
  title: string
  description: string
  category: string
  icon_name: string
  color_class: string
  post_count?: number
  member_count?: number
  created_at: string
}

export interface ForumPost {
  id: string
  forum: string
  author: User
  title: string
  content: string
  tags: string[]
  is_pinned: boolean
  is_locked: boolean
  view_count: number
  like_count: number
  reply_count: number
  is_liked: boolean
  is_bookmarked: boolean
  created_at: string
  updated_at: string
}

export interface PostReply {
  id: string
  post: string
  author: User
  parent_reply: string | null
  content: string
  like_count: number
  is_liked?: boolean
  created_at: string
}

export interface ChatMessage {
  id: string
  sender: User
  content: string
  message_type?: string
  created_at: string
}

export interface PrivateChat {
  id: string
  participants: User[]
  name?: string | null
  is_group_chat: boolean
  last_message?: ChatMessage | null
  unread_count?: number
}

type Params = Record<string, string | number | boolean | null | undefined>

export const communityApi = {
  // Groups
  getGroups: (params: Params = {}) => api.get<Paginated<Group> | Group[]>('/community/groups/', { params }),
  getGroup: (id: string) => api.get<Group>(`/community/groups/${id}/`),
  createGroup: (data: Partial<Group>) => api.post<Group>('/community/groups/', data),
  updateGroup: (id: string, data: Partial<Group>) => api.patch<Group>(`/community/groups/${id}/`, data),
  deleteGroup: (id: string) => api.delete(`/community/groups/${id}/`),
  joinGroup: (id: string) => api.post<Group>(`/community/groups/${id}/join/`),
  leaveGroup: (id: string) => api.post<Group>(`/community/groups/${id}/leave/`),
  getMyGroups: () => api.get<Paginated<Group> | Group[]>('/community/groups/my_groups/'),
  getGroupMessages: (id: string, page = 1) =>
    api.get<Paginated<ChatMessage>>(`/community/groups/${id}/messages/`, { params: { page } }),

  // Forums
  getForums: (params: Params = {}) => api.get<Paginated<Forum> | Forum[]>('/community/forums/', { params }),
  getForum: (id: string) => api.get<Forum>(`/community/forums/${id}/`),
  createForum: (data: Partial<Forum>) => api.post<Forum>('/community/forums/', data),
  updateForum: (id: string, data: Partial<Forum>) => api.patch<Forum>(`/community/forums/${id}/`, data),
  deleteForum: (id: string) => api.delete(`/community/forums/${id}/`),
  getForumPosts: (forumId: string, params: Params = {}) =>
    api.get<Paginated<ForumPost> | ForumPost[]>(`/community/forums/${forumId}/posts/`, { params }),

  // Posts
  getPosts: (params: Params = {}) => api.get<Paginated<ForumPost> | ForumPost[]>('/community/posts/', { params }),
  getPost: (id: string) => api.get<ForumPost>(`/community/posts/${id}/`),
  createPost: (data: Partial<ForumPost>) => api.post<ForumPost>('/community/posts/', data),
  updatePost: (id: string, data: Partial<ForumPost>) => api.patch<ForumPost>(`/community/posts/${id}/`, data),
  deletePost: (id: string) => api.delete(`/community/posts/${id}/`),
  likePost: (id: string) => api.post<{ liked: boolean; like_count: number }>(`/community/posts/${id}/like/`),
  bookmarkPost: (id: string) =>
    api.post<{ bookmarked: boolean }>(`/community/posts/${id}/bookmark/`),
  getPostReplies: (postId: string, params: Params = {}) =>
    api.get<Paginated<PostReply> | PostReply[]>(`/community/posts/${postId}/replies/`, { params }),

  // Replies
  createReply: (data: { post: string; content: string; parent_reply?: string | null }) =>
    api.post<PostReply>('/community/replies/', data),
  likeReply: (id: string) => api.post<{ liked: boolean; like_count: number }>(`/community/replies/${id}/like/`),

  // Private chats
  getChats: () => api.get<Paginated<PrivateChat> | PrivateChat[]>('/community/chats/'),
  getChat: (id: string) => api.get<PrivateChat>(`/community/chats/${id}/`),
  createChat: (data: { participant_ids: number[]; name?: string; is_group_chat?: boolean }) =>
    api.post<PrivateChat>('/community/chats/', data),
  getChatMessages: (chatId: string, page = 1) =>
    api.get<Paginated<ChatMessage>>(`/community/chats/${chatId}/messages/`, { params: { page } }),
  sendChatMessage: (chatId: string, content: string) =>
    api.post<ChatMessage>(`/community/chats/${chatId}/messages/`, { content }),
  markChatAsRead: (chatId: string) => api.post(`/community/chats/${chatId}/mark_read/`),

  // Statistics and discovery
  getCommunityStats: () =>
    api.get<{
      user_stats: Record<string, number>
      community_stats: Record<string, number>
    }>('/community/stats/'),
  getRecommendedGroups: () => api.get<Group[]>('/community/recommended-groups/'),
  getUserActivity: (params: Params = {}) => api.get('/community/activity/', { params }),

  /**
   * Was '/api/auth/search/' against a client whose base already ended in /api,
   * so every request went to /api/api/auth/search/ and 404d. Starting a chat
   * could never find anyone.
   */
  searchUsers: (query: string) => api.get<User[]>('/auth/search/', { params: { q: query } }),
}

export default communityApi
