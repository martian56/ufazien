import apiClient from './api';

export const communityAPI = {
  // Groups
  async getGroups(params = {}) {
    const response = await apiClient.get('/community/groups/', { params });
    return response.data;
  },

  async getGroup(id) {
    const response = await apiClient.get(`/community/groups/${id}/`);
    return response.data;
  },

  async createGroup(groupData) {
    const response = await apiClient.post('/community/groups/', groupData);
    return response.data;
  },

  async updateGroup(id, groupData) {
    const response = await apiClient.patch(`/community/groups/${id}/`, groupData);
    return response.data;
  },

  async deleteGroup(id) {
    await apiClient.delete(`/community/groups/${id}/`);
  },

  async joinGroup(id) {
    const response = await apiClient.post(`/community/groups/${id}/join/`);
    return response.data;
  },

  async leaveGroup(id) {
    const response = await apiClient.post(`/community/groups/${id}/leave/`);
    return response.data;
  },

  async getMyGroups() {
    const response = await apiClient.get('/community/groups/my_groups/');
    return response.data;
  },

  async getGroupMessages(id, page = 1) {
    const response = await apiClient.get(`/community/groups/${id}/messages/`, {
      params: { page }
    });
    return response.data;
  },

  // Forums
  async getForums(params = {}) {
    const response = await apiClient.get('/community/forums/', { params });
    return response.data;
  },

  async getForum(id) {
    const response = await apiClient.get(`/community/forums/${id}/`);
    return response.data;
  },

  async createForum(forumData) {
    const response = await apiClient.post('/community/forums/', forumData);
    return response.data;
  },

  async updateForum(id, forumData) {
    const response = await apiClient.patch(`/community/forums/${id}/`, forumData);
    return response.data;
  },

  async deleteForum(id) {
    await apiClient.delete(`/community/forums/${id}/`);
  },

  async getForumPosts(forumId, params = {}) {
    const response = await apiClient.get(`/community/forums/${forumId}/posts/`, { params });
    return response.data;
  },

  // Posts
  async getPosts(params = {}) {
    const response = await apiClient.get('/community/posts/', { params });
    return response.data;
  },

  async getPost(id) {
    const response = await apiClient.get(`/community/posts/${id}/`);
    return response.data;
  },

  async createPost(postData) {
    const response = await apiClient.post('/community/posts/', postData);
    return response.data;
  },

  async updatePost(id, postData) {
    const response = await apiClient.patch(`/community/posts/${id}/`, postData);
    return response.data;
  },

  async deletePost(id) {
    await apiClient.delete(`/community/posts/${id}/`);
  },

  async likePost(id) {
    const response = await apiClient.post(`/community/posts/${id}/like/`);
    return response.data;
  },

  async bookmarkPost(id) {
    const response = await apiClient.post(`/community/posts/${id}/bookmark/`);
    return response.data;
  },

  async getPostReplies(postId, params = {}) {
    const response = await apiClient.get(`/community/posts/${postId}/replies/`, { params });
    return response.data;
  },

  // Replies
  async createReply(replyData) {
    const response = await apiClient.post('/community/replies/', replyData);
    return response.data;
  },

  async likeReply(id) {
    const response = await apiClient.post(`/community/replies/${id}/like/`);
    return response.data;
  },

  // Private Chats
  async getChats() {
    const response = await apiClient.get('/community/chats/');
    return response.data;
  },

  async getChat(id) {
    const response = await apiClient.get(`/community/chats/${id}/`);
    return response.data;
  },

  async createChat(chatData) {
    const response = await apiClient.post('/community/chats/', chatData);
    return response.data;
  },

  async getChatMessages(chatId, page = 1) {
    const response = await apiClient.get(`/community/chats/${chatId}/messages/`, {
      params: { page }
    });
    return response.data;
  },

  async sendChatMessage(chatId, content) {
    const response = await apiClient.post(`/community/chats/${chatId}/messages/`, {
      content: content
    });
    return response.data;
  },

  async markChatAsRead(chatId) {
    const response = await apiClient.post(`/community/chats/${chatId}/mark_read/`);
    return response.data;
  },

  // Statistics
  async getCommunityStats() {
    const response = await apiClient.get('/community/stats/');
    return response.data;
  },

  async getRecommendedGroups() {
    const response = await apiClient.get('/community/recommended-groups/');
    return response.data;
  },

  // Activity
  async getUserActivity(params = {}) {
    const response = await apiClient.get('/community/activity/', { params });
    return response.data;
  },

  // User Search
  async searchUsers(query) {
    const response = await apiClient.get('/api/auth/search/', { params: { q: query } });
    return response.data;
  }
};

export default communityAPI;
