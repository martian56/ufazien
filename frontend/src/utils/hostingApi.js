import apiClient from './api.js';

// Hosting API Services
export const hostingApi = {
  // Subscription Plans
  getSubscriptionPlans: () => apiClient.get('/hosting/subscription-plans/'),
  
  // User Subscription
  getUserSubscription: () => apiClient.get('/hosting/subscriptions/current/'),
  upgradeSubscription: (planName) => apiClient.post('/hosting/subscriptions/upgrade/', { plan: planName }),
  
  // Dashboard
  getDashboardStats: () => apiClient.get('/hosting/dashboard/stats/'),
  
  // Websites
  getWebsites: () => apiClient.get('/hosting/websites/'),
  createWebsite: (data) => apiClient.post('/hosting/websites/', data),
  getWebsite: (id) => apiClient.get(`/hosting/websites/${id}/`),
  updateWebsite: (id, data) => apiClient.patch(`/hosting/websites/${id}/`, data),
  deleteWebsite: (id) => apiClient.delete(`/hosting/websites/${id}/`),
  deployWebsite: (id) => apiClient.post(`/hosting/websites/${id}/deploy/`),
  
  // Website-specific endpoints
  getWebsiteDeployments: (websiteId) => apiClient.get(`/hosting/websites/${websiteId}/deployments/`),
  getWebsiteAnalytics: (websiteId, period = '7d') => apiClient.get(`/hosting/websites/${websiteId}/analytics/?period=${period}`),
  
  // Databases
  getDatabases: () => apiClient.get('/hosting/databases/'),
  createDatabase: (data) => apiClient.post('/hosting/databases/', data),
  getDatabase: (id) => apiClient.get(`/hosting/databases/${id}/`),
  updateDatabase: (id, data) => apiClient.patch(`/hosting/databases/${id}/`, data),
  deleteDatabase: (id) => apiClient.delete(`/hosting/databases/${id}/`),
  changeDatabasePassword: (id, password) => apiClient.post(`/hosting/databases/${id}/change_password/`, { password }),
  
  // Domains
  getDomains: () => apiClient.get('/hosting/domains/'),
  getAvailableDomains: () => apiClient.get('/hosting/domains/available/'),
  createDomain: (data) => apiClient.post('/hosting/domains/', data),
  getDomain: (id) => apiClient.get(`/hosting/domains/${id}/`),
  updateDomain: (id, data) => apiClient.patch(`/hosting/domains/${id}/`, data),
  deleteDomain: (id) => apiClient.delete(`/hosting/domains/${id}/`),
  
  // Deployments
  getDeployments: () => apiClient.get('/hosting/deployments/'),
  getDeployment: (id) => apiClient.get(`/hosting/deployments/${id}/`),
  
  // SSL Certificates
  getSSLCertificates: () => apiClient.get('/hosting/ssl-certificates/'),
  createSSLCertificate: (data) => apiClient.post('/hosting/ssl-certificates/', data),
  deleteSSLCertificate: (id) => apiClient.delete(`/hosting/ssl-certificates/${id}/`),
  renewSSLCertificate: (id) => apiClient.post(`/hosting/ssl-certificates/${id}/renew/`),
  
  // Analytics
  getWebsiteAnalytics: (websiteId, period = '7d') => 
    apiClient.get(`/hosting/websites/${websiteId}/analytics/?period=${period}`),
  getBandwidthUsage: (period = '30d') => 
    apiClient.get(`/hosting/analytics/bandwidth/?period=${period}`),
  
  // Backups
  getBackupJobs: () => apiClient.get('/hosting/backups/'),
  createBackupJob: (data) => apiClient.post('/hosting/backups/', data),
  restoreBackup: (id) => apiClient.post(`/hosting/backups/${id}/restore/`),
  
  // Invoices
  getInvoices: () => apiClient.get('/hosting/invoices/'),
  getInvoice: (id) => apiClient.get(`/hosting/invoices/${id}/`),
  
  // Activity Log
  getActivityLog: (params = {}) => {
    const queryParams = new URLSearchParams();
    if (params.action) queryParams.append('action', params.action);
  if (params.page) queryParams.append('page', params.page);
  if (params.page_size) queryParams.append('page_size', params.page_size);
    
    const url = `/hosting/activity-logs/${queryParams.toString() ? '?' + queryParams.toString() : ''}`;
    return apiClient.get(url);
  },
  
  // Deployment Logs
  getDeploymentLogs: (websiteId = null, params = {}) => {
    const queryParams = new URLSearchParams();
    if (websiteId) queryParams.append('website', websiteId);
    if (params.status) queryParams.append('status', params.status);
  if (params.page) queryParams.append('page', params.page);
  if (params.page_size) queryParams.append('page_size', params.page_size);
    
    const url = `/hosting/deployments/${queryParams.toString() ? '?' + queryParams.toString() : ''}`;
    return apiClient.get(url);
  },
  uploadFiles: (websiteId, formData) => apiClient.post(`/hosting/websites/${websiteId}/upload_files/`, formData),
  uploadZip: (websiteId, formData) => apiClient.post(`/hosting/websites/${websiteId}/upload_zip/`, formData),
  // File management
  listFiles: (websiteId) => apiClient.get(`/hosting/websites/${websiteId}/list_files/`),
  deleteFile: (websiteId, filename) => apiClient.post(`/hosting/websites/${websiteId}/delete_file/`, { filename }),
  downloadFile: (websiteId, filename) => apiClient.get(`/hosting/websites/${websiteId}/download_file/?filename=${encodeURIComponent(filename)}`),
  };

// Auth API Services
export const authApi = {
  login: async (credentials) => {
    const response = await apiClient.post('/auth/login/', credentials);
    if (response && response.access && response.refresh) {
      apiClient.setTokens(response.access, response.refresh);
    }
    return response;
  },
  register: (userData) => apiClient.post('/auth/register/', userData),
  logout: () => {
    apiClient.removeToken();
    return apiClient.post('/auth/logout/');
  },
  refreshToken: () => {
    const refreshToken = localStorage.getItem('refresh');
    return apiClient.post('/auth/token/refresh/', { refresh: refreshToken });
  },
  getProfile: () => apiClient.get('/auth/profile/'),
  updateProfile: (data) => apiClient.patch('/auth/profile/', data),
  changePassword: (data) => apiClient.post('/auth/change-password/', data),
};

// Helper functions for subscription management
export const subscriptionHelpers = {
  // Check if user can create more websites
  canCreateWebsite: (userSubscription, currentWebsites) => {
    if (!userSubscription || !userSubscription.plan) return false;
    return currentWebsites.length < userSubscription.plan.max_websites;
  },
  
  // Check if user can create more databases
  canCreateDatabase: (userSubscription, currentDatabases) => {
    if (!userSubscription || !userSubscription.plan) return false;
    return currentDatabases.length < userSubscription.plan.max_databases;
  },
  
  // Get storage usage percentage
  getStorageUsagePercentage: (userSubscription) => {
    if (!userSubscription || !userSubscription.plan) return 0;
    const used = userSubscription.storage_used_mb || 0;
    const limit = userSubscription.plan.storage_limit_mb;
    return Math.round((used / limit) * 100);
  },
  
  // Get bandwidth usage percentage
  getBandwidthUsagePercentage: (userSubscription) => {
    if (!userSubscription || !userSubscription.plan) return 0;
    const used = userSubscription.bandwidth_used_mb || 0;
    const limit = userSubscription.plan.bandwidth_limit_mb;
    return Math.round((used / limit) * 100);
  },
  
  // Format storage size
  formatStorage: (sizeInMB) => {
    if (sizeInMB < 1024) return `${sizeInMB} MB`;
    return `${(sizeInMB / 1024).toFixed(1)} GB`;
  },
  
  // Get plan color for UI
  getPlanColor: (planName) => {
    const colors = {
      free: 'text-gray-600 bg-gray-100',
      developer: 'text-blue-600 bg-blue-100',
      pro: 'text-purple-600 bg-purple-100',
    };
    return colors[planName?.toLowerCase()] || colors.free;
  },
  
  // Check if plan has feature
  hasFeature: (userSubscription, feature) => {
    if (!userSubscription || !userSubscription.plan) return false;
    return userSubscription.plan[feature] === true;
  },
};

export default { hostingApi, authApi, subscriptionHelpers };
